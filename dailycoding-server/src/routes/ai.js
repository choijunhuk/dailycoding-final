import { Router }               from 'express';
import { createHash }           from 'crypto';
import { auth, adminOnly, requireVerified } from '../middleware/auth.js';
import { User }                 from '../models/User.js';
import { Problem }              from '../models/Problem.js';
import { AiHintCache }          from '../models/AiHintCache.js';
import { Submission }           from '../models/Submission.js';
import { askAIWithMeta } from '../services/ai.js';
import redis                    from '../config/redis.js';
import { queryOne }             from '../config/mysql.js';
import { AI_DAILY_QUOTA } from '../shared/constants.js';
import { completeMission } from '../services/missionService.js';

const router = Router();

const getUiLang = (req) => (req.body?.uiLang || req.query?.uiLang) === 'en' ? 'en' : 'ko';


// AI Quota Middleware — atomically INCR first, DECR if over limit (eliminates TOCTOU race)
const checkAiQuota = async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(401).json({ message: 'User not found.' });
  req.aiUser = user;
  if (user.role === 'admin') return next();
  const tier = user.subscription_tier || 'free';

  if (tier !== 'free') return next();

  const today = new Date().toISOString().split('T')[0];
  const key = `quota:ai:${req.user.id}:${today}`;

  const newCount = await redis.incr(key, 86400);
  if (newCount > AI_DAILY_QUOTA) {
    await redis.decr(key);
    return res.status(429).json({
      message: `You have used all ${AI_DAILY_QUOTA} AI requests available today.`,
      code: 'QUOTA_EXCEEDED',
    });
  }
  req.aiQuotaAlreadyIncremented = true;
  next();
};

async function incrementAiQuotaIfFree(req, userOverride = null) {
  if (req.aiQuotaAlreadyIncremented) return null;
  const user = userOverride || req.aiUser || await User.findById(req.user.id);
  if (!user || (user.subscription_tier || 'free') !== 'free') return null;
  const today = new Date().toISOString().split('T')[0];
  const key = `quota:ai:${req.user.id}:${today}`;
  return redis.incr(key, 86400);
}

async function getRemainingAiQuota(req, userOverride = null) {
  const user = userOverride || req.aiUser || await User.findById(req.user.id);
  if (!user || (user.subscription_tier || 'free') !== 'free') return null;
  const today = new Date().toISOString().split('T')[0];
  const key = `quota:ai:${req.user.id}:${today}`;
  const current = await redis.get(key);
  return Math.max(0, AI_DAILY_QUOTA - parseInt(current || 0));
}

function createProblemHintContentHash(problem, desc, uiLang = 'ko') {
  return createHash('sha256').update(JSON.stringify({
    title: problem.title || '',
    desc: desc || '',
    tier: problem.tier || '',
    lang: uiLang,
  })).digest('hex');
}

async function serveAnalyzeCache(req, res, next) {
  const uiLang = getUiLang(req);
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `analyze:${req.user.id}:${today}:${uiLang}`;
  const cached = await redis.getJSON(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  req.analyzeCacheKey = cacheKey;
  next();
}

// ── 할당량 확인 ──────────────────────────────────────────────────────────
router.get('/quota', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  const tier = user.subscription_tier || 'free';
  
  if (tier !== 'free') {
    return res.json({ tier, used: 0, limit: -1 }); // -1 = unlimited
  }

  const today = new Date().toISOString().split('T')[0];
  const key = `quota:ai:${req.user.id}:${today}`;
  const used = await redis.get(key);
  
  res.json({
    tier,
    used: parseInt(used || 0),
    limit: AI_DAILY_QUOTA
  });
});

// ── 실력 분석 ────────────────────────────────────────────────────────────
router.post('/analyze', auth, requireVerified, serveAnalyzeCache, async (req, res) => {
  const uiLang = getUiLang(req);
  const ko = uiLang === 'ko';
  const user = req.aiUser || await User.findById(req.user.id);
  const ProblemModel = await (async () => {
    const { Problem } = await import('../models/Problem.js');
    return Problem;
  })();
  const allProblems = await ProblemModel.findAll({ userId: req.user.id });
  const solvedIds = new Set(await User.getSolvedIds(req.user.id));
  const unsolved = allProblems.filter(p => !solvedIds.has(p.id)).slice(0, 3);

  const fallback = {
    level: ko
      ? `${user?.username||'사용자'}님은 현재 ${user?.tier||'bronze'} 레벨입니다.`
      : `${user?.username||'User'} is currently at the ${user?.tier||'bronze'} level.`,
    strengths: ko ? ['꾸준한 학습 태도', '문제 해결 의지'] : ['Consistent learning', 'Problem-solving drive'],
    weaknesses: ko ? ['알고리즘 다양성', '시간 복잡도 최적화'] : ['Algorithm diversity', 'Time complexity optimization'],
    recommend: unsolved.map(p=>p.title),
    motivationMsg: ko
      ? `🔥 ${user?.streak||0}일 연속 학습 중! 계속 달려봐요!`
      : `🔥 ${user?.streak||0}-day streak! Keep it up!`,
    nextMilestone: ko
      ? `레이팅 ${(user?.rating||800)+200} 달성하기`
      : `Reach rating ${(user?.rating||800)+200}`,
  };

  const sysInstrAnalyze = ko
    ? '당신은 코딩 학습 분석 전문가입니다. 반드시 한국어로만 답변하세요. Never use English in your response.'
    : 'You are a coding learning analyst. Respond in English only.';
  const prompt = ko
    ? `코딩 학습 분석 보고서를 JSON으로 작성해주세요. 반드시 한국어로만 작성하세요.
사용자 현황: 등급 ${user?.tier}, 레이팅 ${user?.rating}, 현재 연속 학습 ${user?.streak}일.
추천 문제: ${unsolved.map(p=>p.title).join(', ')}.
필수 필드: {
  "level": "사용자의 현재 수준 한 줄 요약",
  "strengths": ["강점1", "강점2"],
  "weaknesses": ["약점1", "약점2"],
  "recommend": ["문제제목1", "문제제목2", "문제제목3"],
  "motivationMsg": "한 줄 동기부여 메시지",
  "nextMilestone": "다음 목표 마일스톤"
}
반드시 한국어로만 응답하세요.`
    : `Write a coding learning analysis report as JSON. Respond in English only.
User status: tier ${user?.tier}, rating ${user?.rating}, current streak ${user?.streak} days.
Recommended problems: ${unsolved.map(p=>p.title).join(', ')}.
Required fields: {
  "level": "one-line summary of user's current status",
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "recommend": ["problemTitle1", "problemTitle2", "problemTitle3"],
  "motivationMsg": "one-line motivational message",
  "nextMilestone": "next goal milestone"
}
Respond in English only.`;

  const aiResult = await askAIWithMeta(req.user.id, prompt, fallback, 300, { systemInstruction: sysInstrAnalyze });
  const result = aiResult.data;
  if (aiResult.source === 'ai') {
    await redis.setJSON(req.analyzeCacheKey, result, 3600);
  }
  res.json({ ...result, source: aiResult.source, reason: aiResult.reason || null });
});

// ── AI 채팅 ──────────────────────────────────────────────────────────────
router.post('/chat', auth, requireVerified, checkAiQuota, async (req, res) => {
  const { messages = [] } = req.body;
  const user = req.aiUser || await User.findById(req.user.id);
  const last = messages[messages.length - 1]?.parts?.[0]?.text
            || messages[messages.length - 1]?.content
            || '';

  const uiLang = getUiLang(req);
  const ko = uiLang === 'ko';
  const sysInstr = ko
    ? '당신은 친절한 알고리즘 멘토입니다. 반드시 한국어로만 답변하세요. Never use English in your response.'
    : 'You are a friendly algorithm mentor. Respond in English only.';
  const prompt = ko
    ? `당신은 친절한 알고리즘 멘토입니다. 반드시 한국어로만 답변하세요.
사용자 정보: ${user?.tier} 등급, 레이팅 ${user?.rating}.
사용자 질문: ${last.slice(0, 400)}
3문장 이하의 명확하고 교육적인 답변을 JSON으로 반환하세요.
형식: {"text": "답변 내용"}
반드시 한국어로만 응답하세요.`
    : `You are a friendly algorithm mentor. Respond in English only.
User info: ${user?.tier} tier, rating ${user?.rating}.
User question: ${last.slice(0, 400)}
Return a clear, educational answer in 3 sentences or fewer as JSON.
Format: {"text": "answer content"}
Respond in English only.`;

  const aiResult = await askAIWithMeta(req.user.id, prompt, {
    text: ko ? '오늘 사용 가능한 AI 요청을 모두 사용했습니다.' : 'All available AI requests have been used up.',
  }, 250, { systemInstruction: sysInstr });
  const result = aiResult.data;
  
  if (aiResult.source === 'ai') {
    await incrementAiQuotaIfFree(req, user);
  }

  res.json({ text: result.text || result });
});

// ── 오답 재도전 코치 ──────────────────────────────────────────────────────
router.post('/submission-coach', auth, requireVerified, checkAiQuota, async (req, res) => {
  const submissionId = Number(req.body?.submissionId);
  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    return res.status(400).json({ message: 'submissionId is required.' });
  }

  try {
    const submission = await Submission.getWithCode(submissionId);
    if (!submission) return res.status(404).json({ message: 'Submission not found.' });
    if (submission.user_id !== req.user.id) return res.status(403).json({ message: 'You can only analyze your own submissions.' });

    const problem = await Problem.findById(Number(submission.problem_id), req.user.id);
    if (!problem) return res.status(404).json({ message: 'Problem not found.' });

    const uiLang = getUiLang(req);
    const ko = uiLang === 'ko';
    const fallback = {
      summary: ko
        ? '채점 결과와 제출 코드를 바탕으로 재도전 방향을 정리했습니다.'
        : 'Organized retry steps based on the judge result and submitted code.',
      likelyCause: submission.result === 'timeout'
        ? (ko ? '시간 복잡도나 반복문 구조가 입력 크기를 감당하지 못한 것으로 보입니다.' : 'The time complexity or loop structure likely could not handle the input size.')
        : submission.result === 'compile'
          ? (ko ? '문법 오류, import, 함수명, 또는 I/O 형식이 채점 환경과 맞지 않을 수 있습니다.' : 'A syntax error, import, function name, or I/O format may not match the judge environment.')
          : (ko ? 'I/O 처리, 경계 조건, 또는 조건 분기를 먼저 확인해보세요.' : 'Check I/O handling, boundary conditions, or conditional branching first.'),
      nextSteps: ko ? [
        '예제 입력을 직접 손으로 추적하며 실제 출력과 예상 출력을 비교해보세요.',
        '엣지 케이스를 별도로 테스트해보세요: 빈 입력, 최솟값/최댓값 입력, 중복 값 등.',
        '수정 후 바로 제출하지 말고, 실행 버튼으로 작은 케이스를 먼저 검증하세요.',
      ] : [
        'Manually trace the example input and compare actual vs expected output.',
        'Test edge cases separately: empty input, min/max input, duplicate values.',
        'Do not submit immediately after fixing — verify small cases with the run button first.',
      ],
      testFocus: ko ? '예제와 다른 최솟값/최댓값 경계 케이스' : 'Min/max boundary cases different from the examples',
      retryProblemId: problem.id,
    };

    const sysInstrCoach = ko
      ? '당신은 알고리즘 코칭 전문가입니다. 반드시 한국어로만 답변하세요. Never use English in your response.'
      : 'You are an algorithm coaching expert. Respond in English only.';
    const prompt = ko
      ? `아래 코딩 문제의 오답 제출을 분석하고 JSON으로만 응답하세요. 반드시 한국어로만 작성하세요.
문제 제목: ${problem.title}
난이도: ${problem.tier}
태그: ${(problem.tags || []).slice(0, 6).join(', ')}
문제 설명: ${(problem.desc || '').slice(0, 700)}
제출 언어: ${submission.lang}
채점 결과: ${submission.result}
채점 메시지: ${(submission.detail || '').slice(0, 500)}
제출 코드:
${String(submission.code || '').slice(0, 3500)}

필수 JSON 필드:
{
  "summary": "한 줄 요약",
  "likelyCause": "실패의 가장 유력한 원인",
  "nextSteps": ["재시도 단계1", "재시도 단계2", "재시도 단계3"],
  "testFocus": "다음에 작성할 테스트 케이스 방향",
  "retryProblemId": ${problem.id}
}
정답 코드를 직접 알려주지 말고, 사용자가 스스로 수정할 수 있도록 안내하세요.
반드시 한국어로만 응답하세요.`
      : `Analyze the incorrect submission for the coding problem below and respond only in JSON. Respond in English only.
Problem title: ${problem.title}
Difficulty: ${problem.tier}
Tags: ${(problem.tags || []).slice(0, 6).join(', ')}
Problem description: ${(problem.desc || '').slice(0, 700)}
Submission language: ${submission.lang}
Judge result: ${submission.result}
Judge message: ${(submission.detail || '').slice(0, 500)}
Submitted code:
${String(submission.code || '').slice(0, 3500)}

Required JSON fields:
{
  "summary": "one-line summary",
  "likelyCause": "most likely cause of failure",
  "nextSteps": ["retry step 1", "retry step 2", "retry step 3"],
  "testFocus": "direction for test cases to write next",
  "retryProblemId": ${problem.id}
}
Do not reveal the full solution — only guide the user toward fixing it themselves.
Respond in English only.`;

    const aiResult = await askAIWithMeta(req.user.id, prompt, fallback, 500, { systemInstruction: sysInstrCoach });
    if (aiResult.source === 'ai') {
      await incrementAiQuotaIfFree(req);
    }
    return res.json({ ...aiResult.data, source: aiResult.source, reason: aiResult.reason || null });
  } catch (err) {
    console.error('[ai/submission-coach]', err.message);
    return res.status(500).json({ message: 'Failed to load submission coach.' });
  }
});

// ── AI 힌트 ──────────────────────────────────────────────────────────────
router.post('/hint', auth, requireVerified, checkAiQuota, async (req, res) => {
  const { problemId } = req.body;
  if (!problemId) return res.status(400).json({ message: 'Problem ID is required.' });

  try {
    const problem = await Problem.findById(Number(problemId), req.user.id);
    if (!problem) return res.status(404).json({ message: 'Problem not found.' });

    const desc = (problem.description || problem.desc || '').slice(0, 500);
    const uiLang = getUiLang(req);
    const ko = uiLang === 'ko';
    const fallback = {
      hint1: ko
        ? `"${problem.title}" 문제가 정확히 무엇을 요구하는지 파악하세요. 입력 범위와 출력 형식을 다시 확인해보세요.`
        : `Identify exactly what the "${problem.title}" problem is asking for. Re-check the input range and output format.`,
      hint2: ko
        ? `예제 입력을 직접 손으로 추적해보세요. 패턴이 보이면 그게 핵심 알고리즘의 단서입니다.`
        : `Trace through the example inputs by hand. If you see a pattern, that is the clue to the core algorithm.`,
      hint3: ko
        ? `문제를 더 작은 단위로 나눠보세요. 각 단계를 독립적으로 해결한 뒤 합쳐보세요.`
        : `Break the problem into smaller units. Try solving each step independently, then combine them.`,
      commonMistake: ko
        ? '인덱스 범위, 빈 입력, 정수 오버플로우 같은 엣지 케이스를 놓치지 마세요.'
        : 'Do not overlook edge cases such as index bounds, empty input, or integer overflow.',
      relatedConcept: ko ? '완전 탐색 또는 구현' : 'Brute force or implementation',
    };
    const contentHash = createProblemHintContentHash(problem, desc, uiLang);

    const cacheKey = `ai:hint:${problem.id}`;
    const cachedPayload = await redis.getJSON(cacheKey);
    let hintData = cachedPayload?.contentHash === contentHash ? cachedPayload.hint : null;
    let cacheSource = hintData ? 'redis' : null;

    if (!hintData) {
      const cachedHint = await AiHintCache.findByProblemId(problem.id, contentHash);
      if (cachedHint) {
        hintData = cachedHint.hint;
        cacheSource = 'db';
        await redis.setJSON(cacheKey, { contentHash, hint: hintData }, 86400);
        await AiHintCache.incrementServed(problem.id);
      }
    }

    if (!hintData) {
      const sysInstrHint = ko
        ? '당신은 알고리즘 힌트 전문가입니다. 반드시 한국어로만 답변하세요. Never use English in your response.'
        : 'You are an algorithm hint expert. Respond in English only.';
      const prompt = ko
        ? `아래 코딩 문제에 대한 3단계 점진적 힌트를 작성해주세요. 반드시 한국어로만 작성하세요.

문제 제목: ${problem.title}
문제 설명: ${desc}
난이도: ${problem.tier}

규칙:
- 정답이나 코드를 직접 알려주지 마세요
- 각 힌트는 이전 힌트보다 조금 더 구체적이어야 합니다
- 이 문제에 특화된 힌트를 작성하세요 (일반적인 조언 금지)
- hint1: 접근 방향만, hint2: 핵심 알고리즘/자료구조 명시, hint3: 구체적인 구현 전략

JSON으로만 응답하세요:
{
  "hint1": "접근 방향 (이 문제에 특화)",
  "hint2": "핵심 알고리즘/자료구조와 그 이유",
  "hint3": "구체적인 구현 전략 (의사코드 수준)",
  "commonMistake": "이 문제에서 흔한 실수",
  "relatedConcept": "관련 알고리즘/개념명"
}
반드시 한국어로만 응답하세요.`
        : `Write 3-level progressive hints for the following coding problem. Respond in English only.

Problem title: ${problem.title}
Problem description: ${desc}
Difficulty: ${problem.tier}

Rules:
- Do not reveal the answer or code directly
- Each hint should be slightly more specific than the previous
- Write hints specific to this problem (no generic advice)
- hint1: approach direction only, hint2: name the key algorithm/data structure, hint3: concrete implementation strategy

Respond in JSON only:
{
  "hint1": "approach direction (specific to this problem)",
  "hint2": "key algorithm/data structure and why it fits",
  "hint3": "concrete implementation strategy (pseudocode level)",
  "commonMistake": "common mistake on this problem",
  "relatedConcept": "related algorithm/concept name"
}
Respond in English only.`;
      const aiResult = await askAIWithMeta(req.user.id, prompt, fallback, 600, { systemInstruction: sysInstrHint });
      hintData = aiResult.data;
      if (aiResult.source === 'ai') {
        await AiHintCache.save({
          problemId: problem.id,
          contentHash,
          hint: hintData,
          userId: req.user.id,
          model: aiResult.model || null,
        });
        await redis.setJSON(cacheKey, { contentHash, hint: hintData }, 86400);
        cacheSource = 'ai';
      }
    }

    const user = req.aiUser || await User.findById(req.user.id);
    if (cacheSource) {
      await incrementAiQuotaIfFree(req, user);
    }
    const remaining = await getRemainingAiQuota(req, user);

    res.json({ ...hintData, remaining, source: cacheSource || 'fallback' });
  } catch (err) {
    console.error('[ai/hint]', err.message);
    res.status(500).json({ message: 'Failed to generate hint.' });
  }
});

// ── 오늘의 퀴즈 ──────────────────────────────────────────────────────────
router.post('/daily-quiz', auth, requireVerified, async (req, res) => {
  try {
    const user = req.aiUser || await User.findById(req.user.id);
    const uiLang = getUiLang(req);
    const ko = uiLang === 'ko';
    const fallback = {
      question: ko
        ? '배열에서 합이 목표값이 되는 쌍을 찾는 가장 효율적인 알고리즘의 시간 복잡도는?'
        : 'What is the time complexity of the most efficient algorithm to find pairs in an array whose sum equals a target value?',
      options: ['O(n²)', 'O(n log n)', 'O(n)', 'O(log n)'],
      answer: 2,
      explanation: ko
        ? '해시맵을 사용하면 O(n)으로 풀 수 있습니다. 각 원소를 순회하며 (목표값 - 현재값)이 해시맵에 존재하는지 확인합니다.'
        : 'Using a hash map, you can solve it in O(n). Iterate through each element and check whether (target - current value) exists in the hash map.',
      topic: ko ? '해시맵, Two Sum' : 'Hash map, Two Sum',
    };

    const tierTopics = ko ? {
      unranked: '기본 자료구조와 알고리즘',
      bronze: '배열, 문자열, 기본 정렬',
      silver: '이분 탐색, 그리디, 기본 DP',
      gold: '그래프, 트리, 동적 프로그래밍',
      platinum: '고급 DP, 세그먼트 트리, 비트마스크',
      diamond: '고급 알고리즘, 수학적 최적화',
    } : {
      unranked: 'basic data structures and algorithms',
      bronze: 'arrays, strings, basic sorting',
      silver: 'binary search, greedy, basic DP',
      gold: 'graphs, trees, dynamic programming',
      platinum: 'advanced DP, segment trees, bitmask',
      diamond: 'advanced algorithms, mathematical optimization',
    };

    let techStack = [];
    try { techStack = JSON.parse(user?.tech_stack || '[]'); } catch { techStack = []; }
    const stackStr = Array.isArray(techStack) && techStack.length > 0
      ? techStack.slice(0, 5).join(', ')
      : null;

    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `ai:daily-quiz:${req.user.id}:${today}:${uiLang}`;

    const cached = await redis.getJSON(cacheKey);
    if (cached) return res.json(cached);

    const topicDesc = stackStr
      ? (ko
        ? `${stackStr} 기술 스택과 관련된 알고리즘/자료구조/개념 (${tierTopics[user?.tier || 'bronze']} 수준)`
        : `algorithms/data structures/concepts related to ${stackStr} tech stack (${tierTopics[user?.tier || 'bronze']} level)`)
      : tierTopics[user?.tier || 'bronze'];

    const sysInstrQuiz = ko
      ? '당신은 알고리즘 퀴즈 출제 전문가입니다. 반드시 한국어로만 답변하세요. Never use English in your response.'
      : 'You are an algorithm quiz expert. Respond in English only.';
    const prompt = ko
      ? `${topicDesc}에 관한 객관식 퀴즈 1개를 작성해주세요. 반드시 한국어로만 작성하세요.
난이도: ${user?.tier || 'bronze'} 등급 개발자를 대상으로 합니다.
필수 필드:
{
  "question": "질문 내용",
  "options": ["선택지0", "선택지1", "선택지2", "선택지3"],
  "answer": 정답_인덱스(0~3),
  "explanation": "해설 (2-3문장)",
  "topic": "관련 개념 키워드"
}
반드시 한국어로만 응답하세요.`
      : `Write 1 multiple-choice quiz question about ${topicDesc}. Respond in English only.
Difficulty: aimed at a ${user?.tier || 'bronze'}-level developer.
Required fields:
{
  "question": "question text",
  "options": ["option0", "option1", "option2", "option3"],
  "answer": correct_index(0~3),
  "explanation": "explanation (2-3 sentences)",
  "topic": "related concept keyword"
}
Respond in English only.`;

    const aiResult = await askAIWithMeta(req.user.id, prompt, fallback, 400, { systemInstruction: sysInstrQuiz });
    const result = aiResult.data;
    if (aiResult.source === 'ai') {
      await redis.setJSON(cacheKey, result, 86400);
    }
    res.json({ ...result, source: aiResult.source, reason: aiResult.reason || null });
  } catch (err) {
    console.error('[ai/daily-quiz]', err.message);
    res.status(500).json({ message: 'Failed to generate quiz.' });
  }
});

// ── 코드 리뷰 ────────────────────────────────────────────────────────────
router.post('/review', auth, requireVerified, checkAiQuota, async (req, res) => {
  const { problemId, code, lang } = req.body;
  if (!code) return res.status(400).json({ message: 'Code is required.' });

  try {
    const uiLang = getUiLang(req);
    const ko = uiLang === 'ko';
    const problem = problemId ? await Problem.findById(Number(problemId), req.user.id) : null;

    const fallback = {
      score: 70,
      summary: ko ? '코드를 분석했습니다. 전반적으로 양호합니다.' : 'Code analyzed. Overall looks good.',
      correctness: 75,
      timeComplexity: 65,
      spaceComplexity: 70,
      improvements: ko
        ? ['더 명확한 변수명 사용을 고려해보세요.', '추가적인 엣지 케이스 확인을 고려해보세요.']
        : ['Consider using clearer variable names.', 'Consider checking additional edge cases.'],
      betterCode: null,
    };

    const sysInstrReview = ko
      ? '당신은 코드 리뷰 전문가입니다. 반드시 한국어로만 답변하세요. Never use English in your response.'
      : 'You are a code review expert. Respond in English only.';
    const prompt = ko
      ? `다음 ${lang || '코드'}를 분석하고 코드 리뷰를 JSON으로 반환하세요. 반드시 한국어로만 작성하세요.
${problem ? `문제: ${problem.title} (${problem.tier} 난이도)` : ''}
코드:
\`\`\`
${code.slice(0, 1000)}
\`\`\`
필수 필드:
{
  "score": 0-100 전체 점수,
  "summary": "한 줄 요약",
  "correctness": 0-100 정확성 점수,
  "timeComplexity": 0-100 시간 복잡도 효율 점수,
  "spaceComplexity": 0-100 공간 복잡도 효율 점수,
  "improvements": ["개선점1", "개선점2"],
  "betterCode": "개선된 코드 문자열 또는 null"
}
반드시 한국어로만 응답하세요.`
      : `Analyze the following ${lang || 'code'} and return a code review as JSON. Respond in English only.
${problem ? `Problem: ${problem.title} (${problem.tier} difficulty)` : ''}
Code:
\`\`\`
${code.slice(0, 1000)}
\`\`\`
Required fields:
{
  "score": 0-100 overall score,
  "summary": "one-line summary",
  "correctness": 0-100 correctness score,
  "timeComplexity": 0-100 time complexity efficiency score,
  "spaceComplexity": 0-100 space complexity efficiency score,
  "improvements": ["improvement1", "improvement2"],
  "betterCode": "improved code string or null"
}
Respond in English only.`;

    const aiResult = await askAIWithMeta(req.user.id, prompt, fallback, 600, { systemInstruction: sysInstrReview });
    const result = aiResult.data;

    const user = req.aiUser || await User.findById(req.user.id);
    if (aiResult.source === 'ai') {
      await incrementAiQuotaIfFree(req, user);
      try {
        await completeMission(req.user.id, 'review_ai');
      } catch (missionErr) {
        console.error('[ai/review:mission]', missionErr);
      }
    }

    res.json(result);
  } catch (err) {
    console.error('[ai/review]', err.message);
    res.status(500).json({ message: 'Failed to perform code review.' });
  }
});

router.get('/walkthrough/:problemId', auth, requireVerified, async (req, res) => {
  const problemId = Number(req.params.problemId);
  if (!Number.isInteger(problemId) || problemId <= 0) {
    return res.status(400).json({ message: 'Invalid problem ID.' });
  }

  try {
    const [user, solved] = await Promise.all([
      User.findById(req.user.id),
      queryOne(
        'SELECT 1 FROM submissions WHERE user_id = ? AND problem_id = ? AND result = ? LIMIT 1',
        [req.user.id, problemId, 'correct']
      ),
    ]);
    if (!user) return res.status(401).json({ message: 'User not found.' });
    if (!solved && (user.subscription_tier || 'free') === 'free') {
      return res.status(403).json({ message: 'You must solve the problem first or have a Pro subscription.', requiresPro: true });
    }

    const problem = await Problem.findById(problemId, req.user.id);
    if (!problem) return res.status(404).json({ message: 'Problem not found.' });

    const uiLang = getUiLang(req);
    const ko = uiLang === 'ko';
    const desc = problem.description || problem.desc || '';
    const contentHash = createProblemHintContentHash(problem, desc);
    const cacheKey = `ai:walkthrough:${problemId}:${uiLang}`;
    const cached = await redis.getJSON(cacheKey);
    if (cached?.contentHash === contentHash && cached.walkthrough) {
      return res.json({ walkthrough: cached.walkthrough, source: 'cache' });
    }

    const fallback = ko ? [
      `## 접근 방법\n"${problem.title}" 문제는 입출력 조건을 먼저 분리하고 적절한 자료구조를 선택하는 것이 핵심입니다.`,
      '## 핵심 아이디어\n예제와 엣지 케이스를 직접 손으로 추적하여 반복되는 상태나 비교 기준을 찾아보세요.',
      '## 구현 단계\n1. 입력 파싱\n2. 핵심 로직을 함수로 추출\n3. 예제와 엣지 케이스로 검증\n4. 시간 복잡도 확인',
      '## 시간 복잡도\n문제의 입력 크기를 감안하여 O(n), O(n log n), O(n²) 중 어느 것이 허용되는지 검토하세요.',
    ].join('\n\n') : [
      `## Approach\nFor "${problem.title}", start by separating the input/output conditions and choosing the right data structure.`,
      '## Core Idea\nTrace through examples and edge cases by hand to find repeating states or comparison criteria.',
      '## Implementation Steps\n1. Parse input\n2. Extract core logic into a function\n3. Verify with examples and edge cases\n4. Check time complexity',
      '## Time Complexity\nGiven the input size, determine whether O(n), O(n log n), or O(n²) is acceptable.',
    ].join('\n\n');
    const sysInstrWalkthrough = ko
      ? '당신은 알고리즘 해설 전문가입니다. 반드시 한국어로만 답변하세요. Never use English in your response.'
      : 'You are an algorithm solution expert. Respond in English only.';
    const prompt = ko
      ? `다음 알고리즘 문제의 풀이 해설을 작성해주세요. 반드시 한국어로만 작성하세요.
구조: 접근 방법 → 핵심 아이디어 → 구현 단계 → 시간 복잡도 순으로 작성하세요.
전체 풀이 코드는 붙여넣지 마세요 — 학습자가 이해할 수 있도록 설명에 집중하세요.

제목: ${problem.title}
난이도: ${problem.tier}
태그: ${(problem.tags || []).slice?.(0, 8)?.join?.(', ') || ''}
문제 설명:
${String(desc).slice(0, 2500)}

JSON으로 응답하세요: {"walkthrough": "<## 헤더가 있는 전체 마크다운 내용>"}
반드시 한국어로만 응답하세요.`
      : `Write a solution walkthrough for the following algorithm problem. Respond in English only.
Structure must follow: Approach → Core Idea → Implementation Steps → Time Complexity.
Do not paste the full solution code — focus on explanation so the learner can understand.

Title: ${problem.title}
Difficulty: ${problem.tier}
Tags: ${(problem.tags || []).slice?.(0, 8)?.join?.(', ') || ''}
Problem description:
${String(desc).slice(0, 2500)}

Respond in JSON: {"walkthrough": "<full markdown content with ## headers>"}
Respond in English only.`;

    const aiResult = await askAIWithMeta(req.user.id, prompt, fallback, 900, { systemInstruction: sysInstrWalkthrough });
    const walkthrough = typeof aiResult.data === 'string'
      ? aiResult.data
      : aiResult.data?.text || aiResult.data?.walkthrough || fallback;
    if (aiResult.source === 'ai') {
      await redis.setJSON(cacheKey, { contentHash, walkthrough }, 86400 * 7);
    }
    return res.json({ walkthrough, source: aiResult.source, reason: aiResult.reason || null });
  } catch (err) {
    console.error('[ai/walkthrough]', err.message);
    return res.status(500).json({ message: 'Failed to load solution walkthrough.' });
  }
});

// ── 문제 생성 (admin 전용) ────────────────────────────────────────────────
router.post('/generate-problem', auth, adminOnly, async (req, res) => {
  const { tier = 'bronze', tags = [], difficulty = 50, topic = '', problemType = 'coding' } = req.body;
  const tagsStr = Array.isArray(tags) ? tags.join(', ') : tags;
  const context = `Tier: ${tier}  Tags: ${tagsStr || 'any'}  Difficulty: ${difficulty}/100  Topic: ${topic || 'any'}`;

  const PROMPTS = {
    coding: {
      prompt: `${context}\n${tier} 난이도 알고리즘 코딩 문제를 JSON 형식으로 한국어로 작성해줘.\n필수 필드:\n{\n  "title": "문제 제목",\n  "desc": "문제 설명 (2-4문장)",\n  "inputDesc": "입력 설명",\n  "outputDesc": "출력 설명",\n  "examples": [{"input": "입력1", "output": "출력1"}, {"input": "입력2", "output": "출력2"}],\n  "hint": "힌트",\n  "solution": "Python 모범 풀이 코드",\n  "timeLimit": 1-5,\n  "memLimit": 128-512\n}`,
      fallback: { title: `${tier} 알고리즘 문제`, desc: '정수 A와 B가 주어질 때 A+B를 출력하시오.', inputDesc: '첫째 줄에 A와 B가 주어진다.', outputDesc: 'A+B를 출력한다.', examples: [{ input: '1 2', output: '3' }], hint: '두 수를 더하면 됩니다.', solution: 'a, b = map(int, input().split())\nprint(a + b)', timeLimit: 2, memLimit: 256 },
    },
    'fill-blank': {
      prompt: `${context}\n빈칸 채우기 문제를 JSON 형식으로 한국어로 작성해줘. 코드에서 핵심 키워드 2-4개를 ___N___ 자리표시자로 비워두세요.\n필수 필드:\n{\n  "title": "문제 제목",\n  "desc": "코드 설명 (1-2문장)",\n  "codeTemplate": "___1___ 형식의 빈칸이 있는 전체 코드",\n  "blanks": ["정답1", "정답2"],\n  "hint": "힌트"\n}`,
      fallback: { title: '빈칸 채우기: 두 수의 합', desc: '두 수를 읽어 합계를 출력하는 코드의 빈칸을 채우세요.', codeTemplate: 'a, b = ___1___(int, input().split())\n___2___(a + b)', blanks: ['map', 'print'], hint: '정수 변환 함수와 출력 함수를 채워보세요.' },
    },
    'bug-fix': {
      prompt: `${context}\n버그가 있는 코드 문제를 JSON 형식으로 한국어로 작성해줘. 실행 시 잘못된 결과를 내는 버그를 심어두세요.\n필수 필드:\n{\n  "title": "문제 제목",\n  "desc": "코드 설명과 버그 증상 (2-3문장)",\n  "buggyCode": "버그가 있는 전체 코드 (버그 위치에 주석 표시)",\n  "keywords": ["수정할 키워드1", "키워드2"],\n  "explanation": "버그 원인과 수정 방법 설명",\n  "hint": "힌트"\n}`,
      fallback: { title: '버그 수정: 최댓값 오류', desc: '최댓값을 찾는 코드에 버그가 있습니다.', buggyCode: 'def find_max(arr):\n    max_val = 0  # 버그: 모두 음수인 배열에서 잘못됨\n    for x in arr:\n        if x > max_val:\n            max_val = x\n    return max_val\nprint(find_max([-3, -1, -4]))', keywords: ['arr[0]', '-float(\'inf\')'], explanation: 'max_val을 0으로 초기화하면 모든 원소가 음수일 때 0을 반환합니다.', hint: 'max_val의 초기값을 변경해보세요.' },
    },
    troubleshooting: {
      prompt: `${context}\n트러블슈팅 문제를 JSON 형식으로 한국어로 작성해줘. 버그가 있는 Python 스크립트를 디버깅하는 시나리오입니다.\n필수 필드:\n{\n  "title": "문제 제목",\n  "desc": "문제 설명 (2-3문장)",\n  "scenarioTitle": "시나리오 제목",\n  "scenarioDescription": "시나리오 상황 설명 (3-5문장)",\n  "initialFiles": [{"path": "main.py", "content": "버그 있는 코드", "editable": true}],\n  "visibleTests": [{"name": "기본 테스트", "command": ["python3", "main.py"], "input": "", "expectedOutput": "예상 출력", "timeoutMs": 3000}],\n  "hint": "디버깅 힌트"\n}`,
      fallback: { title: '트러블슈팅: NameError 디버그', desc: 'Python 스크립트가 NameError로 실패합니다. 버그를 찾아 수정하세요.', scenarioTitle: 'NameError 디버깅', scenarioDescription: '사용자 입력을 처리하는 스크립트가 런타임에 NameError를 발생시킵니다.', initialFiles: [{ path: 'main.py', content: 'name = input()\nprint(f"Hello, {nane}!")  # 버그: 오타', editable: true }], visibleTests: [{ name: '기본 출력 테스트', command: ['python3', 'main.py'], input: 'World', expectedOutput: 'Hello, World!', timeoutMs: 3000 }], hint: '변수명 오타를 확인해보세요.' },
    },
    'performance-fix': {
      prompt: `${context}\n성능 개선 문제를 JSON 형식으로 한국어로 작성해줘. O(n²) 이상으로 느린 Python 코드를 최적화하는 과제입니다.\n필수 필드:\n{\n  "title": "문제 제목",\n  "desc": "문제 설명 (2-3문장)",\n  "scenarioTitle": "시나리오 제목",\n  "scenarioDescription": "성능 문제 설명 (3-5문장)",\n  "initialFiles": [{"path": "main.py", "content": "느린 코드", "editable": true}],\n  "visibleTests": [{"name": "성능 테스트", "command": ["python3", "main.py"], "input": "", "expectedOutput": "예상 출력", "timeoutMs": 2000}],\n  "baselineTimeMs": 현재_예상_런타임ms,\n  "targetResponseTimeMs": 목표_런타임ms,\n  "hint": "최적화 힌트"\n}`,
      fallback: { title: '성능 개선: 중복 제거 O(n²) → O(n)', desc: '중복을 제거하는 코드가 너무 느립니다. O(n) 또는 O(n log n)으로 개선하세요.', scenarioTitle: '중복 제거 성능 문제', scenarioDescription: '리스트에서 중복을 제거하는 함수가 대용량 입력에서 시간 초과됩니다.', initialFiles: [{ path: 'main.py', content: 'def remove_duplicates(arr):\n    result = []\n    for x in arr:\n        if x not in result:  # O(n) 탐색 -> 전체 O(n²)\n            result.append(x)\n    return result\n\ndata = list(range(1000)) * 2\nprint(len(remove_duplicates(data)))', editable: true }], visibleTests: [{ name: '결과 검증', command: ['python3', 'main.py'], input: '', expectedOutput: '1000', timeoutMs: 2000 }], baselineTimeMs: 500, targetResponseTimeMs: 50, hint: 'set()을 사용하면 O(n)으로 중복을 제거할 수 있습니다.' },
    },
    'refactor-fix': {
      prompt: `${context}\n리팩토링 문제를 JSON 형식으로 한국어로 작성해줘. 동작은 하지만 중복되거나 과도하게 복잡한 Python 코드를 정리하는 과제입니다.\n필수 필드:\n{\n  "title": "문제 제목",\n  "desc": "문제 설명 (2-3문장)",\n  "scenarioTitle": "시나리오 제목",\n  "scenarioDescription": "리팩토링이 필요한 이유 설명 (3-5문장)",\n  "initialFiles": [{"path": "main.py", "content": "지저분한 코드", "editable": true}],\n  "visibleTests": [{"name": "기능 확인", "command": ["python3", "main.py"], "input": "", "expectedOutput": "예상 출력", "timeoutMs": 3000}],\n  "hint": "리팩토링 힌트"\n}`,
      fallback: { title: '리팩토링: 중복 조건문', desc: '반복되는 조건 검사가 있는 코드를 리팩토링하세요. 기능은 동일하게 유지해야 합니다.', scenarioTitle: '중복 조건문 리팩토링', scenarioDescription: '점수 확인 코드에 중복 로직이 너무 많습니다. 딕셔너리나 함수로 단순화하세요.', initialFiles: [{ path: 'main.py', content: 'score = 85\nif score >= 90:\n    grade = "A"\nif score >= 80 and score < 90:\n    grade = "B"\nif score >= 70 and score < 80:\n    grade = "C"\nif score >= 60 and score < 70:\n    grade = "D"\nif score < 60:\n    grade = "F"\nprint(grade)', editable: true }], visibleTests: [{ name: '등급 출력 검증', command: ['python3', 'main.py'], input: '', expectedOutput: 'B', timeoutMs: 3000 }], hint: 'elif 체인이나 딕셔너리 매핑으로 조건을 단순화해보세요.' },
    },
  };

  const { prompt, fallback } = PROMPTS[problemType] || PROMPTS.coding;

  try {
    const aiResult = await askAIWithMeta(req.user.id, prompt, fallback, 1000);
    if (aiResult.source !== 'ai') {
      return res.status(503).json({
        message: 'AI provider did not return a generated problem. Please try again later.',
        source: aiResult.source,
        reason: aiResult.reason || 'provider_unavailable',
      });
    }
    res.json({ ...aiResult.data, problemType, source: aiResult.source, model: aiResult.model || null });
  } catch (err) {
    console.error('[ai/generate-problem]', err.message);
    res.status(500).json({ message: 'Failed to generate problem.' });
  }
});

export default router;
