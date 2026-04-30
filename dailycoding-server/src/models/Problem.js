import { nowMySQL, toMySQL } from '../config/dateutil.js';
import { query, queryOne, insert, run } from '../config/mysql.js';
import redis from '../config/redis.js';

const CACHE_TTL = 300; // 5분

function normalizeProblem(p) {
  if (!p) return null;
  const problemType = p.problem_type ?? p.problemType ?? 'coding';
  const specialConfigRaw = p.special_config ?? p.specialConfig ?? null;
  let specialConfig = specialConfigRaw;
  if (typeof specialConfigRaw === 'string' && specialConfigRaw.trim()) {
    try { specialConfig = JSON.parse(specialConfigRaw); } catch { specialConfig = null; }
  }

  return {
    id:          p.id,
    title:       p.title,
    problemType,
    preferredLanguage: p.preferred_language ?? p.preferredLanguage ?? null,
    specialConfig: specialConfig || null,
    buildType: p.build_type ?? p.buildType ?? null,
    starterCode: p.starter_code ?? p.starterCode ?? null,
    testType: p.test_type ?? p.testType ?? null,
    setupCode: p.setup_code ?? p.setupCode ?? null,
    expectedSchema: p.expected_schema ?? p.expectedSchema ?? null,
    tier:        p.tier,
    tags:        p.tags || [],
    difficulty:  p.difficulty,
    timeLimit:   p.time_limit   ?? p.timeLimit   ?? 2,
    memLimit:    p.mem_limit    ?? p.memLimit    ?? 256,
    desc:        p.description  ?? p.desc        ?? '',
    inputDesc:   p.input_desc   ?? p.inputDesc   ?? '',
    outputDesc:  p.output_desc  ?? p.outputDesc  ?? '',
    hint:        p.hint         ?? '',
    solution:    p.solution     ?? '',
    solved:      p.solved_count ?? p.solved      ?? 0,
    submissions: p.submit_count ?? p.submissions ?? 0,
    authorId:    p.author_id    ?? p.authorId,
    visibility:  p.visibility   ?? 'global',
    isPremium:   !!(p.is_premium ?? p.isPremium ?? false),
    contestId:   p.contest_id   ?? p.contestId ?? null,
    hiddenCount: p.hidden_count ?? p.hiddenCount ?? (p.testcases?.length || 0),
    examples:    p.examples     ?? [],
    testcases:   p.testcases    ?? [],   // ★ 히든 테스트케이스
    isSolved:    p.isSolved     ?? false,
    isBookmarked:p.isBookmarked ?? false,
    createdAt:   p.created_at   ?? p.createdAt,
  };
}

function normalizeProblemListRows(rows = []) {
  return (rows || []).map((row) => ({
    ...row,
    tags: row.tags ? String(row.tags).split(',').filter(Boolean) : [],
  })).map(normalizeProblem);
}

export const Problem = {

  async findAll({ tier, tag, search, sort = 'id', userId, isAdmin, problemType, preferredLanguage } = {}) {
    const tierKey = Array.isArray(tier) ? tier.join(',') : (tier || '');
    const tagKey = Array.isArray(tag) ? tag.join(',') : (tag || '');
    const cacheKey = `problems:list:v2:${tierKey}:${tagKey}:${sort}:type:${problemType||''}:lang:${preferredLanguage||''}:admin:${!!isAdmin}`;

    // search가 있으면 캐시를 타지 않고 매번 DB 조회 (Redis OOM 방지)
    const shouldCache = !search;

    let rows;
    if (shouldCache) {
      rows = await redis.getJSON(cacheKey);
    }
    
    if (!rows) {
      // 리스트에서는 무거운 텍스트 필드(description, input_desc, output_desc, hint) 제외
      let sql = `
        SELECT p.id, p.title, p.problem_type, p.preferred_language, p.special_config,
               p.tier, p.difficulty, p.time_limit, p.mem_limit,
               p.visibility, p.is_premium, p.contest_id,
               (SELECT COUNT(*) FROM problem_testcases ptc WHERE ptc.problem_id = p.id) AS hidden_count,
               p.solved_count, p.submit_count, p.author_id, p.created_at,
               GROUP_CONCAT(DISTINCT pt.tag ORDER BY pt.tag) AS tags
        FROM problems p
        LEFT JOIN problem_tags pt ON p.id = pt.problem_id
      `;
      const params = [];
      const wheres = [];

      if (!isAdmin) {
        wheres.push(`COALESCE(p.visibility, 'global') = 'global'`);
      }

      if (tier) {
        const tiers = Array.isArray(tier) ? tier : [tier];
        if (tiers.length > 0) {
          wheres.push(`p.tier IN (${tiers.map(() => '?').join(',')})`);
          params.push(...tiers);
        }
      }
      
      if (problemType) { wheres.push('COALESCE(p.problem_type, "coding") = ?'); params.push(problemType); }
      
      if (preferredLanguage) {
        wheres.push('(p.preferred_language IS NULL OR p.preferred_language = ?)');
        params.push(preferredLanguage);
      }

      if (tag) {
        const tags = Array.isArray(tag) ? tag : [tag];
        // 태그 교집합 (AND): 모든 선택된 태그를 가진 문제만 반환
        tags.forEach(t => {
          wheres.push('EXISTS(SELECT 1 FROM problem_tags pt2 WHERE pt2.problem_id=p.id AND pt2.tag=?)');
          params.push(t);
        });
      }

      if (search) { wheres.push('(p.title LIKE ? OR CAST(p.id AS CHAR) = ?)'); params.push(`%${search}%`, search); }

      if (wheres.length) sql += ' WHERE ' + wheres.join(' AND ');
      sql += ' GROUP BY p.id';

      const orderMap = {
        id: 'p.id ASC',
        newest: 'p.created_at DESC, p.id DESC',
        difficulty: 'p.difficulty ASC',
        '-difficulty': 'p.difficulty DESC',
        solved: 'p.solved_count DESC',
      };
      sql += ` ORDER BY ${orderMap[sort] || 'p.id ASC'}`;

      rows = await query(sql, params);
      rows = rows.map(r => ({ ...r, tags: r.tags ? r.tags.split(',') : [] }));
      rows = rows.map(normalizeProblem);
      if (!isAdmin) {
        rows = rows.filter((row) => (row.visibility || 'global') === 'global');
      }
      if (shouldCache) {
        await redis.setJSON(cacheKey, rows, CACHE_TTL);
      }
    }

    // 유저별 동적 필드 추가
    if (userId) {
      const [solvedRows, bookmarkRows] = await Promise.all([
        query('SELECT DISTINCT problem_id FROM submissions WHERE user_id=? AND result="correct"', [userId]),
        query('SELECT problem_id FROM bookmarks WHERE user_id=?', [userId]),
      ]);
      const solved    = new Set(solvedRows.map(r => r.problem_id));
      const bookmarked = new Set(bookmarkRows.map(r => r.problem_id));
      rows = rows.map(r => ({ ...r, isSolved: solved.has(r.id), isBookmarked: bookmarked.has(r.id) }));
    }

    return rows;
  },

  async findById(id, userId) {
    let row = await queryOne('SELECT * FROM problems WHERE id=?', [id]);
    if (!row) return null;
    const buildRow = await queryOne('SELECT * FROM build_problems WHERE problem_id = ?', [id]);
    if (buildRow) {
      row.build_type = buildRow.build_type;
      row.starter_code = buildRow.starter_code;
      row.test_type = buildRow.test_type;
      row.setup_code = buildRow.setup_code;
      row.expected_schema = buildRow.expected_schema;
    }

    // 태그
    const tagRows = await query('SELECT tag FROM problem_tags WHERE problem_id=?', [id]);
    row.tags = (tagRows||[]).map(t => t.tag);

    // 예제
    const exRows = await query(
      'SELECT input_data AS `input`, output_data AS output FROM problem_examples WHERE problem_id=? ORDER BY ord',
      [id]
    );
    row.examples = exRows || [];

    // ★ 히든 테스트케이스
    const tcRows = await query(
      'SELECT input_data AS `input`, output_data AS output FROM problem_testcases WHERE problem_id=? ORDER BY ord',
      [id]
    );
    row.testcases = tcRows || [];

    row = normalizeProblem(row);

    if (userId) {
      const [s, b] = await Promise.all([
        queryOne('SELECT 1 FROM submissions WHERE user_id=? AND problem_id=? AND result=? LIMIT 1', [userId, id, 'correct']),
        queryOne('SELECT 1 FROM bookmarks   WHERE user_id=? AND problem_id=? LIMIT 1', [userId, id]),
      ]);
      row = { ...row, isSolved: !!s, isBookmarked: !!b };
    }

    await redis.setJSON(`problems:${id}`, row, CACHE_TTL);
    return row;
  },

  async findSimilar(problemId, userId, { tier, tags, limit = 8 } = {}) {
    const safeLimit = Math.min(20, Math.max(1, Number(limit) || 8));
    const safeTags = Array.isArray(tags) ? tags.filter(Boolean).slice(0, 10) : [];
    const params = [userId || 0, userId || 0, problemId, tier];
    let similarityClause = 'p.tier = ?';

    if (safeTags.length > 0) {
      similarityClause += ` OR EXISTS (
        SELECT 1
        FROM problem_tags pt2
        WHERE pt2.problem_id = p.id AND pt2.tag IN (${safeTags.map(() => '?').join(',')})
      )`;
      params.push(...safeTags);
    }

    params.push(tier);

    const rows = await query(
      `SELECT p.id, p.title, p.tier, p.difficulty, p.time_limit, p.mem_limit,
              p.description, p.input_desc, p.output_desc, p.hint, p.solution,
              p.solved_count, p.submit_count, p.author_id, p.created_at,
              p.visibility, p.is_premium, p.contest_id, p.problem_type, p.preferred_language, p.special_config,
              GROUP_CONCAT(DISTINCT pt.tag ORDER BY pt.tag) AS tags,
              EXISTS(
                SELECT 1 FROM submissions s
                WHERE s.user_id = ? AND s.problem_id = p.id AND s.result = 'correct'
              ) AS isSolved,
              EXISTS(
                SELECT 1 FROM bookmarks b
                WHERE b.user_id = ? AND b.problem_id = p.id
              ) AS isBookmarked
       FROM problems p
       LEFT JOIN problem_tags pt ON p.id = pt.problem_id
       WHERE p.id != ?
         AND COALESCE(p.visibility, 'global') = 'global'
         AND (${similarityClause})
       GROUP BY p.id
       ORDER BY (p.tier = ?) DESC, p.solved_count DESC, p.id ASC
       LIMIT ${safeLimit}`,
      params
    );

    return normalizeProblemListRows(rows);
  },

  async findRandomUnsolved(userId, { tier, tag, minDiff, maxDiff } = {}) {
    const params = [userId || 0, userId || 0];
    const wheres = [
      `COALESCE(p.visibility, 'global') = 'global'`,
      `COALESCE(p.problem_type, 'coding') = 'coding'`,
      `NOT EXISTS (
        SELECT 1 FROM submissions s
        WHERE s.user_id = ? AND s.problem_id = p.id AND s.result = 'correct'
      )`,
    ];

    if (tier) {
      wheres.push('p.tier = ?');
      params.push(tier);
    }

    if (minDiff !== undefined && minDiff !== null && minDiff !== '') {
      wheres.push('p.difficulty >= ?');
      params.push(Number(minDiff));
    }
    if (maxDiff !== undefined && maxDiff !== null && maxDiff !== '') {
      wheres.push('p.difficulty <= ?');
      params.push(Number(maxDiff));
    }

    if (tag) {
      const tags = Array.isArray(tag) ? tag.filter(Boolean) : [tag];
      for (const item of tags) {
        wheres.push('EXISTS(SELECT 1 FROM problem_tags pt2 WHERE pt2.problem_id = p.id AND pt2.tag = ?)');
        params.push(item);
      }
    }

    const rows = await query(
      `SELECT p.id, p.title, p.tier, p.difficulty, p.time_limit, p.mem_limit,
              p.description, p.input_desc, p.output_desc, p.hint, p.solution,
              p.solved_count, p.submit_count, p.author_id, p.created_at,
              p.visibility, p.is_premium, p.contest_id, p.problem_type, p.preferred_language, p.special_config,
              GROUP_CONCAT(DISTINCT pt.tag ORDER BY pt.tag) AS tags,
              0 AS isSolved,
              EXISTS(
                SELECT 1 FROM bookmarks b
                WHERE b.user_id = ? AND b.problem_id = p.id
              ) AS isBookmarked
       FROM problems p
       LEFT JOIN problem_tags pt ON p.id = pt.problem_id
       WHERE ${wheres.join(' AND ')}
       GROUP BY p.id
       ORDER BY RAND()
       LIMIT 1`,
      params
    );

    return normalizeProblemListRows(rows)[0] || null;
  },

  async findRecommendationCandidates(userId, { tiers = [], limit = 6 } = {}) {
    const safeTiers = [...new Set((tiers || []).filter(Boolean))];
    if (safeTiers.length === 0) return [];

    const safeLimit = Math.min(20, Math.max(1, Number(limit) || 6));
    const rows = await query(
      `SELECT p.id, p.title, p.tier, p.difficulty, p.time_limit, p.mem_limit,
              p.description, p.input_desc, p.output_desc, p.hint, p.solution,
              p.solved_count, p.submit_count, p.author_id, p.created_at,
              p.visibility, p.is_premium, p.contest_id, p.problem_type, p.preferred_language, p.special_config,
              GROUP_CONCAT(DISTINCT pt.tag ORDER BY pt.tag) AS tags,
              0 AS isSolved,
              EXISTS(
                SELECT 1 FROM bookmarks b
                WHERE b.user_id = ? AND b.problem_id = p.id
              ) AS isBookmarked
       FROM problems p
       LEFT JOIN problem_tags pt ON p.id = pt.problem_id
       WHERE COALESCE(p.visibility, 'global') = 'global'
         AND COALESCE(p.problem_type, 'coding') = 'coding'
         AND p.tier IN (${safeTiers.map(() => '?').join(',')})
         AND NOT EXISTS (
           SELECT 1 FROM submissions s
           WHERE s.user_id = ? AND s.problem_id = p.id AND s.result = 'correct'
       )
       GROUP BY p.id
       ORDER BY RAND()
       LIMIT ${safeLimit}`,
      [userId || 0, ...safeTiers, userId || 0]
    );

    return normalizeProblemListRows(rows);
  },

  async create(data, authorId) {
    const {
      title, problemType, preferredLanguage, specialConfig,
      tier, difficulty, timeLimit, memLimit, desc, inputDesc, outputDesc, hint, solution,
      tags, examples, testcases, visibility, isPremium, contestId
    } = data;
    const createdAt = nowMySQL();
    const id = await insert(
      'INSERT INTO problems (title,problem_type,preferred_language,special_config,tier,difficulty,time_limit,mem_limit,description,input_desc,output_desc,hint,solution,author_id,created_at,visibility,is_premium,contest_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [
        title,
        problemType || 'coding',
        preferredLanguage || null,
        specialConfig ? JSON.stringify(specialConfig) : null,
        tier||'bronze', difficulty||3, timeLimit||2, memLimit||256, desc, inputDesc||'', outputDesc||'', hint||'', solution||'', authorId, createdAt, visibility || 'global', isPremium ? 1 : 0, contestId || null
      ]
    );
    if (tags?.length) {
      for (const tag of tags) await run('INSERT IGNORE INTO problem_tags VALUES (?,?)', [id, tag]);
    }
    if (examples?.length) {
      for (let i = 0; i < examples.length; i++) {
        const ex = examples[i];
        await run('INSERT INTO problem_examples (problem_id,input_data,output_data,ord) VALUES (?,?,?,?)', [id, ex.input, ex.output, i]);
      }
    }
    // ★ 히든 테스트케이스 저장
    if (testcases?.length) {
      for (let i = 0; i < testcases.length; i++) {
        const tc = testcases[i];
        await run('INSERT INTO problem_testcases (problem_id,input_data,output_data,ord) VALUES (?,?,?,?)', [id, tc.input, tc.output, i]);
      }
    }
    await redis.clearPrefix('problems:list:');
    return this.findById(id);
  },

  async update(id, data) {
    const {
      title, problemType, preferredLanguage, specialConfig,
      tier, difficulty, timeLimit, memLimit, desc, inputDesc, outputDesc, hint, solution,
      tags, examples, testcases, visibility, isPremium, contestId
    } = data;
    await run(
      'UPDATE problems SET title=?,problem_type=?,preferred_language=?,special_config=?,tier=?,difficulty=?,time_limit=?,mem_limit=?,description=?,input_desc=?,output_desc=?,hint=?,solution=?,visibility=?,is_premium=?,contest_id=? WHERE id=?',
      [
        title, problemType || 'coding', preferredLanguage || null, specialConfig ? JSON.stringify(specialConfig) : null,
        tier, difficulty, timeLimit, memLimit, desc, inputDesc, outputDesc, hint, solution||'', visibility || 'global', isPremium ? 1 : 0, contestId || null, id
      ]
    );
    if (tags) {
      await run('DELETE FROM problem_tags WHERE problem_id=?', [id]);
      for (const tag of tags) await run('INSERT IGNORE INTO problem_tags VALUES (?,?)', [id, tag]);
    }
    if (examples) {
      await run('DELETE FROM problem_examples WHERE problem_id=?', [id]);
      for (let i = 0; i < examples.length; i++) {
        const ex = examples[i];
        await run('INSERT INTO problem_examples (problem_id,input_data,output_data,ord) VALUES (?,?,?,?)', [id, ex.input, ex.output, i]);
      }
    }
    // ★ 히든 테스트케이스 업데이트
    if (testcases) {
      await run('DELETE FROM problem_testcases WHERE problem_id=?', [id]);
      for (let i = 0; i < testcases.length; i++) {
        const tc = testcases[i];
        await run('INSERT INTO problem_testcases (problem_id,input_data,output_data,ord) VALUES (?,?,?,?)', [id, tc.input, tc.output, i]);
      }
    }
    await redis.del(`problems:${id}`);
    return this.findById(id);
  },

  async delete(id) {
    await run('DELETE FROM problem_testcases WHERE problem_id=?', [id]);
    await run('DELETE FROM problem_examples WHERE problem_id=?', [id]);
    await run('DELETE FROM problem_tags WHERE problem_id=?', [id]);
    await run('DELETE FROM problems WHERE id=?', [id]);
    await redis.del(`problems:${id}`);
    await redis.clearPrefix('problems:list:');
  },

  async incrementSolved(id) {
    await run('UPDATE problems SET solved_count=solved_count+1, submit_count=submit_count+1 WHERE id=?', [id]);
    await redis.del(`problems:${id}`);
  },

  async incrementSubmit(id) {
    await run('UPDATE problems SET submit_count=submit_count+1 WHERE id=?', [id]);
    await redis.del(`problems:${id}`);
  },

  async getAllTags() {
    const rows = await query('SELECT DISTINCT tag FROM problem_tags ORDER BY tag');
    return rows.map(r => r.tag);
  },
};
