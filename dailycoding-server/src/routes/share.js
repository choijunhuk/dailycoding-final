import { Router } from 'express';
import { Submission } from '../models/Submission.js';
import { AlgorithmBattle } from '../models/AlgorithmBattle.js';
import { errorResponse, internalError } from '../middleware/errorHandler.js';
import { generalLimiter } from '../middleware/rateLimit.js';
import logger from '../config/logger.js';

const router = Router();

router.get('/share/:slug', generalLimiter, async (req, res) => {
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
    logger.error('[share/get]', { message: err.message });
    return internalError(res);
  }
});

router.get('/share/battle/:slug', generalLimiter, async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    if (!slug) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'Share slug is required.');
    }
    const replay = await AlgorithmBattle.getReplayBySlug(slug);
    if (!replay) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Battle replay not found.');
    }
    return res.json(replay);
  } catch (err) {
    logger.error('[share/battle]', { message: err.message });
    return internalError(res);
  }
});

export default router;
