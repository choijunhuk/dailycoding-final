import { nowMySQL } from '../config/dateutil.js';
import { query, queryOne, insert, run } from '../config/mysql.js';
import { pushToUser } from '../services/pushNotifier.js';

const NOTIFICATION_DEFAULTS = {
  community_reply: true,
  community_like: true,
  mention: true,
  follow: true,
  answer_accepted: true,
  battle: true,
  contest: true,
  review: true,
  reward: true,
  system: true,
};

const LEGACY_NOTIFICATION_KEYS = {
  community_reply: 'onComment',
  community_like: 'onLike',
  mention: 'onMention',
  follow: 'onFollow',
  battle: 'onBattle',
};

function safeParseSettings(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

function isNotificationEnabled(settings, type = 'system') {
  const key = type || 'system';
  const notifications = safeParseSettings(settings)?.notifications || {};
  if (notifications[key] !== undefined) return notifications[key] !== false;
  const legacyKey = LEGACY_NOTIFICATION_KEYS[key];
  if (legacyKey && notifications[legacyKey] !== undefined) return notifications[legacyKey] !== false;
  return NOTIFICATION_DEFAULTS[key] !== false;
}

async function shouldCreateNotification(userId, type) {
  const row = await queryOne('SELECT settings FROM users WHERE id = ?', [userId]).catch(() => null);
  return isNotificationEnabled(row?.settings, type);
}

export const Notification = {
  async findByUser(userId, limit = 30) {
    const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 30));
    const rows = await query(
      `SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT ${safeLimit}`,
      [userId]
    );
    return rows || [];
  },

  async create(userId, message, link = null, options = {}) {
    const type = options?.type || 'system';
    if (!(await shouldCreateNotification(userId, type))) return null;
    const createdAt = nowMySQL();
    const id = await insert(
      'INSERT INTO notifications (user_id,message,link,created_at) VALUES (?,?,?,?)',
      [userId, message, link, createdAt]
    );
    const payload = { id, message, link, created_at: createdAt, is_read: 0 };
    global.io?.to(`user:${userId}`).emit('notification:new', payload);
    pushToUser(userId, { title: 'DailyCoding', body: message, data: { link } }).catch(() => {});
    return payload;
  },

  async markRead(id, userId) {
    return run('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?', [id, userId]);
  },

  async markAllRead(userId) {
    return run('UPDATE notifications SET is_read=1 WHERE user_id=?', [userId]);
  },

  async deleteAll(userId) {
    return run('DELETE FROM notifications WHERE user_id=?', [userId]);
  },

  async countUnread(userId) {
    const row = await queryOne(
      'SELECT COUNT(*) AS cnt FROM notifications WHERE user_id=? AND is_read=0',
      [userId]
    );
    return row?.cnt || 0;
  },

  // 전체 유저에게 공지 — chunked bulk INSERT (max_allowed_packet 초과 방지)
  async broadcast(userIds, message, link = null, options = {}) {
    if (!userIds || userIds.length === 0) return;
    const createdAt = nowMySQL();
    const type = options?.type || 'system';
    const allowedIds = [];
    for (const userId of userIds) {
      if (await shouldCreateNotification(userId, type)) allowedIds.push(userId);
    }
    if (allowedIds.length === 0) return;
    const CHUNK = 500; // MySQL max_allowed_packet 안전 범위
    for (let i = 0; i < allowedIds.length; i += CHUNK) {
      const chunk = allowedIds.slice(i, i + CHUNK);
      const placeholders = chunk.map(() => '(?,?,?,?)').join(',');
      const values = chunk.flatMap(uid => [uid, message, link, createdAt]);
      await run(
        `INSERT INTO notifications (user_id,message,link,created_at) VALUES ${placeholders}`,
        values
      );
    }
  },
};
