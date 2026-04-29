import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_DAILY_QUOTA, SUBSCRIPTION_PRICE, TEAM_SUBSCRIPTION_PRICE } from './constants.js';
import { formatPlanPrice, getPlanList, PLAN_META, PRICING_FAQ } from './pricingPlans.js';

test('getPlanList returns plans in stable display order', () => {
  const plans = getPlanList();
  assert.deepEqual(plans.map((plan) => plan.id), ['free', 'pro', 'team']);
});

test('pricing plan metadata stays consistent with shared constants', () => {
  assert.equal(PLAN_META.free.compactPrice, '무료');
  assert.equal(PLAN_META.pro.monthlyPrice, SUBSCRIPTION_PRICE.pro_monthly);
  assert.equal(PLAN_META.pro.annualPrice, SUBSCRIPTION_PRICE.pro_yearly);
  assert.equal(PLAN_META.team.monthlyPrice, TEAM_SUBSCRIPTION_PRICE.monthly);
  assert.equal(PLAN_META.team.annualPrice, TEAM_SUBSCRIPTION_PRICE.yearly);
  assert.ok(PLAN_META.free.summary.includes(`AI 힌트 ${AI_DAILY_QUOTA}회/일`));
});

test('formatPlanPrice formats free and paid plans correctly', () => {
  assert.equal(formatPlanPrice(0), '무료');
  assert.equal(formatPlanPrice(5), '$5');
  assert.equal(formatPlanPrice(100), '$100');
});

test('pricing FAQ includes refund and team capacity guidance', () => {
  const questions = PRICING_FAQ.map((item) => item.q);
  assert.ok(questions.some((question) => question.includes('취소')));
  assert.ok(questions.some((question) => question.includes('팀 플랜')));
});
