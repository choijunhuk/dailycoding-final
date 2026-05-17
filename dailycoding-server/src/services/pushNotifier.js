import webpush from 'web-push';
import { query, run } from '../config/mysql.js';
import logger from '../config/logger.js';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@dailycoding-final.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
}

export function isPushConfigured() {
  return Boolean(vapidPublicKey && vapidPrivateKey);
}

export async function pushToUser(userId, { title, body, url = '/' }) {
  if (!isPushConfigured()) return { sent: 0, skipped: true };
  const subs = await query('SELECT * FROM push_subscriptions WHERE user_id = ?', [userId]);
  let sent = 0;
  for (const sub of subs || []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body, url })
      );
      sent += 1;
    } catch (err) {
      if ([404, 410].includes(err?.statusCode)) {
        await run('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
      } else {
        logger.warn('Push notification failed', { userId, statusCode: err?.statusCode, message: err?.message });
      }
    }
  }
  return { sent };
}
