import { insert, queryOne, run } from '../config/mysql.js';

function parseHintPayload(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export const AiHintCache = {
  async findByProblemId(problemId, contentHash = null) {
    const params = [Number(problemId)];
    let where = 'problem_id = ?';
    if (contentHash) {
      where += ' AND content_hash = ?';
      params.push(contentHash);
    }
    const row = await queryOne(
      `SELECT problem_id, content_hash, hint_json, model, created_by, created_at, updated_at
       FROM ai_hint_cache
       WHERE ${where}`,
      params
    );
    if (!row) return null;
    const hint = parseHintPayload(row.hint_json);
    if (!hint) return null;
    return {
      problemId: Number(row.problem_id),
      contentHash: row.content_hash || null,
      hint,
      model: row.model || null,
      createdBy: row.created_by || null,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
    };
  },

  async save({ problemId, contentHash, hint, userId = null, model = null }) {
    const hintJson = JSON.stringify(hint);
    await insert(
      `INSERT INTO ai_hint_cache (problem_id, content_hash, hint_json, model, created_by)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         content_hash = VALUES(content_hash),
         hint_json = VALUES(hint_json),
         model = VALUES(model),
         updated_at = CURRENT_TIMESTAMP`,
      [Number(problemId), contentHash, hintJson, model, userId ? Number(userId) : null]
    );
    return hint;
  },

  async incrementServed(problemId) {
    await run(
      `UPDATE ai_hint_cache
       SET served_count = served_count + 1
       WHERE problem_id = ?`,
      [Number(problemId)]
    );
  },
};
