import { GoogleGenerativeAI } from '@google/generative-ai';
import redis from '../config/redis.js';

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const MODEL = 'gemini-2.0-flash-lite';

/**
 * Gemini AI에게 질문을 던지고 JSON 결과를 반환받습니다.
 * @param {string} userId - 유저 ID (할당량 추적용)
 * @param {string} prompt - 프롬프트
 * @param {object} fallback - 실패 시 반환할 기본값
 * @param {number} maxTokens - 최대 토큰 수
 * @returns {Promise<object>}
 */
export async function askAI(userId, prompt, fallback, maxTokens = 400) {
  if (!genAI) return fallback;

  const cooldownKey = `ai:cooldown:${userId}`;
  const isCooldown = await redis.get(cooldownKey);
  if (isCooldown) {
    console.warn(`[AI] Cooldown active for User ${userId}`);
    return fallback;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.7,
        responseMimeType: 'application/json'
      },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    try {
      return JSON.parse(text);
    } catch {
      const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { return JSON.parse(jsonMatch[0]); } catch { }
      }
      console.warn('[AI] JSON parsing failed, using fallback');
      return fallback;
    }
  } catch (err) {
    if (err.message?.includes('429') || err.message?.includes('quota')) {
      await redis.set(cooldownKey, '1', 300); // 5분 폴백
      console.warn(`[AI] Quota exceeded -> User ${userId} 5m cooldown`);
    } else {
      console.error('[AI] Error:', err.message?.slice(0, 150));
    }
    return fallback;
  }
}
