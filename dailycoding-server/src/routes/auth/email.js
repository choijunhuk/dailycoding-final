import { Router } from 'express';
import crypto from 'crypto';
import { auth } from '../../middleware/auth.js';
import { validateBody, resetPasswordSchema } from '../../middleware/validate.js';
import { forgotPasswordLimiter } from '../../middleware/rateLimit.js';
import { User } from '../../models/User.js';
import { redis } from '../../config/redis.js';
import { insert, queryOne, run } from '../../config/mysql.js';
import { errorResponse, internalError } from '../../middleware/errorHandler.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../../services/email.js';
import { clearAuthStatus } from './helpers.js';

const router = Router();

router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  res.json({ message: '비밀번호 재설정 이메일을 발송했습니다.' });
  try {
    const { email } = req.body;
    if (!email) return;
    const user = await User.findByEmail(email);
    if (!user) return;
    await run('DELETE FROM password_reset_tokens WHERE user_id=?', [user.id]);
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await insert('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?,?,?)', [user.id, token, expiresAt]);
    await sendPasswordResetEmail(user.email, token, user.username);
  } catch (err) {
    console.error('[forgot-password]', err.message);
  }
});

router.post('/reset-password', validateBody(resetPasswordSchema), async (req, res) => {
  try {
    const row = await queryOne('SELECT * FROM password_reset_tokens WHERE token=? AND expires_at > NOW()', [req.body.token]);
    if (!row) return errorResponse(res, 400, 'VALIDATION_ERROR', '유효하지 않거나 만료된 토큰입니다.');
    await User.updatePassword(row.user_id, req.body.newPassword);
    await redis.del(`auth:refresh:${row.user_id}`);
    await clearAuthStatus(row.user_id);
    await run('DELETE FROM password_reset_tokens WHERE id=?', [row.id]);
    res.json({ message: '비밀번호가 성공적으로 변경됐습니다.' });
  } catch (err) {
    console.error('[reset-password]', err.message);
    return internalError(res);
  }
});

router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return errorResponse(res, 400, 'VALIDATION_ERROR', '토큰이 필요합니다.');
    const row = await queryOne('SELECT * FROM email_verification_tokens WHERE token=? AND expires_at > NOW()', [token]);
    if (!row) return errorResponse(res, 400, 'VALIDATION_ERROR', '유효하지 않거나 만료된 인증 토큰입니다.');
    await run('UPDATE users SET email_verified=1 WHERE id=?', [row.user_id]);
    await clearAuthStatus(row.user_id);
    await run('DELETE FROM email_verification_tokens WHERE id=?', [row.id]);
    res.json({ message: '이메일 인증이 완료됐습니다.' });
  } catch (err) {
    console.error('[verify-email]', err.message);
    return internalError(res);
  }
});

router.post('/resend-verification', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return errorResponse(res, 404, 'NOT_FOUND', '유저 없음');
    if (user.email_verified) return errorResponse(res, 400, 'VALIDATION_ERROR', '이미 인증된 이메일입니다.');
    const cooldownKey = `auth:resend-verification:${user.id}`;
    if (await redis.get(cooldownKey)) {
      return errorResponse(res, 429, 'RATE_LIMITED', '인증 이메일은 10분에 한 번만 재전송할 수 있습니다.');
    }
    await run('DELETE FROM email_verification_tokens WHERE user_id=?', [user.id]);
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await insert('INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?,?,?)', [user.id, token, expiresAt]);
    await sendVerificationEmail(user.email, token, user.username);
    await redis.set(cooldownKey, '1', 10 * 60);
    res.json({ message: '인증 이메일을 재발송했습니다.' });
  } catch (err) {
    console.error('[resend-verification]', err.message);
    return internalError(res);
  }
});

export default router;
