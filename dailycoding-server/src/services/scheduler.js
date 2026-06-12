import logger from '../config/logger.js';
import { query } from '../config/mysql.js';
import { Contest } from '../models/Contest.js';
import { Notification } from '../models/Notification.js';
import { pushToUser, isPushConfigured } from './pushNotifier.js';

const SCHEDULER_INTERVAL_MS = 60_000;
let intervalId = null;
let running = false;

// Track the last day we ran each daily job so we only fire once per KST day even
// across container restarts mid-day.
let lastStreakReminderDay = null;

async function endExpiredContests() {
  if (running) return;
  running = true;

  try {
    const expired = await query(
      `SELECT id, name
       FROM contests
       WHERE status = 'running'
         AND started_at IS NOT NULL
         AND DATE_ADD(started_at, INTERVAL duration_min MINUTE) < NOW()`,
      []
    );

    for (const contest of expired || []) {
      const updated = await Contest.updateStatus(Number(contest.id), 'ended');
      const board = await Contest.getLeaderboard(Number(contest.id));
      const grants = await Contest.grantRankRewards(Number(contest.id), board);

      for (const grant of grants) {
        await Notification.create(
          grant.userId,
          `🏁 "${updated?.name || contest.name}" 대회가 자동 종료됐고 ${grant.rankPosition}위 보상이 지급됐습니다.`,
          'contest',
          { type: 'reward' }
        );
      }

      logger.info('Contest auto-ended', {
        contestId: Number(contest.id),
        grantedRewards: grants.length,
      });
    }
  } catch (err) {
    logger.error('Contest scheduler failed', { error: err.message });
  } finally {
    running = false;
  }
}

function kstNow() {
  // Convert UTC -> KST without external deps.
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

async function sendDailyStreakReminders() {
  if (!isPushConfigured()) return;
  const now = kstNow();
  const dayKey = now.toISOString().slice(0, 10);
  // Window: 20:00–20:05 KST, once per dayKey.
  if (now.getUTCHours() !== 20) return;
  if (lastStreakReminderDay === dayKey) return;
  lastStreakReminderDay = dayKey;

  try {
    // Users with an active streak who haven't solved today, restricted to
    // those who have at least one push subscription.
    const today = dayKey;
    const targets = await query(
      `SELECT u.id, u.username, u.streak
       FROM users u
       JOIN push_subscriptions p ON p.user_id = u.id
       LEFT JOIN solve_logs sl ON sl.user_id = u.id AND sl.solve_date = ?
       WHERE u.streak >= 1
         AND sl.user_id IS NULL
         AND COALESCE(u.banned_at, '1970-01-01') < '2000-01-01'
       GROUP BY u.id`,
      [today],
    );
    if (!targets?.length) return;

    let sent = 0;
    for (const t of targets) {
      const res = await pushToUser(t.id, {
        title: `🔥 ${t.streak}일 연속! 오늘 문제 풀러 가요`,
        body: '아직 오늘 문제를 안 풀었어요. 1문제만 풀면 streak가 이어집니다.',
        url: '/problems',
      });
      if (res?.sent) sent += res.sent;
    }
    logger.info('Daily streak reminders sent', { targets: targets.length, sent });
  } catch (err) {
    logger.error('Streak reminder job failed', { error: err.message });
  }
}

export function startScheduler() {
  if (intervalId) return intervalId;
  intervalId = setInterval(() => {
    endExpiredContests().catch(() => {});
    sendDailyStreakReminders().catch(() => {});
  }, SCHEDULER_INTERVAL_MS);
  endExpiredContests().catch(() => {});
  sendDailyStreakReminders().catch(() => {});
  return intervalId;
}

export function stopScheduler() {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
}
