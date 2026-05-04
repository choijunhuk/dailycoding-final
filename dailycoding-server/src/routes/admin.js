import { Router } from 'express';
import redis from '../config/redis.js';
import { auth, adminOnly } from '../middleware/auth.js';
import { query, queryOne, run } from '../config/mysql.js';
import { AdminLog } from '../models/AdminLog.js';
import { getAIServiceStatus } from '../services/ai.js';

const router = Router();
const BATTLE_SETTINGS_KEY = 'admin:battle:settings';
const DEFAULT_BATTLE_SETTINGS = Object.freeze({
  codingCount: 2,
  fillBlankCount: 1,
  bugFixCount: 1,
  maxTotalProblems: 8,
});

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeBattleSettings(input = {}) {
  const codingCount = clampInt(input.codingCount, DEFAULT_BATTLE_SETTINGS.codingCount, 1, 8);
  const fillBlankCount = clampInt(input.fillBlankCount, DEFAULT_BATTLE_SETTINGS.fillBlankCount, 0, 6);
  const bugFixCount = clampInt(input.bugFixCount, DEFAULT_BATTLE_SETTINGS.bugFixCount, 0, 6);
  const maxTotalProblems = clampInt(input.maxTotalProblems, DEFAULT_BATTLE_SETTINGS.maxTotalProblems, 3, 20);
  const requestedTotal = codingCount + fillBlankCount + bugFixCount;
  const scale = requestedTotal > maxTotalProblems ? (maxTotalProblems / requestedTotal) : 1;

  const normalized = {
    codingCount: Math.max(1, Math.floor(codingCount * scale)),
    fillBlankCount: Math.floor(fillBlankCount * scale),
    bugFixCount: Math.floor(bugFixCount * scale),
    maxTotalProblems,
  };

  while (normalized.codingCount + normalized.fillBlankCount + normalized.bugFixCount > maxTotalProblems) {
    if (normalized.fillBlankCount > 0) normalized.fillBlankCount -= 1;
    else if (normalized.bugFixCount > 0) normalized.bugFixCount -= 1;
    else break;
  }

  return normalized;
}

async function logAdminAction(req, action, targetType, targetId, detail) {
  await AdminLog.create({
    adminId: req.user.id,
    action,
    targetType,
    targetId,
    detail,
  });
}

router.get('/stats', auth, adminOnly, async (req, res) => {
  try {
    const cacheKey = 'admin:stats';
    const cached = await redis.getJSON(cacheKey);
    if (cached) return res.json(cached);

    const [userTotal, userWeek, activeToday, subToday, correctToday, tierDist, popularProbs] = await Promise.all([
      queryOne('SELECT COUNT(*) AS cnt FROM users WHERE role != ?', ['admin']),
      queryOne('SELECT COUNT(*) AS cnt FROM users WHERE join_date >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND role != ?', ['admin']),
      queryOne('SELECT COUNT(DISTINCT user_id) AS cnt FROM submissions WHERE submitted_at >= CURDATE()'),
      queryOne('SELECT COUNT(*) AS cnt FROM submissions WHERE submitted_at >= CURDATE()'),
      queryOne('SELECT COUNT(*) AS cnt FROM submissions WHERE submitted_at >= CURDATE() AND result = ?', ['correct']),
      query('SELECT tier, COUNT(*) AS cnt FROM users WHERE role != ? GROUP BY tier', ['admin']),
      query(
        `SELECT p.id, p.title, p.tier, COUNT(s.id) AS solveCount
         FROM problems p
         LEFT JOIN submissions s ON s.problem_id = p.id AND s.result = 'correct'
         GROUP BY p.id
         ORDER BY solveCount DESC, p.id ASC
         LIMIT 5`
      ),
    ]);

    const totalToday = Number(subToday?.cnt || 0);
    const correctCount = Number(correctToday?.cnt || 0);
    const tierDistribution = (tierDist || []).reduce((acc, row) => {
      acc[row.tier || 'unranked'] = Number(row.cnt) || 0;
      return acc;
    }, {});

    const payload = {
      userStats: {
        total: Number(userTotal?.cnt || 0),
        newThisWeek: Number(userWeek?.cnt || 0),
        activeToday: Number(activeToday?.cnt || 0),
      },
      submissionStats: {
        totalToday,
        correctRate: totalToday > 0 ? Number(((correctCount / totalToday) * 100).toFixed(1)) : 0,
      },
      tierDistribution,
      popularProblems: (popularProbs || []).map((row) => ({
        id: row.id,
        title: row.title,
        tier: row.tier,
        solveCount: Number(row.solveCount) || 0,
      })),
    };

    await redis.setJSON(cacheKey, payload, 300);
    return res.json(payload);
  } catch (err) {
    console.error('[admin/stats]', err);
    return res.status(500).json({ message: '통계를 불러오지 못했습니다.' });
  }
});

router.get('/ai-status', auth, adminOnly, async (req, res) => {
  try {
    const status = await getAIServiceStatus();
    return res.json(status);
  } catch (err) {
    console.error('[admin/ai-status]', err);
    return res.status(500).json({ message: 'AI 상태를 불러오지 못했습니다.' });
  }
});

// POST /api/admin/cache/clear
router.post('/cache/clear', auth, adminOnly, async (req, res) => {
  const { target } = req.body;

  try {
    switch (target) {
      case 'leaderboards':
        await redis.clearPrefix('ranking:');
        break;
      case 'heatmaps':
        await redis.clearPrefix('user:');
        break;
      case 'problems':
        await redis.clearPrefix('problems:');
        break;
      case 'all':
        await Promise.all([
          redis.clearPrefix('ranking:'),
          redis.clearPrefix('user:'),
          redis.clearPrefix('problems:'),
          redis.clearPrefix('ai:'), // Also clear AI cache if clearing all
        ]);
        break;
      default:
        return res.status(400).json({ message: 'Invalid target' });
    }

    await logAdminAction(req, 'cache.clear', 'cache', null, { target });
    res.json({ message: `Cache cleared for ${target}` });
  } catch (err) {
    console.error('[Admin Cache Clear]', err);
    res.status(500).json({ message: 'Failed to clear cache' });
  }
});

// GET /api/admin/battle-settings
router.get('/battle-settings', auth, adminOnly, async (req, res) => {
  try {
    const saved = await redis.getJSON(BATTLE_SETTINGS_KEY);
    const settings = normalizeBattleSettings(saved || DEFAULT_BATTLE_SETTINGS);
    res.json(settings);
  } catch (err) {
    console.error('[Admin Battle Settings Get]', err);
    res.status(500).json({ message: '배틀 설정 조회 실패' });
  }
});

// PUT /api/admin/battle-settings
router.put('/battle-settings', auth, adminOnly, async (req, res) => {
  try {
    const settings = normalizeBattleSettings(req.body || {});
    await redis.setJSON(BATTLE_SETTINGS_KEY, settings);
    await logAdminAction(req, 'battle-settings.update', 'battle_settings', null, settings);
    res.json(settings);
  } catch (err) {
    console.error('[Admin Battle Settings Put]', err);
    res.status(500).json({ message: '배틀 설정 저장 실패' });
  }
});

// ── 콘텐츠 일괄 삭제 (기준일 이전) ──────────────────────────────────────
// DELETE /api/admin/content/bulk?days=30&target=dump|community|all
router.delete('/content/bulk', auth, adminOnly, async (req, res) => {
  const days   = Math.max(1, parseInt(req.query.days, 10) || 30);
  const target = req.query.target || 'dump';

  if (!['dump', 'community', 'all'].includes(target)) {
    return res.status(400).json({ message: 'target은 dump | community | all 중 하나여야 합니다.' });
  }

  try {
    const results = {};
    if (target === 'dump' || target === 'all') {
      const r = await run(
        `DELETE FROM dump_posts WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [days]
      );
      results.dump_posts = r?.affectedRows ?? 0;
    }
    if (target === 'community' || target === 'all') {
      const r = await run(
        `DELETE FROM posts WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [days]
      );
      results.posts = r?.affectedRows ?? 0;
    }
    await logAdminAction(req, 'content.bulk-delete', target, null, { days, deleted: results });
    res.json({ message: `${days}일 이전 데이터 삭제 완료`, deleted: results });
  } catch (err) {
    console.error('[admin/content/bulk]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 신고 대기 목록 조회 (report_count >= 5) ───────────────────────────────
// GET /api/admin/reports?type=dump|community
router.get('/reports', auth, adminOnly, async (req, res) => {
  const type = req.query.type || 'dump';
  try {
    let flaggedPosts, flaggedReplies;

    if (type === 'dump') {
      [flaggedPosts, flaggedReplies] = await Promise.all([
        query('SELECT id, anon_name, content, report_count, is_blinded, created_at FROM dump_posts WHERE report_count >= 5 ORDER BY report_count DESC LIMIT 100'),
        query('SELECT id, post_id, anon_name, content, report_count, is_blinded, created_at FROM dump_replies WHERE report_count >= 5 ORDER BY report_count DESC LIMIT 100'),
      ]);
    } else {
      // community: user_id 포함해서 관리자에게만 노출
      [flaggedPosts, flaggedReplies] = await Promise.all([
        query(`SELECT p.id, p.user_id, u.username, p.title, p.content, p.report_count, p.created_at
               FROM posts p JOIN users u ON p.user_id = u.id
               WHERE p.report_count >= 5 ORDER BY p.report_count DESC LIMIT 100`),
        query(`SELECT r.id, r.post_id, r.user_id, u.username, r.content, r.report_count, r.created_at
               FROM post_replies r JOIN users u ON r.user_id = u.id
               WHERE r.report_count >= 5 ORDER BY r.report_count DESC LIMIT 100`),
      ]);
    }

    res.json({ posts: flaggedPosts || [], replies: flaggedReplies || [] });
  } catch (err) {
    console.error('[admin/reports]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

const BLIND_SQL = {
  dump_posts:   'UPDATE dump_posts SET is_blinded = ? WHERE id = ?',
  dump_replies: 'UPDATE dump_replies SET is_blinded = ? WHERE id = ?',
  posts:        'UPDATE posts SET is_blinded = ? WHERE id = ?',
  post_replies: 'UPDATE post_replies SET is_blinded = ? WHERE id = ?',
};

const DELETE_SQL = {
  dump_posts:   'DELETE FROM dump_posts WHERE id = ?',
  dump_replies: 'DELETE FROM dump_replies WHERE id = ?',
  posts:        'DELETE FROM posts WHERE id = ?',
  post_replies: 'DELETE FROM post_replies WHERE id = ?',
};

// ── 수동 심사: 블라인드 처리 ──────────────────────────────────────────────
// PATCH /api/admin/reports/blind  body: { table, id, blind: true|false }
router.patch('/reports/blind', auth, adminOnly, async (req, res) => {
  const { table, id, blind } = req.body;
  if (!BLIND_SQL[table] || !id) {
    return res.status(400).json({ message: '유효하지 않은 요청입니다.' });
  }
  try {
    await run(BLIND_SQL[table], [blind ? 1 : 0, Number(id)]);
    await logAdminAction(req, blind ? 'content.blind' : 'content.unblind', table, Number(id), { blind: !!blind });
    res.json({ message: `${blind ? '블라인드' : '블라인드 해제'} 처리됐습니다.` });
  } catch (err) {
    console.error('[admin/reports/blind]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// ── 수동 심사: 직접 삭제 ──────────────────────────────────────────────────
// DELETE /api/admin/reports/delete  body: { table, id }
router.delete('/reports/delete', auth, adminOnly, async (req, res) => {
  const { table, id } = req.body;
  if (!DELETE_SQL[table] || !id) {
    return res.status(400).json({ message: '유효하지 않은 요청입니다.' });
  }
  try {
    await run(DELETE_SQL[table], [Number(id)]);
    await logAdminAction(req, 'content.delete', table, Number(id), {});
    res.json({ message: '삭제됐습니다.' });
  } catch (err) {
    console.error('[admin/reports/delete]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

router.get('/logs', auth, adminOnly, async (req, res) => {
  try {
    const result = await AdminLog.list({ page: req.query.page, limit: req.query.limit });
    res.json(result);
  } catch (err) {
    console.error('[admin/logs]', err);
    res.status(500).json({ message: '감사 로그를 불러오지 못했습니다.' });
  }
});

export default router;
