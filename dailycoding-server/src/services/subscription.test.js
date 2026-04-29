import test from 'node:test';
import assert from 'node:assert/strict';

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.STRIPE_PRO_MONTHLY_ID = 'price_pro_test';
process.env.STRIPE_TEAM_MONTHLY_ID = 'price_team_test';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_dummy';
process.env.JWT_SECRET = 'jwt_test_dummy';

const { buildCheckoutLink, getStripeConfigError, summarizeStripeConfig, tierFromPriceId } = await import('../routes/subscription.js');

test('tierFromPriceId returns null for unknown prices', () => {
  assert.equal(tierFromPriceId('price_pro_test'), 'pro');
  assert.equal(tierFromPriceId('price_team_test'), 'team');
  assert.equal(tierFromPriceId('price_unknown'), null);
});

test('getStripeConfigError requires webhook secret only for webhook mode', () => {
  assert.equal(getStripeConfigError({
    env: {
      STRIPE_SECRET_KEY: 'sk',
      STRIPE_PRO_MONTHLY_ID: 'pro',
      STRIPE_TEAM_MONTHLY_ID: 'team',
      FRONTEND_URL: 'http://localhost:5173',
    },
  }), null);

  assert.equal(getStripeConfigError({
    requireWebhook: true,
    env: {
      STRIPE_SECRET_KEY: 'sk',
      STRIPE_PRO_MONTHLY_ID: 'pro',
      STRIPE_TEAM_MONTHLY_ID: 'team',
      FRONTEND_URL: 'http://localhost:5173',
    },
  }), 'Stripe 웹훅 시크릿이 설정되지 않았습니다.');
});

test('buildCheckoutLink appends user context for payment link fallback', () => {
  const link = buildCheckoutLink('https://buy.stripe.com/test_link', { id: 3, email: 'qa@example.com' });
  assert.ok(link.includes('client_reference_id=3'));
  assert.ok(link.includes('prefilled_email=qa%40example.com'));
  assert.ok(link.includes('locale=ko'));
});

test('summarizeStripeConfig reports stripe session mode when keys are present', () => {
  const summary = summarizeStripeConfig({
    STRIPE_SECRET_KEY: 'sk',
    STRIPE_WEBHOOK_SECRET: 'whsec',
    STRIPE_PRO_MONTHLY_ID: 'price_pro_m',
    STRIPE_PRO_ANNUAL_ID: 'price_pro_y',
    STRIPE_TEAM_MONTHLY_ID: 'price_team_m',
    STRIPE_TEAM_ANNUAL_ID: 'price_team_y',
    FRONTEND_URL: 'http://localhost:5173',
  });

  assert.equal(summary.mode, 'stripe_session');
  assert.equal(summary.configured, true);
  assert.equal(summary.webhookConfigured, true);
  assert.equal(summary.plans.pro.monthlyPriceId, true);
  assert.equal(summary.plans.team.annualPriceId, true);
});

test('summarizeStripeConfig falls back to payment links when secret is missing', () => {
  const summary = summarizeStripeConfig({
    STRIPE_PRO_MONTHLY_URL: 'https://buy.stripe.com/test_link',
    STRIPE_TEAM_MONTHLY_URL: 'https://buy.stripe.com/test_link_team',
    FRONTEND_URL: 'http://localhost:5173',
  });

  assert.equal(summary.mode, 'payment_link');
  assert.equal(summary.configured, true);
  assert.equal(summary.secretKeyConfigured, false);
});
