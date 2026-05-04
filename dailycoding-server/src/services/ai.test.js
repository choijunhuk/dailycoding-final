import assert from 'node:assert/strict';
import test from 'node:test';
import { askAIWithMeta, getAIServiceStatus, __getModelCandidatesForTests, __resetGenAIForTests, __setGenAIForTests } from './ai.js';
import redis from '../config/redis.js';

function mockGenAI(handler) {
  return {
    getGenerativeModel({ model }) {
      return {
        generateContent: (prompt) => handler(model, prompt),
      };
    },
  };
}

test.afterEach(async () => {
  delete process.env.GEMINI_MODEL;
  delete process.env.GEMINI_FALLBACK_MODELS;
  __resetGenAIForTests();
  await redis.del('ai:cooldown:provider');
  await redis.del('ai:cooldown:test-user');
  await redis.del('ai:cooldown:quota-user');
  await redis.del(`ai:metrics:${new Date().toISOString().slice(0, 10)}`);
  await redis.del('ai:metrics:last');
});

test('getAIServiceStatus exposes redacted operational metrics', async () => {
  process.env.GEMINI_MODEL = 'status-model';
  __setGenAIForTests(mockGenAI(async (model) => {
    return { response: { text: () => JSON.stringify({ ok: true, model }) } };
  }));

  await askAIWithMeta('status-user', 'prompt', { ok: false }, 20);
  const status = await getAIServiceStatus();

  assert.equal(status.primaryModel, 'status-model');
  assert.equal(status.metricsToday.success, 1);
  assert.equal(status.metricsToday.providerCalls, 1);
  assert.equal(status.lastEvent.source, 'ai');
  assert.equal(status.lastEvent.model, 'status-model');
  assert.equal(Object.hasOwn(status, 'apiKey'), false);
});

test('AI model candidates prefer env models and keep defaults as fallback', () => {
  process.env.GEMINI_MODEL = 'custom-primary';
  process.env.GEMINI_FALLBACK_MODELS = 'custom-secondary, gemini-2.0-flash';

  assert.deepEqual(__getModelCandidatesForTests(), [
    'custom-primary',
    'custom-secondary',
    'gemini-2.0-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.0-flash-lite',
  ]);
});

test('askAIWithMeta retries the next model after a quota failure', async () => {
  process.env.GEMINI_MODEL = 'quota-model';
  process.env.GEMINI_FALLBACK_MODELS = 'working-model';
  const calls = [];
  __setGenAIForTests(mockGenAI(async (model) => {
    calls.push(model);
    if (model === 'quota-model') throw new Error('429 quota exceeded');
    return { response: { text: () => JSON.stringify({ ok: true, model }) } };
  }));

  const result = await askAIWithMeta('test-user', 'prompt', { ok: false }, 20);

  assert.equal(result.source, 'ai');
  assert.equal(result.model, 'working-model');
  assert.deepEqual(result.data, { ok: true, model: 'working-model' });
  assert.deepEqual(calls, ['quota-model', 'working-model']);
});

test('askAIWithMeta returns fallback and opens cooldown after all models hit quota', async () => {
  process.env.GEMINI_MODEL = 'quota-a';
  process.env.GEMINI_FALLBACK_MODELS = 'quota-b';
  __setGenAIForTests(mockGenAI(async () => {
    throw new Error('429 RESOURCE_EXHAUSTED quota exceeded');
  }));

  const result = await askAIWithMeta('quota-user', 'prompt', { fallback: true }, 20);

  assert.equal(result.source, 'fallback');
  assert.equal(result.reason, 'quota_exceeded');
  assert.deepEqual(result.data, { fallback: true });
  assert.equal(await redis.get('ai:cooldown:provider'), '1');
});
