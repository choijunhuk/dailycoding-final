import { Router } from 'express';
import { CodeReview } from '../models/CodeReview.js';
import { Notification } from '../models/Notification.js';
import { AdminLog } from '../models/AdminLog.js';
import { auth, requireVerified } from '../middleware/auth.js';
import { errorResponse, internalError } from '../middleware/errorHandler.js';

const router = Router();
router.use(auth);
router.use(requireVerified);

async function logReviewSecurityEvent(req, action, reviewId, reason) {
  try {
    await AdminLog.create({
      adminId: req.user.id,
      action,
      targetType: 'code_review',
      targetId: Number.isFinite(Number(reviewId)) ? Number(reviewId) : null,
      detail: {
        reason,
        method: req.method,
        path: req.originalUrl || req.path,
      },
    });
  } catch (logErr) {
    console.warn('[reviews:security-log]', logErr.message);
  }
}

async function handleReviewError(req, res, err, fallback = 'An error occurred while processing the review.') {
  const status = err?.status || 500;
  if (status < 500) {
    if (status === 403) {
      await logReviewSecurityEvent(req, 'review.forbidden_action', req.params?.id, err.message || fallback);
    }
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
    const [reviews, myCodeReviews, reviewableSubmissions, collaborationScore] = await Promise.all([
      CodeReview.listReviews(req.user.id, filters),
      CodeReview.listMyCodeReviews(req.user.id, filters),
      CodeReview.listReviewableSubmissions(req.user.id, filters),
      CodeReview.getScore(req.user.id),
    ]);
    res.json({ reviews, myCodeReviews, reviewableSubmissions, collaborationScore });
  } catch (err) {
    return handleReviewError(req, res, err, 'Failed to load review list.');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const review = await CodeReview.getReview(Number(req.params.id));
    if (!review) return errorResponse(res, 404, 'NOT_FOUND', 'Review not found.');
    if (!canViewDetail(review, req.user)) {
      await logReviewSecurityEvent(req, 'review.forbidden_detail', req.params.id, 'Only review participants can view the details.');
      return errorResponse(res, 403, 'FORBIDDEN', 'Only review participants can view the details.');
    }
    res.json(review);
  } catch (err) {
    return handleReviewError(req, res, err, 'Failed to load review details.');
  }
});

router.post('/:id/comments', async (req, res) => {
  try {
    const review = await CodeReview.addComment(Number(req.params.id), req.user.id, req.body?.content);
    if (!review) return errorResponse(res, 404, 'NOT_FOUND', 'Review not found.');
    const receiverId = review.authorId === req.user.id ? review.reviewerId : review.authorId;
    await notifyBestEffort(receiverId, 'A new comment was posted on your code review.', `/reviews/${review.id}`);
    res.status(201).json(review);
  } catch (err) {
    return handleReviewError(req, res, err, 'Failed to post comment.');
  }
});

router.post('/:id/suggestions/code', async (req, res) => {
  try {
    const review = await CodeReview.addCodeSuggestion(Number(req.params.id), req.user.id, req.body || {});
    if (!review) return errorResponse(res, 404, 'NOT_FOUND', 'Review not found.');
    await notifyBestEffort(review.authorId, 'A code improvement suggestion has arrived for your code.', `/reviews/${review.id}`);
    res.status(201).json(review);
  } catch (err) {
    return handleReviewError(req, res, err, 'Failed to save code suggestion.');
  }
});

router.post('/:id/suggestions/test', async (req, res) => {
  try {
    const review = await CodeReview.addTestSuggestion(Number(req.params.id), req.user.id, req.body || {});
    if (!review) return errorResponse(res, 404, 'NOT_FOUND', 'Review not found.');
    await notifyBestEffort(review.authorId, 'A test case suggestion has arrived for your code.', `/reviews/${review.id}`);
    res.status(201).json(review);
  } catch (err) {
    return handleReviewError(req, res, err, 'Failed to save test suggestion.');
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const review = await CodeReview.approve(Number(req.params.id), req.user);
    if (!review) return errorResponse(res, 404, 'NOT_FOUND', 'Review not found.');
    await notifyBestEffort(review.reviewerId, 'Your collaboration request has been approved.', `/reviews/${review.id}`);
    res.json(review);
  } catch (err) {
    return handleReviewError(req, res, err, 'Failed to approve review.');
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const review = await CodeReview.reject(Number(req.params.id), req.user);
    if (!review) return errorResponse(res, 404, 'NOT_FOUND', 'Review not found.');
    await notifyBestEffort(review.reviewerId, 'Your collaboration request has been rejected.', `/reviews/${review.id}`);
    res.json(review);
  } catch (err) {
    return handleReviewError(req, res, err, 'Failed to reject review.');
  }
});

router.post('/:id/merge', async (req, res) => {
  try {
    const review = await CodeReview.merge(Number(req.params.id), req.user);
    if (!review) return errorResponse(res, 404, 'NOT_FOUND', 'Review not found.');
    await notifyBestEffort(review.reviewerId, 'Your collaboration request has been merged.', `/reviews/${review.id}`);
    res.json(review);
  } catch (err) {
    return handleReviewError(req, res, err, 'Failed to merge review.');
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const review = await CodeReview.cancel(Number(req.params.id), req.user);
    if (!review) return errorResponse(res, 404, 'NOT_FOUND', 'Review not found.');
    await notifyBestEffort(review.authorId, 'The code review request has been cancelled.', `/reviews/${review.id}`);
    res.json(review);
  } catch (err) {
    return handleReviewError(req, res, err, 'Failed to cancel review.');
  }
});

router.post('/:id/reopen', async (req, res) => {
  try {
    const review = await CodeReview.reopen(Number(req.params.id), req.user);
    if (!review) return errorResponse(res, 404, 'NOT_FOUND', 'Review not found.');
    await notifyBestEffort(review.authorId, 'The code review has been reopened.', `/reviews/${review.id}`);
    res.json(review);
  } catch (err) {
    return handleReviewError(req, res, err, 'Failed to reopen review.');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await CodeReview.delete(Number(req.params.id), req.user);
    if (!result) return errorResponse(res, 404, 'NOT_FOUND', 'Review not found.');
    res.json({ message: 'Review deleted successfully.' });
  } catch (err) {
    return handleReviewError(req, res, err, 'Failed to delete review.');
  }
});

export default router;
