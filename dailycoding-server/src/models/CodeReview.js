import { insert, query, queryOne, run } from '../config/mysql.js';
import { nowMySQL } from '../config/dateutil.js';

const OPEN_STATUS = 'open';
const CLOSED_STATUSES = new Set(['approved', 'rejected', 'merged']);
const REVIEW_SCORE = 5;
const CODE_SUGGESTION_SCORE = 20;
const TEST_SUGGESTION_SCORE = 15;
const REJECT_PENALTY = 2;

function limitText(value, max, field) {
  const text = stripUnsafeControls(value).trim();
  if (!text) {
    const err = new Error(`${field}이(가) 필요합니다.`);
    err.status = 400;
    throw err;
  }
  if (text.length > max) {
    const err = new Error(`${field}은(는) ${max}자 이하여야 합니다.`);
    err.status = 400;
    throw err;
  }
  return text;
}

function optionalText(value, max) {
  const text = stripUnsafeControls(value).trim();
  return text.slice(0, max);
}

function stripUnsafeControls(value) {
  return Array.from(String(value ?? ''))
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || code >= 32;
    })
    .join('');
}

function normalizeReview(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    problemId: Number(row.problem_id),
    submissionId: Number(row.submission_id),
    authorId: Number(row.author_id),
    reviewerId: Number(row.reviewer_id),
    status: row.status || OPEN_STATUS,
    scoreAwarded: Boolean(row.score_awarded),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function normalizeScore(row) {
  return {
    userId: Number(row?.user_id || 0),
    reviewScore: Number(row?.review_score || 0),
    suggestionScore: Number(row?.suggestion_score || 0),
    acceptedCount: Number(row?.accepted_count || 0),
    totalCount: Number(row?.total_count || 0),
    rejectedCount: Number(row?.rejected_count || 0),
    totalScore: Number(row?.review_score || 0) + Number(row?.suggestion_score || 0),
    updatedAt: row?.updated_at || null,
  };
}

async function getUser(id) {
  return queryOne('SELECT * FROM users WHERE id = ?', [Number(id)]);
}

async function getProblem(id) {
  return queryOne('SELECT * FROM problems WHERE id = ?', [Number(id)]);
}

async function getSubmission(id) {
  return queryOne('SELECT * FROM submissions WHERE id = ?', [Number(id)]);
}

async function hydrateSubmission(row, { includeCode = false, viewerId = null } = {}) {
  if (!row) return null;
  const [problem, author] = await Promise.all([
    getProblem(row.problem_id),
    getUser(row.user_id),
  ]);
  if (!author) return null;
  if (viewerId && Number(row.user_id) !== Number(viewerId) && author.submissions_public === 0) return null;
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    username: author.username || `user#${row.user_id}`,
    problemId: Number(row.problem_id),
    problemTitle: problem?.title || `문제 #${row.problem_id}`,
    tier: problem?.tier || 'unranked',
    difficulty: Number(problem?.difficulty || 0),
    lang: row.lang || '',
    result: row.result || '',
    timeMs: row.time_ms ?? null,
    memoryMb: row.memory_mb ?? null,
    codeLength: Buffer.byteLength(row.code || '', 'utf8'),
    code: includeCode ? (row.code || '') : undefined,
    detail: row.detail || '',
    submittedAt: row.submitted_at || null,
  };
}

async function hydrateReview(row, { includeDetail = false } = {}) {
  const review = normalizeReview(row);
  if (!review) return null;
  const [submission, author, reviewer, problem] = await Promise.all([
    hydrateSubmission(await getSubmission(review.submissionId), { includeCode: includeDetail }),
    getUser(review.authorId),
    getUser(review.reviewerId),
    getProblem(review.problemId),
  ]);
  return {
    ...review,
    problemTitle: problem?.title || submission?.problemTitle || `문제 #${review.problemId}`,
    authorUsername: author?.username || `user#${review.authorId}`,
    reviewerUsername: reviewer?.username || `user#${review.reviewerId}`,
    submission,
  };
}

async function hydrateUserItems(rows) {
  const items = [];
  for (const row of rows || []) {
    const user = await getUser(row.user_id);
    items.push({
      id: Number(row.id),
      reviewId: Number(row.review_id),
      userId: Number(row.user_id),
      username: user?.username || `user#${row.user_id}`,
      content: row.content,
      filePath: row.file_path,
      originalCode: row.original_code,
      suggestedCode: row.suggested_code,
      inputData: row.input_data,
      expectedOutput: row.expected_output,
      reason: row.reason || '',
      status: row.status || 'pending',
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
    });
  }
  return items;
}

async function ensureScoreRow(userId) {
  const existing = await queryOne('SELECT * FROM collaboration_scores WHERE user_id = ?', [Number(userId)]);
  if (existing) return existing;
  const id = await insert(
    'INSERT INTO collaboration_scores (user_id, review_score, suggestion_score, accepted_count, total_count, rejected_count, updated_at) VALUES (?,?,?,?,?,?,?)',
    [Number(userId), 0, 0, 0, 0, 0, nowMySQL()]
  );
  return { id, user_id: Number(userId), review_score: 0, suggestion_score: 0, accepted_count: 0, total_count: 0, rejected_count: 0 };
}

async function adjustScore(userId, patch = {}) {
  const row = await ensureScoreRow(userId);
  const next = {
    review_score: Number(row.review_score || 0) + Number(patch.reviewScore || 0),
    suggestion_score: Number(row.suggestion_score || 0) + Number(patch.suggestionScore || 0),
    accepted_count: Number(row.accepted_count || 0) + Number(patch.acceptedCount || 0),
    total_count: Number(row.total_count || 0) + Number(patch.totalCount || 0),
    rejected_count: Number(row.rejected_count || 0) + Number(patch.rejectedCount || 0),
  };
  await run(
    `UPDATE collaboration_scores
     SET review_score = ?, suggestion_score = ?, accepted_count = ?, total_count = ?, rejected_count = ?, updated_at = ?
     WHERE user_id = ?`,
    [next.review_score, next.suggestion_score, next.accepted_count, next.total_count, next.rejected_count, nowMySQL(), Number(userId)]
  );
  return normalizeScore({ user_id: userId, ...next, updated_at: nowMySQL() });
}

function assertOpen(review) {
  if (!review || CLOSED_STATUSES.has(review.status)) {
    const err = new Error('종료된 리뷰에는 추가 작업을 할 수 없습니다.');
    err.status = 400;
    throw err;
  }
}

function assertAuthorOrAdmin(review, actor) {
  if (Number(review.authorId) !== Number(actor.id) && actor.role !== 'admin') {
    const err = new Error('작성자 또는 관리자만 처리할 수 있습니다.');
    err.status = 403;
    throw err;
  }
}

async function awardAcceptedSuggestions(review) {
  if (review.scoreAwarded || Number(review.reviewerId) === Number(review.authorId)) return;
  const [codeRows, testRows] = await Promise.all([
    query('SELECT * FROM code_suggestions WHERE review_id = ?', [review.id]),
    query('SELECT * FROM test_suggestions WHERE review_id = ?', [review.id]),
  ]);
  const codeCount = (codeRows || []).filter((row) => ['approved', 'merged'].includes(row.status)).length;
  const testCount = (testRows || []).filter((row) => ['approved', 'merged'].includes(row.status)).length;
  const acceptedCount = codeCount + testCount;
  if (acceptedCount > 0) {
    await adjustScore(review.reviewerId, {
      suggestionScore: codeCount * CODE_SUGGESTION_SCORE + testCount * TEST_SUGGESTION_SCORE,
      acceptedCount,
    });
  }
  await run('UPDATE code_reviews SET score_awarded = ?, updated_at = ? WHERE id = ?', [1, nowMySQL(), review.id]);
}

export const CodeReview = {
  async getScore(userId) {
    return normalizeScore(await ensureScoreRow(userId));
  },

  async listReviewableSubmissions(viewerId, filters = {}) {
    // Only show problems the viewer has already solved
    const solvedRows = await query(
      'SELECT DISTINCT problem_id FROM submissions WHERE user_id = ? AND result = ?',
      [Number(viewerId), 'correct']
    );
    const solvedProblemIds = new Set((solvedRows || []).map((r) => Number(r.problem_id)));
    if (solvedProblemIds.size === 0) return [];

    const rows = await query('SELECT * FROM submissions WHERE result = ? ORDER BY submitted_at DESC LIMIT 300', ['correct']);
    const items = [];
    for (const row of rows || []) {
      if (Number(row.user_id) === Number(viewerId)) continue;
      if (!solvedProblemIds.has(Number(row.problem_id))) continue;
      if (filters.lang && filters.lang !== 'all' && row.lang !== filters.lang) continue;
      if (filters.problemId && Number(row.problem_id) !== Number(filters.problemId)) continue;
      const item = await hydrateSubmission(row, { includeCode: false, viewerId });
      if (!item) continue;
      if (filters.difficulty && Number(item.difficulty) !== Number(filters.difficulty)) continue;
      const existing = await queryOne(
        'SELECT * FROM code_reviews WHERE submission_id = ? AND reviewer_id = ? AND status = ? LIMIT 1',
        [item.id, Number(viewerId), OPEN_STATUS]
      );
      items.push({ ...item, existingReviewId: existing?.id || null });
    }
    return items.slice(0, 50);
  },

  async listReviews(viewerId, filters = {}) {
    // Reviews where this user is the reviewer
    const rows = await query(
      'SELECT * FROM code_reviews WHERE reviewer_id = ? ORDER BY updated_at DESC LIMIT 100',
      [Number(viewerId)]
    );
    const reviews = [];
    for (const row of rows || []) {
      const review = normalizeReview(row);
      if (!review) continue;
      if (filters.status && filters.status !== 'all' && review.status !== filters.status) continue;
      if (filters.problemId && review.problemId !== Number(filters.problemId)) continue;
      const hydrated = await hydrateReview(row);
      if (filters.lang && filters.lang !== 'all' && hydrated?.submission?.lang !== filters.lang) continue;
      if (filters.difficulty && Number(hydrated?.submission?.difficulty || 0) !== Number(filters.difficulty)) continue;
      reviews.push(hydrated);
    }
    return reviews;
  },

  async listMyCodeReviews(viewerId, filters = {}) {
    // Reviews where others are reviewing my code
    const rows = await query(
      'SELECT * FROM code_reviews WHERE author_id = ? ORDER BY updated_at DESC LIMIT 100',
      [Number(viewerId)]
    );
    const reviews = [];
    for (const row of rows || []) {
      const review = normalizeReview(row);
      if (!review) continue;
      if (filters.status && filters.status !== 'all' && review.status !== filters.status) continue;
      if (filters.problemId && review.problemId !== Number(filters.problemId)) continue;
      const hydrated = await hydrateReview(row);
      if (filters.lang && filters.lang !== 'all' && hydrated?.submission?.lang !== filters.lang) continue;
      reviews.push(hydrated);
    }
    return reviews;
  },

  async createReview(submissionId, reviewerId) {
    const submission = await getSubmission(submissionId);
    if (!submission) {
      const err = new Error('제출을 찾을 수 없습니다.');
      err.status = 404;
      throw err;
    }
    if (Number(submission.user_id) === Number(reviewerId)) {
      const err = new Error('자기 자신의 제출은 리뷰 점수를 받을 수 없습니다.');
      err.status = 400;
      throw err;
    }
    const author = await getUser(submission.user_id);
    if (!author || author.submissions_public === 0) {
      const err = new Error('비공개 제출은 리뷰할 수 없습니다.');
      err.status = 403;
      throw err;
    }
    const existing = await queryOne(
      'SELECT * FROM code_reviews WHERE submission_id = ? AND reviewer_id = ? AND status = ? LIMIT 1',
      [Number(submissionId), Number(reviewerId), OPEN_STATUS]
    );
    if (existing) return this.getReview(existing.id);

    const now = nowMySQL();
    const id = await insert(
      `INSERT INTO code_reviews
       (problem_id, submission_id, author_id, reviewer_id, status, score_awarded, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [Number(submission.problem_id), Number(submissionId), Number(submission.user_id), Number(reviewerId), OPEN_STATUS, 0, now, now]
    );
    await adjustScore(reviewerId, { reviewScore: REVIEW_SCORE, totalCount: 1 });
    return this.getReview(id);
  },

  async getReview(id) {
    const row = await queryOne('SELECT * FROM code_reviews WHERE id = ?', [Number(id)]);
    if (!row) return null;
    const review = await hydrateReview(row, { includeDetail: true });
    const [comments, codeSuggestions, testSuggestions, reviewerScore] = await Promise.all([
      hydrateUserItems(await query('SELECT * FROM code_review_comments WHERE review_id = ? ORDER BY created_at ASC', [Number(id)])),
      hydrateUserItems(await query('SELECT * FROM code_suggestions WHERE review_id = ? ORDER BY created_at ASC', [Number(id)])),
      hydrateUserItems(await query('SELECT * FROM test_suggestions WHERE review_id = ? ORDER BY created_at ASC', [Number(id)])),
      this.getScore(row.reviewer_id),
    ]);
    return { ...review, comments, codeSuggestions, testSuggestions, reviewerScore };
  },

  async addComment(reviewId, userId, content) {
    const review = await this.getReview(reviewId);
    if (!review) return null;
    assertOpen(review);
    const allowed = review.authorId === Number(userId) || review.reviewerId === Number(userId);
    if (!allowed) {
      const err = new Error('리뷰 참여자만 댓글을 작성할 수 있습니다.');
      err.status = 403;
      throw err;
    }
    await insert(
      'INSERT INTO code_review_comments (review_id, user_id, content, created_at) VALUES (?,?,?,?)',
      [Number(reviewId), Number(userId), limitText(content, 5000, '댓글'), nowMySQL()]
    );
    await run('UPDATE code_reviews SET updated_at = ? WHERE id = ?', [nowMySQL(), Number(reviewId)]);
    return this.getReview(reviewId);
  },

  async addCodeSuggestion(reviewId, userId, payload = {}) {
    const review = await this.getReview(reviewId);
    if (!review) return null;
    assertOpen(review);
    if (review.authorId === Number(userId)) {
      const err = new Error('자기 제출에는 개선 제안 점수를 받을 수 없습니다.');
      err.status = 400;
      throw err;
    }
    await insert(
      `INSERT INTO code_suggestions
       (review_id, user_id, file_path, original_code, suggested_code, reason, status, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        Number(reviewId),
        Number(userId),
        optionalText(payload.filePath || payload.file_path || 'solution', 255) || 'solution',
        optionalText(payload.originalCode || payload.original_code || review.submission?.code || '', 100000),
        limitText(payload.suggestedCode || payload.suggested_code, 100000, '제안 코드'),
        optionalText(payload.reason, 2000),
        'pending',
        nowMySQL(),
        nowMySQL(),
      ]
    );
    await adjustScore(userId, { totalCount: 1 });
    await run('UPDATE code_reviews SET updated_at = ? WHERE id = ?', [nowMySQL(), Number(reviewId)]);
    return this.getReview(reviewId);
  },

  async addTestSuggestion(reviewId, userId, payload = {}) {
    const review = await this.getReview(reviewId);
    if (!review) return null;
    assertOpen(review);
    if (review.authorId === Number(userId)) {
      const err = new Error('자기 제출에는 테스트 제안 점수를 받을 수 없습니다.');
      err.status = 400;
      throw err;
    }
    await insert(
      `INSERT INTO test_suggestions
       (review_id, user_id, input_data, expected_output, reason, status, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        Number(reviewId),
        Number(userId),
        limitText(payload.inputData || payload.input_data, 20000, '입력 데이터'),
        limitText(payload.expectedOutput || payload.expected_output, 20000, '예상 출력'),
        optionalText(payload.reason, 2000),
        'pending',
        nowMySQL(),
        nowMySQL(),
      ]
    );
    await adjustScore(userId, { totalCount: 1 });
    await run('UPDATE code_reviews SET updated_at = ? WHERE id = ?', [nowMySQL(), Number(reviewId)]);
    return this.getReview(reviewId);
  },

  async approve(reviewId, actor) {
    const review = await this.getReview(reviewId);
    if (!review) return null;
    assertAuthorOrAdmin(review, actor);
    assertOpen(review);
    await Promise.all([
      run('UPDATE code_suggestions SET status = ?, updated_at = ? WHERE review_id = ?', ['approved', nowMySQL(), Number(reviewId)]),
      run('UPDATE test_suggestions SET status = ?, updated_at = ? WHERE review_id = ?', ['approved', nowMySQL(), Number(reviewId)]),
      run('UPDATE code_reviews SET status = ?, updated_at = ? WHERE id = ?', ['approved', nowMySQL(), Number(reviewId)]),
    ]);
    await awardAcceptedSuggestions({ ...review, status: 'approved' });
    return this.getReview(reviewId);
  },

  async reject(reviewId, actor) {
    const review = await this.getReview(reviewId);
    if (!review) return null;
    assertAuthorOrAdmin(review, actor);
    assertOpen(review);
    await Promise.all([
      run('UPDATE code_suggestions SET status = ?, updated_at = ? WHERE review_id = ?', ['rejected', nowMySQL(), Number(reviewId)]),
      run('UPDATE test_suggestions SET status = ?, updated_at = ? WHERE review_id = ?', ['rejected', nowMySQL(), Number(reviewId)]),
      run('UPDATE code_reviews SET status = ?, score_awarded = ?, updated_at = ? WHERE id = ?', ['rejected', 1, nowMySQL(), Number(reviewId)]),
    ]);
    if (review.reviewerId !== review.authorId && !review.scoreAwarded) {
      const rejectedCount = Math.max(1, review.codeSuggestions.length + review.testSuggestions.length);
      await adjustScore(review.reviewerId, { suggestionScore: -REJECT_PENALTY, rejectedCount });
    }
    return this.getReview(reviewId);
  },

  async merge(reviewId, actor) {
    const review = await this.getReview(reviewId);
    if (!review) return null;
    assertAuthorOrAdmin(review, actor);
    if (review.status === 'rejected') {
      const err = new Error('반려된 리뷰는 병합할 수 없습니다.');
      err.status = 400;
      throw err;
    }
    await Promise.all([
      run('UPDATE code_suggestions SET status = ? WHERE review_id = ? AND status != ?', ['merged', Number(reviewId), 'rejected']),
      run('UPDATE test_suggestions SET status = ? WHERE review_id = ? AND status != ?', ['merged', Number(reviewId), 'rejected']),
      run('UPDATE code_reviews SET status = ?, updated_at = ? WHERE id = ?', ['merged', nowMySQL(), Number(reviewId)]),
    ]);
    await awardAcceptedSuggestions({ ...review, status: 'merged' });
    return this.getReview(reviewId);
  },
};
