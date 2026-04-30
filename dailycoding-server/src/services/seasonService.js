import { query, queryOne, insert, run } from '../config/mysql.js';
import { redis } from '../config/redis.js';

export function getCurrentSeason(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getSeasonRemainingDays(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0);
  lastDay.setHours(23, 59, 59, 999);
  return Math.max(0, Math.ceil((lastDay.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)));
}

export async function updateSeasonRating(userId, ratingDelta, { solvedIncrement = 1, battleWinIncrement = 0 } = {}) {
  const season = getCurrentSeason();
  const existing = await queryOne(
    'SELECT id, season_rating, solved_count, battle_wins FROM season_rankings WHERE user_id = ? AND season = ?',
    [userId, season]
  );

  if (!existing) {
    await insert(
      `INSERT INTO season_rankings (user_id, season, season_rating, solved_count, battle_wins)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, season, Math.max(0, Number(ratingDelta) || 0), Math.max(0, solvedIncrement), Math.max(0, battleWinIncrement)]
    );
  } else {
    await run(
      `UPDATE season_rankings
       SET season_rating = season_rating + ?,
           solved_count = solved_count + ?,
           battle_wins = battle_wins + ?
       WHERE id = ?`,
      [
        Math.max(0, Number(ratingDelta) || 0),
        Math.max(0, solvedIncrement),
        Math.max(0, battleWinIncrement),
        existing.id,
      ]
    );
  }

  await redis.clearPrefix('ranking:season:');
}

export async function listSeasonRanking(season = getCurrentSeason(), limit = 100) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 100));
  return query(
    `SELECT sr.user_id,
            sr.season,
            sr.season_rating,
            sr.solved_count,
            sr.battle_wins,
            sr.final_rank,
            sr.reward_granted,
            u.username,
            u.tier,
            u.avatar_emoji
     FROM season_rankings sr
     JOIN users u ON u.id = sr.user_id
     WHERE sr.season = ?
     ORDER BY sr.season_rating DESC, sr.solved_count DESC, sr.battle_wins DESC, sr.updated_at ASC
     LIMIT ${safeLimit}`,
    [season]
  );
}
