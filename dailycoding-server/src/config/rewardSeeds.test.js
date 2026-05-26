import test from 'node:test';
import assert from 'node:assert/strict';

import { REWARD_SEEDS } from './rewardSeeds.js';

test('weekly challenge default reward is a real reward item', () => {
  const weeklyReward = REWARD_SEEDS.find((reward) => reward.code === 'weekly_solver');

  assert.equal(Boolean(weeklyReward), true);
  assert.equal(weeklyReward.type, 'badge');
  assert.equal(weeklyReward.category, 'coding');
});
