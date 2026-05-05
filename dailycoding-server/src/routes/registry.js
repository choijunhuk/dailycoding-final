import logger from '../config/logger.js';
import { query as dbQuery, isConnected as mysqlConnected, getPool } from '../config/mysql.js';
import { redis } from '../config/redis.js';
import { authLimiter, aiLimiter, submitLimiter, generalLimiter } from '../middleware/rateLimit.js';
import authRouter from './auth.js';
import problemsRouter from './problems.js';
import submissionsRouter from './submissions.js';
import contestsRouter from './contests.js';
import notificationsRouter from './notifications.js';
import rankingRouter from './ranking.js';
import aiRouter from './ai.js';
import rewardsRouter from './rewards.js';
import battlesRouter from './battles.js';
import followsRouter from './follows.js';
import subscriptionRouter from './subscription.js';
import teamsRouter from './teams.js';
import adminRouter from './admin.js';
import notesRouter from './notes.js';
import communityRouter from './community.js';
import dumpRouter from './dump.js';
import searchRouter from './search.js';
import activityRouter from './activity.js';
import shareRouter from './share.js';
import weeklyRouter from './weekly.js';
import missionsRouter from './missions.js';
import onboardingRouter from './onboarding.js';
import promotionRouter from './promotion.js';
import referralRouter from './referral.js';
import examsRouter from './exams.js';
import sheetsRouter from './sheets.js';
import growthRouter from './growth.js';
import { getJudgeRuntime } from '../services/judge.js';
import { getStripeOpsStatus } from './subscription.js';

export function registerRoutes(app) {
  app.use('/api/auth', authLimiter, authRouter);
  app.use('/api/problems', generalLimiter, problemsRouter);
  app.use('/api/submissions', submitLimiter, submissionsRouter);
  app.use('/api/contests', generalLimiter, contestsRouter);
  app.use('/api/notifications', generalLimiter, notificationsRouter);
  app.use('/api/ranking', generalLimiter, rankingRouter);
  app.use('/api/ai', aiLimiter, aiRouter);
  app.use('/api/rewards', generalLimiter, rewardsRouter);
  app.use('/api/battles', submitLimiter, battlesRouter);
  app.use('/api/follows', generalLimiter, followsRouter);
  app.use('/api/subscription', generalLimiter, subscriptionRouter);
  app.use('/api/teams', generalLimiter, teamsRouter);
  app.use('/api/admin', generalLimiter, adminRouter);
  app.use('/api/notes', generalLimiter, notesRouter);
  app.use('/api/community', generalLimiter, communityRouter);
  app.use('/api/dump', generalLimiter, dumpRouter);
  app.use('/api', generalLimiter, searchRouter);
  app.use('/api', generalLimiter, activityRouter);
  app.use('/api', generalLimiter, shareRouter);
  app.use('/api', generalLimiter, weeklyRouter);
  app.use('/api', generalLimiter, missionsRouter);
  app.use('/api', generalLimiter, onboardingRouter);
  app.use('/api', generalLimiter, promotionRouter);
  app.use('/api/referral', generalLimiter, referralRouter);
  app.use('/api/exams', generalLimiter, examsRouter);
  app.use('/api', generalLimiter, sheetsRouter);
  app.use('/api/growth-hub', generalLimiter, growthRouter);

  app.get('/api/stats', async (req, res) => {
    try {
      const [u] = await dbQuery("SELECT COUNT(*) AS cnt FROM users WHERE role != ? AND email_verified = 1", ['admin']);
      const [prob] = await dbQuery("SELECT COUNT(*) AS cnt FROM problems WHERE COALESCE(visibility, 'global') = 'global'");
      const [s] = await dbQuery('SELECT COUNT(*) AS cnt FROM submissions');
      const [co] = await dbQuery('SELECT COUNT(*) AS cnt FROM submissions WHERE result = ?', ['correct']);
      res.json({
        users: u?.cnt || 0,
        problems: prob?.cnt || 0,
        submissions: s?.cnt || 0,
        correct: co?.cnt || 0,
      });
    } catch {
      res.json({ users: 0, problems: 0, submissions: 0, correct: 0 });
    }
  });

  app.get('/api/health', async (req, res) => {
    let database = 'error';
    let redisStatus = 'error';
    let judge = 'unavailable';
    let billing = 'unavailable';

    try {
      const dbPool = getPool();
      if (dbPool) {
        await dbPool.execute('SELECT 1');
        database = 'connected';
      } else {
        database = mysqlConnected() ? 'connected' : 'fallback';
      }
    } catch {
      database = mysqlConnected() ? 'fallback' : 'error';
    }

    try {
      redisStatus = await redis.ping() ? 'connected' : (redis.isConnected() ? 'connected' : 'fallback');
    } catch {
      redisStatus = redis.isConnected() ? 'connected' : 'fallback';
    }

    try {
      const runtime = await getJudgeRuntime();
      judge = runtime.mode === 'docker-sandbox'
        ? 'docker'
        : runtime.mode === 'native-subprocess'
          ? 'native'
          : 'unavailable';
    } catch {
      // Keep health endpoint available even when judge runtime probing fails.
    }

    try {
      const stripeOps = await getStripeOpsStatus();
      billing = stripeOps.mode;
    } catch {
      // Billing status is diagnostic only; health should still return core services.
    }

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database,
        redis: redisStatus,
        judge,
        billing,
      },
      version: process.env.APP_VERSION || '1.0.0',
    });
  });

  app.use((req, res) => {
    res.status(404).json({ message: `엔드포인트를 찾을 수 없습니다: ${req.method} ${req.path}` });
  });

  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || '서버 내부 오류';
    logger.error(`[${req.method}] ${req.path} → ${status}: ${message}`, {
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
      userId: req.user?.id,
    });
    if (res.headersSent) return next(err);
    res.status(status).json({ message: status < 500 ? message : '서버 내부 오류가 발생했습니다.' });
  });
}
