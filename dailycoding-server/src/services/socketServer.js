import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { SECRET } from '../middleware/auth.js';

// Use logger if available, fall back to console
let logger;
try {
  const mod = await import('../config/logger.js');
  logger = mod.default;
} catch {
  logger = { info: console.log, error: console.error, warn: console.warn };
}

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
        issuer: 'dailycoding',
        audience: 'dailycoding-client',
      });
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

    // ── Battle events ────────────────────────────────────────────

    // Join battle room as player
    socket.on('battle:join', ({ battleId, teamId }) => {
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
    socket.on('battle:typing', ({ battleId, isTyping }) => {
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
    });
  });

  // Export io so routes can emit events
  return io;
}
