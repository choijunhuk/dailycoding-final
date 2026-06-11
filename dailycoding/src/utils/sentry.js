let initialized = false;

export async function initSentry() {
  if (initialized) return;
  initialized = true;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  try {
    const Sentry = await import('@sentry/react');
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
      tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_RATE || 0.1),
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: Number(import.meta.env.VITE_SENTRY_REPLAYS_ERROR_RATE || 0),
    });
  } catch (err) {
    console.error('[sentry] init failed:', err.message);
  }
}
