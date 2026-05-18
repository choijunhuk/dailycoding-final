import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { query, queryOne } from '../config/mysql.js';

const router = Router();

const CATEGORY_ORDER = ['coding', 'streak', 'ranking', 'battle', 'xp', 'explore'];

function sortBadges(badges) {
  return badges.sort((a, b) => {
    const ca = CATEGORY_ORDER.indexOf(a.category ?? '') ?? 99;
    const cb = CATEGORY_ORDER.indexOf(b.category ?? '') ?? 99;
    if (ca !== cb) return ca - cb;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });
}

// GET /api/badges — 전체 훈장 목록 + 내 획득 여부 + 현재 장착 정보
router.get('/', auth, async (req, res) => {
  try {
    const [badges, userRow] = await Promise.all([
      query(
        `SELECT ri.*,
                ur.earned_at,
                IF(ur.user_id IS NOT NULL, 1, 0) AS earned
         FROM reward_items ri
         LEFT JOIN user_rewards ur ON ur.reward_id = ri.id AND ur.user_id = ?
         WHERE ri.type = 'badge'
         ORDER BY ri.category, ri.sort_order, ri.id`,
        [req.user.id]
      ),
      queryOne('SELECT equipped_badge, equipped_title FROM users WHERE id = ?', [req.user.id]),
    ]);
    sortBadges(badges);
    const earnedCount = badges.filter((b) => b.earned).length;
    res.json({
      badges,
      earnedCount,
      totalCount: badges.length,
      equippedBadge: userRow?.equipped_badge || null,
      equippedTitle: userRow?.equipped_title || null,
    });
  } catch (err) {
    console.error('[badges/]', err.message);
    res.status(500).json({ message: '서버 오류' });
  }
});

// GET /api/badges/stats — 훈장·칭호별 보유 비율
router.get('/stats', async (req, res) => {
  try {
    const [totalRow, rows] = await Promise.all([
      queryOne('SELECT COUNT(*) AS cnt FROM users WHERE banned_at IS NULL'),
      query(
        `SELECT ri.code, COUNT(ur.user_id) AS earned_count
         FROM reward_items ri
         LEFT JOIN user_rewards ur ON ur.reward_id = ri.id
         GROUP BY ri.id, ri.code`
      ),
    ]);
    const total = Math.max(1, Number(totalRow?.cnt) || 1);
    const stats = {};
    for (const row of rows) {
      const count = Number(row.earned_count);
      stats[row.code] = { count, pct: Math.round((count / total) * 100) };
    }
    res.json(stats);
  } catch (err) {
    console.error('[badges/stats]', err.message);
    res.status(500).json({ message: '서버 오류' });
  }
});

// GET /api/badges/titles — 칭호 목록 + 내 획득 여부
router.get('/titles', auth, async (req, res) => {
  try {
    const titles = await query(
      `SELECT ri.*,
              ur.earned_at,
              IF(ur.user_id IS NOT NULL, 1, 0) AS earned
       FROM reward_items ri
       LEFT JOIN user_rewards ur ON ur.reward_id = ri.id AND ur.user_id = ?
       WHERE ri.type = 'title'
       ORDER BY ri.sort_order, ri.id`,
      [req.user.id]
    );
    const earnedCount = titles.filter((t) => t.earned).length;
    res.json({ titles, earnedCount, totalCount: titles.length });
  } catch (err) {
    console.error('[badges/titles]', err.message);
    res.status(500).json({ message: '서버 오류' });
  }
});

// GET /api/badges/user/:id — 다른 유저의 획득 훈장
router.get('/user/:id', async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (!userId || isNaN(userId)) return res.status(400).json({ message: '유효하지 않은 유저 ID' });

  try {
    const allBadges = await query(
      `SELECT ri.*,
              ur.earned_at,
              IF(ur.user_id IS NOT NULL, 1, 0) AS earned
       FROM reward_items ri
       LEFT JOIN user_rewards ur ON ur.reward_id = ri.id AND ur.user_id = ?
       WHERE ri.type = 'badge'
       ORDER BY ur.earned_at DESC, ri.category, ri.sort_order`,
      [userId]
    );
    const earnedBadges = allBadges.filter((b) => b.earned);
    res.json({ badges: earnedBadges, earnedCount: earnedBadges.length, totalCount: allBadges.length });
  } catch (err) {
    console.error('[badges/user/:id]', err.message);
    res.status(500).json({ message: '서버 오류' });
  }
});

export default router;
