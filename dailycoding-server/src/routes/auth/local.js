import { Router } from 'express';
import crypto from 'crypto';
import { validateBody, registerSchema, loginSchema } from '../../middleware/validate.js';
import { auth } from '../../middleware/auth.js';
import { User } from '../../models/User.js';
import { redis } from '../../config/redis.js';
import { Submission } from '../../models/Submission.js';
import { query, insert } from '../../config/mysql.js';
import logger from '../../config/logger.js';
import { errorResponse, internalError } from '../../middleware/errorHandler.js';
import { clearAuthCookies, clearAuthStatus, issueTokens } from './helpers.js';
import { attachReferralCode } from '../../services/referralService.js';

const router = Router();

export function parseRefreshTokenValue(refreshToken) {
  if (typeof refreshToken !== 'string') {
    return { errorCode: 'INVALID_TOKEN', message: '유효하지 않은 리프레시 토큰입니다.' };
  }

  const dotIndex = refreshToken.indexOf('.');
  if (dotIndex === -1) {
    return { errorCode: 'INVALID_TOKEN', message: '유효하지 않은 리프레시 토큰입니다.' };
  }

  const userId = refreshToken.slice(0, dotIndex);
  const token = refreshToken.slice(dotIndex + 1);
  const parsedUserId = Number(userId);

  if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
    return { errorCode: 'INVALID_TOKEN', message: '유효하지 않은 토큰 형식입니다.' };
  }

  if (!token) {
    return { errorCode: 'INVALID_TOKEN', message: '유효하지 않은 리프레시 토큰입니다.' };
  }

  return { userId: parsedUserId, token };
}

router.post('/register', validateBody(registerSchema), async (req, res) => {
  try {
    const { email, password, username, referralCode } = req.body;
    const existing = await User.findByEmail(email);
    if (existing) return errorResponse(res, 409, 'VALIDATION_ERROR', '이미 사용 중인 이메일입니다.');
    const newUser = await User.create({ email, password, username });
    await attachReferralCode(referralCode, newUser.id);
    (async () => {
      try {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const expiresMySQL = expiresAt.toISOString().slice(0, 19).replace('T', ' ');
        await insert(
          'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?,?,?)',
          [newUser.id, token, expiresMySQL]
      );
        const { sendVerificationEmail } = await import('../../services/email.js');
        await sendVerificationEmail(newUser.email, token, newUser.username);
      } catch (emailErr) {
        logger.error('[register] email send failed', {
          userId: newUser?.id,
          error: emailErr.message,
        });
      }
    })();
    const accessToken = await issueTokens(res, newUser);
    res.status(201).json({ token: accessToken, user: { ...User.safe(newUser), email_verified: false } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return errorResponse(res, 409, 'VALIDATION_ERROR', '이미 사용 중인 이메일 또는 닉네임입니다.');
    }
    console.error('[register]', err.message);
    return internalError(res);
  }
});

router.post('/login', validateBody(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findByEmail(email);
    if (!user || !await User.checkPassword(user, password)) {
      return errorResponse(res, 401, 'UNAUTHORIZED', '이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    if (user.banned_at) {
      return errorResponse(res, 403, 'FORBIDDEN', `계정이 정지됐습니다. 사유: ${user.ban_reason || '규정 위반'}`);
    }
    await User.update(user.id, { last_login: new Date().toISOString().slice(0, 19).replace('T', ' ') });
    await clearAuthStatus(user.id);
    const accessToken = await issueTokens(res, user);
    res.json({ token: accessToken, user: User.safe(user) });
  } catch (err) {
    console.error('[login]', err.message);
    return internalError(res);
  }
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) return errorResponse(res, 401, 'UNAUTHORIZED', '로그인이 필요합니다.');

  try {
    const parsedToken = parseRefreshTokenValue(refreshToken);
    if (parsedToken.errorCode) {
      return errorResponse(res, 401, parsedToken.errorCode, parsedToken.message);
    }

    const { userId, token } = parsedToken;

    const storedToken = await redis.get(`auth:refresh:${userId}`);
    if (!storedToken || storedToken !== token) {
      const inGrace = await redis.get(`auth:refresh:grace:${userId}:${token}`);
      if (inGrace) {
        const user = await User.findById(userId);
        if (!user || user.banned_at) return errorResponse(res, 401, 'UNAUTHORIZED', '인증 실패');
        return res.json({ token: (await import('./helpers.js')).makeToken(user) });
      }

      await redis.del(`auth:refresh:${userId}`);
      clearAuthCookies(res);
      return errorResponse(res, 401, 'UNAUTHORIZED', '보안 정책에 의해 로그아웃되었습니다. 다시 로그인해주세요.');
    }

    const user = await User.findById(userId);
    if (!user) return errorResponse(res, 401, 'UNAUTHORIZED', '유저를 찾을 수 없습니다.');
    if (user.banned_at) return errorResponse(res, 403, 'FORBIDDEN', '정지된 계정입니다.');

    const accessToken = await issueTokens(res, user);
    res.json({ token: accessToken });
  } catch (err) {
    console.error('[refresh]', err.message);
    return internalError(res);
  }
});

router.post('/logout', async (req, res) => {
  const parsedToken = parseRefreshTokenValue(req.cookies?.refreshToken);
  if (!parsedToken.errorCode && parsedToken.userId) {
    await redis.del(`auth:refresh:${parsedToken.userId}`);
    await clearAuthStatus(parsedToken.userId);
  }
  clearAuthCookies(res);
  res.status(200).json({ message: '로그아웃됐습니다.' });
});

router.get('/top100', auth, async (req, res) => {
  try {
    const top100 = await User.getTop100Solved(req.user.id);
    res.json(top100);
  } catch (err) {
    console.error('[top100]', err.message);
    return internalError(res);
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return errorResponse(res, 404, 'NOT_FOUND', '유저 없음');
    const [solvedIds, bookmarkRows] = await Promise.all([
      User.getSolvedIds(req.user.id),
      User.getBookmarks(req.user.id),
    ]);
    const practiceTracks = await User.getPracticeTracks(req.user.id);
    res.json({ ...User.safe(user), solvedIds, bookmarkIds: bookmarkRows.map((row) => row.problem_id), practiceTracks });
  } catch (err) {
    console.error('[me]', err.message);
    return internalError(res);
  }
});

router.get('/me/stats', auth, async (req, res) => {
  try {
    const stats = await Submission.getSolveTimeStats(req.user.id);
    return res.json(stats);
  } catch (err) {
    console.error('[me/stats]', err);
    return internalError(res);
  }
});

router.get('/me/activity', auth, async (req, res) => {
  try {
    const cacheKey = `activity:${req.user.id}`;
    const cached = await redis.getJSON(cacheKey);
    if (cached) return res.json(cached);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 364);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const rows = await query(
      'SELECT solve_date, count FROM solve_logs WHERE user_id = ? AND solve_date >= ? ORDER BY solve_date ASC',
      [req.user.id, cutoffStr]
    );

    const payload = {};
    for (const row of rows || []) {
      const date = typeof row.solve_date === 'string'
        ? row.solve_date
        : new Date(row.solve_date).toISOString().slice(0, 10);
      payload[date] = Number(row.count) || 0;
    }

    await redis.setJSON(cacheKey, payload, 3600);
    return res.json(payload);
  } catch (err) {
    console.error('[me/activity]', err);
    return internalError(res);
  }
});

export default router;
