import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { insert, query, queryOne, run } from '../config/mysql.js';
import { User } from '../models/User.js';
import { Problem } from '../models/Problem.js';
import { getCachedJudgeRuntime } from '../services/judgeRuntimeCache.js';
import { executeSubmissionFlow } from '../services/submissionExecution.js';
import { errorResponse, internalError } from '../middleware/errorHandler.js';

const router = Router();
router.use(auth);

function parseJsonList(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

async function requireExamSet(id) {
  const row = await queryOne('SELECT * FROM exam_sets WHERE id = ?', [id]);
  if (!row) return null;
  return {
    ...row,
    problemIds: parseJsonList(row.problem_ids).map(Number).filter(Boolean),
  };
}

async function getExamProblems(problemIds) {
  const problems = [];
  for (const problemId of problemIds) {
    const problem = await Problem.findById(problemId);
    if (problem) problems.push(problem);
  }
  return problems;
}

router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const company = typeof req.query.company === 'string' ? req.query.company : null;
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 10));
    const page = Math.max(1, Number(req.query.page) || 1);
    const offset = (page - 1) * limit;
    const params = [];
    let where = 'WHERE 1=1';
    if (company) {
      where += ' AND company_tag = ?';
      params.push(company);
    }
    const rows = await query(
      `SELECT *
       FROM exam_sets
       ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const items = rows.map((row) => {
      const isPro = Boolean(row.is_pro);
      const unlocked = !isPro || user?.subscription_tier === 'pro' || user?.subscription_tier === 'team' || user?.role === 'admin';
      const ids = parseJsonList(row.problem_ids);
      return {
        id: row.id,
        title: row.title,
        description: unlocked ? row.description : 'Pro 플랜 전용 모의 코테입니다.',
        durationMin: row.duration_min,
        problemCount: ids.length,
        difficultyAvg: row.difficulty_avg,
        isPro,
        companyTag: row.company_tag,
        playCount: row.play_count || 0,
        locked: !unlocked,
      };
    });
    res.json({ items, page, limit });
  } catch (err) {
    console.error('[exams/list]', err);
    return internalError(res);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const examSet = await requireExamSet(req.params.id);
    if (!examSet) return errorResponse(res, 404, 'NOT_FOUND', '시험 세트를 찾을 수 없습니다.');
    const user = await User.findById(req.user.id);
    const locked = examSet.is_pro && !['pro', 'team'].includes(user?.subscription_tier) && user?.role !== 'admin';
    if (locked) return errorResponse(res, 403, 'PRO_REQUIRED', 'Pro 플랜 이상 필요합니다');
    const problems = await getExamProblems(examSet.problemIds);
    res.json({
      id: examSet.id,
      title: examSet.title,
      description: examSet.description,
      durationMin: examSet.duration_min,
      problems: problems.map((problem) => ({ id: problem.id, title: problem.title, tier: problem.tier })),
    });
  } catch (err) {
    console.error('[exams/detail]', err);
    return internalError(res);
  }
});

router.post('/:id/start', async (req, res) => {
  try {
    const examSet = await requireExamSet(req.params.id);
    if (!examSet) return errorResponse(res, 404, 'NOT_FOUND', '시험 세트를 찾을 수 없습니다.');
    const user = await User.findById(req.user.id);
    const locked = examSet.is_pro && !['pro', 'team'].includes(user?.subscription_tier) && user?.role !== 'admin';
    if (locked) return errorResponse(res, 403, 'PRO_REQUIRED', 'Pro 플랜 이상 필요합니다');

    let attempt = await queryOne(
      'SELECT * FROM exam_attempts WHERE user_id = ? AND exam_set_id = ? AND status = ? ORDER BY started_at DESC LIMIT 1',
      [req.user.id, examSet.id, 'in_progress']
    );
    if (!attempt) {
      const attemptId = await insert(
        'INSERT INTO exam_attempts (user_id, exam_set_id, status) VALUES (?, ?, ?)',
        [req.user.id, examSet.id, 'in_progress']
      );
      attempt = await queryOne('SELECT * FROM exam_attempts WHERE id = ?', [attemptId]);
      await run('UPDATE exam_sets SET play_count = play_count + 1 WHERE id = ?', [examSet.id]);
    }

    const problems = await getExamProblems(examSet.problemIds);
    res.json({
      attemptId: attempt.id,
      startedAt: attempt.started_at,
      durationMin: examSet.duration_min,
      problems,
    });
  } catch (err) {
    console.error('[exams/start]', err);
    return internalError(res);
  }
});

router.post('/:id/submit', async (req, res) => {
  try {
    const examSet = await requireExamSet(req.params.id);
    if (!examSet) return errorResponse(res, 404, 'NOT_FOUND', '시험 세트를 찾을 수 없습니다.');
    const attempt = await queryOne(
      'SELECT * FROM exam_attempts WHERE id = ? AND user_id = ? AND exam_set_id = ?',
      [req.body.attemptId, req.user.id, examSet.id]
    );
    if (!attempt) return errorResponse(res, 404, 'NOT_FOUND', '시험 시도를 찾을 수 없습니다.');

    const problems = await getExamProblems(examSet.problemIds);
    const answers = req.body.answers || {};
    const judgeRuntime = await getCachedJudgeRuntime();
    const breakdown = [];

    for (const problem of problems) {
      const answer = answers[problem.id];
      if (!answer?.code || !answer?.lang) {
        breakdown.push({ problemId: problem.id, result: 'empty', timeMs: null });
        continue;
      }
      const { execution } = await executeSubmissionFlow({
        problem,
        problemId: problem.id,
        userId: req.user.id,
        rawLang: answer.lang,
        code: answer.code,
        judgeRuntime,
        persist: false,
        userTier: 'team',
      });
      breakdown.push({
        problemId: problem.id,
        result: execution.result,
        timeMs: execution.time ? parseInt(execution.time, 10) : null,
      });
    }

    const score = breakdown.filter((item) => item.result === 'correct').length;
    const startedAt = new Date(attempt.started_at).getTime();
    const timeUsedSec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    await run(
      `UPDATE exam_attempts
       SET finished_at = ?, time_used_sec = ?, score = ?, status = ?, answers = ?
       WHERE id = ?`,
      [
        new Date().toISOString().slice(0, 19).replace('T', ' '),
        timeUsedSec,
        score,
        'completed',
        JSON.stringify(answers),
        attempt.id,
      ]
    );

    res.json({
      score,
      totalProblems: problems.length,
      timeUsed: timeUsedSec,
      breakdown,
    });
  } catch (err) {
    console.error('[exams/submit]', err);
    return internalError(res);
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, started_at, finished_at, time_used_sec, score, status
       FROM exam_attempts
       WHERE user_id = ? AND exam_set_id = ?
       ORDER BY started_at DESC
       LIMIT 10`,
      [req.user.id, req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[exams/history]', err);
    return internalError(res);
  }
});

export default router;
