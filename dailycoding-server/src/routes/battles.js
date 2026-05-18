import { Router } from 'express';
import { auth, requireVerified } from '../middleware/auth.js';
import { Battle } from '../models/Battle.js';
import { AlgorithmBattle } from '../models/AlgorithmBattle.js';
import { Tournament } from '../models/Tournament.js';
import { User }   from '../models/User.js';
import { Reward } from '../models/Reward.js';
import { errorResponse, internalError } from '../middleware/errorHandler.js';
import { normalizeJudgeLanguage } from '../services/judge.js';
import { getCachedJudgeRuntime } from '../services/judgeRuntimeCache.js';
import { executeSubmissionFlow } from '../services/submissionExecution.js';
import { completeMission } from '../services/missionService.js';
import { pushToUser } from '../services/pushNotifier.js';
import { recordPromotionLoss } from '../services/promotionService.js';
import { grantBattleWinBadges } from '../services/badgeService.js';
import { evaluateBugFixAnswer, evaluateFillBlankAnswer } from '../services/battleAnswerEvaluation.js';
import redis from '../config/redis.js';
import { query } from '../config/mysql.js';

const router = Router();

// GET /api/battles/public/active-count — landing-page safe realtime signal
router.get('/public/active-count', async (req, res) => {
  try {
    const count = await AlgorithmBattle.countActivePublicRooms();
    res.json({ count });
  } catch {
    res.json({ count: 0 });
  }
});

// GET /api/battles/:id/replay — public replay payload for completed legacy battles
router.get('/:id/replay', async (req, res) => {
  try {
    const replay = await Battle.getReplay(req.params.id);
    if (!replay) return errorResponse(res, 404, 'NOT_FOUND', '리플레이를 찾을 수 없습니다.');
    res.json(replay);
  } catch (err) {
    console.error('[battles/replay]', err.message);
    return internalError(res);
  }
});

router.use(auth);
router.use(requireVerified);

function emitBattleRoomUpdate(io, state) {
  if (!io || !state?.room?.id) return;
  io.to(`battle:${state.room.id}`).emit('battle:room:update', state);
}

function emitBattleFinished(io, state, reason = 'timeout') {
  if (!io || !state?.room?.id) return;
  io.to(`battle:${state.room.id}`).emit('battle:finished', { ...state, reason });
}

function emitBattleEvent(io, state, eventName, event) {
  if (!io || !state?.room?.id) return;
  io.to(`battle:${state.room.id}`).emit(eventName, event);
  io.to(`battle:${state.room.id}`).emit('battle:room:update', state);
}

async function getProblemModel() {
  const { Problem } = await import('../models/Problem.js');
  return Problem;
}

// 배틀 종료 시 승자/패자 결정 헬퍼 (팀 배틀 대응)
function resolveWinner(players) {
  const teamScores = {};
  Object.values(players).forEach(p => {
    teamScores[p.teamId] = (teamScores[p.teamId] || 0) + p.score;
  });

  const sortedTeams = Object.entries(teamScores).sort((a, b) => b[1] - a[1]);
  const winnerTeamId = sortedTeams.length > 1 && sortedTeams[0][1] !== sortedTeams[1][1] ? sortedTeams[0][0] : null;
  const loserTeamId = winnerTeamId !== null ? sortedTeams.find(([tid]) => tid !== winnerTeamId)?.[0] : null;
  
  return { winnerTeamId, loserTeamId, teamScores };
}

async function advanceTournamentIfNeeded(roomId, room) {
  try {
    const { winnerTeamId } = resolveWinner(room.players, room.teams);
    if (!winnerTeamId) return;
    const winner = Object.values(room.players || {}).find((player) => player.teamId === winnerTeamId);
    if (!winner?.id) return;
    await Tournament.advanceWinnerByBattleId(roomId, winner.id);
  } catch {
    // 토너먼트 연결이 없는 일반 배틀 종료 흐름은 방해하지 않는다.
  }
}

async function rewardBattleWinnerMissions(room) {
  const { winnerTeamId } = resolveWinner(room.players, room.teams);
  if (!winnerTeamId) return;
  const winnerIds = Object.values(room.players || {})
    .filter((player) => player.teamId === winnerTeamId)
    .map((player) => player.id);
  await Promise.all(winnerIds.map(async (userId) => {
    try {
      await completeMission(userId, 'battle_win');
      const rows = await query(
        `SELECT COUNT(*) AS cnt FROM battle_results WHERE user_id = ? AND result = 'win'`,
        [userId]
      );
      await grantBattleWinBadges(userId, Number(rows[0]?.cnt || 1));
    } catch (err) {
      console.error('[battle:mission]', err);
    }
  }));
}

async function applyBattlePromotionLosses(room) {
  const { winnerTeamId } = resolveWinner(room.players, room.teams);
  if (!winnerTeamId) return;
  const loserIds = Object.values(room.players || {})
    .filter((player) => player.teamId !== winnerTeamId)
    .map((player) => player.id);
  await Promise.all(loserIds.map(async (userId) => {
    try {
      await recordPromotionLoss(userId);
    } catch (err) {
      console.error('[battle:promotion-loss]', err);
    }
  }));
}

// GET /api/battles/active — 진행 중인 배틀 목록 (관전용)
router.get('/active', async (req, res) => {
  try {
    const battles = await Battle.getActiveRooms();
    res.json({ battles });
  } catch (err) {
    return internalError(res);
  }
});

// GET /api/battles/history — 내 배틀 히스토리
router.get('/history', async (req, res) => {
  try {
    const history = await Battle.getHistory(req.user.id, req.query.limit || 20);
    res.json({ history });
  } catch (err) {
    console.error('[battles/history]', err);
    return internalError(res);
  }
});

// GET /api/battles/summary — dashboard battle card
router.get('/summary', async (req, res) => {
  try {
    const rows = await query(
      `SELECT room_id, result, score, battle_score_delta, created_at
       FROM battle_results
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    const results = rows || [];
    const wins = results.filter((row) => row.result === 'win').length;
    const draws = results.filter((row) => row.result === 'draw').length;
    const losses = results.filter((row) => row.result !== 'win' && row.result !== 'draw').length;
    const total = results.length;
    res.json({
      total,
      wins,
      draws,
      losses,
      winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
      recent: results.slice(0, 5).map((row) => {
        const result = row.result === 'win' || row.result === 'draw'
          ? row.result
          : 'lose';
        return {
          roomId: row.room_id || row.roomId,
          result,
          score: Number(row.battle_score_delta ?? row.score ?? 0),
          createdAt: row.created_at || row.createdAt,
        };
      }),
    });
  } catch (err) {
    console.error('[battles/summary]', err);
    return internalError(res);
  }
});

// GET /api/battles/rooms — DB-backed realtime algorithm battle rooms
router.get('/rooms', async (req, res) => {
  try {
    const rooms = await AlgorithmBattle.listRoomSummaries({
      status: req.query.status || null,
      limit: req.query.limit || 20,
    });
    res.json({ rooms });
  } catch (err) {
    console.error('[algorithm-battles/list]', err);
    return internalError(res);
  }
});

// GET /api/battles/modes — realtime algorithm battle mode metadata
router.get('/modes', async (req, res) => {
  res.json(AlgorithmBattle.getBattleModes());
});

// POST /api/battles/rooms — create realtime algorithm battle room
router.post('/rooms', async (req, res) => {
  try {
    const state = await AlgorithmBattle.createRoom({
      creatorId: req.user.id,
      mode: req.body?.mode || 'sort-speed',
      problemId: req.body?.problemId || null,
      maxPlayers: req.body?.maxPlayers || 2,
      durationSec: req.body?.durationSec || null,
      isPrivate: Boolean(req.body?.isPrivate),
      preferredLanguage: req.body?.preferredLanguage || null,
    });
    emitBattleRoomUpdate(req.app.get('io'), state);
    res.status(201).json(state);
  } catch (err) {
    console.error('[algorithm-battles/create]', err);
    return internalError(res, err?.message || '배틀 방 생성 실패');
  }
});

// GET /api/battles/rooms/join-by-code/:code — join private room by invite code
router.get('/rooms/join-by-code/:code', async (req, res) => {
  try {
    const state = await AlgorithmBattle.joinByCode(req.params.code, req.user.id);
    if (!state) return errorResponse(res, 404, 'NOT_FOUND', '방을 찾을 수 없습니다.');
    emitBattleRoomUpdate(req.app.get('io'), state);
    res.json({ state, roomId: state.room.id });
  } catch (err) {
    const status = err.status || 500;
    if (status < 500) return errorResponse(res, status, 'VALIDATION_ERROR', err.message);
    console.error('[algorithm-battles/join-by-code]', err);
    return internalError(res);
  }
});

router.post('/rooms/:roomId/activity', async (req, res) => {
  try {
    const { event, state } = await AlgorithmBattle.recordActivity(req.params.roomId, req.user.id, {
      activity: req.body?.activity || '집중 중',
      message: req.body?.message || '',
    });
    emitBattleEvent(req.app.get('io'), state, 'battle:activity', event);
    res.json({ event, state });
  } catch (err) {
    const status = err.status || 500;
    if (status < 500) return errorResponse(res, status, 'VALIDATION_ERROR', err.message);
    console.error('[algorithm-battles/activity]', err);
    return internalError(res);
  }
});

router.post('/rooms/:roomId/chat', async (req, res) => {
  try {
    const { event, state } = await AlgorithmBattle.recordChat(req.params.roomId, req.user.id, {
      message: req.body?.message || '',
    });
    emitBattleEvent(req.app.get('io'), state, 'battle:chat', event);
    res.json({ event, state });
  } catch (err) {
    const status = err.status || 500;
    if (status < 500) return errorResponse(res, status, 'VALIDATION_ERROR', err.message);
    console.error('[algorithm-battles/chat]', err);
    return internalError(res);
  }
});

router.post('/rooms/:roomId/emote', async (req, res) => {
  try {
    const { event, state } = await AlgorithmBattle.recordEmote(req.params.roomId, req.user.id, {
      emote: req.body?.emote || '',
    });
    emitBattleEvent(req.app.get('io'), state, 'battle:emote', event);
    res.json({ event, state });
  } catch (err) {
    const status = err.status || 500;
    if (status < 500) return errorResponse(res, status, 'VALIDATION_ERROR', err.message);
    console.error('[algorithm-battles/emote]', err);
    return internalError(res);
  }
});

router.post('/rooms/:roomId/item', async (req, res) => {
  try {
    const { event, state } = await AlgorithmBattle.useItem(req.params.roomId, req.user.id, {
      itemType: req.body?.itemType || '',
    });
    emitBattleEvent(req.app.get('io'), state, 'battle:item:used', event);
    res.json({ event, state });
  } catch (err) {
    const status = err.status || 500;
    if (status < 500) return errorResponse(res, status, 'VALIDATION_ERROR', err.message);
    console.error('[algorithm-battles/item]', err);
    return internalError(res);
  }
});

// GET /api/battles/rooms/:roomId
router.get('/rooms/:roomId', async (req, res) => {
  try {
    const state = await AlgorithmBattle.ensureNotExpired(req.params.roomId);
    if (!state) return errorResponse(res, 404, 'NOT_FOUND', '방을 찾을 수 없습니다.');
    res.json(state);
  } catch (err) {
    console.error('[algorithm-battles/get]', err);
    return internalError(res);
  }
});

router.post('/rooms/:roomId/join', async (req, res) => {
  try {
    const state = await AlgorithmBattle.joinRoom(req.params.roomId, req.user.id);
    if (!state) return errorResponse(res, 404, 'NOT_FOUND', '방을 찾을 수 없습니다.');
    emitBattleRoomUpdate(req.app.get('io'), state);
    res.json(state);
  } catch (err) {
    const status = err.status || 500;
    if (status < 500) return errorResponse(res, status, 'VALIDATION_ERROR', err.message);
    console.error('[algorithm-battles/join]', err);
    return internalError(res);
  }
});

router.post('/rooms/:roomId/ready', async (req, res) => {
  try {
    const before = await AlgorithmBattle.getRoom(req.params.roomId);
    const state = await AlgorithmBattle.markReady(req.params.roomId, req.user.id);
    if (!state) return errorResponse(res, 404, 'NOT_FOUND', '방을 찾을 수 없습니다.');
    const io = req.app.get('io');
    emitBattleRoomUpdate(io, state);
    if (before?.status === 'waiting' && state.room.status === 'playing') {
      io?.to(`battle:${state.room.id}`).emit('battle:countdown', { seconds: 3 });
      io?.to(`battle:${state.room.id}`).emit('battle:started', state);
    }
    res.json(state);
  } catch (err) {
    const status = err.status || 500;
    if (status < 500) return errorResponse(res, status, 'VALIDATION_ERROR', err.message);
    console.error('[algorithm-battles/ready]', err);
    return internalError(res);
  }
});

router.post('/rooms/:roomId/submit', async (req, res) => {
  try {
    const { code, language, problemId } = req.body || {};
    if (!code || !language) return errorResponse(res, 400, 'VALIDATION_ERROR', 'code, language 필요');
    if (String(code).length > 100_000) return errorResponse(res, 400, 'VALIDATION_ERROR', '코드가 너무 큽니다. (최대 100KB)');

    const stateBefore = await AlgorithmBattle.ensureNotExpired(req.params.roomId);
    if (!stateBefore) return errorResponse(res, 404, 'NOT_FOUND', '방을 찾을 수 없습니다.');
    if (stateBefore.room.status !== 'playing') return errorResponse(res, 400, 'VALIDATION_ERROR', '진행 중인 배틀이 아닙니다.');
    if (!stateBefore.participants.some((player) => player.userId === req.user.id)) {
      return errorResponse(res, 403, 'FORBIDDEN', '방 참가자만 제출할 수 있습니다.');
    }
    const effectiveProblemId = (stateBefore.room.mode === 'territory' && problemId)
      ? Number(problemId)
      : stateBefore.room.problemId;
    const prob = await getProblemModel().then((Problem) => Problem.findById(effectiveProblemId));
    if (!prob) return errorResponse(res, 404, 'NOT_FOUND', '배틀 문제를 찾을 수 없습니다.');

    const judgeRuntime = await getCachedJudgeRuntime({ logOnRefresh: true });
    if (judgeRuntime.mode === 'unavailable') {
      return errorResponse(res, 503, 'INTERNAL_ERROR', '현재 서버에서 채점 런타임을 사용할 수 없습니다.', {
        supportedLanguages: judgeRuntime.supportedLanguages || [],
      });
    }
    const requester = await User.findById(req.user.id);
    const { execution, displayLang, normalizedLang } = await executeSubmissionFlow({
      problem: prob,
      problemId: Number(prob.id),
      userId: req.user.id,
      rawLang: language,
      code,
      judgeRuntime,
      persist: false,
      includeHiddenCases: true,
      userTier: requester?.subscription_tier || 'free',
    });
    const timeMs = execution.time ? parseInt(execution.time, 10) : null;
    const memoryMb = execution.mem && /^\d+/.test(execution.mem) ? parseInt(execution.mem, 10) : null;
    const state = await AlgorithmBattle.recordSubmission({
      roomId: req.params.roomId,
      userId: req.user.id,
      code,
      language: displayLang || normalizedLang || language,
      judgeResult: {
        result: execution.result,
        timeMs,
        memoryMb,
        detail: execution.detail,
      },
      problemId: problemId ? Number(problemId) : null,
    });

    const io = req.app.get('io');
    const latest = state.submissions?.[0] || null;
    io?.to(`battle:${state.room.id}`).emit('battle:submission:result', {
      userId: req.user.id,
      result: execution.result,
      timeMs,
      memoryMb,
      detail: execution.detail,
      score: latest?.score || 0,
    });
    const recentEvents = [...(state.events || [])].reverse();
    const attackEvent = recentEvents.find((event) => event.type === 'player.attack' && event.userId === req.user.id);
    const effectEvent = recentEvents.find((event) => event.type === 'problem.effect' && event.userId === req.user.id);
    if (attackEvent) {
      io?.to(`battle:${state.room.id}`).emit('battle:player:attack', attackEvent);
    }
    if (effectEvent) {
      io?.to(`battle:${state.room.id}`).emit('battle:effect', effectEvent);
    }
    emitBattleRoomUpdate(io, state);
    if (state.room.status === 'finished') emitBattleFinished(io, state, 'knockout');
    res.json({ ...state, submissionResult: execution.result, timeMs, memoryMb, detail: execution.detail });
  } catch (err) {
    if (err.status && err.body) return res.status(err.status).json(err.body);
    const status = err.status || 500;
    if (status < 500) return errorResponse(res, status, 'VALIDATION_ERROR', err.message);
    console.error('[algorithm-battles/submit]', err);
    return internalError(res);
  }
});

router.post('/rooms/:roomId/leave', async (req, res) => {
  try {
    const state = await AlgorithmBattle.leaveRoom(req.params.roomId, req.user.id);
    if (!state) return errorResponse(res, 404, 'NOT_FOUND', '방을 찾을 수 없습니다.');
    emitBattleRoomUpdate(req.app.get('io'), state);
    res.json(state);
  } catch (err) {
    console.error('[algorithm-battles/leave]', err);
    return internalError(res);
  }
});

router.post('/rooms/:roomId/finish', async (req, res) => {
  try {
    const current = await AlgorithmBattle.getRoomState(req.params.roomId);
    if (!current) return errorResponse(res, 404, 'NOT_FOUND', '방을 찾을 수 없습니다.');
    if (!current.participants.some((player) => player.userId === req.user.id)) {
      return errorResponse(res, 403, 'FORBIDDEN', '방 참가자만 종료할 수 있습니다.');
    }
    const state = await AlgorithmBattle.finishRoom(req.params.roomId, { reason: req.body?.reason || 'manual' });
    const io = req.app.get('io');
    emitBattleRoomUpdate(io, state);
    emitBattleFinished(io, state, req.body?.reason || 'manual');
    res.json(state);
  } catch (err) {
    console.error('[algorithm-battles/finish]', err);
    return internalError(res);
  }
});

router.delete('/rooms/:roomId', async (req, res) => {
  try {
    const state = await AlgorithmBattle.getRoomState(req.params.roomId);
    if (!state) return errorResponse(res, 404, 'NOT_FOUND', '방을 찾을 수 없습니다.');
    if (state.room.createdBy !== req.user.id) return errorResponse(res, 403, 'FORBIDDEN', '방장만 삭제할 수 있습니다.');
    if (state.room.status !== 'waiting') return errorResponse(res, 409, 'CONFLICT', '대기 중인 방만 삭제할 수 있습니다.');
    const { run } = await import('../config/mysql.js');
    await run("UPDATE battle_rooms SET status = 'cancelled' WHERE id = ? AND status = 'waiting'", [req.params.roomId]);
    const io = req.app.get('io');
    if (io) io.to(`battle:${req.params.roomId}`).emit('battle:room:deleted', { roomId: req.params.roomId });
    res.json({ message: '방이 삭제됐습니다.' });
  } catch (err) {
    console.error('[algorithm-battles/delete-room]', err);
    return internalError(res);
  }
});

router.post('/:id/rematch', async (req, res) => {
  try {
    const historyRow = await Battle.getHistory(req.user.id, 100);
    const matched = historyRow.find((row) => String(row.roomId) === String(req.params.id));
    if (!matched) return errorResponse(res, 404, 'NOT_FOUND', '해당 배틀 히스토리를 찾을 수 없습니다.');

    let invited = matched.opponentId ? await User.findById(Number(matched.opponentId)) : null;
    if (!invited && matched.opponentName) {
      invited = await User.findByUsername(matched.opponentName);
    }
    if (!invited) {
      return errorResponse(res, 404, 'NOT_FOUND', '상대방 정보를 찾을 수 없습니다.');
    }
    if (invited.id === req.user.id) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', '자기 자신과는 리매치를 만들 수 없습니다.');
    }

    const existing = await Battle.getInvite(invited.id);
    if (existing) {
      return errorResponse(res, 409, 'VALIDATION_ERROR', '상대방이 이미 다른 배틀 초대를 받은 상태입니다.');
    }

    const inviter = await User.findById(req.user.id);
    const room = await Battle.createRoom(
      { id: inviter.id, username: inviter.username },
      { id: invited.id, username: invited.username }
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${invited.id}`).emit('battle:rematch_request', {
        battleId: room.id,
        from: req.user.id,
      });
    }
    pushToUser(invited.id, {
      title: 'DailyCoding 리매치 요청',
      body: `${inviter.username}님이 다시 배틀을 신청했습니다.`,
      url: `/battle?room=${room.id}`,
    }).catch(() => {});

    res.json({
      roomId: room.id,
      opponentId: invited.id,
      opponentName: invited.username,
    });
  } catch (err) {
    console.error('[battles/rematch]', err);
    return internalError(res);
  }
});

// GET /api/battles/invite — 내게 온 대기 중 초대 확인
router.get('/invite', async (req, res) => {
  try {
    const invite = await Battle.getInvite(req.user.id);
    res.json({ invite: invite || null });
  } catch (err) {
    return internalError(res);
  }
});

// POST /api/battles/invite — 사용자명으로 배틀 신청
router.post('/invite', async (req, res) => {
  try {
    const { username, language, battleMode } = req.body;
    if (!username) return errorResponse(res, 400, 'VALIDATION_ERROR', 'username 필요');
    const normalizedLanguage = normalizeJudgeLanguage(language || '') || null;
    if (language && !normalizedLanguage) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', '지원하지 않는 배틀 언어입니다.');
    }
    const normalizedBattleMode = battleMode === 'race' ? 'race' : 'time';

    const invited = await User.findByUsername(username);
    if (!invited) return errorResponse(res, 404, 'NOT_FOUND', '해당 사용자를 찾을 수 없습니다.');
    if (invited.id === req.user.id) return errorResponse(res, 400, 'VALIDATION_ERROR', '자기 자신에게는 신청할 수 없습니다.');

    // 이미 대기 중인 초대가 있으면 거부
    const existing = await Battle.getInvite(invited.id);
    if (existing) return errorResponse(res, 409, 'VALIDATION_ERROR', '상대방이 이미 다른 배틀 초대를 받은 상태입니다.');

    const inviter = await User.findById(req.user.id);
    const room = await Battle.createRoom(
      { id: inviter.id, username: inviter.username },
      { id: invited.id, username: invited.username },
      { preferredLanguage: normalizedLanguage, battleMode: normalizedBattleMode }
    );
    pushToUser(invited.id, {
      title: 'DailyCoding 배틀 초대',
      body: `${inviter.username}님이 배틀을 신청했습니다.`,
      url: `/battle?room=${room.id}`,
    }).catch(() => {});
    res.json({ roomId: room.id });
  } catch (err) {
    return internalError(res);
  }
});

// POST /api/battles/accept/:roomId — 초대 수락 + 문제 선정
router.post('/accept/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const waitingRoom = await Battle.getRoom(roomId);
    if (!waitingRoom) return errorResponse(res, 404, 'NOT_FOUND', '방을 찾을 수 없습니다.');
    const problems = await Battle.selectProblems({ preferredLanguage: waitingRoom.preferredLanguage || null });
    const room = await Battle.acceptInvite(req.user.id, roomId, problems);
    if (!room) return errorResponse(res, 400, 'VALIDATION_ERROR', '유효하지 않은 방입니다.');

    // Notify both players that the battle has started
    const io = req.app.get('io');
    if (io) {
      io.to(`battle:${roomId}`).emit('battle:started', { room });
    }

    res.json({ room });
  } catch (err) {
    return internalError(res);
  }
});

// POST /api/battles/decline/:roomId — 초대 거절
router.post('/decline/:roomId', async (req, res) => {
  try {
    await Battle.declineInvite(req.user.id, req.params.roomId);
    res.json({ ok: true });
  } catch (err) {
    return internalError(res);
  }
});

// GET /api/battles/room/:roomId — 방 상태 폴링 (참가자 또는 관전자)
router.get('/room/:roomId', async (req, res) => {
  try {
    const room = await Battle.getRoom(req.params.roomId);
    if (!room) return errorResponse(res, 404, 'NOT_FOUND', '방을 찾을 수 없습니다.');
    
    // 참가자도 아니고 관전 허용된 방도 아니면 거부 (일단 모든 활성 방은 관전 가능으로 설정)
    const isPlayer = room.playerIds.includes(req.user.id);
    if (!isPlayer && room.status !== 'active' && room.status !== 'ended') {
      return errorResponse(res, 403, 'FORBIDDEN', '접근 권한이 없습니다.');
    }
    
    // 관전자로 추가 (기록용)
    if (!isPlayer) await Battle.joinAsSpectator(req.params.roomId, req.user);
    
    res.json({ room });
  } catch (err) {
    return internalError(res);
  }
});

// POST /api/battles/room/:roomId/typing — 타이핑 상태 업데이트
router.post('/room/:roomId/typing', async (req, res) => {
  try {
    const { isTyping } = req.body;
    await Battle.updateTyping(req.params.roomId, req.user.id, !!isTyping);
    res.json({ ok: true });
  } catch (err) {
    return internalError(res);
  }
});

// POST /api/battles/room/:roomId/submit — fill-blank / bug-fix 정답 제출
router.post('/room/:roomId/submit', async (req, res) => {
  try {
    const { problemId, answer } = req.body;
    if (!problemId || answer === undefined) return errorResponse(res, 400, 'VALIDATION_ERROR', 'problemId, answer 필요');

    const room = await Battle.getRoom(req.params.roomId);
    if (!room) return errorResponse(res, 404, 'NOT_FOUND', '방을 찾을 수 없습니다.');
    if (!room.playerIds.includes(req.user.id)) return errorResponse(res, 403, 'FORBIDDEN', '접근 권한이 없습니다.');
    if (room.status !== 'active') return errorResponse(res, 400, 'VALIDATION_ERROR', '진행 중인 배틀이 아닙니다.');

    // 타이머전에서는 선점된 문제 제출 불가 (race 모드는 제한 없음)
    if (room.battleMode !== 'race' && room.locked[String(problemId)]) {
      return res.json({ correct: false, locked: true, room });
    }

    const problem = room.problems.find(p => String(p.id) === String(problemId));
    if (!problem) return errorResponse(res, 404, 'NOT_FOUND', '문제를 찾을 수 없습니다.');

    let correct = false;
    if (problem.type === 'fill-blank') {
      correct = evaluateFillBlankAnswer(problem, answer);
    } else if (problem.type === 'bug-fix') {
      correct = evaluateBugFixAnswer(problem, answer);
    }

    const updatedRoom = await Battle.submitAnswer(req.params.roomId, req.user.id, problemId, correct, {
      language: problem.preferredLanguage || null,
    });

    // Broadcast submission result to room
    const io = req.app.get('io');
    if (io) {
      io.to(`battle:${req.params.roomId}`).emit('battle:opponent_submitted', {
        userId: req.user.id,
        problemId,
        result: correct ? 'correct' : 'wrong',
        solvedAt: Date.now(),
      });
      // If the battle has ended, notify with winner info
      if (updatedRoom?.status === 'ended') {
        await rewardBattleWinnerMissions(updatedRoom);
        await applyBattlePromotionLosses(updatedRoom);
        await advanceTournamentIfNeeded(req.params.roomId, updatedRoom);
        await Promise.all([redis.del('ranking:battle'), redis.del('ranking:overall')]);
        const { winnerTeamId, loserTeamId, teamScores } = resolveWinner(updatedRoom.players, updatedRoom.teams);
        io.to(`battle:${req.params.roomId}`).emit('battle:ended', {
          winnerTeamId, loserTeamId, teamScores, players: updatedRoom.players,
        });
      }
    }

    res.json({ correct, room: updatedRoom });
  } catch (err) {
    return internalError(res);
  }
});

// POST /api/battles/room/:roomId/code-judge — 코딩 문제 채점 (배틀 전용, 레이팅 변동 없음)
router.post('/room/:roomId/code-judge', async (req, res) => {
  try {
    const { problemId, lang, code } = req.body;
    if (!problemId || !lang || !code) return errorResponse(res, 400, 'VALIDATION_ERROR', 'problemId, lang, code 필요');
    if (code.length > 100_000) return errorResponse(res, 400, 'VALIDATION_ERROR', '코드가 너무 큽니다. (최대 100KB)');

    const room = await Battle.getRoom(req.params.roomId);
    if (!room) return errorResponse(res, 404, 'NOT_FOUND', '방을 찾을 수 없습니다.');
    if (!room.playerIds.includes(req.user.id)) return errorResponse(res, 403, 'FORBIDDEN', '접근 권한이 없습니다.');
    if (room.status !== 'active') return errorResponse(res, 400, 'VALIDATION_ERROR', '진행 중인 배틀이 아닙니다.');

    if (room.battleMode !== 'race' && room.locked[String(problemId)]) {
      return res.json({ result: 'locked', room });
    }

    // DB에서 실제 문제 정보 조회 (테스트케이스 포함)
    const Problem = await getProblemModel();
    const prob = await Problem.findById(Number(problemId));
    if (!prob) return errorResponse(res, 404, 'NOT_FOUND', '문제를 찾을 수 없습니다.');
    const problemType = prob.problemType || prob.problem_type || 'coding';
    if (problemType !== 'coding' && problemType !== 'build') {
      return errorResponse(res, 400, 'VALIDATION_ERROR', '코딩 배틀 채점은 코딩 문제에서만 사용할 수 있습니다.');
    }

    const judgeRuntime = await getCachedJudgeRuntime({ logOnRefresh: true });
    if (judgeRuntime.mode === 'unavailable') {
      return errorResponse(res, 503, 'INTERNAL_ERROR', '현재 서버에서 채점 런타임을 사용할 수 없습니다.', {
        supportedLanguages: judgeRuntime.supportedLanguages || [],
      });
    }
    const requester = await User.findById(req.user.id);
    const { execution, displayLang, normalizedLang } = await executeSubmissionFlow({
      problem: prob,
      problemId: Number(problemId),
      userId: req.user.id,
      rawLang: lang,
      code,
      judgeRuntime,
      persist: false,
      includeHiddenCases: true,
      userTier: requester?.subscription_tier || 'free',
    });
    const { result, time, mem, detail } = execution;
    const timeMs = time ? parseInt(time, 10) : null;
    const memoryMb = mem && /^\d+/.test(mem) ? parseInt(mem, 10) : null;

    const correct = result === 'correct';
    const updatedRoom = await Battle.submitAnswer(req.params.roomId, req.user.id, problemId, correct, {
      language: displayLang || normalizedLang || lang,
    });
    // ★ User.onSolve() 호출 없음 — 배틀 결과는 레이팅/스트릭에 영향 없음

    // Broadcast code-judge result to room
    const io = req.app.get('io');
    if (io) {
      io.to(`battle:${req.params.roomId}`).emit('battle:opponent_submitted', {
        userId: req.user.id,
        problemId,
        result,
        solvedAt: Date.now(),
      });
      // If the battle has ended, notify with winner info
      if (updatedRoom?.status === 'ended') {
        await rewardBattleWinnerMissions(updatedRoom);
        await applyBattlePromotionLosses(updatedRoom);
        await advanceTournamentIfNeeded(req.params.roomId, updatedRoom);
        await Promise.all([redis.del('ranking:battle'), redis.del('ranking:overall')]);
        const { winnerTeamId, loserTeamId, teamScores } = resolveWinner(updatedRoom.players, updatedRoom.teams);
        io.to(`battle:${req.params.roomId}`).emit('battle:ended', {
          winnerTeamId, loserTeamId, teamScores, players: updatedRoom.players,
        });
      }
    }

    res.json({ result, lang: displayLang || normalizedLang, timeMs, memoryMb, detail, room: updatedRoom });
  } catch (err) {
    if (err.status && err.body) {
      return res.status(err.status).json(err.body);
    }
    return internalError(res);
  }
});

// POST /api/battles/room/:roomId/end — 강제 종료 (타이머 만료 등)
router.post('/room/:roomId/end', async (req, res) => {
  try {
    const room = await Battle.getRoom(req.params.roomId);
    if (!room) return errorResponse(res, 404, 'NOT_FOUND', '방을 찾을 수 없습니다.');
    if (!room.playerIds.includes(req.user.id)) return errorResponse(res, 403, 'FORBIDDEN', '접근 권한이 없습니다.');
    const ended = await Battle.endRoom(req.params.roomId);
    if (ended?.status === 'ended') {
      await rewardBattleWinnerMissions(ended);
      await applyBattlePromotionLosses(ended);
      await advanceTournamentIfNeeded(req.params.roomId, ended);
      await Promise.all([redis.del('ranking:battle'), redis.del('ranking:overall')]);
    }

    // Notify all players the battle has ended (timer expiry)
    const io = req.app.get('io');
    if (io && ended) {
      const { winnerTeamId, loserTeamId, teamScores } = resolveWinner(ended.players, ended.teams);
      io.to(`battle:${req.params.roomId}`).emit('battle:ended', {
        winnerTeamId, loserTeamId, teamScores, players: ended.players, reason: 'timeout',
      });
    }

    res.json({ room: ended });
  } catch (err) {
    return internalError(res);
  }
});

export default router;
