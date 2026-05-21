import { AI_DAILY_QUOTA, SUBSCRIPTION_PRICE, TEAM_SUBSCRIPTION_PRICE } from './constants.js';

export const PLAN_META = {
  free: {
    id: 'free',
    name: 'Free',
    eyebrow: 'Starter',
    monthlyPrice: 0,
    annualPrice: 0,
    accent: '#8b949e',
    panel: 'linear-gradient(180deg, rgba(139,148,158,.12), rgba(13,17,23,.88))',
    desc: 'Start solving problems right away — personal plan for everyone',
    summary: ['All Problems', `AI Hints ${AI_DAILY_QUOTA}x/day`, 'Basic Stats'],
    features: [
      { label: 'All Problems', included: true },
      { label: `AI Hints ${AI_DAILY_QUOTA}x/day`, included: true },
      { label: 'Basic Learning Stats', included: true },
      { label: 'Public Ranking', included: true },
      { label: 'Battle Mode', included: true },
      { label: 'Unlimited AI Hints', included: false },
    ],
    compactPrice: 'Free',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    eyebrow: 'Individual',
    monthlyPrice: SUBSCRIPTION_PRICE.pro_monthly,
    annualPrice: SUBSCRIPTION_PRICE.pro_yearly,
    accent: '#79c0ff',
    panel: 'linear-gradient(180deg, rgba(121,192,255,.18), rgba(13,17,23,.96))',
    desc: 'Go deeper, improve faster — the go-to plan for serious learners',
    highlight: true,
    summary: ['Unlimited AI Hints', 'Ad-Free', 'Advanced Analytics'],
    features: [
      { label: 'Everything in Free', included: true },
      { label: 'Unlimited AI Hints', included: true },
      { label: 'Priority Battle Matching', included: true },
      { label: 'Advanced Analytics Report', included: true },
      { label: 'Ad-Free', included: true },
      { label: 'Team Dashboard', included: false },
    ],
    compactPrice: `$${SUBSCRIPTION_PRICE.pro_monthly}/mo`,
    detailPrice: `$${SUBSCRIPTION_PRICE.pro_monthly}/mo · $${SUBSCRIPTION_PRICE.pro_yearly}/yr`,
  },
  team: {
    id: 'team',
    name: 'Team',
    eyebrow: 'Organization',
    monthlyPrice: TEAM_SUBSCRIPTION_PRICE.monthly,
    annualPrice: TEAM_SUBSCRIPTION_PRICE.yearly,
    accent: '#f2cc60',
    panel: 'linear-gradient(180deg, rgba(242,204,96,.17), rgba(13,17,23,.96))',
    desc: 'Built for study groups and in-house coding education',
    summary: ['Team Dashboard', 'Custom Contests', 'API Integration'],
    features: [
      { label: 'Everything in Pro', included: true },
      { label: 'Team Dashboard', included: true },
      { label: 'Custom Contest Management', included: true },
      { label: 'API Integration', included: true },
      { label: 'Member Management', included: true },
      { label: 'Priority Support', included: true },
      { label: 'Dedicated Sandbox', included: true },
    ],
    compactPrice: `$${TEAM_SUBSCRIPTION_PRICE.monthly}/mo`,
    detailPrice: `$${TEAM_SUBSCRIPTION_PRICE.monthly}/mo · $${TEAM_SUBSCRIPTION_PRICE.yearly}/yr`,
  },
};

export const PRICING_FAQ = [
  { q: 'Can I cancel anytime?', a: 'Yes. You can cancel at any time. Your subscription will remain active until the end of the current billing period.' },
  { q: 'How many members can join a Team plan?', a: 'The Team plan is designed for up to 20 members.' },
  { q: 'How does billing work?', a: 'After selecting a plan, you\'ll be redirected to a secure Stripe checkout. Once your card is processed, your subscription starts immediately and a receipt is sent to your email.' },
  { q: 'What is the refund policy?', a: 'Paid plans are eligible for a full refund within 7 days of purchase.' },
];

export function getPlanList() {
  return [PLAN_META.free, PLAN_META.pro, PLAN_META.team];
}

export function formatPlanPrice(value) {
  return value === 0 ? 'Free' : `$${value}`;
}
