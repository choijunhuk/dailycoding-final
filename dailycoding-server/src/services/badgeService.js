import { Reward } from '../models/Reward.js';
import { query, queryOne } from '../config/mysql.js';

const ARCADE_TOTAL_GAMES = 11;

export async function grantArcadeBadges(userId, gameKey, score, meta) {
  if (!userId || !gameKey) return;
  try {
    await Reward.grant(userId, 'badge_arcade_first');

    if (gameKey === 'tetris') {
      if (score >= 5000) await Reward.grant(userId, 'badge_tetris_5k');
      else if (score >= 1000) await Reward.grant(userId, 'badge_tetris_1k');
      if (meta && meta.mode === 'sprint' && meta.finished && Number(meta.elapsed) > 0 && Number(meta.elapsed) <= 120) {
        await Reward.grant(userId, 'badge_sprint_sub2');
      }
    } else if (gameKey === 'snake' && Number(meta?.length || 0) >= 50) {
      await Reward.grant(userId, 'badge_snake_50');
    } else if (gameKey === '2048') {
      const maxTile = Number(meta?.maxTile || 0);
      if (meta?.reached2048 || maxTile >= 2048) await Reward.grant(userId, 'badge_2048_reached');
    }

    const row = await queryOne(
      'SELECT COUNT(DISTINCT game_key) AS cnt FROM arcade_scores WHERE user_id = ?',
      [userId]
    );
    const distinct = Number(row?.cnt || 0);
    if (distinct >= 5) await Reward.grant(userId, 'badge_arcade_explorer');
    if (distinct >= ARCADE_TOTAL_GAMES) {
      await Reward.grant(userId, 'badge_arcade_master');
      await Reward.grant(userId, 'title_arcade_master');
    }
  } catch {
    // non-fatal
  }
}

const GOLD_TIERS = new Set(['gold', 'platinum', 'emerald', 'diamond', 'master', 'grandmaster', 'challenger']);

export async function grantSolveMilestoneBadges(userId, solvedCount) {
  const milestones = [
    [1,   'badge_first_solve', 'title_first_solve'],
    [10,  'badge_solve10'],
    [50,  'badge_solve50'],
    [100, 'badge_solve100', 'title_solve100'],
    [200, 'badge_solve200'],
    [500, 'badge_solve500'],
  ];
  for (const [threshold, ...codes] of milestones) {
    if (solvedCount >= threshold) {
      for (const code of codes) await Reward.grant(userId, code);
    }
  }
}

export async function grantStreakBadges(userId, streak) {
  const milestones = [
    [7,   'badge_streak_7',  'title_streak_7'],
    [30,  'badge_streak_30'],
    [100, 'badge_streak100'],
    [365, 'badge_streak365'],
  ];
  for (const [threshold, ...codes] of milestones) {
    if (streak >= threshold) {
      for (const code of codes) await Reward.grant(userId, code);
    }
  }
}

export async function grantTierBadge(userId, tier) {
  const map = {
    bronze:      ['badge_bronze',      'title_bronze'],
    silver:      ['badge_silver',      'title_silver'],
    gold:        ['badge_gold',        'title_gold'],
    platinum:    ['badge_platinum',    'title_platinum'],
    emerald:     ['badge_emerald',     'title_emerald'],
    diamond:     ['badge_diamond',     'title_diamond'],
    master:      ['badge_master',      'title_master'],
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

export async function grantExploreBadges(userId, { solveTimeSec, problemTier }) {
  if (solveTimeSec > 0 && solveTimeSec <= 600) {
    await Reward.grant(userId, 'badge_speedrun');
    await Reward.grant(userId, 'title_speedster');
  }
  if (GOLD_TIERS.has(problemTier)) {
    await Reward.grant(userId, 'badge_gold_killer');
  }
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 4) {
    await Reward.grant(userId, 'badge_nightowl');
    await Reward.grant(userId, 'title_night_coder');
  }
}

export async function grantMultilangBadge(userId) {
  try {
    const rows = await query(
      `SELECT COUNT(DISTINCT lang) AS cnt FROM submissions WHERE user_id = ? AND result = 'correct'`,
      [userId]
    );
    if ((rows[0]?.cnt || 0) >= 3) {
      await Reward.grant(userId, 'badge_multilang');
      await Reward.grant(userId, 'title_multilang_coder');
    }
  } catch {
    // non-fatal
  }
}
