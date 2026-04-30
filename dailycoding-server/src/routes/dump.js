import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { auth } from '../middleware/auth.js';
import { query, queryOne, insert, run } from '../config/mysql.js';
import { Notification } from '../models/Notification.js';
import { generateAnonId, generateAnonName, shortAnonId } from '../utils/dumpAnon.js';

const router = Router();
const PAGE_SIZE = 30;

// ── 도배 방지 Rate Limiter ────────────────────────────────────────────────
const postLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1분
  max: 30,                   // 글 작성 최대 30개/분
  keyGenerator: (req) => String(req.user?.id || req.ip),
  handler: (req, res) => res.status(429).json({ message: '뻘글도 너무 많이 싸면 제한됩니다. (1분 30개 한도)' }),
  skip: (req) => !req.user,
});

const replyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => String(req.user?.id || req.ip),
  handler: (req, res) => res.status(429).json({ message: '댓글도 1분에 30개까지만요.' }),
  skip: (req) => !req.user,
});

// ── 헬퍼: 익명/실명(고닉) 분기 포맷 ────────────────────────────────────────
// is_anonymous=true  → anon_name:'ㅇㅇ', short_anon_id:'a1b2' (user_id 비노출)
// is_anonymous=false → username(고닉)과 user_id 노출, anon 필드 제외
function safeDumpPost(row) {
  const base = {
    id:           row.id,
    is_anonymous: !!row.is_anonymous,
    content:      row.is_blinded ? '[신고로 블라인드된 게시글입니다]' : row.content,
    is_blinded:   row.is_blinded,
    upvote:       row.upvote,
    downvote:     row.downvote,
    reply_count:  row.reply_count,
    created_at:   row.created_at,
  };

  if (row.is_anonymous) {
    base.anon_name     = 'ㅇㅇ';
    base.short_anon_id = shortAnonId(row.anon_id);
    // anon_id 풀값은 내부 식별용 — 프론트에 4자리만 노출
  } else {
    base.user_id  = row.user_id;
    base.username = row.username;  // JOIN 또는 별도 조회 시 포함
  }

  return base;
}

function safeDumpReply(row) {
  const base = {
    id:           row.id,
    post_id:      row.post_id,
    is_anonymous: !!row.is_anonymous,
    content:      row.is_blinded ? '[신고로 블라인드된 댓글입니다]' : row.content,
    is_blinded:   row.is_blinded,
    upvote:       row.upvote,
    created_at:   row.created_at,
  };

  if (row.is_anonymous) {
    base.anon_name     = 'ㅇㅇ';
    base.short_anon_id = shortAnonId(row.anon_id);
  } else {
    base.user_id  = row.user_id;
    base.username = row.username;
  }

  return base;
}

// ── 글 목록 (페이지네이션) ────────────────────────────────────────────────
// GET /api/dump?page=1
router.get('/', auth, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  try {
    const [rows, countRow] = await Promise.all([
      query(
        `SELECT p.*, u.username
         FROM dump_posts p LEFT JOIN users u ON p.user_id = u.id
         ORDER BY p.created_at DESC LIMIT ${PAGE_SIZE} OFFSET ${offset}`
      ),
      queryOne('SELECT COUNT(*) AS cnt FROM dump_posts'),
    ]);
    res.json({
      posts: (rows || []).map(safeDumpPost),
      page,
      totalPages: Math.ceil((countRow?.cnt || 0) / PAGE_SIZE),
      total: countRow?.cnt || 0,
    });
  } catch (err) {
    console.error('[dump/list]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 글 상세 + 댓글 ────────────────────────────────────────────────────────
// GET /api/dump/:id
router.get('/:id', auth, async (req, res) => {
  const postId = Number(req.params.id);
  if (!postId) return res.status(400).json({ message: '유효하지 않은 ID' });
  try {
    const post = await queryOne(
      `SELECT p.*, u.username FROM dump_posts p LEFT JOIN users u ON p.user_id = u.id WHERE p.id = ?`,
      [postId]
    );
    if (!post) return res.status(404).json({ message: '게시글 없음' });

    const replies = await query(
      `SELECT r.*, u.username FROM dump_replies r LEFT JOIN users u ON r.user_id = u.id WHERE r.post_id = ? ORDER BY r.created_at ASC`,
      [postId]
    );

    // 요청자의 당일 anon_id → 본인 글/댓글 표시용
    const myAnonId = generateAnonId(req.user.id);

    res.json({
      ...safeDumpPost(post),
      isMyPost: post.anon_id === myAnonId || (!post.is_anonymous && post.user_id === req.user.id),
      replies: (replies || []).map(r => ({
        ...safeDumpReply(r),
        isMyReply: r.anon_id === myAnonId || (!r.is_anonymous && r.user_id === req.user.id),
      })),
    });
  } catch (err) {
    console.error('[dump/detail]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 글 작성 ───────────────────────────────────────────────────────────────
// POST /api/dump  body: { content, is_anonymous?: boolean (default true) }
router.post('/', auth, postLimiter, async (req, res) => {
  const { content, is_anonymous = true } = req.body;
  if (!content?.trim()) return res.status(400).json({ message: '내용은 필수입니다.' });
  if (content.length > 5000) return res.status(400).json({ message: '5000자 이하로 작성해주세요.' });

  try {
    const anonId   = generateAnonId(req.user.id);
    const anonName = generateAnonName();           // 항상 'ㅇㅇ'
    const isAnon   = is_anonymous !== false ? 1 : 0;
    const id = await insert(
      'INSERT INTO dump_posts (user_id, anon_id, anon_name, content, is_anonymous, created_at) VALUES (?,?,?,?,?,NOW())',
      [req.user.id, anonId, anonName, content.trim(), isAnon]
    );
    const post = await queryOne(
      `SELECT p.*, u.username FROM dump_posts p LEFT JOIN users u ON p.user_id = u.id WHERE p.id = ?`,
      [id]
    );
    res.status(201).json(safeDumpPost(post));
  } catch (err) {
    console.error('[dump/create]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 글 삭제 (본인만) ──────────────────────────────────────────────────────
// DELETE /api/dump/:id
router.delete('/:id', auth, async (req, res) => {
  const postId = Number(req.params.id);
  try {
    const post = await queryOne('SELECT * FROM dump_posts WHERE id = ?', [postId]);
    if (!post) return res.status(404).json({ message: '게시글 없음' });

    const myAnonId = generateAnonId(req.user.id);
    const { User } = await import('../models/User.js');
    const requester = await User.findById(req.user.id);

    if (post.anon_id !== myAnonId && requester?.role !== 'admin') {
      return res.status(403).json({ message: '본인 글만 삭제할 수 있습니다.' });
    }
    await run('DELETE FROM dump_posts WHERE id = ?', [postId]);
    res.json({ message: '삭제됐습니다.' });
  } catch (err) {
    console.error('[dump/delete]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 댓글 작성 ─────────────────────────────────────────────────────────────
// POST /api/dump/:id/replies  body: { content, is_anonymous?: boolean (default true) }
router.post('/:id/replies', auth, replyLimiter, async (req, res) => {
  const postId = Number(req.params.id);
  const { content, is_anonymous = true } = req.body;
  if (!content?.trim()) return res.status(400).json({ message: '내용은 필수입니다.' });

  try {
    const post = await queryOne('SELECT * FROM dump_posts WHERE id = ?', [postId]);
    if (!post) return res.status(404).json({ message: '게시글 없음' });

    const anonId   = generateAnonId(req.user.id);
    const anonName = generateAnonName();           // 항상 'ㅇㅇ'
    const isAnon   = is_anonymous !== false ? 1 : 0;

    const replyId = await insert(
      'INSERT INTO dump_replies (post_id, user_id, anon_id, anon_name, content, is_anonymous, created_at) VALUES (?,?,?,?,?,?,NOW())',
      [postId, req.user.id, anonId, anonName, content.trim(), isAnon]
    );
    await run('UPDATE dump_posts SET reply_count = reply_count + 1 WHERE id = ?', [postId]);

    // 알림: 내 글에 댓글이 달리면 본계정으로 알림 (클라이언트엔 익명/실명 그대로 노출)
    if (post.user_id !== req.user.id) {
      Notification.create(
        post.user_id,
        `💬 덤프(뒷갤)에 올린 글에 새 댓글이 달렸습니다.`,
        'dump'
      ).catch(() => {});
    }

    const reply = await queryOne(
      `SELECT r.*, u.username FROM dump_replies r LEFT JOIN users u ON r.user_id = u.id WHERE r.id = ?`,
      [replyId]
    );
    res.status(201).json(safeDumpReply(reply));
  } catch (err) {
    console.error('[dump/reply/create]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 추천/비추천 ───────────────────────────────────────────────────────────
// POST /api/dump/:id/vote  body: { type: 'post'|'reply', targetId, vote: 1|-1 }
router.post('/:id/vote', auth, async (req, res) => {
  const { type, targetId, vote } = req.body;
  if (!['post', 'reply'].includes(type)) return res.status(400).json({ message: '유효하지 않은 타입' });
  if (![1, -1].includes(Number(vote))) return res.status(400).json({ message: '1 또는 -1만 허용됩니다.' });

  const anonId = generateAnonId(req.user.id);
  const tid = Number(targetId);

  try {
    const existing = await queryOne(
      'SELECT * FROM dump_votes WHERE anon_id=? AND target_type=? AND target_id=?',
      [anonId, type, tid]
    );
    if (existing) return res.status(409).json({ message: '이미 투표했습니다. (당일 기준)' });

    await run(
      'INSERT INTO dump_votes (anon_id, target_type, target_id, vote) VALUES (?,?,?,?)',
      [anonId, type, tid, Number(vote)]
    );

    const table  = type === 'post' ? 'dump_posts' : 'dump_replies';
    const col    = Number(vote) === 1 ? 'upvote' : 'downvote';
    await run(`UPDATE ${table} SET ${col} = ${col} + 1 WHERE id = ?`, [tid]);

    res.json({ message: '투표 완료' });
  } catch (err) {
    console.error('[dump/vote]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 신고 ──────────────────────────────────────────────────────────────────
// POST /api/dump/report  body: { target_type, target_id, reason }
router.post('/report', auth, async (req, res) => {
  const { target_type, target_id, reason } = req.body;
  const VALID_REASONS = new Set(['spam', 'hate', 'illegal', 'other']);
  if (!['post', 'reply'].includes(target_type) || !VALID_REASONS.has(reason)) {
    return res.status(400).json({ message: '유효하지 않은 신고 정보입니다.' });
  }

  try {
    await insert(
      'INSERT INTO dump_reports (reporter_id, target_type, target_id, reason, created_at) VALUES (?,?,?,?,NOW())',
      [req.user.id, target_type, Number(target_id), reason]
    );
    // 신고 횟수 카운트 업데이트
    const table = target_type === 'post' ? 'dump_posts' : 'dump_replies';
    await run(`UPDATE ${table} SET report_count = report_count + 1 WHERE id = ?`, [Number(target_id)]);
    res.json({ message: '신고가 접수됐습니다.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: '이미 신고한 게시물입니다.' });
    console.error('[dump/report]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

export default router;
