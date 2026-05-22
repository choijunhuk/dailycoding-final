import { Router } from 'express';
import { Submission } from '../models/Submission.js';
import { errorResponse, internalError } from '../middleware/errorHandler.js';

const router = Router();

router.get('/share/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    if (!slug) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'Share slug is required.');
    }

    const shared = await Submission.getSharedSubmissionBySlug(slug);
    if (!shared) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Shared submission not found.');
    }

    return res.json(shared);
  } catch (err) {
    console.error('[share/get]', err);
    return internalError(res);
  }
});

export default router;
