import { Router } from 'express';
import { query, queryOne }  from '../config/mysql.js';
import { auth }   from '../middleware/auth.js';
import redis from '../config/redis.js';
import { User } from '../models/User.js';
import { RANKING_CACHE_TTL } from '../shared/constants.js';
import { getCurrentSeason, getSeasonRemainingDays, listSeasonRanking } from '../services/seasonService.js';

const router = Router();

export function rankRows(rows, scoreKey = 'score') {
  return rows
    .sort((a, b) => Number(b[scoreKey] || 0) - Number(a[scoreKey] || 0) || String(a.username || '').localeCompare(String(b.username || '')))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export function normalizeRankingUser(user = {}) {
  return {
    id: user.id,
    username: user.username,
    name: user.username,
    tier: user.tier || 'unranked',
    rating: Number(user.rating || 0),
    solved_count: Number(user.solved_count || 0),
    solved: Number(user.solved_count || 0),
    streak: Number(user.streak || 0),
    avatarUrl: user.avatar_url || user.avatarUrl || null,
    avatar_url: user.avatar_url || user.avatarUrl || null,
    avatarUrlCustom: user.avatar_url_custom || user.avatarUrlCustom || null,
    avatar_url_custom: user.avatar_url_custom || user.avatarUrlCustom || null,
    avatarEmoji: user.avatar_emoji || user.avatarEmoji || null,
    avatar_emoji: user.avatar_emoji || user.avatarEmoji || null,
    avatarColor: user.avatar_color || user.avatarColor || null,
    avatar_color: user.avatar_color || user.avatarColor || null,
    avatarSource: user.avatar_source || user.avatarSource || 'site',
    avatar_source: user.avatar_source || user.avatarSource || 'site',
    equippedBadge: user.equipped_badge || user.equippedBadge || null,
    equippedTitle: user.equipped_title || user.equippedTitle || null,
    joinDate: user.join_date || user.joinDate || null,
  };
}

export function teamAvatarEmoji(name = '') {
  const choices = ['🏢', '🚀', '🔥', '⚡', '🧠', '🏆'];
  const seed = String(name || 'team').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return choices[seed % choices.length];
}

export function normalizeTeamRankingRow(row = {}, index = 0) {
  const memberCount = Number(row.member_count || row.memberCount || 0);
  const avgRating = Math.round(Number(row.avg_rating || row.avgRating || 0));
  const totalSolved = Number(row.total_solved || row.totalSolved || 0);
  const weeklySolved = Number(row.weekly_solved || row.weeklySolved || 0);
  const topRating = Number(row.top_rating || row.topRating || 0);
  const teamScore = Math.round(Number(row.team_score || row.teamScore || (avgRating * 0.4 + totalSolved * 10 + weeklySolved * 30 + memberCount * 25)));

  return {
    id: row.id,
    rank: index + 1,
    name: row.name || '소속',
    avatar_emoji: row.avatar_emoji || row.avatarEmoji || teamAvatarEmoji(row.name),
    avatarEmoji: row.avatar_emoji || row.avatarEmoji || teamAvatarEmoji(row.name),
    member_count: memberCount,
    memberCount,
    avg_rating: avgRating,
    avgRating,
    total_solved: totalSolved,
    totalSolved,
    weekly_solved: weeklySolved,
    weeklySolved,
    top_rating: topRating,
    topRating,
    team_score: teamScore,
    teamScore,
  };
}

async function hydrateUsersBatch(userIds) {
  if (!userIds.length) return new Map();
  const ids = [...new Set(userIds.map(Number))];
  const placeholders = ids.map(() => '?').join(',');
  const rows = await query(
    `SELECT id, username, tier, rating, solved_count, streak,
            avatar_url, avatar_url_custom, avatar_emoji, avatar_color, avatar_source,
            equipped_badge, equipped_title, join_date, role, banned_at
     FROM users WHERE id IN (${placeholders})`,
    ids
  );
  const map = new Map();
  for (const user of rows || []) {
    if (user.role === 'admin' || user.banned_at) continue;
    map.set(Number(user.id), normalizeRankingUser(user));
  }
  return map;
}

router.get('/season', auth, async (req, res) => {
  try {
    const season = typeof req.query.season === 'string' && /^\d{4}-\d{2}$/.test(req.query.season)
      ? req.query.season
      : getCurrentSeason();
    const cacheKey = `ranking:v2:season:${season}`;
    const cached = await redis.getJSON(cacheKey);
    if (cached) return res.json(cached);

    const rows = await listSeasonRanking(season, 100);
    const payload = {
      season,
      remainingDays: season === getCurrentSeason() ? getSeasonRemainingDays() : null,
      items: (rows || []).map((row, index) => ({
        rank: index + 1,
        id: row.user_id,
        username: row.username,
        tier: row.tier,
        avatarEmoji: row.avatar_emoji,
        avatar_emoji: row.avatar_emoji,
        avatarUrl: row.avatar_url,
        avatar_url: row.avatar_url,
        avatarUrlCustom: row.avatar_url_custom,
        avatar_url_custom: row.avatar_url_custom,
        avatarColor: row.avatar_color,
        avatar_color: row.avatar_color,
        avatarSource: row.avatar_source || 'site',
        avatar_source: row.avatar_source || 'site',
        seasonRating: row.season_rating,
        solvedCount: row.solved_count,
        battleWins: row.battle_wins,
        finalRank: row.final_rank,
        rewardGranted: Boolean(row.reward_granted),
      })),
    };
    await redis.setJSON(cacheKey, payload, RANKING_CACHE_TTL);
    res.json(payload);
  } catch (err) {
    console.error('[ranking/season]', err.message);
    res.status(500).json({ message: '서버 오류' });
  }
});

router.get('/battle', auth, async (req, res) => {
  try {
    const cacheKey = 'ranking:v2:battle';
    const cached = await redis.getJSON(cacheKey);
    if (cached) return res.json(cached);

    const rows = await query('SELECT user_id, result, battle_score_delta, score FROM battle_results ORDER BY created_at DESC LIMIT 1000');
    const byUser = new Map();
    for (const row of rows || []) {
      const userId = Number(row.user_id);
      const prev = byUser.get(userId) || { userId, battles: 0, wins: 0, draws: 0, score: 0 };
      prev.battles += 1;
      prev.wins += row.result === 'win' ? 1 : 0;
      prev.draws += row.result === 'draw' ? 1 : 0;
      prev.score += Number(row.battle_score_delta ?? row.score ?? 0);
      byUser.set(userId, prev);
    }
    const userMap = await hydrateUsersBatch([...byUser.keys()]);
    const items = [];
    for (const row of byUser.values()) {
      const user = userMap.get(row.userId);
      if (!user) continue;
      items.push({
        ...user,
        battleScore: row.score,
        score: row.score,
        battles: row.battles,
        wins: row.wins,
        winRate: row.battles > 0 ? Math.round((row.wins / row.battles) * 100) : 0,
      });
    }
    const payload = { items: rankRows(items), total: items.length };
    await redis.setJSON(cacheKey, payload, RANKING_CACHE_TTL);
    res.json(payload);
  } catch (err) {
    console.error('[ranking/battle]', err);
    res.status(500).json({ message: '배틀 랭킹을 불러오지 못했습니다.' });
  }
});

router.get('/collaboration', auth, async (req, res) => {
  try {
    const cacheKey = 'ranking:v2:collaboration';
    const cached = await redis.getJSON(cacheKey);
    if (cached) return res.json(cached);

    const rows = await query('SELECT user_id, review_score, suggestion_score, accepted_count, total_count FROM collaboration_scores ORDER BY updated_at DESC LIMIT 1000');
    const userMap = await hydrateUsersBatch((rows || []).map(r => r.user_id));
    const items = [];
    for (const row of rows || []) {
      const user = userMap.get(Number(row.user_id));
      if (!user) continue;
      const reviewScore = Number(row.review_score || 0);
      const suggestionScore = Number(row.suggestion_score || 0);
      items.push({
        ...user,
        reviewScore,
        suggestionScore,
        acceptedCount: Number(row.accepted_count || 0),
        totalCount: Number(row.total_count || 0),
        score: reviewScore + suggestionScore,
      });
    }
    const payload = { items: rankRows(items), total: items.length };
    await redis.setJSON(cacheKey, payload, RANKING_CACHE_TTL);
    res.json(payload);
  } catch (err) {
    console.error('[ranking/collaboration]', err);
    res.status(500).json({ message: '협업 랭킹을 불러오지 못했습니다.' });
  }
});

router.get('/overall', auth, async (req, res) => {
  try {
    const cacheKey = 'ranking:v2:overall';
    const cached = await redis.getJSON(cacheKey);
    if (cached) return res.json(cached);

    const users = await query(`SELECT id, username, tier, rating, solved_count, streak, join_date,
                                      avatar_url, avatar_url_custom, avatar_emoji, avatar_color, avatar_source,
                                      equipped_badge, equipped_title, banned_at
                               FROM users WHERE role != ? ORDER BY rating DESC LIMIT 200`, ['admin']);
    const battleRows = await query('SELECT user_id, battle_score_delta, score FROM battle_results ORDER BY created_at DESC LIMIT 2000');
    const collaborationRows = await query('SELECT user_id, review_score, suggestion_score FROM collaboration_scores ORDER BY updated_at DESC LIMIT 2000');
    const battleByUser = new Map();
    const collaborationByUser = new Map();
    for (const row of battleRows || []) {
      const userId = Number(row.user_id);
      battleByUser.set(userId, (battleByUser.get(userId) || 0) + Number(row.battle_score_delta ?? row.score ?? 0));
    }
    for (const row of collaborationRows || []) {
      collaborationByUser.set(Number(row.user_id), Number(row.review_score || 0) + Number(row.suggestion_score || 0));
    }
    const items = (users || [])
      .filter((user) => !user.banned_at)
      .map((user) => {
        const algorithmScore = Number(user.rating || 0);
        const battleScore = battleByUser.get(Number(user.id)) || 0;
        const collaborationScore = collaborationByUser.get(Number(user.id)) || 0;
        return {
          ...normalizeRankingUser(user),
          rating: algorithmScore,
          algorithmScore,
          battleScore,
          collaborationScore,
          score: algorithmScore + battleScore + collaborationScore,
        };
      });
    const payload = { items: rankRows(items), total: items.length };
    await redis.setJSON(cacheKey, payload, RANKING_CACHE_TTL);
    res.json(payload);
  } catch (err) {
    console.error('[ranking/overall]', err);
    res.status(500).json({ message: '종합 랭킹을 불러오지 못했습니다.' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(10, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const VALID_TIERS = ['iron','bronze','silver','gold','platinum','emerald','diamond','master','grandmaster','challenger'];
    const tier = VALID_TIERS.includes(req.query.tier) ? req.query.tier : null;
    const sort = req.query.sort === 'solved_count' ? 'solved_count' : 'rating';
    const cacheKey = `ranking:v2:page:${page}:limit:${limit}:tier:${tier || 'all'}:sort:${sort}`;
    const cached = await redis.getJSON(cacheKey);
    if (cached) return res.json(cached);

    const [rows, totalRow, meRow] = await Promise.all([
      User.getRanking(limit, { offset, tier, sort }),
      queryOne(
        `SELECT COUNT(*) AS cnt
         FROM users
         WHERE role != ?
           AND banned_at IS NULL
           ${tier ? 'AND tier = ?' : ''}`,
        tier ? ['admin', tier] : ['admin']
      ),
      queryOne(
        `SELECT COUNT(*) + 1 AS \`rank\`
         FROM users
         WHERE role != ?
           AND banned_at IS NULL
           ${tier ? 'AND tier = ?' : ''}
           AND (
             ${sort === 'solved_count' ? 'solved_count > (SELECT solved_count FROM users WHERE id = ?)' : 'rating > (SELECT rating FROM users WHERE id = ?)'}
             OR (
               ${sort === 'solved_count' ? 'solved_count = (SELECT solved_count FROM users WHERE id = ?)' : 'rating = (SELECT rating FROM users WHERE id = ?)'}
               AND ${sort === 'solved_count' ? 'rating > (SELECT rating FROM users WHERE id = ?)' : 'solved_count > (SELECT solved_count FROM users WHERE id = ?)'}
             )
           )`,
        tier ? ['admin', tier, req.user.id, req.user.id, req.user.id] : ['admin', req.user.id, req.user.id, req.user.id]
      ),
    ]);

    const items = (rows || []).map((user, index) => ({
      ...user,
      solved: user.solved_count,
      avatarUrl: user.avatar_url,
      rank: offset + index + 1,
    }));
    const total = Number(totalRow?.cnt) || 0;
    const payload = {
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      myRank: Number(meRow?.rank) || null,
    };
    await redis.setJSON(cacheKey, payload, RANKING_CACHE_TTL);
    res.json(payload);
  } catch (err) {
    console.error('[ranking]', err.message);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 소속(팀) 랭킹 ────────────────────────────────────────────
router.get('/teams', auth, async (req, res) => {
  const cacheKey = 'ranking:v2:teams';
  try {
    const cached = await redis.getJSON(cacheKey);
    if (cached) return res.json(cached);
    const rows = await query(`
      SELECT t.id, t.name,
             COUNT(DISTINCT tm.user_id) AS member_count,
             ROUND(AVG(COALESCE(u.rating, 0)), 0) AS avg_rating,
             SUM(COALESCE(u.solved_count, 0)) AS total_solved,
             COALESCE(SUM(COALESCE(ws.weekly_solved, 0)), 0) AS weekly_solved,
             MAX(COALESCE(u.rating, 0)) AS top_rating,
             ROUND(
               AVG(COALESCE(u.rating, 0)) * 0.4 +
               SUM(COALESCE(u.solved_count, 0)) * 10 +
               COALESCE(SUM(COALESCE(ws.weekly_solved, 0)), 0) * 30 +
               COUNT(DISTINCT tm.user_id) * 25
             , 0) AS team_score
      FROM teams t
      JOIN team_members tm ON t.id = tm.team_id
      JOIN users u ON tm.user_id = u.id
      LEFT JOIN (
        SELECT user_id, COUNT(DISTINCT problem_id) AS weekly_solved
        FROM submissions
        WHERE result = 'correct'
          AND submitted_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY user_id
      ) ws ON ws.user_id = u.id
      WHERE u.role != 'admin'
        AND u.banned_at IS NULL
      GROUP BY t.id, t.name
      ORDER BY team_score DESC, avg_rating DESC, total_solved DESC, member_count DESC, t.name ASC
      LIMIT 50
    `);
    const result = (rows || []).map(normalizeTeamRankingRow);
    await redis.setJSON(cacheKey, result, 120);
    res.json(result);
  } catch (err) {
    console.error('[ranking/teams]', err.message);
    res.status(500).json({ message: '소속 랭킹을 불러오지 못했습니다.' });
  }
});

export default router;
