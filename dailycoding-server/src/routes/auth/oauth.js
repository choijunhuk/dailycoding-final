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
const SUPPORTED_PROVIDERS = new Set(['github', 'google', 'discord', 'kakao']);

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

router.get('/discord', (req, res) => {
  if (!process.env.DISCORD_CLIENT_ID) {
    return res.status(503).json({ message: 'Discord OAuth is not configured on this server.' });
  }
  const state = crypto.randomBytes(16).toString('hex');
  setOauthStateCookie(res, state);
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_CALLBACK_URL || 'http://localhost:4000/api/auth/discord/callback',
    response_type: 'code',
    scope: 'identify email',
    state,
    prompt: 'consent',
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

router.get('/discord/callback', async (req, res) => {
  const { code, state } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const storedState = req.cookies?.oauth_state;
  res.clearCookie('oauth_state', getCookieBaseOptions());
  if (!storedState || storedState !== state) return res.redirect(`${frontendUrl}#oauth_error=invalid_state`);
  if (!code) return res.redirect(`${frontendUrl}#oauth_error=code_missing`);

  try {
    const redirectUri = process.env.DISCORD_CALLBACK_URL || 'http://localhost:4000/api/auth/discord/callback';
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(tokenData.error_description || 'Discord token error');

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const dUser = await userRes.json();
    // Fail-closed: a missing `verified` claim is treated as unverified.
    if (!dUser.email || dUser.verified !== true) {
      throw new Error('A Discord account with a verified email is required.');
    }

    const avatarUrl = dUser.avatar
      ? `https://cdn.discordapp.com/avatars/${dUser.id}/${dUser.avatar}.png`
      : null;

    await handleOAuthResult({
      res,
      req,
      provider: 'discord',
      oauthData: {
        provider: 'discord',
        oauthId: String(dUser.id),
        email: dUser.email,
        username: dUser.global_name || dUser.username,
        avatarUrl,
      },
      frontendUrl,
    });
  } catch (err) {
    console.error('[discord/callback]', err.message);
    res.redirect(`${frontendUrl}#oauth_error=${encodeURIComponent(err.message)}`);
  }
});

router.get('/kakao', (req, res) => {
  if (!process.env.KAKAO_CLIENT_ID) {
    return res.status(503).json({ message: 'Kakao OAuth is not configured on this server.' });
  }
  const state = crypto.randomBytes(16).toString('hex');
  setOauthStateCookie(res, state);
  const params = new URLSearchParams({
    client_id: process.env.KAKAO_CLIENT_ID,
    redirect_uri: process.env.KAKAO_CALLBACK_URL || 'http://localhost:4000/api/auth/kakao/callback',
    response_type: 'code',
    scope: 'account_email profile_nickname profile_image',
    state,
  });
  res.redirect(`https://kauth.kakao.com/oauth/authorize?${params}`);
});

router.get('/kakao/callback', async (req, res) => {
  const { code, state } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const storedState = req.cookies?.oauth_state;
  res.clearCookie('oauth_state', getCookieBaseOptions());
  if (!storedState || storedState !== state) return res.redirect(`${frontendUrl}#oauth_error=invalid_state`);
  if (!code) return res.redirect(`${frontendUrl}#oauth_error=code_missing`);

  try {
    const redirectUri = process.env.KAKAO_CALLBACK_URL || 'http://localhost:4000/api/auth/kakao/callback';
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.KAKAO_CLIENT_ID,
      redirect_uri: redirectUri,
      code,
    });
    if (process.env.KAKAO_CLIENT_SECRET) tokenBody.set('client_secret', process.env.KAKAO_CLIENT_SECRET);

    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody,
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(tokenData.error_description || 'Kakao token error');

    const userRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const kUser = await userRes.json();
    const account = kUser.kakao_account || {};
    const profile = account.profile || {};
    // Kakao restricts the `account_email` scope behind business verification.
    // Personal-tier apps cannot get a real email, so when the user has not
    // consented to (or the app cannot request) the email scope, fall back to a
    // synthetic email derived from the Kakao user id. Synthetic-email users
    // cannot reset their password — they must keep the linked Kakao identity.
    // Identification still relies on (provider, oauthId), so this is safe.
    const hasVerifiedEmail = account.email && account.is_email_verified === true;
    const email = hasVerifiedEmail ? account.email : `kakao_${kUser.id}@kakao.local`;
    const fallbackUsername = hasVerifiedEmail
      ? account.email.split('@')[0]
      : `kakao_${kUser.id}`;

    await handleOAuthResult({
      res,
      req,
      provider: 'kakao',
      oauthData: {
        provider: 'kakao',
        oauthId: String(kUser.id),
        email,
        username: profile.nickname || fallbackUsername,
        avatarUrl: profile.profile_image_url || null,
      },
      frontendUrl,
    });
  } catch (err) {
    console.error('[kakao/callback]', err.message);
    res.redirect(`${frontendUrl}#oauth_error=${encodeURIComponent(err.message)}`);
  }
});

router.get('/link/:provider', auth, (req, res) => {
  const provider = req.params.provider;
  if (!SUPPORTED_PROVIDERS.has(provider)) {
    return res.status(400).json({ message: 'Unsupported provider' });
  }
  setLinkCookie(res, req.user.id);
  res.redirect(`/api/auth/${provider}`);
});

router.get('/me/identities', auth, async (req, res) => {
  const identities = await User.listOAuthIdentities(req.user.id);
  const linked = { github: false, google: false, discord: false, kakao: false };
  for (const row of identities) {
    if (linked[row.provider] !== undefined) linked[row.provider] = true;
  }
  res.json({ identities, linked });
});

router.delete('/unlink/:provider', auth, async (req, res) => {
  const provider = req.params.provider;
  if (!SUPPORTED_PROVIDERS.has(provider)) {
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
