import { Router } from 'express';
import { Notification } from '../models/Notification.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.get('/', auth, async (req, res) => {
  try { res.json(await Notification.findByUser(req.user.id)); }
  catch { res.json([]); }
});

// GET /api/notifications/unread-count — badge 숫자용
router.get('/unread-count', auth, async (req, res) => {
  try { res.json({ count: await Notification.countUnread(req.user.id) }); }
  catch { res.json({ count: 0 }); }
});

router.patch('/:id/read', auth, async (req, res) => {
  try {
    // Pass user ID to prevent marking another user's notification (IDOR)
    await Notification.markRead(Number(req.params.id), req.user.id);
    res.json({ message: 'ok' });
  } catch { res.status(500).json({ message: '서버 오류' }); }
});

router.patch('/all/read', auth, async (req, res) => {
  try {
    await Notification.markAllRead(req.user.id);
    res.json({ message: 'ok' });
  } catch { res.status(500).json({ message: '서버 오류' }); }
});

router.delete('/all', auth, async (req, res) => {
  try {
    await Notification.deleteAll(req.user.id);
    res.json({ message: 'ok' });
  } catch { res.status(500).json({ message: '서버 오류' }); }
});

export default router;
