import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { queryOne, run } from '../config/mysql.js';
import { isPushConfigured } from '../services/pushNotifier.js';

const router = Router();

router.get('/public-key', auth, async (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null, configured: isPushConfigured() });
});

router.post('/subscribe', auth, async (req, res) => {
  const endpoint = String(req.body?.endpoint || '').trim();
  const p256dh = String(req.body?.keys?.p256dh || '').trim();
  const authKey = String(req.body?.keys?.auth || '').trim();
  if (!endpoint || !p256dh || !authKey) return res.status(400).json({ message: '구독 정보가 올바르지 않습니다.' });
  await run(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth)`,
    [req.user.id, endpoint, p256dh, authKey]
  );
  res.json({ ok: true });
});

router.delete('/unsubscribe', auth, async (req, res) => {
  const endpoint = String(req.body?.endpoint || req.query?.endpoint || '').trim();
  if (endpoint) await run('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?', [req.user.id, endpoint]);
  else await run('DELETE FROM push_subscriptions WHERE user_id = ?', [req.user.id]);
  res.json({ ok: true });
});

router.get('/status', auth, async (req, res) => {
  const row = await queryOne('SELECT 1 FROM push_subscriptions WHERE user_id = ? LIMIT 1', [req.user.id]);
  res.json({ subscribed: Boolean(row), configured: isPushConfigured() });
});

export default router;
