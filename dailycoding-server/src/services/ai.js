import { GoogleGenerativeAI } from '@google/generative-ai';
import redis from '../config/redis.js';

let genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const DEFAULT_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
];
const PROVIDER_COOLDOWN_KEY = 'ai:cooldown:provider';
const LAST_AI_EVENT_KEY = 'ai:metrics:last';

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function parseModelList(value) {
  return String(value || '')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
}

function getModelCandidates() {
  return [...new Set([
    ...parseModelList(process.env.GEMINI_MODEL),
    ...parseModelList(process.env.GEMINI_FALLBACK_MODELS),
    ...DEFAULT_MODELS,
  ])];
}

function parseJsonPayload(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        console.warn('[AI] Extracted JSON parsing failed, using fallback');
      }
    }
    console.warn('[AI] JSON parsing failed, using fallback');
    return fallback;
  }
}

function isQuotaError(err) {
  const message = String(err?.message || '');
  return message.includes('429') || /quota|rate limit|RESOURCE_EXHAUSTED/i.test(message);
}

function isModelRetryableError(err) {
  const message = String(err?.message || '');
  return /not found|not supported|model|404|503|temporar/i.test(message);
}

function summarizeError(err) {
  return String(err?.message || err || 'unknown error').replace(/\s+/g, ' ').slice(0, 180);
}

async function recordAIEvent({ source, reason = null, model = null, providerCallStarted = false }) {
  try {
    const key = `ai:metrics:${getTodayKey()}`;
    await Promise.all([
      redis.hIncrBy(key, source === 'ai' ? 'success' : 'fallback', 1),
      reason ? redis.hIncrBy(key, `reason:${reason}`, 1) : Promise.resolve(),
      model ? redis.hIncrBy(key, `model:${model}`, 1) : Promise.resolve(),
      providerCallStarted ? redis.hIncrBy(key, 'providerCalls', 1) : Promise.resolve(),
      redis.expire(key, 60 * 60 * 24 * 14),
      redis.setJSON(LAST_AI_EVENT_KEY, {
        source,
        reason,
        model,
        providerCallStarted,
        at: new Date().toISOString(),
      }, 60 * 60 * 24 * 14),
    ]);
  } catch {
    // Telemetry must never break user-facing AI requests.
  }
}

/**
 * Gemini AI에게 질문을 던지고 JSON 결과를 반환받습니다.
 * @param {string} userId - 유저 ID (할당량 추적용)
 * @param {string} prompt - 프롬프트
 * @param {object} fallback - 실패 시 반환할 기본값
 * @param {number} maxTokens - 최대 토큰 수
 * @returns {Promise<object>}
 */
export async function askAI(userId, prompt, fallback, maxTokens = 400) {
  const result = await askAIWithMeta(userId, prompt, fallback, maxTokens);
  return result.data;
}

export async function askAIWithMeta(userId, prompt, fallback, maxTokens = 400) {
  if (!genAI) {
    await recordAIEvent({ source: 'fallback', reason: 'missing_api_key' });
    return { data: fallback, source: 'fallback', reason: 'missing_api_key' };
  }

  const cooldownKey = `ai:cooldown:${userId}`;
  const [isUserCooldown, isProviderCooldown] = await Promise.all([
    redis.get(cooldownKey),
    redis.get(PROVIDER_COOLDOWN_KEY),
  ]);
  if (isUserCooldown || isProviderCooldown) {
    console.warn(`[AI] Cooldown active for User ${userId}`);
    const reason = isProviderCooldown ? 'provider_cooldown' : 'user_cooldown';
    await recordAIEvent({ source: 'fallback', reason });
    return {
      data: fallback,
      source: 'fallback',
      reason,
    };
  }

  const models = getModelCandidates();
  let lastError = null;
  let quotaFailures = 0;

  for (const modelName of models) {
    let providerCallStarted = false;
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.7,
          responseMimeType: 'application/json'
        },
      });

      providerCallStarted = true;
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      await recordAIEvent({ source: 'ai', model: modelName, providerCallStarted });
      return {
        data: parseJsonPayload(text, fallback),
        source: 'ai',
        model: modelName,
        providerCallStarted,
      };
    } catch (err) {
      lastError = err;
      if (isQuotaError(err)) {
        quotaFailures++;
        console.warn(`[AI] Quota error on ${modelName}: ${summarizeError(err)}`);
        continue;
      }
      if (isModelRetryableError(err)) {
        console.warn(`[AI] Retrying after ${modelName} failed: ${summarizeError(err)}`);
        continue;
      }
      console.error(`[AI] Error on ${modelName}:`, summarizeError(err));
      break;
    }
  }

  if (quotaFailures >= models.length) {
    await redis.set(PROVIDER_COOLDOWN_KEY, '1', 300);
    await redis.set(cooldownKey, '1', 300);
    console.warn(`[AI] Provider quota exhausted across ${models.length} model(s) -> 5m cooldown`);
  }

  const reason = isQuotaError(lastError) ? 'quota_exceeded' : 'provider_error';
  await recordAIEvent({
    source: 'fallback',
    reason,
    providerCallStarted: models.length > 0,
  });

  return {
    data: fallback,
    source: 'fallback',
    reason,
    error: summarizeError(lastError),
  };
}

export async function getAIServiceStatus() {
  const models = getModelCandidates();
  const [metrics, lastEvent, providerCooldownTtl] = await Promise.all([
    redis.hGetAll(`ai:metrics:${getTodayKey()}`),
    redis.getJSON(LAST_AI_EVENT_KEY).catch(() => null),
    redis.ttl(PROVIDER_COOLDOWN_KEY).catch(() => -2),
  ]);
  const success = Number(metrics.success || 0);
  const fallback = Number(metrics.fallback || 0);
  const providerCalls = Number(metrics.providerCalls || 0);
  const reasons = {};
  const modelUsage = {};

  for (const [key, value] of Object.entries(metrics || {})) {
    if (key.startsWith('reason:')) reasons[key.slice(7)] = Number(value) || 0;
    if (key.startsWith('model:')) modelUsage[key.slice(6)] = Number(value) || 0;
  }

  return {
    configured: Boolean(process.env.GEMINI_API_KEY),
    primaryModel: models[0] || null,
    fallbackModels: models.slice(1),
    providerCooldown: providerCooldownTtl > 0,
    providerCooldownSec: providerCooldownTtl > 0 ? providerCooldownTtl : 0,
    metricsToday: {
      success,
      fallback,
      providerCalls,
      fallbackRate: success + fallback > 0 ? Number(((fallback / (success + fallback)) * 100).toFixed(1)) : 0,
      reasons,
      modelUsage,
    },
    lastEvent,
  };
}

export function __setGenAIForTests(nextGenAI) {
  genAI = nextGenAI;
}

export function __resetGenAIForTests() {
  genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
}

export function __getModelCandidatesForTests() {
  return getModelCandidates();
}
