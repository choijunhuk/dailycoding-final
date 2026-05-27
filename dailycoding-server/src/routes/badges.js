import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { query, queryOne } from '../config/mysql.js';
import { TIER_ORDER, TIER_THRESHOLDS } from '../shared/constants.js';
import {
  grantSolveMilestoneBadges,
  grantStreakBadges,
  grantBattleWinBadges,
  grantMultilangBadge,
} from '../services/badgeService.js';
import { Reward } from '../models/Reward.js';

const router = Router();

const CATEGORY_ORDER = ['coding', 'streak', 'ranking', 'battle', 'xp', 'explore'];
const SOLVE_TARGETS = new Map([
  ['badge_first_solve', 1],
  ['badge_solve10', 10],
  ['badge_solve50', 50],
  ['badge_solve100', 100],
  ['badge_solve200', 200],
  ['badge_solve500', 500],
]);
const STREAK_TARGETS = new Map([
  ['badge_streak_7', 7],
  ['badge_streak_30', 30],
  ['badge_streak100', 100],
  ['badge_streak365', 365],
]);
const BATTLE_TARGETS = new Map([
  ['badge_battle_win', 1],
  ['badge_battle_5wins', 5],
  ['badge_battle_10wins', 10],
  ['badge_battle_20wins', 20],
]);
const XP_TARGETS = new Map([
  ['badge_xp_rookie', 2],
  ['title_routine_builder', 3],
  ['badge_xp_climber', 5],
  ['title_debug_maker', 7],
  ['badge_xp_veteran', 10],
  ['badge_xp_master', 20],
]);
const TIER_TARGETS = new Map([
  ['badge_bronze', 'bronze'],
  ['title_bronze', 'bronze'],
  ['badge_silver', 'silver'],
  ['title_silver', 'silver'],
  ['badge_gold', 'gold'],
  ['title_gold', 'gold'],
  ['badge_platinum', 'platinum'],
  ['title_platinum', 'platinum'],
  ['badge_emerald', 'emerald'],
  ['title_emerald', 'emerald'],
  ['badge_diamond', 'diamond'],
  ['title_diamond', 'diamond'],
  ['badge_master', 'master'],
  ['title_master', 'master'],
  ['badge_grandmaster', 'grandmaster'],
  ['badge_challenger', 'challenger'],
]);

function sortBadges(badges) {
  return badges.sort((a, b) => {
    const ca = CATEGORY_ORDER.indexOf(a.category ?? '') ?? 99;
    const cb = CATEGORY_ORDER.indexOf(b.category ?? '') ?? 99;
    if (ca !== cb) return ca - cb;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });
}

function percent(current, target, earned) {
  if (earned) return 100;
  if (!target || target <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((Number(current || 0) / target) * 100)));
}

async function getRewardContext(userId) {
  const [user, xpRow, battleRow, languageRow] = await Promise.all([
    queryOne('SELECT tier, rating, solved_count, streak FROM users WHERE id = ?', [userId]),
    queryOne('SELECT level FROM user_progression WHERE user_id = ?', [userId]).catch(() => null),
    queryOne('SELECT COUNT(*) AS cnt FROM battle_results WHERE user_id = ? AND result = ?', [userId, 'win']).catch(() => ({ cnt: 0 })),
    queryOne('SELECT COUNT(DISTINCT lang) AS cnt FROM submissions WHERE user_id = ? AND result = ?', [userId, 'correct']).catch(() => ({ cnt: 0 })),
  ]);
  return {
    tier: user?.tier || 'unranked',
    rating: Number(user?.rating || 0),
    solvedCount: Number(user?.solved_count || 0),
    streak: Number(user?.streak || 0),
    xpLevel: Number(xpRow?.level || 1),
    battleWins: Number(battleRow?.cnt || 0),
    languageCount: Number(languageRow?.cnt || 0),
  };
}

async function getOwnerStats() {
  const [totalRow, rows] = await Promise.all([
    queryOne('SELECT COUNT(*) AS cnt FROM users WHERE banned_at IS NULL'),
    query(
      `SELECT ri.code, COUNT(ur.user_id) AS ownerCount
       FROM reward_items ri
       LEFT JOIN user_rewards ur ON ur.reward_id = ri.id
       GROUP BY ri.id, ri.code`
    ),
  ]);
  const totalUsers = Math.max(0, Number(totalRow?.cnt || 0));
  const stats = {};
  for (const row of rows || []) {
    const ownerCount = Number(row.ownerCount ?? row.owner_count ?? 0);
    const ownerRatio = totalUsers > 0 ? Math.round((ownerCount / totalUsers) * 1000) / 10 : 0;
    stats[row.code] = { ownerCount, totalUsers, ownerRatio };
  }
  return stats;
}

function resolveRewardProgress(item, context) {
  const earned = Boolean(item.earned);
  if (SOLVE_TARGETS.has(item.code)) {
    const target = SOLVE_TARGETS.get(item.code);
    return { current: Math.min(context.solvedCount, target), target, percentage: percent(context.solvedCount, target, earned) };
  }
  if (STREAK_TARGETS.has(item.code)) {
    const target = STREAK_TARGETS.get(item.code);
    return { current: Math.min(context.streak, target), target, percentage: percent(context.streak, target, earned) };
  }
  if (BATTLE_TARGETS.has(item.code)) {
    const target = BATTLE_TARGETS.get(item.code);
    return { current: Math.min(context.battleWins, target), target, percentage: percent(context.battleWins, target, earned) };
  }
  if (XP_TARGETS.has(item.code)) {
    const target = XP_TARGETS.get(item.code);
    return { current: Math.min(context.xpLevel, target), target, percentage: percent(context.xpLevel, target, earned) };
  }
  if (TIER_TARGETS.has(item.code)) {
    const targetTier = TIER_TARGETS.get(item.code);
    const targetIndex = TIER_ORDER.indexOf(targetTier);
    const currentIndex = TIER_ORDER.indexOf(context.tier);
    if (targetTier === 'challenger') {
      return { current: earned ? 1 : 0, target: 1, percentage: earned ? 100 : 0 };
    }
    const targetRating = TIER_THRESHOLDS[targetTier] || 1;
    return {
      current: currentIndex >= targetIndex ? targetRating : Math.min(context.rating, targetRating),
      target: targetRating,
      percentage: currentIndex >= targetIndex ? 100 : percent(context.rating, targetRating, earned),
    };
  }
  if (item.code === 'badge_multilang') {
    return { current: Math.min(context.languageCount, 3), target: 3, percentage: percent(context.languageCount, 3, earned) };
  }
  return { current: earned ? 1 : 0, target: 1, percentage: earned ? 100 : null };
}

function enrichRewardItems(items, context, ownerStats) {
  return (items || []).map((item) => ({
    ...item,
    earned: Boolean(item.earned),
    progress: resolveRewardProgress(item, context),
    ownerStats: ownerStats[item.code] || { ownerCount: 0, totalUsers: 0, ownerRatio: 0 },
  }));
}

// GET /api/badges — 전체 훈장 목록 + 내 획득 여부 + 현재 장착 정보
router.get('/', auth, async (req, res) => {
  try {
    const [badges, userRow, progressContext, ownerStats] = await Promise.all([
      query(
        `SELECT ri.*,
                ur.earned_at,
                IF(ur.user_id IS NOT NULL, 1, 0) AS earned
         FROM reward_items ri
         LEFT JOIN user_rewards ur ON ur.reward_id = ri.id AND ur.user_id = ?
         WHERE ri.type = 'badge'
         ORDER BY ri.category, ri.sort_order, ri.id`,
        [req.user.id]
      ),
      queryOne('SELECT equipped_badge, equipped_title FROM users WHERE id = ?', [req.user.id]),
      getRewardContext(req.user.id),
      getOwnerStats(),
    ]);
    const enrichedBadges = sortBadges(enrichRewardItems(badges, progressContext, ownerStats));
    const earnedCount = enrichedBadges.filter((b) => b.earned).length;
    res.json({
      badges: enrichedBadges,
      earnedCount,
      totalCount: enrichedBadges.length,
      equippedBadge: userRow?.equipped_badge || null,
      equippedTitle: userRow?.equipped_title || null,
    });
  } catch (err) {
    console.error('[badges/]', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/badges/stats — 훈장·칭호별 보유 비율
router.get('/stats', async (req, res) => {
  try {
    const ownerStats = await getOwnerStats();
    const stats = {};
    for (const [code, stat] of Object.entries(ownerStats)) {
      stats[code] = {
        count: stat.ownerCount,
        pct: stat.ownerRatio,
        ownerCount: stat.ownerCount,
        totalUsers: stat.totalUsers,
        ownerRatio: stat.ownerRatio,
      };
    }
    res.json(stats);
  } catch (err) {
    console.error('[badges/stats]', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/badges/titles — 칭호 목록 + 내 획득 여부
router.get('/titles', auth, async (req, res) => {
  try {
    const [titles, progressContext, ownerStats] = await Promise.all([
      query(
      `SELECT ri.*,
              ur.earned_at,
              IF(ur.user_id IS NOT NULL, 1, 0) AS earned
       FROM reward_items ri
       LEFT JOIN user_rewards ur ON ur.reward_id = ri.id AND ur.user_id = ?
       WHERE ri.type = 'title'
       ORDER BY ri.sort_order, ri.id`,
      [req.user.id]
      ),
      getRewardContext(req.user.id),
      getOwnerStats(),
    ]);
    const enrichedTitles = enrichRewardItems(titles, progressContext, ownerStats);
    const earnedCount = enrichedTitles.filter((t) => t.earned).length;
    res.json({ titles: enrichedTitles, earnedCount, totalCount: enrichedTitles.length });
  } catch (err) {
    console.error('[badges/titles]', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/badges/sync — 현재 스탯 기반으로 미지급 배지/칭호 일괄 지급
router.post('/sync', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const ctx = await getRewardContext(userId);

    // Solve milestones
    await grantSolveMilestoneBadges(userId, ctx.solvedCount);
    // Streak milestones
    await grantStreakBadges(userId, ctx.streak);
    // Battle win milestones
    await grantBattleWinBadges(userId, ctx.battleWins);
    // Multilang badge
    await grantMultilangBadge(userId);
    // XP level unlocks
    await Reward.syncLevelUnlocks(userId, ctx.xpLevel);

    // Tier badges — grant all tiers at or below current
    const currentTierIdx = TIER_ORDER.indexOf(ctx.tier);
    const tierCodes = [];
    for (const [code, targetTier] of TIER_TARGETS.entries()) {
      if (TIER_ORDER.indexOf(targetTier) <= currentTierIdx) tierCodes.push(code);
    }
    await Promise.all(tierCodes.map(code => Reward.grant(userId, code)));

    // Speedrun: any correct submission within 10 minutes
    const speedRow = await queryOne(
      `SELECT 1 FROM submissions WHERE user_id = ? AND result = 'correct' AND solve_time_sec > 0 AND solve_time_sec <= 600 LIMIT 1`,
      [userId]
    );
    if (speedRow) {
      await Promise.all([
        Reward.grant(userId, 'badge_speedrun'),
        Reward.grant(userId, 'title_speedster'),
      ]);
    }

    // Gold killer: correct solve on gold+ tier problem
    const goldRow = await queryOne(
      `SELECT 1 FROM submissions s
       JOIN problems p ON s.problem_id = p.id
       WHERE s.user_id = ? AND s.result = 'correct'
         AND p.tier IN ('gold','platinum','emerald','diamond','master','grandmaster','challenger')
       LIMIT 1`,
      [userId]
    );
    if (goldRow) await Reward.grant(userId, 'badge_gold_killer');

    // Night owl: correct solve between midnight and 4am
    const nightRow = await queryOne(
      `SELECT 1 FROM submissions WHERE user_id = ? AND result = 'correct' AND HOUR(created_at) < 4 LIMIT 1`,
      [userId]
    );
    if (nightRow) {
      await Reward.grant(userId, 'badge_nightowl');
      await Reward.grant(userId, 'title_night_coder');
    }

    // First solve title (may have been missed if grant happened before title was seeded)
    if (ctx.solvedCount >= 1) await Reward.grant(userId, 'title_first_solve');

    res.json({ ok: true });
  } catch (err) {
    console.error('[badges/sync]', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/badges/user/:id — 다른 유저의 획득 훈장
router.get('/user/:id', async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (!userId || isNaN(userId)) return res.status(400).json({ message: 'Invalid user ID' });

  try {
    const allBadges = await query(
      `SELECT ri.*,
              ur.earned_at,
              IF(ur.user_id IS NOT NULL, 1, 0) AS earned
       FROM reward_items ri
       LEFT JOIN user_rewards ur ON ur.reward_id = ri.id AND ur.user_id = ?
       WHERE ri.type = 'badge'
       ORDER BY ur.earned_at DESC, ri.category, ri.sort_order`,
      [userId]
    );
    const earnedBadges = allBadges.filter((b) => b.earned);
    res.json({ badges: earnedBadges, earnedCount: earnedBadges.length, totalCount: allBadges.length });
  } catch (err) {
    console.error('[badges/user/:id]', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
