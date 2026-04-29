import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { insert, queryOne, run } from '../config/mysql.js';
import { errorResponse, internalError } from '../middleware/errorHandler.js';

const router = Router();

async function ensureOnboardingRow(userId) {
  let row = await queryOne('SELECT * FROM user_onboarding WHERE user_id = ?', [userId]);
  if (!row) {
    await insert('INSERT INTO user_onboarding (user_id, step) VALUES (?, ?)', [userId, 'select_goal']);
    row = await queryOne('SELECT * FROM user_onboarding WHERE user_id = ?', [userId]);
  }
  return row;
}

router.get('/onboarding', auth, async (req, res) => {
  try {
    const row = await ensureOnboardingRow(req.user.id);
    if (row?.completed_at) {
      return res.json({ completed: true, step: 'done', data: row });
    }
    return res.json({
      completed: false,
      step: row?.step || 'select_goal',
      data: row,
    });
  } catch (err) {
    console.error('[onboarding/get]', err);
    return internalError(res);
  }
});

router.patch('/onboarding', auth, async (req, res) => {
  try {
    const { step, goal, targetCompany, experienceLevel } = req.body || {};
    const allowedSteps = new Set(['select_goal', 'select_level', 'select_company', 'done']);
    const allowedGoals = new Set(['job_hunting', 'skill_up', 'interview_prep', 'fun']);
    const allowedLevels = new Set(['beginner', 'intermediate', 'advanced']);

    if (!allowedSteps.has(step)) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', '유효하지 않은 온보딩 단계입니다.');
    }

    await ensureOnboardingRow(req.user.id);
    await run(
      `UPDATE user_onboarding
       SET step = ?,
           goal = ?,
           target_company = ?,
           experience_level = ?,
           completed_at = ?
       WHERE user_id = ?`,
      [
        step,
        allowedGoals.has(goal) ? goal : null,
        typeof targetCompany === 'string' ? targetCompany.trim().slice(0, 100) || null : null,
        allowedLevels.has(experienceLevel) ? experienceLevel : null,
        step === 'done' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
        req.user.id,
      ]
    );

    const row = await queryOne('SELECT * FROM user_onboarding WHERE user_id = ?', [req.user.id]);
    return res.json({
      completed: Boolean(row?.completed_at),
      step: row?.step || step,
      data: row,
    });
  } catch (err) {
    console.error('[onboarding/patch]', err);
    return internalError(res);
  }
});

export default router;
