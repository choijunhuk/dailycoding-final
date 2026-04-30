import { Router } from 'express';
import { Notification } from '../models/Notification.js';
import { query, queryOne, insert as dbInsert, run as dbRun } from '../config/mysql.js';
import { auth, adminOnly, requireVerified } from '../middleware/auth.js';
import { validateBody, problemSchema, voteSchema } from '../middleware/validate.js';
import { askAI } from '../services/ai.js';
import redis from '../config/redis.js';
import { MIN_HIDDEN_TESTCASES } from '../shared/problemCatalog.js';
import { errorResponse, internalError } from '../middleware/errorHandler.js';

const router = Router();
const ALLOWED_TIERS = new Set(['bronze', 'silver', 'gold', 'platinum', 'diamond']);
const ALLOWED_PROBLEM_TYPES = new Set(['coding', 'fill-blank', 'bug-fix']);
const ALLOWED_SORTS = new Set(['id', 'newest', 'difficulty', '-difficulty', 'solved']);
const ALLOWED_STATUS = new Set(['all', 'solved', 'unsolved', 'bookmarked']);
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 24;

function countFilledHiddenTestcases(testcases) {
  if (!Array.isArray(testcases)) return 0;
  return testcases.filter((item) => (item?.input || '').trim() || (item?.output || '').trim()).length;
}

function normalizeDelimitedTextList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
}

export function normalizeProblemMutationPayload(body = {}) {
  const problemType = typeof body.problemType === 'string' && ALLOWED_PROBLEM_TYPES.has(body.problemType)
    ? body.problemType
    : 'coding';

  if (problemType === 'coding') {
    const hiddenCount = countFilledHiddenTestcases(body?.testcases);
    if (hiddenCount < MIN_HIDDEN_TESTCASES) {
      return { error: `히든 테스트케이스는 최소 ${MIN_HIDDEN_TESTCASES}개 필요합니다.` };
    }
    return {
      payload: {
        ...body,
        problemType,
        specialConfig: null,
      },
    };
  }

  const rawConfig = body?.specialConfig && typeof body.specialConfig === 'object' ? body.specialConfig : {};
  if (problemType === 'fill-blank') {
    const codeTemplate = typeof rawConfig.codeTemplate === 'string' ? rawConfig.codeTemplate.trimEnd() : '';
    const blanks = normalizeDelimitedTextList(rawConfig.blanks);
    if (!codeTemplate) {
      return { error: '빈칸 채우기 문제에는 코드 템플릿이 필요합니다.' };
    }
    if (blanks.length === 0) {
      return { error: '빈칸 채우기 문제에는 최소 1개 이상의 정답 빈칸이 필요합니다.' };
    }
    return {
      payload: {
        ...body,
        problemType,
        specialConfig: {
          codeTemplate,
          blanks,
          ...(typeof rawConfig.hint === 'string' && rawConfig.hint.trim() ? { hint: rawConfig.hint.trim() } : {}),
        },
      },
    };
  }

  if (problemType === 'bug-fix') {
    const buggyCode = typeof rawConfig.buggyCode === 'string' ? rawConfig.buggyCode.trimEnd() : '';
    const keywords = normalizeDelimitedTextList(rawConfig.keywords);
    if (!buggyCode) {
      return { error: '틀린부분 찾기 문제에는 버그 코드가 필요합니다.' };
    }
    if (keywords.length === 0) {
      return { error: '틀린부분 찾기 문제에는 최소 1개 이상의 정답 키워드가 필요합니다.' };
    }
    return {
      payload: {
        ...body,
        problemType,
        specialConfig: {
          buggyCode,
          keywords,
          ...(typeof rawConfig.hint === 'string' && rawConfig.hint.trim() ? { hint: rawConfig.hint.trim() } : {}),
          ...(typeof rawConfig.explanation === 'string' && rawConfig.explanation.trim() ? { explanation: rawConfig.explanation.trim() } : {}),
        },
      },
    };
  }

  return { payload: { ...body, problemType } };
}

export function normalizeTextQuery(value, maxLength = 100) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.slice(0, maxLength);
}

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function normalizeProblemListQuery(query = {}) {
  let tier = query.tier;
  if (typeof tier === 'string') {
    tier = tier.split(',').filter(t => ALLOWED_TIERS.has(t));
    if (tier.length === 0) tier = undefined;
  } else {
    tier = undefined;
  }

  let tag = query.tag;
  if (typeof tag === 'string') {
    tag = tag.split(',').map(t => normalizeTextQuery(t, 50)).filter(Boolean);
    if (tag.length === 0) tag = undefined;
  } else {
    tag = undefined;
  }

  const problemType = typeof query.problemType === 'string' && ALLOWED_PROBLEM_TYPES.has(query.problemType) ? query.problemType : undefined;
  const preferredLanguage = normalizeTextQuery(query.preferredLanguage, 20) || undefined;
  const search = normalizeTextQuery(query.search, 100) || undefined;
  const sort = typeof query.sort === 'string' && ALLOWED_SORTS.has(query.sort) ? query.sort : 'id';
  const status = typeof query.status === 'string' && ALLOWED_STATUS.has(query.status) ? query.status : 'all';
  const limit = clampInt(query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
  const requestedPage = clampInt(query.page, 1, 1, 500);
  const paginated = query.page !== undefined || query.limit !== undefined;

  return {
    tier,
    problemType,
    preferredLanguage,
    tag,
    search,
    sort,
    status,
    limit,
    requestedPage,
    paginated,
  };
}

export function paginateProblemRows(rows, requestedPage, limit) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, totalPages);
  const start = (page - 1) * limit;

  return {
    items: rows.slice(start, start + limit),
    total,
    page,
    limit,
    totalPages,
    hasPrev: page > 1,
    hasNext: page < totalPages,
  };
}

export function sanitizeProblemForClient(problem, { isAdmin = false } = {}) {
  if (!problem || typeof problem !== 'object') return problem;
  if (isAdmin) return problem;

  const { solution, testcases, ...safe } = problem;
  return {
    ...safe,
    hiddenCount: problem.hiddenCount ?? (Array.isArray(testcases) ? testcases.length : 0),
  };
}

async function getProblemModel() {
  const { Problem } = await import('../models/Problem.js');
  return Problem;
}

async function getUserModel() {
  const { User } = await import('../models/User.js');
  return User;
}

async function getDifficultyStats(problemId, userId = null) {
  const [agg, myVote] = await Promise.all([
    queryOne(
      'SELECT ROUND(AVG(vote), 1) AS avgDifficulty, COUNT(*) AS voteCount FROM difficulty_votes WHERE problem_id = ?',
      [problemId]
    ),
    userId
      ? queryOne(
          'SELECT vote FROM difficulty_votes WHERE user_id = ? AND problem_id = ?',
          [userId, problemId]
        )
      : Promise.resolve(null),
  ]);

  return {
    avgDifficulty: agg?.avgDifficulty == null ? null : Number(agg.avgDifficulty),
    voteCount: Number(agg?.voteCount || 0),
    myDifficultyVote: myVote?.vote ?? null,
    avgVote: agg?.avgDifficulty == null ? null : Number(agg.avgDifficulty),
    totalVotes: Number(agg?.voteCount || 0),
    myVote: myVote?.vote ?? null,
  };
}

async function notifyProblemCommentMentions(content, authorId, problemTitle) {
  if (!content) return;
  const usernames = [...new Set(
    [...content.matchAll(/@([a-zA-Z0-9_가-힣]{2,30})/g)].map((match) => match[1])
  )];
  if (usernames.length === 0) return;

  for (const username of usernames) {
    try {
      const mentioned = await queryOne('SELECT id FROM users WHERE username = ? OR nickname = ?', [username, username]);
      if (mentioned && mentioned.id !== authorId) {
        Notification.create(
          mentioned.id,
          `💬 "${problemTitle.slice(0, 30)}" 문제 토론에서 @${username} 님이 멘션됐습니다.`,
          'problems'
        ).catch((err) => console.warn('[problem-comment mention]', err.message));
      }
    } catch {}
  }
}

// ★★★ 중요: 고정 경로를 /:id 보다 먼저 등록 ★★★

// GET /api/problems
router.get('/', auth, async (req, res) => {
  try {
    const Problem = await getProblemModel();
    const { tier, problemType, preferredLanguage, tag, search, sort, status, limit, requestedPage, paginated } = normalizeProblemListQuery(req.query);
    const isAdmin = req.user.role === 'admin';

    // ★ Redis 캐싱 (검색/필터 없을 때만 1분 캐시)
    const isBasicQuery = !tier && !problemType && !tag && !search && sort === 'id' && status === 'all';
    const cacheKey = `problems:list:${isAdmin ? 'admin' : 'user'}:${req.user.id}:${requestedPage}:${limit}`;
    if (isBasicQuery && paginated) {
      const cached = await redis.getJSON(cacheKey);
      if (cached) return res.json(cached);
    }

    let rows = await Problem.findAll({ tier, problemType, preferredLanguage, tag, search, sort, userId: req.user.id, isAdmin });
    if (status === 'solved')     rows = rows.filter(p => p.isSolved);
    if (status === 'unsolved')   rows = rows.filter(p => !p.isSolved);
    if (status === 'bookmarked') rows = rows.filter(p => p.isBookmarked);
    
    const result = paginated ? paginateProblemRows(rows, requestedPage, limit) : rows;
    
    if (isBasicQuery && paginated) {
      await redis.setJSON(cacheKey, result, 60); // 1분 캐시
    }
    return res.json(result);
  } catch (err) { console.error('[problems/list]', err.message); res.status(500).json({ message: '서버 오류' }); }
});

// GET /api/problems/tags
router.get('/tags', auth, async (req, res) => {
  try {
    const Problem = await getProblemModel();
    res.json(await Problem.getAllTags());
  } catch { res.json([]); }
});

// GET /api/problems/search
router.get('/search', auth, async (req, res) => {
  const q = normalizeTextQuery(req.query.q, 100);
  if (!q) return res.json([]);
  if (typeof req.query.q === 'string' && req.query.q.trim().length > 100) {
    return res.status(400).json({ message: '검색어는 100자 이하여야 합니다.' });
  }
  try {
    const Problem = await getProblemModel();
    const rows = await query(
      "SELECT id, title, tier, difficulty FROM problems WHERE COALESCE(visibility, 'global') = 'global' AND title LIKE ? LIMIT 10",
      [`%${q}%`]
    );
    res.json((rows || []).filter((row) => (row.visibility || 'global') === 'global'));
  } catch { res.json([]); }
});

// ★ 랜덤 디펜스 (/:id 보다 먼저!)
router.get('/random/pick', auth, async (req, res) => {
  try {
    const Problem = await getProblemModel();
    const { tier, tag, minDiff, maxDiff } = req.query;
    const picked = await Problem.findRandomUnsolved(req.user.id, {
      tier: tier || undefined,
      tag: tag || undefined,
      minDiff,
      maxDiff,
    });
    if (!picked) return res.json({ message: '조건에 맞는 문제가 없습니다.' });
    res.json(picked);
  } catch (err) { console.error('[random]', err.message); res.status(500).json({ message: '서버 오류' }); }
});

// ★ 일일 챌린지 (/:id 보다 먼저!)
router.get('/daily/challenge', auth, async (req, res) => {
  try {
    const Problem = await getProblemModel();
    const User = await getUserModel();
    const today = new Date().toISOString().slice(0,10);
    const cacheKey = `daily:${req.user.id}:${today}`;
    const cached = await redis.getJSON(cacheKey);
    if (cached) return res.json(cached);

    const [all, user] = await Promise.all([
      Problem.findAll({ userId: req.user.id, problemType: 'coding' }),
      User.findById(req.user.id),
    ]);
    if (all.length === 0) return res.json({ problem: null, message: '문제가 없습니다.' });
    // 전체 문제 기준으로 seed 인덱스 고정 — 풀이 상태 변화와 무관하게 하루 동안 동일한 문제 유지
    const seed = today.split('-').reduce((s,n) => s + Number(n), 0);
    const daily = all[seed % all.length];
    const streakBonus = Math.min(20, (user?.streak || 0) * 2);
    const result = {
      problem: daily, streakBonus,
      message: streakBonus > 0 ? `🔥 ${user.streak}일 연속! 오늘 풀면 +${45+streakBonus}점` : '오늘의 챌린지를 풀어보세요!',
    };
    await redis.setJSON(cacheKey, result, 3600); // 1시간 캐시 (하루 기준)
    res.json(result);
  } catch (err) { console.error('[daily]', err.message); res.status(500).json({ message: '서버 오류' }); }
});

// GET /api/problems/recommend — AI 기반 맞춤 추천
router.get('/recommend', auth, async (req, res) => {
  try {
    const Problem = await getProblemModel();
    const User = await getUserModel();
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: '유저 없음' });

    const weakTagRows = await query(
      `SELECT pt.tag
       FROM submissions s
       JOIN problem_tags pt ON pt.problem_id = s.problem_id
       WHERE s.user_id = ? AND s.result IN ('wrong', 'timeout', 'error', 'compile')
       ORDER BY s.submitted_at DESC
       LIMIT 25`,
      [req.user.id]
    );
    const weakTagScores = (weakTagRows || []).reduce((acc, row) => {
      acc[row.tag] = (acc[row.tag] || 0) + 1;
      return acc;
    }, {});
    const weakTags = Object.entries(weakTagScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);

    const tierOrder = ['unranked', 'bronze', 'silver', 'gold', 'platinum', 'diamond'];
    const userTierIdx = tierOrder.indexOf(user.tier || 'unranked');
    const targetTiers = [tierOrder[userTierIdx], tierOrder[Math.min(userTierIdx + 1, tierOrder.length - 1)]]
      .filter(Boolean);

    const [solvedTagRows, solvedTitleRows, candidates] = await Promise.all([
      query(
        `SELECT DISTINCT pt.tag
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id
         JOIN problem_tags pt ON pt.problem_id = p.id
         WHERE s.user_id = ? AND s.result = 'correct' AND COALESCE(p.problem_type, 'coding') = 'coding'
         LIMIT 15`,
        [req.user.id]
      ),
      query(
        `SELECT p.title, MAX(s.submitted_at) AS last_solved
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id
         WHERE s.user_id = ? AND s.result = 'correct' AND COALESCE(p.problem_type, 'coding') = 'coding'
         GROUP BY p.id, p.title
         ORDER BY last_solved DESC
         LIMIT 10`,
        [req.user.id]
      ),
      Problem.findRecommendationCandidates(req.user.id, { tiers: targetTiers, limit: 18 }),
    ]);

    const onboarding = await queryOne(
      'SELECT experience_level FROM user_onboarding WHERE user_id = ?',
      [req.user.id]
    );
    const diffRange = onboarding?.experience_level === 'beginner'
      ? [1, 4]
      : onboarding?.experience_level === 'intermediate'
        ? [4, 7]
        : onboarding?.experience_level === 'advanced'
          ? [7, 10]
          : null;
    const filteredCandidates = diffRange
      ? candidates.filter((problem) => {
          const difficulty = Number(problem.difficulty || 0);
          return difficulty >= diffRange[0] && difficulty <= diffRange[1];
        })
      : candidates;
    const finalCandidates = filteredCandidates.length > 0 ? filteredCandidates.slice(0, 6) : candidates.slice(0, 6);

    if (finalCandidates.length === 0) return res.json([]);

    // AI에게 전달할 데이터 가공 (너무 많으면 압축)
    const solvedTags = [...new Set((solvedTagRows || []).map((row) => row.tag).filter(Boolean))].slice(0, 15);
    const solvedTitles = (solvedTitleRows || []).map((row) => row.title).filter(Boolean).slice(0, 10);
    const candidatePayload = finalCandidates.map((problem) => ({
      id: problem.id,
      title: problem.title,
      tier: problem.tier,
      tags: problem.tags,
    }));

    const prompt = `당신은 코딩 알고리즘 학습 가이드입니다. 
유저 정보: 티어 ${user.tier}, 레이팅 ${user.rating}점.
최근 푼 문제: ${solvedTitles.join(', ')}.
익숙한 태그: ${solvedTags.join(', ')}.
최근 약한 태그: ${weakTags.join(', ') || '없음'}.

아래 후보 문제 중 유저의 실력 향상에 가장 도움될 만한 4-6개를 추천해주세요. 
유저가 아직 접해보지 못한 태그나 현재 티어보다 약간 높은 난이도를 선호하되, 최근 약한 태그가 있다면 그 태그를 우선 보강하세요.
JSON 형식으로 { "recommendedIds": [id1, id2, ...] } 만 반환하세요.

후보: ${JSON.stringify(candidatePayload)}`;

    const fallbackIds = [...finalCandidates]
      .sort((a, b) => {
        const weakA = (a.tags || []).reduce((sum, tagName) => sum + (weakTagScores[tagName] || 0), 0);
        const weakB = (b.tags || []).reduce((sum, tagName) => sum + (weakTagScores[tagName] || 0), 0);
        if (weakB !== weakA) return weakB - weakA;
        return (b.solved || 0) - (a.solved || 0);
      })
      .map((problem) => problem.id);

    const result = await askAI(req.user.id, prompt, { recommendedIds: fallbackIds }, 300);
    const finalIds = Array.isArray(result?.recommendedIds) ? result.recommendedIds : fallbackIds;

    const recommended = finalCandidates.filter((problem) => finalIds.includes(problem.id));
    res.json(recommended.length > 0 ? recommended : finalCandidates.filter((problem) => fallbackIds.includes(problem.id)));
  } catch (err) { console.error('[recommend]', err.message); res.status(500).json({ message: '서버 오류' }); }
});

// POST /api/problems (생성)
router.post('/', auth, adminOnly, validateBody(problemSchema), async (req, res) => {
  try {
    const Problem = await getProblemModel();
    const { payload, error } = normalizeProblemMutationPayload(req.body);
    if (error) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', error);
    }
    const p = await Problem.create({ ...payload, visibility: 'global', contestId: null }, req.user.id);
    const users = await query('SELECT id FROM users WHERE banned_at IS NULL');
    await Notification.broadcast(users.map((user) => user.id), `🆕 새 문제 "${p.title}" 등록!`, 'problems');
    // 캐시 무효화
    await redis.clearPrefix('problems:list:');
    res.status(201).json(p);
  } catch (err) { console.error('[problems/create]', err.message); return internalError(res); }
});

router.get('/:id/editorial', auth, async (req, res) => {
  try {
    const problemId = Number(req.params.id);
    const editorial = await queryOne(
      `SELECT pe.id, pe.problem_id, pe.content, pe.author_id, pe.created_at, pe.updated_at, u.username AS author_username
       FROM problem_editorials pe
       JOIN users u ON u.id = pe.author_id
       WHERE pe.problem_id = ?`,
      [problemId]
    );
    if (!editorial) return errorResponse(res, 404, 'NOT_FOUND', '해설이 없습니다.');

    const requester = await getUserModel();
    const user = await requester.findById(req.user.id);
    const solved = await queryOne(
      'SELECT 1 FROM submissions WHERE user_id = ? AND problem_id = ? AND result = ? LIMIT 1',
      [req.user.id, problemId, 'correct']
    );
    if (!solved && user?.role !== 'admin') {
      return errorResponse(res, 403, 'FORBIDDEN', '문제를 먼저 풀어야 해설을 볼 수 있습니다.');
    }
    res.json(editorial);
  } catch (err) {
    console.error('[problems/editorial/get]', err);
    return internalError(res);
  }
});

router.post('/:id/editorial', auth, adminOnly, async (req, res) => {
  const problemId = Number(req.params.id);
  const content = String(req.body?.content || '').trim();
  if (!content) return errorResponse(res, 400, 'VALIDATION_ERROR', '해설 내용을 입력해주세요.');

  try {
    const existing = await queryOne('SELECT id FROM problem_editorials WHERE problem_id = ?', [problemId]);
    if (existing) return errorResponse(res, 409, 'VALIDATION_ERROR', '이미 해설이 존재합니다.');
    await dbInsert(
      'INSERT INTO problem_editorials (problem_id, content, author_id) VALUES (?,?,?)',
      [problemId, content, req.user.id]
    );
    const editorial = await queryOne('SELECT * FROM problem_editorials WHERE problem_id = ?', [problemId]);
    res.status(201).json(editorial);
  } catch (err) {
    console.error('[problems/editorial/create]', err);
    return internalError(res);
  }
});

router.put('/:id/editorial', auth, adminOnly, async (req, res) => {
  const problemId = Number(req.params.id);
  const content = String(req.body?.content || '').trim();
  if (!content) return errorResponse(res, 400, 'VALIDATION_ERROR', '해설 내용을 입력해주세요.');

  try {
    const existing = await queryOne('SELECT id FROM problem_editorials WHERE problem_id = ?', [problemId]);
    if (!existing) return errorResponse(res, 404, 'NOT_FOUND', '해설이 없습니다.');
    await dbRun('UPDATE problem_editorials SET content = ?, author_id = ? WHERE problem_id = ?', [content, req.user.id, problemId]);
    const editorial = await queryOne('SELECT * FROM problem_editorials WHERE problem_id = ?', [problemId]);
    res.json(editorial);
  } catch (err) {
    console.error('[problems/editorial/update]', err);
    return internalError(res);
  }
});

// ★★★ 이 아래부터 /:id 파라미터 라우트 ★★★

// GET /api/problems/bookmarks
router.get('/bookmarks', auth, requireVerified, async (req, res) => {
  try {
    const User = await getUserModel();
    const Problem = await getProblemModel();
    const limit = Math.min(20, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const offset = Math.max(0, Number.parseInt(req.query.offset, 10) || 0);
    const bookmarks = await User.getBookmarks(req.user.id);
    const ids = (bookmarks || []).map((row) => row.problem_id);
    const pageIds = ids.slice(offset, offset + limit);
    const problems = (await Promise.all(pageIds.map((id) => Problem.findById(id, req.user.id))))
      .filter(Boolean)
      .map((problem) => sanitizeProblemForClient(problem, { isAdmin: req.user.role === 'admin' }));
    res.json({ bookmarks: ids, problems, total: ids.length, limit, offset });
  } catch (err) {
    return internalError(res);
  }
});

// GET /api/problems/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const problemId = Number(req.params.id);
    const User = await getUserModel();
    const requester = await User.findById(req.user.id);
    const subTier = requester?.subscription_tier || 'free';
    const isAdmin = requester?.role === 'admin';
    const cacheKey = `problem:detail:v2:${isAdmin ? 'admin' : subTier}:${problemId}:${req.user.id}`;
    const cached = await redis.getJSON(cacheKey);
    if (cached) return res.json(cached);

    const Problem = await getProblemModel();
    const p = await Problem.findById(problemId, req.user.id);
    if (!p) return errorResponse(res, 404, 'NOT_FOUND', '문제를 찾을 수 없습니다.');

    // 프리미엄 문제 접근 제어
    if (p.isPremium && !isAdmin && subTier !== 'pro' && subTier !== 'team') {
      return errorResponse(res, 403, 'FORBIDDEN', '이 문제는 프리미엄 회원 전용입니다.', {
        isPremium: true,
        requiredTier: 'pro'
      });
    }

    let result = sanitizeProblemForClient(p, { isAdmin });

    const difficultyStats = await getDifficultyStats(problemId, req.user.id);
    result = { ...result, ...difficultyStats };
    
    await redis.setJSON(cacheKey, result, 300); // 5분 캐시
    return res.json(result);
  } catch (err) { return internalError(res); }
});

// PUT /api/problems/:id (수정)
router.put('/:id', auth, adminOnly, validateBody(problemSchema), async (req, res) => {
  try {
    const Problem = await getProblemModel();
    const { payload, error } = normalizeProblemMutationPayload(req.body);
    if (error) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', error);
    }
    const p = await Problem.update(Number(req.params.id), payload);
    await redis.clearPrefix('problems:list:');
    await redis.clearPrefix(`problem:detail:${req.params.id}:`);
    await redis.clearPrefix(`problem:detail:v2:`);
    res.json(p);
  } catch (err) { console.error('[problems/update]', err.message); return internalError(res); }
});

// ★ DELETE /api/problems/:id (삭제) — 에러 핸들링 추가
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const Problem = await getProblemModel();
    await Problem.delete(Number(req.params.id));
    await redis.clearPrefix('problems:list:');
    await redis.clearPrefix(`problem:detail:${req.params.id}:`);
    await redis.clearPrefix(`problem:detail:v2:`);
    res.json({ message: '삭제됐습니다.' });
  } catch (err) {
    console.error('[problems/delete]', err.message);
    return internalError(res, '삭제 실패');
  }
});

// POST /api/problems/:id/bookmark
router.post('/:id/bookmark', auth, requireVerified, async (req, res) => {
  try {
    const User = await getUserModel();
    const problemId = Number(req.params.id);
    const bookmarked = await User.toggleBookmark(req.user.id, problemId);
    const countRow = await queryOne('SELECT COUNT(*) AS cnt FROM bookmarks WHERE problem_id = ?', [problemId]);
    res.json({ bookmarked, count: Number(countRow?.cnt || 0) });
  } catch (err) { return internalError(res); }
});

// GET /api/problems/:id/comments
router.get('/:id/comments', auth, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, Number.parseInt(req.query.offset, 10) || 0);
    const rows = await query(
      `SELECT pc.id,
              pc.parent_id AS parentId,
              pc.content,
              pc.like_count AS likeCount,
              pc.created_at AS createdAt,
              u.username,
              u.nickname,
              u.tier,
              u.avatar_emoji AS avatarEmoji,
              pc.user_id AS userId,
              EXISTS(
                SELECT 1
                FROM problem_comment_likes pcl
                WHERE pcl.user_id = ?
                  AND pcl.comment_id = pc.id
                LIMIT 1
              ) AS isLiked
       FROM problem_comments pc
       JOIN users u ON pc.user_id = u.id
       WHERE pc.problem_id = ?
       ORDER BY pc.parent_id IS NOT NULL, pc.created_at ASC
       LIMIT ${limit} OFFSET ${offset}`,
      [req.user.id, Number(req.params.id)]
    );
    return res.json((rows || []).map((row) => ({
      ...row,
      isLiked: Boolean(row.isLiked),
      canDelete: req.user.role === 'admin' || Number(row.userId) === Number(req.user.id),
    })));
  } catch (err) {
    console.error('[problem-comments/list]', err);
    return res.json([]);
  }
});

// POST /api/problems/:id/comments
router.post('/:id/comments', auth, requireVerified, async (req, res) => {
  try {
    const problemId = Number(req.params.id);
    const content = String(req.body?.content || req.body?.text || '').trim();
    const parentId = req.body?.parentId == null ? null : Number(req.body.parentId);

    if (!content || content.length > 500) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', '댓글은 1자 이상 500자 이하로 입력해주세요.');
    }

    const problem = await queryOne('SELECT id, title FROM problems WHERE id = ?', [problemId]);
    if (!problem) {
      return errorResponse(res, 404, 'NOT_FOUND', '문제를 찾을 수 없습니다.');
    }

    if (parentId) {
      const parent = await queryOne(
        'SELECT id FROM problem_comments WHERE id = ? AND problem_id = ?',
        [parentId, problemId]
      );
      if (!parent) {
        return errorResponse(res, 404, 'NOT_FOUND', '부모 댓글을 찾을 수 없습니다.');
      }
    }

    const id = await dbInsert(
      'INSERT INTO problem_comments (problem_id, user_id, content, parent_id) VALUES (?,?,?,?)',
      [problemId, req.user.id, content, parentId]
    );
    const row = await queryOne(
      `SELECT pc.id,
              pc.parent_id AS parentId,
              pc.content,
              pc.like_count AS likeCount,
              pc.created_at AS createdAt,
              u.username,
              u.nickname,
              u.tier,
              u.avatar_emoji AS avatarEmoji,
              pc.user_id AS userId
       FROM problem_comments pc
       JOIN users u ON u.id = pc.user_id
       WHERE pc.id = ?`,
      [id]
    );

    notifyProblemCommentMentions(content, req.user.id, problem.title).catch((err) => {
      console.warn('[problem-comments/mentions]', err.message);
    });

    return res.status(201).json({ ...row, isLiked: false, canDelete: true });
  } catch (err) {
    console.error('[problem-comments/create]', err);
    return internalError(res);
  }
});

// DELETE /api/problems/:problemId/comments/:commentId
router.delete('/:problemId/comments/:commentId', auth, async (req, res) => {
  try {
    const commentId = Number(req.params.commentId);
    const problemId = Number(req.params.problemId);
    const comment = await queryOne(
      'SELECT id, user_id FROM problem_comments WHERE id = ? AND problem_id = ?',
      [commentId, problemId]
    );
    if (!comment) {
      return errorResponse(res, 404, 'NOT_FOUND', '댓글을 찾을 수 없습니다.');
    }
    if (req.user.role !== 'admin' && Number(comment.user_id) !== Number(req.user.id)) {
      return errorResponse(res, 403, 'FORBIDDEN', '삭제 권한이 없습니다.');
    }
    await dbRun('DELETE FROM problem_comments WHERE id = ?', [commentId]);
    return res.json({ message: '삭제됐습니다.' });
  } catch (err) {
    console.error('[problem-comments/delete]', err);
    return internalError(res);
  }
});

// POST /api/problems/:problemId/comments/:commentId/like — 좋아요 (원자적 증가)
router.post('/:problemId/comments/:commentId/like', auth, async (req, res) => {
  try {
    const commentId = Number(req.params.commentId);
    const problemId = Number(req.params.problemId);
    const comment = await queryOne(
      'SELECT id, like_count FROM problem_comments WHERE id = ? AND problem_id = ?',
      [commentId, problemId]
    );
    if (!comment) return errorResponse(res, 404, 'NOT_FOUND', '댓글이 없습니다.');

    const inserted = await dbRun(
      'INSERT IGNORE INTO problem_comment_likes (user_id, comment_id) VALUES (?, ?)',
      [req.user.id, commentId]
    );

    let liked = false;
    if (inserted?.affectedRows === 1) {
      liked = true;
      await dbRun('UPDATE problem_comments SET like_count = ? WHERE id = ?', [Number(comment.like_count || 0) + 1, commentId]);
    } else {
      await dbRun('DELETE FROM problem_comment_likes WHERE user_id = ? AND comment_id = ?', [req.user.id, commentId]);
      await dbRun('UPDATE problem_comments SET like_count = ? WHERE id = ?', [Math.max(Number(comment.like_count || 0) - 1, 0), commentId]);
    }

    const updated = await queryOne('SELECT like_count FROM problem_comments WHERE id = ?', [commentId]);
    return res.json({ liked, likeCount: Number(updated?.like_count || 0) });
  } catch (err) {
    console.error('[problem-comments/like]', err);
    return internalError(res);
  }
});

// GET /api/problems/:id/similar
router.get('/:id/similar', auth, async (req, res) => {
  try {
    const Problem = await getProblemModel();
    const prob = await Problem.findById(Number(req.params.id));
    if (!prob) return res.json([]);
    const similar = await Problem.findSimilar(prob.id, req.user.id, {
      tier: prob.tier,
      tags: prob.tags,
      limit: 8,
    });
    res.json(similar);
  } catch { res.json([]); }
});

async function handleDifficultyVote(req, res) {
  try {
    const { vote } = req.body;
    const problemId = Number(req.params.id);
    const normalizedVote = Math.min(5, Math.max(1, Number(vote)));
    if (!Number.isInteger(normalizedVote)) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'vote는 1~5 사이 정수여야 합니다.');
    }
    const solved = await queryOne('SELECT 1 FROM submissions WHERE user_id=? AND problem_id=? AND result=? LIMIT 1', [req.user.id, problemId, 'correct']);
    if (!solved) return errorResponse(res, 403, 'FORBIDDEN', '문제를 먼저 풀어야 투표할 수 있습니다.');
    await dbRun(
      `INSERT INTO difficulty_votes (user_id, problem_id, vote)
       VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE vote = VALUES(vote)`,
      [req.user.id, problemId, normalizedVote]
    );
    const stats = await getDifficultyStats(problemId, req.user.id);
    await redis.clearPrefix(`problem:detail:${problemId}:`);
    return res.json(stats);
  } catch (err) {
    console.error('[vote]', err.message);
    return internalError(res);
  }
}

// POST /api/problems/:id/vote-difficulty
router.post('/:id/vote-difficulty', auth, requireVerified, validateBody(voteSchema), handleDifficultyVote);
router.post('/:id/difficulty-vote', auth, requireVerified, validateBody(voteSchema), handleDifficultyVote);

router.get('/:id/difficulty-vote', auth, async (req, res) => {
  try {
    const problemId = Number(req.params.id);
    const stats = await getDifficultyStats(problemId, req.user.id);
    return res.json(stats);
  } catch (err) {
    console.error('[vote/get]', err.message);
    return internalError(res);
  }
});

// GET /api/problems/:id/solutions
router.get('/:id/solutions', auth, async (req, res) => {
  try {
    const User = await getUserModel();
    const problemId = Number(req.params.id);
    const mySolved = await queryOne('SELECT 1 FROM submissions WHERE user_id=? AND problem_id=? AND result=? LIMIT 1', [req.user.id, problemId, 'correct']);
    const requester = await User.findById(req.user.id);
    if (!mySolved && requester?.role !== 'admin') return res.status(403).json({ message: '문제를 먼저 풀어야 다른 풀이를 볼 수 있습니다.' });
    const rows = await query(`SELECT s.id, s.lang, s.code, s.time_ms, s.memory_mb, s.submitted_at, u.username, u.tier FROM submissions s JOIN users u ON s.user_id = u.id WHERE s.problem_id = ? AND s.result = 'correct' ORDER BY s.submitted_at DESC LIMIT 20`, [problemId]);
    const seen = new Set();
    const unique = rows.filter(r => { if (seen.has(r.username)) return false; seen.add(r.username); return true; }).slice(0, 10);
    res.json(unique.map(r => ({ id: r.id, lang: r.lang, code: r.code, time: r.time_ms ? `${r.time_ms}ms` : '-', username: r.username, tier: r.tier, date: new Date(r.submitted_at).toLocaleDateString('ko-KR') })));
  } catch (err) { console.error('[solutions]', err.message); res.json([]); }
});

// GET /api/problems/:id/vote-stats
router.get('/:id/vote-stats', auth, async (req, res) => {
  try {
    const rows = await query('SELECT vote FROM difficulty_votes WHERE problem_id=?', [req.params.id]);
    if (rows.length === 0) return res.json({ avg: null, total: 0, distribution: {} });
    const avg = rows.reduce((s,r) => s + Number(r.vote), 0) / rows.length;
    const dist = {}; rows.forEach(r => { dist[r.vote] = (dist[r.vote]||0)+1; });
    res.json({ avg: Number(avg.toFixed(1)), total: rows.length, distribution: dist });
  } catch { res.json({ avg:null, total:0, distribution:{} }); }
});

export default router;
