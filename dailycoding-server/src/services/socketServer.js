import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { SECRET } from '../middleware/auth.js';
import { AlgorithmBattle } from '../models/AlgorithmBattle.js';
import { User } from '../models/User.js';
import { Problem } from '../models/Problem.js';
import { getCachedJudgeRuntime } from './judgeRuntimeCache.js';
import { executeSubmissionFlow } from './submissionExecution.js';

// Use logger if available, fall back to console
let logger;
try {
  const mod = await import('../config/logger.js');
  logger = mod.default;
} catch {
  logger = { info: console.log, error: console.error, warn: console.warn };
}

const submitRateLimits = new Map();
const SUBMIT_COOLDOWN_MS = 3000;

export function initSocketServer(httpServer, allowedOrigins) {
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  function readCookieToken(cookieHeader = '') {
    return cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('accessToken='))
      ?.slice('accessToken='.length) || null;
  }

  // JWT auth middleware for socket connections
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
      readCookieToken(socket.handshake.headers?.cookie);
    if (!token) return next(new Error('Unauthorized'));
    try {
      const decoded = jwt.verify(token, SECRET, {
        algorithms: ['HS256'],
        issuer: 'dailycoding',
        audience: 'dailycoding-client',
      });
      const dbUser = await User.findById(decoded.id);
      if (!dbUser || dbUser.banned_at) return next(new Error('Unauthorized'));
      socket.data.userId = decoded.id;
      socket.data.username = decoded.username;
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);
    logger.info('Socket connected', { userId: socket.data.userId, socketId: socket.id });

    socket.on('authenticate', () => {
      socket.join(`user:${socket.data.userId}`);
    });

    socket.on('battle:spectator_chat', ({ roomId, message } = {}) => {
      const safeRoomId = String(roomId || '').slice(0, 80);
      if (!safeRoomId) return;
      const safeMessage = String(message || '').slice(0, 100).replace(/[<>]/g, '').trim();
      if (!safeMessage) return;
      io.to(`battle:${safeRoomId}`).emit('battle:spectator_chat', {
        username: socket.data.username || socket.user?.username || '익명',
        message: safeMessage,
        at: Date.now(),
      });
    });

    socket.on('battle:spectator_react', ({ roomId, emoji } = {}) => {
      const allowed = ['🔥', '👏', '😮', '💡', '⚡'];
      const safeRoomId = String(roomId || '').slice(0, 80);
      if (!safeRoomId || !allowed.includes(emoji)) return;
      io.to(`battle:${safeRoomId}`).emit('battle:spectator_react', { emoji, at: Date.now() });
    });

    // ── Battle events ────────────────────────────────────────────

    socket.on('battle:create', async (payload = {}, ack) => {
      try {
        const state = await AlgorithmBattle.createRoom({
          creatorId: socket.data.userId,
          mode: payload.mode || 'sort-speed',
          problemId: payload.problemId || null,
          maxPlayers: payload.maxPlayers || 2,
          durationSec: payload.durationSec || null,
          bannedTags: payload.bannedTags || [],
        });
        socket.join(`battle:${state.room.id}`);
        io.to(`battle:${state.room.id}`).emit('battle:room:update', state);
        if (typeof ack === 'function') ack({ ok: true, state });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, message: err.message });
      }
    });

    // Join battle room as player
    socket.on('battle:join', async (payload = {}, ack) => {
      const roomId = payload.roomId || (String(payload.battleId || '').startsWith('algo_') ? payload.battleId : null);
      if (roomId) {
        try {
          const state = await AlgorithmBattle.joinRoom(roomId, socket.data.userId);
          socket.join(`battle:${roomId}`);
          io.to(`battle:${roomId}`).emit('battle:room:update', state);
          if (typeof ack === 'function') ack({ ok: true, state });
        } catch (err) {
          if (typeof ack === 'function') ack({ ok: false, message: err.message });
        }
        return;
      }

      const { battleId, teamId } = payload;
      const room = `battle:${battleId}`;
      socket.join(room);
      socket.teamId = teamId;
      logger.info('Battle player join', { 
        event: 'battle:join',
        userId: socket.data.userId, 
        username: socket.data.username,
        battleId, 
        teamId,
        role: 'player'
      });
      // Notify the room that this player is online
      socket.to(room).emit('battle:opponent_online', { userId: socket.data.userId, teamId });
    });

    socket.on('battle:ready', async ({ roomId } = {}, ack) => {
      try {
        const before = await AlgorithmBattle.getRoom(roomId);
        const state = await AlgorithmBattle.markReady(roomId, socket.data.userId);
        socket.join(`battle:${roomId}`);
        io.to(`battle:${roomId}`).emit('battle:room:update', state);
        if (before?.status === 'waiting' && state?.room?.status === 'playing') {
          io.to(`battle:${roomId}`).emit('battle:countdown', { seconds: 3 });
          io.to(`battle:${roomId}`).emit('battle:started', state);
        }
        if (typeof ack === 'function') ack({ ok: true, state });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, message: err.message });
      }
    });

    socket.on('battle:submit', async ({ roomId, code, language } = {}, ack) => {
      const now = Date.now();
      const lastSubmit = submitRateLimits.get(socket.data.userId) || 0;
      if (now - lastSubmit < SUBMIT_COOLDOWN_MS) {
        if (typeof ack === 'function') ack({ ok: false, message: '잠시 후 다시 제출해주세요.' });
        return;
      }
      submitRateLimits.set(socket.data.userId, now);
      try {
        const stateBefore = await AlgorithmBattle.ensureNotExpired(roomId);
        if (!stateBefore) throw new Error('방을 찾을 수 없습니다.');
        if (!stateBefore.participants.some((player) => player.userId === socket.data.userId)) {
          throw new Error('방 참가자만 제출할 수 있습니다.');
        }
        if (stateBefore.room.status !== 'playing') throw new Error('진행 중인 배틀이 아닙니다.');
        const problem = await Problem.findById(stateBefore.room.problemId);
        if (!problem) throw new Error('배틀 문제를 찾을 수 없습니다.');
        const judgeRuntime = await getCachedJudgeRuntime({ logOnRefresh: true });
        if (judgeRuntime.mode === 'unavailable') throw new Error('현재 서버에서 채점 런타임을 사용할 수 없습니다.');
        const requester = await User.findById(socket.data.userId);
        const { execution, displayLang, normalizedLang } = await executeSubmissionFlow({
          problem,
          problemId: Number(problem.id),
          userId: socket.data.userId,
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
          roomId,
          userId: socket.data.userId,
          code,
          language: displayLang || normalizedLang || language,
          judgeResult: {
            result: execution.result,
            timeMs,
            memoryMb,
            detail: execution.detail,
          },
        });
        io.to(`battle:${roomId}`).emit('battle:submission:result', {
          userId: socket.data.userId,
          result: execution.result,
          timeMs,
          memoryMb,
          detail: execution.detail,
        });
        const recentEvents = [...(state.events || [])].reverse();
        const attackEvent = recentEvents.find((event) => event.type === 'player.attack' && event.userId === socket.data.userId);
        const effectEvent = recentEvents.find((event) => event.type === 'problem.effect' && event.userId === socket.data.userId);
        if (attackEvent) {
          io.to(`battle:${roomId}`).emit('battle:player:attack', attackEvent);
        }
        if (effectEvent) {
          io.to(`battle:${roomId}`).emit('battle:effect', effectEvent);
        }
        io.to(`battle:${roomId}`).emit('battle:room:update', state);
        if (state.room.status === 'finished') io.to(`battle:${roomId}`).emit('battle:finished', { ...state, reason: 'knockout' });
        if (typeof ack === 'function') ack({ ok: true, state, result: execution.result });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, message: err.message });
      }
    });

    socket.on('battle:activity', async ({ roomId, activity, message } = {}, ack) => {
      try {
        const { event, state } = await AlgorithmBattle.recordActivity(roomId, socket.data.userId, { activity, message });
        socket.join(`battle:${roomId}`);
        io.to(`battle:${roomId}`).emit('battle:activity', event);
        io.to(`battle:${roomId}`).emit('battle:room:update', state);
        if (typeof ack === 'function') ack({ ok: true, event, state });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, message: err.message });
      }
    });

    socket.on('battle:chat', async ({ roomId, message } = {}, ack) => {
      try {
        const { event, state } = await AlgorithmBattle.recordChat(roomId, socket.data.userId, { message });
        socket.join(`battle:${roomId}`);
        io.to(`battle:${roomId}`).emit('battle:chat', event);
        io.to(`battle:${roomId}`).emit('battle:room:update', state);
        if (typeof ack === 'function') ack({ ok: true, event, state });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, message: err.message });
      }
    });

    socket.on('battle:emote', async ({ roomId, emote } = {}, ack) => {
      try {
        const { event, state } = await AlgorithmBattle.recordEmote(roomId, socket.data.userId, { emote });
        socket.join(`battle:${roomId}`);
        io.to(`battle:${roomId}`).emit('battle:emote', event);
        io.to(`battle:${roomId}`).emit('battle:room:update', state);
        if (typeof ack === 'function') ack({ ok: true, event, state });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, message: err.message });
      }
    });

    socket.on('battle:item', async ({ roomId, itemType } = {}, ack) => {
      try {
        const { event, state } = await AlgorithmBattle.useItem(roomId, socket.data.userId, { itemType });
        socket.join(`battle:${roomId}`);
        io.to(`battle:${roomId}`).emit('battle:item:used', event);
        io.to(`battle:${roomId}`).emit('battle:room:update', state);
        if (typeof ack === 'function') ack({ ok: true, event, state });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, message: err.message });
      }
    });

    socket.on('battle:leave', async ({ roomId } = {}, ack) => {
      try {
        const state = await AlgorithmBattle.leaveRoom(roomId, socket.data.userId);
        socket.leave(`battle:${roomId}`);
        if (state?.room?.id) io.to(`battle:${roomId}`).emit('battle:room:update', state);
        if (typeof ack === 'function') ack({ ok: true, state });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, message: err.message });
      }
    });

    // Join battle room as spectator
    socket.on('battle:spectate', (battleId) => {
      const room = `battle:${battleId}`;
      socket.join(room);
      logger.info('Battle spectator join', { 
        event: 'battle:spectate',
        userId: socket.data.userId, 
        username: socket.data.username,
        battleId, 
        role: 'spectator'
      });
      socket.emit('battle:spectator_joined', { battleId });
    });

    // Player submitted code - broadcast result to room
    socket.on('battle:submitted', ({ battleId, result, solvedAt, problemId }) => {
      const room = `battle:${battleId}`;
      io.to(room).emit('battle:opponent_submitted', {
        userId: socket.data.userId,
        teamId: socket.teamId,
        result,
        solvedAt,
        problemId
      });
      logger.info('Battle submission broadcast', {
        event: 'battle:submitted',
        userId: socket.data.userId,
        username: socket.data.username,
        battleId,
        teamId: socket.teamId,
        problemId,
        result,
      });
    });

    // Typing indicator
    socket.on('battle:typing', async ({ battleId, roomId, isTyping }) => {
      const algorithmRoomId = roomId || (String(battleId || '').startsWith('algo_') ? battleId : null);
      if (algorithmRoomId) {
        try {
          const { event, state } = await AlgorithmBattle.recordActivity(algorithmRoomId, socket.data.userId, {
            activity: isTyping ? '코드 작성 중' : '생각 중',
          });
          socket.to(`battle:${algorithmRoomId}`).emit('battle:activity', event);
          io.to(`battle:${algorithmRoomId}`).emit('battle:room:update', state);
        } catch {
          // best-effort realtime presence
        }
        return;
      }
      socket.to(`battle:${battleId}`).emit('battle:opponent_typing', {
        userId: socket.data.userId,
        teamId: socket.teamId,
        isTyping
      });
    });

    // ── Contest events ──────────────────────────────────────────

    // Join contest scoreboard room
    socket.on('contest:join', (contestId) => {
      socket.join(`contest:${contestId}`);
    });

    // ── Disconnect ──────────────────────────────────────────────
    socket.on('disconnect', () => {
      logger.info('Socket disconnected', { userId: socket.data.userId });
      submitRateLimits.delete(socket.data.userId);
    });
  });

  // Export io so routes can emit events
  return io;
}
