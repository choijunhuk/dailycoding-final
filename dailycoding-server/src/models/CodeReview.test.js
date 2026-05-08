import assert from 'node:assert/strict';
import test from 'node:test';
import { insert, queryOne } from '../config/mysql.js';
import { CodeReview } from './CodeReview.js';

async function seedReviewFixture(seed) {
  const authorId = await insert(
    'INSERT INTO users (email, username, role, email_verified, submissions_public) VALUES (?,?,?,?,?)',
    [`review-author-${seed}@test.local`, `ReviewAuthor${seed}`, 'user', 1, 1]
  );
  const reviewerId = await insert(
    'INSERT INTO users (email, username, role, email_verified, submissions_public) VALUES (?,?,?,?,?)',
    [`reviewer-${seed}@test.local`, `Reviewer${seed}`, 'user', 1, 1]
  );
  const problemId = await insert(
    'INSERT INTO problems (title, tier, difficulty, description, author_id) VALUES (?,?,?,?,?)',
    [`협업 테스트 문제 ${seed}`, 'bronze', 3, '정렬 문제', authorId]
  );
  const submissionId = await insert(
    'INSERT INTO submissions (user_id, problem_id, lang, code, result, time_ms, memory_mb, detail, submitted_at) VALUES (?,?,?,?,?,?,?,?,?)',
    [authorId, problemId, 'python', 'print(sorted(map(int, input().split())))', 'correct', 40, 12, 'ok', '2026-05-07 12:00:00']
  );
  return { authorId, reviewerId, problemId, submissionId };
}

test('collaboration review creates comments and suggestions then awards accepted score', async () => {
  const fixture = await seedReviewFixture('accepted');

  const created = await CodeReview.createReview(fixture.submissionId, fixture.reviewerId);
  assert.equal(created.status, 'open');
  assert.equal(created.authorId, fixture.authorId);
  assert.equal(created.reviewerId, fixture.reviewerId);

  let detail = await CodeReview.addComment(created.id, fixture.reviewerId, '입출력 파싱을 함수로 분리하면 좋아요.');
  assert.equal(detail.comments.length, 1);

  detail = await CodeReview.addCodeSuggestion(created.id, fixture.reviewerId, {
    filePath: 'solution.py',
    originalCode: detail.submission.code,
    suggestedCode: 'nums = sorted(map(int, input().split()))\nprint(*nums)',
    reason: '출력 형식과 가독성을 개선합니다.',
  });
  assert.equal(detail.codeSuggestions.length, 1);

  detail = await CodeReview.addTestSuggestion(created.id, fixture.reviewerId, {
    inputData: '3 2 1',
    expectedOutput: '1 2 3',
    reason: '역순 입력을 확인합니다.',
  });
  assert.equal(detail.testSuggestions.length, 1);

  const approved = await CodeReview.approve(created.id, { id: fixture.authorId, role: 'user' });
  assert.equal(approved.status, 'approved');
  assert.equal(approved.codeSuggestions[0].status, 'approved');
  assert.equal(approved.testSuggestions[0].status, 'approved');

  const score = await CodeReview.getScore(fixture.reviewerId);
  assert.equal(score.reviewScore, 5);
  assert.equal(score.suggestionScore, 35);
  assert.equal(score.acceptedCount, 2);
  assert.equal(score.totalCount, 3);
});

test('collaboration review rejects self-review and closed review suggestions', async () => {
  const fixture = await seedReviewFixture('closed');

  await assert.rejects(
    () => CodeReview.createReview(fixture.submissionId, fixture.authorId),
    /자기 자신의 제출/
  );

  const review = await CodeReview.createReview(fixture.submissionId, fixture.reviewerId);
  await CodeReview.reject(review.id, { id: fixture.authorId, role: 'user' });
  await assert.rejects(
    () => CodeReview.addCodeSuggestion(review.id, fixture.reviewerId, { suggestedCode: 'print(1)' }),
    /종료된 리뷰/
  );

  const stored = await queryOne('SELECT * FROM code_reviews WHERE id = ?', [review.id]);
  assert.equal(stored.status, 'rejected');
});
