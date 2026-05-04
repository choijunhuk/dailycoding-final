import { Router }               from 'express';
import { auth, adminOnly, requireVerified } from '../middleware/auth.js';
import { User }                 from '../models/User.js';
import { Problem }              from '../models/Problem.js';
import { Submission }           from '../models/Submission.js';
import { askAI, askAIWithMeta } from '../services/ai.js';
import redis                    from '../config/redis.js';
import { AI_DAILY_QUOTA } from '../shared/constants.js';
import { completeMission } from '../services/missionService.js';

const router = Router();

// AI Quota Middleware
const checkAiQuota = async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(401).json({ message: '유저를 찾을 수 없습니다.' });
  req.aiUser = user;
  if (user.role === 'admin') return next();
  const tier = user.subscription_tier || 'free';
  
  if (tier !== 'free') return next();

  const today = new Date().toISOString().split('T')[0];
  const key = `quota:ai:${req.user.id}:${today}`;
  
  const current = await redis.get(key);
  if (current && parseInt(current) >= AI_DAILY_QUOTA) {
    return res.status(429).json({ 
      message: `일일 AI 힌트 할당량(${AI_DAILY_QUOTA}회)을 모두 사용하셨습니다. Pro 플랜으로 업그레이드하고 무제한으로 이용하세요!`,
      code: 'QUOTA_EXCEEDED'
    });
  }
  
  next();
};

async function incrementAiQuotaIfFree(req, userOverride = null) {
  const user = userOverride || req.aiUser || await User.findById(req.user.id);
  if (!user || (user.subscription_tier || 'free') !== 'free') return null;
  const today = new Date().toISOString().split('T')[0];
  const key = `quota:ai:${req.user.id}:${today}`;
  return redis.incr(key, 86400);
}

async function serveAnalyzeCache(req, res, next) {
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `analyze:${req.user.id}:${today}`;
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
  const user = req.aiUser || await User.findById(req.user.id);
  const ProblemModel = await (async () => {
    const { Problem } = await import('../models/Problem.js');
    return Problem;
  })();
  const allProblems = await ProblemModel.findAll({ userId: req.user.id });
  const solvedIds = new Set(await User.getSolvedIds(req.user.id));
  const unsolved = allProblems.filter(p => !solvedIds.has(p.id)).slice(0, 3);

  const fallback = {
    level: `${user?.username||'유저'}님은 ${user?.tier||'bronze'} 수준입니다.`,
    strengths: ['꾸준한 학습', '문제 해결 의지'],
    weaknesses: ['알고리즘 다양성', '시간 복잡도 최적화'],
    recommend: unsolved.map(p=>p.title),
    motivationMsg: `🔥 ${user?.streak||0}일 스트릭! 계속 화이팅!`,
    nextMilestone: `레이팅 ${(user?.rating||800)+200}점 달성`,
  };

  const prompt = `코딩학습 분석 보고서를 JSON으로 작성하세요. 
유저상태: 티어 ${user?.tier}, 레이팅 ${user?.rating}점, 연속 스트릭 ${user?.streak}일. 
추천대상 문제: ${unsolved.map(p=>p.title).join(', ')}.
필수 필드: {
  "level": "유저의 현재 상태 요약 한 줄",
  "strengths": ["강점1", "강점2"],
  "weaknesses": ["약점1", "약점2"],
  "recommend": ["문제제목1", "문제제목2", "문제제목3"],
  "motivationMsg": "유저를 위한 동기부여 메시지 한 줄",
  "nextMilestone": "다음 목표 지점"
}`;

  const aiResult = await askAIWithMeta(req.user.id, prompt, fallback, 300);
  const result = aiResult.data;
  if (aiResult.source === 'ai') {
    await redis.setJSON(req.analyzeCacheKey, result, 3600);
  }
  res.json(result);
});

// ── AI 채팅 ──────────────────────────────────────────────────────────────
router.post('/chat', auth, requireVerified, checkAiQuota, async (req, res) => {
  const { messages = [] } = req.body;
  const user = req.aiUser || await User.findById(req.user.id);
  const last = messages[messages.length - 1]?.parts?.[0]?.text
            || messages[messages.length - 1]?.content
            || '';

  const prompt = `당신은 친절한 알고리즘 멘토입니다. 
유저 정보: ${user?.tier} 티어, 레이팅 ${user?.rating}점.
유저 질문: ${last.slice(0, 400)}
위 질문에 대해 한국어로 명확하고 교육적인 답변을 3문장 이내의 JSON으로 반환하세요.
반환형식: {"text": "답변 내용"}`;

  const aiResult = await askAIWithMeta(req.user.id, prompt, { text: '알고리즘 공부 화이팅입니다!' }, 250);
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
    return res.status(400).json({ message: 'submissionId가 필요합니다.' });
  }

  try {
    const submission = await Submission.getWithCode(submissionId);
    if (!submission) return res.status(404).json({ message: '제출을 찾을 수 없습니다.' });
    if (submission.user_id !== req.user.id) return res.status(403).json({ message: '본인 제출만 분석할 수 있습니다.' });

    const problem = await Problem.findById(Number(submission.problem_id), req.user.id);
    if (!problem) return res.status(404).json({ message: '문제를 찾을 수 없습니다.' });

    const fallback = {
      summary: '채점 결과와 코드를 기준으로 재도전 순서를 정리했습니다.',
      likelyCause: submission.result === 'timeout'
        ? '시간 복잡도나 반복 구조가 입력 크기를 견디지 못했을 가능성이 큽니다.'
        : submission.result === 'compile'
          ? '문법, import, 함수명, 입출력 형식 중 하나가 채점 환경과 맞지 않을 가능성이 큽니다.'
          : '입출력 처리, 경계 조건, 조건 분기 중 하나를 먼저 의심해보세요.',
      nextSteps: [
        '예제 입력을 손으로 추적해서 실제 출력과 기대 출력을 비교하세요.',
        '빈 입력, 최소/최대 입력, 중복 값 같은 경계 조건을 따로 테스트하세요.',
        '수정 후 바로 제출하지 말고 실행 버튼으로 작은 케이스부터 확인하세요.',
      ],
      testFocus: '예제와 다른 최소/최대 경계 케이스',
      retryProblemId: problem.id,
    };

    const prompt = `아래 코딩 문제 오답 제출을 분석해 JSON으로만 답하세요.
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
  "likelyCause": "가장 가능성 높은 실패 원인",
  "nextSteps": ["재도전 단계1", "재도전 단계2", "재도전 단계3"],
  "testFocus": "다음에 직접 만들어볼 테스트 케이스 방향",
  "retryProblemId": ${problem.id}
}
정답 코드 전체를 직접 작성하지 말고, 사용자가 직접 고치도록 방향만 제시하세요.`;

    const aiResult = await askAIWithMeta(req.user.id, prompt, fallback, 500);
    if (aiResult.source === 'ai') {
      await incrementAiQuotaIfFree(req);
    }
    return res.json({ ...aiResult.data, source: aiResult.source, reason: aiResult.reason || null });
  } catch (err) {
    console.error('[ai/submission-coach]', err.message);
    return res.status(500).json({ message: '오답 코치를 불러오지 못했습니다.' });
  }
});

// ── AI 힌트 ──────────────────────────────────────────────────────────────
router.post('/hint', auth, requireVerified, checkAiQuota, async (req, res) => {
  const { problemId } = req.body;
  if (!problemId) return res.status(400).json({ message: '문제 ID가 필요합니다.' });

  try {
    const problem = await Problem.findById(Number(problemId), req.user.id);
    if (!problem) return res.status(404).json({ message: '문제를 찾을 수 없습니다.' });

    const desc = (problem.description || problem.desc || '').slice(0, 500);
    const fallback = {
      hint1: `"${problem.title}" 문제에서 요구하는 것이 정확히 무엇인지 파악하세요. 입력 범위와 출력 형식을 다시 확인해보세요.`,
      hint2: `예제 입출력을 직접 손으로 추적해보세요. 패턴이 보이면 그것이 핵심 알고리즘의 단서입니다.`,
      hint3: `문제를 작은 단위로 쪼개보세요. 각 단계를 독립적으로 해결한 뒤 합치는 방식으로 접근해보세요.`,
      commonMistake: '인덱스 범위, 빈 입력, 정수 오버플로우 같은 엣지 케이스를 놓치지 마세요.',
      relatedConcept: '완전탐색 또는 구현',
    };

    const cacheKey = `ai:hint:${problemId}`;
    let hintData = await redis.getJSON(cacheKey);
    const cacheHit = !!hintData;
    let hintAiSource = cacheHit ? 'cache' : 'fallback';

    if (!hintData) {
      const prompt = `다음 코딩 문제에 대해 3단계 점진적 힌트를 JSON으로 작성하세요 (한국어).

문제 제목: ${problem.title}
문제 설명: ${desc}
난이도: ${problem.tier}

규칙:
- 코드나 정답을 직접 알려주지 마세요
- 각 힌트는 이전 힌트보다 조금 더 구체적이어야 합니다
- 이 특정 문제에 맞는 힌트를 작성하세요 (일반적인 조언 금지)
- hint1은 문제 접근 방향만, hint2는 핵심 알고리즘/자료구조 언급, hint3은 구체적인 구현 전략

JSON 형식으로만 응답:
{
  "hint1": "문제 접근 방향 (이 문제에 특화된 힌트)",
  "hint2": "핵심 알고리즘/자료구조 이름과 왜 적합한지",
  "hint3": "구체적인 구현 전략 (의사코드 수준)",
  "commonMistake": "이 문제에서 자주 실수하는 부분",
  "relatedConcept": "관련 알고리즘/개념 이름"
}`;
      const aiResult = await askAIWithMeta(req.user.id, prompt, fallback, 600);
      hintData = aiResult.data;
      hintAiSource = aiResult.source;
      if (aiResult.source === 'ai') {
        await redis.setJSON(cacheKey, hintData, 3600);
      }
    }

    // 쿼터 차감 후 remaining 계산 (Free 유저만)
    const user = req.aiUser || await User.findById(req.user.id);
    let remaining;
    const today = new Date().toISOString().split('T')[0];
    const key = `quota:ai:${req.user.id}:${today}`;
    if (!cacheHit && hintAiSource === 'ai' && (user.subscription_tier === 'free' || !user.subscription_tier)) {
      const newCount = await redis.incr(key, 86400);
      remaining = Math.max(0, AI_DAILY_QUOTA - newCount);
    } else {
      const current = await redis.get(key);
      remaining = Math.max(0, AI_DAILY_QUOTA - parseInt(current || 0));
    }

    res.json({ ...hintData, remaining });
  } catch (err) {
    console.error('[ai/hint]', err.message);
    res.status(500).json({ message: '힌트 생성 실패' });
  }
});

// ── 오늘의 퀴즈 ──────────────────────────────────────────────────────────
router.post('/daily-quiz', auth, requireVerified, async (req, res) => {
  try {
    const user = req.aiUser || await User.findById(req.user.id);
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `ai:daily-quiz:${req.user.id}:${today}`;

    const cached = await redis.getJSON(cacheKey);
    if (cached) return res.json(cached);

    const fallback = {
      question: '배열에서 두 수의 합이 특정 값이 되는 쌍을 찾는 가장 효율적인 알고리즘의 시간 복잡도는?',
      options: ['O(n²)', 'O(n log n)', 'O(n)', 'O(log n)'],
      answer: 2,
      explanation: '해시맵을 사용하면 O(n)으로 풀 수 있습니다. 각 원소를 순회하며 (target - 현재값)이 해시맵에 있는지 확인합니다.',
      topic: '해시맵, Two Sum',
    };

    const tierTopics = {
      unranked: '기초 자료구조와 알고리즘',
      bronze: '배열, 문자열, 기초 정렬',
      silver: '이분탐색, 그리디, DP 기초',
      gold: '그래프, 트리, 동적 프로그래밍',
      platinum: '고급 DP, 세그먼트 트리, 비트마스킹',
      diamond: '고급 알고리즘, 수학적 최적화',
    };

    const prompt = `${tierTopics[user?.tier || 'bronze']} 관련 4지선다 퀴즈 1개를 JSON으로 작성하세요 (한국어).
난이도: ${user?.tier || 'bronze'} 수준 개발자 대상.
필수 필드:
{
  "question": "질문",
  "options": ["선택지0", "선택지1", "선택지2", "선택지3"],
  "answer": 정답_인덱스(0~3),
  "explanation": "정답 설명 (2-3문장)",
  "topic": "관련 개념 키워드"
}`;

    const aiResult = await askAIWithMeta(req.user.id, prompt, fallback, 400);
    const result = aiResult.data;
    if (aiResult.source === 'ai') {
      await redis.setJSON(cacheKey, result, 86400);
    }
    res.json(result);
  } catch (err) {
    console.error('[ai/daily-quiz]', err.message);
    res.status(500).json({ message: '퀴즈 생성 실패' });
  }
});

// ── 코드 리뷰 ────────────────────────────────────────────────────────────
router.post('/review', auth, requireVerified, checkAiQuota, async (req, res) => {
  const { problemId, code, lang } = req.body;
  if (!code) return res.status(400).json({ message: '코드가 필요합니다.' });

  try {
    const problem = problemId ? await Problem.findById(Number(problemId), req.user.id) : null;

    const fallback = {
      score: 70,
      summary: '코드를 분석했습니다. 전반적으로 양호합니다.',
      correctness: 75,
      timeComplexity: 65,
      spaceComplexity: 70,
      improvements: ['변수명을 더 명확하게 작성해보세요.', '엣지 케이스를 추가로 확인해보세요.'],
      betterCode: null,
    };

    const prompt = `다음 ${lang || '코드'}를 분석하고 코드 리뷰를 JSON으로 작성하세요 (한국어).
${problem ? `문제: ${problem.title} (${problem.tier} 난이도)` : ''}
코드:
\`\`\`
${code.slice(0, 1000)}
\`\`\`
필수 필드:
{
  "score": 0~100 종합 점수,
  "summary": "한 줄 요약",
  "correctness": 0~100 정확성 점수,
  "timeComplexity": 0~100 시간복잡도 효율 점수,
  "spaceComplexity": 0~100 공간복잡도 효율 점수,
  "improvements": ["개선사항1", "개선사항2"],
  "betterCode": "개선된 코드 문자열 또는 null"
}`;

    const aiResult = await askAIWithMeta(req.user.id, prompt, fallback, 600);
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
    res.status(500).json({ message: '코드 리뷰 실패' });
  }
});

// ── 문제 생성 (admin 전용) ────────────────────────────────────────────────
router.post('/generate-problem', auth, adminOnly, async (req, res) => {
  const { tier = 'bronze', tags = [], difficulty = 50, topic = '' } = req.body;

  const fallback = {
    title: `${tier} 레벨 알고리즘 문제`,
    desc: '두 수 A와 B가 주어졌을 때, A+B를 출력하시오.',
    inputDesc: '첫째 줄에 A와 B가 주어진다. (1 ≤ A, B ≤ 1000)',
    outputDesc: 'A+B를 출력한다.',
    examples: [{ input: '1 2', output: '3' }, { input: '10 20', output: '30' }],
    hint: '두 수를 더하면 됩니다.',
    solution: 'a, b = map(int, input().split())\nprint(a + b)',
    timeLimit: 2,
    memLimit: 256,
  };

  const tagsStr = Array.isArray(tags) ? tags.join(', ') : tags;

  const prompt = `${tier} 난이도의 코딩 문제를 JSON으로 작성하세요 (한국어).
태그: ${tagsStr || '자유'}  난이도 점수: ${difficulty}/100  주제: ${topic || '알고리즘'}
필수 필드:
{
  "title": "문제 제목",
  "desc": "문제 설명 (2-4문장)",
  "inputDesc": "입력 설명",
  "outputDesc": "출력 설명",
  "examples": [{"input": "입력1", "output": "출력1"}, {"input": "입력2", "output": "출력2"}],
  "hint": "힌트",
  "solution": "Python 모범 답안 코드",
  "timeLimit": 1~5,
  "memLimit": 128~512
}`;

  try {
    const result = await askAI(req.user.id, prompt, fallback, 800);
    res.json(result);
  } catch (err) {
    console.error('[ai/generate-problem]', err.message);
    res.status(500).json({ message: '문제 생성 실패' });
  }
});

export default router;
