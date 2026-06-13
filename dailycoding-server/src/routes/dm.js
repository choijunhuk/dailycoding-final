// Direct messages (1:1) between users.
//
// Authorization model: a user may DM another iff at least one of them follows
// the other. This keeps cold-DM spam minimal while letting anyone reach the
// people they follow.

import { Router } from 'express';
import { auth, requireVerified } from '../middleware/auth.js';
import { query, queryOne, insert, run } from '../config/mysql.js';

const router = Router();
router.use(auth);
router.use(requireVerified);

const MAX_CONTENT = 2000;

function safeContent(raw) {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t) return null;
  if (t.length > MAX_CONTENT) return t.slice(0, MAX_CONTENT);
  return t;
}

async function relationExists(meId, otherId) {
  if (meId === otherId) return false;
  const row = await queryOne(
    `SELECT 1 FROM follows
     WHERE (follower_id = ? AND following_id = ?)
        OR (follower_id = ? AND following_id = ?)
     LIMIT 1`,
    [meId, otherId, otherId, meId]
  );
  return !!row;
}

// GET /api/dm/conversations — recent partners (latest message per partner)
router.get('/conversations', async (req, res, next) => {
  try {
    const me = req.user.id;
    const rows = await query(
      `SELECT partner_id, MAX(latest_id) AS latest_id, MAX(latest_at) AS latest_at, SUM(unread) AS unread
       FROM (
         SELECT recipient_id AS partner_id, id AS latest_id, created_at AS latest_at, 0 AS unread
         FROM dm_messages WHERE sender_id = ?
         UNION ALL
         SELECT sender_id    AS partner_id, id AS latest_id, created_at AS latest_at,
                CASE WHEN read_at IS NULL THEN 1 ELSE 0 END AS unread
         FROM dm_messages WHERE recipient_id = ?
       ) t
       GROUP BY partner_id
       ORDER BY latest_at DESC
       LIMIT 50`,
      [me, me]
    );
    if (!rows.length) return res.json({ conversations: [] });

    const partnerIds = rows.map((r) => r.partner_id);
    const placeholders = partnerIds.map(() => '?').join(',');
    const [users, lastMsgs] = await Promise.all([
      query(
        `SELECT id, username, nickname, display_name, tier, avatar_url, avatar_url_custom,
                avatar_color, avatar_emoji, avatar_source, last_active_at, current_activity
         FROM users WHERE id IN (${placeholders})`,
        partnerIds
      ),
      query(
        `SELECT id, sender_id, recipient_id, content, created_at, read_at
         FROM dm_messages WHERE id IN (${rows.map(() => '?').join(',')})`,
        rows.map((r) => r.latest_id)
      ),
    ]);
    const userMap = new Map(users.map((u) => [u.id, u]));
    const msgMap = new Map(lastMsgs.map((m) => [m.id, m]));

    const conversations = rows.map((r) => {
      const u = userMap.get(r.partner_id) || {};
      const m = msgMap.get(r.latest_id) || {};
      return {
        partner: {
          id: r.partner_id,
          username: u.username,
          nickname: u.nickname,
          displayName: u.display_name,
          tier: u.tier,
          avatar_url: u.avatar_url,
          avatar_url_custom: u.avatar_url_custom,
          avatar_color: u.avatar_color,
          avatar_emoji: u.avatar_emoji,
          avatar_source: u.avatar_source || 'site',
          online: u.last_active_at
            ? new Date(u.last_active_at).getTime() >= Date.now() - 5 * 60 * 1000
            : false,
          currentActivity: u.current_activity || 'idle',
        },
        lastMessage: m.content || '',
        lastAt: m.created_at,
        sentByMe: m.sender_id === me,
        unread: Number(r.unread || 0),
      };
    });
    res.json({ conversations });
  } catch (err) {
    next(err);
  }
});

// GET /api/dm/:userId/messages?limit=30&beforeId= — last N messages with this user
router.get('/:userId/messages', async (req, res, next) => {
  try {
    const me = req.user.id;
    const other = Number.parseInt(req.params.userId, 10);
    if (!other || Number.isNaN(other)) return res.status(400).json({ message: 'Invalid user ID.' });
    const allowed = await relationExists(me, other);
    if (!allowed) return res.status(403).json({ message: 'You must follow each other (or one direction) to DM.' });

    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 30));
    const beforeId = Number.parseInt(req.query.beforeId, 10);
    const beforeClause = Number.isFinite(beforeId) && beforeId > 0 ? `AND id < ${beforeId}` : '';

    const rows = await query(
      `SELECT id, sender_id, recipient_id, content, created_at, read_at
       FROM dm_messages
       WHERE ((sender_id = ? AND recipient_id = ?)
           OR (sender_id = ? AND recipient_id = ?))
         ${beforeClause}
       ORDER BY id DESC
       LIMIT ${limit}`,
      [me, other, other, me]
    );

    // Mark received messages as read
    try {
      await run(
        `UPDATE dm_messages SET read_at = NOW()
         WHERE recipient_id = ? AND sender_id = ? AND read_at IS NULL`,
        [me, other]
      );
    } catch { /* non-fatal */ }

    res.json({
      messages: rows.reverse().map((r) => ({
        id: r.id,
        from: r.sender_id,
        to: r.recipient_id,
        content: r.content,
        createdAt: r.created_at,
        readAt: r.read_at,
        sentByMe: r.sender_id === me,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/dm/:userId/messages — send a message
router.post('/:userId/messages', async (req, res, next) => {
  try {
    const me = req.user.id;
    const other = Number.parseInt(req.params.userId, 10);
    if (!other || Number.isNaN(other)) return res.status(400).json({ message: 'Invalid user ID.' });
    if (other === me) return res.status(400).json({ message: 'Cannot DM yourself.' });

    const allowed = await relationExists(me, other);
    if (!allowed) return res.status(403).json({ message: 'You must follow each other (or one direction) to DM.' });

    const content = safeContent(req.body?.content);
    if (!content) return res.status(400).json({ message: 'Empty message.' });

    const id = await insert(
      'INSERT INTO dm_messages (sender_id, recipient_id, content) VALUES (?, ?, ?)',
      [me, other, content]
    );
    res.status(201).json({
      id,
      from: me,
      to: other,
      content,
      createdAt: new Date().toISOString(),
      sentByMe: true,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/dm/unread-count — badge for nav
router.get('/unread-count', async (req, res, next) => {
  try {
    const row = await queryOne(
      'SELECT COUNT(*) AS cnt FROM dm_messages WHERE recipient_id = ? AND read_at IS NULL',
      [req.user.id]
    );
    res.json({ count: Number(row?.cnt || 0) });
  } catch (err) {
    next(err);
  }
});

export default router;
