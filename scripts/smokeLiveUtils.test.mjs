import test from 'node:test';
import assert from 'node:assert/strict';
import { assertHealthyPayload, normalizeBaseUrl, resolveSmokeTargets } from './smokeLiveUtils.mjs';

test('normalizeBaseUrl trims slashes and defaults to production', () => {
  assert.equal(normalizeBaseUrl('https://example.com///'), 'https://example.com');
  assert.equal(normalizeBaseUrl(''), 'https://dailycoding-final.com');
});

test('resolveSmokeTargets builds root and health URLs', () => {
  const targets = resolveSmokeTargets('https://dailycoding-final.com/');

  assert.equal(targets.root, 'https://dailycoding-final.com/');
  assert.equal(targets.health, 'https://dailycoding-final.com/api/health');
});

test('assertHealthyPayload accepts fully healthy production services', () => {
  const payload = {
    status: 'ok',
    services: {
      database: 'connected',
      redis: 'connected',
      judge: 'docker',
      billing: 'stripe_session',
    },
  };

  assert.doesNotThrow(() => assertHealthyPayload(payload));
});

test('assertHealthyPayload rejects degraded judge runtime', () => {
  assert.throws(
    () => assertHealthyPayload({ status: 'ok', services: { database: 'connected', redis: 'connected', judge: 'native' } }),
    /judge/
  );
});
