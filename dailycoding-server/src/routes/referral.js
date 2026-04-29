import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { queryOne } from '../config/mysql.js';
import { getOrCreateReferralCode } from '../services/referralService.js';
import { internalError } from '../middleware/errorHandler.js';

const router = Router();
router.use(auth);

router.get('/my-code', async (req, res) => {
  try {
    const code = await getOrCreateReferralCode(req.user.id);
    const stats = await queryOne(
      `SELECT
         SUM(CASE WHEN referred_user_id IS NOT NULL THEN 1 ELSE 0 END) AS total_referrals,
         SUM(CASE WHEN status = 'rewarded' THEN 1 ELSE 0 END) AS rewarded_count
       FROM referrals
       WHERE referrer_id = ?`,
      [req.user.id]
    );
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.json({
      code,
      inviteUrl: `${frontendUrl}/login?mode=register&ref=${code}`,
      totalReferrals: Number(stats?.total_referrals || 0),
      rewardedCount: Number(stats?.rewarded_count || 0),
    });
  } catch (err) {
    console.error('[referral/my-code]', err);
    return internalError(res);
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await queryOne(
      `SELECT
         SUM(CASE WHEN referred_user_id IS NOT NULL THEN 1 ELSE 0 END) AS total_referrals,
         SUM(CASE WHEN status = 'rewarded' THEN 1 ELSE 0 END) AS rewarded_count
       FROM referrals
       WHERE referrer_id = ?`,
      [req.user.id]
    );
    res.json({
      totalReferrals: Number(stats?.total_referrals || 0),
      rewardedCount: Number(stats?.rewarded_count || 0),
    });
  } catch (err) {
    console.error('[referral/stats]', err);
    return internalError(res);
  }
});

export default router;
