import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-auth-helper-tests';

const { getCookieBaseOptions } = await import('./helpers.js');

test('auth cookies default to secure Lax cookies in production', () => {
  const options = getCookieBaseOptions({ NODE_ENV: 'production' });

  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, 'Lax');
  assert.equal(options.path, '/');
});

test('auth cookies support cross-site deployment when explicitly configured', () => {
  const options = getCookieBaseOptions({
    NODE_ENV: 'production',
    AUTH_COOKIE_SAMESITE: 'none',
    AUTH_COOKIE_DOMAIN: '.dailycoding.kr',
  });

  assert.equal(options.secure, true);
  assert.equal(options.sameSite, 'None');
  assert.equal(options.domain, '.dailycoding.kr');
});
