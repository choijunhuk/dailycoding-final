import { AI_DAILY_QUOTA, SUBSCRIPTION_PRICE, TEAM_SUBSCRIPTION_PRICE } from './constants.js';

const PLAN_META_BILINGUAL = {
  free: {
    id: 'free',
    name: 'Free',
    eyebrow: { ko: '입문', en: 'Starter' },
    monthlyPrice: 0,
    annualPrice: 0,
    accent: '#8b949e',
    panel: 'linear-gradient(180deg, rgba(139,148,158,.12), rgba(13,17,23,.88))',
    desc: {
      ko: '지금 바로 문제를 풀기 시작하세요 — 누구에게나 열려있는 개인 플랜',
      en: 'Start solving problems right now — an open plan for everyone',
    },
    summary: {
      ko: ['전체 문제', `AI 힌트 ${AI_DAILY_QUOTA}회/일`, '기본 통계'],
      en: ['All problems', `AI hints ${AI_DAILY_QUOTA}/day`, 'Basic stats'],
    },
    features: [
      { ko: '전체 문제 접근', en: 'Access to all problems', included: true },
      { ko: `AI 힌트 ${AI_DAILY_QUOTA}회/일`, en: `AI hints ${AI_DAILY_QUOTA}/day`, included: true },
      { ko: '기본 학습 통계', en: 'Basic learning stats', included: true },
      { ko: '공개 랭킹', en: 'Public ranking', included: true },
      { ko: '배틀 모드', en: 'Battle mode', included: true },
      { ko: '무제한 AI 힌트', en: 'Unlimited AI hints', included: false },
    ],
    compactPrice: { ko: '무료', en: 'Free' },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    eyebrow: { ko: '개인', en: 'Individual' },
    monthlyPrice: SUBSCRIPTION_PRICE.pro_monthly,
    annualPrice: SUBSCRIPTION_PRICE.pro_yearly,
    accent: '#79c0ff',
    panel: 'linear-gradient(180deg, rgba(121,192,255,.18), rgba(13,17,23,.96))',
    desc: {
      ko: '더 깊이, 더 빠르게 — 진지한 학습자를 위한 플랜',
      en: 'Go deeper, go faster — the plan for serious learners',
    },
    highlight: true,
    summary: {
      ko: ['무제한 AI 힌트', '광고 없음', '고급 분석'],
      en: ['Unlimited AI hints', 'No ads', 'Advanced analytics'],
    },
    features: [
      { ko: 'Free 플랜 전체 포함', en: 'Everything in Free', included: true },
      { ko: '무제한 AI 힌트', en: 'Unlimited AI hints', included: true },
      { ko: '배틀 우선 매칭', en: 'Priority battle matching', included: true },
      { ko: '고급 분석 리포트', en: 'Advanced analytics report', included: true },
      { ko: '광고 없음', en: 'No ads', included: true },
      { ko: '팀 대시보드', en: 'Team dashboard', included: false },
    ],
    compactPrice: {
      ko: `$${SUBSCRIPTION_PRICE.pro_monthly}/월`,
      en: `$${SUBSCRIPTION_PRICE.pro_monthly}/mo`,
    },
    detailPrice: {
      ko: `$${SUBSCRIPTION_PRICE.pro_monthly}/월 · $${SUBSCRIPTION_PRICE.pro_yearly}/년`,
      en: `$${SUBSCRIPTION_PRICE.pro_monthly}/mo · $${SUBSCRIPTION_PRICE.pro_yearly}/yr`,
    },
  },
  team: {
    id: 'team',
    name: 'Team',
    eyebrow: { ko: '팀/기업', en: 'Team / Enterprise' },
    monthlyPrice: TEAM_SUBSCRIPTION_PRICE.monthly,
    annualPrice: TEAM_SUBSCRIPTION_PRICE.yearly,
    accent: '#f2cc60',
    panel: 'linear-gradient(180deg, rgba(242,204,96,.17), rgba(13,17,23,.96))',
    desc: {
      ko: '스터디 그룹과 사내 코딩 교육을 위해 설계된 플랜',
      en: 'Designed for study groups and in-house coding education',
    },
    summary: {
      ko: ['팀 대시보드', '커스텀 콘테스트', 'API 연동'],
      en: ['Team dashboard', 'Custom contests', 'API integration'],
    },
    features: [
      { ko: 'Pro 플랜 전체 포함', en: 'Everything in Pro', included: true },
      { ko: '팀 대시보드', en: 'Team dashboard', included: true },
      { ko: '커스텀 콘테스트 관리', en: 'Custom contest management', included: true },
      { ko: 'API 연동', en: 'API integration', included: true },
      { ko: '멤버 관리', en: 'Member management', included: true },
      { ko: '우선 지원', en: 'Priority support', included: true },
      { ko: '전용 샌드박스', en: 'Dedicated sandbox', included: true },
    ],
    compactPrice: {
      ko: `$${TEAM_SUBSCRIPTION_PRICE.monthly}/월`,
      en: `$${TEAM_SUBSCRIPTION_PRICE.monthly}/mo`,
    },
    detailPrice: {
      ko: `$${TEAM_SUBSCRIPTION_PRICE.monthly}/월 · $${TEAM_SUBSCRIPTION_PRICE.yearly}/년`,
      en: `$${TEAM_SUBSCRIPTION_PRICE.monthly}/mo · $${TEAM_SUBSCRIPTION_PRICE.yearly}/yr`,
    },
  },
};

const PRICING_FAQ_BILINGUAL = [
  {
    ko: { q: '언제든지 해지할 수 있나요?', a: '네. 언제든지 해지 가능합니다. 현재 결제 기간이 끝날 때까지 구독은 유지됩니다.' },
    en: { q: 'Can I cancel anytime?', a: 'Yes. You can cancel at any time. Your subscription remains active until the current billing period ends.' },
  },
  {
    ko: { q: 'Team 플랜에는 몇 명이 참여할 수 있나요?', a: 'Team 플랜은 최대 20명까지 이용 가능합니다.' },
    en: { q: 'How many members can join the Team plan?', a: 'The Team plan supports up to 20 members.' },
  },
  {
    ko: { q: '결제는 어떻게 이루어지나요?', a: '플랜을 선택하면 Stripe 보안 결제 페이지로 이동합니다. 카드 결제가 완료되면 구독이 즉시 시작되고 영수증이 이메일로 발송됩니다.' },
    en: { q: 'How does payment work?', a: 'Selecting a plan redirects you to a secure Stripe checkout page. Once payment completes, your subscription activates immediately and a receipt is sent to your email.' },
  },
  {
    ko: { q: '환불 정책은 어떻게 되나요?', a: '유료 플랜은 결제일로부터 7일 이내에 전액 환불이 가능합니다.' },
    en: { q: 'What is the refund policy?', a: 'All paid plans are eligible for a full refund within 7 days of payment.' },
  },
];

export const PLAN_META = PLAN_META_BILINGUAL;

export function getPlanList(lang = 'ko') {
  return Object.values(PLAN_META_BILINGUAL).map((plan) => ({
    ...plan,
    eyebrow: plan.eyebrow[lang] ?? plan.eyebrow.ko,
    desc: plan.desc[lang] ?? plan.desc.ko,
    summary: plan.summary[lang] ?? plan.summary.ko,
    features: plan.features.map(({ ko, en, included }) => ({
      label: (lang === 'en' ? en : ko) ?? ko,
      included,
    })),
    compactPrice: plan.compactPrice[lang] ?? plan.compactPrice.ko,
    detailPrice: plan.detailPrice ? (plan.detailPrice[lang] ?? plan.detailPrice.ko) : undefined,
  }));
}

export function getPricingFaq(lang = 'ko') {
  return PRICING_FAQ_BILINGUAL.map((item) => item[lang] ?? item.ko);
}

export function formatPlanPrice(value, lang = 'ko') {
  return value === 0 ? (lang === 'en' ? 'Free' : '무료') : `$${value}`;
}
