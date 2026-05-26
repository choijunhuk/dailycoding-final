import axios from 'axios';

const AUTH_EXPIRED_EVENT = 'dc:auth-expired';
const SESSION_MARKER_KEY = 'dc_session';

export function markSessionActive() {
  localStorage.setItem(SESSION_MARKER_KEY, '1');
}

export function clearSessionMarker() {
  localStorage.removeItem(SESSION_MARKER_KEY);
}

export function hasSessionMarker() {
  return localStorage.getItem(SESSION_MARKER_KEY) === '1';
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  timeout: 30000,
  withCredentials: true,
  headers: { 'ngrok-skip-browser-warning': 'true' },
});

api.interceptors.request.use((config) => {
  const lang = localStorage.getItem('dc_lang') || 'ko';
  config.headers = config.headers || {};
  config.headers['X-Language'] = lang;
  config.headers['Accept-Language'] = lang === 'ko' ? 'ko-KR,ko;q=0.9,en;q=0.8' : 'en-US,en;q=0.9,ko;q=0.8';
  return config;
});

// 401 시 refresh token으로 자동 재발급 — 실패 시에만 로그아웃
let isRefreshing = false;
let failedQueue = [];

function processQueue(error) {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve());
  failedQueue = [];
}

function forceLogout(message) {
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (!currentPath.startsWith('/login')) {
    sessionStorage.setItem('postLoginRedirect', currentPath);
  }
  clearSessionMarker();
  const isKo = (localStorage.getItem('dc_lang') || 'ko') === 'ko';
  const defaultMsg = isKo ? '세션이 만료되었습니다. 다시 로그인해 주세요.' : 'Your session has expired. Please log in again.';
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, {
    detail: { message: message || defaultMsg, path: currentPath },
  }));
}

api.interceptors.response.use(
  res => res,
  async err => {
    const originalRequest = err.config;
    const requestUrl = String(err?.config?.url || '');
    const shouldAttemptRefresh = hasSessionMarker();
    const isAuthRequest = [
      '/auth/login', '/auth/register', '/auth/forgot-password',
      '/auth/reset-password', '/auth/verify-email', '/auth/refresh',
    ].some(path => requestUrl.includes(path));

    if (err?.response?.status === 429) {
      const retryAfter = err.response.headers?.['retry-after'];
      const code = err.response.data?.code;

      if (code !== 'QUOTA_EXCEEDED') {
        const sec = retryAfter ? parseInt(retryAfter, 10) : null;
        const isKo = (localStorage.getItem('dc_lang') || 'ko') === 'ko';
        const message = sec
          ? (isKo ? `요청이 너무 많습니다. ${sec}초 후 다시 시도해주세요.` : `Too many requests. Please try again in ${sec}s.`)
          : (isKo ? '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' : 'Too many requests. Please try again later.');
        window.dispatchEvent(new CustomEvent('dc:toast', {
          detail: { message, type: 'error' },
        }));
      }
    }

    if (err?.response?.status === 401 && shouldAttemptRefresh && !isAuthRequest && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
          .then(() => api(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await api.post('/auth/refresh');
        markSessionActive();
        processQueue(null);
        return api(originalRequest);
      } catch {
        processQueue(new Error('refresh failed'));
        forceLogout('Your session has expired. Please log in again.');
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

export default api;
export { AUTH_EXPIRED_EVENT };
