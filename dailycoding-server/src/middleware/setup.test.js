import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

const { resolveAllowedOrigins } = await import('./setup.js');

test('resolveAllowedOrigins requires explicit origins in production', () => {
  assert.throws(
    () => resolveAllowedOrigins({ NODE_ENV: 'production' }),
    /Missing required CORS env: ALLOWED_ORIGINS/
  );
});

test('resolveAllowedOrigins keeps local defaults outside production', () => {
  assert.deepEqual(resolveAllowedOrigins({ NODE_ENV: 'development' }), [
    'http://localhost:5173',
    'http://localhost:3000',
  ]);
});

test('resolveAllowedOrigins trims and removes empty entries', () => {
  assert.deepEqual(resolveAllowedOrigins({
    NODE_ENV: 'production',
    ALLOWED_ORIGINS: ' https://dailycoding.kr, ,https://www.dailycoding.kr ',
  }), ['https://dailycoding.kr', 'https://www.dailycoding.kr']);
});
