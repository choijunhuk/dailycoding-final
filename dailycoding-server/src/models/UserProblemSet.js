import crypto from 'crypto';
import { insert, query, queryOne, run } from '../config/mysql.js';
import { nowMySQL } from '../config/dateutil.js';

function parseIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
  try { return JSON.parse(value).map(Number).filter(Number.isFinite); } catch { return []; }
}

function normalize(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    name: row.name || '',
    description: row.description || '',
    problemIds: parseIds(row.problem_ids),
    shareToken: row.share_token || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export const UserProblemSet = {
  async create(userId, { name, description = '', problemIds = [] }) {
    const now = nowMySQL();
    const id = await insert(
      'INSERT INTO user_problem_sets (user_id, name, description, problem_ids, created_at, updated_at) VALUES (?,?,?,?,?,?)',
      [Number(userId), String(name).slice(0, 200), String(description).slice(0, 2000), JSON.stringify(problemIds.map(Number)), now, now]
    );
    return this.findById(id, userId);
  },

  async findByUser(userId) {
    const rows = await query(
      'SELECT * FROM user_problem_sets WHERE user_id = ? ORDER BY updated_at DESC',
      [Number(userId)]
    );
    return (rows || []).map(normalize);
  },

  async findById(id, userId = null) {
    const row = await queryOne('SELECT * FROM user_problem_sets WHERE id = ?', [Number(id)]);
    if (!row) return null;
    if (userId !== null && Number(row.user_id) !== Number(userId)) return null;
    return normalize(row);
  },

  async findByShareToken(token) {
    if (!token) return null;
    const row = await queryOne('SELECT * FROM user_problem_sets WHERE share_token = ?', [String(token)]);
    return normalize(row);
  },

  async update(id, userId, { name, description, problemIds }) {
    const now = nowMySQL();
    const fields = [];
    const params = [];
    if (name !== undefined) { fields.push('name = ?'); params.push(String(name).slice(0, 200)); }
    if (description !== undefined) { fields.push('description = ?'); params.push(String(description).slice(0, 2000)); }
    if (problemIds !== undefined) { fields.push('problem_ids = ?'); params.push(JSON.stringify(problemIds.map(Number))); }
    if (fields.length === 0) return this.findById(id, userId);
    fields.push('updated_at = ?');
    params.push(now);
    params.push(Number(id), Number(userId));
    await run(`UPDATE user_problem_sets SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, params);
    return this.findById(id, userId);
  },

  async delete(id, userId) {
    await run('DELETE FROM user_problem_sets WHERE id = ? AND user_id = ?', [Number(id), Number(userId)]);
  },

  async generateShareToken(id, userId) {
    const token = crypto.randomBytes(16).toString('hex');
    await run(
      'UPDATE user_problem_sets SET share_token = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      [token, nowMySQL(), Number(id), Number(userId)]
    );
    return token;
  },

  async revokeShareToken(id, userId) {
    await run(
      'UPDATE user_problem_sets SET share_token = NULL, updated_at = ? WHERE id = ? AND user_id = ?',
      [nowMySQL(), Number(id), Number(userId)]
    );
  },
};
