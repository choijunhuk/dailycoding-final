import { Router }               from 'express';
import { createHash }           from 'crypto';
import { auth, adminOnly, requireVerified } from '../middleware/auth.js';
import { User }                 from '../models/User.js';
import { Problem }              from '../models/Problem.js';
import { AiHintCache }          from '../models/AiHintCache.js';
import { Submission }           from '../models/Submission.js';
import { askAI, askAIWithMeta } from '../services/ai.js';
import redis                    from '../config/redis.js';
import { queryOne }             from '../config/mysql.js';
import { AI_DAILY_QUOTA } from '../shared/constants.js';
import { completeMission } from '../services/missionService.js';

const router = Router();

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

function createProblemHintContentHash(problem, desc) {
  return createHash('sha256').update(JSON.stringify({
    title: problem.title || '',
    desc: desc || '',
    tier: problem.tier || '',
  })).digest('hex');
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
    level: `${user?.username||'User'} is at the ${user?.tier||'bronze'} level.`,
    strengths: ['Consistent learning', 'Problem-solving drive'],
    weaknesses: ['Algorithm diversity', 'Time complexity optimization'],
    recommend: unsolved.map(p=>p.title),
    motivationMsg: `🔥 ${user?.streak||0}-day streak! Keep it up!`,
    nextMilestone: `Reach rating ${(user?.rating||800)+200}`,
  };

  const prompt = `Write a coding learning analysis report as JSON.
User status: tier ${user?.tier}, rating ${user?.rating}, current streak ${user?.streak} days.
Recommended problems: ${unsolved.map(p=>p.title).join(', ')}.
Required fields: {
  "level": "One-line summary of the user's current status",
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "recommend": ["problemTitle1", "problemTitle2", "problemTitle3"],
  "motivationMsg": "One-line motivational message for the user",
  "nextMilestone": "Next goal milestone"
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

  const prompt = `You are a friendly algorithm mentor.
User info: ${user?.tier} tier, rating ${user?.rating}.
User question: ${last.slice(0, 400)}
Return a clear, educational answer to the above question in 3 sentences or fewer as JSON.
Format: {"text": "answer content"}`;

  const aiResult = await askAIWithMeta(req.user.id, prompt, { text: 'All available AI requests have been used up.' }, 250);
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

    const fallback = {
      summary: 'Organized retry steps based on the judge result and submitted code.',
      likelyCause: submission.result === 'timeout'
        ? 'The time complexity or loop structure likely could not handle the input size.'
        : submission.result === 'compile'
          ? 'A syntax error, import, function name, or I/O format may not match the judge environment.'
          : 'Check I/O handling, boundary conditions, or conditional branching first.',
      nextSteps: [
        'Manually trace the example input and compare actual vs expected output.',
        'Test edge cases separately: empty input, min/max input, duplicate values.',
        'Do not submit immediately after fixing — verify small cases with the run button first.',
      ],
      testFocus: 'Min/max boundary cases different from the examples',
      retryProblemId: problem.id,
    };

    const prompt = `Analyze the incorrect submission for the coding problem below and respond only in JSON.
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
  "summary": "One-line summary",
  "likelyCause": "Most likely cause of failure",
  "nextSteps": ["retry step 1", "retry step 2", "retry step 3"],
  "testFocus": "Direction for test cases to write next",
  "retryProblemId": ${problem.id}
}
Do not write out the full correct solution — only guide the user toward fixing it themselves.`;

    const aiResult = await askAIWithMeta(req.user.id, prompt, fallback, 500);
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
    const fallback = {
      hint1: `Identify exactly what the "${problem.title}" problem is asking for. Re-check the input range and output format.`,
      hint2: `Trace through the example inputs by hand. If you see a pattern, that is the clue to the core algorithm.`,
      hint3: `Break the problem into smaller units. Try solving each step independently, then combine them.`,
      commonMistake: 'Do not overlook edge cases such as index bounds, empty input, or integer overflow.',
      relatedConcept: 'Brute force or implementation',
    };
    const contentHash = createProblemHintContentHash(problem, desc);

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
      const prompt = `Write 3-level progressive hints for the following coding problem in English.

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
  "hint1": "Approach direction (specific to this problem)",
  "hint2": "Key algorithm/data structure and why it fits",
  "hint3": "Concrete implementation strategy (pseudocode level)",
  "commonMistake": "Common mistake on this problem",
  "relatedConcept": "Related algorithm/concept name"
}`;
      const aiResult = await askAIWithMeta(req.user.id, prompt, fallback, 600);
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
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `ai:daily-quiz:${req.user.id}:${today}`;

    const cached = await redis.getJSON(cacheKey);
    if (cached) return res.json(cached);

    const fallback = {
      question: 'What is the time complexity of the most efficient algorithm to find pairs in an array whose sum equals a target value?',
      options: ['O(n²)', 'O(n log n)', 'O(n)', 'O(log n)'],
      answer: 2,
      explanation: 'Using a hash map, you can solve it in O(n). Iterate through each element and check whether (target - current value) exists in the hash map.',
      topic: 'Hash map, Two Sum',
    };

    const tierTopics = {
      unranked: 'basic data structures and algorithms',
      bronze: 'arrays, strings, basic sorting',
      silver: 'binary search, greedy, basic DP',
      gold: 'graphs, trees, dynamic programming',
      platinum: 'advanced DP, segment trees, bitmask',
      diamond: 'advanced algorithms, mathematical optimization',
    };

    const prompt = `Write 1 multiple-choice quiz question about ${tierTopics[user?.tier || 'bronze']} in English.
Difficulty: aimed at a ${user?.tier || 'bronze'}-level developer.
Required fields:
{
  "question": "question text",
  "options": ["option0", "option1", "option2", "option3"],
  "answer": correct_index(0~3),
  "explanation": "explanation (2-3 sentences)",
  "topic": "related concept keyword"
}`;

    const aiResult = await askAIWithMeta(req.user.id, prompt, fallback, 400);
    const result = aiResult.data;
    if (aiResult.source === 'ai') {
      await redis.setJSON(cacheKey, result, 86400);
    }
    res.json(result);
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
    const problem = problemId ? await Problem.findById(Number(problemId), req.user.id) : null;

    const fallback = {
      score: 70,
      summary: 'Code analyzed. Overall looks good.',
      correctness: 75,
      timeComplexity: 65,
      spaceComplexity: 70,
      improvements: ['Try using more descriptive variable names.', 'Consider checking additional edge cases.'],
      betterCode: null,
    };

    const prompt = `Analyze the following ${lang || 'code'} and write a code review as JSON (in English).
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

    const desc = problem.description || problem.desc || '';
    const contentHash = createProblemHintContentHash(problem, desc);
    const cacheKey = `ai:walkthrough:${problemId}`;
    const cached = await redis.getJSON(cacheKey);
    if (cached?.contentHash === contentHash && cached.walkthrough) {
      return res.json({ walkthrough: cached.walkthrough, source: 'cache' });
    }

    const fallback = [
      `## Approach\nFor "${problem.title}", the key is to first separate the input/output conditions and then choose the right data structure.`,
      '## Core Idea\nTrace through the examples and edge cases by hand to find recurring states or comparison criteria.',
      '## Implementation Steps\n1. Parse input\n2. Extract core logic into a function\n3. Verify with examples and edge cases\n4. Check time complexity',
      '## Time Complexity\nReview which of O(n), O(n log n), or O(n²) is acceptable given the problem\'s input size.',
    ].join('\n\n');
    const prompt = `Write a solution walkthrough for the following algorithm problem in English Markdown.
Structure must be: Approach → Core Idea → Implementation Steps → Time Complexity.
Do not paste the full answer code; focus on explanations that help learners understand.

Title: ${problem.title}
Difficulty: ${problem.tier}
Tags: ${(problem.tags || []).slice?.(0, 8)?.join?.(', ') || ''}
Description:
${String(desc).slice(0, 2500)}`;

    const aiResult = await askAIWithMeta(req.user.id, prompt, fallback, 900);
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
      prompt: `${context}\nWrite a ${tier}-difficulty algorithm coding problem as JSON (in English).\nRequired fields:\n{\n  "title": "problem title",\n  "desc": "problem description (2-4 sentences)",\n  "inputDesc": "input description",\n  "outputDesc": "output description",\n  "examples": [{"input": "input1", "output": "output1"}, {"input": "input2", "output": "output2"}],\n  "hint": "hint",\n  "solution": "Python model solution code",\n  "timeLimit": 1-5,\n  "memLimit": 128-512\n}`,
      fallback: { title: `${tier} Algorithm Problem`, desc: 'Given two integers A and B, print A+B.', inputDesc: 'The first line contains A and B.', outputDesc: 'Print A+B.', examples: [{ input: '1 2', output: '3' }], hint: 'Add the two numbers together.', solution: 'a, b = map(int, input().split())\nprint(a + b)', timeLimit: 2, memLimit: 256 },
    },
    'fill-blank': {
      prompt: `${context}\nWrite a fill-in-the-blank problem as JSON (in English). Leave 2-4 key keywords in the code as ___N___ placeholders.\nRequired fields:\n{\n  "title": "problem title",\n  "desc": "code description (1-2 sentences)",\n  "codeTemplate": "full code with ___1___ style blanks",\n  "blanks": ["answer1", "answer2"],\n  "hint": "hint"\n}`,
      fallback: { title: 'Fill in the Blank: Sum of Two Numbers', desc: 'Fill in the blanks to complete the code that reads two numbers and prints their sum.', codeTemplate: 'a, b = ___1___(int, input().split())\n___2___(a + b)', blanks: ['map', 'print'], hint: 'Fill in the integer conversion function and the print function.' },
    },
    'bug-fix': {
      prompt: `${context}\nWrite a buggy code problem as JSON (in English). Introduce a bug that produces wrong results when run.\nRequired fields:\n{\n  "title": "problem title",\n  "desc": "code description and bug symptom (2-3 sentences)",\n  "buggyCode": "full code with bug (mark bug with a comment)",\n  "keywords": ["keyword to fix1", "keyword2"],\n  "explanation": "explanation of the bug cause and how to fix it",\n  "hint": "hint"\n}`,
      fallback: { title: 'Bug Fix: Max Value Error', desc: 'There is a bug in the code that finds the maximum value.', buggyCode: 'def find_max(arr):\n    max_val = 0  # bug: wrong for all-negative arrays\n    for x in arr:\n        if x > max_val:\n            max_val = x\n    return max_val\nprint(find_max([-3, -1, -4]))', keywords: ['arr[0]', '-float(\'inf\')'], explanation: 'Initializing max_val to 0 returns 0 when all elements are negative.', hint: 'Change the initial value of max_val.' },
    },
    troubleshooting: {
      prompt: `${context}\nWrite a troubleshooting problem as JSON (in English). The scenario involves debugging a Python script that has a bug.\nRequired fields:\n{\n  "title": "problem title",\n  "desc": "problem description (2-3 sentences)",\n  "scenarioTitle": "scenario title",\n  "scenarioDescription": "scenario situation description (3-5 sentences)",\n  "initialFiles": [{"path": "main.py", "content": "buggy code", "editable": true}],\n  "visibleTests": [{"name": "basic test", "command": ["python3", "main.py"], "input": "", "expectedOutput": "expected output", "timeoutMs": 3000}],\n  "hint": "debugging hint"\n}`,
      fallback: { title: 'Troubleshooting: NameError Debug', desc: 'A Python script fails with a NameError. Find and fix the bug.', scenarioTitle: 'NameError Debugging', scenarioDescription: 'A script that processes user input raises a NameError at runtime.', initialFiles: [{ path: 'main.py', content: 'name = input()\nprint(f"Hello, {nane}!")  # bug: typo', editable: true }], visibleTests: [{ name: 'Basic output test', command: ['python3', 'main.py'], input: 'World', expectedOutput: 'Hello, World!', timeoutMs: 3000 }], hint: 'Check for a variable name typo.' },
    },
    'performance-fix': {
      prompt: `${context}\nWrite a performance improvement problem as JSON (in English). The task is to optimize slow Python code that runs in O(n²) or worse.\nRequired fields:\n{\n  "title": "problem title",\n  "desc": "problem description (2-3 sentences)",\n  "scenarioTitle": "scenario title",\n  "scenarioDescription": "performance problem description (3-5 sentences)",\n  "initialFiles": [{"path": "main.py", "content": "slow code", "editable": true}],\n  "visibleTests": [{"name": "performance test", "command": ["python3", "main.py"], "input": "", "expectedOutput": "expected output", "timeoutMs": 2000}],\n  "baselineTimeMs": current_expected_runtime_ms,\n  "targetResponseTimeMs": target_runtime_ms,\n  "hint": "optimization hint"\n}`,
      fallback: { title: 'Performance Fix: Dedup O(n²) → O(n)', desc: 'The code that removes duplicates is too slow. Improve it to O(n) or O(n log n).', scenarioTitle: 'Duplicate Removal Performance Issue', scenarioDescription: 'A function that removes duplicates from a list times out on large inputs.', initialFiles: [{ path: 'main.py', content: 'def remove_duplicates(arr):\n    result = []\n    for x in arr:\n        if x not in result:  # O(n) search -> overall O(n²)\n            result.append(x)\n    return result\n\ndata = list(range(1000)) * 2\nprint(len(remove_duplicates(data)))', editable: true }], visibleTests: [{ name: 'Result validation', command: ['python3', 'main.py'], input: '', expectedOutput: '1000', timeoutMs: 2000 }], baselineTimeMs: 500, targetResponseTimeMs: 50, hint: 'Using set() removes duplicates in O(n).' },
    },
    'refactor-fix': {
      prompt: `${context}\nWrite a refactoring problem as JSON (in English). The task is to clean up Python code that works but is duplicated or overly complex.\nRequired fields:\n{\n  "title": "problem title",\n  "desc": "problem description (2-3 sentences)",\n  "scenarioTitle": "scenario title",\n  "scenarioDescription": "explanation of why refactoring is needed (3-5 sentences)",\n  "initialFiles": [{"path": "main.py", "content": "messy code", "editable": true}],\n  "visibleTests": [{"name": "functionality check", "command": ["python3", "main.py"], "input": "", "expectedOutput": "expected output", "timeoutMs": 3000}],\n  "hint": "refactoring hint"\n}`,
      fallback: { title: 'Refactor: Duplicate Conditionals', desc: 'Refactor the code with repeated condition checks. The functionality must stay the same.', scenarioTitle: 'Duplicate Conditionals Refactoring', scenarioDescription: 'The grade-checking code has too much duplicated logic. Simplify it with a dictionary or function.', initialFiles: [{ path: 'main.py', content: 'score = 85\nif score >= 90:\n    grade = "A"\nif score >= 80 and score < 90:\n    grade = "B"\nif score >= 70 and score < 80:\n    grade = "C"\nif score >= 60 and score < 70:\n    grade = "D"\nif score < 60:\n    grade = "F"\nprint(grade)', editable: true }], visibleTests: [{ name: 'Grade output validation', command: ['python3', 'main.py'], input: '', expectedOutput: 'B', timeoutMs: 3000 }], hint: 'Simplify conditions with an elif chain or dictionary mapping.' },
    },
  };

  const { prompt, fallback } = PROMPTS[problemType] || PROMPTS.coding;

  try {
    const result = await askAI(req.user.id, prompt, fallback, 1000);
    res.json({ ...result, problemType });
  } catch (err) {
    console.error('[ai/generate-problem]', err.message);
    res.status(500).json({ message: 'Failed to generate problem.' });
  }
});

export default router;
