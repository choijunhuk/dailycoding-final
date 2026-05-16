import { Router } from 'express';
import { auth, requireVerified } from '../middleware/auth.js';
import { query } from '../config/mysql.js';

const router = Router();
router.use(auth);
router.use(requireVerified);

const DUNGEON_BOSSES = [
  { name: '입출력 고블린', emoji: '🟢', theme: 'warmup' },
  { name: '그리디 와이번', emoji: '🐉', theme: 'greedy' },
  { name: 'DP 골렘', emoji: '🪨', theme: 'dp' },
  { name: '그래프 리치', emoji: '🧙', theme: 'graph' },
  { name: '문자열 크라켄', emoji: '🦑', theme: 'string' },
];

const TERRITORIES = [
  { id: 'implementation', label: '구현 왕국', aliases: ['implementation', '구현', 'simulation', '시뮬레이션'] },
  { id: 'math', label: '수학 성채', aliases: ['math', '수학', 'number-theory', '정수론'] },
  { id: 'string', label: '문자열 숲', aliases: ['string', '문자열'] },
  { id: 'graph', label: '그래프 전선', aliases: ['graph', '그래프', 'bfs', 'dfs'] },
  { id: 'dp', label: 'DP 요새', aliases: ['dp', 'dynamic-programming', '동적계획법'] },
];

function toInt(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeProblem(row = {}) {
  return {
    id: toInt(row.id || row.problem_id || row.problemId),
    title: row.title || row.problem_title || '알고리즘 문제',
    tier: row.tier || 'bronze',
    difficulty: toInt(row.difficulty, 1),
    solvedCount: toInt(row.solved_count || row.solvedCount, 0),
    tags: String(row.tags || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 5),
  };
}

function tierDamage(tier = '') {
  return ({
    iron: 70,
    bronze: 90,
    silver: 120,
    gold: 165,
    platinum: 220,
    emerald: 260,
    diamond: 320,
    master: 380,
    grandmaster: 450,
    challenger: 520,
  })[String(tier).toLowerCase()] || 100;
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function hashSeed(text) {
  return String(text).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function pickDailyProblems(problems, key = dayKey(), count = 4) {
  if (!problems.length) return [];
  const seed = hashSeed(key);
  const sorted = [...problems].sort((a, b) => a.id - b.id);
  const picked = [];
  for (let offset = 0; offset < sorted.length && picked.length < Math.min(count, sorted.length); offset += 1) {
    const index = (seed + offset * 7) % sorted.length;
    const candidate = sorted[index];
    if (!picked.some((item) => item.id === candidate.id)) picked.push(candidate);
  }
  return picked;
}

async function getPublicCodingProblems(limit = 160) {
  const rows = await query(
    `SELECT p.id, p.title, p.tier, p.difficulty, p.solved_count,
            GROUP_CONCAT(DISTINCT pt.tag ORDER BY pt.tag SEPARATOR ',') AS tags
     FROM problems p
     LEFT JOIN problem_tags pt ON pt.problem_id = p.id
     WHERE COALESCE(p.visibility, 'global') = 'global'
       AND COALESCE(p.problem_type, 'coding') = 'coding'
     GROUP BY p.id, p.title, p.tier, p.difficulty, p.solved_count
     ORDER BY p.id ASC
     LIMIT ${Math.max(1, Math.min(300, Number(limit) || 160))}`
  );
  return (rows || []).map(normalizeProblem).filter((problem) => problem.id);
}

async function getSolvedIds(userId, problemIds = []) {
  if (!problemIds.length) return new Set();
  const rows = await query(
    `SELECT DISTINCT problem_id
     FROM submissions
     WHERE user_id = ?
       AND result = 'correct'
       AND problem_id IN (${problemIds.map(() => '?').join(',')})`,
    [userId, ...problemIds]
  );
  return new Set((rows || []).map((row) => toInt(row.problem_id || row.problemId)).filter(Boolean));
}

async function buildGhostChallenges(userId, limit = 12) {
  const safeLimit = Math.max(1, Math.min(20, Number(limit) || 12));
  const rows = await query(
    `SELECT p.id AS problem_id, p.title, p.tier, p.difficulty, p.solved_count,
            s.user_id AS ghost_user_id, u.username AS ghost_username,
            s.lang, s.time_ms, s.solve_time_sec, s.submitted_at
     FROM submissions s
     JOIN problems p ON p.id = s.problem_id
     LEFT JOIN users u ON u.id = s.user_id
     WHERE s.result = 'correct'
       AND s.user_id != ?
       AND COALESCE(p.visibility, 'global') = 'global'
       AND COALESCE(p.problem_type, 'coding') = 'coding'
       AND NOT EXISTS (
         SELECT 1
         FROM submissions mine
         WHERE mine.user_id = ?
           AND mine.problem_id = p.id
           AND mine.result = 'correct'
         LIMIT 1
       )
     ORDER BY COALESCE(s.solve_time_sec, CEIL(COALESCE(s.time_ms, 120000) / 1000), 600) ASC,
              s.submitted_at DESC
     LIMIT ${safeLimit}`,
    [userId, userId]
  );

  const challenges = (rows || [])
    .filter((row) => row.problem_id || row.title)
    .map((row) => {
      const targetTimeSec = Math.max(45, toInt(row.solve_time_sec, Math.ceil(toInt(row.time_ms, 180000) / 1000)) || 180);
      return {
        problemId: toInt(row.problem_id || row.id),
        title: row.title || '고스트 챌린지',
        tier: row.tier || 'bronze',
        difficulty: toInt(row.difficulty, 1),
        rewardXp: Math.max(50, Math.round(targetTimeSec / 3)),
        mode: 'ghost-race',
        ghost: {
          userId: toInt(row.ghost_user_id || row.user_id, 0) || null,
          username: row.ghost_username || '익명 고스트',
          lang: row.lang || 'python',
          targetTimeSec,
          submittedAt: row.submitted_at || null,
        },
      };
    })
    .filter((challenge) => challenge.problemId)
    .slice(0, safeLimit);

  if (challenges.length > 0) return challenges;

  const fallbackProblems = await getPublicCodingProblems(safeLimit);
  const solvedIds = await getSolvedIds(userId, fallbackProblems.map((problem) => problem.id));
  return fallbackProblems
    .filter((problem) => !solvedIds.has(problem.id))
    .slice(0, safeLimit)
    .map((problem, index) => {
      const targetTimeSec = 240 + index * 35 + toInt(problem.difficulty, 1) * 20;
      return {
        problemId: problem.id,
        title: problem.title,
        tier: problem.tier,
        difficulty: problem.difficulty,
        rewardXp: Math.max(60, Math.round(tierDamage(problem.tier) / 2)),
        mode: 'ghost-race',
        ghost: {
          userId: null,
          username: '시스템 고스트',
          lang: 'python',
          targetTimeSec,
          submittedAt: null,
        },
      };
    });
}

async function buildDailyDungeon(userId) {
  const key = dayKey();
  const boss = DUNGEON_BOSSES[hashSeed(key) % DUNGEON_BOSSES.length];
  const problems = pickDailyProblems(await getPublicCodingProblems(180), key, 4);
  const solvedIds = await getSolvedIds(userId, problems.map((problem) => problem.id));
  const rooms = problems.map((problem, index) => {
    const damage = tierDamage(problem.tier);
    const cleared = solvedIds.has(problem.id);
    return {
      order: index + 1,
      problemId: problem.id,
      title: problem.title,
      tier: problem.tier,
      difficulty: problem.difficulty,
      tags: problem.tags,
      damage,
      cleared,
    };
  });
  const maxHp = Math.max(480, rooms.reduce((sum, room) => sum + room.damage, 0) + 160);
  const dealt = rooms.reduce((sum, room) => sum + (room.cleared ? room.damage : 0), 0);
  const hp = Math.max(0, maxHp - dealt);

  return {
    date: key,
    boss: {
      ...boss,
      hp,
      maxHp,
      defeated: hp === 0,
    },
    rooms,
    progress: {
      cleared: rooms.filter((room) => room.cleared).length,
      total: rooms.length,
      damageDealt: dealt,
      percent: maxHp ? Math.min(100, Math.round((dealt / maxHp) * 100)) : 0,
    },
  };
}

function normalizeTag(tag = '') {
  const value = String(tag).trim().toLowerCase();
  const territory = TERRITORIES.find((item) => item.aliases.some((alias) => value === alias.toLowerCase() || value.includes(alias.toLowerCase())));
  return territory?.id || null;
}

async function buildSeasonConquest(userId) {
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const rows = await query(
    `SELECT s.user_id, s.problem_id, s.submitted_at, pt.tag
     FROM submissions s
     JOIN problem_tags pt ON pt.problem_id = s.problem_id
     WHERE s.result = 'correct'
     ORDER BY s.submitted_at DESC
     LIMIT 1000`
  );

  const territories = TERRITORIES.map((territory) => ({
    id: territory.id,
    label: territory.label,
    totalSolves: 0,
    mySolves: 0,
    controlled: false,
    progress: 0,
    reward: '배틀 XP + 프로필 배지 진행도',
  }));
  const byId = new Map(territories.map((territory) => [territory.id, territory]));

  (rows || []).forEach((row) => {
    const submittedAt = row.submitted_at ? new Date(row.submitted_at).getTime() : Date.now();
    if (Number.isFinite(submittedAt) && submittedAt < since) return;
    const territoryId = normalizeTag(row.tag);
    if (!territoryId) return;
    const territory = byId.get(territoryId);
    territory.totalSolves += 1;
    if (String(row.user_id) === String(userId)) territory.mySolves += 1;
  });

  territories.forEach((territory) => {
    territory.progress = territory.totalSolves ? Math.min(100, Math.round((territory.mySolves / territory.totalSolves) * 100)) : 0;
    territory.controlled = territory.mySolves > 0 && territory.progress >= 40;
  });

  return {
    seasonId: `weekly-${dayKey().slice(0, 7)}`,
    resetAt: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString(),
    territories,
    mySolvedThisWeek: territories.reduce((sum, territory) => sum + territory.mySolves, 0),
    totalSolvedThisWeek: territories.reduce((sum, territory) => sum + territory.totalSolves, 0),
  };
}

router.get('/ghost', async (req, res, next) => {
  try {
    const limit = Math.max(3, Math.min(20, toInt(req.query.limit, 12)));
    const challenges = await buildGhostChallenges(req.user.id, limit);
    res.json({ challenges });
  } catch (err) {
    next(err);
  }
});

router.get('/dungeon/today', async (req, res, next) => {
  try {
    res.json(await buildDailyDungeon(req.user.id));
  } catch (err) {
    next(err);
  }
});

router.get('/season', async (req, res, next) => {
  try {
    res.json(await buildSeasonConquest(req.user.id));
  } catch (err) {
    next(err);
  }
});

router.get('/summary', async (req, res, next) => {
  try {
    const [ghostChallenges, dungeon, season] = await Promise.all([
      buildGhostChallenges(req.user.id, 6),
      buildDailyDungeon(req.user.id),
      buildSeasonConquest(req.user.id),
    ]);

    res.json({
      ghost: {
        candidates: ghostChallenges.length,
        challenges: ghostChallenges,
        bestTarget: ghostChallenges[0] || null,
      },
      dungeon,
      season,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
