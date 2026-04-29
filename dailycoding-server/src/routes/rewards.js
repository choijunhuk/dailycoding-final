import { Router } from 'express';
import { Reward } from '../models/Reward.js';
import { User } from '../models/User.js';
import { auth } from '../middleware/auth.js';

const router = Router();

// GET /api/rewards/my — 내 보상 목록
router.get('/my', auth, async (req, res) => {
  try {
    const rewards = await Reward.findByUser(req.user.id);
    const user = await User.findById(req.user.id);
    res.json({
      rewards,
      equippedBadge: user?.equipped_badge || null,
      equippedTitle: user?.equipped_title || null,
    });
  } catch (err) {
    console.error('[rewards/my]', err.message);
    res.status(500).json({ message: '서버 오류' });
  }
});

// GET /api/rewards/all — 전체 보상 정의 목록
router.get('/all', auth, async (req, res) => {
  try { res.json(await Reward.findAll()); }
  catch { res.json([]); }
});

// POST /api/rewards/equip — 보상 장착
router.post('/equip', auth, async (req, res) => {
  const { type, code } = req.body; // type: 'badge'|'title'|null(해제)
  if (type && !['badge', 'title'].includes(type))
    return res.status(400).json({ message: '잘못된 타입입니다.' });

  try {
    // code가 null이면 해제
    if (!code) {
      const field = type === 'badge' ? 'equipped_badge' : 'equipped_title';
      await User.update(req.user.id, { [field]: null });
      return res.json({ message: '장착 해제됨' });
    }

    // 보유 여부 확인
    const has = await Reward.hasReward(req.user.id, code);
    if (!has) return res.status(403).json({ message: '보유하지 않은 보상입니다.' });

    // 타입 확인
    const { queryOne } = await import('../config/mysql.js');
    const item = await queryOne('SELECT type FROM reward_items WHERE code = ?', [code]);
    if (!item) return res.status(404).json({ message: '보상 없음' });
    if (item.type !== type) return res.status(400).json({ message: '타입 불일치' });

    const field = type === 'badge' ? 'equipped_badge' : 'equipped_title';
    const user = await User.update(req.user.id, { [field]: code });
    res.json({ message: '장착됨', user: User.safe(user) });
  } catch (err) {
    console.error('[rewards/equip]', err.message);
    res.status(500).json({ message: '서버 오류' });
  }
});

export default router;
