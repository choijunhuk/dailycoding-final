import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { ensureDailyMissions, serializeMission } from '../services/missionService.js';
import { internalError } from '../middleware/errorHandler.js';

const router = Router();

router.get('/missions/daily', auth, async (req, res) => {
  try {
    const missions = await ensureDailyMissions(req.user.id);
    res.json({
      date: new Date().toISOString().slice(0, 10),
      missions: missions.map(serializeMission),
    });
  } catch (err) {
    console.error('[missions/daily]', err);
    return internalError(res);
  }
});

export default router;
