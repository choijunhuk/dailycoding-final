import crypto from 'crypto';
import { insert, isConnected, query, queryOne, run } from '../config/mysql.js';
import { nowMySQL, toMySQL } from '../config/dateutil.js';

const ROOM_PREFIX = 'algo_';
const DEFAULT_DURATION_SEC = 300;
const DEFAULT_MAX_PLAYERS = 2;
const MAX_PLAYERS = 6;
const LOBBY_TIMEOUT_MS = 5 * 60 * 1000;

const BATTLE_MODES = {
  'sort-speed': {
    key: 'sort-speed',
    title: '⚡ 스피드전',
    description: '먼저 정답을 제출한 플레이어가 즉시 승리하는 순수 속도 대결.',
    winCondition: 'first-correct',
    rules: ['같은 문제 1개를 동시에 풀기', '먼저 정답 제출한 플레이어 즉시 승리', '시간 내 정답 없으면 점수 비교'],
    maxPlayers: 2,
    durationSec: 300,
    itemsEnabled: false,
    effectsEnabled: false,
    chatEnabled: true,
    emotesEnabled: true,
    activityEnabled: true,
    itemCooldownSec: 0,
    problemCount: 1,
  },
  'survival': {
    key: 'survival',
    title: '💀 생존전',
    description: '상대 HP를 0으로 만들면 승리! 정답 제출마다 공격력이 증가해 상대를 공격합니다.',
    winCondition: 'hp-knockout',
    rules: ['같은 문제 1개를 동시에 풀기', '정답 제출 → 상대 HP 감소', '오답 제출 → 내 속도 감소', '상대 HP가 0이 되면 즉시 승리', '시간 종료 시 HP가 더 많은 플레이어 승리'],
    maxPlayers: 2,
    durationSec: 300,
    itemsEnabled: false,
    effectsEnabled: false,
    chatEnabled: true,
    emotesEnabled: true,
    activityEnabled: true,
    itemCooldownSec: 0,
    problemCount: 1,
  },
  'duel-effects': {
    key: 'duel-effects',
    title: '✨ 효과전',
    description: '정답 제출 시 문제 태그 기반 버프/디버프가 발동! HP 전투 + 무작위 효과로 역전 가능.',
    winCondition: 'hp-knockout',
    rules: ['HP 전투 기본 규칙 동일', '정답 제출 시 문제 효과 발동 (버프/디버프)', '아이템 사용 가능 (쿨다운 20초)', '효과로 HP 회복·공격력 증가 등 역전 가능'],
    maxPlayers: 2,
    durationSec: 300,
    itemsEnabled: true,
    effectsEnabled: true,
    chatEnabled: true,
    emotesEnabled: true,
    activityEnabled: true,
    itemCooldownSec: 20,
    problemCount: 1,
  },
  'chaos-items': {
    key: 'chaos-items',
    title: '🎒 아이템 난투',
    description: '빠른 쿨다운 아이템으로 상대를 흔드는 HP 전투! 아이템 전략이 승패를 가릅니다.',
    winCondition: 'hp-knockout',
    rules: ['HP 전투 기본 규칙 동일', '아이템 쿨다운 12초 (효과전보다 빠름)', '실드·공격 아이템 적극 활용 권장', '아이템 없이는 불리한 모드'],
    maxPlayers: 2,
    durationSec: 300,
    itemsEnabled: true,
    effectsEnabled: true,
    chatEnabled: true,
    emotesEnabled: true,
    activityEnabled: true,
    itemCooldownSec: 12,
    problemCount: 1,
  },
  'territory': {
    key: 'territory',
    title: '🏴 점령전',
    description: '5개 문제 동시 공개! 먼저 풀면 내 영토. 더 많은 구역을 점령한 플레이어가 승리.',
    winCondition: 'territory',
    rules: ['5개 문제가 동시에 공개됨', '정답 제출 → 해당 문제 구역 점령', '5개 모두 점령 시 즉시 승리', '시간 종료 시 점령 수가 많은 플레이어 승리'],
    maxPlayers: 2,
    durationSec: 600,
    itemsEnabled: false,
    effectsEnabled: false,
    chatEnabled: true,
    emotesEnabled: true,
    activityEnabled: true,
    itemCooldownSec: 0,
    problemCount: 5,
  },
};

const BATTLE_ITEMS = {
  'lag-spike': { key: 'lag-spike', label: '렉 스파이크', description: '상대의 속도를 잠시 낮춥니다.' },
  shield: { key: 'shield', label: '실드', description: '내 HP를 회복합니다.' },
  'power-up': { key: 'power-up', label: '파워업', description: '내 공격력을 올립니다.' },
  breakpoint: { key: 'breakpoint', label: '브레이크포인트', description: '상대의 공격력을 낮춥니다.' },
};

const BATTLE_EMOTES = ['gg', 'nice', 'oops', 'focus', 'taunt'];
const BANNABLE_TAGS = ['정렬', '수학', '문자열', '그래프', '탐색', 'DP', '구현'];
const PROBLEM_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function toIsoLike(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function toTimeMs(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function normalizeRoom(row) {
  if (!row) return null;
  return {
    id: row.id,
    mode: row.mode || 'sort-speed',
    problemId: row.problem_id == null ? null : Number(row.problem_id),
    problemIds: parseJson(row.problem_ids, null),
    territoryClaims: parseJson(row.territory_claims, {}),
    status: row.status || 'waiting',
    maxPlayers: Number(row.max_players || DEFAULT_MAX_PLAYERS),
    durationSec: Number(row.duration_sec || DEFAULT_DURATION_SEC),
    startedAt: toIsoLike(row.started_at),
    endedAt: toIsoLike(row.ended_at),
    createdBy: row.created_by == null ? null : Number(row.created_by),
    createdAt: toIsoLike(row.created_at),
    isPrivate: Boolean(row.is_private),
    inviteCode: row.invite_code || null,
    preferredLanguage: row.preferred_language || null,
    lobbyExpiresAt: toIsoLike(row.lobby_expires_at),
  };
}

function normalizeParticipant(row, user = null) {
  if (!row) return null;
  return {
    roomId: row.room_id,
    userId: Number(row.user_id),
    username: user?.username || row.username || `user-${row.user_id}`,
    characterHp: Number(row.character_hp ?? 100),
    attackPower: Number(row.attack_power ?? 10),
    speed: Number(row.speed ?? 10),
    score: Number(row.score ?? 0),
    isReady: Boolean(row.is_ready),
    joinedAt: toIsoLike(row.joined_at),
    lastSeenAt: toIsoLike(row.last_seen_at),
  };
}

function normalizeEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id == null ? null : Number(row.user_id),
    type: row.event_type,
    payload: parseJson(row.payload_json, {}),
    createdAt: toIsoLike(row.created_at),
  };
}

function normalizeSubmission(row) {
  if (!row) return null;
  return {
    id: row.id,
    roomId: row.room_id,
    userId: Number(row.user_id),
    code: row.code || '',
    language: row.language || '',
    isCorrect: Boolean(row.is_correct),
    executionTimeMs: row.execution_time_ms == null ? null : Number(row.execution_time_ms),
    memoryMb: row.memory_mb == null ? null : Number(row.memory_mb),
    score: Number(row.score || 0),
    detail: row.detail || '',
    problemId: row.problem_id == null ? null : Number(row.problem_id),
    createdAt: toIsoLike(row.created_at),
  };
}

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeMode(mode) {
  return BATTLE_MODES[mode] ? mode : 'sort-speed';
}

function sanitizeText(value, maxLength = 220) {
  return Array.from(String(value || ''))
    .map((char) => { const code = char.charCodeAt(0); return code < 32 || code === 127 ? ' ' : char; })
    .join('').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function getBattleModeConfig(mode, overrides = {}) {
  const key = normalizeMode(mode);
  return {
    ...BATTLE_MODES[key],
    availableItems: Object.values(BATTLE_ITEMS),
    availableEmotes: BATTLE_EMOTES,
    ...overrides,
  };
}

function getRoomConfig(room, events = []) {
  const configEvent = [...(events || [])].reverse().find((event) => event.type === 'room.config');
  return getBattleModeConfig(room?.mode || 'sort-speed', {
    bannedTags: Array.isArray(configEvent?.payload?.bannedTags) ? configEvent.payload.bannedTags : [],
  });
}

function getActivityByUserId(participants = [], events = []) {
  const participantIds = new Set(participants.map((p) => Number(p.userId)));
  const activityTypes = new Set(['player.activity', 'player.chat', 'player.emote', 'item.used', 'problem.effect', 'player.ready']);
  const activity = {};
  for (const event of events || []) {
    if (!event.userId || !participantIds.has(Number(event.userId)) || !activityTypes.has(event.type)) continue;
    const label =
      event.type === 'player.chat' ? '채팅 중' :
      event.type === 'player.emote' ? '이모트 사용' :
      event.type === 'item.used' ? '아이템 사용' :
      event.type === 'problem.effect' ? '문제 효과 발동' :
      event.type === 'player.ready' ? '준비 완료' :
      event.payload?.activity || '집중 중';
    activity[String(event.userId)] = {
      userId: Number(event.userId),
      label,
      message: sanitizeText(event.payload?.message || event.payload?.emote || event.payload?.itemLabel || '', 80),
      createdAt: event.createdAt,
    };
  }
  return activity;
}

function hasBannedTag(tags = [], bannedTags = []) {
  const banned = new Set((bannedTags || []).map((t) => String(t).toLowerCase()));
  return (tags || []).some((t) => banned.has(String(t).toLowerCase()));
}

function tierIndex(tier) {
  const idx = PROBLEM_TIERS.indexOf(String(tier || '').toLowerCase());
  return idx === -1 ? 0 : idx;
}

function problemTierFromRating(rating = 0) {
  const value = Number(rating) || 0;
  if (value >= 10000) return 'diamond';
  if (value >= 6000) return 'platinum';
  if (value >= 2800) return 'gold';
  if (value >= 1000) return 'silver';
  return 'bronze';
}

function uniqueTiers(startIdx, endIdx) {
  const start = Math.max(0, Math.min(PROBLEM_TIERS.length - 1, startIdx));
  const end = Math.max(start, Math.min(PROBLEM_TIERS.length - 1, endIdx));
  return PROBLEM_TIERS.slice(start, end + 1);
}

export function resolveBattleProblemRange(profiles = [], room = {}) {
  const normalized = (profiles || []).filter(Boolean);
  if (normalized.length === 0) {
    return { tiers: ['bronze'], minDifficulty: 1, maxDifficulty: 3 };
  }

  const effectiveRatings = normalized.map((profile) => {
    const algorithmRating = Number(profile.rating ?? 800) || 0;
    const battleScore = Number(profile.battleScore || 0) || 0;
    return Math.max(0, algorithmRating + battleScore * 20);
  });
  const avgRating = effectiveRatings.reduce((sum, rating) => sum + rating, 0) / effectiveRatings.length;
  const avgTier = problemTierFromRating(avgRating);
  const centerIdx = tierIndex(avgTier);
  const minRating = Math.min(...effectiveRatings);
  const maxRating = Math.max(...effectiveRatings);
  const spread = maxRating - minRating;

  let below = centerIdx <= 1 ? 0 : 1;
  let above = centerIdx === 0 ? 0 : 1;
  if (avgRating >= 6000) below += 1;
  if (avgRating >= 10000) above += 1;
  if (spread >= 2500) {
    below += 1;
    above += 1;
  }
  if (room.mode === 'territory' || Number(room.durationSec || 0) >= 600) {
    above += centerIdx === 0 ? 0 : 1;
  }

  const tiers = uniqueTiers(centerIdx - below, centerIdx + above);
  const minDifficulty = Math.max(1, Math.min(9, centerIdx * 2 + 1));
  const maxDifficulty = Math.max(minDifficulty, Math.min(9, centerIdx * 2 + 3 + (above > 1 ? 1 : 0)));
  return { tiers, minDifficulty, maxDifficulty };
}

function inferProblemEffect(problem) {
  const tags = [...(problem?.tags || []), problem?.title || ''].map((t) => String(t).toLowerCase()).join(' ');
  if (/그래프|graph|bfs|dfs|탐색|search|maze|path/.test(tags)) {
    return { key: 'snare', label: '경로 봉쇄', target: 'opponents', description: '상대 속도를 낮춥니다.' };
  }
  if (/dp|dynamic|다이나믹|동적/.test(tags)) {
    return { key: 'shield', label: '메모이제이션 실드', target: 'self', description: '내 HP를 회복합니다.' };
  }
  if (/정렬|sort|수학|math/.test(tags)) {
    return { key: 'haste', label: '정렬 가속', target: 'self', description: '내 속도와 공격력을 올립니다.' };
  }
  return { key: 'precision', label: '정밀 타격', target: 'self', description: '내 공격력을 올립니다.' };
}

export function calculateBattleScore({ isCorrect, executionTimeMs = null, memoryMb = null, elapsedSec = 0 }) {
  const correct = Boolean(isCorrect);
  const correctnessBase = correct ? 100 : 0;
  const runtime = Number.isFinite(Number(executionTimeMs)) ? Math.max(0, Number(executionTimeMs)) : null;
  const memory = Number.isFinite(Number(memoryMb)) ? Math.max(0, Number(memoryMb)) : null;
  const performanceBonus = correct && runtime != null ? Math.max(0, Math.round(80 - runtime / 25)) : 0;
  const timeBonus = correct ? Math.max(0, Math.round(60 - Math.max(0, Number(elapsedSec) || 0) / 3)) : 0;
  const memoryBonus = correct && memory != null ? Math.max(0, Math.round(20 - memory / 8)) : 0;
  const penalty = correct ? 0 : 35;
  const score = Math.max(0, correctnessBase + performanceBonus + timeBonus + memoryBonus - penalty);
  const speed = correct ? Math.max(10, Math.min(70, 10 + Math.round(performanceBonus / 2))) : 6;
  const attackPower = correct ? Math.max(10, Math.min(60, 10 + Math.round(score / 10))) : 0;
  return { score, correctnessBase, performanceBonus, timeBonus, memoryBonus, penalty, speed, attackPower };
}

async function getUserById(userId) {
  const { User } = await import('./User.js');
  return User.findById(Number(userId));
}

async function getProblemById(problemId) {
  if (!problemId) return null;
  const { Problem } = await import('./Problem.js');
  return Problem.findById(Number(problemId));
}

async function findProblemIds(count = 1, { bannedTags = [], tiers = PROBLEM_TIERS, minDifficulty = 1, maxDifficulty = 9 } = {}) {
  const limit = Math.max(count * 20, 200);
  const rows = await query(
    `SELECT id, tier, difficulty FROM problems
     WHERE COALESCE(visibility, 'global') = 'global'
       AND COALESCE(problem_type, 'coding') = 'coding'
     ORDER BY RAND()
     LIMIT ${limit}`,
    []
  );

  const result = [];
  const usedIds = new Set();

  for (const row of rows || []) {
    if (result.length >= count) break;
    if (usedIds.has(Number(row.id))) continue;
    if (tiers.length > 0 && !tiers.includes(String(row.tier || '').toLowerCase())) continue;
    const difficulty = Number(row.difficulty || 1);
    if (difficulty < minDifficulty || difficulty > maxDifficulty) continue;
    if (bannedTags.length > 0) {
      const tagRows = await query('SELECT tag FROM problem_tags WHERE problem_id = ?', [row.id]);
      const tags = (tagRows || []).map((t) => t.tag);
      if (hasBannedTag(tags, bannedTags)) continue;
    }
    result.push(Number(row.id));
    usedIds.add(Number(row.id));
  }

  // fallback if DB doesn't have enough problems
  const fallback = result[0] || rows.find((row) => !tiers.length || tiers.includes(String(row.tier || '').toLowerCase()))?.id || 900001;
  while (result.length < count) result.push(fallback);

  return result;
}

async function getBattleProfile(userId) {
  const user = await getUserById(userId);
  const battle = await queryOne(
    'SELECT COALESCE(SUM(battle_score_delta), 0) AS battleScore FROM battle_results WHERE user_id = ?',
    [userId]
  );
  return {
    userId: Number(userId),
    tier: user?.tier || 'bronze',
    rating: Number(user?.rating ?? 800) || 0,
    battleScore: Number(battle?.battleScore ?? battle?.battle_score ?? 0) || 0,
  };
}

export const AlgorithmBattle = {
  calculateBattleScore,

  getBattleModes() {
    return {
      modes: Object.values(BATTLE_MODES).map((mode) => ({
        ...mode,
        availableItems: Object.values(BATTLE_ITEMS),
        availableEmotes: BATTLE_EMOTES,
      })),
      bannableTags: BANNABLE_TAGS,
    };
  },

  async expireStaleWaitingRooms({ now = Date.now() } = {}) {
    if (isConnected()) {
      const result = await run(
        `UPDATE battle_rooms
         SET status = 'finished', ended_at = NOW()
         WHERE status = 'waiting'
           AND (
             (lobby_expires_at IS NOT NULL AND lobby_expires_at < NOW())
             OR (lobby_expires_at IS NULL AND created_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE))
           )`,
        []
      );
      return Number(result?.affectedRows || 0);
    }

    const rows = await query('SELECT * FROM battle_rooms WHERE status = ?', ['waiting']);
    let expiredCount = 0;

    for (const row of rows || []) {
      const room = normalizeRoom(row);
      const createdAtMs = toTimeMs(room.createdAt);
      const explicitExpiryMs = toTimeMs(room.lobbyExpiresAt);
      const fallbackExpiryMs = createdAtMs == null ? null : createdAtMs + LOBBY_TIMEOUT_MS;
      const expiresAtMs = explicitExpiryMs ?? fallbackExpiryMs;

      if (expiresAtMs != null && now > expiresAtMs) {
        await run('UPDATE battle_rooms SET status = ?, ended_at = ? WHERE id = ?', ['finished', nowMySQL(), room.id]);
        expiredCount += 1;
      }
    }

    return expiredCount;
  },

  async createRoom({
    creatorId,
    mode = 'sort-speed',
    problemId = null,
    maxPlayers = null,
    durationSec = null,
    isPrivate = false,
    preferredLanguage = null,
    bannedTags = [],
  } = {}) {
    if (creatorId) {
      const existingActive = await queryOne(
        "SELECT id FROM battle_rooms WHERE created_by = ? AND status IN ('waiting', 'playing') LIMIT 1",
        [creatorId]
      );
      if (existingActive) {
        const err = new Error('이미 활성화된 배틀 방이 있습니다. 기존 방을 먼저 나가거나 종료해주세요.');
        err.status = 409;
        throw err;
      }
    }

    const normalizedMode = normalizeMode(mode);
    const modeConfig = getBattleModeConfig(normalizedMode);

    let resolvedProblemId = null;
    let problemIdsJson = null;

    if (problemId) {
      resolvedProblemId = Number(problemId);
      if (normalizedMode === 'territory') {
        problemIdsJson = JSON.stringify([resolvedProblemId]);
      }
    }

    const id = ROOM_PREFIX + crypto.randomBytes(5).toString('hex');
    const now = nowMySQL();
    const inviteCodeVal = isPrivate ? crypto.randomBytes(3).toString('hex').toUpperCase() : null;
    const lobbyExpiresAt = toMySQL(new Date(Date.now() + LOBBY_TIMEOUT_MS));

    const roomParams = [
      id, normalizedMode, resolvedProblemId, problemIdsJson, '{}', 'waiting',
      clampInt(maxPlayers ?? modeConfig.maxPlayers, modeConfig.maxPlayers, 2, MAX_PLAYERS),
      clampInt(durationSec ?? modeConfig.durationSec, modeConfig.durationSec, 60, 1200),
      creatorId || null, isPrivate ? 1 : 0, inviteCodeVal, preferredLanguage || null,
    ];
    if (isConnected()) {
      await insert(
        `INSERT INTO battle_rooms
           (id, mode, problem_id, problem_ids, territory_claims, status, max_players, duration_sec,
            created_by, created_at, is_private, invite_code, preferred_language, lobby_expires_at)
         VALUES (?,?,?,?,?,?,?,?,?,NOW(),?,?,?,DATE_ADD(NOW(), INTERVAL 5 MINUTE))`,
        roomParams
      );
    } else {
      await insert(
        `INSERT INTO battle_rooms
           (id, mode, problem_id, problem_ids, territory_claims, status, max_players, duration_sec,
            created_by, created_at, is_private, invite_code, preferred_language, lobby_expires_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id, normalizedMode, resolvedProblemId, problemIdsJson, '{}', 'waiting',
          clampInt(maxPlayers ?? modeConfig.maxPlayers, modeConfig.maxPlayers, 2, MAX_PLAYERS),
          clampInt(durationSec ?? modeConfig.durationSec, modeConfig.durationSec, 60, 1200),
          creatorId || null, now, isPrivate ? 1 : 0, inviteCodeVal,
          preferredLanguage || null, lobbyExpiresAt,
        ]
      );
    }
    if (creatorId) await this.joinRoom(id, creatorId);
    await this.recordEvent(id, creatorId || null, 'room.config', { mode: normalizedMode, bannedTags, deferredProblemSelection: !problemId });
    return this.getRoomState(id);
  },

  async listRooms({ status = null, limit = 20 } = {}) {
    await this.expireStaleWaitingRooms();

    const cap = Math.min(50, Math.max(1, Number(limit) || 20));
    const params = [];
    let sql = 'SELECT * FROM battle_rooms WHERE COALESCE(is_private, 0) = 0';
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    } else {
      sql += ' AND status = ?';
      params.push('waiting');
    }
    sql += ` ORDER BY created_at DESC LIMIT ${cap}`;
    const rooms = (await query(sql, params)).map(normalizeRoom);
    return Promise.all(rooms.map((room) => this.getRoomState(room.id)));
  },

  async getRoom(roomId) {
    const row = await queryOne('SELECT * FROM battle_rooms WHERE id = ?', [roomId]);
    return normalizeRoom(row);
  },

  async getParticipants(roomId) {
    const rows = await query(
      'SELECT * FROM battle_participants WHERE room_id = ? ORDER BY score DESC, joined_at ASC',
      [roomId]
    );
    return Promise.all((rows || []).map(async (row) => normalizeParticipant(row, await getUserById(row.user_id))));
  },

  async getEvents(roomId, { limit = 60 } = {}) {
    const cap = Math.min(200, Math.max(1, Number(limit) || 60));
    const rows = await query(
      `SELECT * FROM battle_events WHERE room_id = ? ORDER BY created_at DESC LIMIT ${cap}`,
      [roomId]
    );
    return (rows || []).map(normalizeEvent).reverse();
  },

  async getLatestSubmissions(roomId, { limit = 20 } = {}) {
    const cap = Math.min(100, Math.max(1, Number(limit) || 20));
    const rows = await query(
      `SELECT * FROM battle_submissions WHERE room_id = ? ORDER BY created_at DESC LIMIT ${cap}`,
      [roomId]
    );
    return (rows || []).map(normalizeSubmission);
  },

  async getRoomState(roomId) {
    const room = await this.getRoom(roomId);
    if (!room) return null;

    let problemFetches;
    if (room.mode === 'territory' && Array.isArray(room.problemIds) && room.problemIds.length > 0) {
      problemFetches = room.problemIds.map((id) => getProblemById(id));
    } else {
      problemFetches = [getProblemById(room.problemId)];
    }

    const [participants, events, submissions, ...problemResults] = await Promise.all([
      this.getParticipants(roomId),
      this.getEvents(roomId),
      this.getLatestSubmissions(roomId),
      ...problemFetches,
    ]);

    const formatProblem = (p) => p ? {
      id: p.id, title: p.title, tier: p.tier, difficulty: p.difficulty,
      desc: p.desc, inputDesc: p.inputDesc, outputDesc: p.outputDesc,
      tags: p.tags || [], examples: p.examples || [],
      timeLimit: p.timeLimit, memLimit: p.memLimit,
    } : null;

    const problem = formatProblem(problemResults[0]);
    const problems = room.mode === 'territory'
      ? problemResults.map(formatProblem).filter(Boolean)
      : null;

    return {
      room,
      participants,
      config: getRoomConfig(room, events),
      activityByUserId: getActivityByUserId(participants, events),
      events,
      submissions,
      problem,
      problems,
    };
  },

  async joinRoom(roomId, userId) {
    const room = await this.getRoom(roomId);
    if (!room) return null;
    if (room.status === 'finished') {
      const err = new Error('이미 종료된 배틀입니다.');
      err.status = 400;
      throw err;
    }
    const existing = await queryOne('SELECT * FROM battle_participants WHERE room_id = ? AND user_id = ?', [roomId, userId]);
    if (existing) return this.getRoomState(roomId);
    if (room.status !== 'waiting') {
      const err = new Error('이미 시작된 배틀입니다.');
      err.status = 400;
      throw err;
    }

    const participants = await this.getParticipants(roomId);
    if (participants.length >= room.maxPlayers) {
      const err = new Error('방 정원이 가득 찼습니다.');
      err.status = 409;
      throw err;
    }
    const now = nowMySQL();
    await insert(
      `INSERT INTO battle_participants (room_id, user_id, character_hp, attack_power, speed, score, is_ready, joined_at, last_seen_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [roomId, userId, 100, 10, 10, 0, 0, now, now]
    );
    await this.recordEvent(roomId, userId, 'player.joined', {});
    return this.getRoomState(roomId);
  },

  async joinByCode(inviteCode, userId) {
    const row = await queryOne(
      "SELECT * FROM battle_rooms WHERE invite_code = ? AND status = 'waiting'",
      [String(inviteCode).toUpperCase()]
    );
    if (!row) {
      const err = new Error('유효하지 않은 초대 코드이거나 이미 시작된 방입니다.');
      err.status = 404;
      throw err;
    }
    return this.joinRoom(row.id, userId);
  },

  async markReady(roomId, userId) {
    const room = await this.getRoom(roomId);
    if (!room) return null;
    if (room.status !== 'waiting') return this.getRoomState(roomId);
    const participant = await queryOne('SELECT * FROM battle_participants WHERE room_id = ? AND user_id = ?', [roomId, userId]);
    if (!participant) {
      const err = new Error('방 참가자만 준비할 수 있습니다.');
      err.status = 403;
      throw err;
    }
    await run('UPDATE battle_participants SET is_ready = ?, last_seen_at = ? WHERE room_id = ? AND user_id = ?', [1, nowMySQL(), roomId, userId]);
    await this.recordEvent(roomId, userId, 'player.ready', {});
    const participants = await this.getParticipants(roomId);
    if (participants.length >= 2 && participants.every((p) => p.isReady)) {
      await this.startRoom(roomId);
    }
    return this.getRoomState(roomId);
  },

  async ensureRoomProblems(roomId, room = null) {
    const currentRoom = room || await this.getRoom(roomId);
    if (!currentRoom) return null;
    const problemCount = BATTLE_MODES[currentRoom.mode]?.problemCount || 1;
    const hasSelectedProblem = currentRoom.mode === 'territory'
      ? Array.isArray(currentRoom.problemIds) && currentRoom.problemIds.length >= problemCount
      : Boolean(currentRoom.problemId);
    if (hasSelectedProblem) return currentRoom;

    const participants = await this.getParticipants(roomId);
    const profiles = await Promise.all(participants.map((player) => getBattleProfile(player.userId)));
    const events = await this.getEvents(roomId);
    const configEvent = [...(events || [])].reverse().find((event) => event.type === 'room.config');
    const bannedTags = Array.isArray(configEvent?.payload?.bannedTags) ? configEvent.payload.bannedTags : [];
    const range = resolveBattleProblemRange(profiles, currentRoom);
    const ids = await findProblemIds(problemCount, { ...range, bannedTags });
    const primaryProblemId = ids[0] || null;
    const problemIdsJson = currentRoom.mode === 'territory' ? JSON.stringify(ids) : null;

    await run(
      'UPDATE battle_rooms SET problem_id = ?, problem_ids = ? WHERE id = ?',
      [primaryProblemId, problemIdsJson, roomId]
    );
    await this.recordEvent(roomId, null, 'room.problem_selected', {
      problemIds: ids,
      tiers: range.tiers,
      minDifficulty: range.minDifficulty,
      maxDifficulty: range.maxDifficulty,
    });

    return this.getRoom(roomId);
  },

  async startRoom(roomId) {
    const room = await this.getRoom(roomId);
    if (!room || room.status !== 'waiting') return room;
    const participants = await this.getParticipants(roomId);
    if (participants.length < 2) {
      const err = new Error('상대가 들어온 뒤 시작할 수 있습니다.');
      err.status = 400;
      throw err;
    }
    await this.ensureRoomProblems(roomId, room);
    await run('UPDATE battle_rooms SET status = ?, started_at = ? WHERE id = ?', ['playing', nowMySQL(), roomId]);
    await this.recordEvent(roomId, null, 'room.started', {});
    return this.getRoom(roomId);
  },

  async claimTerritory(roomId, userId, problemId, room) {
    const claims = { ...(room.territoryClaims || {}) };
    const key = String(problemId);
    if (claims[key] != null) return false; // already claimed

    claims[key] = Number(userId);
    await run('UPDATE battle_rooms SET territory_claims = ? WHERE id = ?', [JSON.stringify(claims), roomId]);
    await this.recordEvent(roomId, userId, 'territory.claimed', { problemId: Number(problemId) });

    // Update score to claim count
    const myClaimCount = Object.values(claims).filter((uid) => uid === Number(userId)).length;
    await run(
      'UPDATE battle_participants SET score = ?, last_seen_at = ? WHERE room_id = ? AND user_id = ?',
      [myClaimCount * 100, nowMySQL(), roomId, userId]
    );

    // All claimed? finish room
    const problemIds = room.problemIds || [];
    if (problemIds.length > 0 && Object.keys(claims).length >= problemIds.length) {
      await this.finishRoom(roomId, { reason: 'all_claimed' });
    }

    return true;
  },

  async recordSubmission({ roomId, userId, code, language, judgeResult, problemId = null }) {
    const room = await this.getRoom(roomId);
    if (!room) return null;
    if (room.status !== 'playing') {
      const err = new Error('진행 중인 배틀이 아닙니다.');
      err.status = 400;
      throw err;
    }
    const participant = await queryOne('SELECT * FROM battle_participants WHERE room_id = ? AND user_id = ?', [roomId, userId]);
    if (!participant) {
      const err = new Error('방 참가자만 제출할 수 있습니다.');
      err.status = 403;
      throw err;
    }

    const startedAt = room.startedAt ? new Date(room.startedAt).getTime() : Date.now();
    const elapsedSec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    const isCorrect = judgeResult?.result === 'correct';
    const executionTimeMs = Number.isFinite(Number(judgeResult?.timeMs)) ? Number(judgeResult.timeMs) : null;
    const memoryMb = Number.isFinite(Number(judgeResult?.memoryMb)) ? Number(judgeResult.memoryMb) : null;
    const scoring = calculateBattleScore({ isCorrect, executionTimeMs, memoryMb, elapsedSec });

    // Store submission with optional problemId for territory mode
    const effectiveProblemId = room.mode === 'territory' && problemId ? Number(problemId) : room.problemId;
    await insert(
      `INSERT INTO battle_submissions (room_id, user_id, code, language, is_correct, execution_time_ms, memory_mb, score, detail, problem_id, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [roomId, userId, code || '', language || '', isCorrect ? 1 : 0, executionTimeMs, memoryMb, scoring.score, judgeResult?.detail || '', effectiveProblemId || null, nowMySQL()]
    );

    if (room.mode === 'territory') {
      // Territory: claiming beats combat
      if (isCorrect && effectiveProblemId) {
        await this.claimTerritory(roomId, userId, effectiveProblemId, room);
      }
      await this.recordEvent(roomId, userId, isCorrect ? 'player.attack' : 'player.miss', {
        score: scoring.score, problemId: effectiveProblemId, executionTimeMs, detail: judgeResult?.detail || '',
      });
      return this.getRoomState(roomId);
    }

    // Speed mode: first correct answer wins immediately
    if (room.mode === 'sort-speed' && isCorrect) {
      await run(
        'UPDATE battle_participants SET score = ?, attack_power = ?, speed = ?, last_seen_at = ? WHERE room_id = ? AND user_id = ?',
        [scoring.score, scoring.attackPower, scoring.speed, nowMySQL(), roomId, userId]
      );
      await this.recordEvent(roomId, userId, 'player.attack', { score: scoring.score, damage: 0, executionTimeMs, detail: judgeResult?.detail || '' });
      await this.finishRoom(roomId, { reason: 'speed_win' });
      return this.getRoomState(roomId);
    }

    // Standard combat mode (survival, duel-effects, chaos-items)
    const nextScore = Math.max(0, Number(participant.score || 0) + scoring.score);
    const nextAttack = isCorrect ? scoring.attackPower : Number(participant.attack_power || 10);
    const nextSpeed = isCorrect ? scoring.speed : Math.max(5, Number(participant.speed || 10) - 2);
    await run(
      'UPDATE battle_participants SET score = ?, attack_power = ?, speed = ?, last_seen_at = ? WHERE room_id = ? AND user_id = ?',
      [nextScore, nextAttack, nextSpeed, nowMySQL(), roomId, userId]
    );

    const participants = await this.getParticipants(roomId);
    const targets = participants.filter((p) => p.userId !== Number(userId));
    const damage = isCorrect ? Math.max(5, Math.min(45, scoring.attackPower)) : 0;
    for (const target of targets) {
      await run(
        'UPDATE battle_participants SET character_hp = ? WHERE room_id = ? AND user_id = ?',
        [Math.max(0, target.characterHp - damage), roomId, target.userId]
      );
    }

    await this.recordEvent(roomId, userId, isCorrect ? 'player.attack' : 'player.miss', {
      score: scoring.score, damage, executionTimeMs, detail: judgeResult?.detail || '',
    });

    if (isCorrect) {
      const config = getRoomConfig(room, []);
      if (config.effectsEnabled) await this.applyProblemEffect(roomId, userId, room);
    }

    const updatedState = await this.getRoomState(roomId);
    const othersAlive = updatedState.participants.filter((p) => p.userId !== Number(userId) && p.characterHp > 0);
    if (isCorrect && updatedState.participants.length >= 2 && othersAlive.length === 0) {
      await this.finishRoom(roomId, { reason: 'knockout' });
      return this.getRoomState(roomId);
    }
    return updatedState;
  },

  async requireParticipant(roomId, userId, { allowWaiting = true } = {}) {
    const room = await this.getRoom(roomId);
    if (!room) { const err = new Error('방을 찾을 수 없습니다.'); err.status = 404; throw err; }
    if (room.status === 'finished') { const err = new Error('이미 종료된 배틀입니다.'); err.status = 400; throw err; }
    if (!allowWaiting && room.status !== 'playing') { const err = new Error('진행 중인 배틀이 아닙니다.'); err.status = 400; throw err; }
    const participant = await queryOne('SELECT * FROM battle_participants WHERE room_id = ? AND user_id = ?', [roomId, userId]);
    if (!participant) { const err = new Error('방 참가자만 사용할 수 있습니다.'); err.status = 403; throw err; }
    return { room, participant };
  },

  async recordActivity(roomId, userId, { activity = '집중 중', message = '' } = {}) {
    await this.requireParticipant(roomId, userId);
    const event = await this.recordEvent(roomId, userId, 'player.activity', {
      activity: sanitizeText(activity, 40) || '집중 중',
      message: sanitizeText(message, 80),
    });
    await run('UPDATE battle_participants SET last_seen_at = ? WHERE room_id = ? AND user_id = ?', [nowMySQL(), roomId, userId]);
    return { event, state: await this.getRoomState(roomId) };
  },

  async recordChat(roomId, userId, { message = '' } = {}) {
    const { room } = await this.requireParticipant(roomId, userId);
    const config = getRoomConfig(room);
    if (!config.chatEnabled) { const err = new Error('이 모드에서는 채팅을 사용할 수 없습니다.'); err.status = 400; throw err; }
    const text = sanitizeText(message, 220);
    if (!text) { const err = new Error('메시지가 비어 있습니다.'); err.status = 400; throw err; }
    const event = await this.recordEvent(roomId, userId, 'player.chat', { message: text });
    return { event, state: await this.getRoomState(roomId) };
  },

  async recordEmote(roomId, userId, { emote = '' } = {}) {
    const { room } = await this.requireParticipant(roomId, userId);
    const config = getRoomConfig(room);
    if (!config.emotesEnabled) { const err = new Error('이 모드에서는 이모트를 사용할 수 없습니다.'); err.status = 400; throw err; }
    const normalized = sanitizeText(emote, 20).toLowerCase();
    if (!BATTLE_EMOTES.includes(normalized)) { const err = new Error('지원하지 않는 이모트입니다.'); err.status = 400; throw err; }
    const event = await this.recordEvent(roomId, userId, 'player.emote', { emote: normalized });
    return { event, state: await this.getRoomState(roomId) };
  },

  async useItem(roomId, userId, { itemType = '' } = {}) {
    const { room, participant } = await this.requireParticipant(roomId, userId, { allowWaiting: false });
    const config = getRoomConfig(room);
    if (!config.itemsEnabled) { const err = new Error('이 모드에서는 아이템을 사용할 수 없습니다.'); err.status = 400; throw err; }
    const item = BATTLE_ITEMS[sanitizeText(itemType, 30)];
    if (!item) { const err = new Error('지원하지 않는 아이템입니다.'); err.status = 400; throw err; }

    const cooldownMs = Number(config.itemCooldownSec || 20) * 1000;
    const state = await this.getRoomState(roomId);
    const recentItem = [...(state.events || [])].reverse().find((e) => e.userId === Number(userId) && e.type === 'item.used');
    if (recentItem?.createdAt && Date.now() - new Date(recentItem.createdAt).getTime() < cooldownMs) {
      const err = new Error('아이템 쿨다운 중입니다.'); err.status = 429; throw err;
    }

    const opponents = state.participants.filter((p) => p.userId !== Number(userId));
    const payload = { itemType: item.key, itemLabel: item.label, targetUserIds: [], stat: null };

    if (item.key === 'shield') {
      await run('UPDATE battle_participants SET character_hp = ? WHERE room_id = ? AND user_id = ?',
        [Math.min(120, Number(participant.character_hp || 100) + 14), roomId, userId]);
      payload.targetUserIds = [Number(userId)];
      payload.stat = { hpDelta: 14 };
    } else if (item.key === 'power-up') {
      await run('UPDATE battle_participants SET attack_power = ? WHERE room_id = ? AND user_id = ?',
        [Math.min(80, Number(participant.attack_power || 10) + 6), roomId, userId]);
      payload.targetUserIds = [Number(userId)];
      payload.stat = { attackDelta: 6 };
    } else if (item.key === 'lag-spike') {
      for (const target of opponents) {
        await run('UPDATE battle_participants SET speed = ? WHERE room_id = ? AND user_id = ?',
          [Math.max(4, Number(target.speed || 10) - 5), roomId, target.userId]);
      }
      payload.targetUserIds = opponents.map((t) => t.userId);
      payload.stat = { speedDelta: -5 };
    } else if (item.key === 'breakpoint') {
      for (const target of opponents) {
        await run('UPDATE battle_participants SET attack_power = ? WHERE room_id = ? AND user_id = ?',
          [Math.max(4, Number(target.attackPower || 10) - 5), roomId, target.userId]);
      }
      payload.targetUserIds = opponents.map((t) => t.userId);
      payload.stat = { attackDelta: -5 };
    }

    const event = await this.recordEvent(roomId, userId, 'item.used', payload);
    return { event, state: await this.getRoomState(roomId) };
  },

  async applyProblemEffect(roomId, userId, room) {
    const state = await this.getRoomState(roomId);
    const problem = await getProblemById(room.problemId);
    const effect = inferProblemEffect(problem);
    const self = state.participants.find((p) => p.userId === Number(userId));
    const opponents = state.participants.filter((p) => p.userId !== Number(userId));
    if (!self) return null;

    const payload = { effect: effect.key, effectLabel: effect.label, target: effect.target, targetUserIds: [], description: effect.description };

    if (effect.key === 'snare') {
      for (const target of opponents) {
        await run('UPDATE battle_participants SET speed = ? WHERE room_id = ? AND user_id = ?',
          [Math.max(4, Number(target.speed || 10) - 4), roomId, target.userId]);
      }
      payload.targetUserIds = opponents.map((t) => t.userId);
      payload.stat = { speedDelta: -4 };
    } else if (effect.key === 'shield') {
      await run('UPDATE battle_participants SET character_hp = ? WHERE room_id = ? AND user_id = ?',
        [Math.min(120, Number(self.characterHp || 100) + 12), roomId, userId]);
      payload.targetUserIds = [Number(userId)];
      payload.stat = { hpDelta: 12 };
    } else if (effect.key === 'haste') {
      await run('UPDATE battle_participants SET speed = ?, attack_power = ? WHERE room_id = ? AND user_id = ?',
        [Math.min(80, Number(self.speed || 10) + 5), Math.min(80, Number(self.attackPower || 10) + 2), roomId, userId]);
      payload.targetUserIds = [Number(userId)];
      payload.stat = { speedDelta: 5, attackDelta: 2 };
    } else {
      await run('UPDATE battle_participants SET attack_power = ? WHERE room_id = ? AND user_id = ?',
        [Math.min(80, Number(self.attackPower || 10) + 6), roomId, userId]);
      payload.targetUserIds = [Number(userId)];
      payload.stat = { attackDelta: 6 };
    }

    return this.recordEvent(roomId, userId, 'problem.effect', payload);
  },

  async recordEvent(roomId, userId, type, payload = {}) {
    const id = await insert(
      'INSERT INTO battle_events (room_id, user_id, event_type, payload_json, created_at) VALUES (?,?,?,?,?)',
      [roomId, userId || null, type, JSON.stringify(payload || {}), nowMySQL()]
    );
    const row = await queryOne('SELECT * FROM battle_events WHERE id = ?', [id]);
    return normalizeEvent(row);
  },

  async leaveRoom(roomId, userId) {
    const room = await this.getRoom(roomId);
    if (!room) return null;
    if (room.status === 'waiting') {
      await run('DELETE FROM battle_participants WHERE room_id = ? AND user_id = ?', [roomId, userId]);
      await this.recordEvent(roomId, userId, 'player.left', {});
      const participants = await this.getParticipants(roomId);
      if (participants.length === 0) {
        await run('UPDATE battle_rooms SET status = ?, ended_at = ? WHERE id = ?', ['finished', nowMySQL(), roomId]);
      }
      return this.getRoomState(roomId);
    }
    await this.recordEvent(roomId, userId, 'player.disconnected', {});
    return this.getRoomState(roomId);
  },

  async finishRoom(roomId, { reason = 'timeout' } = {}) {
    const room = await this.getRoom(roomId);
    if (!room) return null;
    if (room.status !== 'finished') {
      await run('UPDATE battle_rooms SET status = ?, ended_at = ? WHERE id = ?', ['finished', nowMySQL(), roomId]);
      await this.recordEvent(roomId, null, 'room.finished', { reason });
    }

    const participants = await this.getParticipants(roomId);
    if (participants.length < 2) {
      return this.getRoomState(roomId);
    }

    const sorted = [...participants].sort((a, b) => b.score - a.score || b.characterHp - a.characterHp);
    const topScore = sorted[0]?.score ?? 0;
    const topCount = sorted.filter((p) => p.score === topScore).length;
    for (let i = 0; i < sorted.length; i += 1) {
      const player = sorted[i];
      const result = topCount > 1 ? 'draw' : i === 0 ? 'win' : 'lose';
      const delta = result === 'win' ? 25 : result === 'draw' ? 5 : -10;
      const existing = await queryOne('SELECT id FROM battle_results WHERE room_id = ? AND user_id = ?', [roomId, player.userId]);
      if (!existing) {
        await insert(
          'INSERT INTO battle_results (room_id, user_id, rank_no, score, result, battle_score_delta, created_at) VALUES (?,?,?,?,?,?,?)',
          [roomId, player.userId, i + 1, player.score, result, delta, nowMySQL()]
        );
      }
    }
    return this.getRoomState(roomId);
  },

  async ensureNotExpired(roomId) {
    const state = await this.getRoomState(roomId);
    if (!state?.room) return state;

    // Lobby timeout — use lobby_expires_at when available, fall back to 5-min rule
    if (state.room.status === 'waiting') {
      if (isConnected()) {
        await run(
          `UPDATE battle_rooms
           SET status = 'finished', ended_at = NOW()
           WHERE id = ?
             AND status = 'waiting'
             AND (
               (lobby_expires_at IS NOT NULL AND lobby_expires_at < NOW())
               OR (lobby_expires_at IS NULL AND created_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE))
             )`,
          [roomId]
        );
        return this.getRoomState(roomId);
      }
      if (state.room.lobbyExpiresAt && Date.now() > new Date(state.room.lobbyExpiresAt).getTime()) {
        await run('UPDATE battle_rooms SET status = ?, ended_at = ? WHERE id = ?', ['finished', nowMySQL(), roomId]);
        return this.getRoomState(roomId);
      }
    }

    // Game timeout
    if (state.room.status !== 'playing' || !state.room.startedAt) return state;
    const elapsedSec = Math.floor((Date.now() - new Date(state.room.startedAt).getTime()) / 1000);
    if (elapsedSec >= state.room.durationSec) {
      return this.finishRoom(roomId, { reason: 'timeout' });
    }
    return state;
  },
};
