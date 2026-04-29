import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';
process.env.ADMIN_PASSWORD = 'admin-pass-1234';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_dummy';
process.env.STRIPE_PRO_MONTHLY_ID = 'price_pro_test';
process.env.STRIPE_PRO_ANNUAL_ID = 'price_pro_year';
process.env.STRIPE_TEAM_MONTHLY_ID = 'price_team_test';
process.env.STRIPE_TEAM_ANNUAL_ID = 'price_team_year';

const { waitForDB } = await import('../config/mysql.js');
const { default: subscriptionRouter } = await import('./subscription.js');
const { registerRoutes } = await import('./registry.js');

function getRouteHandlerFromRouter(router, path, method) {
  const layer = router.stack.find((entry) => entry.route?.path === path && entry.route?.methods[method]);
  return layer?.route?.stack?.[layer.route.stack.length - 1]?.handle || null;
}

function getAppRouteHandler(app, path, method) {
  const layer = app._router?.stack?.find((entry) => entry.route?.path === path && entry.route?.methods[method]);
  return layer?.route?.stack?.[layer.route.stack.length - 1]?.handle || null;
}

test('health handler reports billing mode and stripe ops handler returns admin-visible status', async () => {
  await waitForDB();

  const app = express();
  registerRoutes(app);

  const healthHandler = getAppRouteHandler(app, '/api/health', 'get');
  const opsHandler = getRouteHandlerFromRouter(subscriptionRouter, '/ops', 'get');

  assert.ok(healthHandler, 'health handler should exist');
  assert.ok(opsHandler, 'subscription ops handler should exist');

  const healthRes = {
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
  await healthHandler({}, healthRes);
  assert.equal(healthRes.payload?.services?.billing, 'stripe_session');

  const opsRes = {
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
  await opsHandler({ user: { id: 1 } }, opsRes);
  assert.equal(opsRes.payload?.mode, 'stripe_session');
  assert.equal(opsRes.payload?.configured, true);
  assert.equal(opsRes.payload?.webhookConfigured, true);
  assert.equal(opsRes.payload?.secretKeyConfigured, true);
});
