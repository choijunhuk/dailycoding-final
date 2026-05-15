import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

const { resolveEmailConfig } = await import('./email.js');

test('resolveEmailConfig fails fast in production when SMTP is incomplete', () => {
  assert.throws(
    () => resolveEmailConfig({ NODE_ENV: 'production', FRONTEND_URL: 'https://dailycoding.kr' }),
    /Missing required email env: SMTP_HOST, SMTP_USER, SMTP_PASS/
  );
});

test('resolveEmailConfig requires frontend URL in production', () => {
  assert.throws(
    () => resolveEmailConfig({
      NODE_ENV: 'production',
      SMTP_HOST: 'smtp.example.com',
      SMTP_USER: 'mailer',
      SMTP_PASS: 'secret',
    }),
    /Missing required email env: FRONTEND_URL/
  );
});

test('resolveEmailConfig keeps local console-email fallback outside production', () => {
  const config = resolveEmailConfig({ NODE_ENV: 'development' });

  assert.equal(config.configured, false);
  assert.equal(config.frontendUrl, 'http://localhost:5173');
});
