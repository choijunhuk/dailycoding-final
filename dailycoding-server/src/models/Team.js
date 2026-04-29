import { query, queryOne, insert, run } from '../config/mysql.js';

export const Team = {
  async findByOwner(ownerId) {
    return queryOne('SELECT * FROM teams WHERE owner_id = ?', [ownerId]);
  },

  async findById(id) {
    return queryOne('SELECT * FROM teams WHERE id = ?', [id]);
  },

  async create(name, ownerId) {
    const teamId = await insert('INSERT INTO teams (name, owner_id) VALUES (?, ?)', [name, ownerId]);
    await run('INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)', [teamId, ownerId, 'admin']);
    return teamId;
  },

  async getMembers(teamId) {
    return query(`
      SELECT u.id, u.username, u.email, u.tier, u.rating, tm.role, tm.joined_at
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ?
      ORDER BY tm.role ASC, tm.joined_at DESC
    `, [teamId]);
  },

  async createInvite(teamId, token, expiresAt) {
    return insert('INSERT INTO team_invites (team_id, token, expires_at) VALUES (?, ?, ?)', [teamId, token, expiresAt]);
  },

  async findInvite(token) {
    return queryOne('SELECT * FROM team_invites WHERE token = ? AND expires_at > NOW()', [token]);
  },

  async addMember(teamId, userId) {
    return run('INSERT IGNORE INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)', [teamId, userId, 'member']);
  },

  async removeMember(teamId, userId) {
    return run('DELETE FROM team_members WHERE team_id = ? AND user_id = ? AND role != ?', [teamId, userId, 'admin']);
  }
};
