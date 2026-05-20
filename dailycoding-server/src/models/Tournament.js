import { nowMySQL } from '../config/dateutil.js';
import { insert, query, queryOne, run } from '../config/mysql.js';
import { Battle } from './Battle.js';
import { User } from './User.js';

const VALID_SIZES = new Set([8, 16, 32]);

function clampSize(size) {
  const parsed = Number(size) || 8;
  return VALID_SIZES.has(parsed) ? parsed : 8;
}

function normalize(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    size: Number(row.size || 8),
    status: row.status || 'open',
    createdBy: row.created_by ?? row.createdBy,
    startsAt: row.starts_at ?? row.startsAt,
    expiresAt: row.expires_at ?? row.expiresAt ?? null,
    createdAt: row.created_at ?? row.createdAt,
    participantCount: Number(row.participant_count ?? row.participantCount ?? 0),
  };
}

function nextPowerRound(size) {
  return Math.log2(size);
}

export const Tournament = {
  async expireOld() {
    try {
      await run(
        "UPDATE tournaments SET status='expired' WHERE status='open' AND expires_at IS NOT NULL AND expires_at < UTC_TIMESTAMP()"
      );
    } catch { /* ignore if expires_at column not yet migrated */ }
  },

  async list() {
    await this.expireOld();
    const rows = await query(
      `SELECT t.*, COUNT(tp.user_id) AS participant_count
       FROM tournaments t
       LEFT JOIN tournament_participants tp ON tp.tournament_id = t.id
       WHERE t.status != 'expired'
       GROUP BY t.id
       ORDER BY FIELD(t.status, 'open', 'in_progress', 'complete'), t.created_at DESC
       LIMIT 100`
    );
    return (rows || []).map(normalize);
  },

  async create({ name, size, createdBy, startsAt = null }) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const id = await insert(
      'INSERT INTO tournaments (name, size, status, created_by, starts_at, expires_at) VALUES (?,?,?,?,?,?)',
      [String(name || '').trim().slice(0, 120), clampSize(size), 'open', createdBy, startsAt || null, expiresAt]
    );
    return this.getById(id);
  },

  async delete(id, requesterId) {
    const tournament = await this.getById(id);
    if (!tournament) {
      const err = new Error('토너먼트를 찾을 수 없습니다.');
      err.status = 404;
      throw err;
    }
    const requester = await User.findById(requesterId);
    if (requester?.role !== 'admin' && tournament.createdBy !== requesterId) {
      const err = new Error('토너먼트 생성자만 삭제할 수 있습니다.');
      err.status = 403;
      throw err;
    }
    await run('DELETE FROM tournament_matches WHERE tournament_id=?', [id]);
    await run('DELETE FROM tournament_participants WHERE tournament_id=?', [id]);
    await run('DELETE FROM tournaments WHERE id=?', [id]);
  },

  async getById(id) {
    const row = await queryOne(
      `SELECT t.*, COUNT(tp.user_id) AS participant_count
       FROM tournaments t
       LEFT JOIN tournament_participants tp ON tp.tournament_id = t.id
       WHERE t.id = ?
       GROUP BY t.id`,
      [id]
    );
    if (!row) return null;
    const [participants, matches] = await Promise.all([
      this.getParticipants(id),
      this.getMatches(id),
    ]);
    return { ...normalize(row), participants, matches };
  },

  async getParticipants(id) {
    const rows = await query(
      `SELECT tp.tournament_id, tp.user_id, tp.seed, tp.eliminated_at, tp.joined_at, u.username, u.tier, u.rating,
              u.avatar_url, u.profile_image_url, u.site_avatar_url, u.avatar_source, u.avatar_emoji, u.avatar_bg
       FROM tournament_participants tp
       JOIN users u ON u.id = tp.user_id
       WHERE tp.tournament_id = ?
       ORDER BY tp.seed ASC`,
      [id]
    );
    return (rows || []).map((row) => ({
      tournamentId: row.tournament_id,
      userId: row.user_id,
      seed: row.seed,
      eliminatedAt: row.eliminated_at,
      joinedAt: row.joined_at,
      user: User.safe(row),
    }));
  },

  async getMatches(id) {
    return query(
      `SELECT id, tournament_id AS tournamentId, round, match_num AS matchNum,
              player1_id AS player1Id, player2_id AS player2Id, winner_id AS winnerId, battle_id AS battleId
       FROM tournament_matches
       WHERE tournament_id = ?
       ORDER BY round ASC, match_num ASC`,
      [id]
    );
  },

  async join(id, userId) {
    const tournament = await this.getById(id);
    if (!tournament) {
      const err = new Error('토너먼트를 찾을 수 없습니다.');
      err.status = 404;
      throw err;
    }
    if (tournament.status !== 'open') {
      const err = new Error('모집 중인 토너먼트만 참가할 수 있습니다.');
      err.status = 400;
      throw err;
    }
    if (tournament.participantCount >= tournament.size) {
      const err = new Error('토너먼트 정원이 찼습니다.');
      err.status = 400;
      throw err;
    }
    const nextSeed = tournament.participantCount + 1;
    await run('INSERT IGNORE INTO tournament_participants (tournament_id, user_id, seed) VALUES (?,?,?)', [id, userId, nextSeed]);
    return this.getById(id);
  },

  async start(id, requesterId) {
    const tournament = await this.getById(id);
    if (!tournament) {
      const err = new Error('토너먼트를 찾을 수 없습니다.');
      err.status = 404;
      throw err;
    }
    if (requesterId !== undefined) {
      const requester = await User.findById(requesterId);
      if (requester?.role !== 'admin' && tournament.createdBy !== requesterId) {
        const err = new Error('토너먼트 생성자만 시작할 수 있습니다.');
        err.status = 403;
        throw err;
      }
    }
    if (tournament.status !== 'open') {
      const err = new Error('이미 시작된 토너먼트입니다.');
      err.status = 400;
      throw err;
    }
    if (tournament.participants.length < 2) {
      const err = new Error('최소 2명 이상 참가해야 시작할 수 있습니다.');
      err.status = 400;
      throw err;
    }

    const seeds = tournament.participants.map((entry) => entry.userId);
    while (seeds.length < tournament.size) seeds.push(null);
    const roundCount = nextPowerRound(tournament.size);
    for (let i = 0; i < seeds.length; i += 2) {
      await run(
        'INSERT IGNORE INTO tournament_matches (tournament_id, round, match_num, player1_id, player2_id, winner_id) VALUES (?,?,?,?,?,?)',
        [id, 1, (i / 2) + 1, seeds[i], seeds[i + 1], seeds[i + 1] ? null : seeds[i]]
      );
    }
    for (let round = 2; round <= roundCount; round += 1) {
      const matchCount = tournament.size / (2 ** round);
      for (let matchNum = 1; matchNum <= matchCount; matchNum += 1) {
        await run(
          'INSERT IGNORE INTO tournament_matches (tournament_id, round, match_num) VALUES (?,?,?)',
          [id, round, matchNum]
        );
      }
    }
    await run('UPDATE tournaments SET status=?, starts_at=COALESCE(starts_at, ?) WHERE id=?', ['in_progress', nowMySQL(), id]);
    await this.advanceByes(id);
    return this.getById(id);
  },

  async advanceByes(id) {
    const matches = await this.getMatches(id);
    for (const match of matches.filter((item) => item.winnerId)) {
      await this.advanceWinner(id, match.id, match.winnerId, { markCurrent: false });
    }
  },

  async advanceWinner(tournamentId, matchId, winnerId, { markCurrent = true, battleId = null } = {}) {
    const current = await queryOne('SELECT * FROM tournament_matches WHERE id=? AND tournament_id=?', [matchId, tournamentId]);
    if (!current) return null;
    if (markCurrent) {
      await run('UPDATE tournament_matches SET winner_id=?, battle_id=COALESCE(?, battle_id) WHERE id=?', [winnerId, battleId, matchId]);
    }
    const nextRound = Number(current.round) + 1;
    const nextMatchNum = Math.ceil(Number(current.match_num) / 2);
    const slot = Number(current.match_num) % 2 === 1 ? 'player1_id' : 'player2_id';
    const next = await queryOne('SELECT id FROM tournament_matches WHERE tournament_id=? AND round=? AND match_num=?', [tournamentId, nextRound, nextMatchNum]);
    if (!next) {
      await run('UPDATE tournaments SET status=? WHERE id=?', ['complete', tournamentId]);
      await run('UPDATE tournament_participants SET eliminated_at=COALESCE(eliminated_at, NOW()) WHERE tournament_id=? AND user_id<>?', [tournamentId, winnerId]);
      return this.getById(tournamentId);
    }
    await run(`UPDATE tournament_matches SET ${slot}=? WHERE id=?`, [winnerId, next.id]);
    return this.getById(tournamentId);
  },

  async createMatchBattle(tournamentId, matchId, requesterId) {
    const match = await queryOne(
      'SELECT * FROM tournament_matches WHERE id=? AND tournament_id=?',
      [matchId, tournamentId]
    );
    if (!match) {
      const err = new Error('매치를 찾을 수 없습니다.');
      err.status = 404;
      throw err;
    }
    if (match.winner_id) {
      const err = new Error('이미 종료된 매치입니다.');
      err.status = 400;
      throw err;
    }
    if (match.battle_id) {
      return { tournament: await this.getById(tournamentId), roomId: match.battle_id };
    }
    const playerIds = [match.player1_id, match.player2_id].filter(Boolean).map(Number);
    if (playerIds.length !== 2) {
      const err = new Error('두 플레이어가 모두 배정된 매치만 배틀을 만들 수 있습니다.');
      err.status = 400;
      throw err;
    }
    if (!playerIds.includes(Number(requesterId))) {
      const err = new Error('매치 참가자만 배틀을 만들 수 있습니다.');
      err.status = 403;
      throw err;
    }

    const requesterFirst = Number(requesterId) === playerIds[0] ? playerIds : [playerIds[1], playerIds[0]];
    const [inviter, invited] = await Promise.all([
      User.findById(requesterFirst[0]),
      User.findById(requesterFirst[1]),
    ]);
    if (!inviter || !invited) {
      const err = new Error('플레이어 정보를 찾을 수 없습니다.');
      err.status = 404;
      throw err;
    }
    const existing = await Battle.getInvite(invited.id);
    if (existing) {
      const err = new Error('상대방이 이미 다른 배틀 초대를 받은 상태입니다.');
      err.status = 409;
      throw err;
    }

    const room = await Battle.createRoom(
      { id: inviter.id, username: inviter.username },
      { id: invited.id, username: invited.username }
    );
    await run('UPDATE tournament_matches SET battle_id=? WHERE id=?', [room.id, matchId]);
    return { tournament: await this.getById(tournamentId), roomId: room.id, invitedId: invited.id };
  },

  async advanceWinnerByBattleId(battleId, winnerId) {
    if (!battleId || !winnerId) return null;
    const match = await queryOne(
      'SELECT id, tournament_id FROM tournament_matches WHERE battle_id=?',
      [battleId]
    );
    if (!match) return null;
    return this.advanceWinner(match.tournament_id, match.id, winnerId, { battleId });
  },
};
