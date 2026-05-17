import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { query as dbQuery, run as dbRun, queryOne } from '../config/mysql.js';
import { User } from '../models/User.js';
import redis from '../config/redis.js';

const router = Router();

function normalizeFollowListQuery(query = {}) {
  const rawLimit = Number.parseInt(query.limit, 10);
  const rawOffset = Number.parseInt(query.offset, 10);
  return {
    limit: Math.min(100, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 50)),
    offset: Math.max(0, Number.isFinite(rawOffset) ? rawOffset : 0),
  };
}

async function canViewFollowLists(requesterId, targetUser) {
  if (!targetUser) return { ok: false, status: 404, message: '유저를 찾을 수 없습니다.' };
  if (Number(requesterId) === Number(targetUser.id)) return { ok: true };
  if (targetUser.profile_visibility === 'private') {
    return { ok: false, status: 403, message: '비공개 프로필입니다.' };
  }
  if (targetUser.profile_visibility === 'followers') {
    const isFollowing = await queryOne(
      'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
      [requesterId, targetUser.id]
    );
    if (!isFollowing) return { ok: false, status: 403, message: '팔로워만 볼 수 있습니다.' };
  }
  return { ok: true };
}

function toPublicFollowUser(user, followingSet) {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname ?? null,
    displayName: user.display_name ?? null,
    tier: user.tier,
    rating: user.rating,
    avatar_url: user.avatar_url,
    avatar_url_custom: user.avatar_url_custom,
    avatar_color: user.avatar_color,
    avatar_emoji: user.avatar_emoji,
    avatar_source: user.avatar_source || 'site',
    avatarSource: user.avatar_source || 'site',
    isFollowing: followingSet.has(Number(user.id)),
  };
}

async function listFollowUsers(req, res, type) {
  const targetId = Number(req.params.id);
  if (!targetId || Number.isNaN(targetId)) {
    return res.status(400).json({ message: '유효하지 않은 사용자 ID입니다.' });
  }

  try {
    const targetUser = await User.findById(targetId);
    const access = await canViewFollowLists(req.user.id, targetUser);
    if (!access.ok) return res.status(access.status).json({ message: access.message });

    const { limit, offset } = normalizeFollowListQuery(req.query);
    const idColumn = type === 'followers' ? 'follower_id' : 'following_id';
    const whereColumn = type === 'followers' ? 'following_id' : 'follower_id';
    const fetchLimit = offset + limit;

    const [countRows, relationRows, myFollowingRows] = await Promise.all([
      dbQuery(`SELECT COUNT(*) AS cnt FROM follows WHERE ${whereColumn}=?`, [targetId]),
      dbQuery(
        `SELECT ${idColumn}, created_at
         FROM follows
         WHERE ${whereColumn}=?
         ORDER BY created_at DESC
         LIMIT ${fetchLimit}`,
        [targetId]
      ),
      dbQuery('SELECT following_id FROM follows WHERE follower_id=?', [req.user.id]),
    ]);

    const followingSet = new Set((myFollowingRows || []).map((row) => Number(row.following_id)));
    const relationSlice = (relationRows || []).slice(offset, offset + limit);
    const users = await Promise.all(
      relationSlice.map((row) => User.findById(Number(row[idColumn])))
    );

    res.json({
      type,
      total: Number(countRows?.[0]?.cnt || 0),
      limit,
      offset,
      items: users
        .filter(Boolean)
        .filter((user) => !user.banned_at)
        .map((user) => toPublicFollowUser(user, followingSet)),
    });
  } catch (err) {
    console.error(`[follows/${type}]`, err);
    res.status(500).json({ message: '서버 오류' });
  }
}

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

router.get('/:id/followers', auth, async (req, res) => {
  return listFollowUsers(req, res, 'followers');
});

router.get('/:id/following', auth, async (req, res) => {
  return listFollowUsers(req, res, 'following');
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
