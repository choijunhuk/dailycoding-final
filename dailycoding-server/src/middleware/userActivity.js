// Helper for updating user "last active" timestamp + a coarse "current
// activity" label used by the friends online widget. Throttled per-user via
// Redis so a heartbeat (or repeated calls) cannot hammer the DB.

import { run } from '../config/mysql.js';
import { redis } from '../config/redis.js';

const THROTTLE_SEC = 25;

const ALLOWED_ACTIVITIES = new Set([
  'idle', 'dashboard', 'arcade', 'battle', 'judge', 'community', 'ai',
  'ranking', 'profile', 'settings', 'learning', 'community-write', 'unknown',
]);

export function normalizeActivity(value) {
  if (typeof value !== 'string') return 'idle';
  const v = value.trim().slice(0, 40);
  if (!v) return 'idle';
  return ALLOWED_ACTIVITIES.has(v) ? v : 'unknown';
}

export async function touchUserActivity(userId, rawActivity) {
  if (!userId) return;
  const activity = normalizeActivity(rawActivity);
  const key = `act:touch:${userId}`;
  try {
    const exists = await redis.get(key);
    if (exists) return; // throttled
    await redis.set(key, '1', THROTTLE_SEC);
  } catch {
    // If redis is down we still update — better fresh data than miss
  }
  try {
    await run(
      'UPDATE users SET last_active_at = NOW(), current_activity = ? WHERE id = ?',
      [activity, userId]
    );
  } catch {
    // non-fatal
  }
}
