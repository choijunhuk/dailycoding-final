import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { query as dbQuery, run as dbRun, queryOne } from '../config/mysql.js';
import redis from '../config/redis.js';

const router = Router();

router.get('/feed', auth, async (req, res) => {
  try {
    const cacheKey = `feed:${req.user.id}`;
    const cached = await redis.getJSON(cacheKey);
    if (cached) return res.json(cached);

    const followingRows = await dbQuery(
      'SELECT following_id FROM follows WHERE follower_id = ?',
      [req.user.id]
    );
    const followingIds = (followingRows || []).map((row) => Number(row.following_id)).filter(Boolean);
    if (followingIds.length === 0) return res.json([]);

    const placeholders = followingIds.map(() => '?').join(',');
    const [solveRows, postRows] = await Promise.all([
      dbQuery(
        `SELECT 'solved' AS type,
                s.user_id AS userId,
                u.username,
                u.nickname,
                u.tier,
                u.avatar_emoji AS avatarEmoji,
                p.id AS problemId,
                p.title AS problemTitle,
                s.lang,
                s.submitted_at AS createdAt
         FROM submissions s
         JOIN users u ON s.user_id = u.id
         JOIN problems p ON s.problem_id = p.id
         WHERE s.user_id IN (${placeholders})
           AND s.result = 'correct'
           AND s.submitted_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         ORDER BY s.submitted_at DESC
         LIMIT 30`,
        followingIds
      ),
      dbQuery(
        `SELECT 'post' AS type,
                p.user_id AS userId,
                u.username,
                u.nickname,
                u.tier,
                u.avatar_emoji AS avatarEmoji,
                p.id AS postId,
                p.title AS postTitle,
                p.board_type AS board,
                p.created_at AS createdAt
         FROM posts p
         JOIN users u ON p.user_id = u.id
         WHERE p.user_id IN (${placeholders})
           AND p.post_visibility = 'public'
           AND p.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         ORDER BY p.created_at DESC
         LIMIT 20`,
        followingIds
      ),
    ]);

    const items = [...(solveRows || []), ...(postRows || [])]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20);

    await redis.setJSON(cacheKey, items, 60);
    return res.json(items);
  } catch (err) {
    console.error('[follows/feed]', err);
    return res.status(500).json({ message: '서버 오류' });
  }
});

// POST /api/follows/:id  — follow a user
router.post('/:id', auth, async (req, res) => {
  const targetId = Number(req.params.id);
  if (!targetId || isNaN(targetId)) return res.status(400).json({ message: '유효하지 않은 사용자 ID입니다.' });
  if (targetId === req.user.id) return res.status(400).json({ message: '자신을 팔로우할 수 없습니다.' });
  try {
    await dbRun(
      'INSERT IGNORE INTO follows (follower_id, following_id) VALUES (?,?)',
      [req.user.id, targetId]
    );
    await redis.del(`feed:${req.user.id}`);
    res.json({ following: true });
  } catch (err) {
    res.status(500).json({ message: '서버 오류' });
  }
});

// DELETE /api/follows/:id  — unfollow a user
router.delete('/:id', auth, async (req, res) => {
  const targetId = Number(req.params.id);
  if (!targetId || isNaN(targetId)) return res.status(400).json({ message: '유효하지 않은 사용자 ID입니다.' });
  try {
    await dbRun(
      'DELETE FROM follows WHERE follower_id=? AND following_id=?',
      [req.user.id, targetId]
    );
    await redis.del(`feed:${req.user.id}`);
    res.json({ following: false });
  } catch (err) {
    res.status(500).json({ message: '서버 오류' });
  }
});

// GET /api/follows/my — get list of user IDs I follow
router.get('/my', auth, async (req, res) => {
  try {
    const rows = await dbQuery(
      'SELECT following_id FROM follows WHERE follower_id=?',
      [req.user.id]
    );
    res.json(rows.map(r => r.following_id));
  } catch (err) {
    res.status(500).json({ message: '서버 오류' });
  }
});

// GET /api/follows/:id/stats — follower/following counts for a user
router.get('/:id/stats', auth, async (req, res) => {
  const targetId = Number(req.params.id);
  if (!targetId || isNaN(targetId)) return res.status(400).json({ message: '유효하지 않은 사용자 ID입니다.' });
  try {
    const [followers, following, isFollowing] = await Promise.all([
      dbQuery('SELECT COUNT(*) AS cnt FROM follows WHERE following_id=?', [targetId]),
      dbQuery('SELECT COUNT(*) AS cnt FROM follows WHERE follower_id=?', [targetId]),
      queryOne('SELECT 1 FROM follows WHERE follower_id=? AND following_id=?', [req.user.id, targetId]),
    ]);
    res.json({
      followers: followers[0]?.cnt || 0,
      following: following[0]?.cnt || 0,
      isFollowing: !!isFollowing,
    });
  } catch (err) {
    res.status(500).json({ message: '서버 오류' });
  }
});

export default router;
