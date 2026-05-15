import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getInternalRedirectPath,
  resolvePostLoginRedirect,
} from './redirects.js';

const origin = 'https://dailycoding.example';

test('getInternalRedirectPath preserves same-origin redirects', () => {
  assert.equal(getInternalRedirectPath('/pricing?plan=pro#checkout', origin), '/pricing?plan=pro#checkout');
  assert.equal(getInternalRedirectPath(`${origin}/problems/12`, origin), '/problems/12');
});

test('getInternalRedirectPath rejects external and script redirects', () => {
  assert.equal(getInternalRedirectPath('https://evil.example/phish', origin), null);
  assert.equal(getInternalRedirectPath('//evil.example/phish', origin), null);
  assert.equal(getInternalRedirectPath('javascript:alert(1)', origin), null);
});

test('resolvePostLoginRedirect falls back instead of using rejected redirects', () => {
  assert.equal(resolvePostLoginRedirect('https://evil.example/phish', '/'), '/');
});
