import { Router } from 'express';
import { auth, requireVerified } from '../middleware/auth.js';
import { query, queryOne, insert, run, transaction } from '../config/mysql.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { validateBody, communityPostSchema } from '../middleware/validate.js';
import { communityPostLimiter, communityReplyLimiter } from '../middleware/rateLimit.js';

const router = Router();
const PAGE_SIZE = 20;
const ALLOWED_BLOCK_ALIASES = new Set(['p', 'r', 'c', 'post', 'reply']);

// ── 헬퍼 ──────────────────────────────────────────────────────────────────

function parsePage(q) {
  const p = parseInt(q, 10);
  return p > 0 ? p : 1;
}

const VALID_BOARDS = new Set(['qna', 'tech', 'lounge']);

function boardGuard(req, res, next) {
  if (!VALID_BOARDS.has(req.params.board)) {
    return res.status(400).json({ message: '유효하지 않은 게시판입니다. (qna | tech | lounge)' });
  }
  next();
}

// 본문에서 #숫자 패턴을 추출해 BOJ 링크 참조 배열로 반환
function extractBojRefs(content) {
  if (!content) return [];
  const matches = [...content.matchAll(/#(\d+)/g)];
  const unique = [...new Set(matches.map(m => Number(m[1])))];
  return unique.map(num => ({
    problemNumber: num,
    url: `https://www.acmicpc.net/problem/${num}`,
  }));
}

// @username 멘션 감지 → 해당 유저에게 알림 발송 (비동기, 실패 무시)
async function notifyMentions(content, authorId, postTitle, board) {
  if (!content) return;
  const usernames = [...new Set(
    [...content.matchAll(/@([a-zA-Z0-9_가-힣]{2,30})/g)].map(m => m[1])
  )];
  if (usernames.length === 0) return;
  const boardLabel = { qna: 'Q&A', tech: '기술 토론', lounge: '라운지' }[board] || '커뮤니티';
  for (const uname of usernames) {
    try {
      const mentioned = await queryOne('SELECT id FROM users WHERE username = ? OR nickname = ?', [uname, uname]);
      if (mentioned && mentioned.id !== authorId) {
        Notification.create(
          mentioned.id,
          `📢 "${postTitle.slice(0, 30)}" 게시글에서 @${uname} 님이 멘션됐습니다. [${boardLabel}]`,
          'community'
        ).catch((err) => console.warn('[notification] create failed:', err.message));
      }
    } catch { /* 멘션 알림 실패 시 무시 */ }
  }
}

function sanitizeTags(tags) {
  if (!Array.isArray(tags)) return null;
  return tags
    .filter((tag) => typeof tag === 'string' && tag.trim().length > 0)
    .map((tag) => tag.trim().slice(0, 30))
    .slice(0, 10);
}

function normalizePoll(poll) {
  if (!poll?.question || !Array.isArray(poll.options)) return null;
  const question = String(poll.question).trim().slice(0, 200);
  const options = poll.options
    .filter((option) => typeof option === 'string' && option.trim().length > 0)
    .map((option) => option.trim().slice(0, 100))
    .slice(0, 10);
  if (!question || options.length < 2) return null;
  return { question, options };
}

// 차단 필터 SQL 조건 (blocker_id 기준으로 blocked 유저의 글/댓글 제거)
function buildBlockedUserClause(alias, userId) {
  if (!ALLOWED_BLOCK_ALIASES.has(alias)) {
    throw new Error(`Invalid blocked-user alias: ${alias}`);
  }
  const id = Number.parseInt(userId, 10);
  if (!Number.isFinite(id)) {
    return { clause: '', params: [] };
  }
  return {
    clause: `AND NOT EXISTS (
      SELECT 1
      FROM user_blocks ub
      WHERE ub.blocker_id = ? AND ub.blocked_id = ${alias}.user_id
    )`,
    params: [id],
  };
}

const blockFilter = (userId) => buildBlockedUserClause('p', userId);
const replyBlockFilter = (userId) => buildBlockedUserClause('r', userId);

// ── 인기 게시판 (최근 24시간, 추천 10개 이상) ────────────────────────────────
// GET /api/community/popular
router.get('/popular', auth, async (req, res) => {
  try {
    const blocked = blockFilter(req.user.id);
    const posts = await query(
      `SELECT p.id, p.board_type, p.user_id, u.username, u.nickname, u.tier,
              p.title, p.tags, p.view_count, p.like_count, p.answer_count,
              p.is_solved, p.is_anonymous, p.created_at
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
         AND p.like_count >= 10
         ${blocked.clause}
       ORDER BY p.like_count DESC, p.created_at DESC
       LIMIT 50`,
      blocked.params
    );
    res.json({ posts: posts || [] });
  } catch (err) {
    console.error('[community/popular]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 내 스크랩 목록 ─────────────────────────────────────────────────────────
// GET /api/community/scraps/mine  (반드시 /:board/:id 보다 먼저 등록)
router.get('/scraps/mine', auth, async (req, res) => {
  try {
    const posts = await query(
      `SELECT p.id, p.board_type, p.title, p.like_count, p.answer_count, p.created_at,
              u.username, u.nickname, u.tier, ps.created_at AS scrapped_at
       FROM post_scraps ps
       JOIN posts p ON ps.post_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE ps.user_id = ?
       ORDER BY ps.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json({ posts: posts || [] });
  } catch (err) {
    console.error('[community/scraps/mine]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 내 차단 목록 ──────────────────────────────────────────────────────────
// GET /api/community/block/list  (반드시 /:board/:id 보다 먼저 등록)
router.get('/block/list', auth, async (req, res) => {
  try {
    const rows = await query(
      `SELECT u.id, u.username, u.nickname, u.tier, ub.created_at AS blocked_at
       FROM user_blocks ub JOIN users u ON ub.blocked_id = u.id
       WHERE ub.blocker_id = ?
       ORDER BY ub.created_at DESC`,
      [req.user.id]
    );
    res.json({ blocked: rows || [] });
  } catch (err) {
    console.error('[community/block/list]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 유저 차단 토글 ────────────────────────────────────────────────────────
// POST /api/community/block/:targetId  (반드시 /:board/:id 보다 먼저 등록)
router.post('/block/:targetId', auth, async (req, res) => {
  const targetId = Number(req.params.targetId);
  if (!targetId || targetId === req.user.id) {
    return res.status(400).json({ message: '유효하지 않은 대상입니다.' });
  }
  try {
    const target = await queryOne('SELECT id FROM users WHERE id = ?', [targetId]);
    if (!target) return res.status(404).json({ message: '유저를 찾을 수 없습니다.' });
    const result = await User.toggleBlock(req.user.id, targetId);
    res.json(result);
  } catch (err) {
    console.error('[community/block]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 게시글 목록 (페이지네이션) ────────────────────────────────────────────
// GET /api/community/:board?page=1&q=검색어
router.get('/:board', auth, boardGuard, async (req, res) => {
  const { board } = req.params;
  const page = parsePage(req.query.page);
  const offset = (page - 1) * PAGE_SIZE;
  const search = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  const tag = typeof req.query.tag === 'string' ? req.query.tag.trim().slice(0, 50) : '';

  try {
    const blocked = blockFilter(req.user.id);
    let sql = `
      SELECT p.id, p.board_type, p.user_id, u.username, u.nickname, u.tier,
             p.title, p.tags, p.view_count, p.like_count, p.answer_count,
             p.is_solved, p.is_pinned, p.is_anonymous, p.created_at, p.problem_id
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.board_type = ?
        ${blocked.clause}
    `;
    const params = [board, ...blocked.params];

    if (search) {
      sql += ' AND (p.title LIKE ? OR p.content LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (tag) {
      sql += ' AND JSON_CONTAINS(p.tags, JSON_QUOTE(?))';
      params.push(tag);
    }

    sql += ` ORDER BY p.is_pinned DESC, p.created_at DESC LIMIT ${PAGE_SIZE} OFFSET ${offset}`;

    // 익명 글의 경우 작성자 정보 마스킹
    const rawRows = await query(sql, params);
    const rows = (rawRows || []).map(r => r.is_anonymous
      ? { ...r, user_id: null, username: '익명', nickname: null }
      : r
    );

    let countExtra = '';
    const countParams = [board];
    if (search) { countExtra += ' AND (p.title LIKE ? OR p.content LIKE ?)'; countParams.push(`%${search}%`, `%${search}%`); }
    if (tag)    { countExtra += ' AND JSON_CONTAINS(p.tags, JSON_QUOTE(?))'; countParams.push(tag); }

    const countSql = `
      SELECT COUNT(*) AS cnt FROM posts p
      WHERE p.board_type = ?
        ${blocked.clause}
        ${countExtra}
    `;
    const countRow = await queryOne(countSql, [board, ...blocked.params, ...countParams.slice(1)]);

    res.json({
      posts: rows,
      page,
      totalPages: Math.ceil((countRow?.cnt || 0) / PAGE_SIZE),
      total: countRow?.cnt || 0,
    });
  } catch (err) {
    console.error('[community/list]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 게시글 상세 ───────────────────────────────────────────────────────────
// GET /api/community/:board/:id
router.get('/:board/:id', auth, boardGuard, async (req, res) => {
  const postId = Number(req.params.id);
  if (!postId) return res.status(400).json({ message: '유효하지 않은 ID' });
  try {
    const blockedReplies = replyBlockFilter(req.user.id);
    const post = await queryOne(
      `SELECT p.*, u.username, u.nickname, u.tier, u.avatar_color, u.avatar_emoji
       FROM posts p JOIN users u ON p.user_id = u.id
       WHERE p.id = ? AND p.board_type = ?`,
      [postId, req.params.board]
    );
    if (!post) return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });

    // 조회수 비동기 증가
    run('UPDATE posts SET view_count = view_count + 1 WHERE id = ?', [postId]).catch(() => {});

    // 익명 글 작성자 마스킹 (본인 제외)
    const authorMasked = post.is_anonymous && post.user_id !== req.user.id;
    if (authorMasked) {
      post.user_id = null;
      post.username = '익명';
      post.nickname = null;
    }

    const [replies, poll, scrapRow] = await Promise.all([
      query(
        `SELECT r.id, r.user_id, u.username, u.nickname, u.tier, u.avatar_color, u.avatar_emoji,
                r.content, r.code_snippet, r.lang, r.like_count, r.is_accepted,
                r.decocon_id, r.created_at
         FROM post_replies r JOIN users u ON r.user_id = u.id
         WHERE r.post_id = ?
           ${blockedReplies.clause}
         ORDER BY r.is_accepted DESC, r.created_at ASC`,
        [postId, ...blockedReplies.params]
      ),
      queryOne('SELECT id, question FROM polls WHERE post_id = ?', [postId]),
      queryOne('SELECT 1 FROM post_scraps WHERE user_id = ? AND post_id = ?', [req.user.id, postId]),
    ]);

    let pollData = null;
    if (poll) {
      const options = await query(
        'SELECT id, label, votes, ord FROM poll_options WHERE poll_id = ? ORDER BY ord',
        [poll.id]
      );
      const myVote = await queryOne(
        'SELECT option_id FROM poll_votes WHERE user_id = ? AND poll_id = ?',
        [req.user.id, poll.id]
      );
      pollData = { ...poll, options: options || [], myVoteOptionId: myVote?.option_id ?? null };
    }

    res.json({
      ...post,
      isScrapped: !!scrapRow,
      boj_refs: extractBojRefs(post.content),
      poll: pollData,
      replies: replies || [],
    });
  } catch (err) {
    console.error('[community/detail]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 게시글 작성 ───────────────────────────────────────────────────────────
// POST /api/community/:board
router.post('/:board', auth, requireVerified, communityPostLimiter, boardGuard, validateBody(communityPostSchema), async (req, res) => {
  const { title, content, code_snippet, lang, tags, problem_id, is_anonymous, poll } = req.body;
  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ message: '제목과 내용은 필수입니다.' });
  }
  try {
    const cleanTags = sanitizeTags(tags);
    const normalizedPoll = normalizePoll(poll);
    const id = await transaction(async (conn) => {
      const [postResult] = await conn.query(
        `INSERT INTO posts (board_type, user_id, title, content, code_snippet, lang, tags, problem_id, is_anonymous, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          req.params.board,
          req.user.id,
          title.trim().slice(0, 300),
          content.trim(),
          code_snippet || null,
          lang || null,
          cleanTags === null ? null : JSON.stringify(cleanTags),
          problem_id ? Number(problem_id) : null,
          is_anonymous ? 1 : 0,
        ]
      );

      const postId = postResult.insertId;
      if (normalizedPoll) {
        const [pollResult] = await conn.query(
          'INSERT INTO polls (post_id, question) VALUES (?, ?)',
          [postId, normalizedPoll.question]
        );
        const pollId = pollResult.insertId;
        for (let i = 0; i < normalizedPoll.options.length; i++) {
          await conn.query(
            'INSERT INTO poll_options (poll_id, label, ord) VALUES (?, ?, ?)',
            [pollId, normalizedPoll.options[i], i]
          );
        }
      }

      return postId;
    });

    const post = await queryOne('SELECT * FROM posts WHERE id = ?', [id]);
    // 멘션 알림 비동기 발송
    notifyMentions(content.trim(), req.user.id, title.trim(), req.params.board).catch((err) => {
      console.warn('[notification] mention failed:', err.message);
    });
    res.status(201).json({ ...post, boj_refs: extractBojRefs(post.content) });
  } catch (err) {
    console.error('[community/create]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 게시글 수정 ───────────────────────────────────────────────────────────
// PATCH /api/community/:board/:id
router.patch('/:board/:id', auth, requireVerified, boardGuard, async (req, res) => {
  const postId = Number(req.params.id);
  const post = await queryOne('SELECT * FROM posts WHERE id = ? AND board_type = ?', [postId, req.params.board]);
  if (!post) return res.status(404).json({ message: '게시글 없음' });
  if (post.user_id !== req.user.id) return res.status(403).json({ message: '권한 없음' });

  const { title, content, code_snippet, lang, tags } = req.body;
  if (title !== undefined && String(title).length > 300) {
    return res.status(400).json({ message: 'title은(는) 300자 이하여야 합니다.' });
  }
  if (content !== undefined && String(content).length > 10000) {
    return res.status(400).json({ message: 'content은(는) 10000자 이하여야 합니다.' });
  }
  try {
    const cleanTags = tags === undefined ? undefined : sanitizeTags(tags);
    await run(
      'UPDATE posts SET title=?, content=?, code_snippet=?, lang=?, tags=?, updated_at=NOW() WHERE id=?',
      [
        (title || post.title).trim().slice(0, 300),
        (content || post.content).trim(),
        code_snippet ?? post.code_snippet,
        lang ?? post.lang,
        cleanTags === undefined ? post.tags : cleanTags === null ? null : JSON.stringify(cleanTags),
        postId,
      ]
    );
    const updated = await queryOne('SELECT * FROM posts WHERE id = ?', [postId]);
    res.json({ ...updated, boj_refs: extractBojRefs(updated.content) });
  } catch (err) {
    console.error('[community/update]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 게시글 삭제 ───────────────────────────────────────────────────────────
// DELETE /api/community/:board/:id
router.delete('/:board/:id', auth, boardGuard, async (req, res) => {
  const postId = Number(req.params.id);
  const post = await queryOne('SELECT * FROM posts WHERE id = ?', [postId]);
  if (!post) return res.status(404).json({ message: '게시글 없음' });

  const requester = await User.findById(req.user.id);
  if (post.user_id !== req.user.id && requester?.role !== 'admin') {
    return res.status(403).json({ message: '권한 없음' });
  }
  await run('DELETE FROM posts WHERE id = ?', [postId]);
  res.json({ message: '삭제됐습니다.' });
});

// ── 댓글 작성 ─────────────────────────────────────────────────────────────
// POST /api/community/:board/:id/replies
router.post('/:board/:id/replies', auth, requireVerified, communityReplyLimiter, boardGuard, async (req, res) => {
  const postId = Number(req.params.id);
  const { content, code_snippet, lang, decocon_id } = req.body;
  if (!content?.trim()) return res.status(400).json({ message: '내용은 필수입니다.' });

  try {
    const post = await queryOne('SELECT * FROM posts WHERE id = ? AND board_type = ?', [postId, req.params.board]);
    if (!post) return res.status(404).json({ message: '게시글 없음' });

    const replyId = await insert(
      'INSERT INTO post_replies (post_id, user_id, content, code_snippet, lang, decocon_id, created_at) VALUES (?,?,?,?,?,?,NOW())',
      [postId, req.user.id, content.trim(), code_snippet || null, lang || null, decocon_id || null]
    );
    await run('UPDATE posts SET answer_count = answer_count + 1 WHERE id = ?', [postId]);

    // 알림: 내 글에 남이 댓글 달면 알림
    if (post.user_id !== req.user.id) {
      const board_label = { qna: 'Q&A', tech: '기술 토론', lounge: '라운지' }[req.params.board] || '커뮤니티';
      Notification.create(
        post.user_id,
        `💬 "${post.title.slice(0, 30)}" 게시글에 새 댓글이 달렸습니다. [${board_label}]`,
        'community'
      ).catch((err) => console.warn('[notification] create failed:', err.message));
    }

    const reply = await queryOne(
      `SELECT r.*, u.username, u.nickname, u.tier FROM post_replies r JOIN users u ON r.user_id = u.id WHERE r.id = ?`,
      [replyId]
    );
    // 멘션 알림 비동기 발송
    notifyMentions(content.trim(), req.user.id, post.title, req.params.board).catch((err) => {
      console.warn('[notification] mention failed:', err.message);
    });
    res.status(201).json(reply);
  } catch (err) {
    console.error('[community/reply/create]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 댓글 삭제 ─────────────────────────────────────────────────────────────
// DELETE /api/community/:board/:postId/replies/:replyId
router.delete('/:board/:postId/replies/:replyId', auth, boardGuard, async (req, res) => {
  const postId = Number(req.params.postId);
  const replyId = Number(req.params.replyId);
  if (!postId || !replyId) return res.status(400).json({ message: '유효하지 않은 ID' });

  try {
    const [post, reply, requester] = await Promise.all([
      queryOne('SELECT * FROM posts WHERE id = ? AND board_type = ?', [postId, req.params.board]),
      queryOne('SELECT * FROM post_replies WHERE id = ? AND post_id = ?', [replyId, postId]),
      User.findById(req.user.id),
    ]);
    if (!post) return res.status(404).json({ message: '게시글 없음' });
    if (!reply) return res.status(404).json({ message: '댓글 없음' });
    if (reply.user_id !== req.user.id && post.user_id !== req.user.id && requester?.role !== 'admin') {
      return res.status(403).json({ message: '권한 없음' });
    }

    await run('DELETE FROM post_replies WHERE id = ?', [replyId]);
    await run('UPDATE posts SET answer_count = GREATEST(0, answer_count - 1) WHERE id = ?', [postId]);
    res.json({ message: '삭제됐습니다.' });
  } catch (err) {
    console.error('[community/reply/delete]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 답변 채택 (Q&A 전용) ─────────────────────────────────────────────────
// POST /api/community/qna/:id/replies/:replyId/accept
router.post('/qna/:id/replies/:replyId/accept', auth, async (req, res) => {
  const postId  = Number(req.params.id);
  const replyId = Number(req.params.replyId);
  try {
    const post = await queryOne('SELECT * FROM posts WHERE id = ? AND board_type = ?', [postId, 'qna']);
    if (!post) return res.status(404).json({ message: '게시글 없음' });
    if (post.user_id !== req.user.id) return res.status(403).json({ message: '작성자만 채택할 수 있습니다.' });

    const reply = await queryOne('SELECT * FROM post_replies WHERE id = ? AND post_id = ?', [replyId, postId]);
    if (!reply) return res.status(404).json({ message: '댓글 없음' });

    await run('UPDATE post_replies SET is_accepted = 0 WHERE post_id = ?', [postId]);
    await run('UPDATE post_replies SET is_accepted = 1 WHERE id = ?', [replyId]);
    await run('UPDATE posts SET is_solved = 1 WHERE id = ?', [postId]);

    if (reply.user_id !== req.user.id) {
      Notification.create(
        reply.user_id,
        `✅ Q&A "${post.title.slice(0, 30)}"에서 내 답변이 채택됐습니다!`,
        'community'
      ).catch((err) => console.warn('[notification] create failed:', err.message));
    }

    res.json({ message: '답변이 채택됐습니다.' });
  } catch (err) {
    console.error('[community/accept]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 좋아요 토글 ───────────────────────────────────────────────────────────
// POST /api/community/:board/:id/like
router.post('/:board/:id/like', auth, boardGuard, async (req, res) => {
  const postId = Number(req.params.id);
  try {
    const insertResult = await run(
      "INSERT IGNORE INTO post_likes (user_id, target_type, target_id) VALUES (?, 'post', ?)",
      [req.user.id, postId]
    );
    if (insertResult.affectedRows > 0) {
      await run('UPDATE posts SET like_count = like_count + 1 WHERE id = ?', [postId]);
      return res.json({ liked: true });
    }
    const deleteResult = await run(
      "DELETE FROM post_likes WHERE user_id=? AND target_type='post' AND target_id=?",
      [req.user.id, postId]
    );
    if (deleteResult.affectedRows > 0) {
      await run('UPDATE posts SET like_count = GREATEST(0, like_count - 1) WHERE id = ?', [postId]);
    }
    res.json({ liked: false });
  } catch (err) {
    console.error('[community/like]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 스크랩 토글 ───────────────────────────────────────────────────────────
// POST /api/community/:board/:id/scrap
router.post('/:board/:id/scrap', auth, boardGuard, async (req, res) => {
  const postId = Number(req.params.id);
  if (!postId) return res.status(400).json({ message: '유효하지 않은 ID' });
  try {
    // 게시글 존재 확인
    const post = await queryOne('SELECT 1 FROM posts WHERE id = ? AND board_type = ?', [postId, req.params.board]);
    if (!post) return res.status(404).json({ message: '게시글 없음' });
    const insertResult = await run('INSERT IGNORE INTO post_scraps (user_id, post_id) VALUES (?, ?)', [req.user.id, postId]);
    if (insertResult.affectedRows > 0) {
      return res.json({ scrapped: true });
    }
    await run('DELETE FROM post_scraps WHERE user_id = ? AND post_id = ?', [req.user.id, postId]);
    res.json({ scrapped: false });
  } catch (err) {
    console.error('[community/scrap]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 투표 조회 ─────────────────────────────────────────────────────────────
// GET /api/community/:board/:id/poll
router.get('/:board/:id/poll', auth, boardGuard, async (req, res) => {
  const postId = Number(req.params.id);
  if (!postId) return res.status(400).json({ message: '유효하지 않은 ID' });
  try {
    const poll = await queryOne('SELECT id, question FROM polls WHERE post_id = ?', [postId]);
    if (!poll) return res.status(404).json({ message: '투표가 없습니다.' });

    const [options, myVote] = await Promise.all([
      query('SELECT id, label, votes, ord FROM poll_options WHERE poll_id = ? ORDER BY ord', [poll.id]),
      queryOne('SELECT option_id FROM poll_votes WHERE user_id = ? AND poll_id = ?', [req.user.id, poll.id]),
    ]);
    res.json({ ...poll, options: options || [], myVoteOptionId: myVote?.option_id ?? null });
  } catch (err) {
    console.error('[community/poll/get]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 투표 참여 ─────────────────────────────────────────────────────────────
// POST /api/community/:board/:id/poll/:optionId/vote
router.post('/:board/:id/poll/:optionId/vote', auth, boardGuard, async (req, res) => {
  const postId   = Number(req.params.id);
  const optionId = Number(req.params.optionId);
  if (!postId || !optionId) return res.status(400).json({ message: '유효하지 않은 ID' });
  try {
    const poll = await queryOne('SELECT id FROM polls WHERE post_id = ?', [postId]);
    if (!poll) return res.status(404).json({ message: '투표가 없습니다.' });

    const option = await queryOne(
      'SELECT id FROM poll_options WHERE id = ? AND poll_id = ?',
      [optionId, poll.id]
    );
    if (!option) return res.status(404).json({ message: '선택지를 찾을 수 없습니다.' });

    // 이미 투표한 경우 이전 투표 취소 후 새 선택으로 교체
    const existing = await queryOne(
      'SELECT option_id FROM poll_votes WHERE user_id = ? AND poll_id = ?',
      [req.user.id, poll.id]
    );
    if (existing) {
      if (existing.option_id === optionId) {
        return res.status(409).json({ message: '이미 해당 선택지에 투표했습니다.' });
      }
      // 기존 선택 취소
      await run('UPDATE poll_options SET votes = GREATEST(0, votes - 1) WHERE id = ?', [existing.option_id]);
      await run(
        'UPDATE poll_votes SET option_id = ? WHERE user_id = ? AND poll_id = ?',
        [optionId, req.user.id, poll.id]
      );
    } else {
      await run(
        'INSERT INTO poll_votes (user_id, poll_id, option_id) VALUES (?, ?, ?)',
        [req.user.id, poll.id, optionId]
      );
    }
    await run('UPDATE poll_options SET votes = votes + 1 WHERE id = ?', [optionId]);

    const options = await query(
      'SELECT id, label, votes, ord FROM poll_options WHERE poll_id = ? ORDER BY ord',
      [poll.id]
    );
    res.json({ options, myVoteOptionId: optionId });
  } catch (err) {
    console.error('[community/poll/vote]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 댓글 좋아요 토글 ──────────────────────────────────────────────────────
// POST /api/community/:board/:id/replies/:replyId/like
router.post('/:board/:id/replies/:replyId/like', auth, boardGuard, async (req, res) => {
  const replyId = Number(req.params.replyId);
  if (!replyId) return res.status(400).json({ message: '유효하지 않은 ID' });
  try {
    const insertResult = await run(
      "INSERT IGNORE INTO post_likes (user_id, target_type, target_id) VALUES (?, 'reply', ?)",
      [req.user.id, replyId]
    );
    if (insertResult.affectedRows > 0) {
      await run('UPDATE post_replies SET like_count = like_count + 1 WHERE id = ?', [replyId]);
      return res.json({ liked: true });
    }
    const deleteResult = await run(
      "DELETE FROM post_likes WHERE user_id=? AND target_type='reply' AND target_id=?",
      [req.user.id, replyId]
    );
    if (deleteResult.affectedRows > 0) {
      await run('UPDATE post_replies SET like_count = GREATEST(0, like_count - 1) WHERE id = ?', [replyId]);
    }
    res.json({ liked: false });
  } catch (err) {
    console.error('[community/reply/like]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 게시글 신고 ───────────────────────────────────────────────────────────
// POST /api/community/:board/:id/report
router.post('/:board/:id/report', auth, boardGuard, async (req, res) => {
  const postId = Number(req.params.id);
  if (!postId) return res.status(400).json({ message: '유효하지 않은 ID' });
  const VALID_REASONS = new Set(['spam', 'hate', 'illegal', 'misinformation', 'other']);
  const { reason, detail } = req.body;
  if (!VALID_REASONS.has(reason)) {
    return res.status(400).json({ message: '유효하지 않은 신고 사유입니다. (spam|hate|illegal|misinformation|other)' });
  }
  try {
    const post = await queryOne('SELECT 1 FROM posts WHERE id = ? AND board_type = ?', [postId, req.params.board]);
    if (!post) return res.status(404).json({ message: '게시글 없음' });

    await insert(
      'INSERT INTO post_reports (reporter_id, target_type, target_id, reason, detail) VALUES (?,?,?,?,?)',
      [req.user.id, 'post', postId, reason, detail?.slice(0, 200) || null]
    );
    res.json({ message: '신고가 접수됐습니다.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: '이미 신고한 게시글입니다.' });
    console.error('[community/report]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 댓글 신고 ─────────────────────────────────────────────────────────────
// POST /api/community/:board/:id/replies/:replyId/report
router.post('/:board/:id/replies/:replyId/report', auth, boardGuard, async (req, res) => {
  const replyId = Number(req.params.replyId);
  if (!replyId) return res.status(400).json({ message: '유효하지 않은 ID' });
  const VALID_REASONS = new Set(['spam', 'hate', 'illegal', 'misinformation', 'other']);
  const { reason, detail } = req.body;
  if (!VALID_REASONS.has(reason)) {
    return res.status(400).json({ message: '유효하지 않은 신고 사유입니다.' });
  }
  try {
    const reply = await queryOne('SELECT 1 FROM post_replies WHERE id = ?', [replyId]);
    if (!reply) return res.status(404).json({ message: '댓글 없음' });

    await insert(
      'INSERT INTO post_reports (reporter_id, target_type, target_id, reason, detail) VALUES (?,?,?,?,?)',
      [req.user.id, 'reply', replyId, reason, detail?.slice(0, 200) || null]
    );
    res.json({ message: '신고가 접수됐습니다.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: '이미 신고한 댓글입니다.' });
    console.error('[community/reply/report]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

export default router;
