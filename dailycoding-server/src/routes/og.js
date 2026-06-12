import { Router } from 'express';
import { queryOne } from '../config/mysql.js';
import logger from '../config/logger.js';

const router = Router();

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function clip(str, max = 60) {
  const s = String(str || '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// Reusable SVG template. 1200x630 (LinkedIn / Twitter / Facebook standard).
function renderSvg({ kind, title, subtitle, badge, accent = '#6c63ff' }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d1117"/>
      <stop offset="100%" stop-color="#161b22"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${escapeXml(accent)}"/>
      <stop offset="100%" stop-color="#22d3ee"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="8" fill="url(#accent)"/>
  <text x="80" y="120" font-family="Inter, sans-serif" font-size="28" font-weight="600" fill="#7d8590">
    DailyCoding · ${escapeXml(kind)}
  </text>
  <text x="80" y="240" font-family="Inter, sans-serif" font-size="72" font-weight="800" fill="#e6edf3">
    ${escapeXml(clip(title, 36))}
  </text>
  <text x="80" y="320" font-family="Inter, sans-serif" font-size="34" font-weight="500" fill="#9ea4ad">
    ${escapeXml(clip(subtitle, 56))}
  </text>
  ${badge ? `
  <g transform="translate(80, 460)">
    <rect width="${24 + 14 * String(badge).length}" height="56" rx="28" fill="${escapeXml(accent)}" opacity="0.18"/>
    <text x="22" y="38" font-family="Inter, sans-serif" font-size="28" font-weight="700" fill="${escapeXml(accent)}">
      ${escapeXml(badge)}
    </text>
  </g>` : ''}
  <text x="80" y="580" font-family="Inter, sans-serif" font-size="22" fill="#6e7681">
    dailycoding-final.com
  </text>
</svg>`;
}

function svgResponse(res, svg) {
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.send(svg);
}

// MVP NOTE: SVG works for Twitter/Discord previews via og:image when the
// platform fetches/converts. For pinpoint Facebook/Slack support, we should
// add a PNG fallback via @resvg/resvg-js — left as a follow-up to avoid
// pulling in a native binary now.

router.get('/battle/:slug', async (req, res) => {
  try {
    const row = await queryOne(
      `SELECT br.title, br.mode, br.status, brs.slug
       FROM battle_replay_shares brs
       JOIN battle_rooms br ON br.id = brs.room_id
       WHERE brs.slug = ?`,
      [req.params.slug],
    );
    if (!row) return res.status(404).send('Not found');
    return svgResponse(res, renderSvg({
      kind: 'Algorithm Battle Replay',
      title: row.title || 'Algorithm Battle',
      subtitle: `${row.mode || 'standard'} · ${row.status || 'ended'}`,
      badge: 'WATCH REPLAY',
    }));
  } catch (err) {
    logger.warn('[og/battle]', { message: err.message });
    return res.status(500).send('og error');
  }
});

router.get('/share/:slug', async (req, res) => {
  try {
    const row = await queryOne(
      `SELECT p.title AS problem_title, u.username, sub.result, sub.lang
       FROM shared_submissions ss
       JOIN submissions sub ON sub.id = ss.submission_id
       JOIN problems p ON p.id = sub.problem_id
       JOIN users u ON u.id = sub.user_id
       WHERE ss.slug = ?`,
      [req.params.slug],
    );
    if (!row) return res.status(404).send('Not found');
    return svgResponse(res, renderSvg({
      kind: 'Code Share',
      title: row.problem_title,
      subtitle: `${row.username} · ${row.lang || 'code'} · ${row.result === 'correct' ? '정답' : row.result}`,
      badge: row.result === 'correct' ? 'AC' : (row.result || '').toUpperCase(),
      accent: row.result === 'correct' ? '#22c55e' : '#6c63ff',
    }));
  } catch (err) {
    logger.warn('[og/share]', { message: err.message });
    return res.status(500).send('og error');
  }
});

router.get('/profile/:userId', async (req, res) => {
  try {
    const row = await queryOne(
      'SELECT username, tier, rating, solved_count FROM users WHERE id = ?',
      [Number(req.params.userId)],
    );
    if (!row) return res.status(404).send('Not found');
    return svgResponse(res, renderSvg({
      kind: 'Profile',
      title: row.username,
      subtitle: `${row.tier?.toUpperCase() || 'UNRANKED'} · 레이팅 ${row.rating ?? 0} · 푼 문제 ${row.solved_count ?? 0}`,
      badge: row.tier?.toUpperCase() || 'UNRANKED',
    }));
  } catch (err) {
    logger.warn('[og/profile]', { message: err.message });
    return res.status(500).send('og error');
  }
});

export default router;
