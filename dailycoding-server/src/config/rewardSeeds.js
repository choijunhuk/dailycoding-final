export const REWARD_SEEDS = [
  // ── Ranking (tier achieved) ───────────────────────────────────────────────
  { code: 'badge_bronze',      type: 'badge', name: 'Bronze Achieved',     nameKo: '브론즈 달성',      description: 'Reached Bronze tier.',                    rarity: 'common',    icon: '🥉', category: 'ranking', sort_order: 10 },
  { code: 'badge_silver',      type: 'badge', name: 'Silver Achieved',     nameKo: '실버 달성',        description: 'Reached Silver tier.',                    rarity: 'common',    icon: '🥈', category: 'ranking', sort_order: 20 },
  { code: 'badge_gold',        type: 'badge', name: 'Gold Achieved',       nameKo: '골드 달성',        description: 'Reached Gold tier.',                      rarity: 'uncommon',  icon: '🥇', category: 'ranking', sort_order: 30 },
  { code: 'badge_platinum',    type: 'badge', name: 'Platinum Achieved',   nameKo: '플래티넘 달성',    description: 'Reached Platinum tier.',                  rarity: 'rare',      icon: '💎', category: 'ranking', sort_order: 40 },
  { code: 'badge_emerald',     type: 'badge', name: 'Emerald Achieved',    nameKo: '에메랄드 달성',    description: 'Reached Emerald tier.',                   rarity: 'rare',      icon: '💚', category: 'ranking', sort_order: 50 },
  { code: 'badge_diamond',     type: 'badge', name: 'Diamond Achieved',    nameKo: '다이아몬드 달성',  description: 'Reached Diamond tier.',                   rarity: 'epic',      icon: '💠', category: 'ranking', sort_order: 60 },
  { code: 'badge_master',      type: 'badge', name: 'Master Achieved',     nameKo: '마스터 달성',      description: 'Reached Master tier.',                    rarity: 'epic',      icon: '🔮', category: 'ranking', sort_order: 70 },
  { code: 'badge_grandmaster', type: 'badge', name: 'Grandmaster',         nameKo: '그랜드마스터',     description: 'Reached Grandmaster tier.',               rarity: 'legendary', icon: '🌙', category: 'ranking', sort_order: 80 },
  { code: 'badge_challenger',  type: 'badge', name: 'Challenger',          nameKo: '챌린저',           description: 'Your name is in the server TOP 3.',       rarity: 'legendary', icon: '⚡', category: 'ranking', sort_order: 90 },

  // ── Coding (problems solved) ──────────────────────────────────────────────
  { code: 'badge_first_solve', type: 'badge', name: 'First Solve',         nameKo: '첫 번째 풀이',     description: 'Solved your first problem.',              rarity: 'common',    icon: '🎯', category: 'coding', sort_order: 10 },
  { code: 'badge_solve10',     type: 'badge', name: '10 Problems Solved',  nameKo: '문제 10개 해결',   description: 'Solved 10 problems.',                     rarity: 'common',    icon: '✅', category: 'coding', sort_order: 20 },
  { code: 'badge_solve50',     type: 'badge', name: '50 Problems Solved',  nameKo: '문제 50개 해결',   description: 'Solved 50 problems.',                     rarity: 'uncommon',  icon: '🎖️', category: 'coding', sort_order: 30 },
  { code: 'badge_solve100',    type: 'badge', name: '100 Problems Solved', nameKo: '문제 100개 해결',  description: 'Solved 100 problems.',                    rarity: 'rare',      icon: '🏅', category: 'coding', sort_order: 40 },
  { code: 'badge_solve200',    type: 'badge', name: '200 Problems Solved', nameKo: '문제 200개 해결',  description: 'Solved 200 problems.',                    rarity: 'epic',      icon: '🎗️', category: 'coding', sort_order: 50 },
  { code: 'badge_solve500',    type: 'badge', name: 'Algorithm Master',    nameKo: '알고리즘 마스터',  description: 'Legendary coder who solved 500 problems.', rarity: 'legendary', icon: '👑', category: 'coding', sort_order: 60 },

  // ── Streak (consecutive solves) ───────────────────────────────────────────
  { code: 'badge_streak_7',    type: 'badge', name: '7-Day Streak',        nameKo: '7일 연속',         description: 'Solved problems 7 days in a row.',        rarity: 'uncommon',  icon: '🔥', category: 'streak', sort_order: 10 },
  { code: 'badge_streak_30',   type: 'badge', name: '30-Day Streak',       nameKo: '30일 연속',        description: 'Solved problems 30 days in a row.',       rarity: 'rare',      icon: '⚡', category: 'streak', sort_order: 20 },
  { code: 'badge_streak100',   type: 'badge', name: '100-Day Streak',      nameKo: '100일 연속',       description: 'Solved problems 100 days in a row.',      rarity: 'epic',      icon: '💥', category: 'streak', sort_order: 30 },
  { code: 'badge_streak365',   type: 'badge', name: '365-Day Streak',      nameKo: '365일 연속',       description: 'Legendary streak of 365 days.',           rarity: 'legendary', icon: '🌟', category: 'streak', sort_order: 40 },

  // ── XP (level) ───────────────────────────────────────────────────────────
  { code: 'badge_xp_rookie',   type: 'badge', name: 'Rookie',              nameKo: '루키',             description: 'Reached XP level 2.',                    rarity: 'common',    icon: '🌱', category: 'xp', sort_order: 10 },
  { code: 'badge_xp_climber',  type: 'badge', name: 'Climber',             nameKo: '클라이머',         description: 'Reached XP level 5.',                    rarity: 'uncommon',  icon: '⛰️', category: 'xp', sort_order: 20 },
  { code: 'badge_xp_veteran',  type: 'badge', name: 'Veteran',             nameKo: '베테랑',           description: 'Reached XP level 10.',                   rarity: 'rare',      icon: '🏆', category: 'xp', sort_order: 30 },
  { code: 'badge_xp_master',   type: 'badge', name: 'XP Master',           nameKo: 'XP 마스터',        description: 'Reached XP level 20.',                   rarity: 'epic',      icon: '🌠', category: 'xp', sort_order: 40 },

  // ── Battle ────────────────────────────────────────────────────────────────
  { code: 'badge_battle_win',    type: 'badge', name: 'First Battle Win',  nameKo: '첫 배틀 승리',     description: 'Won your first battle.',                  rarity: 'uncommon',  icon: '⚔️', category: 'battle', sort_order: 10 },
  { code: 'badge_battle_5wins',  type: 'badge', name: '5 Battle Wins',     nameKo: '5승',              description: 'Won 5 battles.',                          rarity: 'rare',      icon: '🗡️', category: 'battle', sort_order: 20 },
  { code: 'badge_battle_10wins', type: 'badge', name: '10 Battle Wins',    nameKo: '10승',             description: 'Won 10 battles.',                         rarity: 'epic',      icon: '🛡️', category: 'battle', sort_order: 30 },
  { code: 'badge_battle_20wins', type: 'badge', name: 'Battle Dominator',  nameKo: '배틀 지배자',      description: 'Dominator with 20 battle wins.',          rarity: 'legendary', icon: '👊', category: 'battle', sort_order: 40 },

  // ── Explore (challenge badges) ────────────────────────────────────────────
  { code: 'badge_speedrun',    type: 'badge', name: 'Speedrun',            nameKo: '스피드런',         description: 'Solved a problem within 10 minutes.',     rarity: 'uncommon',  icon: '⏱️', category: 'explore', sort_order: 10 },
  { code: 'badge_nightowl',    type: 'badge', name: 'Night Owl',           nameKo: '야행성',           description: 'Solved a problem between midnight and 4am.', rarity: 'uncommon', icon: '🦉', category: 'explore', sort_order: 20 },
  { code: 'badge_gold_killer', type: 'badge', name: 'Gold Killer',         nameKo: '골드 킬러',        description: 'First solved a Gold or higher problem.',  rarity: 'rare',      icon: '✨', category: 'explore', sort_order: 30 },
  { code: 'badge_multilang',   type: 'badge', name: 'Polyglot',            nameKo: '멀티 언어',        description: 'Answered correctly in 3 or more languages.', rarity: 'rare',   icon: '🌐', category: 'explore', sort_order: 40 },

  // ── Titles ────────────────────────────────────────────────────────────────
  { code: 'title_bronze',          type: 'title', name: 'Bronze Coder',     nameKo: '브론즈 코더',     description: 'Bronze Achieved',       rarity: 'common',   icon: null, category: 'ranking', sort_order: 10 },
  { code: 'title_silver',          type: 'title', name: 'Silver Coder',     nameKo: '실버 코더',       description: 'Silver Achieved',       rarity: 'common',   icon: null, category: 'ranking', sort_order: 20 },
  { code: 'title_gold',            type: 'title', name: 'Gold Coder',       nameKo: '골드 코더',       description: 'Gold Achieved',         rarity: 'uncommon', icon: null, category: 'ranking', sort_order: 30 },
  { code: 'title_platinum',        type: 'title', name: 'Platinum Coder',   nameKo: '플래티넘 코더',   description: 'Platinum Achieved',     rarity: 'rare',     icon: null, category: 'ranking', sort_order: 40 },
  { code: 'title_diamond',         type: 'title', name: 'Diamond Coder',    nameKo: '다이아몬드 코더', description: 'Diamond Achieved',      rarity: 'epic',     icon: null, category: 'ranking', sort_order: 50 },
  { code: 'title_routine_builder', type: 'title', name: 'Consistent Coder', nameKo: '꾸준한 코더',     description: 'XP level 3 achieved',  rarity: 'common',   icon: null, category: 'xp', sort_order: 10 },
  { code: 'title_debug_maker',     type: 'title', name: 'Debug Master',     nameKo: '디버그 마스터',   description: 'XP level 7 achieved',  rarity: 'uncommon', icon: null, category: 'xp', sort_order: 20 },
];
