import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { query, queryOne } from '../config/mysql.js';
import { errorResponse, internalError } from '../middleware/errorHandler.js';
import { TIER_ORDER } from '../shared/constants.js';
import redis from '../config/redis.js';
import logger from '../config/logger.js';

const router = Router();

const PLAN_LENGTH_DAYS = 14;
// Per-day tier mix. Day 1 is gentle; difficulty climbs toward day 14.
const DAILY_TIER_MIX = [
  { count: 3, tiers: ['unranked', 'iron', 'bronze'] },         // day 1
  { count: 3, tiers: ['iron', 'bronze'] },                      // day 2
  { count: 3, tiers: ['bronze'] },                              // day 3
  { count: 3, tiers: ['bronze', 'silver'] },                    // day 4
  { count: 3, tiers: ['bronze', 'silver'] },                    // day 5
  { count: 3, tiers: ['silver'] },                              // day 6
  { count: 3, tiers: ['silver'] },                              // day 7
  { count: 3, tiers: ['silver', 'gold'] },                      // day 8
  { count: 3, tiers: ['silver', 'gold'] },                      // day 9
  { count: 3, tiers: ['gold'] },                                // day 10
  { count: 3, tiers: ['gold'] },                                // day 11
  { count: 3, tiers: ['gold', 'platinum'] },                    // day 12
  { count: 3, tiers: ['gold', 'platinum'] },                    // day 13
  { count: 3, tiers: ['platinum', 'emerald'] },                 // day 14 — graduation
];

function daysBetween(fromDate, toDate) {
  const ms = toDate.getTime() - fromDate.getTime();
  return Math.floor(ms / 86_400_000);
}

router.get('/onboarding-plan/today', auth, async (req, res) => {
  try {
    const user = await queryOne(
      'SELECT id, join_date, tier FROM users WHERE id = ?',
      [req.user.id],
    );
    if (!user?.join_date) {
      return res.json({ active: false, reason: 'no_join_date' });
    }
    const join = new Date(user.join_date);
    const dayIndex = daysBetween(join, new Date());
    if (dayIndex < 0 || dayIndex >= PLAN_LENGTH_DAYS) {
      return res.json({ active: false, dayNumber: dayIndex + 1, totalDays: PLAN_LENGTH_DAYS });
    }
    const mix = DAILY_TIER_MIX[dayIndex];

    const cacheKey = `onboarding:plan:${req.user.id}:${dayIndex}`;
    const cached = await redis.getJSON(cacheKey);
    if (cached) return res.json(cached);

    // Pull candidate problems for the day's tiers, prefer unsolved.
    // Solved = at least one submission with result='correct'.
    const tierPlaceholders = mix.tiers.map(() => '?').join(',');
    const rows = await query(
      `SELECT p.id, p.title, p.tier, p.difficulty,
              EXISTS (
                SELECT 1 FROM submissions s
                WHERE s.user_id = ? AND s.problem_id = p.id AND s.result = 'correct'
              ) AS solved
       FROM problems p
       WHERE p.tier IN (${tierPlaceholders})
         AND COALESCE(p.is_premium, 0) = 0
         AND COALESCE(p.visibility, 'global') = 'global'
       ORDER BY solved ASC, RAND()
       LIMIT ?`,
      [req.user.id, ...mix.tiers, mix.count * 4],
    );

    const unsolved = (rows || []).filter((r) => Number(r.solved) === 0).slice(0, mix.count);
    const picks = unsolved.length === mix.count
      ? unsolved
      : [...unsolved, ...(rows || []).filter((r) => !unsolved.includes(r)).slice(0, mix.count - unsolved.length)];

    const completedToday = await query(
      `SELECT DISTINCT problem_id FROM submissions
       WHERE user_id = ? AND result = 'correct'
         AND DATE(submitted_at) = CURDATE()`,
      [req.user.id],
    );
    const completedSet = new Set((completedToday || []).map((r) => Number(r.problem_id)));
    const result = {
      active: true,
      dayNumber: dayIndex + 1,
      totalDays: PLAN_LENGTH_DAYS,
      problems: picks.map((p) => ({
        id: p.id,
        title: p.title,
        tier: p.tier,
        difficulty: p.difficulty,
        solvedToday: completedSet.has(Number(p.id)),
      })),
      summary: TIER_ORDER.indexOf(picks[0]?.tier || 'bronze') > -1
        ? `Day ${dayIndex + 1} / ${PLAN_LENGTH_DAYS}: ${picks.length}문제 추천`
        : `Day ${dayIndex + 1} / ${PLAN_LENGTH_DAYS}`,
    };
    // Cache 30 min — re-pulled on solve.
    await redis.setJSON(cacheKey, result, 1800);
    return res.json(result);
  } catch (err) {
    logger.error('[onboarding-plan/today]', { message: err.message });
    return internalError(res);
  }
});

export default router;
