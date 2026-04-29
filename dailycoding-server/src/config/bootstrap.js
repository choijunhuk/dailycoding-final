const DEFAULT_LOCAL_ADMIN_PASSWORD = 'local-admin-1234';
const DEFAULT_LOCAL_TEST_PASSWORD = 'local-tester-1234';
const DEFAULT_LOCAL_TEST_EMAIL = 'tester@dailycoding.local';
const DEFAULT_LOCAL_TEST_USERNAME = 'LocalTester';

function readEnvText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isEnabled(value) {
  return ['1', 'true', 'yes', 'on'].includes(readEnvText(value).toLowerCase());
}

export function resolveBootstrapConfig(env = process.env) {
  const isProduction = readEnvText(env.NODE_ENV) === 'production';
  const localBootstrapEnabled = !isProduction && isEnabled(env.ENABLE_LOCAL_BOOTSTRAP);
  const explicitAdminPassword = readEnvText(env.ADMIN_PASSWORD);
  const localAdminPassword = readEnvText(env.LOCAL_ADMIN_PASSWORD) || DEFAULT_LOCAL_ADMIN_PASSWORD;
  const adminPassword = explicitAdminPassword || (localBootstrapEnabled ? localAdminPassword : '');

  const localTestRating = Number.parseInt(readEnvText(env.LOCAL_TEST_RATING), 10);

  return {
    isProduction,
    localBootstrapEnabled,
    primaryAdmin: {
      email: 'admin@dailycoding.com',
      username: 'Admin',
      password: adminPassword || null,
    },
    localTestUser: localBootstrapEnabled
      ? {
          email: readEnvText(env.LOCAL_TEST_EMAIL) || DEFAULT_LOCAL_TEST_EMAIL,
          username: readEnvText(env.LOCAL_TEST_USERNAME) || DEFAULT_LOCAL_TEST_USERNAME,
          password: readEnvText(env.LOCAL_TEST_PASSWORD) || DEFAULT_LOCAL_TEST_PASSWORD,
          role: 'user',
          tier: 'bronze',
          rating: Number.isFinite(localTestRating) ? localTestRating : 800,
        }
      : null,
    warnings: {
      missingPrimaryAdminPassword: !adminPassword,
    },
  };
}
