import { test } from 'vitest';
import assert from 'node:assert/strict';
import { buildCompeteGuidance } from './competePageUtils.js';

test('buildCompeteGuidance recommends coding battle for newer solvers', () => {
  const cards = buildCompeteGuidance({ solvedCount: 3, battleSummary: { total: 0 }, lang: 'ko' });

  assert.equal(cards[0].key, 'battle');
  assert.equal(cards[0].recommended, true);
  assert.match(cards[0].reason, /짧은/);
});

test('buildCompeteGuidance recommends tournaments for active battlers', () => {
  const cards = buildCompeteGuidance({ solvedCount: 35, battleSummary: { total: 10, winRate: 70 }, lang: 'en' });
  const tournament = cards.find((card) => card.key === 'tournament');

  assert.equal(tournament.recommended, true);
  assert.match(tournament.reason, /bracket/i);
});

test('buildCompeteGuidance recommends workshop when battle volume is high', () => {
  const cards = buildCompeteGuidance({ solvedCount: 80, battleSummary: { total: 26, winRate: 52 }, lang: 'ko' });
  const workshop = cards.find((card) => card.key === 'workshop');

  assert.equal(workshop.recommended, true);
  assert.match(workshop.reason, /룰/);
});
