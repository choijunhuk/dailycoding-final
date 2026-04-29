import { Router } from 'express';
import { nowMySQL } from '../../config/dateutil.js';
import { queryOne, run } from '../../config/mysql.js';
import { auth, adminOnly } from '../../middleware/auth.js';
import { validateBody, adminResetPasswordSchema } from '../../middleware/validate.js';
import { User } from '../../models/User.js';
import { redis } from '../../config/redis.js';
import { errorResponse, internalError } from '../../middleware/errorHandler.js';
import { clearAuthStatus, logAdminAction } from './helpers.js';

const router = Router();

router.get('/users', auth, adminOnly, async (req, res) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const requestedOffset = Number.parseInt(req.query.offset, 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 50;
    const offset = Number.isFinite(requestedOffset) ? Math.max(0, requestedOffset) : 0;
    const [users, totalRow] = await Promise.all([
      User.findAll({ limit, offset }),
      queryOne('SELECT COUNT(*) AS cnt FROM users'),
    ]);
    res.json({
      users: users.map(User.safe),
      total: totalRow?.cnt || 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error('[users/list]', err);
    return internalError(res);
  }
});

router.patch('/users/:id/role', auth, adminOnly, async (req, res) => {
  try {
    const updated = await User.update(Number(req.params.id), { role: req.body.role === 'admin' ? 'admin' : 'user' });
    await redis.del(`auth:refresh:${req.params.id}`);
    await clearAuthStatus(Number(req.params.id));
    await logAdminAction(req, 'user.role-update', 'user', Number(req.params.id), { role: updated.role });
    res.json(User.safe(updated));
  } catch (err) {
    return internalError(res);
  }
});

router.patch('/users/:id/reset-password', auth, adminOnly, validateBody(adminResetPasswordSchema), async (req, res) => {
  try {
    await User.updatePassword(Number(req.params.id), req.body.newPassword);
    await redis.del(`auth:refresh:${req.params.id}`);
    await clearAuthStatus(Number(req.params.id));
    await logAdminAction(req, 'user.password-reset', 'user', Number(req.params.id), {});
    res.json({ message: '비밀번호가 리셋됐습니다.' });
  } catch (err) {
    return internalError(res);
  }
});

router.patch('/users/:id/ban', auth, adminOnly, async (req, res) => {
  try {
    const reason = req.body.reason || '규정 위반';
    await User.update(Number(req.params.id), { banned_at: nowMySQL(), ban_reason: reason });
    await redis.del(`auth:refresh:${req.params.id}`);
    await clearAuthStatus(Number(req.params.id));
    await logAdminAction(req, 'user.ban', 'user', Number(req.params.id), { reason });
    res.json({ message: '밴 처리됐습니다.' });
  } catch (err) {
    return internalError(res);
  }
});

router.patch('/users/:id/unban', auth, adminOnly, async (req, res) => {
  try {
    await run('UPDATE users SET banned_at=NULL, ban_reason=NULL WHERE id=?', [Number(req.params.id)]);
    await clearAuthStatus(Number(req.params.id));
    await logAdminAction(req, 'user.unban', 'user', Number(req.params.id), {});
    res.json({ message: '밴이 해제됐습니다.' });
  } catch (err) {
    return internalError(res);
  }
});

router.delete('/users/:id', auth, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return errorResponse(res, 400, 'VALIDATION_ERROR', '자신은 삭제할 수 없습니다.');
  try {
    await User.delete(id);
    await clearAuthStatus(id);
    res.json({ message: '삭제됐습니다.' });
  } catch (err) {
    return internalError(res);
  }
});

export default router;
