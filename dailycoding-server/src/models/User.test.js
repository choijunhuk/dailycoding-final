import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

test('tier calculation keeps low positive ratings in iron and out of challenger', async () => {
  const { User } = await import('./User.js');

  assert.equal(User.calcTier(0), 'unranked');
  assert.equal(User.calcTier(20), 'iron');
  assert.equal(User.calcTier(16000), 'grandmaster');
});

test('first positive rating places unranked users into a real tier immediately', async () => {
  const { User } = await import('./User.js');
  const { insert, queryOne, waitForDB } = await import('../config/mysql.js');

  await waitForDB();
  const suffix = Date.now();
  const userId = await insert(
    'INSERT INTO users (email, username, role, rating, tier, solved_count) VALUES (?,?,?,?,?,?)',
    [`placement-${suffix}@test.com`, `placement-${suffix}`, 'user', 0, 'unranked', 0]
  );
  const problemId = await insert(
    'INSERT INTO problems (title, problem_type, tier, difficulty, description, visibility) VALUES (?,?,?,?,?,?)',
    [`Placement ${suffix}`, 'coding', 'bronze', 3, 'placement test', 'global']
  );

  await User.onSolve(userId, {
    id: problemId,
    title: `Placement ${suffix}`,
    tier: 'bronze',
    difficulty: 3,
    problemType: 'coding',
  });

  const user = await queryOne('SELECT rating, tier FROM users WHERE id = ?', [userId]);
  const activePromotion = await queryOne(
    'SELECT id FROM promotion_series WHERE user_id = ? AND status = ?',
    [userId, 'in_progress']
  );

  assert.equal(user.rating, User.tierPoints('bronze'));
  assert.equal(user.tier, 'iron');
  assert.equal(activePromotion, null);
});

test('calcRatingFromTop100 hydrates before adding a new problem when the cache is missing', async (t) => {
  const { User } = await import('./User.js');
  const { redis } = await import('../config/redis.js');

  const originalGetSolvedCodingProblems = User.getSolvedCodingProblems;
  const originalExists = redis.exists;
  const originalZAddMany = redis.zAddMany;
  const originalExpire = redis.expire;
  const originalZAdd = redis.zAdd;
  const originalZRevRangeWithScores = redis.zRevRangeWithScores;

  const calls = [];

  User.getSolvedCodingProblems = async () => {
    calls.push('query');
    return [{ id: 101, tier: 'gold', difficulty: 4 }];
  };
  redis.exists = async () => {
    calls.push('exists');
    return 0;
  };
  redis.zAddMany = async () => {
    calls.push('zAddMany');
  };
  redis.expire = async () => {
    calls.push('expire');
  };
  redis.zAdd = async () => {
    calls.push('zAdd');
  };
  redis.zRevRangeWithScores = async () => {
    calls.push('zRevRangeWithScores');
    return [{ score: 4004, value: '101' }];
  };

  t.after(() => {
    User.getSolvedCodingProblems = originalGetSolvedCodingProblems;
    redis.exists = originalExists;
    redis.zAddMany = originalZAddMany;
    redis.expire = originalExpire;
    redis.zAdd = originalZAdd;
    redis.zRevRangeWithScores = originalZRevRangeWithScores;
  });

  const rating = await User.calcRatingFromTop100(1, {
    id: 101,
    tier: 'gold',
    difficulty: 4,
    problemType: 'coding',
  });

  assert.equal(rating, User.tierPoints('gold'));
  assert.deepEqual(calls, [
    'exists',
    'query',
    'zAddMany',
    'expire',
    'zAdd',
    'expire',
    'zRevRangeWithScores',
  ]);
});

test('syncChallengerTiers demotes low-rating challengers on small leaderboards', async () => {
  const { User } = await import('./User.js');
  const { insert, queryOne, waitForDB } = await import('../config/mysql.js');

  await waitForDB();
  const suffix = Date.now();
  const lowId = await insert(
    'INSERT INTO users (email, username, role, rating, tier, solved_count) VALUES (?,?,?,?,?,?)',
    [`low-${suffix}@test.com`, `low-${suffix}`, 'user', 20, 'challenger', 1]
  );
  await insert(
    'INSERT INTO users (email, username, role, rating, tier, solved_count) VALUES (?,?,?,?,?,?)',
    [`high-${suffix}@test.com`, `high-${suffix}`, 'user', 17000, 'grandmaster', 100]
  );

  await User.syncChallengerTiers();

  const lowUser = await queryOne('SELECT tier FROM users WHERE id = ?', [lowId]);
  assert.equal(lowUser.tier, 'iron');
});
