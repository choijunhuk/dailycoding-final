import { Router } from 'express';
import crypto from 'crypto';
import {
  issueTokens,
  clearAuthStatus,
  findOrCreateOAuthUser,
  getCookieBaseOptions,
  linkOAuthToExistingUser,
} from './helpers.js';
import { auth } from '../../middleware/auth.js';
import { User } from '../../models/User.js';

const router = Router();

const LINK_COOKIE = 'oauth_link_user_id';

function setOauthStateCookie(res, state) {
  res.cookie('oauth_state', state, {
    ...getCookieBaseOptions(),
    maxAge: 10 * 60 * 1000,
  });
}

function setLinkCookie(res, userId) {
  res.cookie(LINK_COOKIE, String(userId), {
    ...getCookieBaseOptions(),
    maxAge: 10 * 60 * 1000,
  });
}

function readLinkUserId(req, res) {
  const raw = req.cookies?.[LINK_COOKIE];
  res.clearCookie(LINK_COOKIE, getCookieBaseOptions());
  if (!raw) return null;
  const id = parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function handleOAuthResult({ res, req, provider, oauthData, frontendUrl }) {
  const linkUserId = readLinkUserId(req, res);
  if (linkUserId) {
    try {
      await linkOAuthToExistingUser({
        userId: linkUserId,
        provider,
        oauthId: oauthData.oauthId,
      });
    } catch (err) {
      return res.redirect(`${frontendUrl}/settings#oauth_link_error=${encodeURIComponent(err.message)}`);
    }
    return res.redirect(`${frontendUrl}/settings#oauth_linked=${provider}`);
  }
  const user = await findOrCreateOAuthUser(oauthData);
  if (user.banned_at) return res.redirect(`${frontendUrl}#oauth_error=account_banned`);
  await clearAuthStatus(user.id);
  await issueTokens(res, user);
  res.redirect(frontendUrl);
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
  res.clearCookie('oauth_state', getCookieBaseOptions());
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
    const primary = Array.isArray(emails)
      ? emails.find((e) => e.primary && e.verified)?.email
      : null;
    if (!primary) throw new Error('No verified email found on your GitHub account. Please verify an email in your GitHub settings.');

    await handleOAuthResult({
      res,
      req,
      provider: 'github',
      oauthData: {
        provider: 'github',
        oauthId: String(ghUser.id),
        email: primary,
        username: ghUser.login,
        avatarUrl: ghUser.avatar_url,
      },
      frontendUrl,
    });
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
  res.clearCookie('oauth_state', getCookieBaseOptions());
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
    if (!gUser.email || !gUser.email_verified) throw new Error('A Google account with a verified email is required.');

    await handleOAuthResult({
      res,
      req,
      provider: 'google',
      oauthData: {
        provider: 'google',
        oauthId: gUser.sub,
        email: gUser.email,
        username: gUser.name || gUser.email.split('@')[0],
        avatarUrl: gUser.picture,
      },
      frontendUrl,
    });
  } catch (err) {
    console.error('[google/callback]', err.message);
    res.redirect(`${frontendUrl}#oauth_error=${encodeURIComponent(err.message)}`);
  }
});

router.get('/link/:provider', auth, (req, res) => {
  const provider = req.params.provider;
  if (provider !== 'github' && provider !== 'google') {
    return res.status(400).json({ message: 'Unsupported provider' });
  }
  setLinkCookie(res, req.user.id);
  res.redirect(`/api/auth/${provider}`);
});

router.get('/me/identities', auth, async (req, res) => {
  const identities = await User.listOAuthIdentities(req.user.id);
  const linked = { github: false, google: false };
  for (const row of identities) {
    if (row.provider === 'github') linked.github = true;
    if (row.provider === 'google') linked.google = true;
  }
  res.json({ identities, linked });
});

router.delete('/unlink/:provider', auth, async (req, res) => {
  const provider = req.params.provider;
  if (provider !== 'github' && provider !== 'google') {
    return res.status(400).json({ message: 'Unsupported provider' });
  }
  const fullUser = await User.findById(req.user.id);
  const identities = await User.listOAuthIdentities(req.user.id);
  const hasPassword = !!fullUser?.password;
  const otherIdentities = identities.filter((row) => row.provider !== provider);
  if (!hasPassword && otherIdentities.length === 0) {
    return res.status(400).json({
      message: 'Cannot unlink: set a password or link another provider first to avoid being locked out.',
    });
  }
  await User.unlinkOAuthIdentity(req.user.id, provider);
  res.json({ unlinked: provider });
});

export default router;
