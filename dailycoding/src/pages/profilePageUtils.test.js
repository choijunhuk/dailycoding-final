import { test } from 'vitest';
import assert from 'node:assert/strict';
import { TIER_COLORS } from '../data/problems.js';
import { buildYearHeatmap, formatDuration, profileBackgroundToCss, PROFILE_TIER_LABELS, PROFILE_TIER_THRESHOLDS } from './profilePageUtils.js';

test('profile tier helpers expose expected labels and thresholds', () => {
  assert.equal(PROFILE_TIER_LABELS.gold, 'GOLD');
  assert.equal(PROFILE_TIER_THRESHOLDS.unranked, 0);
  assert.equal(PROFILE_TIER_THRESHOLDS.iron, 1);
  assert.ok(PROFILE_TIER_THRESHOLDS.diamond > PROFILE_TIER_THRESHOLDS.gold);
});

test('buildYearHeatmap creates 364 cells and applies levels', () => {
  const cells = buildYearHeatmap([{ date: '2026-01-02', level: 9 }], new Date('2026-12-31T00:00:00Z'));
  assert.equal(cells.length, 364);
  assert.ok(cells.some((cell) => cell.date === '2026-01-02' && cell.level === 4));
});

test('formatDuration handles empty and normal durations', () => {
  assert.equal(formatDuration(0), '기록 없음');
  assert.equal(formatDuration(45), '45초');
  assert.equal(formatDuration(125), '2분 5초');
});

test('profileBackgroundToCss supports solid, gradient, and image backgrounds', () => {
  assert.equal(profileBackgroundToCss('solid:#10151c'), '#10151c');
  assert.equal(profileBackgroundToCss('gradient:linear-gradient(#000,#111)'), 'linear-gradient(#000,#111)');
  assert.equal(profileBackgroundToCss('/backgrounds/background4.jpg'), 'url(/backgrounds/background4.jpg) center/cover');
});

test('profile tier distribution colors stay visually distinct', () => {
  const profileTiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  const colors = profileTiers.map((tier) => TIER_COLORS[tier]);
  assert.equal(new Set(colors).size, colors.length);
  assert.notEqual(TIER_COLORS.bronze, TIER_COLORS.gold);
});
