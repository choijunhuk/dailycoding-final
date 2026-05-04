import crypto from 'crypto';
import { query, queryOne as qOne, insert } from '../config/mysql.js';
import { nowMySQL } from '../config/dateutil.js';

export const Submission = {
  normalizeSolveTimeSec(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 5 || parsed > 60 * 60 * 24) return null;
    return Math.round(parsed);
  },

  async create({ userId, problemId, lang, code, result, timeMs, memoryMb, detail, solveTimeSec = null }) {
    const submittedAt = nowMySQL();
    const id = await insert(
      'INSERT INTO submissions (user_id,problem_id,lang,code,result,time_ms,memory_mb,solve_time_sec,detail,submitted_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [userId, problemId, lang, code||'', result, timeMs||null, memoryMb||null, this.normalizeSolveTimeSec(solveTimeSec), detail||null, submittedAt]
    );
    return this.findById(id);
  },

  async findById(id) {
    return qOne(`
      SELECT s.*, p.title AS problem_title, u.username
      FROM submissions s
      JOIN problems p ON s.problem_id = p.id
      JOIN users    u ON s.user_id    = u.id
      WHERE s.id = ?
    `, [id]);
  },

  async findByUser(userId, { problemId, limit = 50 } = {}) {
    const cap = Math.min(Math.max(1, Number(limit) || 50), 200);
    let sql = `
      SELECT s.*, p.title AS problem_title
      FROM submissions s
      LEFT JOIN problems p ON s.problem_id = p.id
      WHERE s.user_id = ?`;
    const params = [userId];
    if (problemId) { sql += ' AND s.problem_id = ?'; params.push(Number(problemId)); }
    sql += ` ORDER BY s.submitted_at DESC LIMIT ${cap}`;
    return (await query(sql, params)) || [];
  },

  async getWithCode(id) {
    return qOne(`
      SELECT s.*, p.title AS problem_title
      FROM submissions s
      JOIN problems p ON s.problem_id = p.id
      WHERE s.id = ?
    `, [id]);
  },

  async getStats(userId) {
    const rows = await query('SELECT result, lang FROM submissions WHERE user_id=?', [userId]);
    const list = rows || [];
    return {
      total:       list.length,
      correct:     list.filter(s=>s.result==='correct').length,
      wrong:       list.filter(s=>s.result==='wrong').length,
      timeout:     list.filter(s=>s.result==='timeout').length,
      error_count: list.filter(s=>s.result==='error'||s.result==='compile').length,
      langs_used:  new Set(list.map(s=>s.lang)).size,
    };
  },

  async getSolveTimeStats(userId) {
    const submissionRows = await query('SELECT problem_id, solve_time_sec FROM submissions WHERE user_id=? AND result=?', [userId, 'correct']);
    const validRows = (submissionRows || [])
      .map((row) => ({
        problemId: Number(row.problem_id),
        solveTimeSec: this.normalizeSolveTimeSec(row.solve_time_sec),
      }))
      .filter((row) => row.solveTimeSec !== null);

    if (validRows.length === 0) {
      return {
        avgSolveTime: null,
        fastestSolve: null,
        totalSolveTime: 0,
        solveTimeByTier: {},
      };
    }

    const solvedProblemIds = [...new Set(validRows.map((row) => row.problemId))];
    const placeholders = solvedProblemIds.map(() => '?').join(',');
    const problemRows = await query(
      `SELECT id, title, tier FROM problems WHERE id IN (${placeholders})`,
      solvedProblemIds
    );
    const problemsById = new Map((problemRows || []).map((row) => [Number(row.id), row]));
    const totalSolveTime = validRows.reduce((sum, row) => sum + row.solveTimeSec, 0);
    const fastestRow = validRows.reduce((best, row) => (best == null || row.solveTimeSec < best.solveTimeSec ? row : best), null);
    const solveTimeByTier = {};

    for (const row of validRows) {
      const problem = problemsById.get(row.problemId);
      const tier = problem?.tier || 'unranked';
      const entry = solveTimeByTier[tier] || { totalSec: 0, count: 0, avgSec: 0 };
      entry.totalSec += row.solveTimeSec;
      entry.count += 1;
      solveTimeByTier[tier] = entry;
    }

    for (const entry of Object.values(solveTimeByTier)) {
      entry.avgSec = Math.round(entry.totalSec / Math.max(1, entry.count));
    }

    const fastestProblem = fastestRow ? problemsById.get(fastestRow.problemId) : null;
    return {
      avgSolveTime: Math.round(totalSolveTime / validRows.length),
      fastestSolve: fastestRow ? {
        problemId: fastestRow.problemId,
        problemTitle: fastestProblem?.title || `문제 #${fastestRow.problemId}`,
        timeSec: fastestRow.solveTimeSec,
      } : null,
      totalSolveTime,
      solveTimeByTier,
    };
  },

  async createShare(submissionId) {
    const existing = await qOne('SELECT slug, created_at FROM shared_submissions WHERE submission_id = ?', [submissionId]);
    if (existing?.slug) {
      return {
        slug: existing.slug,
        createdAt: existing.created_at || null,
      };
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const slug = crypto.randomBytes(9).toString('base64url').slice(0, 12);
      try {
        await insert('INSERT INTO shared_submissions (submission_id, slug) VALUES (?, ?)', [submissionId, slug]);
        return {
          slug,
          createdAt: nowMySQL(),
        };
      } catch (err) {
        if (err?.code !== 'ER_DUP_ENTRY') throw err;
      }
    }

    throw new Error('공유 링크 생성에 실패했습니다.');
  },

  async getSharedSubmissionBySlug(slug) {
    const shared = await qOne('SELECT submission_id, slug, created_at FROM shared_submissions WHERE slug = ?', [slug]);
    if (!shared) return null;

    const submission = await qOne(
      'SELECT id, user_id, problem_id, lang, code, result, time_ms, memory_mb, solve_time_sec, detail, submitted_at FROM submissions WHERE id = ?',
      [shared.submission_id]
    );
    if (!submission) return null;

    const [problem, user] = await Promise.all([
      qOne('SELECT id, title, tier FROM problems WHERE id = ?', [submission.problem_id]),
      qOne('SELECT id, username FROM users WHERE id = ?', [submission.user_id]),
    ]);

    return {
      slug: shared.slug,
      createdAt: shared.created_at || null,
      submissionId: submission.id,
      problemId: submission.problem_id,
      problemTitle: problem?.title || `문제 #${submission.problem_id}`,
      problemTier: problem?.tier || null,
      username: user?.username || 'anonymous',
      lang: submission.lang,
      code: submission.code,
      result: submission.result,
      timeMs: submission.time_ms ?? null,
      memoryMb: submission.memory_mb ?? null,
      solveTimeSec: submission.solve_time_sec ?? null,
      detail: submission.detail || '',
      submittedAt: submission.submitted_at,
    };
  },

  async getLangStats(userId) {
    const rows = await query('SELECT lang, COUNT(*) AS cnt FROM submissions WHERE user_id=? GROUP BY lang ORDER BY cnt DESC', [userId]);
    return (rows||[]).map(r => ({ lang: r.lang, cnt: Number(r.cnt) }));
  },

  async findFeed(viewerId, { scope = 'me', q = '', result = 'all', lang = 'all', limit = 100, userId } = {}) {
    const cap = Math.min(Math.max(1, Number(limit) || 100), 200);
    const targetUserId = userId ? Number(userId) : null;
    const buildQuery = ({ includeVisibilityColumn }) => {
      const params = [];
      let sql = `
      SELECT s.id, s.user_id, s.problem_id, s.lang, s.result, s.time_ms, s.memory_mb, s.detail, s.submitted_at,
             p.title AS problem_title,
             u.username
             ${includeVisibilityColumn ? ', COALESCE(u.submissions_public, 1) AS submissions_public' : ', 1 AS submissions_public'}
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN problems p ON s.problem_id = p.id
      WHERE 1=1
    `;

      if (scope === 'me') {
        sql += ' AND s.user_id = ?';
        params.push(viewerId);
      } else if (targetUserId) {
        if (includeVisibilityColumn && targetUserId !== viewerId) {
          sql += ' AND s.user_id = ? AND COALESCE(u.submissions_public, 1) = 1';
        } else {
          sql += ' AND s.user_id = ?';
        }
        params.push(targetUserId);
      } else if (includeVisibilityColumn) {
        sql += ' AND (s.user_id = ? OR COALESCE(u.submissions_public, 1) = 1)';
        params.push(viewerId);
      } else {
        sql += ' AND s.user_id = ?';
        params.push(viewerId);
      }

      if (result && result !== 'all') {
        sql += ' AND s.result = ?';
        params.push(result);
      }

      if (lang && lang !== 'all') {
        sql += ' AND s.lang = ?';
        params.push(lang);
      }

      if (q && q.trim()) {
        const raw = q.trim();
        const like = `%${raw}%`;
        sql += ' AND (CAST(s.problem_id AS CHAR) = ? OR CAST(s.user_id AS CHAR) = ? OR p.title LIKE ? OR u.username LIKE ?)';
        params.push(raw, raw, like, like);
      }

      sql += ` ORDER BY s.submitted_at DESC LIMIT ${cap}`;
      return { sql, params };
    };

    let rows;
    try {
      const { sql, params } = buildQuery({ includeVisibilityColumn: true });
      rows = await query(sql, params);
    } catch (err) {
      const message = String(err?.message || '');
      const missingVisibilityColumn = err?.code === 'ER_BAD_FIELD_ERROR' || message.includes('submissions_public');
      if (!missingVisibilityColumn) throw err;
      const fallback = buildQuery({ includeVisibilityColumn: false });
      rows = await query(fallback.sql, fallback.params);
    }

    return (rows || []).map((row) => ({
      id: row.id,
      problemId: row.problem_id,
      problemTitle: row.problem_title,
      userId: row.user_id,
      username: row.username,
      lang: row.lang,
      result: row.result,
      time: row.time_ms ? `${row.time_ms}ms` : '-',
      mem: row.memory_mb ? `${row.memory_mb}MB` : '-',
      detail: row.detail,
      date: new Date(row.submitted_at).toLocaleString('ko-KR'),
      isMine: row.user_id === viewerId,
      submissionsPublic: Boolean(row.submissions_public),
    }));
  },
};
