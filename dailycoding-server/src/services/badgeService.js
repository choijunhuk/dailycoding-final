import { Reward } from '../models/Reward.js';
import { query } from '../config/mysql.js';

const GOLD_TIERS = new Set(['gold', 'platinum', 'emerald', 'diamond', 'master', 'grandmaster', 'challenger']);

export async function grantSolveMilestoneBadges(userId, solvedCount) {
  const milestones = [
    [1,   'badge_first_solve'],
    [10,  'badge_solve10'],
    [50,  'badge_solve50'],
    [100, 'badge_solve100'],
    [200, 'badge_solve200'],
    [500, 'badge_solve500'],
  ];
  for (const [threshold, code] of milestones) {
    if (solvedCount >= threshold) await Reward.grant(userId, code);
  }
}

export async function grantStreakBadges(userId, streak) {
  const milestones = [
    [7,   'badge_streak_7'],
    [30,  'badge_streak_30'],
    [100, 'badge_streak100'],
    [365, 'badge_streak365'],
  ];
  for (const [threshold, code] of milestones) {
    if (streak >= threshold) await Reward.grant(userId, code);
  }
}

export async function grantTierBadge(userId, tier) {
  const map = {
    bronze:      ['badge_bronze',      'title_bronze'],
    silver:      ['badge_silver',      'title_silver'],
    gold:        ['badge_gold',        'title_gold'],
    platinum:    ['badge_platinum',    'title_platinum'],
    emerald:     ['badge_emerald'],
    diamond:     ['badge_diamond',     'title_diamond'],
    master:      ['badge_master'],
    grandmaster: ['badge_grandmaster'],
    challenger:  ['badge_challenger'],
  };
  const codes = map[tier] || [];
  for (const code of codes) await Reward.grant(userId, code);
}

export async function grantBattleWinBadges(userId, totalWins) {
  const milestones = [
    [1,  'badge_battle_win'],
    [5,  'badge_battle_5wins'],
    [10, 'badge_battle_10wins'],
    [20, 'badge_battle_20wins'],
  ];
  for (const [threshold, code] of milestones) {
    if (totalWins >= threshold) await Reward.grant(userId, code);
  }
}

export async function grantXpLevelBadges(userId, level) {
  if (level >= 20) await Reward.grant(userId, 'badge_xp_master');
}

export async function grantExploreBadges(userId, { solveTimeSec, problemTier }) {
  if (solveTimeSec > 0 && solveTimeSec <= 600) {
    await Reward.grant(userId, 'badge_speedrun');
  }
  if (GOLD_TIERS.has(problemTier)) {
    await Reward.grant(userId, 'badge_gold_killer');
  }
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 4) {
    await Reward.grant(userId, 'badge_nightowl');
  }
}

export async function grantMultilangBadge(userId) {
  try {
    const rows = await query(
      `SELECT COUNT(DISTINCT lang) AS cnt FROM submissions WHERE user_id = ? AND result = 'correct'`,
      [userId]
    );
    if ((rows[0]?.cnt || 0) >= 3) await Reward.grant(userId, 'badge_multilang');
  } catch {
    // non-fatal
  }
}
