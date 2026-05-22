import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { query, queryOne } from '../config/mysql.js';

const router = Router();

router.get('/users/:id/activity', auth, async (req, res) => {
  const userId = Number(req.params.id);
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));

  if (!userId) {
    return res.status(400).json({ message: 'Invalid user.' });
  }

  try {
    const user = await queryOne('SELECT id, profile_visibility FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.profile_visibility === 'private' && req.user.id !== userId) {
      return res.status(403).json({ message: 'This profile is private.' });
    }

    const [solveRows, postRows, battleRows] = await Promise.all([
      query(
        `SELECT 'solve' AS type, s.submitted_at AS created_at, s.id AS submission_id,
                s.problem_id, p.title AS problem_title, s.lang
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id
         WHERE s.user_id = ? AND s.result = 'correct'
         ORDER BY s.submitted_at DESC
         LIMIT 100`,
        [userId]
      ),
      query(
        `SELECT 'post' AS type, id AS post_id, created_at, board_type AS board, title
         FROM posts
         WHERE user_id = ? AND is_anonymous = 0
         ORDER BY created_at DESC
         LIMIT 100`,
        [userId]
      ),
      query(
        `SELECT 'battle' AS type, room_id, created_at, result
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
    res.status(500).json({ message: 'Failed to load activity history.' });
  }
});

export default router;
