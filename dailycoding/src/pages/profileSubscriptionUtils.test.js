import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAN_META } from '../data/pricingPlans.js';
import { buildPaymentFeedback, formatCurrentSubscriptionLabel, getProfileUpgradePlans } from './profileSubscriptionUtils.js';

test('buildPaymentFeedback returns matching copy for known payment states', () => {
  assert.equal(buildPaymentFeedback('success').tone, 'success');
  assert.equal(buildPaymentFeedback('cancelled').tone, 'info');
  assert.equal(buildPaymentFeedback('unknown'), null);
});

test('getProfileUpgradePlans stays aligned with pricing plan metadata', () => {
  const plans = getProfileUpgradePlans();
  assert.deepEqual(plans.map((plan) => plan.id), ['pro', 'team']);
  assert.equal(plans[0].name, PLAN_META.pro.name);
  assert.equal(plans[0].price, PLAN_META.pro.detailPrice);
  assert.ok(plans[0].features.includes('무제한 AI 힌트'));
  assert.ok(!plans[0].features.includes('프리미엄 문제'));
  assert.equal(plans[1].name, PLAN_META.team.name);
  assert.equal(plans[1].price, PLAN_META.team.detailPrice);
});

test('formatCurrentSubscriptionLabel localizes well-known tiers', () => {
  assert.equal(formatCurrentSubscriptionLabel('free'), '무료');
  assert.equal(formatCurrentSubscriptionLabel('pro'), PLAN_META.pro.name);
  assert.equal(formatCurrentSubscriptionLabel('team'), PLAN_META.team.name);
  assert.equal(formatCurrentSubscriptionLabel('enterprise'), 'ENTERPRISE');
});
