import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

test('resolveMysqlConfig fails fast when production database env is incomplete', async () => {
  const { resolveMysqlConfig } = await import('./mysql.js');

  assert.throws(
    () => resolveMysqlConfig({ NODE_ENV: 'production', DB_HOST: 'mysql', DB_NAME: 'dailycoding', DB_USER: 'dcuser' }),
    /Missing required MySQL env: DB_PASS/
  );
});

test('resolveMysqlConfig keeps development defaults for local setup', async () => {
  const { resolveMysqlConfig } = await import('./mysql.js');
  const config = resolveMysqlConfig({ NODE_ENV: 'development' });

  assert.equal(config.host, 'localhost');
  assert.equal(config.database, 'dailycoding');
  assert.equal(config.user, 'dcuser');
});

test('resolveRedisUrl requires explicit Redis URL in production', async () => {
  const { resolveRedisUrl } = await import('./redis.js');

  assert.throws(
    () => resolveRedisUrl({ NODE_ENV: 'production' }),
    /Missing required Redis env: REDIS_URL/
  );
});

test('resolveRedisUrl keeps development fallback for local setup', async () => {
  const { resolveRedisUrl } = await import('./redis.js');

  assert.equal(resolveRedisUrl({ NODE_ENV: 'development' }), 'redis://:redis1234@localhost:6379');
});
