import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { query, queryOne } from '../config/mysql.js';

const router = Router();

router.get('/users/:id/activity', auth, async (req, res) => {
  const userId = Number(req.params.id);
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));

  if (!userId) {
    return res.status(400).json({ message: '유효하지 않은 사용자입니다.' });
  }

  try {
    const user = await queryOne('SELECT id, profile_visibility FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ message: '유저를 찾을 수 없습니다.' });
    if (user.profile_visibility === 'private' && req.user.id !== userId) {
      return res.status(403).json({ message: '비공개 프로필입니다.' });
    }

    const [solveRows, postRows, battleRows] = await Promise.all([
      query(
        `SELECT 'solve' AS type, s.submitted_at AS created_at, p.title AS problem_title, s.lang
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id
         WHERE s.user_id = ? AND s.result = 'correct'
         ORDER BY s.submitted_at DESC
         LIMIT 100`,
        [userId]
      ),
      query(
        `SELECT 'post' AS type, created_at, board_type AS board, title
         FROM posts
         WHERE user_id = ? AND is_anonymous = 0
         ORDER BY created_at DESC
         LIMIT 100`,
        [userId]
      ),
      query(
        `SELECT 'battle' AS type, created_at, result
         FROM battle_history
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 100`,
        [userId]
      ),
    ]);

    const items = [...(solveRows || []), ...(postRows || []), ...(battleRows || [])]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = items.length;
    const start = (page - 1) * limit;

    res.json({
      items: items.slice(start, start + limit),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error('[activity]', err);
    res.status(500).json({ message: '활동 내역을 불러오지 못했습니다.' });
  }
});

export default router;
