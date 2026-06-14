#!/usr/bin/env node
import { assertHealthyPayload, resolveSmokeTargets } from './smokeLiveUtils.mjs';

const baseUrl = process.argv[2] || process.env.DAILYCODING_BASE_URL || 'https://dailycoding-final.com';
const targets = resolveSmokeTargets(baseUrl);

async function fetchText(url) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return response.json();
}

const [html, health] = await Promise.all([
  fetchText(targets.root),
  fetchJson(targets.health),
]);

assertHealthyPayload(health);

if (!/<title>.*DailyCoding/i.test(html) && !/DailyCoding/i.test(html)) {
  throw new Error('root HTML does not include DailyCoding brand text');
}

console.log(JSON.stringify({
  ok: true,
  root: targets.root,
  health: targets.health,
  services: health.services,
}, null, 2));
