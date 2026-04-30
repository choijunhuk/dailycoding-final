import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { query } from '../config/mysql.js';

const router = Router();

function normalizeQuery(value, maxLength = 100) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

router.get('/search', auth, async (req, res) => {
  const q = normalizeQuery(req.query.q, 100);
  const type = ['all', 'problem', 'post'].includes(req.query.type) ? req.query.type : 'all';
  const limit = Math.min(20, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));

  if (!q) {
    return res.json({ problems: [], posts: [], total: 0 });
  }

  try {
    const [problems, posts] = await Promise.all([
      type === 'post'
        ? Promise.resolve([])
        : query(
            `SELECT p.id, p.title, p.tier, p.difficulty, GROUP_CONCAT(DISTINCT pt.tag ORDER BY pt.tag) AS tags
             FROM problems p
             LEFT JOIN problem_tags pt ON pt.problem_id = p.id
             WHERE COALESCE(p.visibility, 'global') = 'global'
               AND (p.title LIKE ? OR EXISTS (
                 SELECT 1 FROM problem_tags t WHERE t.problem_id = p.id AND t.tag LIKE ?
             ))
             GROUP BY p.id
             ORDER BY p.solved_count DESC, p.id DESC
             LIMIT ${limit}`,
            [`%${q}%`, `%${q}%`]
          ),
      type === 'problem'
        ? Promise.resolve([])
        : query(
            `SELECT id, board_type, title, content, like_count, answer_count, created_at
             FROM posts
             WHERE title LIKE ? OR content LIKE ?
             ORDER BY like_count DESC, created_at DESC
             LIMIT ${limit}`,
            [`%${q}%`, `%${q}%`]
          ),
    ]);

    const normalizedProblems = (problems || []).map((row) => ({
      ...row,
      tags: row.tags ? row.tags.split(',') : [],
    }));
    const normalizedPosts = posts || [];

    res.json({
      problems: normalizedProblems,
      posts: normalizedPosts,
      total: normalizedProblems.length + normalizedPosts.length,
    });
  } catch (err) {
    console.error('[search]', err);
    res.status(500).json({ message: '검색 중 오류가 발생했습니다.' });
  }
});

export default router;
