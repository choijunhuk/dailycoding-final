import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne, run } from '../config/mysql.js';
import { auth, adminOnly, SECRET } from '../middleware/auth.js';
import { errorResponse, internalError } from '../middleware/errorHandler.js';

const router = Router();

function getWeekStartDate(date = new Date()) {
  const base = new Date(date);
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + diff);
  return base.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function getOptionalUserId(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(header.slice(7), SECRET, {
      issuer: 'dailycoding',
      audience: 'dailycoding-client',
    });
    return Number(decoded?.id) || null;
  } catch {
    return null;
  }
}

router.get('/weekly', async (req, res) => {
  try {
    const weekStart = getWeekStartDate();
    const userId = await getOptionalUserId(req);
    const row = await queryOne(
      `SELECT wc.id,
              wc.problem_id AS problemId,
              wc.week_start AS weekStart,
              wc.reward_code AS rewardCode,
              p.title AS problemTitle,
              p.tier,
              p.difficulty,
              ${
                userId
                  ? `(SELECT 1
                      FROM submissions s
                      WHERE s.user_id = ${Number(userId)}
                        AND s.problem_id = wc.problem_id
                        AND s.result = 'correct'
                      LIMIT 1) AS isSolved`
                  : 'NULL AS isSolved'
              }
       FROM weekly_challenges wc
       JOIN problems p ON p.id = wc.problem_id
       WHERE wc.week_start = ?`,
      [weekStart]
    );

    if (!row) return res.json(null);

    return res.json({
      id: row.id,
      problemId: row.problemId,
      problemTitle: row.problemTitle,
      tier: row.tier,
      difficulty: row.difficulty,
      rewardCode: row.rewardCode,
      weekStart: row.weekStart,
      weekEnd: addDays(row.weekStart, 6),
      isSolved: row.isSolved == null ? null : Boolean(row.isSolved),
    });
  } catch (err) {
    console.error('[weekly/get]', err);
    return internalError(res);
  }
});

router.post('/weekly', auth, adminOnly, async (req, res) => {
  try {
    const problemId = Number(req.body?.problemId);
    const rewardCode = String(req.body?.rewardCode || 'weekly_solver').trim().slice(0, 50) || 'weekly_solver';
    if (!problemId) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', '문제 ID가 필요합니다.');
    }

    const problem = await queryOne('SELECT id FROM problems WHERE id = ?', [problemId]);
    if (!problem) {
      return errorResponse(res, 404, 'NOT_FOUND', '문제를 찾을 수 없습니다.');
    }

    const weekStart = getWeekStartDate();
    await run(
      `INSERT INTO weekly_challenges (problem_id, week_start, reward_code, created_by)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         problem_id = VALUES(problem_id),
         reward_code = VALUES(reward_code),
         created_by = VALUES(created_by)`,
      [problemId, weekStart, rewardCode, req.user.id]
    );

    return res.json({ weekStart, problemId, rewardCode });
  } catch (err) {
    console.error('[weekly/post]', err);
    return internalError(res);
  }
});

export default router;
