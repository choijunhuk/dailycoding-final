import { AI_DAILY_QUOTA, SUBSCRIPTION_PRICE, TEAM_SUBSCRIPTION_PRICE } from './constants.js';

export const PLAN_META = {
  free: {
    id: 'free',
    name: '무료',
    eyebrow: '입문',
    monthlyPrice: 0,
    annualPrice: 0,
    accent: '#8b949e',
    panel: 'linear-gradient(180deg, rgba(139,148,158,.12), rgba(13,17,23,.88))',
    desc: '핵심 기능만 빠르게 시작하는 개인용 플랜',
    summary: ['기본 문제 풀이', `AI 힌트 ${AI_DAILY_QUOTA}회/일`, '기본 통계'],
    features: [
      { label: '전체 기본 문제 풀이', included: true },
      { label: `AI 힌트 하루 ${AI_DAILY_QUOTA}회`, included: true },
      { label: '기본 학습 통계', included: true },
      { label: '공개 랭킹 참여', included: true },
      { label: '배틀 모드 이용', included: true },
      { label: '프리미엄 문제', included: false },
    ],
    compactPrice: '무료',
  },
  pro: {
    id: 'pro',
    name: '프로',
    eyebrow: '개인',
    monthlyPrice: SUBSCRIPTION_PRICE.pro_monthly,
    annualPrice: SUBSCRIPTION_PRICE.pro_yearly,
    accent: '#79c0ff',
    panel: 'linear-gradient(180deg, rgba(121,192,255,.18), rgba(13,17,23,.96))',
    desc: '혼자 깊게 파고들며 실력을 올리는 대표 플랜',
    highlight: true,
    summary: ['무제한 AI 힌트', '프리미엄 문제', '광고 제거'],
    features: [
      { label: '무료 플랜 기능 전체 포함', included: true },
      { label: '무제한 AI 힌트', included: true },
      { label: '프리미엄 문제 접근', included: true },
      { label: '배틀 우선 매칭', included: true },
      { label: '심화 분석 리포트', included: true },
      { label: '광고 제거', included: true },
      { label: '팀 대시보드', included: false },
    ],
    compactPrice: `$${SUBSCRIPTION_PRICE.pro_monthly}/월`,
    detailPrice: `$${SUBSCRIPTION_PRICE.pro_monthly}/월 · $${SUBSCRIPTION_PRICE.pro_yearly}/년`,
  },
  team: {
    id: 'team',
    name: '팀',
    eyebrow: '조직',
    monthlyPrice: TEAM_SUBSCRIPTION_PRICE.monthly,
    annualPrice: TEAM_SUBSCRIPTION_PRICE.yearly,
    accent: '#f2cc60',
    panel: 'linear-gradient(180deg, rgba(242,204,96,.17), rgba(13,17,23,.96))',
    desc: '스터디와 사내 교육 운영까지 염두에 둔 팀 플랜',
    summary: ['팀 대시보드', '커스텀 대회', 'API 연동'],
    features: [
      { label: '프로 플랜 기능 전체 포함', included: true },
      { label: '팀 대시보드', included: true },
      { label: '커스텀 대회 운영', included: true },
      { label: 'API 연동', included: true },
      { label: '팀원 관리', included: true },
      { label: '우선 지원', included: true },
      { label: '전용 샌드박스', included: true },
    ],
    compactPrice: `$${TEAM_SUBSCRIPTION_PRICE.monthly}/월`,
    detailPrice: `$${TEAM_SUBSCRIPTION_PRICE.monthly}/월 · $${TEAM_SUBSCRIPTION_PRICE.yearly}/년`,
  },
};

export const PRICING_FAQ = [
  { q: '언제든지 구독을 취소할 수 있나요?', a: '네. 언제든지 취소할 수 있고, 이미 결제한 기간이 끝날 때까지 기능을 계속 사용할 수 있습니다.' },
  { q: '팀 플랜은 몇 명까지 가능한가요?', a: '현재 팀 플랜은 최대 20명까지 운영하는 구성을 기준으로 설계되어 있습니다.' },
  { q: '결제는 어떻게 진행되나요?', a: '로그인 후 플랜을 선택하면 Stripe 결제 페이지로 이동합니다. 운영 환경에서는 Price ID 기반 세션이, 테스트/예비 경로에서는 결제 링크 fallback이 사용될 수 있습니다.' },
  { q: '환불 정책이 있나요?', a: '유료 플랜은 결제 후 7일 이내 전액 환불 요청이 가능합니다.' },
];

export function getPlanList() {
  return [PLAN_META.free, PLAN_META.pro, PLAN_META.team];
}

export function formatPlanPrice(value) {
  return value === 0 ? '무료' : `$${value}`;
}
