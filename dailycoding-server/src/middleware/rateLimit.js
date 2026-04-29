import redis from '../config/redis.js';

// Redis 다운 시 인메모리 폴백
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
 * Redis 기반 Rate Limiter (Redis 장애 시 인메모리 폴백)
 * @param {number} max - 허용 요청 수
 * @param {number} windowSec - 시간 창 (초)
 */
export function rateLimit(max = 30, windowSec = 60) {
  return async (req, res, next) => {
    // originalUrl 사용으로 경로별 독립적인 카운터 적용
    const identifier = req.user?.id || req.ip;
    const key = `rl:${identifier}:${req.method}:${req.originalUrl.split('?')[0]}`;
    let count;
    let retryAfter = windowSec;
    try {
      count = await redis.incr(key, windowSec);
      const ttl = await redis.ttl(key);
      if (ttl > 0) retryAfter = ttl;
      // NOTE: redis.incr() already sets TTL on first increment — don't call redis.set()
      // here as that would reset the counter during concurrent requests (race condition)
    } catch {
      // Redis 장애 시 인메모리 폴백 사용 (통과 대신)
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
        message: `요청이 너무 많습니다. ${retryAfter}초 후 다시 시도해주세요.`,
        retryAfter,
      });
    }
    next();
  };
}

// 로그인/회원가입용 더 엄격한 제한
export const authLimiter = rateLimit(10, 15 * 60);
// AI 호출 제한
export const aiLimiter   = rateLimit(20, 60);
// 제출 제한
export const submitLimiter = rateLimit(15, 60);
// 일반 API 제한 (문제 목록, 대회, 랭킹 등 공개 엔드포인트)
export const generalLimiter = rateLimit(100, 60);
// 비밀번호 찾기 제한
export const forgotPasswordLimiter = rateLimit(5, 60 * 60);
// 커뮤니티 작성 제한
export const communityPostLimiter = rateLimit(10, 60);
export const communityReplyLimiter = rateLimit(20, 60);
