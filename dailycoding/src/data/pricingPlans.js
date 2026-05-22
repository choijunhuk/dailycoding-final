import { AI_DAILY_QUOTA, SUBSCRIPTION_PRICE, TEAM_SUBSCRIPTION_PRICE } from './constants.js';

export const PLAN_META = {
  free: {
    id: 'free',
    name: 'Free',
    eyebrow: '입문',
    monthlyPrice: 0,
    annualPrice: 0,
    accent: '#8b949e',
    panel: 'linear-gradient(180deg, rgba(139,148,158,.12), rgba(13,17,23,.88))',
    desc: '지금 바로 문제를 풀기 시작하세요 — 누구에게나 열려있는 개인 플랜',
    summary: ['전체 문제', `AI 힌트 ${AI_DAILY_QUOTA}회/일`, '기본 통계'],
    features: [
      { label: '전체 문제 접근', included: true },
      { label: `AI 힌트 ${AI_DAILY_QUOTA}회/일`, included: true },
      { label: '기본 학습 통계', included: true },
      { label: '공개 랭킹', included: true },
      { label: '배틀 모드', included: true },
      { label: '무제한 AI 힌트', included: false },
    ],
    compactPrice: '무료',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    eyebrow: '개인',
    monthlyPrice: SUBSCRIPTION_PRICE.pro_monthly,
    annualPrice: SUBSCRIPTION_PRICE.pro_yearly,
    accent: '#79c0ff',
    panel: 'linear-gradient(180deg, rgba(121,192,255,.18), rgba(13,17,23,.96))',
    desc: '더 깊이, 더 빠르게 — 진지한 학습자를 위한 플랜',
    highlight: true,
    summary: ['무제한 AI 힌트', '광고 없음', '고급 분석'],
    features: [
      { label: 'Free 플랜 전체 포함', included: true },
      { label: '무제한 AI 힌트', included: true },
      { label: '배틀 우선 매칭', included: true },
      { label: '고급 분석 리포트', included: true },
      { label: '광고 없음', included: true },
      { label: '팀 대시보드', included: false },
    ],
    compactPrice: `$${SUBSCRIPTION_PRICE.pro_monthly}/월`,
    detailPrice: `$${SUBSCRIPTION_PRICE.pro_monthly}/월 · $${SUBSCRIPTION_PRICE.pro_yearly}/년`,
  },
  team: {
    id: 'team',
    name: 'Team',
    eyebrow: '팀/기업',
    monthlyPrice: TEAM_SUBSCRIPTION_PRICE.monthly,
    annualPrice: TEAM_SUBSCRIPTION_PRICE.yearly,
    accent: '#f2cc60',
    panel: 'linear-gradient(180deg, rgba(242,204,96,.17), rgba(13,17,23,.96))',
    desc: '스터디 그룹과 사내 코딩 교육을 위해 설계된 플랜',
    summary: ['팀 대시보드', '커스텀 콘테스트', 'API 연동'],
    features: [
      { label: 'Pro 플랜 전체 포함', included: true },
      { label: '팀 대시보드', included: true },
      { label: '커스텀 콘테스트 관리', included: true },
      { label: 'API 연동', included: true },
      { label: '멤버 관리', included: true },
      { label: '우선 지원', included: true },
      { label: '전용 샌드박스', included: true },
    ],
    compactPrice: `$${TEAM_SUBSCRIPTION_PRICE.monthly}/월`,
    detailPrice: `$${TEAM_SUBSCRIPTION_PRICE.monthly}/월 · $${TEAM_SUBSCRIPTION_PRICE.yearly}/년`,
  },
};

export const PRICING_FAQ = [
  { q: '언제든지 해지할 수 있나요?', a: '네. 언제든지 해지 가능합니다. 현재 결제 기간이 끝날 때까지 구독은 유지됩니다.' },
  { q: 'Team 플랜에는 몇 명이 참여할 수 있나요?', a: 'Team 플랜은 최대 20명까지 이용 가능합니다.' },
  { q: '결제는 어떻게 이루어지나요?', a: '플랜을 선택하면 Stripe 보안 결제 페이지로 이동합니다. 카드 결제가 완료되면 구독이 즉시 시작되고 영수증이 이메일로 발송됩니다.' },
  { q: '환불 정책은 어떻게 되나요?', a: '유료 플랜은 결제일로부터 7일 이내에 전액 환불이 가능합니다.' },
];

export function getPlanList() {
  return [PLAN_META.free, PLAN_META.pro, PLAN_META.team];
}

export function formatPlanPrice(value) {
  return value === 0 ? '무료' : `$${value}`;
}
