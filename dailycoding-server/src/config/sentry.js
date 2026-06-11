let initialized = false;
let SentryRef = null;

export async function initSentry() {
  if (initialized) return SentryRef;
  initialized = true;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return null;
  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.SENTRY_RELEASE || undefined,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_RATE || 0.1),
      profilesSampleRate: Number(process.env.SENTRY_PROFILES_RATE || 0),
    });
    SentryRef = Sentry;
    return Sentry;
  } catch (err) {
    console.error('[sentry] init failed:', err.message);
    return null;
  }
}

export function getSentry() {
  return SentryRef;
}

export function captureException(err, context) {
  if (!SentryRef) return;
  try {
    SentryRef.captureException(err, context ? { extra: context } : undefined);
  } catch {
    // never let observability break the app
  }
}

export function expressErrorHandler() {
  if (!SentryRef) return (err, req, res, next) => next(err);
  return SentryRef.Handlers?.errorHandler?.() || ((err, req, res, next) => {
    SentryRef.captureException(err);
    next(err);
  });
}
