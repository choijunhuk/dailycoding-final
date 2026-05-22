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
  title: 'AI Mock Interview',
  flow: [
    'Solve one problem within the time limit.',
    'Explain your approach in 3 sentences.',
    'AI asks follow-up questions on time complexity, edge cases, and alternative solutions.',
    'Receive a report graded on accuracy, explanation quality, and time management.',
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

async function getWeeklyPlan(userId) {
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
    reason: `${item.cause} recovery: ${item.action}`,
    recoverySubmissionId: item.submissionId,
  }));

  return {
    title: 'This Week\'s Personalized Study Plan',
    summary: 'Recovery problems are placed first, and the remaining slots are filled with unsolved problems at the right difficulty.',
    days: [...recoveryProblems, ...fresh].slice(0, 7).map((problem, index) => ({
      day: index + 1,
      label: index < recoveryProblems.length ? 'Recovery' : index < 5 ? 'Training' : 'Challenge',
      ...problem,
    })),
  };
}

async function getBattleAnalysis(userId) {
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
      ? 'No battle history yet. After your first battle, we will analyze the turning points.'
      : losses > wins
        ? 'In recent battles, stability matters more than speed. Try recovering wrong answers first, then rematch with the same tags.'
        : 'Your battle momentum is good. Try increasing the pressure with higher difficulty or race mode.',
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
    const [weeklyPlan, battleAnalysis, shareCard, recoveryQueue] = await Promise.all([
      getWeeklyPlan(req.user.id),
      getBattleAnalysis(req.user.id),
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
          : 'Your recovery queue is empty. Take a mock test to find new weak spots.',
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
