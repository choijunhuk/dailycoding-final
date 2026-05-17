import { Router } from 'express';
import redis from '../config/redis.js';
import { auth, adminOnly } from '../middleware/auth.js';
import { query, queryOne, run } from '../config/mysql.js';
import { AdminLog } from '../models/AdminLog.js';
import { Problem } from '../models/Problem.js';
import { TroubleshootingProblem } from '../models/TroubleshootingProblem.js';
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

async function safeQuery(sql, params = [], fallback = []) {
  try {
    return await query(sql, params);
  } catch {
    return fallback;
  }
}

async function safeQueryOne(sql, params = [], fallback = null) {
  try {
    return await queryOne(sql, params);
  } catch {
    return fallback;
  }
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
    const cacheKey = 'admin:stats:v2';
    const cached = await redis.getJSON(cacheKey);
    if (cached) return res.json(cached);

    const [userTotal, userWeek, activeToday, subToday, correctToday, tierDist, popularProbs, allProblems, recentSubmissionRows, recentReviewRows, battleRooms, troubleshootingRows] = await Promise.all([
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
      safeQuery('SELECT * FROM problems ORDER BY created_at DESC LIMIT 1000'),
      safeQuery('SELECT * FROM submissions ORDER BY submitted_at DESC LIMIT 8'),
      safeQuery('SELECT * FROM code_reviews ORDER BY updated_at DESC LIMIT 8'),
      safeQuery('SELECT * FROM battle_rooms ORDER BY created_at DESC LIMIT 200'),
      safeQuery('SELECT * FROM troubleshooting_submissions WHERE result = ? ORDER BY submitted_at DESC LIMIT 1000', ['correct']),
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

    const problemById = new Map((allProblems || []).map((problem) => [Number(problem.id), problem]));
    payload.problemTypeCounts = (allProblems || []).reduce((acc, problem) => {
      const type = problem.problem_type || problem.problemType || 'coding';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    payload.recentSubmissions = [];
    for (const row of recentSubmissionRows || []) {
      const [user, problem] = await Promise.all([
        safeQueryOne('SELECT id, username FROM users WHERE id = ?', [row.user_id]),
        Promise.resolve(problemById.get(Number(row.problem_id)) || null),
      ]);
      payload.recentSubmissions.push({
        id: row.id,
        userId: row.user_id,
        username: user?.username || `user#${row.user_id}`,
        problemId: row.problem_id,
        problemTitle: problem?.title || `문제 #${row.problem_id}`,
        result: row.result,
        lang: row.lang,
        submittedAt: row.submitted_at,
      });
    }

    payload.recentReviews = [];
    for (const row of recentReviewRows || []) {
      const [author, reviewer, problem] = await Promise.all([
        safeQueryOne('SELECT id, username FROM users WHERE id = ?', [row.author_id]),
        safeQueryOne('SELECT id, username FROM users WHERE id = ?', [row.reviewer_id]),
        Promise.resolve(problemById.get(Number(row.problem_id)) || null),
      ]);
      payload.recentReviews.push({
        id: row.id,
        status: row.status,
        problemId: row.problem_id,
        problemTitle: problem?.title || `문제 #${row.problem_id}`,
        authorUsername: author?.username || `user#${row.author_id}`,
        reviewerUsername: reviewer?.username || `user#${row.reviewer_id}`,
        updatedAt: row.updated_at,
      });
    }

    payload.battleStatus = (battleRooms || []).reduce((acc, room) => {
      const status = room.status || 'waiting';
      acc[status] = (acc[status] || 0) + 1;
      acc.total += 1;
      return acc;
    }, { total: 0, waiting: 0, playing: 0, finished: 0 });

    const performanceProblemIds = new Set((allProblems || [])
      .filter((problem) => (problem.problem_type || problem.problemType) === 'performance-fix')
      .map((problem) => Number(problem.id)));
    const performanceRows = (troubleshootingRows || [])
      .filter((row) => performanceProblemIds.has(Number(row.problem_id)) && Number(row.execution_time_ms) > 0);
    payload.performanceFixAverageSolveTimeMs = performanceRows.length > 0
      ? Math.round(performanceRows.reduce((sum, row) => sum + Number(row.execution_time_ms || 0), 0) / performanceRows.length)
      : 0;

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

router.get('/flagged-submissions', auth, adminOnly, async (req, res) => {
  try {
    const rows = await query(
      `SELECT fs.id, fs.submission_id AS submissionId, fs.reason, fs.similarity, fs.reviewed, fs.created_at AS createdAt,
              s.problem_id AS problemId, s.lang, s.result, s.submitted_at AS submittedAt,
              u.id AS userId, u.username,
              p.title AS problemTitle
       FROM flagged_submissions fs
       JOIN submissions s ON s.id = fs.submission_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN problems p ON p.id = s.problem_id
       ORDER BY fs.reviewed ASC, fs.created_at DESC
       LIMIT 100`
    );
    return res.json({ rows: rows || [] });
  } catch (err) {
    console.error('[admin/flagged-submissions]', err);
    return res.status(500).json({ message: '의심 제출 목록을 불러오지 못했습니다.' });
  }
});

router.patch('/flagged-submissions/:id/review', auth, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: '유효하지 않은 ID입니다.' });
  try {
    await run('UPDATE flagged_submissions SET reviewed = 1 WHERE id = ?', [id]);
    await logAdminAction(req, 'flagged_submission.reviewed', 'flagged_submission', id, {});
    return res.json({ ok: true });
  } catch (err) {
    console.error('[admin/flagged-submissions/review]', err);
    return res.status(500).json({ message: '검토 처리에 실패했습니다.' });
  }
});

// POST /api/admin/problems/:id/troubleshooting
router.post('/problems/:id/troubleshooting', auth, adminOnly, async (req, res) => {
  const problemId = Number(req.params.id);
  if (!Number.isInteger(problemId) || problemId <= 0) {
    return res.status(400).json({ message: '유효하지 않은 문제 ID입니다.' });
  }

  try {
    const problem = await Problem.findById(problemId, req.user.id);
    if (!problem) return res.status(404).json({ message: '문제를 찾을 수 없습니다.' });
    if (!TroubleshootingProblem.isTroubleshootingType(problem.problemType)) {
      return res.status(400).json({ message: '트러블슈팅 문제 유형이 아닙니다.' });
    }

    const config = await TroubleshootingProblem.upsertConfig(problemId, req.body || {});
    await redis.clearPrefix(`problem:detail:v3:`);
    await logAdminAction(req, 'troubleshooting-config.upsert', 'problem', problemId, {
      scenarioTitle: config.scenarioTitle,
      visibleTests: config.visibleTests?.length || 0,
      hiddenTests: config.hiddenTests?.length || 0,
    });
    return res.json(config);
  } catch (err) {
    const status = err.status || 500;
    console.error('[admin/troubleshooting/upsert]', err);
    return res.status(status).json({ message: status < 500 ? err.message : '트러블슈팅 설정 저장 실패' });
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
