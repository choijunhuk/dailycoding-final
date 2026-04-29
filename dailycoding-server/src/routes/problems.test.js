import test from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';

// Force MySQL and Redis to use in-memory mode
process.env.DB_HOST = 'invalid_host';
process.env.REDIS_URL = 'redis://invalid:6379';
process.env.JWT_SECRET = 'test_secret';

import { run, insert, query, waitForDB } from '../config/mysql.js';
const { default: router } = await import('./problems.js');

// Helper to find the route handler in Express router
function getHandler(path, method) {
  const layer = router.stack.find(s => s.route?.path === path && s.route?.methods[method]);
  if (!layer) return null;
  // The last handler in the stack is the actual route handler (skipping middlewares like auth)
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

test('Premium Gating Tests', async (t) => {
  await waitForDB();

  // 1. Setup Mock Data
  // Create Users
  const freeUserId = await insert('INSERT INTO users (email, username, role, subscription_tier) VALUES (?,?,?,?)',
    ['free@test.com', 'FreeUser', 'user', 'free']);
  const proUserId = await insert('INSERT INTO users (email, username, role, subscription_tier) VALUES (?,?,?,?)',
    ['pro@test.com', 'ProUser', 'user', 'pro']);
  const adminUserId = await insert('INSERT INTO users (email, username, role, subscription_tier) VALUES (?,?,?,?)',
    ['admin@test.com', 'AdminUser', 'admin', 'free']);

  // Create Problems
  const freeProblemId = await insert('INSERT INTO problems (title, is_premium, author_id, visibility) VALUES (?,?,?,?)',
    ['Free Problem', 0, adminUserId, 'global']);
  const premiumProblemId = await insert('INSERT INTO problems (title, is_premium, author_id, visibility) VALUES (?,?,?,?)',
    ['Premium Problem', 1, adminUserId, 'global']);

  const handler = getHandler('/:id', 'get');

  await t.test('Free user can access free problem', async () => {
    const req = { params: { id: String(freeProblemId) }, user: { id: freeUserId } };
    const res = {
      status: mock.fn(() => res),
      json: mock.fn(() => res)
    };
    await handler(req, res);

    assert.equal(res.status.mock.calls.length, 0);
    assert.equal(res.json.mock.calls.length, 1);
    assert.equal(res.json.mock.calls[0].arguments[0].id, freeProblemId);
  });

  await t.test('Free user is blocked from premium problem', async () => {
    const req = { params: { id: String(premiumProblemId) }, user: { id: freeUserId } };
    const res = {
      status: mock.fn(() => res),
      json: mock.fn(() => res)
    };
    await handler(req, res);

    assert.equal(res.status.mock.calls.length, 1);
    assert.equal(res.status.mock.calls[0].arguments[0], 403);
    assert.equal(res.json.mock.calls[0].arguments[0].isPremium, true);
  });

  await t.test('Pro user can access premium problem', async () => {
    const req = { params: { id: String(premiumProblemId) }, user: { id: proUserId } };
    const res = {
      status: mock.fn(() => res),
      json: mock.fn(() => res)
    };
    await handler(req, res);

    assert.equal(res.status.mock.calls.length, 0);
    assert.equal(res.json.mock.calls.length, 1);
    assert.equal(res.json.mock.calls[0].arguments[0].id, premiumProblemId);
  });

  await t.test('Admin can access premium problem even without pro tier', async () => {
    const req = { params: { id: String(premiumProblemId) }, user: { id: adminUserId } };
    const res = {
      status: mock.fn(() => res),
      json: mock.fn(() => res)
    };
    await handler(req, res);

    assert.equal(res.status.mock.calls.length, 0);
    assert.equal(res.json.mock.calls.length, 1);
    assert.equal(res.json.mock.calls[0].arguments[0].id, premiumProblemId);
  });
});
