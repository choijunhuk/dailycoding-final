import { query, queryOne, insert, run } from '../config/mysql.js';
import { nowMySQL } from '../config/dateutil.js';

function normalizeTeam(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    name: row.name,
    owner_id: Number(row.owner_id),
    ownerId: Number(row.owner_id),
    created_at: row.created_at,
    createdAt: row.created_at,
  };
}

function normalizeMember(row, user = null, activity = null) {
  if (!row) return null;
  return {
    id: Number(row.user_id),
    userId: Number(row.user_id),
    username: user?.username || row.username || `user-${row.user_id}`,
    email: user?.email || row.email || '',
    tier: user?.tier || row.tier || 'unranked',
    rating: Number(user?.rating ?? row.rating ?? 0),
    role: row.role || 'member',
    joined_at: row.joined_at,
    joinedAt: row.joined_at,
    activity: activity || {
      submissions: 0,
      correct: 0,
      weeklySolved: 0,
      lastSubmittedAt: null,
    },
  };
}

function isWithinDays(value, days) {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;
  return Date.now() - time <= days * 24 * 60 * 60 * 1000;
}

export const Team = {
  async findByOwner(ownerId) {
    return normalizeTeam(await queryOne('SELECT * FROM teams WHERE owner_id = ?', [ownerId]));
  },

  async findMembership(userId) {
    return queryOne('SELECT * FROM team_members WHERE user_id = ?', [userId]);
  },

  async findMembershipInTeam(userId, teamId) {
    if (!teamId) return this.findMembership(userId);
    return queryOne('SELECT * FROM team_members WHERE user_id = ? AND team_id = ?', [userId, teamId]);
  },

  async findMemberships(userId) {
    return query('SELECT * FROM team_members WHERE user_id = ? ORDER BY joined_at DESC', [userId]);
  },

  async findByUser(userId, teamId = null) {
    const membership = await this.findMembershipInTeam(userId, teamId);
    if (!membership) return null;
    return this.findById(membership.team_id);
  },

  async findAllByUser(userId) {
    const memberships = await this.findMemberships(userId);
    const teams = [];
    for (const membership of memberships || []) {
      const team = await this.findById(membership.team_id);
      if (team) {
        teams.push({
          ...team,
          role: membership.role || 'member',
          joinedAt: membership.joined_at,
          joined_at: membership.joined_at,
        });
      }
    }
    return teams;
  },

  async findById(id) {
    return normalizeTeam(await queryOne('SELECT * FROM teams WHERE id = ?', [id]));
  },

  async create(name, ownerId) {
    const teamId = await insert('INSERT INTO teams (name, owner_id) VALUES (?, ?)', [name, ownerId]);
    await insert('INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)', [teamId, ownerId, 'admin', nowMySQL()]);
    return teamId;
  },

  async getMembers(teamId) {
    const rows = await query('SELECT * FROM team_members WHERE team_id = ? ORDER BY role ASC, joined_at DESC', [teamId]);
    const { User } = await import('./User.js');
    const members = [];
    for (const row of rows || []) {
      const [user, activity] = await Promise.all([
        User.findById(Number(row.user_id)),
        this.getMemberActivity(Number(row.user_id)),
      ]);
      members.push(normalizeMember(row, user, activity));
    }
    return members.sort((a, b) => {
      if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
      return new Date(b.joinedAt || 0) - new Date(a.joinedAt || 0);
    });
  },

  async createInvite(teamId, token, expiresAt) {
    return insert('INSERT INTO team_invites (team_id, token, expires_at) VALUES (?, ?, ?)', [teamId, token, expiresAt]);
  },

  async findInvite(token) {
    return queryOne('SELECT * FROM team_invites WHERE token = ? AND expires_at > NOW()', [token]);
  },

  async addMember(teamId, userId) {
    const existingMembership = await this.findMembershipInTeam(userId, teamId);
    if (existingMembership) return { affectedRows: 0 };
    return insert('INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)', [teamId, userId, 'member', nowMySQL()]);
  },

  async getMemberRole(teamId, userId) {
    const row = await queryOne('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?', [teamId, userId]);
    return row?.role || null;
  },

  async requireAdmin(teamId, userId) {
    const role = await this.getMemberRole(teamId, userId);
    if (role !== 'admin') {
      const err = new Error('소속 관리자만 처리할 수 있습니다.');
      err.status = 403;
      throw err;
    }
    return true;
  },

  async countAdmins(teamId) {
    const rows = await query('SELECT role FROM team_members WHERE team_id = ?', [teamId]);
    return (rows || []).filter((row) => row.role === 'admin').length;
  },

  async setMemberRole(teamId, userId, role) {
    const normalizedRole = role === 'admin' ? 'admin' : 'member';
    const current = await queryOne('SELECT * FROM team_members WHERE team_id = ? AND user_id = ?', [teamId, userId]);
    if (!current) {
      const err = new Error('소속 멤버를 찾을 수 없습니다.');
      err.status = 404;
      throw err;
    }
    if (current.role === 'admin' && normalizedRole !== 'admin' && await this.countAdmins(teamId) <= 1) {
      const err = new Error('마지막 관리자는 해제할 수 없습니다.');
      err.status = 400;
      throw err;
    }
    await run('UPDATE team_members SET role = ? WHERE team_id = ? AND user_id = ?', [normalizedRole, teamId, userId]);
    return this.getTeamState(teamId);
  },

  async removeMember(teamId, userId) {
    const current = await queryOne('SELECT * FROM team_members WHERE team_id = ? AND user_id = ?', [teamId, userId]);
    if (!current) return { affectedRows: 0 };
    if (current.role === 'admin' && await this.countAdmins(teamId) <= 1) {
      const err = new Error('마지막 관리자는 추방할 수 없습니다.');
      err.status = 400;
      throw err;
    }
    return run('DELETE FROM team_members WHERE team_id = ? AND user_id = ?', [teamId, userId]);
  },

  async leave(userId, teamId = null) {
    const membership = await this.findMembershipInTeam(userId, teamId);
    if (!membership) {
      const err = new Error('소속이 없습니다.');
      err.status = 404;
      throw err;
    }
    if (membership.role === 'admin' && await this.countAdmins(membership.team_id) <= 1) {
      const err = new Error('마지막 관리자는 탈퇴할 수 없습니다. 다른 관리자를 지정하거나 소속을 해산하세요.');
      err.status = 400;
      throw err;
    }
    await run('DELETE FROM team_members WHERE team_id = ? AND user_id = ?', [membership.team_id, userId]);
    return membership.team_id;
  },

  async rename(teamId, userId, name) {
    await this.requireAdmin(teamId, userId);
    const cleanName = String(name || '').trim().slice(0, 100);
    if (!cleanName) {
      const err = new Error('소속 이름을 입력해주세요.');
      err.status = 400;
      throw err;
    }
    await run('UPDATE teams SET name = ? WHERE id = ?', [cleanName, teamId]);
    return this.getTeamState(teamId);
  },

  async dissolve(teamId, userId) {
    const team = await this.findById(teamId);
    if (!team) {
      const err = new Error('소속을 찾을 수 없습니다.');
      err.status = 404;
      throw err;
    }
    if (Number(team.owner_id) !== Number(userId)) {
      const err = new Error('소속 소유자만 해산할 수 있습니다.');
      err.status = 403;
      throw err;
    }
    await run('DELETE FROM team_members WHERE team_id = ?', [teamId]);
    await run('DELETE FROM team_invites WHERE team_id = ?', [teamId]);
    await run('DELETE FROM teams WHERE id = ?', [teamId]);
  },

  async getMemberActivity(userId) {
    const rows = await query(
      'SELECT result, submitted_at FROM submissions WHERE user_id = ? ORDER BY submitted_at DESC LIMIT 200',
      [userId]
    );
    const list = rows || [];
    return {
      submissions: list.length,
      correct: list.filter((row) => row.result === 'correct').length,
      weeklySolved: list.filter((row) => row.result === 'correct' && isWithinDays(row.submitted_at, 7)).length,
      lastSubmittedAt: list[0]?.submitted_at || null,
    };
  },

  buildStats(members = []) {
    const activeMembers = members.filter((member) => member.activity?.lastSubmittedAt && isWithinDays(member.activity.lastSubmittedAt, 14)).length;
    const weeklySolved = members.reduce((sum, member) => sum + Number(member.activity?.weeklySolved || 0), 0);
    const totalRating = members.reduce((sum, member) => sum + Number(member.rating || 0), 0);
    return {
      memberCount: members.length,
      activeMembers,
      weeklySolved,
      avgRating: members.length ? Math.round(totalRating / members.length) : 0,
    };
  },

  async getTeamState(teamId) {
    const team = await this.findById(teamId);
    if (!team) return null;
    const members = await this.getMembers(team.id);
    return {
      ...team,
      members,
      stats: this.buildStats(members),
    };
  },
};
