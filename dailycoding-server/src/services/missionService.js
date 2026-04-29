import { insert, query, queryOne, run } from '../config/mysql.js';

export const MISSION_TEMPLATES = [
  { type: 'solve_1', label: '오늘 문제 1개 풀기', rewardValue: 10 },
  { type: 'solve_3', label: '오늘 문제 3개 풀기', rewardValue: 30 },
  { type: 'correct_streak_3', label: '3문제 연속 정답', rewardValue: 20 },
  { type: 'battle_win', label: '배틀에서 1승', rewardValue: 25 },
  { type: 'review_ai', label: 'AI 코드 리뷰 1회 사용', rewardValue: 5 },
];

const MISSION_LABELS = new Map(MISSION_TEMPLATES.map((mission) => [mission.type, mission.label]));

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function toSqlDateTime(value = new Date()) {
  return value.toISOString().slice(0, 19).replace('T', ' ');
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

export function getMissionLabel(missionType) {
  return MISSION_LABELS.get(missionType) || missionType;
}

export async function ensureDailyMissions(userId) {
  const today = getToday();
  const existing = await query(
    'SELECT * FROM daily_missions WHERE user_id = ? AND mission_date = ? ORDER BY id ASC',
    [userId, today]
  );
  if (existing.length >= 3) return existing;

  const existingTypes = new Set(existing.map((mission) => mission.mission_type));
  const toCreate = shuffle(MISSION_TEMPLATES).filter((mission) => !existingTypes.has(mission.type)).slice(0, 3 - existing.length);

  for (const mission of toCreate) {
    await insert(
      `INSERT IGNORE INTO daily_missions (user_id, mission_date, mission_type, reward_value)
       VALUES (?, ?, ?, ?)`,
      [userId, today, mission.type, mission.rewardValue]
    );
  }

  return query(
    'SELECT * FROM daily_missions WHERE user_id = ? AND mission_date = ? ORDER BY id ASC',
    [userId, today]
  );
}

export async function completeMission(userId, missionType) {
  const today = getToday();
  const mission = await queryOne(
    `SELECT *
     FROM daily_missions
     WHERE user_id = ? AND mission_date = ? AND mission_type = ? AND is_completed = 0`,
    [userId, today, missionType]
  );
  if (!mission) return null;

  await run(
    'UPDATE daily_missions SET is_completed = 1, completed_at = ? WHERE id = ?',
    [toSqlDateTime(), mission.id]
  );
  await run('UPDATE users SET rating = rating + ? WHERE id = ?', [mission.reward_value, userId]);

  return {
    missionType,
    rewardValue: mission.reward_value,
  };
}

async function getTodayCorrectCount(userId) {
  const today = getToday();
  const rows = await query(
    `SELECT submitted_at
     FROM submissions
     WHERE user_id = ? AND result = ?
     ORDER BY submitted_at DESC`,
    [userId, 'correct']
  );
  return rows.filter((row) => {
    const submittedAt = typeof row.submitted_at === 'string'
      ? row.submitted_at.slice(0, 10)
      : new Date(row.submitted_at).toISOString().slice(0, 10);
    return submittedAt === today;
  }).length;
}

async function hasCorrectStreakToday(userId, streakLength = 3) {
  const today = getToday();
  const rows = await query(
    `SELECT result, submitted_at
     FROM submissions
     WHERE user_id = ?
     ORDER BY submitted_at DESC`,
    [userId]
  );

  const todayRows = rows.filter((row) => {
    const submittedAt = typeof row.submitted_at === 'string'
      ? row.submitted_at.slice(0, 10)
      : new Date(row.submitted_at).toISOString().slice(0, 10);
    return submittedAt === today;
  });

  if (todayRows.length < streakLength) return false;
  return todayRows.slice(0, streakLength).every((row) => row.result === 'correct');
}

export async function handleCorrectSubmissionMissions(userId) {
  const settled = [];
  const firstSolve = await completeMission(userId, 'solve_1');
  if (firstSolve) settled.push(firstSolve);

  const todayCorrectCount = await getTodayCorrectCount(userId);
  if (todayCorrectCount >= 3) {
    const solveThree = await completeMission(userId, 'solve_3');
    if (solveThree) settled.push(solveThree);
  }

  if (await hasCorrectStreakToday(userId, 3)) {
    const streakMission = await completeMission(userId, 'correct_streak_3');
    if (streakMission) settled.push(streakMission);
  }

  return settled;
}

export function serializeMission(row) {
  return {
    id: row.id,
    type: row.mission_type,
    label: getMissionLabel(row.mission_type),
    isCompleted: Boolean(row.is_completed),
    rewardType: row.reward_type,
    rewardValue: row.reward_value,
    completedAt: row.completed_at,
  };
}
