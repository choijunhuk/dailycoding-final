import { Router } from 'express';
import { CodeReview } from '../models/CodeReview.js';
import { Notification } from '../models/Notification.js';
import { auth, requireVerified } from '../middleware/auth.js';
import { errorResponse, internalError } from '../middleware/errorHandler.js';

const router = Router();
router.use(auth);
router.use(requireVerified);

function handleReviewError(res, err, fallback = '리뷰 처리 중 오류가 발생했습니다.') {
  const status = err?.status || 500;
  if (status < 500) {
    return errorResponse(res, status, status === 403 ? 'FORBIDDEN' : 'VALIDATION_ERROR', err.message || fallback);
  }
  console.error('[reviews]', err);
  return internalError(res, err?.message || fallback);
}

function canViewDetail(review, user) {
  return user.role === 'admin' || review.authorId === user.id || review.reviewerId === user.id;
}

async function notifyBestEffort(userId, message, link) {
  try {
    await Notification.create(userId, message, link);
  } catch (err) {
    console.warn('[reviews:notification]', err.message);
  }
}

router.get('/', async (req, res) => {
  try {
    const filters = {
      status: req.query.status || 'all',
      lang: req.query.lang || 'all',
      problemId: req.query.problemId || null,
      difficulty: req.query.difficulty || null,
    };
    const [reviews, reviewableSubmissions, collaborationScore] = await Promise.all([
      CodeReview.listReviews(req.user.id, filters),
      CodeReview.listReviewableSubmissions(req.user.id, filters),
      CodeReview.getScore(req.user.id),
    ]);
    res.json({ reviews, reviewableSubmissions, collaborationScore });
  } catch (err) {
    return handleReviewError(res, err, '리뷰 목록을 불러오지 못했습니다.');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const review = await CodeReview.getReview(Number(req.params.id));
    if (!review) return errorResponse(res, 404, 'NOT_FOUND', '리뷰를 찾을 수 없습니다.');
    if (!canViewDetail(review, req.user)) return errorResponse(res, 403, 'FORBIDDEN', '리뷰 참여자만 상세 내용을 볼 수 있습니다.');
    res.json(review);
  } catch (err) {
    return handleReviewError(res, err, '리뷰 상세를 불러오지 못했습니다.');
  }
});

router.post('/:id/comments', async (req, res) => {
  try {
    const review = await CodeReview.addComment(Number(req.params.id), req.user.id, req.body?.content);
    if (!review) return errorResponse(res, 404, 'NOT_FOUND', '리뷰를 찾을 수 없습니다.');
    const receiverId = review.authorId === req.user.id ? review.reviewerId : review.authorId;
    await notifyBestEffort(receiverId, '내 코드 리뷰에 새 댓글이 달렸습니다.', `/reviews/${review.id}`);
    res.status(201).json(review);
  } catch (err) {
    return handleReviewError(res, err, '댓글을 작성하지 못했습니다.');
  }
});

router.post('/:id/suggestions/code', async (req, res) => {
  try {
    const review = await CodeReview.addCodeSuggestion(Number(req.params.id), req.user.id, req.body || {});
    if (!review) return errorResponse(res, 404, 'NOT_FOUND', '리뷰를 찾을 수 없습니다.');
    await notifyBestEffort(review.authorId, '내 코드에 개선 제안이 도착했습니다.', `/reviews/${review.id}`);
    res.status(201).json(review);
  } catch (err) {
    return handleReviewError(res, err, '코드 제안을 저장하지 못했습니다.');
  }
});

router.post('/:id/suggestions/test', async (req, res) => {
  try {
    const review = await CodeReview.addTestSuggestion(Number(req.params.id), req.user.id, req.body || {});
    if (!review) return errorResponse(res, 404, 'NOT_FOUND', '리뷰를 찾을 수 없습니다.');
    await notifyBestEffort(review.authorId, '내 코드에 테스트 케이스 제안이 도착했습니다.', `/reviews/${review.id}`);
    res.status(201).json(review);
  } catch (err) {
    return handleReviewError(res, err, '테스트 제안을 저장하지 못했습니다.');
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const review = await CodeReview.approve(Number(req.params.id), req.user);
    if (!review) return errorResponse(res, 404, 'NOT_FOUND', '리뷰를 찾을 수 없습니다.');
    await notifyBestEffort(review.reviewerId, '내 협업 제안이 승인되었습니다.', `/reviews/${review.id}`);
    res.json(review);
  } catch (err) {
    return handleReviewError(res, err, '리뷰를 승인하지 못했습니다.');
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const review = await CodeReview.reject(Number(req.params.id), req.user);
    if (!review) return errorResponse(res, 404, 'NOT_FOUND', '리뷰를 찾을 수 없습니다.');
    await notifyBestEffort(review.reviewerId, '내 협업 제안이 반려되었습니다.', `/reviews/${review.id}`);
    res.json(review);
  } catch (err) {
    return handleReviewError(res, err, '리뷰를 반려하지 못했습니다.');
  }
});

router.post('/:id/merge', async (req, res) => {
  try {
    const review = await CodeReview.merge(Number(req.params.id), req.user);
    if (!review) return errorResponse(res, 404, 'NOT_FOUND', '리뷰를 찾을 수 없습니다.');
    await notifyBestEffort(review.reviewerId, '내 협업 제안이 병합되었습니다.', `/reviews/${review.id}`);
    res.json(review);
  } catch (err) {
    return handleReviewError(res, err, '리뷰를 병합하지 못했습니다.');
  }
});

export default router;
