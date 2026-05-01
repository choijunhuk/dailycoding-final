// 언랭 → 아이언 → 브론즈 → 실버 → 골드 → 플레 → 에메 → 다이아 → 마스터 → 그랜드마스터 → 챌린저
// 챌린저는 rating 기반 threshold 없음 — 상위 3명에게 동적으로 부여
export const TIER_THRESHOLDS = {
  iron:         1,
  bronze:       300,
  silver:       1000,
  gold:         2800,
  platinum:     6000,
  emerald:      10000,
  diamond:      13500,
  master:       15000,
  grandmaster:  16000,
  // challenger: 상위 3명 (syncChallengerTiers()가 동적으로 관리)
};

export const SUBSCRIPTION_PRICE = {
  pro_monthly: 5,
  pro_yearly: 50,
};

export const TEAM_SUBSCRIPTION_PRICE = {
  monthly: 10,
  yearly: 100,
};

export const AI_DAILY_QUOTA = 5;
export const RANKING_CACHE_TTL = 60;

// 인덱스 순서 = tierScore() 계산 기준 (index × 1000)
// 문제 티어는 여전히 bronze~diamond 범위 사용
export const TIER_ORDER = [
  'unranked', 'iron', 'bronze', 'silver', 'gold',
  'platinum', 'emerald', 'diamond', 'master', 'grandmaster', 'challenger',
];

// 문제 풀이 시 레이팅에 합산되는 점수 (problem.tier 기준)
// 최대 레이팅: 100 × 165 = 16,500
export const TIER_POINTS = {
  iron:        10,
  bronze:      20,
  silver:      40,
  gold:        70,
  platinum:    110,
  emerald:     150,
  diamond:     165,
  master:      200,
  grandmaster: 250,
};

export const PROMOTION_WINS_REQUIRED = 3;
export const PROMOTION_LOSSES_ALLOWED = 2;
export const PROMOTION_SERIES_DAYS = 7;
