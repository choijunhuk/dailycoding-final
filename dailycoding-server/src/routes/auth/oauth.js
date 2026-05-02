import { Router } from 'express';
import crypto from 'crypto';
import { issueTokens, clearAuthStatus, findOrCreateOAuthUser } from './helpers.js';

const router = Router();

function setOauthStateCookie(res, state) {
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 10 * 60 * 1000,
    path: '/',
  });
}

router.get('/github', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  setOauthStateCookie(res, state);
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID || '',
    redirect_uri: process.env.GITHUB_CALLBACK_URL || 'http://localhost:4000/api/auth/github/callback',
    scope: 'user:email',
    state,
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

router.get('/github/callback', async (req, res) => {
  const { code, state } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const storedState = req.cookies?.oauth_state;
  res.clearCookie('oauth_state', { httpOnly: true, path: '/' });
  if (!storedState || storedState !== state) return res.redirect(`${frontendUrl}#oauth_error=invalid_state`);
  if (!code) return res.redirect(`${frontendUrl}#oauth_error=code_missing`);

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(tokenData.error_description || 'GitHub token error');

    const githubAccessToken = tokenData.access_token;
    const [userRes, emailRes] = await Promise.all([
      fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${githubAccessToken}`, 'User-Agent': 'DailyCoding' } }),
      fetch('https://api.github.com/user/emails', { headers: { Authorization: `Bearer ${githubAccessToken}`, 'User-Agent': 'DailyCoding' } }),
    ]);
    const ghUser = await userRes.json();
    const emails = await emailRes.json();
    const primary = Array.isArray(emails) ? (emails.find((email) => email.primary && email.verified) || emails[0])?.email : ghUser.email;
    if (!primary) throw new Error('이메일 정보를 가져올 수 없습니다.');

    const user = await findOrCreateOAuthUser({
      provider: 'github',
      oauthId: String(ghUser.id),
      email: primary,
      username: ghUser.login,
      avatarUrl: ghUser.avatar_url,
    });
    if (user.banned_at) return res.redirect(`${frontendUrl}#oauth_error=account_banned`);
    await clearAuthStatus(user.id);
    await issueTokens(res, user);
    res.redirect(frontendUrl);
  } catch (err) {
    console.error('[github/callback]', err.message);
    res.redirect(`${frontendUrl}#oauth_error=${encodeURIComponent(err.message)}`);
  }
});

router.get('/google', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  setOauthStateCookie(res, state);
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback',
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/google/callback', async (req, res) => {
  const { code, state } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const storedState = req.cookies?.oauth_state;
  res.clearCookie('oauth_state', { httpOnly: true, path: '/' });
  if (!storedState || storedState !== state) return res.redirect(`${frontendUrl}#oauth_error=invalid_state`);
  if (!code) return res.redirect(`${frontendUrl}#oauth_error=code_missing`);

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback',
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(tokenData.error_description || 'Google token error');

    const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const gUser = await infoRes.json();
    if (!gUser.email) throw new Error('이메일 정보를 가져올 수 없습니다.');

    const user = await findOrCreateOAuthUser({
      provider: 'google',
      oauthId: gUser.sub,
      email: gUser.email,
      username: gUser.name || gUser.email.split('@')[0],
      avatarUrl: gUser.picture,
    });
    if (user.banned_at) return res.redirect(`${frontendUrl}#oauth_error=account_banned`);
    await clearAuthStatus(user.id);
    await issueTokens(res, user);
    res.redirect(frontendUrl);
  } catch (err) {
    console.error('[google/callback]', err.message);
    res.redirect(`${frontendUrl}#oauth_error=${encodeURIComponent(err.message)}`);
  }
});

export default router;
