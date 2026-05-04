import { Router } from 'express';
import { auth, requireVerified } from '../middleware/auth.js';
import { Battle } from '../models/Battle.js';
import { User }   from '../models/User.js';
import { errorResponse, internalError } from '../middleware/errorHandler.js';
import { normalizeJudgeLanguage } from '../services/judge.js';
import { getCachedJudgeRuntime } from '../services/judgeRuntimeCache.js';
import { executeSubmissionFlow } from '../services/submissionExecution.js';
import { completeMission } from '../services/missionService.js';
import { recordPromotionLoss } from '../services/promotionService.js';
import { evaluateBugFixAnswer, evaluateFillBlankAnswer } from '../services/battleAnswerEvaluation.js';

const router = Router();
router.use(auth);
router.use(requireVerified);

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

async function rewardBattleWinnerMissions(room) {
  const { winnerTeamId } = resolveWinner(room.players, room.teams);
  if (!winnerTeamId) return;
  const winnerIds = Object.values(room.players || {})
    .filter((player) => player.teamId === winnerTeamId)
    .map((player) => player.id);
  await Promise.all(winnerIds.map(async (userId) => {
    try {
      await completeMission(userId, 'battle_win');
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

    const updatedRoom = await Battle.submitAnswer(req.params.roomId, req.user.id, problemId, correct);

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
    const updatedRoom = await Battle.submitAnswer(req.params.roomId, req.user.id, problemId, correct);
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
