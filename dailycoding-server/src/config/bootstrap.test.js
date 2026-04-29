import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBootstrapConfig } from './bootstrap.js';

test('resolveBootstrapConfig requires explicit admin password in production', () => {
  const config = resolveBootstrapConfig({
    NODE_ENV: 'production',
    ENABLE_LOCAL_BOOTSTRAP: 'true',
  });

  assert.equal(config.isProduction, true);
  assert.equal(config.localBootstrapEnabled, false);
  assert.equal(config.primaryAdmin.password, null);
  assert.equal(config.localTestUser, null);
  assert.equal(config.warnings.missingPrimaryAdminPassword, true);
});

test('resolveBootstrapConfig enables deterministic local bootstrap defaults', () => {
  const config = resolveBootstrapConfig({
    NODE_ENV: 'development',
    ENABLE_LOCAL_BOOTSTRAP: 'true',
  });

  assert.equal(config.localBootstrapEnabled, true);
  assert.equal(config.primaryAdmin.email, 'admin@dailycoding.com');
  assert.equal(config.primaryAdmin.password, 'local-admin-1234');
  assert.deepEqual(config.localTestUser, {
    email: 'tester@dailycoding.local',
    username: 'LocalTester',
    password: 'local-tester-1234',
    role: 'user',
    tier: 'bronze',
    rating: 800,
  });
});

test('resolveBootstrapConfig honors explicit local overrides', () => {
  const config = resolveBootstrapConfig({
    NODE_ENV: 'development',
    ENABLE_LOCAL_BOOTSTRAP: 'true',
    ADMIN_PASSWORD: 'primary-secret',
    LOCAL_TEST_EMAIL: 'qa@example.com',
    LOCAL_TEST_USERNAME: 'QAUser',
    LOCAL_TEST_PASSWORD: 'qa-secret',
    LOCAL_TEST_RATING: '1325',
  });

  assert.equal(config.primaryAdmin.password, 'primary-secret');
  assert.deepEqual(config.localTestUser, {
    email: 'qa@example.com',
    username: 'QAUser',
    password: 'qa-secret',
    role: 'user',
    tier: 'bronze',
    rating: 1325,
  });
});
