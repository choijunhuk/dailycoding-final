import { Router } from 'express';
import { auth, adminOnly, requireVerified } from '../middleware/auth.js';
import { Tournament } from '../models/Tournament.js';
import { errorResponse, internalError } from '../middleware/errorHandler.js';

const router = Router();

router.get('/', auth, async (req, res) => {
  try {
    res.json(await Tournament.list());
  } catch (err) {
    console.error('[tournaments/list]', err.message);
    return internalError(res);
  }
});

router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return errorResponse(res, 400, 'VALIDATION_ERROR', '토너먼트 이름이 필요합니다.');
    const tournament = await Tournament.create({
      name,
      size: req.body?.size || 8,
      createdBy: req.user.id,
      startsAt: req.body?.startsAt || null,
    });
    res.status(201).json(tournament);
  } catch (err) {
    console.error('[tournaments/create]', err.message);
    return internalError(res);
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const tournament = await Tournament.getById(Number(req.params.id));
    if (!tournament) return errorResponse(res, 404, 'NOT_FOUND', '토너먼트를 찾을 수 없습니다.');
    res.json(tournament);
  } catch (err) {
    console.error('[tournaments/detail]', err.message);
    return internalError(res);
  }
});

router.post('/:id/join', auth, requireVerified, async (req, res) => {
  try {
    res.json(await Tournament.join(Number(req.params.id), req.user.id));
  } catch (err) {
    const status = err.status || 500;
    if (status < 500) return errorResponse(res, status, 'VALIDATION_ERROR', err.message);
    console.error('[tournaments/join]', err.message);
    return internalError(res);
  }
});

router.post('/:id/start', auth, adminOnly, async (req, res) => {
  try {
    res.json(await Tournament.start(Number(req.params.id)));
  } catch (err) {
    const status = err.status || 500;
    if (status < 500) return errorResponse(res, status, 'VALIDATION_ERROR', err.message);
    console.error('[tournaments/start]', err.message);
    return internalError(res);
  }
});

router.post('/:id/matches/:matchId/winner', auth, adminOnly, async (req, res) => {
  try {
    const winnerId = Number(req.body?.winnerId);
    if (!winnerId) return errorResponse(res, 400, 'VALIDATION_ERROR', 'winnerId가 필요합니다.');
    const tournament = await Tournament.advanceWinner(Number(req.params.id), Number(req.params.matchId), winnerId, {
      battleId: req.body?.battleId || null,
    });
    if (!tournament) return errorResponse(res, 404, 'NOT_FOUND', '매치를 찾을 수 없습니다.');
    res.json(tournament);
  } catch (err) {
    console.error('[tournaments/winner]', err.message);
    return internalError(res);
  }
});

router.post('/:id/matches/:matchId/battle', auth, requireVerified, async (req, res) => {
  try {
    const payload = await Tournament.createMatchBattle(
      Number(req.params.id),
      Number(req.params.matchId),
      req.user.id
    );
    const io = req.app.get('io');
    if (io && payload.invitedId) {
      io.to(`user:${payload.invitedId}`).emit('battle:rematch_request', {
        battleId: payload.roomId,
        from: req.user.id,
        tournamentId: Number(req.params.id),
        matchId: Number(req.params.matchId),
      });
    }
    res.status(201).json(payload);
  } catch (err) {
    const status = err.status || 500;
    if (status < 500) return errorResponse(res, status, 'VALIDATION_ERROR', err.message);
    console.error('[tournaments/match-battle]', err.message);
    return internalError(res);
  }
});

export default router;
