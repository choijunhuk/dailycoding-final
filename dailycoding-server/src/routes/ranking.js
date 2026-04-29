import { Router } from 'express';
import { queryOne }  from '../config/mysql.js';
import { auth }   from '../middleware/auth.js';
import redis from '../config/redis.js';
import { User } from '../models/User.js';
import { RANKING_CACHE_TTL } from '../shared/constants.js';
import { getCurrentSeason, getSeasonRemainingDays, listSeasonRanking } from '../services/seasonService.js';

const router = Router();

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
