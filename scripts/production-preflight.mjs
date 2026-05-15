import { existsSync, readFileSync } from 'fs';

const serverEnvPath = process.argv[2] || 'dailycoding-server/.env';
const frontendEnvPath = process.argv[3] || 'dailycoding/.env.production';

function parseEnvFile(path) {
  if (!existsSync(path)) return { path, exists: false, values: {} };
  const values = {};
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return { path, exists: true, values };
}

function isPlaceholder(value) {
  return /your_|change_me|example\.com|랜덤|강한_|운영_|구글_|비밀번호|키/i.test(String(value || ''));
}

function isHttpsUrl(value) {
  return /^https:\/\/[^/\s]+/i.test(String(value || ''));
}

function requireValue(report, values, key, { minLength = 1, noPlaceholder = true } = {}) {
  const value = values[key];
  if (!value) {
    report.errors.push(`${key} is required`);
    return;
  }
  if (String(value).length < minLength) report.errors.push(`${key} must be at least ${minLength} characters`);
  if (noPlaceholder && isPlaceholder(value)) report.errors.push(`${key} still looks like a placeholder`);
}

function checkNoLocalhost(report, values, key) {
  const value = values[key];
  if (value && /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(value)) {
    report.errors.push(`${key} must not use localhost in production`);
  }
}

function checkServerEnv(server) {
  const report = { errors: [], warnings: [] };
  const values = server.values;

  if (!server.exists) {
    report.errors.push(`missing server env file: ${server.path}`);
    return report;
  }

  if (values.NODE_ENV !== 'production') report.errors.push('NODE_ENV must be production');
  requireValue(report, values, 'JWT_SECRET', { minLength: 32 });
  requireValue(report, values, 'ADMIN_PASSWORD', { minLength: 12 });
  requireValue(report, values, 'DB_HOST');
  requireValue(report, values, 'DB_NAME');
  requireValue(report, values, 'DB_USER');
  requireValue(report, values, 'DB_PASS', { minLength: 12 });
  requireValue(report, values, 'REDIS_URL');
  requireValue(report, values, 'FRONTEND_URL');
  requireValue(report, values, 'ALLOWED_ORIGINS');
  requireValue(report, values, 'SMTP_HOST');
  requireValue(report, values, 'SMTP_USER');
  requireValue(report, values, 'SMTP_PASS', { minLength: 8 });

  if (!isHttpsUrl(values.FRONTEND_URL)) report.errors.push('FRONTEND_URL must be https in production');
  checkNoLocalhost(report, values, 'FRONTEND_URL');
  checkNoLocalhost(report, values, 'ALLOWED_ORIGINS');
  checkNoLocalhost(report, values, 'REDIS_URL');

  if (values.JUDGE_MODE !== 'docker') {
    report.errors.push('JUDGE_MODE should be docker for production sandbox isolation');
  }

  const hasStripeSecret = Boolean(values.STRIPE_SECRET_KEY);
  const hasStripePrices = ['STRIPE_PRO_MONTHLY_ID', 'STRIPE_PRO_ANNUAL_ID', 'STRIPE_TEAM_MONTHLY_ID', 'STRIPE_TEAM_ANNUAL_ID']
    .every((key) => Boolean(values[key]));
  const hasStripeLinks = ['STRIPE_PRO_MONTHLY_URL', 'STRIPE_PRO_ANNUAL_URL', 'STRIPE_TEAM_MONTHLY_URL', 'STRIPE_TEAM_ANNUAL_URL']
    .every((key) => Boolean(values[key]));
  if (!hasStripeSecret && !hasStripeLinks) {
    report.warnings.push('Stripe is not configured; billing will be unavailable');
  }
  if (hasStripeSecret && !hasStripePrices) {
    report.errors.push('STRIPE_SECRET_KEY requires all Stripe price ids');
  }
  for (const key of Object.keys(values).filter((name) => name.startsWith('STRIPE_') && name.endsWith('_URL'))) {
    if (/\/test_|buy\.stripe\.com\/test/i.test(values[key])) {
      report.errors.push(`${key} still points at a test payment link`);
    }
  }

  if (values.AUTH_COOKIE_SAMESITE === 'None' && !values.AUTH_COOKIE_DOMAIN) {
    report.warnings.push('AUTH_COOKIE_SAMESITE=None usually needs AUTH_COOKIE_DOMAIN for subdomain deployments');
  }

  return report;
}

function checkFrontendEnv(frontend, serverValues) {
  const report = { errors: [], warnings: [] };
  const values = frontend.values;

  if (!frontend.exists) {
    report.errors.push(`missing frontend env file: ${frontend.path}`);
    return report;
  }

  requireValue(report, values, 'VITE_API_URL');
  if (!isHttpsUrl(values.VITE_API_URL)) report.errors.push('VITE_API_URL must be https in production');
  checkNoLocalhost(report, values, 'VITE_API_URL');

  if (serverValues.ALLOWED_ORIGINS && values.VITE_API_URL) {
    const frontendOrigin = serverValues.FRONTEND_URL;
    if (frontendOrigin && !serverValues.ALLOWED_ORIGINS.split(',').map((value) => value.trim()).includes(frontendOrigin)) {
      report.errors.push('ALLOWED_ORIGINS must include FRONTEND_URL');
    }
  }

  return report;
}

function printReport(label, report) {
  for (const error of report.errors) console.error(`[${label}] ERROR ${error}`);
  for (const warning of report.warnings) console.warn(`[${label}] WARN ${warning}`);
}

const server = parseEnvFile(serverEnvPath);
const frontend = parseEnvFile(frontendEnvPath);
const serverReport = checkServerEnv(server);
const frontendReport = checkFrontendEnv(frontend, server.values);

printReport('server', serverReport);
printReport('frontend', frontendReport);

const errorCount = serverReport.errors.length + frontendReport.errors.length;
const warningCount = serverReport.warnings.length + frontendReport.warnings.length;

if (errorCount > 0) {
  console.error(`Production preflight failed: ${errorCount} error(s), ${warningCount} warning(s)`);
  process.exit(1);
}

console.log(`Production preflight passed: ${warningCount} warning(s)`);
