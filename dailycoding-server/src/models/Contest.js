import { nowMySQL } from '../config/dateutil.js';
import { query, queryOne, insert, run } from '../config/mysql.js';
import redis from '../config/redis.js';
import { Reward } from './Reward.js';

// ★ DB enum(waiting/running/ended) → 클라이언트(upcoming/live/ended) 매핑
const STATUS_MAP = { waiting:'upcoming', running:'live', ended:'ended', upcoming:'upcoming', live:'live' };
const REVERSE_STATUS_MAP = { live:'running', upcoming:'waiting' };
const DEFAULT_REWARD_RULES = Object.freeze([
  { rankFrom: 1, rankTo: 1, rewardCode: 'badge_contest1' },
  { rankFrom: 1, rankTo: 1, rewardCode: 'title_champion' },
  { rankFrom: 2, rankTo: 2, rewardCode: 'badge_contest2' },
  { rankFrom: 3, rankTo: 3, rewardCode: 'badge_contest3' },
]);
const MAX_REWARD_RULES = 30;

function normalizeContestText(value, maxLength = 200) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeRewardRuleRecord(record) {
  return {
    rankFrom: Number(record.rank_from ?? record.rankFrom),
    rankTo: Number(record.rank_to ?? record.rankTo),
    rewardCode: String((record.reward_code ?? record.rewardCode) || ''),
  };
}

function normalizeRewardRulesInput(rules = []) {
  if (!Array.isArray(rules)) return [];
  const normalized = [];
  const dedupe = new Set();

  for (const raw of rules.slice(0, MAX_REWARD_RULES)) {
    const rankFrom = clampInt(raw?.rankFrom, 1, 1, 999);
    const rankToRaw = clampInt(raw?.rankTo, rankFrom, 1, 999);
    const rankTo = Math.max(rankFrom, rankToRaw);
    const rewardCode = normalizeContestText(raw?.rewardCode, 50);
    if (!rewardCode) continue;

    const key = `${rankFrom}:${rankTo}:${rewardCode}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    normalized.push({ rankFrom, rankTo, rewardCode });
  }
  return normalized;
}

function norm(c) {
  if (!c) return null;
  return {
    id:           c.id,
    name:         c.name,
    desc:         c.description ?? '',
    status:       STATUS_MAP[c.status] || c.status,
    duration:     c.duration_min  ?? c.duration ?? 60,
    privacy:      c.privacy === 'private' ? '비공개' : '공개',
    joinType:     c.join_type ?? 'direct',
    securityCode: c.security_code ?? null,
    max:          c.max_users    ?? c.max ?? 20,
    participants: c.participant_count ?? c.participants ?? 0,
    host:         c.host_name    ?? '',
    hostId:       c.host_id,
    createdAt:    c.created_at,
    rewardRules:  c.reward_rules ?? c.rewardRules ?? [],
  };
}

export const Contest = {
  async getRewardRules(contestId) {
    const rows = await query(
      'SELECT rank_from, rank_to, reward_code FROM contest_reward_rules WHERE contest_id=? ORDER BY rank_from ASC, rank_to ASC, reward_code ASC',
      [contestId]
    );
    return (rows || []).map(normalizeRewardRuleRecord);
  },

  async setRewardRules(contestId, rules = []) {
    const normalizedRules = normalizeRewardRulesInput(rules);
    await run('DELETE FROM contest_reward_rules WHERE contest_id=?', [contestId]);
    if (normalizedRules.length === 0) return [];

    const validCodesRows = await query(
      `SELECT code FROM reward_items WHERE code IN (${normalizedRules.map(() => '?').join(',')})`,
      normalizedRules.map((rule) => rule.rewardCode)
    );
    const validCodes = new Set((validCodesRows || []).map((row) => row.code));
    const filteredRules = normalizedRules.filter((rule) => validCodes.has(rule.rewardCode));

    for (const rule of filteredRules) {
      await run(
        'INSERT INTO contest_reward_rules (contest_id, rank_from, rank_to, reward_code) VALUES (?,?,?,?)',
        [contestId, rule.rankFrom, rule.rankTo, rule.rewardCode]
      );
    }
    return filteredRules;
  },

  async getEffectiveRewardRules(contestId) {
    const customRules = await this.getRewardRules(contestId);
    return customRules.length > 0 ? customRules : [...DEFAULT_REWARD_RULES];
  },

  async getRewardRulesMap(contestIds = []) {
    if (!Array.isArray(contestIds) || contestIds.length === 0) return new Map();
    const rows = await query(
      `SELECT contest_id, rank_from, rank_to, reward_code
         FROM contest_reward_rules
        WHERE contest_id IN (${contestIds.map(() => '?').join(',')})
        ORDER BY contest_id ASC, rank_from ASC, rank_to ASC, reward_code ASC`,
      contestIds
    );
    const map = new Map();
    for (const row of rows || []) {
      const contestId = Number(row.contest_id);
      const current = map.get(contestId) || [];
      current.push(normalizeRewardRuleRecord(row));
      map.set(contestId, current);
    }
    return map;
  },

  async findAll(status, search) {
    const normalizedSearch = normalizeContestText(search, 100);
    let sql = 'SELECT * FROM contests';
    let params = [];
    if (normalizedSearch) {
      sql += ' WHERE (name LIKE ? OR description LIKE ?)';
      params.push(`%${normalizedSearch}%`, `%${normalizedSearch}%`);
    }
    let rows = await query(sql, params);
    rows = rows || [];
    const dbStatus = REVERSE_STATUS_MAP[status] || status;
    if (dbStatus && dbStatus !== 'all') rows = rows.filter(c => c.status === dbStatus);
    rows.sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));
    // 참가자 수 일괄 집계 (N+1 → GROUP BY 단일 쿼리로 개선)
    if (rows.length > 0) {
      const contestIds = rows.map(c => c.id);
      const counts = await query(
        `SELECT contest_id, COUNT(*) AS cnt FROM contest_participants WHERE contest_id IN (${contestIds.map(() => '?').join(',')}) GROUP BY contest_id`,
        contestIds
      );
      const countMap = new Map(counts.map(r => [Number(r.contest_id), Number(r.cnt)]));
      rows.forEach(c => { c.participant_count = countMap.get(Number(c.id)) || 0; });
    }
    const rewardRulesMap = await this.getRewardRulesMap(rows.map((contest) => Number(contest.id)));
    rows.forEach((contest) => {
      contest.reward_rules = rewardRulesMap.get(Number(contest.id)) || [];
    });
    return rows.map(norm);
  },

  async findById(id) {
    const c = await queryOne('SELECT * FROM contests WHERE id=?', [id]);
    if (!c) return null;
    const parts = await query('SELECT COUNT(*) AS cnt FROM contest_participants WHERE contest_id=?', [id]);
    c.participant_count = parts?.[0]?.cnt || 0;
    c.reward_rules = await this.getRewardRules(id);
    return norm(c);
  },

  async create({ name, description, durationMin, privacy, joinType, securityCode, maxUsers, hostId, rewardRules }) {
    const createdAt = nowMySQL();
    const normalizedName = normalizeContestText(name, 100);
    const normalizedDescription = normalizeContestText(description, 1000);
    const normalizedDuration = clampInt(durationMin, 60, 10, 720);
    const normalizedMaxUsers = clampInt(maxUsers, 20, 2, 500);
    const normalizedPrivacy = privacy === 'private' ? 'private' : 'public';
    const normalizedJoinType = joinType === 'approval' ? 'approval' : 'direct';
    const normalizedSecurityCode = normalizeContestText(securityCode, 100) || null;

    const id = await insert(
      'INSERT INTO contests (name,description,duration_min,privacy,join_type,security_code,max_users,host_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [
        normalizedName,
        normalizedDescription,
        normalizedDuration,
        normalizedPrivacy,
        normalizedJoinType,
        normalizedSecurityCode,
        normalizedMaxUsers,
        hostId, 
        createdAt
      ]
    );
    await this.setRewardRules(id, rewardRules || []);
    return this.findById(id);
  },

  async updateStatus(id, status) {
    if (status === 'running') {
      await run('UPDATE contests SET status=?, started_at=COALESCE(started_at, NOW()) WHERE id=?', [status, id]);
    } else {
      await run('UPDATE contests SET status=? WHERE id=?', [status, id]);
    }
    return this.findById(id);
  },

  async delete(id) {
    const customProblems = await query("SELECT id FROM problems WHERE contest_id=? AND COALESCE(visibility, 'global')='contest'", [id]);
    for (const problem of customProblems || []) {
      await run('DELETE FROM problem_testcases WHERE problem_id=?', [problem.id]);
      await run('DELETE FROM problem_examples WHERE problem_id=?', [problem.id]);
      await run('DELETE FROM problem_tags WHERE problem_id=?', [problem.id]);
      await run('DELETE FROM problems WHERE id=?', [problem.id]);
    }
    await run('DELETE FROM contest_problems WHERE contest_id=?', [id]);
    await run('DELETE FROM contest_participants WHERE contest_id=?', [id]);
    await run('DELETE FROM contest_join_requests WHERE contest_id=?', [id]);
    await run('DELETE FROM contest_reward_grants WHERE contest_id=?', [id]);
    await run('DELETE FROM contest_reward_rules WHERE contest_id=?', [id]);
    return run('DELETE FROM contests WHERE id=?', [id]);
  },

  async isJoined(contestId, userId) {
    const participation = await queryOne('SELECT 1 FROM contest_participants WHERE contest_id=? AND user_id=?', [contestId, userId]);
    if (participation) return { status: 'joined' };
    
    const request = await queryOne('SELECT status FROM contest_join_requests WHERE contest_id=? AND user_id=?', [contestId, userId]);
    if (request) return { status: request.status };
    
    return null;
  },

  async getMyStatuses(userId, contestIds = []) {
    const ids = [...new Set((contestIds || []).map((id) => Number(id)).filter(Boolean))];
    const statusMap = new Map();
    if (!userId || ids.length === 0) return statusMap;

    const placeholders = ids.map(() => '?').join(',');
    const [participants, requests] = await Promise.all([
      query(
        `SELECT contest_id
         FROM contest_participants
         WHERE user_id = ? AND contest_id IN (${placeholders})`,
        [userId, ...ids]
      ),
      query(
        `SELECT contest_id, status
         FROM contest_join_requests
         WHERE user_id = ? AND contest_id IN (${placeholders})`,
        [userId, ...ids]
      ),
    ]);

    for (const row of participants || []) {
      statusMap.set(Number(row.contest_id), 'joined');
    }
    for (const row of requests || []) {
      const contestId = Number(row.contest_id);
      if (!statusMap.has(contestId)) {
        statusMap.set(contestId, row.status || null);
      }
    }

    return statusMap;
  },

  async join(contestId, userId) {
    const joinedAt = nowMySQL();
    await run('INSERT IGNORE INTO contest_participants (contest_id,user_id,joined_at) VALUES (?,?,?)', [contestId, userId, joinedAt]);
    // 참가 승인이 되면 요청 삭제
    await run('DELETE FROM contest_join_requests WHERE contest_id=? AND user_id=?', [contestId, userId]);
  },

  async createJoinRequest(contestId, userId) {
    await run('INSERT IGNORE INTO contest_join_requests (contest_id, user_id) VALUES (?,?)', [contestId, userId]);
  },

  async getJoinRequests(contestId) {
    return query(`
      SELECT r.id, r.user_id AS userId, u.username, r.status, r.created_at
      FROM contest_join_requests r
      JOIN users u ON r.user_id = u.id
      WHERE r.contest_id = ? AND r.status = 'pending'
      ORDER BY r.created_at ASC
    `, [contestId]);
  },

  async updateJoinRequestStatus(requestId, status) {
    const req = await queryOne('SELECT * FROM contest_join_requests WHERE id=?', [requestId]);
    if (!req) return;
    
    await run('UPDATE contest_join_requests SET status=? WHERE id=?', [status, requestId]);
    
    if (status === 'approved') {
      await this.join(req.contest_id, req.user_id);
    }
  },

  async getParticipantCount(contestId) {
    const row = await queryOne('SELECT COUNT(*) AS cnt FROM contest_participants WHERE contest_id=?', [contestId]);
    return row?.cnt || 0;
  },

  async updateRedisLeaderboard(contestId, userId, score) {
    const key = `contest:${contestId}:leaderboard`;
    const participant = await queryOne('SELECT joined_at FROM contest_participants WHERE contest_id=? AND user_id=?', [contestId, userId]);
    const joinedAt = participant?.joined_at;
    const timeWeight = joinedAt ? (1 - new Date(joinedAt).getTime() / 10000000000000) : 0;
    const compositeScore = score + timeWeight;
    await redis.zAdd(key, compositeScore, userId);
  },

  async getLeaderboard(contestId) {
    const key = `contest:${contestId}:leaderboard`;
    const exists = await redis.exists(key);

    if (exists) {
      const redisRows = await redis.zRevRangeWithScores(key, 0, 49);
      if (redisRows.length > 0) {
        // Fetch usernames for these users
        const userIds = redisRows.map(r => r.value);
        const users = await query(`SELECT id, username FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`, userIds);
        const userMap = users.reduce((acc, u) => {
          acc[u.id] = u.username;
          return acc;
        }, {});

        // NOTE: Redis doesn't store joined_at, so it will be null from Redis source.
        return redisRows.map(r => ({
          userId: Number(r.value),
          username: userMap[r.value] || 'Unknown',
          score: Math.floor(r.score),
          joined_at: null
        }));
      }
    }

    // Hydration logic: fetch from MySQL, populate Redis, and return.
    const mysqlRows = await query(`
      SELECT u.id AS userId, u.username, cp.score, cp.joined_at
      FROM contest_participants cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.contest_id = ?
      ORDER BY cp.score DESC, cp.joined_at ASC
      LIMIT 50
    `, [contestId]);

    for (const row of mysqlRows) {
      const timeWeight = row.joined_at ? (1 - new Date(row.joined_at).getTime() / 10000000000000) : 0;
      await redis.zAdd(key, row.score + timeWeight, row.userId);
    }

    return mysqlRows;
  },

  async grantRankRewards(contestId, leaderboardRows = []) {
    const rules = await this.getEffectiveRewardRules(contestId);
    if (!Array.isArray(leaderboardRows) || leaderboardRows.length === 0 || rules.length === 0) {
      return [];
    }

    const grants = [];
    for (let i = 0; i < leaderboardRows.length; i += 1) {
      const participant = leaderboardRows[i];
      const rankPosition = i + 1;
      const userId = Number(participant?.userId);
      if (!Number.isFinite(userId) || userId <= 0) continue;

      const matchedRules = rules.filter((rule) => rankPosition >= rule.rankFrom && rankPosition <= rule.rankTo);
      for (const rule of matchedRules) {
        const alreadyGranted = await queryOne(
          'SELECT 1 FROM contest_reward_grants WHERE contest_id=? AND user_id=? AND reward_code=? LIMIT 1',
          [contestId, userId, rule.rewardCode]
        );
        if (alreadyGranted) continue;

        await run(
          'INSERT INTO contest_reward_grants (contest_id, user_id, rank_position, reward_code) VALUES (?,?,?,?)',
          [contestId, userId, rankPosition, rule.rewardCode]
        );
        await Reward.grant(userId, rule.rewardCode);
        grants.push({ contestId, userId, rankPosition, rewardCode: rule.rewardCode });
      }
    }
    return grants;
  },

  async getProblems(contestId) {
    return query(`
      SELECT p.id, p.title, p.tier, p.difficulty, p.visibility, p.contest_id, cp.ord
      FROM contest_problems cp
      JOIN problems p ON cp.problem_id = p.id
      WHERE cp.contest_id = ?
      ORDER BY cp.ord ASC, p.id ASC
    `, [contestId]);
  },

  async addProblem(contestId, problemId) {
    const maxOrd = await queryOne(
      'SELECT COALESCE(MAX(ord),0) AS m FROM contest_problems WHERE contest_id=?',
      [contestId]
    );
    await run(
      'INSERT IGNORE INTO contest_problems (contest_id, problem_id, ord) VALUES (?,?,?)',
      [contestId, problemId, (maxOrd?.m ?? 0) + 1]
    );
  },

  async removeProblem(contestId, problemId) {
    await run(
      'DELETE FROM contest_problems WHERE contest_id=? AND problem_id=?',
      [contestId, problemId]
    );
  },
};
