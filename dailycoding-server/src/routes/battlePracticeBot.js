import { Router } from 'express';
import { auth, requireVerified } from '../middleware/auth.js';
import { Problem } from '../models/Problem.js';
import { User } from '../models/User.js';
import { errorResponse, internalError } from '../middleware/errorHandler.js';
import { askAIWithMeta } from '../services/ai.js';
import { TIER_ORDER } from '../shared/constants.js';
import redis from '../config/redis.js';
import logger from '../config/logger.js';

const router = Router();

// MVP scope:
// This is a single-player "shadow battle" — no real room is created, no socket
// event timeline written. We pick a problem near the user's tier, generate a
// synthetic opponent profile + scripted submission timeline using Gemini, and
// return them in one payload. The client renders the opponent's progress on a
// timer so the user feels like they're racing a real player.
//
// A true matchmaking-fallback bot (joins battle_rooms with is_bot=1) is a
// larger change touching battle_participants schema + socket fanout — left as
// a follow-up.

function pickBotTier(userTier) {
  const idx = Math.max(0, TIER_ORDER.indexOf(userTier || 'bronze'));
  // Bot is randomly 1 step below to 1 step above the user.
  const delta = Math.floor(Math.random() * 3) - 1;
  const clamped = Math.max(0, Math.min(TIER_ORDER.length - 1, idx + delta));
  return TIER_ORDER[clamped];
}

const BOT_NAMES = [
  'ada-bot', 'turing-bot', 'lovelace-bot', 'hopper-bot',
  'knuth-bot', 'dijkstra-bot', 'shannon-bot', 'erdos-bot',
];

function randomBotName() {
  return BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
}

router.post('/practice-bot/start', auth, requireVerified, async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me) return errorResponse(res, 401, 'AUTH', 'User not found.');

    const requestedTier = req.body?.tier;
    const tier = requestedTier && TIER_ORDER.includes(requestedTier)
      ? requestedTier
      : (me.tier || 'bronze');

    const candidates = await Problem.findAllByTier?.(tier) || await Problem.findAll?.({ tier });
    let chosen = null;
    if (Array.isArray(candidates) && candidates.length > 0) {
      chosen = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      // Fallback: query directly via Problem.findById range — practice can still
      // run if catalog API shape changes.
      const fallback = await Problem.search?.({ tier, limit: 20 });
      const list = fallback?.problems || fallback || [];
      chosen = list[Math.floor(Math.random() * Math.max(1, list.length))];
    }
    if (!chosen) return errorResponse(res, 404, 'NO_PROBLEMS', 'No problems available for this tier.');

    const botTier = pickBotTier(me.tier);
    const botName = randomBotName();
    // Simple scripted timeline. Lower tier -> later first attempt, more wrong tries.
    const tierIdx = TIER_ORDER.indexOf(botTier);
    const myIdx = TIER_ORDER.indexOf(me.tier || 'bronze');
    const skillGap = tierIdx - myIdx; // negative if bot is weaker

    const timeline = [];
    let t = 30 + Math.floor(Math.random() * 60); // bot waits 30-90s before first action
    const wrongAttempts = Math.max(0, 2 - skillGap);
    for (let i = 0; i < wrongAttempts; i += 1) {
      timeline.push({ at: t, type: 'submission', result: 'wrong' });
      t += 60 + Math.floor(Math.random() * 90);
    }
    timeline.push({ at: t, type: 'submission', result: 'correct' });

    const sessionId = `bot-${me.id}-${Date.now()}`;
    const session = {
      sessionId,
      startedAt: Date.now(),
      userId: me.id,
      problem: {
        id: chosen.id,
        title: chosen.title,
        tier: chosen.tier,
        desc: chosen.desc,
        inputDesc: chosen.inputDesc,
        outputDesc: chosen.outputDesc,
        examples: chosen.examples || [],
        timeLimit: chosen.timeLimit,
        memLimit: chosen.memLimit,
      },
      bot: {
        username: botName,
        tier: botTier,
        timeline,
      },
    };
    await redis.setJSON(`battle:practice-bot:${sessionId}`, session, 3600);
    return res.json(session);
  } catch (err) {
    logger.error('[battles/practice-bot/start]', { message: err.message });
    return internalError(res);
  }
});

router.get('/practice-bot/:sessionId', auth, async (req, res) => {
  try {
    const session = await redis.getJSON(`battle:practice-bot:${req.params.sessionId}`);
    if (!session) return errorResponse(res, 404, 'NOT_FOUND', 'Practice session expired or not found.');
    if (session.userId !== req.user.id) return errorResponse(res, 403, 'FORBIDDEN', 'Not your session.');
    return res.json(session);
  } catch (err) {
    logger.error('[battles/practice-bot/get]', { message: err.message });
    return internalError(res);
  }
});

// On user submission result, ask AI for a one-line bot "chat" reaction.
router.post('/practice-bot/:sessionId/react', auth, async (req, res) => {
  try {
    const session = await redis.getJSON(`battle:practice-bot:${req.params.sessionId}`);
    if (!session || session.userId !== req.user.id) return res.json({ message: null });
    const { event } = req.body || {};
    const validEvents = new Set(['user_correct', 'user_wrong', 'bot_correct']);
    if (!validEvents.has(event)) return res.json({ message: null });

    const prompt = `You are ${session.bot.username}, a friendly coding bot in a 1v1 battle.
Event: ${event}
Respond with ONE short sentence (max 12 words), playful but not gloating. Korean.`;
    try {
      const fallbacks = {
        user_correct: '잘 풀었네요! 다음 라운드도 기대할게요.',
        user_wrong: '괜찮아요, 다시 시도해 봐요.',
        bot_correct: '저도 한 문제 풀었습니다!',
      };
      const fallback = fallbacks[event] || null;
      const aiResult = await askAIWithMeta(req.user.id, prompt, fallback, 60);
      return res.json({ message: (aiResult?.data || fallback || '').toString().trim() || null });
    } catch {
      return res.json({ message: null });
    }
  } catch (err) {
    logger.warn('[battles/practice-bot/react]', { message: err.message });
    return res.json({ message: null });
  }
});

export default router;
