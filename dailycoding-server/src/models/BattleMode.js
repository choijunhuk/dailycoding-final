import { insert, query, queryOne, run } from '../config/mysql.js';

export const SUPPORTED_BATTLE_EVENTS = [
  'ON_CORRECT_ANSWER',
  'ON_WRONG_ANSWER',
  'ON_COMPILE_ERROR',
  'ON_OPPONENT_CORRECT',
  'ON_OPPONENT_WRONG',
  'ON_TIMER_HALF',
  'ON_TIMER_LOW',
  'ON_BATTLE_START',
  'ON_HP_BELOW_50',
  'ON_HP_BELOW_25',
];

export const SUPPORTED_BATTLE_CONDITIONS = [
  'always',
  'hp_below',
  'hp_above',
  'opponent_hp_below',
  'time_remaining_below',
  'solved_count_above',
  'wrong_streak_above',
];

export const SUPPORTED_BATTLE_ACTIONS = [
  'MODIFY_HP',
  'SET_HP',
  'ADD_TIME',
  'GRANT_ITEM',
  'DOUBLE_DAMAGE',
  'FREEZE_OPPONENT',
  'SHOW_MESSAGE',
];

const EVENT_SET = new Set(SUPPORTED_BATTLE_EVENTS);
const CONDITION_SET = new Set(SUPPORTED_BATTLE_CONDITIONS);
const ACTION_SET = new Set(SUPPORTED_BATTLE_ACTIONS);
const ITEM_SET = new Set(['shield', 'bomb', 'heal', 'freeze']);
const TARGET_SET = new Set(['self', 'opponent', 'both']);
const SET_HP_TARGET_SET = new Set(['self', 'opponent']);
const MAX_RULES = 20;

function validationError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function cleanText(value, maxLength) {
  return Array.from(String(value ?? ''))
    .map((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127 ? ' ' : char;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function toInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function requireNumber(value, label, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw validationError(`${label} 값은 숫자여야 합니다.`);
  if (parsed < min || parsed > max) throw validationError(`${label} 값은 ${min}~${max} 범위여야 합니다.`);
  return parsed;
}

function parseConfig(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return null; }
}

function normalizeBoolean(value) {
  return value === true || value === 1 || value === '1';
}

function normalizeCondition(condition) {
  const type = condition?.type || 'always';
  if (!CONDITION_SET.has(type)) throw validationError(`지원하지 않는 조건입니다: ${type}`);
  if (type === 'always') return { type };
  const value = requireNumber(condition.value, '조건', 0, 10000);
  return { type, value };
}

function normalizeAction(action) {
  const type = action?.type;
  if (!ACTION_SET.has(type)) throw validationError(`지원하지 않는 액션입니다: ${type}`);

  if (type === 'MODIFY_HP') {
    const target = action.target || 'self';
    if (!TARGET_SET.has(target)) throw validationError('HP 변경 대상이 올바르지 않습니다.');
    return { type, target, value: requireNumber(action.value, 'HP 변경', -999, 999) };
  }

  if (type === 'SET_HP') {
    const target = action.target || 'self';
    if (!SET_HP_TARGET_SET.has(target)) throw validationError('HP 설정 대상이 올바르지 않습니다.');
    return { type, target, value: requireNumber(action.value, 'HP 설정', 0, 999) };
  }

  if (type === 'ADD_TIME') {
    return { type, value: requireNumber(action.value, '시간 변경', -3600, 3600) };
  }

  if (type === 'GRANT_ITEM') {
    const item = action.item;
    if (!ITEM_SET.has(item)) throw validationError(`지원하지 않는 아이템입니다: ${item}`);
    return { type, item };
  }

  if (type === 'DOUBLE_DAMAGE') {
    return { type, duration: requireNumber(action.duration, '데미지 2배 지속 시간', 1, 600) };
  }

  if (type === 'FREEZE_OPPONENT') {
    return { type, duration: requireNumber(action.duration, '타이머 정지 지속 시간', 1, 600) };
  }

  return { type, text: cleanText(action.text, 120) };
}

function normalizeRule(rule, index) {
  const event = rule?.event;
  if (!EVENT_SET.has(event)) throw validationError(`지원하지 않는 이벤트입니다: ${event}`);
  return {
    id: cleanText(rule.id || `rule_${index + 1}`, 40) || `rule_${index + 1}`,
    event,
    condition: normalizeCondition(rule.condition || { type: 'always' }),
    action: normalizeAction(rule.action || {}),
  };
}

export function validateBattleModeConfig(config) {
  const source = parseConfig(config);
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw validationError('워크샵 설정은 JSON 객체여야 합니다.');
  }
  const rules = Array.isArray(source.rules) ? source.rules : [];
  if (rules.length > MAX_RULES) throw validationError(`룰은 최대 ${MAX_RULES}개까지 만들 수 있습니다.`);

  const startingItems = (Array.isArray(source.startingItems) ? source.startingItems : [])
    .filter((item) => ITEM_SET.has(item))
    .slice(0, 8);

  return {
    baseHp: toInt(source.baseHp, 100, 1, 999),
    timeLimit: toInt(source.timeLimit, 1800, 60, 7200),
    allowItems: normalizeBoolean(source.allowItems),
    startingItems,
    rules: rules.map(normalizeRule),
  };
}

function normalizeMode(row, liked = false, authorUsername = null) {
  if (!row) return null;
  return {
    id: Number(row.id),
    name: row.name || '',
    description: row.description || '',
    authorId: row.author_id == null ? null : Number(row.author_id),
    authorUsername,
    config: validateBattleModeConfig(parseConfig(row.config) || {}),
    isPublic: normalizeBoolean(row.is_public),
    playCount: Number(row.play_count || 0),
    likeCount: Number(row.like_count || 0),
    liked,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

async function hydrateMode(row, viewerId = null) {
  if (!row) return null;
  const [like, author] = await Promise.all([
    viewerId
      ? queryOne('SELECT * FROM battle_mode_likes WHERE user_id = ? AND mode_id = ?', [viewerId, row.id])
      : Promise.resolve(null),
    row.author_id
      ? queryOne('SELECT username FROM users WHERE id = ?', [row.author_id]).catch(() => null)
      : Promise.resolve(null),
  ]);
  return normalizeMode(row, Boolean(like), author?.username || null);
}

export const BattleMode = {
  async findAll({ limit = 20, offset = 0, authorId = null, isPublic = true, sort = 'created_at', search = '', viewerId = null } = {}) {
    const sortColumn = ['play_count', 'like_count', 'created_at'].includes(sort) ? sort : 'created_at';
    const rows = await query(`SELECT * FROM battle_modes ORDER BY ${sortColumn} DESC, id DESC`);
    const needle = cleanText(search, 80).toLowerCase();
    const filtered = (rows || []).filter((row) => {
      if (authorId != null && Number(row.author_id) !== Number(authorId)) return false;
      if (isPublic != null && normalizeBoolean(row.is_public) !== normalizeBoolean(isPublic)) return false;
      if (needle && !String(row.name || '').toLowerCase().includes(needle)) return false;
      return true;
    });
    const start = Math.max(0, Number(offset) || 0);
    const cap = Math.min(50, Math.max(1, Number(limit) || 20));
    return Promise.all(filtered.slice(start, start + cap).map((row) => hydrateMode(row, viewerId)));
  },

  async findById(id, { viewerId = null } = {}) {
    const row = await queryOne('SELECT * FROM battle_modes WHERE id = ?', [Number(id)]);
    return hydrateMode(row, viewerId);
  },

  async create({ name, description = '', authorId, config, isPublic = true }) {
    const safeName = cleanText(name, 100);
    if (!safeName) throw validationError('모드 이름을 입력해 주세요.');
    const normalizedConfig = validateBattleModeConfig(config);
    const id = await insert(
      `INSERT INTO battle_modes (name, description, author_id, config, is_public, play_count, like_count)
       VALUES (?,?,?,?,?,?,?)`,
      [safeName, cleanText(description, 1000), authorId || null, JSON.stringify(normalizedConfig), isPublic ? 1 : 0, 0, 0]
    );
    return this.findById(id, { viewerId: authorId });
  },

  async update(id, { name, description, config, isPublic }, viewerId = null) {
    const current = await this.findById(id, { viewerId });
    if (!current) return null;
    const safeName = name === undefined ? current.name : cleanText(name, 100);
    if (!safeName) throw validationError('모드 이름을 입력해 주세요.');
    const normalizedConfig = config === undefined ? current.config : validateBattleModeConfig(config);
    await run(
      `UPDATE battle_modes SET name = ?, description = ?, config = ?, is_public = ? WHERE id = ?`,
      [
        safeName,
        description === undefined ? current.description : cleanText(description, 1000),
        JSON.stringify(normalizedConfig),
        isPublic === undefined ? (current.isPublic ? 1 : 0) : (isPublic ? 1 : 0),
        Number(id),
      ]
    );
    return this.findById(id, { viewerId });
  },

  async delete(id) {
    await run('DELETE FROM battle_mode_likes WHERE mode_id = ?', [Number(id)]);
    await run('DELETE FROM battle_modes WHERE id = ?', [Number(id)]);
    return true;
  },

  async toggleLike(userId, modeId) {
    const mode = await this.findById(modeId, { viewerId: userId });
    if (!mode) return null;
    const existing = await queryOne('SELECT * FROM battle_mode_likes WHERE user_id = ? AND mode_id = ?', [Number(userId), Number(modeId)]);
    if (existing) {
      await run('DELETE FROM battle_mode_likes WHERE user_id = ? AND mode_id = ?', [Number(userId), Number(modeId)]);
      await run('UPDATE battle_modes SET like_count = ? WHERE id = ?', [Math.max(0, mode.likeCount - 1), Number(modeId)]);
      return { liked: false, likeCount: Math.max(0, mode.likeCount - 1) };
    }
    await insert(
      'INSERT INTO battle_mode_likes (user_id, mode_id) VALUES (?,?)',
      [Number(userId), Number(modeId)]
    );
    await run('UPDATE battle_modes SET like_count = ? WHERE id = ?', [mode.likeCount + 1, Number(modeId)]);
    return { liked: true, likeCount: mode.likeCount + 1 };
  },

  async incrementPlayCount(id) {
    const mode = await this.findById(id);
    if (!mode) return null;
    const next = mode.playCount + 1;
    await run('UPDATE battle_modes SET play_count = ? WHERE id = ?', [next, Number(id)]);
    return next;
  },
};

export default BattleMode;
