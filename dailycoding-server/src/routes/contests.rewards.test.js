import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_HOST = 'invalid_host';
process.env.REDIS_URL = 'redis://invalid:6379';
process.env.JWT_SECRET = 'test_secret';

import { insert, waitForDB } from '../config/mysql.js';
import { Contest } from '../models/Contest.js';
import { queryOne } from '../config/mysql.js';

async function createUser(prefix) {
  return insert(
    'INSERT INTO users (email, username, role, subscription_tier) VALUES (?,?,?,?)',
    [`${prefix}-${Date.now()}@test.com`, `${prefix}${Date.now()}`, 'user', 'free']
  );
}

test('contest reward rules are granted by rank and remain idempotent on repeated payout', async () => {
  await waitForDB();

  const hostId = await createUser('host');
  const firstId = await createUser('first');
  const secondId = await createUser('second');
  const thirdId = await createUser('third');

  await insert(
    'INSERT INTO reward_items (code, type, name, icon, description, rarity) VALUES (?,?,?,?,?,?)',
    ['reward_rank1_test', 'badge', '1위 테스트 보상', '🏆', 'rank1', 'rare']
  );
  await insert(
    'INSERT INTO reward_items (code, type, name, icon, description, rarity) VALUES (?,?,?,?,?,?)',
    ['reward_top3_test', 'badge', 'TOP3 테스트 보상', '🎖️', 'top3', 'common']
  );

  const contest = await Contest.create({
    name: 'Reward Rule Contest',
    description: 'rule payout test',
    durationMin: 60,
    privacy: 'public',
    joinType: 'direct',
    maxUsers: 50,
    hostId,
    rewardRules: [
      { rankFrom: 1, rankTo: 1, rewardCode: 'reward_rank1_test' },
      { rankFrom: 1, rankTo: 3, rewardCode: 'reward_top3_test' },
    ],
  });

  const leaderboard = [
    { userId: firstId, score: 10 },
    { userId: secondId, score: 8 },
    { userId: thirdId, score: 7 },
  ];

  const firstGrant = await Contest.grantRankRewards(contest.id, leaderboard);
  const secondGrant = await Contest.grantRankRewards(contest.id, leaderboard);

  assert.equal(firstGrant.length, 4);
  assert.equal(secondGrant.length, 0);
  assert.equal(!!(await queryOne('SELECT 1 FROM contest_reward_grants WHERE contest_id=? AND user_id=? AND reward_code=?', [contest.id, firstId, 'reward_rank1_test'])), true);
  assert.equal(!!(await queryOne('SELECT 1 FROM contest_reward_grants WHERE contest_id=? AND user_id=? AND reward_code=?', [contest.id, firstId, 'reward_top3_test'])), true);
  assert.equal(!!(await queryOne('SELECT 1 FROM contest_reward_grants WHERE contest_id=? AND user_id=? AND reward_code=?', [contest.id, secondId, 'reward_top3_test'])), true);
  assert.equal(!!(await queryOne('SELECT 1 FROM contest_reward_grants WHERE contest_id=? AND user_id=? AND reward_code=?', [contest.id, thirdId, 'reward_top3_test'])), true);
});

test('contest uses default reward rules when no custom rule exists', async () => {
  await waitForDB();

  const hostId = await createUser('host-default');
  const contest = await Contest.create({
    name: 'Default Reward Contest',
    description: 'default rule test',
    durationMin: 45,
    privacy: 'public',
    joinType: 'direct',
    maxUsers: 20,
    hostId,
  });

  const effectiveRules = await Contest.getEffectiveRewardRules(contest.id);
  const codes = effectiveRules.map((rule) => rule.rewardCode);

  assert.equal(codes.includes('badge_contest1'), true);
  assert.equal(codes.includes('title_champion'), true);
  assert.equal(codes.includes('badge_contest2'), true);
  assert.equal(codes.includes('badge_contest3'), true);
});
