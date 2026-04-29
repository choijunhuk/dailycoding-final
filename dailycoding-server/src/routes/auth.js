import { Router } from 'express';
import localRouter from './auth/local.js';
import adminUsersRouter from './auth/admin-users.js';
import profileRouter from './auth/profile.js';
import oauthRouter from './auth/oauth.js';
import emailRouter from './auth/email.js';

const router = Router();

router.use('/', localRouter);
router.use('/', adminUsersRouter);
router.use('/', profileRouter);
router.use('/', oauthRouter);
router.use('/', emailRouter);

export default router;
