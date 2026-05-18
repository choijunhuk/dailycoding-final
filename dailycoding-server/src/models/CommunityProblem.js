import { query, queryOne, insert, run } from '../config/mysql.js';

export const CommunityProblem = {
  async create({ userId, title, description, hint, inputDesc, outputDesc, examples, testcases, tier, problemType, difficulty, tags }) {
    const id = await insert(
      `INSERT INTO community_problems
        (user_id, title, description, hint, input_desc, output_desc, examples, testcases, tier, problem_type, difficulty, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, title, description, hint || null, inputDesc || null, outputDesc || null,
        JSON.stringify(examples || []), JSON.stringify(testcases || []),
        tier || 'unranked', problemType || 'coding', difficulty || 5,
        JSON.stringify(tags || []),
      ]
    );
    return id;
  },

  async findByUser(userId) {
    return query(
      `SELECT id, title, tier, problem_type, difficulty, status, admin_note, created_at, updated_at
       FROM community_problems WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
  },

  async findById(id) {
    const row = await queryOne('SELECT * FROM community_problems WHERE id = ?', [id]);
    if (!row) return null;
    return this._parse(row);
  },

  async findPending({ status = 'pending', limit = 50, offset = 0 } = {}) {
    const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 100);
    const safeOffset = Math.max(Number.parseInt(offset, 10) || 0, 0);
    const rows = await query(
      `SELECT cp.*, u.username, u.tier AS user_tier
       FROM community_problems cp
       JOIN users u ON u.id = cp.user_id
       WHERE cp.status = ?
       ORDER BY cp.created_at ASC
       LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      [status]
    );
    return rows.map(r => this._parse(r));
  },

  async countByStatus(status) {
    const row = await queryOne(
      'SELECT COUNT(*) AS cnt FROM community_problems WHERE status = ?',
      [status]
    );
    return row?.cnt || 0;
  },

  async approve(id, adminId, registeredProblemId = null) {
    await run(
      `UPDATE community_problems
       SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), registered_problem_id = ?
       WHERE id = ?`,
      [adminId, registeredProblemId, id]
    );
  },

  async reject(id, adminId, note) {
    await run(
      `UPDATE community_problems
       SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), admin_note = ?
       WHERE id = ?`,
      [adminId, note || null, id]
    );
  },

  _parse(row) {
    return {
      ...row,
      examples: typeof row.examples === 'string' ? JSON.parse(row.examples) : (row.examples || []),
      testcases: typeof row.testcases === 'string' ? JSON.parse(row.testcases) : (row.testcases || []),
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []),
    };
  },
};
