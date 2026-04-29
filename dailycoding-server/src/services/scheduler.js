import logger from '../config/logger.js';
import { query } from '../config/mysql.js';
import { Contest } from '../models/Contest.js';
import { Notification } from '../models/Notification.js';

const SCHEDULER_INTERVAL_MS = 60_000;
let intervalId = null;
let running = false;

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
          'contest'
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

export function startScheduler() {
  if (intervalId) return intervalId;
  intervalId = setInterval(() => {
    endExpiredContests().catch(() => {});
  }, SCHEDULER_INTERVAL_MS);
  endExpiredContests().catch(() => {});
  return intervalId;
}

export function stopScheduler() {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
}
