import assert from 'node:assert/strict';
import test from 'node:test';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.GEMINI_MODEL = 'hint-cache-test-model';

function mockGenAI(handler) {
  return {
    getGenerativeModel({ model }) {
      return {
        generateContent: (prompt) => handler(model, prompt),
      };
    },
  };
}

async function postHint(baseUrl, token, problemId) {
  const response = await fetch(`${baseUrl}/api/ai/hint`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ problemId }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  return body;
}

function listenOnLoopback(app) {
  const server = app.listen(0, '127.0.0.1');
  return new Promise((resolve, reject) => {
    server.once('listening', () => resolve(server));
    server.once('error', reject);
  });
}

test('AI hints are persisted across users while preserving free quota charging', async (t) => {
  const [
    { createApp },
    { waitForDB, run },
    { User },
    { Problem },
    { makeToken },
    { default: redis },
    { __resetGenAIForTests, __setGenAIForTests },
    { AI_DAILY_QUOTA },
    { PROBLEMS },
  ] = await Promise.all([
    import('../app.js'),
    import('../config/mysql.js'),
    import('../models/User.js'),
    import('../models/Problem.js'),
    import('./auth/helpers.js'),
    import('../config/redis.js'),
    import('../services/ai.js'),
    import('../shared/constants.js'),
    import('../shared/problemCatalog.js'),
  ]);

  await waitForDB();
  await run('DELETE FROM ai_hint_cache');
  await redis.clearPrefix('ai:hint:');
  await redis.clearPrefix('quota:ai:');
  await redis.clearPrefix('auth:status:');

  const calls = [];
  __setGenAIForTests(mockGenAI(async (model) => {
    calls.push(model);
    return {
      response: {
        text: () => JSON.stringify({
          hint1: '첫 번째 캐시 힌트',
          hint2: '두 번째 캐시 힌트',
          hint3: '세 번째 캐시 힌트',
          commonMistake: '경계 조건 누락',
          relatedConcept: '동적 계획법',
        }),
      },
    };
  }));
  t.after(async () => {
    __resetGenAIForTests();
    await redis.clearPrefix('ai:hint:');
    await redis.clearPrefix('quota:ai:');
    await redis.clearPrefix('auth:status:');
  });

  const problem = await Problem.findById(PROBLEMS[0].id);
  assert.ok(problem?.id, 'seed problem should exist');

  const firstUser = await User.create({
    email: `hint-cache-1-${Date.now()}@example.com`,
    password: 'password',
    username: `hint_cache_1_${Date.now()}`,
  });
  await User.update(firstUser.id, { email_verified: 1 });

  const secondUser = await User.create({
    email: `hint-cache-2-${Date.now()}@example.com`,
    password: 'password',
    username: `hint_cache_2_${Date.now()}`,
  });
  await User.update(secondUser.id, { email_verified: 1 });

  const app = createApp();
  const server = await listenOnLoopback(app);
  t.after(() => server.close());
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const first = await postHint(baseUrl, makeToken(firstUser), problem.id);
  assert.equal(first.source, 'ai');
  assert.equal(first.remaining, AI_DAILY_QUOTA - 1);
  assert.deepEqual(calls, ['hint-cache-test-model']);

  await redis.del(`ai:hint:${problem.id}`);

  const second = await postHint(baseUrl, makeToken(secondUser), problem.id);
  assert.equal(second.source, 'db');
  assert.equal(second.hint1, '첫 번째 캐시 힌트');
  assert.equal(second.remaining, AI_DAILY_QUOTA - 1);
  assert.deepEqual(calls, ['hint-cache-test-model']);
});
