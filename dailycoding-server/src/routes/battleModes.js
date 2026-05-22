import { Router } from 'express';
import { auth, requireVerified } from '../middleware/auth.js';
import { BattleMode } from '../models/BattleMode.js';
import { errorResponse, internalError } from '../middleware/errorHandler.js';

const router = Router();

function handleBattleModeError(res, err, fallback = '워크샵 모드를 처리하지 못했습니다.') {
  if (err?.status && err.status < 500) {
    return errorResponse(res, err.status, 'VALIDATION_ERROR', err.message || fallback);
  }
  console.error('[battle-modes]', err);
  return internalError(res, fallback);
}

router.get('/', async (req, res) => {
  try {
    const modes = await BattleMode.findAll({
      limit: req.query.limit,
      offset: req.query.offset,
      sort: req.query.sort,
      search: req.query.q,
      isPublic: true,
      viewerId: req.user?.id || null,
    });
    res.json({ modes });
  } catch (err) {
    return handleBattleModeError(res, err, '워크샵 모드 목록을 불러오지 못했습니다.');
  }
});

router.get('/mine', auth, requireVerified, async (req, res) => {
  try {
    const modes = await BattleMode.findAll({
      limit: req.query.limit || 50,
      offset: req.query.offset,
      sort: req.query.sort || 'created_at',
      search: req.query.q,
      authorId: req.user.id,
      isPublic: null,
      viewerId: req.user.id,
    });
    res.json({ modes });
  } catch (err) {
    return handleBattleModeError(res, err, '내 워크샵 모드를 불러오지 못했습니다.');
  }
});

router.get('/:id', auth, requireVerified, async (req, res) => {
  try {
    const mode = await BattleMode.findById(req.params.id, { viewerId: req.user?.id || null });
    if (!mode) return errorResponse(res, 404, 'NOT_FOUND', '워크샵 모드를 찾을 수 없습니다.');
    if (!mode.isPublic && Number(mode.authorId) !== Number(req.user?.id)) {
      return errorResponse(res, 403, 'FORBIDDEN', '비공개 워크샵 모드입니다.');
    }
    res.json({ mode });
  } catch (err) {
    return handleBattleModeError(res, err, '워크샵 모드를 불러오지 못했습니다.');
  }
});

router.post('/', auth, requireVerified, async (req, res) => {
  try {
    const mode = await BattleMode.create({
      name: req.body?.name,
      description: req.body?.description,
      authorId: req.user.id,
      config: req.body?.config,
      isPublic: req.body?.isPublic !== false,
    });
    res.status(201).json({ mode });
  } catch (err) {
    return handleBattleModeError(res, err, '워크샵 모드를 만들지 못했습니다.');
  }
});

router.put('/:id', auth, requireVerified, async (req, res) => {
  try {
    const current = await BattleMode.findById(req.params.id, { viewerId: req.user.id });
    if (!current) return errorResponse(res, 404, 'NOT_FOUND', '워크샵 모드를 찾을 수 없습니다.');
    if (Number(current.authorId) !== Number(req.user.id)) {
      return errorResponse(res, 403, 'FORBIDDEN', '내가 만든 워크샵 모드만 수정할 수 있습니다.');
    }
    const mode = await BattleMode.update(req.params.id, {
      name: req.body?.name,
      description: req.body?.description,
      config: req.body?.config,
      isPublic: req.body?.isPublic,
    }, req.user.id);
    res.json({ mode });
  } catch (err) {
    return handleBattleModeError(res, err, '워크샵 모드를 수정하지 못했습니다.');
  }
});

router.delete('/:id', auth, requireVerified, async (req, res) => {
  try {
    const current = await BattleMode.findById(req.params.id, { viewerId: req.user.id });
    if (!current) return errorResponse(res, 404, 'NOT_FOUND', '워크샵 모드를 찾을 수 없습니다.');
    if (Number(current.authorId) !== Number(req.user.id)) {
      return errorResponse(res, 403, 'FORBIDDEN', '내가 만든 워크샵 모드만 삭제할 수 있습니다.');
    }
    await BattleMode.delete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    return handleBattleModeError(res, err, '워크샵 모드를 삭제하지 못했습니다.');
  }
});

router.post('/:id/like', auth, requireVerified, async (req, res) => {
  try {
    const mode = await BattleMode.findById(req.params.id, { viewerId: req.user.id });
    if (!mode) return errorResponse(res, 404, 'NOT_FOUND', '워크샵 모드를 찾을 수 없습니다.');
    if (!mode.isPublic) return errorResponse(res, 403, 'FORBIDDEN', '공개 모드만 좋아요를 누를 수 있습니다.');
    const result = await BattleMode.toggleLike(req.user.id, req.params.id);
    res.json(result);
  } catch (err) {
    return handleBattleModeError(res, err, '좋아요를 반영하지 못했습니다.');
  }
});

export default router;
