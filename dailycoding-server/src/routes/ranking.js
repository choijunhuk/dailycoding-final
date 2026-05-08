import { Router } from 'express';
import { query, queryOne }  from '../config/mysql.js';
import { auth }   from '../middleware/auth.js';
import redis from '../config/redis.js';
import { User } from '../models/User.js';
import { RANKING_CACHE_TTL } from '../shared/constants.js';
import { getCurrentSeason, getSeasonRemainingDays, listSeasonRanking } from '../services/seasonService.js';

const router = Router();

function rankRows(rows, scoreKey = 'score') {
  return rows
    .sort((a, b) => Number(b[scoreKey] || 0) - Number(a[scoreKey] || 0) || String(a.username || '').localeCompare(String(b.username || '')))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

async function hydrateUserSummary(userId) {
  const user = await queryOne('SELECT * FROM users WHERE id = ?', [Number(userId)]);
  if (!user || user.role === 'admin' || user.banned_at) return null;
  return {
    id: user.id,
    username: user.username,
    tier: user.tier,
    rating: Number(user.rating || 0),
    solved_count: Number(user.solved_count || 0),
    avatarUrl: user.avatar_url,
  };
}

router.get('/season', auth, async (req, res) => {
  try {
    const season = typeof req.query.season === 'string' && /^\d{4}-\d{2}$/.test(req.query.season)
      ? req.query.season
      : getCurrentSeason();
    const cacheKey = `ranking:season:${season}`;
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
    const rows = await query('SELECT * FROM battle_results ORDER BY created_at DESC LIMIT 1000');
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
    const items = [];
    for (const row of byUser.values()) {
      const user = await hydrateUserSummary(row.userId);
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
    res.json({ items: rankRows(items), total: items.length });
  } catch (err) {
    console.error('[ranking/battle]', err);
    res.status(500).json({ message: '배틀 랭킹을 불러오지 못했습니다.' });
  }
});

router.get('/collaboration', auth, async (req, res) => {
  try {
    const rows = await query('SELECT * FROM collaboration_scores ORDER BY updated_at DESC LIMIT 1000');
    const items = [];
    for (const row of rows || []) {
      const user = await hydrateUserSummary(row.user_id);
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
    res.json({ items: rankRows(items), total: items.length });
  } catch (err) {
    console.error('[ranking/collaboration]', err);
    res.status(500).json({ message: '협업 랭킹을 불러오지 못했습니다.' });
  }
});

router.get('/overall', auth, async (req, res) => {
  try {
    const users = await query('SELECT * FROM users WHERE role != ? ORDER BY rating DESC LIMIT 200', ['admin']);
    const battleRows = await query('SELECT * FROM battle_results ORDER BY created_at DESC LIMIT 2000');
    const collaborationRows = await query('SELECT * FROM collaboration_scores ORDER BY updated_at DESC LIMIT 2000');
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
          id: user.id,
          username: user.username,
          tier: user.tier,
          rating: algorithmScore,
          solved_count: Number(user.solved_count || 0),
          algorithmScore,
          battleScore,
          collaborationScore,
          score: algorithmScore + battleScore + collaborationScore,
        };
      });
    res.json({ items: rankRows(items), total: items.length });
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
    const cacheKey = `ranking:page:${page}:limit:${limit}:tier:${tier || 'all'}:sort:${sort}`;
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

export default router;
