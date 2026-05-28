import redis from '../config/redis.js';

// In-memory fallback when Redis is down
const fallback = new Map();
let fallbackMaxSize = 50000;
let lastFallbackCleanupAt = 0;

export function cleanupFallback(now = Date.now()) {
  for (const [key, entry] of fallback) {
    if (now > entry.expires) fallback.delete(key);
  }
  lastFallbackCleanupAt = now;
}

function enforceFallbackCap() {
  while (fallback.size > fallbackMaxSize) {
    const firstKey = fallback.keys().next().value;
    if (!firstKey) break;
    fallback.delete(firstKey);
  }
}

function maybeCleanupFallback(now = Date.now()) {
  if (now - lastFallbackCleanupAt >= 60 * 1000 || fallback.size >= fallbackMaxSize) {
    cleanupFallback(now);
  }
  enforceFallbackCap();
}

const fallbackCleanupTimer = setInterval(() => cleanupFallback(), 60 * 1000);
fallbackCleanupTimer.unref?.();

export function __resetFallbackForTests() {
  fallback.clear();
  lastFallbackCleanupAt = 0;
  fallbackMaxSize = 50000;
}

export function __setFallbackMaxSizeForTests(value) {
  fallbackMaxSize = value;
}

export function __getFallbackSizeForTests() {
  return fallback.size;
}

function inMemoryCheck(key, max, windowSec) {
  const now = Date.now();
  maybeCleanupFallback(now);
  let entry = fallback.get(key);
  if (!entry || now > entry.expires) {
    entry = { count: 0, expires: now + windowSec * 1000 };
  }
  entry.count++;
  fallback.set(key, entry);
  enforceFallbackCap();
  return {
    count: entry.count,
    retryAfter: Math.max(1, Math.ceil((entry.expires - now) / 1000)),
  };
}

/**
 * Redis-based rate limiter (falls back to in-memory when Redis is unavailable)
 * @param {number} max - maximum number of allowed requests
 * @param {number} windowSec - time window in seconds
 */
export function rateLimit(max = 30, windowSec = 60) {
  return async (req, res, next) => {
    const identifier = req.user?.id || req.ip;
    const routePath = req.route?.path ?? req.originalUrl.split('?')[0];
    const key = `rl:${identifier}:${req.method}:${routePath}`;
    let count;
    let retryAfter = windowSec;
    try {
      count = await redis.incr(key, windowSec);
      const ttl = await redis.ttl(key);
      if (ttl > 0) retryAfter = ttl;
      // NOTE: redis.incr() already sets TTL on first increment — don't call redis.set()
      // here as that would reset the counter during concurrent requests (race condition)
    } catch {
      // Use in-memory fallback on Redis failure (instead of passing through)
      const fallbackState = inMemoryCheck(key, max, windowSec);
      count = fallbackState.count;
      retryAfter = fallbackState.retryAfter;
    }
    const remaining = Math.max(0, max - count);
    res.setHeader('RateLimit-Policy', `${max};w=${windowSec}`);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(retryAfter));

    if (count > max) {
      res.setHeader('Retry-After', String(retryAfter));
      res.setHeader('Cache-Control', 'no-store');
      return res.status(429).json({
        message: `Too many requests. Please try again in ${retryAfter} seconds.`,
        retryAfter,
      });
    }
    next();
  };
}

// Login/signup limiter (generously sized to also cover read endpoints like /api/auth/me)
export const authLimiter = rateLimit(100, 15 * 60);
// AI call limiter
export const aiLimiter   = rateLimit(20, 60);
// Submission limiter (generously sized to also cover judge-status polling)
export const submitLimiter = rateLimit(60, 60);
// General API limiter (public endpoints: problem list, contests, ranking, etc.)
export const generalLimiter = rateLimit(100, 60);
// Forgot-password limiter
export const forgotPasswordLimiter = rateLimit(5, 60 * 60);
// Community post/reply limiters
export const communityPostLimiter = rateLimit(10, 60);
export const communityReplyLimiter = rateLimit(20, 60);
// Battle router limiter — high limit because the lobby polls 2 endpoints every 4s
export const battleLimiter = rateLimit(300, 60);
