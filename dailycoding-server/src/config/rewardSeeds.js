export const REWARD_SEEDS = [
  // ── Ranking (tier achieved) ───────────────────────────────────────────────
  { code: 'badge_bronze',      type: 'badge', name: 'Bronze Achieved',     description: 'Reached Bronze tier.',                    rarity: 'common',    icon: '🥉', category: 'ranking', sort_order: 10 },
  { code: 'badge_silver',      type: 'badge', name: 'Silver Achieved',     description: 'Reached Silver tier.',                    rarity: 'common',    icon: '🥈', category: 'ranking', sort_order: 20 },
  { code: 'badge_gold',        type: 'badge', name: 'Gold Achieved',       description: 'Reached Gold tier.',                      rarity: 'uncommon',  icon: '🥇', category: 'ranking', sort_order: 30 },
  { code: 'badge_platinum',    type: 'badge', name: 'Platinum Achieved',   description: 'Reached Platinum tier.',                  rarity: 'rare',      icon: '💎', category: 'ranking', sort_order: 40 },
  { code: 'badge_emerald',     type: 'badge', name: 'Emerald Achieved',    description: 'Reached Emerald tier.',                   rarity: 'rare',      icon: '💚', category: 'ranking', sort_order: 50 },
  { code: 'badge_diamond',     type: 'badge', name: 'Diamond Achieved',    description: 'Reached Diamond tier.',                   rarity: 'epic',      icon: '💠', category: 'ranking', sort_order: 60 },
  { code: 'badge_master',      type: 'badge', name: 'Master Achieved',     description: 'Reached Master tier.',                    rarity: 'epic',      icon: '🔮', category: 'ranking', sort_order: 70 },
  { code: 'badge_grandmaster', type: 'badge', name: 'Grandmaster',         description: 'Reached Grandmaster tier.',               rarity: 'legendary', icon: '🌙', category: 'ranking', sort_order: 80 },
  { code: 'badge_challenger',  type: 'badge', name: 'Challenger',          description: 'Your name is in the server TOP 3.',       rarity: 'legendary', icon: '⚡', category: 'ranking', sort_order: 90 },

  // ── Coding (problems solved) ──────────────────────────────────────────────
  { code: 'badge_first_solve', type: 'badge', name: 'First Solve',         description: 'Solved your first problem.',              rarity: 'common',    icon: '🎯', category: 'coding', sort_order: 10 },
  { code: 'badge_solve10',     type: 'badge', name: '10 Problems Solved',  description: 'Solved 10 problems.',                     rarity: 'common',    icon: '✅', category: 'coding', sort_order: 20 },
  { code: 'badge_solve50',     type: 'badge', name: '50 Problems Solved',  description: 'Solved 50 problems.',                     rarity: 'uncommon',  icon: '🎖️', category: 'coding', sort_order: 30 },
  { code: 'badge_solve100',    type: 'badge', name: '100 Problems Solved', description: 'Solved 100 problems.',                    rarity: 'rare',      icon: '🏅', category: 'coding', sort_order: 40 },
  { code: 'badge_solve200',    type: 'badge', name: '200 Problems Solved', description: 'Solved 200 problems.',                    rarity: 'epic',      icon: '🎗️', category: 'coding', sort_order: 50 },
  { code: 'badge_solve500',    type: 'badge', name: 'Algorithm Master',    description: 'Legendary coder who solved 500 problems.', rarity: 'legendary', icon: '👑', category: 'coding', sort_order: 60 },

  // ── Streak (consecutive solves) ───────────────────────────────────────────
  { code: 'badge_streak_7',    type: 'badge', name: '7-Day Streak',        description: 'Solved problems 7 days in a row.',        rarity: 'uncommon',  icon: '🔥', category: 'streak', sort_order: 10 },
  { code: 'badge_streak_30',   type: 'badge', name: '30-Day Streak',       description: 'Solved problems 30 days in a row.',       rarity: 'rare',      icon: '⚡', category: 'streak', sort_order: 20 },
  { code: 'badge_streak100',   type: 'badge', name: '100-Day Streak',      description: 'Solved problems 100 days in a row.',      rarity: 'epic',      icon: '💥', category: 'streak', sort_order: 30 },
  { code: 'badge_streak365',   type: 'badge', name: '365-Day Streak',      description: 'Legendary streak of 365 days.',           rarity: 'legendary', icon: '🌟', category: 'streak', sort_order: 40 },

  // ── XP (level) ───────────────────────────────────────────────────────────
  { code: 'badge_xp_rookie',   type: 'badge', name: 'Rookie',              description: 'Reached XP level 2.',                    rarity: 'common',    icon: '🌱', category: 'xp', sort_order: 10 },
  { code: 'badge_xp_climber',  type: 'badge', name: 'Climber',             description: 'Reached XP level 5.',                    rarity: 'uncommon',  icon: '⛰️', category: 'xp', sort_order: 20 },
  { code: 'badge_xp_veteran',  type: 'badge', name: 'Veteran',             description: 'Reached XP level 10.',                   rarity: 'rare',      icon: '🏆', category: 'xp', sort_order: 30 },
  { code: 'badge_xp_master',   type: 'badge', name: 'XP Master',           description: 'Reached XP level 20.',                   rarity: 'epic',      icon: '🌠', category: 'xp', sort_order: 40 },

  // ── Battle ────────────────────────────────────────────────────────────────
  { code: 'badge_battle_win',    type: 'badge', name: 'First Battle Win',  description: 'Won your first battle.',                  rarity: 'uncommon',  icon: '⚔️', category: 'battle', sort_order: 10 },
  { code: 'badge_battle_5wins',  type: 'badge', name: '5 Battle Wins',     description: 'Won 5 battles.',                          rarity: 'rare',      icon: '🗡️', category: 'battle', sort_order: 20 },
  { code: 'badge_battle_10wins', type: 'badge', name: '10 Battle Wins',    description: 'Won 10 battles.',                         rarity: 'epic',      icon: '🛡️', category: 'battle', sort_order: 30 },
  { code: 'badge_battle_20wins', type: 'badge', name: 'Battle Dominator',  description: 'Dominator with 20 battle wins.',          rarity: 'legendary', icon: '👊', category: 'battle', sort_order: 40 },

  // ── Explore (challenge badges) ────────────────────────────────────────────
  { code: 'badge_speedrun',    type: 'badge', name: 'Speedrun',            description: 'Solved a problem within 10 minutes.',     rarity: 'uncommon',  icon: '⏱️', category: 'explore', sort_order: 10 },
  { code: 'badge_nightowl',    type: 'badge', name: 'Night Owl',           description: 'Solved a problem between midnight and 4am.', rarity: 'uncommon', icon: '🦉', category: 'explore', sort_order: 20 },
  { code: 'badge_gold_killer', type: 'badge', name: 'Gold Killer',         description: 'First solved a Gold or higher problem.',  rarity: 'rare',      icon: '✨', category: 'explore', sort_order: 30 },
  { code: 'badge_multilang',   type: 'badge', name: 'Polyglot',            description: 'Answered correctly in 3 or more languages.', rarity: 'rare',   icon: '🌐', category: 'explore', sort_order: 40 },

  // ── Titles ────────────────────────────────────────────────────────────────
  { code: 'title_bronze',          type: 'title', name: 'Bronze Coder',     description: 'Bronze Achieved',       rarity: 'common',   icon: null, category: 'ranking', sort_order: 10 },
  { code: 'title_silver',          type: 'title', name: 'Silver Coder',     description: 'Silver Achieved',       rarity: 'common',   icon: null, category: 'ranking', sort_order: 20 },
  { code: 'title_gold',            type: 'title', name: 'Gold Coder',       description: 'Gold Achieved',         rarity: 'uncommon', icon: null, category: 'ranking', sort_order: 30 },
  { code: 'title_platinum',        type: 'title', name: 'Platinum Coder',   description: 'Platinum Achieved',     rarity: 'rare',     icon: null, category: 'ranking', sort_order: 40 },
  { code: 'title_diamond',         type: 'title', name: 'Diamond Coder',    description: 'Diamond Achieved',      rarity: 'epic',     icon: null, category: 'ranking', sort_order: 50 },
  { code: 'title_routine_builder', type: 'title', name: 'Consistent Coder', description: 'XP level 3 achieved',  rarity: 'common',   icon: null, category: 'xp', sort_order: 10 },
  { code: 'title_debug_maker',     type: 'title', name: 'Debug Master',     description: 'XP level 7 achieved',  rarity: 'uncommon', icon: null, category: 'xp', sort_order: 20 },
];
