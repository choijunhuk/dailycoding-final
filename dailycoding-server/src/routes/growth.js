import { Router } from 'express';
import { auth, requireVerified } from '../middleware/auth.js';
import { query } from '../config/mysql.js';
import { Submission } from '../models/Submission.js';

const router = Router();
router.use(auth);
router.use(requireVerified);

const ROLE_SETS = [
  {
    id: 'backend-junior',
    title: 'Backend Junior Coding Test Style',
    focus: ['Implementation', 'String', 'Hash', 'SQL Thinking'],
    description: 'A set that tests I/O accuracy, data structure selection, and edge case handling.',
  },
  {
    id: 'frontend-js',
    title: 'Frontend JavaScript Style',
    focus: ['Array', 'String', 'Sorting', 'Object Manipulation'],
    description: 'Trains JS array/string manipulation and logical thinking before browser tasks.',
  },
  {
    id: 'cs-core',
    title: 'Data Structures Focus Style',
    focus: ['Stack', 'Queue', 'Graph', 'Tree'],
    description: 'Composed of core data structure problems that are easy to explain in interviews.',
  },
];

const AI_INTERVIEW = {
  title: 'AI Interview Prep',
  flow: [
    'Solve one problem within the time limit.',
    'Explain your approach in 3 sentences.',
    'Use AI chat to practice follow-up questions on time complexity, edge cases, and alternatives.',
    'Review your answer with the checklist before moving to the next problem.',
  ],
  rubric: ['Accuracy', 'Complexity Explanation', 'Debugging Attitude', 'Communication'],
};

const HINT_LADDER = [
  { step: 1, title: 'Direction Hint', description: 'Only tells you what to observe in the problem.' },
  { step: 2, title: 'Algorithm Hint', description: 'Tells you the name and reason for the appropriate data structure or algorithm.' },
  { step: 3, title: 'Implementation Strategy', description: 'Provides pseudocode-level steps only — the answer code is hidden.' },
];

function rowsToProblems(rows = []) {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    tier: row.tier || 'unranked',
    difficulty: row.difficulty ?? null,
    tags: String(row.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 5),
    reason: row.reason || 'A recommended problem you have not solved yet.',
  }));
}

async function getWeeklyPlan(userId, isKo = false) {
  const recovery = await Submission.getRecoveryQueue(userId, { limit: 3 });
  const rows = await query(
    `SELECT p.id, p.title, p.tier, p.difficulty,
            GROUP_CONCAT(DISTINCT pt.tag ORDER BY pt.tag SEPARATOR ',') AS tags
     FROM problems p
     LEFT JOIN problem_tags pt ON pt.problem_id = p.id
     WHERE COALESCE(p.visibility, 'global') = 'global'
       AND COALESCE(p.problem_type, 'coding') = 'coding'
       AND NOT EXISTS (
         SELECT 1
         FROM submissions s
         WHERE s.user_id = ?
           AND s.problem_id = p.id
           AND s.result = 'correct'
         LIMIT 1
       )
     GROUP BY p.id, p.title, p.tier, p.difficulty
     ORDER BY
       CASE p.tier
         WHEN 'bronze' THEN 1
         WHEN 'silver' THEN 2
         WHEN 'gold' THEN 3
         WHEN 'platinum' THEN 4
         ELSE 5
       END,
       p.difficulty ASC,
       p.id ASC
     LIMIT 8`,
    [userId]
  );

  const fresh = rowsToProblems(rows).slice(0, Math.max(0, 7 - recovery.length));
  const recoveryProblems = recovery.map((item) => ({
    id: item.problemId,
    title: item.problemTitle,
    tier: item.tier,
    difficulty: item.difficulty,
    tags: item.tags,
    reason: isKo ? `${item.cause} 복습: ${item.action}` : `${item.cause} recovery: ${item.action}`,
    recoverySubmissionId: item.submissionId,
  }));

  return {
    title: isKo ? '이번 주 맞춤 학습 플랜' : 'This Week\'s Personalized Study Plan',
    summary: isKo ? '복습 문제가 먼저 배치되고, 남은 슬롯은 적절한 난이도의 미풀이 문제로 채워집니다.' : 'Recovery problems are placed first, and the remaining slots are filled with unsolved problems at the right difficulty.',
    days: [...recoveryProblems, ...fresh].slice(0, 7).map((problem, index) => ({
      day: index + 1,
      label: index < recoveryProblems.length ? (isKo ? '복습' : 'Recovery') : index < 5 ? (isKo ? '훈련' : 'Training') : (isKo ? '도전' : 'Challenge'),
      ...problem,
    })),
  };
}

async function getBattleAnalysis(userId, isKo = false) {
  const rows = await query(
    `SELECT result, score_for, score_against, solved_for, solved_against, opponent_name, created_at
     FROM battle_history
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 20`,
    [userId]
  );
  const list = rows || [];
  const wins = list.filter((row) => row.result === 'win').length;
  const losses = list.filter((row) => row.result === 'lose').length;
  const draws = list.filter((row) => row.result === 'draw').length;
  const avgSolved = list.length
    ? Math.round(list.reduce((sum, row) => sum + Number(row.solved_for || 0), 0) / list.length * 10) / 10
    : 0;
  const latest = list[0] || null;

  return {
    total: list.length,
    wins,
    losses,
    draws,
    avgSolved,
    latest: latest ? {
      opponentName: latest.opponent_name || 'Opponent',
      result: latest.result,
      scoreFor: latest.score_for,
      scoreAgainst: latest.score_against,
      solvedFor: latest.solved_for,
      solvedAgainst: latest.solved_against,
    } : null,
    insight: list.length === 0
      ? (isKo ? '아직 배틀 기록이 없습니다. 첫 배틀 후 전환점을 분석해 드립니다.' : 'No battle history yet. After your first battle, we will analyze the turning points.')
      : losses > wins
        ? (isKo ? '최근 배틀에서는 속도보다 안정성이 중요합니다. 오답 복구를 먼저 하고 같은 태그로 재도전해 보세요.' : 'In recent battles, stability matters more than speed. Try recovering wrong answers first, then rematch with the same tags.')
        : (isKo ? '배틀 흐름이 좋습니다. 더 높은 난이도나 스피드 레이스로 압박을 높여보세요.' : 'Your battle momentum is good. Try increasing the pressure with higher difficulty or race mode.'),
  };
}

async function getGrowthShareCard(userId) {
  const [rows] = await query(
    `SELECT u.username, u.tier, u.rating, u.streak, u.solved_count,
            COUNT(s.id) AS submissions,
            SUM(CASE WHEN s.result = 'correct' THEN 1 ELSE 0 END) AS correct
     FROM users u
     LEFT JOIN submissions s ON s.user_id = u.id
     WHERE u.id = ?
     GROUP BY u.id, u.username, u.tier, u.rating, u.streak, u.solved_count`,
    [userId]
  );
  const row = rows || {};
  const accuracy = Number(row.submissions || 0) > 0
    ? Math.round(Number(row.correct || 0) / Number(row.submissions || 1) * 100)
    : 0;
  return {
    username: row.username || 'DailyCoder',
    tier: row.tier || 'unranked',
    rating: Number(row.rating || 0),
    streak: Number(row.streak || 0),
    solvedCount: Number(row.solved_count || 0),
    accuracy,
    shareText: `${row.username || 'DailyCoder'}'s DailyCoding Growth Record: ${row.tier || 'unranked'} · ${Number(row.rating || 0)} pts · ${Number(row.streak || 0)}-day streak · ${accuracy}% accuracy`,
  };
}

router.get('/', async (req, res) => {
  try {
    const isKo = req.headers['x-language'] === 'ko';
    const [weeklyPlan, battleAnalysis, shareCard, recoveryQueue] = await Promise.all([
      getWeeklyPlan(req.user.id, isKo),
      getBattleAnalysis(req.user.id, isKo),
      getGrowthShareCard(req.user.id),
      Submission.getRecoveryQueue(req.user.id, { limit: 5 }),
    ]);

    res.json({
      weeklyPlan,
      battleAnalysis,
      roleSets: ROLE_SETS,
      aiInterview: AI_INTERVIEW,
      shareCard,
      teamStudy: {
        title: 'Team / Study Group Assignments',
        steps: ['Choose a problem set.', 'Set a deadline and target accuracy.', 'Track each member\'s progress on the team dashboard.'],
        cta: '/team',
      },
      discussionGuide: {
        title: 'Discussion & Explanation Boost',
        rules: ['Those who solved a problem share their approach.', 'Leave solution strategy tags like DP/Greedy/BFS.', 'Great explanations can be reused by teams or the community.'],
        cta: '/community',
      },
      hintLadder: HINT_LADDER,
      examImprovement: {
        title: 'Exam Mode Improvement',
        checks: ['Time limit exceeded problems', 'Wrong answer problems', 'Unattempted problems', 'Weak tags'],
        recommendation: recoveryQueue.length > 0
          ? 'Clear the wrong answer recovery queue before the exam, then retake the exam with the same tags.'
          : 'Your recovery queue is empty. Take a practice exam to find new weak spots.',
        cta: '/exams',
      },
      excludedRewardMission: {
        title: 'Growth Rewards Separate from Rankings',
        explanation: 'Daily mission rewards do not increase your ranking score. Earn XP to unlock personal cosmetic rewards such as badges, profile titles, and profile backgrounds.',
      },
    });
  } catch (err) {
    console.error('[growth-hub]', err);
    res.status(500).json({ message: 'Failed to load the growth hub.' });
  }
});

export default router;
