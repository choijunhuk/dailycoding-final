import { execFileSync } from 'node:child_process';

let initialized = false;
let SentryRef = null;

function resolveRelease() {
  if (process.env.SENTRY_RELEASE) return process.env.SENTRY_RELEASE;
  try {
    const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    if (sha) return `dailycoding-server@${sha}`;
  } catch {
    // not a git checkout (e.g. Docker copy without .git); skip
  }
  return undefined;
}

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
      release: resolveRelease(),
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

// Attach Sentry's Express integration to the app.
// @sentry/node v8+ exposes setupExpressErrorHandler; v7 had Handlers.requestHandler.
// We try both so this works regardless of which version resolves.
export function installSentryExpress(app) {
  if (!SentryRef) return;
  try {
    if (typeof SentryRef.setupExpressErrorHandler === 'function') {
      SentryRef.setupExpressErrorHandler(app);
      return;
    }
    if (SentryRef.Handlers?.requestHandler) {
      app.use(SentryRef.Handlers.requestHandler());
    }
    if (SentryRef.Handlers?.tracingHandler) {
      app.use(SentryRef.Handlers.tracingHandler());
    }
  } catch {
    // Sentry integration failed; ignore — observability must not break startup.
  }
}
