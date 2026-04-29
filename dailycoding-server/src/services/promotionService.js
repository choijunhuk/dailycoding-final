import { queryOne, insert, run } from '../config/mysql.js';
import { Reward } from '../models/Reward.js';
import { PROMOTION_LOSSES_ALLOWED, PROMOTION_SERIES_DAYS, PROMOTION_WINS_REQUIRED, TIER_ORDER } from '../shared/constants.js';

function toSqlDateTime(value = new Date()) {
  return value.toISOString().slice(0, 19).replace('T', ' ');
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function markExpiredIfNeeded(series) {
  if (!series || series.status !== 'in_progress') return series;
  if (new Date(series.expires_at).getTime() >= Date.now()) return series;
  await run('UPDATE promotion_series SET status = ? WHERE id = ?', ['failed', series.id]);
  return { ...series, status: 'failed' };
}

export async function getActivePromotionSeries(userId) {
  const series = await queryOne(
    'SELECT * FROM promotion_series WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1',
    [userId, 'in_progress']
  );
  return markExpiredIfNeeded(series);
}

export async function getPromotionSnapshot(userId) {
  const active = await getActivePromotionSeries(userId);
  if (active && active.status === 'in_progress') return { active };

  const recent = await queryOne(
    `SELECT *
     FROM promotion_series
     WHERE user_id = ? AND status IN ('promoted', 'failed')
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  return { active: null, recent };
}

export async function openPromotionSeries(userId, fromTier, toTier) {
  const existing = await getActivePromotionSeries(userId);
  if (existing && existing.status === 'in_progress') return existing;

  const expiresAt = toSqlDateTime(addDays(new Date(), PROMOTION_SERIES_DAYS));
  const id = await insert(
    `INSERT INTO promotion_series (user_id, from_tier, to_tier, wins, losses, status, expires_at)
     VALUES (?, ?, ?, 0, 0, 'in_progress', ?)`,
    [userId, fromTier, toTier, expiresAt]
  );
  return queryOne('SELECT * FROM promotion_series WHERE id = ?', [id]);
}

export async function recordPromotionWin(userId, toTier) {
  const active = await getActivePromotionSeries(userId);
  if (!active || active.status !== 'in_progress' || active.to_tier !== toTier) return null;

  const nextWins = Number(active.wins || 0) + 1;
  const promoted = nextWins >= PROMOTION_WINS_REQUIRED;
  await run(
    'UPDATE promotion_series SET wins = ?, status = ? WHERE id = ?',
    [nextWins, promoted ? 'promoted' : 'in_progress', active.id]
  );

  if (promoted) {
    await run('UPDATE users SET tier = ? WHERE id = ?', [toTier, userId]);
    await Reward.grantMany(userId, [`badge_${toTier}`, `title_${toTier}`]);
  }

  return {
    ...active,
    wins: nextWins,
    status: promoted ? 'promoted' : 'in_progress',
  };
}

export async function recordPromotionLoss(userId) {
  const active = await getActivePromotionSeries(userId);
  if (!active || active.status !== 'in_progress') return null;

  const nextLosses = Number(active.losses || 0) + 1;
  const failed = nextLosses >= PROMOTION_LOSSES_ALLOWED;
  await run(
    'UPDATE promotion_series SET losses = ?, status = ? WHERE id = ?',
    [nextLosses, failed ? 'failed' : 'in_progress', active.id]
  );

  return {
    ...active,
    losses: nextLosses,
    status: failed ? 'failed' : 'in_progress',
  };
}

export function getNextTier(currentTier) {
  const currentIndex = TIER_ORDER.indexOf(currentTier);
  return currentIndex >= 0 ? TIER_ORDER[currentIndex + 1] || null : null;
}
