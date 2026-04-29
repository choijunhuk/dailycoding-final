import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { getPromotionSnapshot } from '../services/promotionService.js';
import { internalError } from '../middleware/errorHandler.js';

const router = Router();

router.get('/promotion', auth, async (req, res) => {
  try {
    const snapshot = await getPromotionSnapshot(req.user.id);
    res.json(snapshot);
  } catch (err) {
    console.error('[promotion/get]', err);
    return internalError(res);
  }
});

export default router;
