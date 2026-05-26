import crypto from 'crypto';
import { insert, isConnected, query, queryOne, run } from '../config/mysql.js';
import { nowMySQL, toMySQL } from '../config/dateutil.js';
import { BattleMode } from './BattleMode.js';

const ROOM_PREFIX = 'algo_';
const DEFAULT_DURATION_SEC = 300;
const DEFAULT_MAX_PLAYERS = 2;
const MAX_PLAYERS = 6;
const LOBBY_TIMEOUT_MS = 5 * 60 * 1000;
const DRAFT_BAN_TIER_LIMIT = 1;
const DRAFT_BAN_TAG_LIMIT = 2;
const DRAFT_PICK_TAG_LIMIT = 1;

const BATTLE_MODES = {
  'sort-speed': {
    key: 'sort-speed',
    title: '⚡ Speed Race',
    description: 'The first player to submit a correct answer wins — pure speed.',
    winCondition: 'first-correct',
    rules: ['Both players solve the same problem simultaneously', 'The first player to submit a correct answer wins immediately', 'If neither solves it in time, scores are compared'],
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
    title: '💀 Survival',
    description: 'Reduce your opponent\'s HP to 0 to win! Each correct answer increases your attack power.',
    winCondition: 'hp-knockout',
    rules: ['Both players solve the same problem simultaneously', 'Correct answer → opponent HP decreases', 'Wrong answer → your speed decreases', 'Win immediately when opponent HP reaches 0', 'Player with more HP wins when time runs out'],
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
    title: '✨ Effects Duel',
    description: 'Submitting a correct answer triggers buffs/debuffs based on problem tags! Comeback possible with HP battle + random effects.',
    winCondition: 'hp-knockout',
    rules: ['Same HP battle basic rules apply', 'Correct answer triggers problem effect (buff/debuff)', 'Items available (cooldown 20s)', 'Effects can reverse the outcome via HP recovery and attack boost'],
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
    title: '🎒 Item Brawl',
    description: 'HP battle where fast-cooldown items keep opponents off balance! Item strategy decides victory.',
    winCondition: 'hp-knockout',
    rules: ['Same HP battle basic rules apply', 'Item cooldown 12s (faster than Effects Duel)', 'Shield and attack items strongly recommended', 'Disadvantaged without items'],
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
    title: '🏴 Territory Conquest',
    description: '5 problems revealed simultaneously! Solve first to claim territory. The player who conquers the most zones wins.',
    winCondition: 'territory',
    rules: ['5 problems are revealed at the same time', 'Correct answer → claim that problem\'s zone', 'Claim all 5 zones to win immediately', 'Player with most zones claimed wins when time runs out'],
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
  'draft-ban': {
    key: 'draft-ban',
    title: '🚫 Draft Ban',
    description: 'A strategic 1v1 where both players ban tiers/tags after the game starts, and the problem is determined by the draft result.',
    winCondition: 'hp-knockout',
    rules: ['No problem conditions set at room creation', 'Draft phase begins after both players are ready', 'Each player submits tier/tag bans and preferred tag picks', 'Problem is finalized from draft result; correct answer → opponent HP decreases + problem effect triggers'],
    maxPlayers: 2,
    durationSec: 600,
    itemsEnabled: true,
    effectsEnabled: true,
    chatEnabled: true,
    emotesEnabled: true,
    activityEnabled: true,
    itemCooldownSec: 18,
    problemCount: 1,
    draftEnabled: true,
  },
};

const BATTLE_ITEMS = {
  'lag-spike': { key: 'lag-spike', label: 'Lag Spike', description: 'Temporarily reduces opponent\'s speed.' },
  shield: { key: 'shield', label: 'Shield', description: 'Restores your HP.' },
  'power-up': { key: 'power-up', label: 'Power Up', description: 'Increases your attack power.' },
  breakpoint: { key: 'breakpoint', label: 'Breakpoint', description: 'Reduces opponent\'s attack power.' },
};

const BATTLE_EMOTES = ['gg', 'nice', 'oops', 'focus', 'taunt'];
const BANNABLE_TAGS = [
  '입출력', '구현', '수학', '문자열', '정렬',
  '자료 구조', '해시', '스택', '큐', '우선순위 큐',
  '그리디', '이분 탐색', '투 포인터', '누적 합', '다이나믹 프로그래밍', 'DP',
  '그래프 이론', '그래프', 'BFS', 'DFS', '최단 경로', '트리',
  '백트래킹', '비트마스크', '분리 집합',
];
const PROBLEM_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function toIsoLike(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const s = String(value);
  // MySQL DATETIME "YYYY-MM-DD HH:MM:SS" has no timezone marker — always treat as UTC
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return s.replace(' ', 'T') + 'Z';
  return s;
}

function toTimeMs(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function isActivelyPlayingRoom(room, now = Date.now()) {
  if (!room || room.status !== 'playing') return false;
  if (!room.startedAt) return true;
  const startedAtMs = toTimeMs(room.startedAt);
  if (startedAtMs == null) return true;
  return now < startedAtMs + room.durationSec * 1000;
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

function getWorkshopOverrides(workshopMode) {
  const config = workshopMode?.config || null;
  if (!config) return {};
  return {
    workshopMode: {
      id: workshopMode.id,
      name: workshopMode.name,
      description: workshopMode.description,
      authorId: workshopMode.authorId,
      config,
    },
    workshopModeId: workshopMode.id,
    workshopRules: config.rules || [],
    baseHp: config.baseHp || 100,
    durationSec: config.timeLimit || undefined,
    itemsEnabled: Boolean(config.allowItems),
  };
}

function getRoomConfig(room, events = []) {
  const configEvent = [...(events || [])].reverse().find((event) => event.type === 'room.config');
  const draftCompletedEvent = [...(events || [])].reverse().find((event) => event.type === 'draft.completed');
  const baseFilters = configEvent?.payload?.problemFilters || {};
  const completedFilters = draftCompletedEvent?.payload?.problemFilters || null;
  const problemFilters = sanitizeProblemFilters(completedFilters || {
    ...baseFilters,
    bannedTags: baseFilters?.bannedTags || configEvent?.payload?.bannedTags || [],
  });
  return getBattleModeConfig(room?.mode || 'sort-speed', {
    bannedTags: problemFilters.bannedTags,
    problemFilters,
    ...getWorkshopOverrides(configEvent?.payload?.workshopMode),
  });
}

function getEffectiveProblemFilters(events = []) {
  const configEvent = [...(events || [])].reverse().find((event) => event.type === 'room.config');
  const draftCompletedEvent = [...(events || [])].reverse().find((event) => event.type === 'draft.completed');
  if (draftCompletedEvent?.payload?.problemFilters) {
    return sanitizeProblemFilters(draftCompletedEvent.payload.problemFilters);
  }
  return sanitizeProblemFilters({
    ...(configEvent?.payload?.problemFilters || {}),
    bannedTags: configEvent?.payload?.problemFilters?.bannedTags || configEvent?.payload?.bannedTags || [],
  });
}

function getLatestDraftSelections(participants = [], events = []) {
  const participantIds = new Set(participants.map((player) => Number(player.userId)));
  const byUserId = new Map();
  for (const event of events || []) {
    if (event.type !== 'draft.selection' || !participantIds.has(Number(event.userId))) continue;
    byUserId.set(Number(event.userId), {
      userId: Number(event.userId),
      bannedTiers: normalizeTierList(event.payload?.bannedTiers).slice(0, DRAFT_BAN_TIER_LIMIT),
      bannedTags: normalizeTagList(event.payload?.bannedTags, DRAFT_BAN_TAG_LIMIT),
      pickedTags: normalizeTagList(event.payload?.pickedTags, DRAFT_PICK_TAG_LIMIT),
      createdAt: event.createdAt,
    });
  }
  return [...byUserId.values()];
}

function buildProblemFiltersFromDraftSelections(selections = []) {
  const bannedTiers = [];
  const bannedTags = [];
  const requiredTags = [];
  for (const selection of selections) {
    bannedTiers.push(...(selection.bannedTiers || []));
    bannedTags.push(...(selection.bannedTags || []));
    requiredTags.push(...(selection.pickedTags || []));
  }
  return sanitizeProblemFilters({
    tierMode: 'auto',
    bannedTiers,
    bannedTags,
    requiredTags,
  });
}

function buildDraftState(room, participants = [], events = []) {
  if (room?.mode !== 'draft-ban') return null;
  const draftStarted = events.some((event) => event.type === 'draft.started');
  const draftCompleted = [...(events || [])].reverse().find((event) => event.type === 'draft.completed');
  const selections = getLatestDraftSelections(participants, events);
  const requiredCount = Math.max(2, participants.length || 2);
  const submittedCount = selections.length;
  const everyoneReady = participants.length >= 2 && participants.every((player) => player.isReady);
  const phase = room.status === 'playing' || draftCompleted
    ? 'completed'
    : draftStarted
      ? 'active'
      : everyoneReady
        ? 'active'
        : 'waiting';
  return {
    phase,
    requiredCount,
    submittedCount,
    isComplete: Boolean(draftCompleted),
    selections,
    problemFilters: draftCompleted?.payload?.problemFilters || null,
  };
}

function getActivityByUserId(participants = [], events = []) {
  const participantIds = new Set(participants.map((p) => Number(p.userId)));
  const activityTypes = new Set(['player.activity', 'player.chat', 'player.emote', 'item.used', 'problem.effect', 'player.ready']);
  const activity = {};
  for (const event of events || []) {
    if (!event.userId || !participantIds.has(Number(event.userId)) || !activityTypes.has(event.type)) continue;
    const label =
      event.type === 'player.chat' ? 'Chatting' :
      event.type === 'player.emote' ? 'Emote used' :
      event.type === 'item.used' ? 'Item used' :
      event.type === 'problem.effect' ? 'Problem effect triggered' :
      event.type === 'player.ready' ? 'Ready' :
      event.payload?.activity || 'Focusing';
    activity[String(event.userId)] = {
      userId: Number(event.userId),
      label,
      message: sanitizeText(event.payload?.message || event.payload?.emote || event.payload?.itemLabel || '', 80),
      createdAt: event.createdAt,
    };
  }
  return activity;
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

function normalizeTagList(value, max = 12) {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  const result = [];
  for (const raw of source) {
    const tag = sanitizeText(raw, 40);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
    if (result.length >= max) break;
  }
  return result;
}

function normalizeTierList(value) {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  const result = [];
  for (const raw of source) {
    const tier = String(raw || '').toLowerCase();
    if (!PROBLEM_TIERS.includes(tier) || seen.has(tier)) continue;
    seen.add(tier);
    result.push(tier);
  }
  return result;
}

export function sanitizeProblemFilters(value = {}) {
  const tierMode = ['auto', 'min', 'max', 'range', 'only'].includes(value?.tierMode) ? value.tierMode : 'auto';
  const minTier = PROBLEM_TIERS.includes(String(value?.minTier || '').toLowerCase()) ? String(value.minTier).toLowerCase() : null;
  const maxTier = PROBLEM_TIERS.includes(String(value?.maxTier || '').toLowerCase()) ? String(value.maxTier).toLowerCase() : null;
  return {
    tierMode,
    minTier,
    maxTier,
    allowedTiers: normalizeTierList(value?.allowedTiers),
    bannedTiers: normalizeTierList(value?.bannedTiers),
    requiredTags: normalizeTagList(value?.requiredTags, 8),
    bannedTags: normalizeTagList(value?.bannedTags, 12),
  };
}

export function resolveBattleProblemFilters(baseRange, rawFilters = {}) {
  const filters = sanitizeProblemFilters(rawFilters);
  let tiers = Array.isArray(baseRange?.tiers) && baseRange.tiers.length > 0
    ? baseRange.tiers.filter((tier) => PROBLEM_TIERS.includes(tier))
    : [...PROBLEM_TIERS];

  if (filters.tierMode === 'min' && filters.minTier) {
    tiers = PROBLEM_TIERS.slice(PROBLEM_TIERS.indexOf(filters.minTier));
  } else if (filters.tierMode === 'max' && filters.maxTier) {
    tiers = PROBLEM_TIERS.slice(0, PROBLEM_TIERS.indexOf(filters.maxTier) + 1);
  } else if (filters.tierMode === 'range' && filters.minTier && filters.maxTier) {
    const start = Math.min(PROBLEM_TIERS.indexOf(filters.minTier), PROBLEM_TIERS.indexOf(filters.maxTier));
    const end = Math.max(PROBLEM_TIERS.indexOf(filters.minTier), PROBLEM_TIERS.indexOf(filters.maxTier));
    tiers = PROBLEM_TIERS.slice(start, end + 1);
  } else if (filters.tierMode === 'only' && filters.allowedTiers.length > 0) {
    tiers = filters.allowedTiers;
  }

  const banned = new Set(filters.bannedTiers);
  tiers = tiers.filter((tier) => !banned.has(tier));
  if (tiers.length === 0) tiers = Array.isArray(baseRange?.tiers) && baseRange.tiers.length > 0 ? baseRange.tiers : ['bronze'];

  return {
    tiers,
    minDifficulty: baseRange?.minDifficulty || 1,
    maxDifficulty: baseRange?.maxDifficulty || 9,
    bannedTags: filters.bannedTags,
    bannedTiers: filters.bannedTiers,
    requiredTags: filters.requiredTags,
    problemFilters: filters,
  };
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
    return { key: 'snare', label: 'Path Block', target: 'opponents', description: 'Reduces opponent\'s speed.' };
  }
  if (/dp|dynamic|다이나믹|동적/.test(tags)) {
    return { key: 'shield', label: 'Memoization Shield', target: 'self', description: 'Restores your HP.' };
  }
  if (/정렬|sort|수학|math/.test(tags)) {
    return { key: 'haste', label: 'Sort Acceleration', target: 'self', description: 'Increases your speed and attack power.' };
  }
  return { key: 'precision', label: 'Precision Strike', target: 'self', description: 'Increases your attack power.' };
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

async function findProblemIds(count = 1, {
  bannedTags = [],
  bannedTiers = [],
  requiredTags = [],
  tiers = PROBLEM_TIERS,
  minDifficulty = 1,
  maxDifficulty = 9,
} = {}) {
  const limit = Math.max(count * 20, 200);
  const normalizedTiers = (tiers || []).map((tier) => String(tier || '').toLowerCase()).filter(Boolean);
  const normalizedBannedTags = (bannedTags || []).map((tag) => String(tag || '').toLowerCase()).filter(Boolean);
  const normalizedBannedTiers = (bannedTiers || []).map((tier) => String(tier || '').toLowerCase()).filter(Boolean);
  const normalizedRequiredTags = (requiredTags || []).map((tag) => String(tag || '').toLowerCase()).filter(Boolean);
  const params = [];
  let sql = `SELECT p.id, p.tier, p.difficulty FROM problems p
     WHERE COALESCE(p.visibility, 'global') = 'global'
       AND COALESCE(p.problem_type, 'coding') = 'coding'
       AND COALESCE(p.difficulty, 1) BETWEEN ? AND ?`;
  params.push(minDifficulty, maxDifficulty);
  if (normalizedTiers.length > 0) {
    sql += ` AND LOWER(COALESCE(p.tier, '')) IN (${normalizedTiers.map(() => '?').join(',')})`;
    params.push(...normalizedTiers);
  }
  if (normalizedBannedTiers.length > 0) {
    sql += ` AND LOWER(COALESCE(p.tier, '')) NOT IN (${normalizedBannedTiers.map(() => '?').join(',')})`;
    params.push(...normalizedBannedTiers);
  }
  if (normalizedBannedTags.length > 0) {
    sql += ` AND NOT EXISTS (
       SELECT 1 FROM problem_tags pt
       WHERE pt.problem_id = p.id
         AND LOWER(pt.tag) IN (${normalizedBannedTags.map(() => '?').join(',')})
     )`;
    params.push(...normalizedBannedTags);
  }
  if (normalizedRequiredTags.length > 0) {
    sql += ` AND EXISTS (
       SELECT 1 FROM problem_tags pt
       WHERE pt.problem_id = p.id
         AND LOWER(pt.tag) IN (${normalizedRequiredTags.map(() => '?').join(',')})
     )`;
    params.push(...normalizedRequiredTags);
  }
  sql += ` ORDER BY RAND() LIMIT ${limit}`;
  const rows = await query(sql, params);
  const tagMap = new Map();
  if ((normalizedBannedTags.length > 0 || normalizedRequiredTags.length > 0) && rows.length > 0) {
    const candidateIds = rows.map((row) => Number(row.id)).filter(Boolean);
    const tagRows = await query(
      `SELECT problem_id, tag FROM problem_tags
       WHERE problem_id IN (${candidateIds.map(() => '?').join(',')})`,
      candidateIds
    );
    for (const tagRow of tagRows || []) {
      const problemId = Number(tagRow.problem_id || tagRow.problemId);
      if (!tagMap.has(problemId)) tagMap.set(problemId, []);
      tagMap.get(problemId).push(String(tagRow.tag || '').toLowerCase());
    }
  }

  const result = [];
  const usedIds = new Set();

  for (const row of rows || []) {
    if (result.length >= count) break;
    if (usedIds.has(Number(row.id))) continue;
    if (normalizedTiers.length > 0 && !normalizedTiers.includes(String(row.tier || '').toLowerCase())) continue;
    if (normalizedBannedTiers.length > 0 && normalizedBannedTiers.includes(String(row.tier || '').toLowerCase())) continue;
    const difficulty = Number(row.difficulty || 1);
    if (difficulty < minDifficulty || difficulty > maxDifficulty) continue;
    const tags = tagMap.get(Number(row.id)) || [];
    if (normalizedBannedTags.length > 0) {
      if (tags.some((tag) => normalizedBannedTags.includes(tag))) continue;
    }
    if (normalizedRequiredTags.length > 0 && !tags.some((tag) => normalizedRequiredTags.includes(tag))) continue;
    result.push(Number(row.id));
    usedIds.add(Number(row.id));
  }

  if (result.length < count) {
    const err = new Error('Not enough eligible battle problems match the selected conditions.');
    err.status = 400;
    err.details = {
      requested: count,
      available: result.length,
      tiers: normalizedTiers,
      bannedTiers: normalizedBannedTiers,
      requiredTags: normalizedRequiredTags,
      bannedTags: normalizedBannedTags,
    };
    throw err;
  }

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
      problemTiers: PROBLEM_TIERS,
      problemFilterPresets: [
        { key: 'auto', label: 'Auto Recommend' },
        { key: 'min', label: 'Selected tier and above' },
        { key: 'max', label: 'Selected tier and below' },
        { key: 'range', label: 'Tier range' },
        { key: 'only', label: 'Selected tier only' },
      ],
    };
  },

  async expireStaleWaitingRooms({ now = Date.now() } = {}) {
    if (isConnected()) {
      const result = await run(
        `UPDATE battle_rooms
         SET status = 'finished', ended_at = UTC_TIMESTAMP()
         WHERE status = 'waiting'
           AND (
             (lobby_expires_at IS NOT NULL AND lobby_expires_at < UTC_TIMESTAMP())
             OR (lobby_expires_at IS NULL AND created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 MINUTE))
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
    problemFilters = null,
    workshopModeId = null,
  } = {}) {
    if (creatorId) {
      const existingActive = await queryOne(
        "SELECT id FROM battle_rooms WHERE created_by = ? AND status IN ('waiting', 'playing') LIMIT 1",
        [creatorId]
      );
      if (existingActive) {
        const err = new Error('You already have an active battle room. Please leave or finish the existing room first.');
        err.status = 409;
        throw err;
      }
    }

    const normalizedMode = normalizeMode(mode);
    const workshopMode = workshopModeId ? await BattleMode.findById(workshopModeId) : null;
    if (workshopModeId && !workshopMode) {
      const err = new Error('워크샵 모드를 찾을 수 없습니다.');
      err.status = 404;
      throw err;
    }
    if (workshopMode && !workshopMode.isPublic && Number(workshopMode.authorId) !== Number(creatorId)) {
      const err = new Error('사용할 수 없는 워크샵 모드입니다.');
      err.status = 403;
      throw err;
    }
    const modeConfig = getBattleModeConfig(normalizedMode, getWorkshopOverrides(workshopMode));
    const normalizedProblemFilters = normalizedMode === 'draft-ban'
      ? sanitizeProblemFilters({})
      : sanitizeProblemFilters({
        ...(problemFilters || {}),
        bannedTags: problemFilters?.bannedTags || bannedTags,
      });

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

    await insert(
      `INSERT INTO battle_rooms
         (id, mode, problem_id, problem_ids, territory_claims, status, max_players, duration_sec,
          created_by, created_at, is_private, invite_code, preferred_language, lobby_expires_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, normalizedMode, resolvedProblemId, problemIdsJson, '{}', 'waiting',
        clampInt(maxPlayers ?? modeConfig.maxPlayers, modeConfig.maxPlayers, 2, MAX_PLAYERS),
        clampInt(durationSec ?? modeConfig.durationSec, modeConfig.durationSec, 60, 7200),
        creatorId || null, now, isPrivate ? 1 : 0, inviteCodeVal,
        preferredLanguage || null, lobbyExpiresAt,
      ]
    );
    if (creatorId) await this.joinRoom(id, creatorId);
    await this.recordEvent(id, creatorId || null, 'room.config', {
      mode: normalizedMode,
      bannedTags: normalizedProblemFilters.bannedTags,
      problemFilters: normalizedProblemFilters,
      workshopMode,
      deferredProblemSelection: !problemId,
    });
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

  async listRoomSummaries({ status = null, limit = 20 } = {}) {
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
    let rooms = (await query(sql, params)).map(normalizeRoom);
    if (status === 'playing') {
      rooms = rooms.filter((room) => isActivelyPlayingRoom(room));
    }
    return Promise.all(rooms.map(async (room) => {
      const participantRow = await queryOne('SELECT COUNT(*) AS cnt FROM battle_participants WHERE room_id = ?', [room.id]);
      const problem = room.problemId ? await getProblemById(room.problemId) : null;
      return {
        room: {
          id: room.id,
          mode: room.mode,
          status: room.status,
          maxPlayers: room.maxPlayers,
          durationSec: room.durationSec,
          startedAt: room.startedAt,
          createdBy: room.createdBy,
          createdAt: room.createdAt,
          lobbyExpiresAt: room.lobbyExpiresAt,
        },
        participantCount: Number(participantRow?.cnt || participantRow?.count || 0),
        problem: problem ? {
          id: problem.id,
          title: problem.title,
          tier: problem.tier,
        } : null,
      };
    }));
  },

  async countActivePublicRooms() {
    const rows = await query(
      "SELECT * FROM battle_rooms WHERE COALESCE(is_private, 0) = 0 AND status = ?",
      ['playing']
    );
    return (rows || []).map(normalizeRoom).filter((room) => !room.isPrivate && isActivelyPlayingRoom(room)).length;
  },

  async getRoom(roomId) {
    const row = await queryOne('SELECT * FROM battle_rooms WHERE id = ?', [roomId]);
    return normalizeRoom(row);
  },

  async getParticipants(roomId) {
    const rows = await query(
      `SELECT bp.*, u.username
       FROM battle_participants bp
       LEFT JOIN users u ON u.id = bp.user_id
       WHERE bp.room_id = ?
       ORDER BY bp.score DESC, bp.joined_at ASC`,
      [roomId]
    );
    return (rows || []).map((row) => normalizeParticipant(row));
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
      draft: buildDraftState(room, participants, events),
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
      const err = new Error('This battle has already ended.');
      err.status = 400;
      throw err;
    }
    const existing = await queryOne('SELECT * FROM battle_participants WHERE room_id = ? AND user_id = ?', [roomId, userId]);
    if (existing) return this.getRoomState(roomId);
    if (room.status !== 'waiting') {
      const err = new Error('This battle has already started.');
      err.status = 400;
      throw err;
    }

    const participants = await this.getParticipants(roomId);
    if (participants.length >= room.maxPlayers) {
      const err = new Error('The room is full.');
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
      const err = new Error('Invalid invite code or the room has already started.');
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
      const err = new Error('Only room participants can ready up.');
      err.status = 403;
      throw err;
    }
    await run('UPDATE battle_participants SET is_ready = ?, last_seen_at = ? WHERE room_id = ? AND user_id = ?', [1, nowMySQL(), roomId, userId]);
    await this.recordEvent(roomId, userId, 'player.ready', {});
    const participants = await this.getParticipants(roomId);
    if (participants.length >= 2 && participants.every((p) => p.isReady)) {
      if (room.mode === 'draft-ban') {
        await this.beginDraft(roomId);
      } else {
        await this.startRoom(roomId);
      }
    }
    return this.getRoomState(roomId);
  },

  async beginDraft(roomId) {
    const room = await this.getRoom(roomId);
    if (!room || room.mode !== 'draft-ban' || room.status !== 'waiting') return room;
    const participants = await this.getParticipants(roomId);
    if (participants.length < 2 || !participants.every((player) => player.isReady)) {
      const err = new Error('Both players must be ready before the draft can begin.');
      err.status = 400;
      throw err;
    }
    const events = await this.getEvents(roomId);
    if (!events.some((event) => event.type === 'draft.started')) {
      await run('UPDATE battle_rooms SET lobby_expires_at = ? WHERE id = ?', [toMySQL(new Date(Date.now() + LOBBY_TIMEOUT_MS)), roomId]);
      await this.recordEvent(roomId, null, 'draft.started', {
        banTierLimit: DRAFT_BAN_TIER_LIMIT,
        banTagLimit: DRAFT_BAN_TAG_LIMIT,
        pickTagLimit: DRAFT_PICK_TAG_LIMIT,
      });
    }
    return this.getRoom(roomId);
  },

  async submitDraftSelection(roomId, userId, { bannedTiers = [], bannedTags = [], pickedTags = [] } = {}) {
    const { room } = await this.requireParticipant(roomId, userId);
    if (room.mode !== 'draft-ban') {
      const err = new Error('This action is only available in Draft Ban mode.');
      err.status = 400;
      throw err;
    }
    if (room.status !== 'waiting') {
      return this.getRoomState(roomId);
    }

    await this.beginDraft(roomId);
    const selection = {
      bannedTiers: normalizeTierList(bannedTiers).slice(0, DRAFT_BAN_TIER_LIMIT),
      bannedTags: normalizeTagList(bannedTags, DRAFT_BAN_TAG_LIMIT),
      pickedTags: normalizeTagList(pickedTags, DRAFT_PICK_TAG_LIMIT),
    };
    await this.recordEvent(roomId, userId, 'draft.selection', selection);

    const participants = await this.getParticipants(roomId);
    const events = await this.getEvents(roomId);
    const selections = getLatestDraftSelections(participants, events);
    if (participants.length >= 2 && selections.length >= participants.length) {
      const problemFilters = buildProblemFiltersFromDraftSelections(selections);
      await this.recordEvent(roomId, null, 'draft.completed', { problemFilters, selections });
      await this.startRoom(roomId, { allowDraftStart: true });
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
    const baseRange = resolveBattleProblemRange(profiles, currentRoom);
    const filters = getEffectiveProblemFilters(events);
    const range = resolveBattleProblemFilters(baseRange, filters);
    const ids = await findProblemIds(problemCount, range);
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
      problemFilters: range.problemFilters,
    });

    return this.getRoom(roomId);
  },

  async startRoom(roomId, { allowDraftStart = false } = {}) {
    const room = await this.getRoom(roomId);
    if (!room || room.status !== 'waiting') return room;
    const participants = await this.getParticipants(roomId);
    if (participants.length < 2) {
      const err = new Error('The battle can start once an opponent has joined.');
      err.status = 400;
      throw err;
    }
    if (room.mode === 'draft-ban' && !allowDraftStart) {
      await this.beginDraft(roomId);
      return this.getRoom(roomId);
    }
    const configEvents = await this.getEvents(roomId, { limit: 30 });
    const configEvent = [...configEvents].reverse().find((event) => event.type === 'room.config');
    await this.ensureRoomProblems(roomId, room);
    await run('UPDATE battle_rooms SET status = ?, started_at = ? WHERE id = ?', ['playing', nowMySQL(), roomId]);
    await this.recordEvent(roomId, null, 'room.started', {});
    const workshopModeId = configEvent?.payload?.workshopMode?.id;
    if (workshopModeId) await BattleMode.incrementPlayCount(workshopModeId).catch(() => null);
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
      const err = new Error('This battle is not currently in progress.');
      err.status = 400;
      throw err;
    }
    const participant = await queryOne('SELECT * FROM battle_participants WHERE room_id = ? AND user_id = ?', [roomId, userId]);
    if (!participant) {
      const err = new Error('Only room participants can submit.');
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
    if (!room) { const err = new Error('Room not found.'); err.status = 404; throw err; }
    if (room.status === 'finished') { const err = new Error('This battle has already ended.'); err.status = 400; throw err; }
    if (!allowWaiting && room.status !== 'playing') { const err = new Error('This battle is not currently in progress.'); err.status = 400; throw err; }
    const participant = await queryOne('SELECT * FROM battle_participants WHERE room_id = ? AND user_id = ?', [roomId, userId]);
    if (!participant) { const err = new Error('Only room participants can use this action.'); err.status = 403; throw err; }
    return { room, participant };
  },

  async recordActivity(roomId, userId, { activity = 'Focusing', message = '' } = {}) {
    await this.requireParticipant(roomId, userId);
    const event = await this.recordEvent(roomId, userId, 'player.activity', {
      activity: sanitizeText(activity, 40) || 'Focusing',
      message: sanitizeText(message, 80),
    });
    await run('UPDATE battle_participants SET last_seen_at = ? WHERE room_id = ? AND user_id = ?', [nowMySQL(), roomId, userId]);
    return { event, state: await this.getRoomState(roomId) };
  },

  async recordChat(roomId, userId, { message = '' } = {}) {
    const { room } = await this.requireParticipant(roomId, userId);
    const config = getRoomConfig(room);
    if (!config.chatEnabled) { const err = new Error('Chat is not available in this mode.'); err.status = 400; throw err; }
    const text = sanitizeText(message, 220);
    if (!text) { const err = new Error('Message cannot be empty.'); err.status = 400; throw err; }
    const event = await this.recordEvent(roomId, userId, 'player.chat', { message: text });
    return { event, state: await this.getRoomState(roomId) };
  },

  async recordEmote(roomId, userId, { emote = '' } = {}) {
    const { room } = await this.requireParticipant(roomId, userId);
    const config = getRoomConfig(room);
    if (!config.emotesEnabled) { const err = new Error('Emotes are not available in this mode.'); err.status = 400; throw err; }
    const normalized = sanitizeText(emote, 20).toLowerCase();
    if (!BATTLE_EMOTES.includes(normalized)) { const err = new Error('Unsupported emote.'); err.status = 400; throw err; }
    const event = await this.recordEvent(roomId, userId, 'player.emote', { emote: normalized });
    return { event, state: await this.getRoomState(roomId) };
  },

  async useItem(roomId, userId, { itemType = '' } = {}) {
    const { room, participant } = await this.requireParticipant(roomId, userId, { allowWaiting: false });
    const config = getRoomConfig(room);
    if (!config.itemsEnabled) { const err = new Error('Items are not available in this mode.'); err.status = 400; throw err; }
    const item = BATTLE_ITEMS[sanitizeText(itemType, 30)];
    if (!item) { const err = new Error('Unsupported item.'); err.status = 400; throw err; }

    const cooldownMs = Number(config.itemCooldownSec || 20) * 1000;
    const state = await this.getRoomState(roomId);
    const recentItem = [...(state.events || [])].reverse().find((e) => e.userId === Number(userId) && e.type === 'item.used');
    if (recentItem?.createdAt && Date.now() - new Date(recentItem.createdAt).getTime() < cooldownMs) {
      const err = new Error('Item is on cooldown.'); err.status = 429; throw err;
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
      // Don't auto-finish: let lobby_expires_at expiry handle empty rooms naturally.
      // This prevents "나가기" from destroying a room that others could still join.
      return this.getRoomState(roomId);
    }
    await this.recordEvent(roomId, userId, 'player.disconnected', {});
    return this.getRoomState(roomId);
  },

  async finishRoom(roomId, { reason = 'timeout' } = {}) {
    const room = await this.getRoom(roomId);
    if (!room) return null;
    const result = await run(
      "UPDATE battle_rooms SET status = 'finished', ended_at = ? WHERE id = ? AND status != 'finished'",
      [nowMySQL(), roomId]
    );
    if (result.affectedRows === 0) {
      return this.getRoomState(roomId);
    }
    await this.recordEvent(roomId, null, 'room.finished', { reason });

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
           SET status = 'finished', ended_at = UTC_TIMESTAMP()
           WHERE id = ?
             AND status = 'waiting'
             AND (
               (lobby_expires_at IS NOT NULL AND lobby_expires_at < UTC_TIMESTAMP())
               OR (lobby_expires_at IS NULL AND created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 MINUTE))
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
