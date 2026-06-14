const DEFAULT_BASE_URL = 'https://dailycoding-final.com';

export function normalizeBaseUrl(value = DEFAULT_BASE_URL) {
  const trimmed = String(value || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
  return trimmed || DEFAULT_BASE_URL;
}

export function resolveSmokeTargets(baseUrl = DEFAULT_BASE_URL) {
  const normalized = normalizeBaseUrl(baseUrl);
  return {
    root: `${normalized}/`,
    health: `${normalized}/api/health`,
  };
}

export function assertHealthyPayload(payload) {
  if (!payload || payload.status !== 'ok') {
    throw new Error(`health status is not ok: ${payload?.status || 'missing'}`);
  }

  const services = payload.services || {};
  if (services.database !== 'connected') {
    throw new Error(`database health degraded: ${services.database || 'missing'}`);
  }
  if (services.redis !== 'connected') {
    throw new Error(`redis health degraded: ${services.redis || 'missing'}`);
  }
  if (services.judge !== 'docker') {
    throw new Error(`judge health degraded: ${services.judge || 'missing'}`);
  }

  return true;
}
