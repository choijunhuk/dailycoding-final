import { Router } from 'express';
import { auth, requireVerified } from '../middleware/auth.js';
import { UserProblemSet } from '../models/UserProblemSet.js';
import { errorResponse, internalError } from '../middleware/errorHandler.js';

const router = Router();
const MAX_SETS_PER_USER = 50;
const MAX_PROBLEMS_PER_SET = 200;

// GET /api/problem-sets/shared/:token — public, no auth
router.get('/shared/:token', async (req, res) => {
  try {
    const set = await UserProblemSet.findByShareToken(req.params.token);
    if (!set) return errorResponse(res, 404, 'NOT_FOUND', '문제 세트를 찾을 수 없습니다.');
    res.json(set);
  } catch (err) {
    console.error('[problem-sets/shared]', err);
    return internalError(res);
  }
});

router.use(auth, requireVerified);

// GET /api/problem-sets — list my sets
router.get('/', async (req, res) => {
  try {
    const sets = await UserProblemSet.findByUser(req.user.id);
    res.json({ sets });
  } catch (err) {
    console.error('[problem-sets/list]', err);
    return internalError(res);
  }
});

// POST /api/problem-sets — create
router.post('/', async (req, res) => {
  try {
    const { name, description, problemIds } = req.body || {};
    if (!name?.trim()) return errorResponse(res, 400, 'VALIDATION_ERROR', '이름을 입력해주세요.');

    const existing = await UserProblemSet.findByUser(req.user.id);
    if (existing.length >= MAX_SETS_PER_USER) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', `문제 세트는 최대 ${MAX_SETS_PER_USER}개까지 만들 수 있습니다.`);
    }

    const safeIds = (Array.isArray(problemIds) ? problemIds : [])
      .map(Number)
      .filter(Number.isFinite)
      .slice(0, MAX_PROBLEMS_PER_SET);

    const set = await UserProblemSet.create(req.user.id, {
      name: name.trim(),
      description: (description || '').trim(),
      problemIds: safeIds,
    });
    res.status(201).json(set);
  } catch (err) {
    console.error('[problem-sets/create]', err);
    return internalError(res);
  }
});

// GET /api/problem-sets/:id — get one (owner only)
router.get('/:id', async (req, res) => {
  try {
    const set = await UserProblemSet.findById(Number(req.params.id), req.user.id);
    if (!set) return errorResponse(res, 404, 'NOT_FOUND', '문제 세트를 찾을 수 없습니다.');
    res.json(set);
  } catch (err) {
    console.error('[problem-sets/get]', err);
    return internalError(res);
  }
});

// PUT /api/problem-sets/:id — update
router.put('/:id', async (req, res) => {
  try {
    const { name, description, problemIds } = req.body || {};
    const updates = {};
    if (name !== undefined) updates.name = String(name ?? '').trim();
    if (description !== undefined) updates.description = String(description ?? '').trim();
    if (problemIds !== undefined) {
      updates.problemIds = (Array.isArray(problemIds) ? problemIds : [])
        .map(Number)
        .filter(Number.isFinite)
        .slice(0, MAX_PROBLEMS_PER_SET);
    }
    const set = await UserProblemSet.update(Number(req.params.id), req.user.id, updates);
    if (!set) return errorResponse(res, 404, 'NOT_FOUND', '문제 세트를 찾을 수 없습니다.');
    res.json(set);
  } catch (err) {
    console.error('[problem-sets/update]', err);
    return internalError(res);
  }
});

// DELETE /api/problem-sets/:id — delete
router.delete('/:id', async (req, res) => {
  try {
    const set = await UserProblemSet.findById(Number(req.params.id), req.user.id);
    if (!set) return errorResponse(res, 404, 'NOT_FOUND', '문제 세트를 찾을 수 없습니다.');
    await UserProblemSet.delete(Number(req.params.id), req.user.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[problem-sets/delete]', err);
    return internalError(res);
  }
});

// POST /api/problem-sets/:id/share — generate or return share token
router.post('/:id/share', async (req, res) => {
  try {
    const set = await UserProblemSet.findById(Number(req.params.id), req.user.id);
    if (!set) return errorResponse(res, 404, 'NOT_FOUND', '문제 세트를 찾을 수 없습니다.');
    const token = set.shareToken || await UserProblemSet.generateShareToken(Number(req.params.id), req.user.id);
    res.json({ token, shareUrl: `/problem-sets/shared/${token}` });
  } catch (err) {
    console.error('[problem-sets/share]', err);
    return internalError(res);
  }
});

// DELETE /api/problem-sets/:id/share — revoke share token
router.delete('/:id/share', async (req, res) => {
  try {
    const set = await UserProblemSet.findById(Number(req.params.id), req.user.id);
    if (!set) return errorResponse(res, 404, 'NOT_FOUND', '문제 세트를 찾을 수 없습니다.');
    await UserProblemSet.revokeShareToken(Number(req.params.id), req.user.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[problem-sets/share/revoke]', err);
    return internalError(res);
  }
});

export default router;
