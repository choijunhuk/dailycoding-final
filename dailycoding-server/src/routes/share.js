import { Router } from 'express';
import { Submission } from '../models/Submission.js';
import { errorResponse, internalError } from '../middleware/errorHandler.js';

const router = Router();

router.get('/share/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    if (!slug) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', '공유 슬러그가 필요합니다.');
    }

    const shared = await Submission.getSharedSubmissionBySlug(slug);
    if (!shared) {
      return errorResponse(res, 404, 'NOT_FOUND', '공유된 제출을 찾을 수 없습니다.');
    }

    return res.json(shared);
  } catch (err) {
    console.error('[share/get]', err);
    return internalError(res);
  }
});

export default router;
