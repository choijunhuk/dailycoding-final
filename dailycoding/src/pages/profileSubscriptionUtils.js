import { PLAN_META } from '../data/pricingPlans.js';

export function buildPaymentFeedback(status) {
  if (status === 'success') {
    return {
      tone: 'success',
      title: '결제가 완료되었습니다.',
      body: '새 플랜이 반영됐는지 아래 구독 카드에서 바로 확인할 수 있습니다.',
    };
  }

  if (status === 'cancelled') {
    return {
      tone: 'info',
      title: '결제가 취소되었습니다.',
      body: '플랜 비교를 다시 보고 원할 때 다시 결제를 진행하면 됩니다.',
    };
  }

  return null;
}

export function getProfileUpgradePlans() {
  return [
    {
      id: 'pro',
      name: PLAN_META.pro.name,
      price: PLAN_META.pro.detailPrice,
      color: PLAN_META.pro.accent,
      features: ['무제한 AI 힌트', '광고 제거', '배틀 우선 매칭', '상세 분석 리포트'],
    },
    {
      id: 'team',
      name: PLAN_META.team.name,
      price: PLAN_META.team.detailPrice,
      color: PLAN_META.team.accent,
      features: ['프로 전체 포함', '팀 대시보드', '맞춤 콘테스트', 'API 접근'],
    },
  ];
}

export function formatCurrentSubscriptionLabel(tier) {
  if (!tier || tier === 'free') return '무료';
  if (tier === 'pro') return PLAN_META.pro.name;
  if (tier === 'team') return PLAN_META.team.name;
  return String(tier).toUpperCase();
}
