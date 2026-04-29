import { insert, query, queryOne } from '../config/mysql.js';

export const AdminLog = {
  async create({ adminId, action, targetType = null, targetId = null, detail = null }) {
    return insert(
      'INSERT INTO admin_logs (admin_id, action, target_type, target_id, detail) VALUES (?,?,?,?,?)',
      [adminId, action, targetType, targetId, detail ? JSON.stringify(detail) : null]
    );
  },

  async list({ page = 1, limit = 50 } = {}) {
    const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 50));
    const offset = (safePage - 1) * safeLimit;

    const [rows, totalRow] = await Promise.all([
      query(
        `SELECT l.id, l.admin_id, u.username AS admin_username, l.action, l.target_type, l.target_id, l.detail, l.created_at
         FROM admin_logs l
         JOIN users u ON u.id = l.admin_id
         ORDER BY l.created_at DESC, l.id DESC
         LIMIT ? OFFSET ?`,
        [safeLimit, offset]
      ),
      queryOne('SELECT COUNT(*) AS cnt FROM admin_logs', []),
    ]);

    return {
      items: (rows || []).map((row) => ({
        ...row,
        detail: typeof row.detail === 'string' ? JSON.parse(row.detail) : (row.detail || null),
      })),
      page: safePage,
      limit: safeLimit,
      total: Number(totalRow?.cnt) || 0,
    };
  },
};
