import { query } from '../config/mysql.js';

function tokenize(code = '') {
  const tokens = String(code).toLowerCase().replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (tokens.length < 5) return new Set(tokens);
  const ngrams = new Set();
  for (let i = 0; i <= tokens.length - 5; i += 1) {
    ngrams.add(tokens.slice(i, i + 5).join(' '));
  }
  return ngrams;
}

function jaccardSimilarity(a, b) {
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection += 1;
  }
  return intersection / union.size;
}

export async function checkSimilarity(newCode, problemId, excludeUserId) {
  const sharedSubs = await query(
    `SELECT ss.slug, s.code, s.user_id
     FROM shared_submissions ss
     JOIN submissions s ON ss.submission_id = s.id
     WHERE s.problem_id = ?
     ORDER BY ss.created_at DESC
     LIMIT 100`,
    [problemId]
  );
  const newTokens = tokenize(newCode);
  for (const sub of sharedSubs || []) {
    if (Number(sub.user_id) === Number(excludeUserId)) continue;
    const similarity = jaccardSimilarity(newTokens, tokenize(sub.code));
    if (similarity > 0.85) {
      return { flagged: true, similarity, matchedSlug: sub.slug };
    }
  }
  return { flagged: false };
}

export default { checkSimilarity };
