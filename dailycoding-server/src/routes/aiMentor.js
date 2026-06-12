import { Router } from 'express';
import { auth, requireVerified } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { Problem } from '../models/Problem.js';
import { askAIWithMeta } from '../services/ai.js';
import redis from '../config/redis.js';
import { errorResponse, internalError } from '../middleware/errorHandler.js';
import { AI_DAILY_QUOTA } from '../shared/constants.js';
import logger from '../config/logger.js';

const router = Router();

// AI mentor is more chatty than /hint, so Free users get a tighter quota
// dedicated to mentor (so it doesn't drain the shared AI_DAILY_QUOTA bucket).
const FREE_MENTOR_DAILY = 3;
const COOLDOWN_SECONDS = 30; // Prevent code-keystroke-driven spam.

router.post('/check', auth, requireVerified, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return errorResponse(res, 401, 'AUTH', 'User not found.');
    const isPro = (user.subscription_tier || 'free') !== 'free' || user.role === 'admin';

    const today = new Date().toISOString().slice(0, 10);
    const mentorKey = `quota:ai:mentor:${user.id}:${today}`;
    const cooldownKey = `cooldown:ai:mentor:${user.id}`;

    // Cooldown — applies to everyone, including Pro, to avoid runaway costs.
    const onCooldown = await redis.get(cooldownKey);
    if (onCooldown) {
      const ttl = await redis.ttl(cooldownKey);
      return errorResponse(res, 429, 'COOLDOWN', `Please wait ${ttl}s before asking the mentor again.`);
    }

    if (!isPro) {
      const used = parseInt(await redis.get(mentorKey) || '0', 10);
      if (used >= FREE_MENTOR_DAILY) {
        return errorResponse(res, 429, 'QUOTA_EXCEEDED', `Free 등급은 하루 ${FREE_MENTOR_DAILY}회만 멘토에게 물을 수 있습니다.`);
      }
    }

    const { problemId, code = '', language = 'python', uiLang = 'ko' } = req.body || {};
    if (!problemId) return errorResponse(res, 400, 'VALIDATION_ERROR', 'problemId is required.');
    const problem = await Problem.findById(Number(problemId));
    if (!problem) return errorResponse(res, 404, 'NOT_FOUND', 'Problem not found.');

    const userCode = String(code || '').slice(0, 8000); // hard cap input
    const promptLang = uiLang === 'en' ? 'English' : 'Korean';

    const system = `You are a coding mentor for a competitive programming platform.
The user is working on a problem and shares their current code.
Your job: nudge them in the right direction WITHOUT giving away the solution.

Rules:
- Reply in ${promptLang}, 3 sentences MAX.
- If the code looks empty or trivial, ask ONE clarifying question about their approach.
- If the code has a clear bug, mention WHERE (e.g. "loop bound", "off-by-one") but NEVER show the fix.
- If the approach is wrong, suggest a different category of algorithm (e.g. "this needs sorting first" or "consider a sliding window").
- Never paste corrected code. Never explain the full algorithm.
- End with a single concrete next step.`;

    const userPrompt = `## Problem
Title: ${problem.title}
Tier: ${problem.tier}
Description:
${(problem.desc || '').slice(0, 1500)}

## My current code (${language})
\`\`\`${language}
${userCode || '// (empty)'}
\`\`\`

Give me a gentle hint, not the answer.`;

    const startedAt = Date.now();
    const fallbackHint = uiLang === 'en'
      ? 'AI is temporarily unavailable. Try thinking about what data structure best fits the input size.'
      : 'AI 멘토를 잠시 사용할 수 없습니다. 입력 크기에 맞는 자료구조를 떠올려 보세요.';
    const aiResult = await askAIWithMeta(
      user.id,
      userPrompt,
      fallbackHint,
      400,
      { systemInstruction: system },
    );
    const text = aiResult?.data || fallbackHint;
    const model = aiResult?.source || null;
    const elapsedMs = Date.now() - startedAt;

    // Set cooldown + quota.
    await redis.set(cooldownKey, '1', COOLDOWN_SECONDS);
    if (!isPro) {
      await redis.incr(mentorKey, 86400);
    }

    return res.json({
      hint: text || '',
      model,
      elapsedMs,
      remaining: isPro
        ? null
        : Math.max(0, FREE_MENTOR_DAILY - (parseInt(await redis.get(mentorKey) || '0', 10))),
      cooldownSec: COOLDOWN_SECONDS,
    });
  } catch (err) {
    logger.error('[ai/mentor/check]', { message: err.message });
    return internalError(res);
  }
});

router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const isPro = (user?.subscription_tier || 'free') !== 'free' || user?.role === 'admin';
    const today = new Date().toISOString().slice(0, 10);
    const used = parseInt(await redis.get(`quota:ai:mentor:${req.user.id}:${today}`) || '0', 10);
    const cooldownTtl = await redis.ttl(`cooldown:ai:mentor:${req.user.id}`);
    return res.json({
      isPro,
      used,
      dailyLimit: isPro ? null : FREE_MENTOR_DAILY,
      remaining: isPro ? null : Math.max(0, FREE_MENTOR_DAILY - used),
      cooldownSec: cooldownTtl > 0 ? cooldownTtl : 0,
    });
  } catch (err) {
    logger.error('[ai/mentor/status]', { message: err.message });
    return internalError(res);
  }
});

export default router;
