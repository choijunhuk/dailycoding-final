import jwt from 'jsonwebtoken';
import { redis } from '../config/redis.js';

// JWT_SECRET 미설정 시 명시적으로 오류 — 하드코딩 폴백 제거
const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.error('❌ Fatal error: JWT_SECRET environment variable is not set. Shutting down server.');
  process.exit(1);
}

export { SECRET };

function readAccessToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  if (typeof req.cookies?.accessToken === 'string' && req.cookies.accessToken.trim()) {
    return req.cookies.accessToken.trim();
  }
  return null;
}

export async function auth(req, res, next) {
  const token = readAccessToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  try {
    const decoded = jwt.verify(token, SECRET, {
      algorithms: ['HS256'],
      issuer:   'dailycoding',
      audience: 'dailycoding-client',
    });
    const { User } = await import('../models/User.js');
    let dbUser = await User.findById(decoded.id);
    if (!dbUser) {
      return res.status(401).json({ message: 'User not found.' });
    }
    if (dbUser.banned_at) {
      return res.status(403).json({ message: 'Account has been banned.', code: 'ACCOUNT_BANNED' });
    }

    if (
      dbUser.subscription_expires_at &&
      new Date(dbUser.subscription_expires_at) < new Date() &&
      dbUser.subscription_tier !== 'free'
    ) {
      dbUser = await User.updateSubscription(dbUser.id, {
        subscription_tier: 'free',
        subscription_expires_at: null,
      });
    }

    req.user = {
      id: dbUser.id,
      role: dbUser.role,
      subscription_tier: dbUser.subscription_tier || 'free',
    };
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token.' });
  }
}

// 사용자 상태(role, verified) 캐시 헬퍼 (5분 TTL)
async function getCachedUserStatus(userId) {
  if (!userId) return null;
  const cacheKey = `auth:status:${userId}`;
  try {
    const cached = await redis.getJSON(cacheKey);
    if (cached) return cached;

    const { User } = await import('../models/User.js');
    const dbUser = await User.findById(userId);
    if (!dbUser) return null;

    const status = { 
      role: dbUser.role, 
      email_verified: !!dbUser.email_verified 
    };
    await redis.setJSON(cacheKey, status, 300); // 5분 캐시
    return status;
  } catch {
    return null;
  }
}

// 이메일 인증 확인 — Redis 캐싱 활용
export async function requireVerified(req, res, next) {
  try {
    const status = await getCachedUserStatus(req.user?.id);
    if (!status) return res.status(401).json({ message: 'User not found.' });
    
    // 어드민은 이메일 인증 불필요
    if (status.role === 'admin') return next();
    if (!status.email_verified) {
      return res.status(403).json({
        message: 'Email verification is required. Please check your inbox.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }
    next();
  } catch {
    res.status(500).json({ message: '서버 오류' });
  }
}

// DB에서 직접 role 검증 — 캐시 미사용 (강등 즉시 반영 필요)
export async function adminOnly(req, res, next) {
  try {
    const { User } = await import('../models/User.js');
    const dbUser = await User.findById(req.user?.id);
    if (!dbUser || dbUser.role !== 'admin') {
      return res.status(403).json({ message: '관리자만 접근할 수 있습니다.' });
    }
    next();
  } catch {
    res.status(500).json({ message: '서버 오류' });
  }
}
