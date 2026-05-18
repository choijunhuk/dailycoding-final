export const REWARD_SEEDS = [
  // ── 랭킹 (티어 달성) ──────────────────────────────────────────────────────
  { code: 'badge_bronze',      type: 'badge', name: '브론즈 달성',     description: '브론즈 티어에 올랐습니다.',             rarity: 'common',    icon: '🥉', category: 'ranking', sort_order: 10 },
  { code: 'badge_silver',      type: 'badge', name: '실버 달성',       description: '실버 티어에 올랐습니다.',               rarity: 'common',    icon: '🥈', category: 'ranking', sort_order: 20 },
  { code: 'badge_gold',        type: 'badge', name: '골드 달성',       description: '골드 티어에 올랐습니다.',               rarity: 'uncommon',  icon: '🥇', category: 'ranking', sort_order: 30 },
  { code: 'badge_platinum',    type: 'badge', name: '플래티넘 달성',   description: '플래티넘 티어에 올랐습니다.',           rarity: 'rare',      icon: '💎', category: 'ranking', sort_order: 40 },
  { code: 'badge_emerald',     type: 'badge', name: '에메랄드 달성',   description: '에메랄드 티어에 올랐습니다.',           rarity: 'rare',      icon: '💚', category: 'ranking', sort_order: 50 },
  { code: 'badge_diamond',     type: 'badge', name: '다이아 달성',     description: '다이아 티어에 올랐습니다.',             rarity: 'epic',      icon: '💠', category: 'ranking', sort_order: 60 },
  { code: 'badge_master',      type: 'badge', name: '마스터 달성',     description: '마스터 티어에 올랐습니다.',             rarity: 'epic',      icon: '🔮', category: 'ranking', sort_order: 70 },
  { code: 'badge_grandmaster', type: 'badge', name: '그랜드마스터',    description: '그랜드마스터 티어에 올랐습니다.',       rarity: 'legendary', icon: '🌙', category: 'ranking', sort_order: 80 },
  { code: 'badge_challenger',  type: 'badge', name: '챌린저',          description: '서버 TOP 3에 이름을 올렸습니다.',       rarity: 'legendary', icon: '⚡', category: 'ranking', sort_order: 90 },

  // ── 코딩 도전 (풀이 수) ───────────────────────────────────────────────────
  { code: 'badge_first_solve', type: 'badge', name: '첫 풀이',         description: '첫 번째 문제를 해결했습니다.',          rarity: 'common',    icon: '🎯', category: 'coding', sort_order: 10 },
  { code: 'badge_solve10',     type: 'badge', name: '10문제 달성',     description: '10문제를 해결했습니다.',                rarity: 'common',    icon: '✅', category: 'coding', sort_order: 20 },
  { code: 'badge_solve50',     type: 'badge', name: '50문제 달성',     description: '50문제를 해결했습니다.',                rarity: 'uncommon',  icon: '🎖️', category: 'coding', sort_order: 30 },
  { code: 'badge_solve100',    type: 'badge', name: '100문제 달성',    description: '100문제를 해결했습니다.',               rarity: 'rare',      icon: '🏅', category: 'coding', sort_order: 40 },
  { code: 'badge_solve200',    type: 'badge', name: '200문제 달성',    description: '200문제를 해결했습니다.',               rarity: 'epic',      icon: '🎗️', category: 'coding', sort_order: 50 },
  { code: 'badge_solve500',    type: 'badge', name: '알고리즘 마스터', description: '500문제를 해결한 전설의 코더.',          rarity: 'legendary', icon: '👑', category: 'coding', sort_order: 60 },

  // ── 꾸준함 (연속 풀이) ────────────────────────────────────────────────────
  { code: 'badge_streak_7',    type: 'badge', name: '7일 연속',        description: '7일 연속으로 풀이했습니다.',            rarity: 'uncommon',  icon: '🔥', category: 'streak', sort_order: 10 },
  { code: 'badge_streak_30',   type: 'badge', name: '30일 연속',       description: '30일 연속으로 풀이했습니다.',           rarity: 'rare',      icon: '⚡', category: 'streak', sort_order: 20 },
  { code: 'badge_streak100',   type: 'badge', name: '100일 연속',      description: '100일 연속으로 풀이했습니다.',          rarity: 'epic',      icon: '💥', category: 'streak', sort_order: 30 },
  { code: 'badge_streak365',   type: 'badge', name: '1년 연속',        description: '365일 연속으로 풀이한 전설.',           rarity: 'legendary', icon: '🌟', category: 'streak', sort_order: 40 },

  // ── 성장 (XP 레벨) ───────────────────────────────────────────────────────
  { code: 'badge_xp_rookie',   type: 'badge', name: '루키',            description: 'XP 레벨 2 달성.',                      rarity: 'common',    icon: '🌱', category: 'xp', sort_order: 10 },
  { code: 'badge_xp_climber',  type: 'badge', name: '클라이머',        description: 'XP 레벨 5 달성.',                      rarity: 'uncommon',  icon: '⛰️', category: 'xp', sort_order: 20 },
  { code: 'badge_xp_veteran',  type: 'badge', name: '베테랑',          description: 'XP 레벨 10 달성.',                     rarity: 'rare',      icon: '🏆', category: 'xp', sort_order: 30 },
  { code: 'badge_xp_master',   type: 'badge', name: 'XP 마스터',       description: 'XP 레벨 20 달성.',                     rarity: 'epic',      icon: '🌠', category: 'xp', sort_order: 40 },

  // ── 배틀 (대전) ──────────────────────────────────────────────────────────
  { code: 'badge_battle_win',    type: 'badge', name: '첫 배틀 승리',  description: '배틀에서 첫 승리를 거뒀습니다.',        rarity: 'uncommon',  icon: '⚔️', category: 'battle', sort_order: 10 },
  { code: 'badge_battle_5wins',  type: 'badge', name: '배틀 5승',      description: '배틀에서 5번 승리했습니다.',            rarity: 'rare',      icon: '🗡️', category: 'battle', sort_order: 20 },
  { code: 'badge_battle_10wins', type: 'badge', name: '배틀 10승',     description: '배틀에서 10번 승리했습니다.',           rarity: 'epic',      icon: '🛡️', category: 'battle', sort_order: 30 },
  { code: 'badge_battle_20wins', type: 'badge', name: '배틀 지배자',   description: '배틀에서 20번 승리한 지배자.',          rarity: 'legendary', icon: '👊', category: 'battle', sort_order: 40 },

  // ── 탐험 (도전 뱃지) ─────────────────────────────────────────────────────
  { code: 'badge_speedrun',    type: 'badge', name: '스피드런',        description: '10분 이내에 정답을 맞혔습니다.',        rarity: 'uncommon',  icon: '⏱️', category: 'explore', sort_order: 10 },
  { code: 'badge_nightowl',    type: 'badge', name: '야행성',          description: '자정~새벽 4시 사이에 풀이했습니다.',    rarity: 'uncommon',  icon: '🦉', category: 'explore', sort_order: 20 },
  { code: 'badge_gold_killer', type: 'badge', name: '골드 킬러',       description: '골드 이상 문제를 처음 해결했습니다.',   rarity: 'rare',      icon: '✨', category: 'explore', sort_order: 30 },
  { code: 'badge_multilang',   type: 'badge', name: '폴리글랏',        description: '3개 이상의 언어로 정답을 냈습니다.',    rarity: 'rare',      icon: '🌐', category: 'explore', sort_order: 40 },

  // ── 칭호 ─────────────────────────────────────────────────────────────────
  { code: 'title_bronze',          type: 'title', name: '브론즈 코더',   description: '브론즈 달성',      rarity: 'common',   icon: null, category: 'ranking', sort_order: 10 },
  { code: 'title_silver',          type: 'title', name: '실버 코더',     description: '실버 달성',        rarity: 'common',   icon: null, category: 'ranking', sort_order: 20 },
  { code: 'title_gold',            type: 'title', name: '골드 코더',     description: '골드 달성',        rarity: 'uncommon', icon: null, category: 'ranking', sort_order: 30 },
  { code: 'title_platinum',        type: 'title', name: '플래티넘 코더', description: '플래티넘 달성',    rarity: 'rare',     icon: null, category: 'ranking', sort_order: 40 },
  { code: 'title_diamond',         type: 'title', name: '다이아 코더',   description: '다이아 달성',      rarity: 'epic',     icon: null, category: 'ranking', sort_order: 50 },
  { code: 'title_routine_builder', type: 'title', name: '꾸준한 코더',   description: 'XP 레벨 3 달성',  rarity: 'common',   icon: null, category: 'xp', sort_order: 10 },
  { code: 'title_debug_maker',     type: 'title', name: '디버그 마스터', description: 'XP 레벨 7 달성',  rarity: 'uncommon', icon: null, category: 'xp', sort_order: 20 },
];
