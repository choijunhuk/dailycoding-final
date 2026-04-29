import test from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import redis from '../config/redis.js';
import {
  rateLimit,
  __getFallbackSizeForTests,
  __resetFallbackForTests,
  __setFallbackMaxSizeForTests,
} from './rateLimit.js';

function createResponse() {
  const headers = {};
  const res = {
    headers,
    setHeader: mock.fn((key, value) => {
      headers[key] = value;
    }),
    status: mock.fn(() => res),
    json: mock.fn(() => res),
  };
  return res;
}

test('rateLimit exposes standard headers and blocks with Retry-After metadata', async (t) => {
  const originalIncr = redis.incr;
  const originalTtl = redis.ttl;

  let counter = 0;
  redis.incr = async () => {
    counter += 1;
    return counter;
  };
  redis.ttl = async () => 42;

  t.after(() => {
    redis.incr = originalIncr;
    redis.ttl = originalTtl;
  });

  const limiter = rateLimit(2, 60);
  const req = { ip: '127.0.0.1', method: 'GET', originalUrl: '/api/problems?page=1' };

  const okRes = createResponse();
  const next = mock.fn();
  await limiter(req, okRes, next);

  assert.equal(next.mock.calls.length, 1);
  assert.equal(okRes.headers['RateLimit-Policy'], '2;w=60');
  assert.equal(okRes.headers['RateLimit-Limit'], '2');
  assert.equal(okRes.headers['RateLimit-Remaining'], '1');
  assert.equal(okRes.headers['RateLimit-Reset'], '42');

  await limiter(req, createResponse(), mock.fn());

  const blockedRes = createResponse();
  await limiter(req, blockedRes, mock.fn());

  assert.equal(blockedRes.status.mock.calls[0].arguments[0], 429);
  assert.equal(blockedRes.headers['Retry-After'], '42');
  assert.equal(blockedRes.headers['Cache-Control'], 'no-store');
  assert.equal(blockedRes.json.mock.calls[0].arguments[0].retryAfter, 42);
});

test('rateLimit fallback map stays bounded when Redis is unavailable', async (t) => {
  const originalIncr = redis.incr;
  const originalTtl = redis.ttl;

  redis.incr = async () => {
    throw new Error('redis unavailable');
  };
  redis.ttl = async () => -2;
  __resetFallbackForTests();
  __setFallbackMaxSizeForTests(2);

  t.after(() => {
    redis.incr = originalIncr;
    redis.ttl = originalTtl;
    __resetFallbackForTests();
  });

  const limiter = rateLimit(10, 60);
  await limiter({ ip: '10.0.0.1', method: 'GET', originalUrl: '/api/a' }, createResponse(), mock.fn());
  await limiter({ ip: '10.0.0.2', method: 'GET', originalUrl: '/api/b' }, createResponse(), mock.fn());
  await limiter({ ip: '10.0.0.3', method: 'GET', originalUrl: '/api/c' }, createResponse(), mock.fn());

  assert.equal(__getFallbackSizeForTests(), 2);
});
