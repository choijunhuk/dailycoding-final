import test from 'node:test';
import assert from 'node:assert/strict';
import { buildYearHeatmap, formatDuration, PROFILE_TIER_LABELS, PROFILE_TIER_THRESHOLDS } from './profilePageUtils.js';

test('profile tier helpers expose expected labels and thresholds', () => {
  assert.equal(PROFILE_TIER_LABELS.gold, 'GOLD');
  assert.equal(PROFILE_TIER_THRESHOLDS.unranked, 0);
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
