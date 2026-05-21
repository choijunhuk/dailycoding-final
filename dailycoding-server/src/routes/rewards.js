import { Router } from 'express';
import { Reward } from '../models/Reward.js';
import { User } from '../models/User.js';
import { auth } from '../middleware/auth.js';

const router = Router();

// GET /api/rewards/my — 내 보상 목록
router.get('/my', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const progression = await Reward.getProgression(req.user.id);
    const rewards = await Reward.findByUser(req.user.id);
    res.json({
      rewards,
      equippedBadge: user?.equipped_badge || null,
      equippedTitle: user?.equipped_title || null,
      progression,
    });
  } catch (err) {
    console.error('[rewards/my]', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/rewards/all — 전체 보상 정의 목록
router.get('/all', auth, async (req, res) => {
  try { res.json(await Reward.findAll()); }
  catch { res.json([]); }
});

// GET /api/rewards/progression — 랭킹과 분리된 XP 성장 상태
router.get('/progression', auth, async (req, res) => {
  try {
    res.json(await Reward.getProgression(req.user.id));
  } catch (err) {
    console.error('[rewards/progression]', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/rewards/equip — 보상 장착
router.post('/equip', auth, async (req, res) => {
  const { type, code } = req.body; // type: 'badge'|'title'|null(해제)
  if (type && !['badge', 'title'].includes(type))
    return res.status(400).json({ message: 'Invalid type.' });

  try {
    // code가 null이면 해제
    if (!code) {
      const field = type === 'badge' ? 'equipped_badge' : 'equipped_title';
      await User.update(req.user.id, { [field]: null });
      return res.json({ message: 'Unequipped.' });
    }

    // 보유 여부 확인
    const has = await Reward.hasReward(req.user.id, code);
    if (!has) return res.status(403).json({ message: 'You do not own this reward.' });

    // 타입 확인
    const { queryOne } = await import('../config/mysql.js');
    const item = await queryOne('SELECT type FROM reward_items WHERE code = ?', [code]);
    if (!item) return res.status(404).json({ message: 'Reward not found' });
    if (item.type !== type) return res.status(400).json({ message: 'Type mismatch' });

    const field = type === 'badge' ? 'equipped_badge' : 'equipped_title';
    const user = await User.update(req.user.id, { [field]: code });
    res.json({ message: 'Equipped.', user: User.safe(user) });
  } catch (err) {
    console.error('[rewards/equip]', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
