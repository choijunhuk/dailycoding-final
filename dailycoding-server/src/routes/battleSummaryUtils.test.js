import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBattleRecap } from './battleSummaryUtils.js';

test('buildBattleRecap gives an empty-state invitation', () => {
  const recap = buildBattleRecap({ recent: [], total: 0, winRate: 0 }, 'ko');

  assert.equal(recap.tone, 'empty');
  assert.match(recap.headline, /첫 배틀/);
  assert.equal(recap.suggestedAction, '/battle');
});

test('buildBattleRecap celebrates a strong recent win trend', () => {
  const recap = buildBattleRecap({
    recent: [{ result: 'win' }, { result: 'win' }, { result: 'draw' }],
    total: 10,
    winRate: 70,
  }, 'en');

  assert.equal(recap.tone, 'positive');
  assert.match(recap.headline, /Momentum/i);
  assert.match(recap.nextStep, /rematch/i);
});

test('buildBattleRecap recommends stability work after repeated losses', () => {
  const recap = buildBattleRecap({
    recent: [{ result: 'lose' }, { result: 'lose' }, { result: 'win' }],
    total: 8,
    winRate: 25,
  }, 'ko');

  assert.equal(recap.tone, 'recovery');
  assert.match(recap.nextStep, /오답 복구/);
  assert.equal(recap.suggestedAction, '/recovery');
});
