import { PLAN_META } from '../data/pricingPlans.js';
import { pickLangText } from '../utils/languageMode.js';

export function buildPaymentFeedback(status, lang = 'ko') {
  if (status === 'success') {
    return {
      tone: 'success',
      title: pickLangText(lang, '결제가 완료되었습니다.', 'Payment successful.'),
      body: pickLangText(lang, '아래 구독 카드에서 새 플랜이 활성화됐는지 확인하세요.', 'Check the subscription card below to confirm your new plan is active.'),
    };
  }

  if (status === 'cancelled') {
    return {
      tone: 'info',
      title: pickLangText(lang, '결제가 취소되었습니다.', 'Payment cancelled.'),
      body: pickLangText(lang, '플랜 비교를 확인한 뒤 준비되면 다시 구독하세요.', 'Review the plan comparison and subscribe again whenever you are ready.'),
    };
  }

  return null;
}

export function getProfileUpgradePlans(lang = 'ko') {
  return [
    {
      id: 'pro',
      name: PLAN_META.pro.name,
      price: PLAN_META.pro.detailPrice?.[lang] ?? PLAN_META.pro.detailPrice?.ko,
      color: PLAN_META.pro.accent,
      features: [
        pickLangText(lang, '무제한 AI 힌트', 'Unlimited AI Hints'),
        pickLangText(lang, '광고 제거', 'Ad-free'),
        pickLangText(lang, '우선 배틀 매칭', 'Priority Battle Matching'),
        pickLangText(lang, '상세 분석 리포트', 'Detailed Analysis Reports'),
      ],
    },
    {
      id: 'team',
      name: PLAN_META.team.name,
      price: PLAN_META.team.detailPrice?.[lang] ?? PLAN_META.team.detailPrice?.ko,
      color: PLAN_META.team.accent,
      features: [
        pickLangText(lang, 'Pro 모든 기능', 'Everything in Pro'),
        pickLangText(lang, '팀 대시보드', 'Team Dashboard'),
        pickLangText(lang, '커스텀 대회', 'Custom Contests'),
        pickLangText(lang, 'API 접근', 'API Access'),
      ],
    },
  ];
}

export function formatCurrentSubscriptionLabel(tier, lang = 'ko') {
  if (!tier || tier === 'free') return pickLangText(lang, '무료', 'Free');
  if (tier === 'pro') return PLAN_META.pro.name;
  if (tier === 'team') return PLAN_META.team.name;
  return String(tier).toUpperCase();
}
