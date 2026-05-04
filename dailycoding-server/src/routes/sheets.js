import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { query, queryOne } from '../config/mysql.js';
import { Problem } from '../models/Problem.js';
import { errorResponse, internalError } from '../middleware/errorHandler.js';

const router = Router();

function parseJsonList(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

router.get('/sheets', auth, async (req, res) => {
  try {
    const category = req.query.category;
    const rows = await query(
      `SELECT *
       FROM problem_sheets
       WHERE (? IS NULL OR category = ?)
       ORDER BY category ASC, created_at DESC`,
      [category || null, category || null]
    );
    res.json(rows.map((row) => ({
      ...row,
      problemIds: parseJsonList(row.problem_ids),
      problemCount: parseJsonList(row.problem_ids).length,
    })));
  } catch (err) {
    console.error('[sheets/list]', err);
    return internalError(res);
  }
});

router.get('/sheets/:id', auth, async (req, res) => {
  try {
    const row = await queryOne('SELECT * FROM problem_sheets WHERE id = ?', [req.params.id]);
    if (!row) return errorResponse(res, 404, 'NOT_FOUND', '문제 세트를 찾을 수 없습니다.');
    const problemIds = parseJsonList(row.problem_ids);
    const problems = [];
    for (const problemId of problemIds) {
      const problem = await Problem.findById(Number(problemId), req.user.id);
      if (problem) problems.push(problem);
    }
    res.json({
      ...row,
      problemIds,
      problems,
    });
  } catch (err) {
    console.error('[sheets/detail]', err);
    return internalError(res);
  }
});

router.get('/learning-paths', async (req, res) => {
  try {
    const rows = await query(
      'SELECT * FROM learning_paths WHERE is_active = 1 ORDER BY order_index ASC',
      []
    );
    res.json(rows.map((row) => ({ ...row, problemIds: parseJsonList(row.problem_ids) })));
  } catch (err) {
    console.error('[learning-paths/list]', err);
    return internalError(res);
  }
});

router.get('/learning-paths/:id', async (req, res) => {
  try {
    const row = await queryOne('SELECT * FROM learning_paths WHERE id = ?', [req.params.id]);
    if (!row) return errorResponse(res, 404, 'NOT_FOUND', '학습 경로를 찾을 수 없습니다.');
    const problemIds = parseJsonList(row.problem_ids);
    const problems = [];
    for (const problemId of problemIds) {
      const problem = await Problem.findById(Number(problemId), req.user?.id);
      if (problem) problems.push(problem);
    }
    res.json({
      ...row,
      problemIds,
      problems,
    });
  } catch (err) {
    console.error('[learning-paths/detail]', err);
    return internalError(res);
  }
});

export default router;
