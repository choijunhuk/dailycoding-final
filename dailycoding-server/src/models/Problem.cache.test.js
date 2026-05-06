import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

test('invalidateProblemCaches clears stale problem detail and list caches', async () => {
  const { redis } = await import('../config/redis.js');
  const { invalidateProblemCaches } = await import('./Problem.js');
  const problemId = 970001;

  await redis.setJSON(`problems:${problemId}`, { stale: true });
  await redis.setJSON(`problems:list:user:7:1:10`, [{ id: problemId, isSolved: false }]);
  await redis.setJSON(`problem:detail:v3:user:${problemId}:7`, { isSolved: false });
  await redis.setJSON(`problem:detail:v3:admin:${problemId}:1`, { solved: 1 });

  await invalidateProblemCaches(problemId);

  assert.equal(await redis.getJSON(`problems:${problemId}`), null);
  assert.equal(await redis.getJSON(`problems:list:user:7:1:10`), null);
  assert.equal(await redis.getJSON(`problem:detail:v3:user:${problemId}:7`), null);
  assert.equal(await redis.getJSON(`problem:detail:v3:admin:${problemId}:1`), null);
});

test('invalidateProblemCaches can clear only one user detail cache for bookmark changes', async () => {
  const { redis } = await import('../config/redis.js');
  const { invalidateProblemCaches } = await import('./Problem.js');
  const problemId = 970002;

  await redis.setJSON(`problem:detail:v3:user:${problemId}:3`, { isBookmarked: false });
  await redis.setJSON(`problem:detail:v3:user:${problemId}:4`, { isBookmarked: true });
  await redis.setJSON(`problems:list:user:3:1:10`, [{ id: problemId, isBookmarked: false }]);

  await invalidateProblemCaches(problemId, { userId: 3 });

  assert.equal(await redis.getJSON(`problem:detail:v3:user:${problemId}:3`), null);
  assert.deepEqual(await redis.getJSON(`problem:detail:v3:user:${problemId}:4`), { isBookmarked: true });
  assert.equal(await redis.getJSON(`problems:list:user:3:1:10`), null);
});
