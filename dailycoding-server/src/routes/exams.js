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

function parseSpecialConfig(problem) {
  const raw = problem?.specialConfig ?? problem?.special_config ?? null;
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return null;
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

function buildExamReport({ problems, breakdown, score, timeUsedSec, durationMin }) {
  const problemsById = new Map(problems.map((problem) => [Number(problem.id), problem]));
  const total = problems.length;
  const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;
  const durationSec = Math.max(1, Number(durationMin || 0) * 60);
  const paceRate = Math.min(100, Math.round((timeUsedSec / durationSec) * 100));
  const tagMap = new Map();
  const typeMap = new Map();

  for (const item of breakdown) {
    const problem = problemsById.get(Number(item.problemId));
    const result = item.result || 'empty';
    const missed = result !== 'correct';
    const type = problem?.problemType || problem?.problem_type || 'coding';
    const typeEntry = typeMap.get(type) || { label: type, total: 0, misses: 0 };
    typeEntry.total += 1;
    if (missed) typeEntry.misses += 1;
    typeMap.set(type, typeEntry);

    const tags = Array.isArray(problem?.tags) && problem.tags.length > 0 ? problem.tags : [problem?.tier || '기타'];
    for (const tag of tags.slice(0, 5)) {
      const entry = tagMap.get(tag) || { label: tag, total: 0, misses: 0 };
      entry.total += 1;
      if (missed) entry.misses += 1;
      tagMap.set(tag, entry);
    }
  }

  const weakTags = [...tagMap.values()]
    .filter((entry) => entry.misses > 0)
    .map((entry) => ({
      ...entry,
      missRate: Math.round((entry.misses / Math.max(1, entry.total)) * 100),
    }))
    .sort((a, b) => b.missRate - a.missRate || b.misses - a.misses)
    .slice(0, 4);

  const weakTypes = [...typeMap.values()]
    .filter((entry) => entry.misses > 0)
    .map((entry) => ({
      ...entry,
      missRate: Math.round((entry.misses / Math.max(1, entry.total)) * 100),
    }))
    .sort((a, b) => b.missRate - a.missRate || b.misses - a.misses);

  const emptyCount = breakdown.filter((item) => item.result === 'empty').length;
  const wrongCount = breakdown.filter((item) => item.result !== 'correct' && item.result !== 'empty').length;
  const nextPractice = weakTags.length > 0
    ? `${weakTags[0].label} 태그의 낮은 난이도 문제를 2개 풀고, 같은 조건으로 다시 모의코테를 보세요.`
    : accuracy >= 80
      ? '정답률이 안정적입니다. 제한 시간을 10~15% 줄여서 한 번 더 풀어보세요.'
      : '오답 문제를 먼저 복기하고 같은 난이도 세트로 재도전하세요.';

  return {
    accuracy,
    paceRate,
    timeUsedSec,
    emptyCount,
    wrongCount,
    weakTags,
    weakTypes,
    summary: `정답률 ${accuracy}%, 제한 시간의 ${paceRate}%를 사용했습니다.`,
    nextPractice,
  };
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
      `SELECT * FROM exam_sets
       ${where}
       GROUP BY id
       ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
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
      const problemType = problem.problemType || problem.problem_type || 'coding';

      if (problemType === 'fill-blank') {
        const config = parseSpecialConfig(problem);
        const blanks = Array.isArray(config?.blanks) ? config.blanks : [];
        const userBlanks = Array.isArray(answer?.blankAnswers) ? answer.blankAnswers : [];
        const correct = blanks.length > 0 && blanks.every((v, i) =>
          String(v ?? '').trim() === String(userBlanks[i] ?? '').trim()
        );
        breakdown.push({
          problemId: problem.id,
          problemTitle: problem.title,
          tier: problem.tier,
          problemType,
          result: !answer ? 'empty' : correct ? 'correct' : 'wrong',
          timeMs: null,
        });
        continue;
      }

      if (problemType === 'bug-fix') {
        const config = parseSpecialConfig(problem);
        const keywords = Array.isArray(config?.keywords) ? config.keywords : [];
        const answerText = String(answer?.answer ?? '').trim();
        if (!answerText) {
          breakdown.push({ problemId: problem.id, problemTitle: problem.title, tier: problem.tier, problemType, result: 'empty', timeMs: null });
          continue;
        }
        const lowered = answerText.toLowerCase();
        const correct = keywords.length > 0 && keywords.some((k) => lowered.includes(String(k).toLowerCase()));
        breakdown.push({ problemId: problem.id, problemTitle: problem.title, tier: problem.tier, problemType, result: correct ? 'correct' : 'wrong', timeMs: null });
        continue;
      }

      if (!answer?.code || !answer?.lang) {
        breakdown.push({ problemId: problem.id, problemTitle: problem.title, tier: problem.tier, problemType, result: 'empty', timeMs: null });
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
        problemTitle: problem.title,
        tier: problem.tier,
        problemType,
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
      report: buildExamReport({
        problems,
        breakdown,
        score,
        timeUsedSec,
        durationMin: examSet.duration_min,
      }),
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
