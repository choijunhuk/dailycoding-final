import { test } from 'vitest';
import assert from 'node:assert/strict';
import { buildAdminQualitySignals } from './adminQualityUtils.js';

test('buildAdminQualitySignals flags low correct rate and low activity', () => {
  const signals = buildAdminQualitySignals({
    userStats: { activeToday: 0 },
    submissionStats: { totalToday: 12, correctRate: 18 },
    battleStatus: { total: 0 },
    recentReviews: [],
  }, 'ko');

  assert.equal(signals.some((signal) => signal.key === 'correct-rate'), true);
  assert.equal(signals.some((signal) => signal.key === 'activity'), true);
});

test('buildAdminQualitySignals summarizes review and battle operations', () => {
  const signals = buildAdminQualitySignals({
    userStats: { activeToday: 6 },
    submissionStats: { totalToday: 44, correctRate: 63 },
    battleStatus: { total: 8, waiting: 2, playing: 3, finished: 3 },
    recentReviews: [
      { id: 1, status: 'open' },
      { id: 2, status: 'pending' },
      { id: 3, status: 'resolved' },
    ],
  }, 'en');

  const reviews = signals.find((signal) => signal.key === 'reviews');
  const battles = signals.find((signal) => signal.key === 'battles');

  assert.equal(reviews.stat, '2 pending');
  assert.equal(battles.stat, '3 live');
});
