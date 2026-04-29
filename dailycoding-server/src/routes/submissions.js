import { Router } from 'express';
import { Submission } from '../models/Submission.js';
import { Notification }from '../models/Notification.js';
import { queryOne }   from '../config/mysql.js';
import { auth, requireVerified } from '../middleware/auth.js';
import { validateBody, runSchema } from '../middleware/validate.js';
import redis from '../config/redis.js';
import { getCachedJudgeRuntime } from '../services/judgeRuntimeCache.js';
import { executeSubmissionFlow } from '../services/submissionExecution.js';
import { errorResponse, internalError } from '../middleware/errorHandler.js';
import { handleCorrectSubmissionMissions } from '../services/missionService.js';
import { updateSeasonRating } from '../services/seasonService.js';

const router = Router();
async function getProblemModel() {
  const { Problem } = await import('../models/Problem.js');
  return Problem;
}

async function getUserModel() {
  const { User } = await import('../models/User.js');
  return User;
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

function evaluateSpecialSubmission(problem, body) {
  const type = problem.problemType || problem.problem_type || 'coding';
  const config = parseSpecialConfig(problem) || {};

  if (type === 'fill-blank') {
    const blanks = Array.isArray(config.blanks) ? config.blanks : [];
    const userAnswers = Array.isArray(body.blankAnswers)
      ? body.blankAnswers
      : Array.isArray(body.answer)
        ? body.answer
        : [body.answer];

    const normalizedUser = userAnswers.map((value) => String(value ?? '').trim());
    const normalizedExpected = blanks.map((value) => String(value ?? '').trim());
    const correct = normalizedExpected.length > 0 && normalizedExpected.every((value, index) => normalizedUser[index] === value);
    return {
      correct,
      lang: 'fill-blank',
      storedCode: JSON.stringify(normalizedUser),
      detail: correct ? '모든 빈칸이 정답입니다.' : '일부 빈칸이 올바르지 않습니다.',
    };
  }

  if (type === 'bug-fix') {
    const keywords = Array.isArray(config.keywords) ? config.keywords : [];
    const answerText = String(body.answer ?? '').trim();
    if (!answerText) {
      return {
        correct: false,
        lang: 'bug-fix',
        storedCode: '',
        detail: '수정 코드를 입력해주세요.',
      };
    }
    const lowered = answerText.toLowerCase();
    const correct = keywords.length > 0 && keywords.some((keyword) => lowered.includes(String(keyword).toLowerCase()));
    return {
      correct,
      lang: 'bug-fix',
      storedCode: answerText,
      detail: correct ? '핵심 버그 포인트를 정확히 찾았습니다.' : '핵심 버그 포인트가 포함되어 있지 않습니다.',
    };
  }

  return null;
}

function normalizeSolveTimeSecInput(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 5 || parsed > 86400) return null;
  return Math.round(parsed);
}

// POST /api/submissions
router.post('/', auth, requireVerified, async (req, res) => {
  const { problemId, lang, code } = req.body;
  if (!problemId || Number.isNaN(Number(problemId))) {
    return errorResponse(res, 400, 'VALIDATION_ERROR', 'problemId는 필수입니다.');
  }

  const Problem = await getProblemModel();
  const User = await getUserModel();
  const prob = await Problem.findById(Number(problemId));
  if (!prob) return errorResponse(res, 404, 'NOT_FOUND', '문제를 찾을 수 없습니다.');
  const solveTimeSec = normalizeSolveTimeSecInput(req.body?.solveTimeSec);

  // 프리미엄 문제 제출 제한
  const requester = await User.findById(req.user.id);
  const subTier = requester?.subscription_tier || 'free';
  const isAdmin = requester?.role === 'admin';

  if (prob.isPremium && !isAdmin && subTier !== 'pro' && subTier !== 'team') {
    return errorResponse(res, 403, 'FORBIDDEN', '프리미엄 문제에 제출하려면 Pro 이상의 멤버십이 필요합니다.', {
      isPremium: true
    });
  }

  const problemType = prob.problemType || prob.problem_type || 'coding';
  if (problemType !== 'coding' && problemType !== 'build') {
    try {
      const evaluation = evaluateSpecialSubmission(prob, req.body);
      if (!evaluation) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', '지원하지 않는 특수 문제 유형입니다.');
      }

      const alreadySolved = await queryOne(
        'SELECT 1 FROM submissions WHERE user_id=? AND problem_id=? AND result=? LIMIT 1',
        [req.user.id, Number(problemId), 'correct']
      );

      const submission = await Submission.create({
        userId: req.user.id,
        problemId: Number(problemId),
        lang: evaluation.lang,
        code: evaluation.storedCode,
        result: evaluation.correct ? 'correct' : 'wrong',
        timeMs: null,
        memoryMb: null,
        solveTimeSec,
        detail: evaluation.detail,
      });

      await Problem.incrementSubmit(Number(problemId));
      if (evaluation.correct && !alreadySolved) {
        await Promise.all([
          Problem.incrementSolved(Number(problemId)),
          Notification.create(req.user.id, `🧩 "${prob.title}" 정답! (특수 유형)`, 'submissions'),
        ]);
        const seasonPoints = User.tierPoints(prob.tier || 'bronze');
        try {
          await Promise.all([
            handleCorrectSubmissionMissions(req.user.id),
            updateSeasonRating(req.user.id, seasonPoints),
          ]);
        } catch (missionErr) {
          console.error('[submissions/create:special:missions]', missionErr);
        }
      }

      return res.json({
        id:           submission.id,
        problemId:    submission.problem_id,
        problemTitle: prob.title,
        lang:         evaluation.lang,
        result:       submission.result,
        time:         '-',
        mem:          '-',
        codeLength:   Buffer.byteLength(evaluation.storedCode || '', 'utf8'),
        detail:       submission.detail,
        date:         new Date(submission.submitted_at).toLocaleString('ko-KR'),
      });
    } catch (err) {
      console.error('[submissions/create:special]', err);
      return internalError(res, err?.message || '서버 오류');
    }
  }

  if (!lang || !code) {
    return errorResponse(res, 400, 'VALIDATION_ERROR', '코딩 문제 제출에는 lang, code가 필요합니다.');
  }
  if (String(code).length > 100000) {
    return errorResponse(res, 400, 'VALIDATION_ERROR', 'code는 100000자 이하여야 합니다.');
  }

  try {
    const judgeRuntime = await getCachedJudgeRuntime({ logOnRefresh: true });
    if (judgeRuntime.mode === 'unavailable') {
      return errorResponse(res, 503, 'INTERNAL_ERROR', '현재 서버에서 채점 런타임을 사용할 수 없습니다.', {
        supportedLanguages: judgeRuntime.supportedLanguages || [],
      });
    }
    const { execution, submission, displayLang } = await executeSubmissionFlow({
      problem: prob,
      problemId: Number(problemId),
      userId: req.user.id,
      rawLang: lang,
      code,
      judgeRuntime,
      persist: true,
      userTier: subTier,
      solveTimeSec,
    }, {
      findSolvedSubmission: queryOne,
      createSubmission: (payload) => Submission.create(payload),
      incrementSubmit: Problem.incrementSubmit,
      incrementSolved: Problem.incrementSolved,
      getTierPoints: User.tierPoints,
      onSolve: User.onSolve.bind(User),
      createNotification: Notification.create,
      invalidateRanking: () => redis.clearPrefix('ranking:'),
    });

    const timeMs = execution.time ? parseInt(execution.time, 10) : null;
    res.json({
      id:           submission.id,
      problemId:    submission.problem_id,
      problemTitle: prob.title,
      lang:         displayLang,
      result:       submission.result,
      time:         timeMs ? `${timeMs}ms` : '-',
      mem:          '-',
      codeLength:   Buffer.byteLength(code, 'utf8'),
      detail:       submission.detail,
      date:         new Date(submission.submitted_at).toLocaleString('ko-KR'),
    });
  } catch (err) {
    if (err.status && err.body) {
      return res.status(err.status).json(err.body);
    }
    console.error('[submissions/create]', err);
    return internalError(res, err?.message || '서버 오류');
  }
});

// POST /api/submissions/run
router.post('/run', auth, requireVerified, validateBody(runSchema), async (req, res) => {
  const { problemId, lang, code, input } = req.body;

  const Problem = await getProblemModel();
  const prob = await Problem.findById(Number(problemId));
  if (!prob) return errorResponse(res, 404, 'NOT_FOUND', '문제를 찾을 수 없습니다.');

  // 프리미엄 문제 실행 제한
  const User = await getUserModel();
  const requester = await User.findById(req.user.id);
  const subTier = requester?.subscription_tier || 'free';
  const isAdmin = requester?.role === 'admin';

  if (prob.isPremium && !isAdmin && subTier !== 'pro' && subTier !== 'team') {
    return errorResponse(res, 403, 'FORBIDDEN', '프리미엄 문제의 실행 기능은 Pro 이상의 멤버십에서 이용 가능합니다.', {
      isPremium: true
    });
  }

  try {
    const judgeRuntime = await getCachedJudgeRuntime({ logOnRefresh: true });
    if (judgeRuntime.mode === 'unavailable') {
      return errorResponse(res, 503, 'INTERNAL_ERROR', '현재 서버에서 채점 런타임을 사용할 수 없습니다.', {
        supportedLanguages: judgeRuntime.supportedLanguages || [],
      });
    }
    const { execution, displayLang, normalizedLang } = await executeSubmissionFlow({
      problem: prob,
      problemId: Number(problemId),
      userId: req.user.id,
      rawLang: lang,
      code,
      judgeRuntime,
      persist: false,
      customInput: typeof input === 'string' ? input : null,
      userTier: subTier,
    });

    res.json({
      mode: input == null ? 'examples' : 'custom',
      lang: displayLang,
      normalizedLang,
      result: execution.result,
      time: execution.time || '-',
      mem: execution.mem || '-',
      detail: execution.detail,
      output: execution.output || '',
    });
  } catch (err) {
    if (err.status && err.body) {
      return res.status(err.status).json(err.body);
    }
    console.error('[submissions/run]', err);
    return internalError(res, err?.message || '서버 오류');
  }
});

// GET /api/submissions
router.get('/', auth, async (req, res) => {
  try {
    const { scope = 'me', q = '', result = 'all', lang = 'all', limit = 100, userId } = req.query;
    const targetUserId = userId == null ? null : Number(userId);

    if (userId != null && !Number.isInteger(targetUserId)) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', '유효하지 않은 사용자 ID입니다.');
    }

    if (targetUserId && targetUserId !== req.user.id) {
      const User = await getUserModel();
      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        return errorResponse(res, 404, 'NOT_FOUND', '사용자를 찾을 수 없습니다.');
      }
      if (!targetUser.submissions_public) {
        return errorResponse(res, 403, 'FORBIDDEN', '이 사용자의 제출 기록은 비공개입니다.');
      }
    }

    const rows = await Submission.findFeed(req.user.id, { scope, q, result, lang, limit, userId: targetUserId });
    res.json(rows);
  } catch (err) {
    console.error('[submissions/list]', err);
    return internalError(res, err?.message || '제출 기록을 불러오지 못했습니다.');
  }
});

// GET /api/submissions/stats
router.get('/stats', auth, async (req, res) => {
  try {
    const [stats, langStats] = await Promise.all([
      Submission.getStats(req.user.id),
      Submission.getLangStats(req.user.id),
    ]);
    res.json({ ...stats, langStats });
  } catch { res.json({ total:0, correct:0, wrong:0, langStats:[] }); }
});

// GET /api/submissions/judge-status
router.get('/judge-status', auth, async (req, res) => {
  try {
    const runtime = await getCachedJudgeRuntime({ logOnRefresh: true });
    res.json(runtime);
  } catch {
    res.json({ dockerAvailable: false, configuredMode: 'auto', mode: 'unavailable', supportedLanguages: [] });
  }
});

router.post('/:id/share', auth, requireVerified, async (req, res) => {
  try {
    const submissionId = Number(req.params.id);
    const submission = await Submission.getWithCode(submissionId);
    if (!submission) {
      return errorResponse(res, 404, 'NOT_FOUND', '제출을 찾을 수 없습니다.');
    }
    if (submission.user_id !== req.user.id) {
      return errorResponse(res, 403, 'FORBIDDEN', '본인 제출만 공유할 수 있습니다.');
    }

    const shared = await Submission.createShare(submissionId);
    const publicBase = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    return res.json({
      slug: shared.slug,
      url: `${publicBase.replace(/\/$/, '')}/share/${shared.slug}`,
    });
  } catch (err) {
    console.error('[submissions/share]', err);
    return internalError(res);
  }
});

// GET /api/submissions/:id/code (코드 조회) — ★ 본인 제출만 조회 가능
router.get('/:id/code', auth, async (req, res) => {
  try {
    const sub = await Submission.getWithCode(Number(req.params.id));
    if (!sub) return errorResponse(res, 404, 'NOT_FOUND', '없음');
    const User = await getUserModel();
    const requester = await User.findById(req.user.id);
    if (sub.user_id !== req.user.id && requester?.role !== 'admin')
      return errorResponse(res, 403, 'FORBIDDEN', '권한 없음');
    res.json({ code: sub.code, lang: sub.lang });
  } catch { return internalError(res); }
});

export default router;
