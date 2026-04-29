import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { redis } from '../../config/redis.js';
import { User } from '../../models/User.js';
import { AdminLog } from '../../models/AdminLog.js';
import { SECRET } from '../../middleware/auth.js';
import { insert, queryOne, run } from '../../config/mysql.js';

export function makeToken(user) {
  return jwt.sign(
    { id: user.id },
    SECRET,
    { expiresIn: '15m', issuer: 'dailycoding', audience: 'dailycoding-client' }
  );
}

function makeRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

export async function clearAuthStatus(userId) {
  if (userId) await redis.del(`auth:status:${userId}`);
}

export async function logAdminAction(req, action, targetType, targetId, detail) {
  await AdminLog.create({
    adminId: req.user.id,
    action,
    targetType,
    targetId,
    detail,
  });
}

function getCookieBaseOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'None' : 'Lax',
    path: '/',
  };
}

export function clearAuthCookies(res) {
  const options = getCookieBaseOptions();
  res.clearCookie('accessToken', options);
  res.clearCookie('refreshToken', options);
}

export async function issueTokens(res, user) {
  const accessToken = makeToken(user);
  const refreshToken = makeRefreshToken();
  const key = `auth:refresh:${user.id}`;
  const oldToken = await redis.get(key);
  if (oldToken) {
    await redis.set(`auth:refresh:grace:${user.id}:${oldToken}`, '1', 10);
  }
  await redis.set(key, refreshToken, 7 * 24 * 60 * 60);

  const baseOptions = getCookieBaseOptions();
  res.cookie('accessToken', accessToken, {
    ...baseOptions,
    maxAge: 15 * 60 * 1000,
  });
  res.cookie('refreshToken', `${user.id}.${refreshToken}`, {
    ...baseOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return accessToken;
}

export async function findOrCreateOAuthUser({ provider, oauthId, email, username, avatarUrl }) {
  let user = await User.findByOAuth(provider, oauthId);
  if (user) {
    if (avatarUrl && user.avatar_url !== avatarUrl) {
      await User.update(user.id, { avatar_url: avatarUrl });
      user = await User.findById(user.id);
    }
    return user;
  }

  const byEmail = await User.findByEmail(email);
  if (byEmail) {
    await run(
      'UPDATE users SET oauth_provider=?, oauth_id=?, avatar_url=? WHERE id=?',
      [provider, oauthId, avatarUrl || null, byEmail.id]
    );
    return User.findById(byEmail.id);
  }

  let finalUsername = username.replace(/[^a-zA-Z0-9_가-힣]/g, '').slice(0, 28) || 'user';
  for (let index = 0; index < 5; index += 1) {
    const exists = await queryOne('SELECT 1 FROM users WHERE username=?', [finalUsername]);
    if (!exists) break;
    finalUsername = `${finalUsername.slice(0, 24)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  const today = new Date().toISOString().slice(0, 10);
  const userId = await insert(
    'INSERT INTO users (email, password, username, role, tier, rating, join_date, oauth_provider, oauth_id, avatar_url, email_verified) VALUES (?,NULL,?,?,?,?,?,?,?,?,1)',
    [email, finalUsername, 'user', 'unranked', 0, today, provider, oauthId, avatarUrl || null]
  );
  return User.findById(userId);
}
