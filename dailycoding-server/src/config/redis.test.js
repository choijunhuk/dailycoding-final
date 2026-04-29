import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

test('zAdd applies TTL only when explicitly provided in connected mode', async (t) => {
  const { redis, __setRedisClientForTests } = await import('./redis.js');
  const calls = [];
  const mockClient = {
    async zAdd(key, members) {
      calls.push(['zAdd', key, members]);
      return 1;
    },
    async expire(key, ttlSec) {
      calls.push(['expire', key, ttlSec]);
      return 1;
    },
  };

  __setRedisClientForTests(mockClient, true);
  t.after(() => __setRedisClientForTests(null, false));

  await redis.zAdd('scores', 10, 7);
  await redis.zAdd('scores', 20, 8, 60);

  assert.deepEqual(calls, [
    ['zAdd', 'scores', [{ score: 10, value: '7' }]],
    ['zAdd', 'scores', [{ score: 20, value: '8' }]],
    ['expire', 'scores', 60],
  ]);
});
