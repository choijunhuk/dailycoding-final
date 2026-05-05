import { query, queryOne, run } from '../config/mysql.js';

const XP_UNLOCK_REWARDS = [
  { level: 2, code: 'badge_xp_rookie' },
  { level: 3, code: 'title_routine_builder' },
  { level: 5, code: 'badge_xp_climber' },
  { level: 7, code: 'title_debug_maker' },
  { level: 10, code: 'badge_xp_veteran' },
];

const XP_UNLOCK_BACKGROUNDS = [
  { level: 4, slug: 'focus-grid' },
  { level: 8, slug: 'night-judge' },
];

function xpForLevel(level) {
  if (level <= 1) return 0;
  return 120 * Math.pow(level - 1, 2);
}

function levelFromXp(xp) {
  return Math.floor(Math.sqrt(Math.max(0, Number(xp) || 0) / 120)) + 1;
}

function serializeProgression(row) {
  const xp = Number(row?.xp || 0);
  const level = levelFromXp(xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const progressPercent = Math.round(((xp - currentLevelXp) / Math.max(1, nextLevelXp - currentLevelXp)) * 100);
  const nextReward = [
    ...XP_UNLOCK_REWARDS.map((item) => ({ ...item, kind: 'reward' })),
    ...XP_UNLOCK_BACKGROUNDS.map((item) => ({ ...item, kind: 'background' })),
  ]
    .filter((item) => item.level > level)
    .sort((a, b) => a.level - b.level)[0] || null;

  return {
    xp,
    level,
    currentLevelXp,
    nextLevelXp,
    progressPercent,
    nextReward,
  };
}

export const Reward = {
  // 모든 보상 아이템 정의
  async findAll() {
    return query('SELECT * FROM reward_items ORDER BY rarity DESC, id ASC', []);
  },

  // 유저가 보유한 보상 목록 (아이템 정보 포함)
  async findByUser(userId) {
    return query(`
      SELECT ri.*, ur.earned_at
      FROM user_rewards ur
      JOIN reward_items ri ON ur.reward_id = ri.id
      WHERE ur.user_id = ?
      ORDER BY ur.earned_at DESC
    `, [userId]);
  },

  // 특정 보상 보유 여부
  async hasReward(userId, rewardCode) {
    const row = await queryOne(`
      SELECT 1 FROM user_rewards ur
      JOIN reward_items ri ON ur.reward_id = ri.id
      WHERE ur.user_id = ? AND ri.code = ?
    `, [userId, rewardCode]);
    return !!row;
  },

  // 보상 지급 (code 기준)
  async grant(userId, rewardCode) {
    const item = await queryOne('SELECT id FROM reward_items WHERE code = ?', [rewardCode]);
    if (!item) return null;
    await run(
      'INSERT IGNORE INTO user_rewards (user_id, reward_id) VALUES (?,?)',
      [userId, item.id]
    );
    return item;
  },

  // 여러 보상 한번에 지급
  async grantMany(userId, rewardCodes) {
    const results = [];
    for (const code of rewardCodes) {
      const r = await this.grant(userId, code);
      if (r) results.push(code);
    }
    return results;
  },

  async getProgression(userId) {
    let row = await queryOne('SELECT * FROM user_progression WHERE user_id = ?', [userId]);
    if (!row) {
      await run(
        'INSERT IGNORE INTO user_progression (user_id, xp, level) VALUES (?,?,?)',
        [userId, 0, 1]
      );
      row = await queryOne('SELECT * FROM user_progression WHERE user_id = ?', [userId]);
    }
    const progression = serializeProgression(row);
    await this.syncLevelUnlocks(userId, progression.level);
    return progression;
  },

  async addXp(userId, amount) {
    const before = await this.getProgression(userId);
    const addedXp = Math.max(0, Number(amount) || 0);
    const nextXp = before.xp + addedXp;
    const nextLevel = levelFromXp(nextXp);

    await run(
      'UPDATE user_progression SET xp = ?, level = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [nextXp, nextLevel, userId]
    );
    const unlocks = await this.syncLevelUnlocks(userId, nextLevel);
    const progression = await this.getProgression(userId);

    return {
      ...progression,
      addedXp,
      leveledUp: nextLevel > before.level,
      unlockedRewards: unlocks.rewards,
      unlockedBackgrounds: unlocks.backgrounds,
    };
  },

  async syncLevelUnlocks(userId, level) {
    const rewardCodes = XP_UNLOCK_REWARDS
      .filter((item) => item.level <= level)
      .map((item) => item.code);
    const backgroundSlugs = XP_UNLOCK_BACKGROUNDS
      .filter((item) => item.level <= level)
      .map((item) => item.slug);

    const rewards = await this.grantMany(userId, rewardCodes);
    const backgrounds = [];
    for (const slug of backgroundSlugs) {
      const background = await queryOne('SELECT slug FROM profile_backgrounds WHERE slug = ?', [slug]);
      if (!background) continue;
      await run(
        'INSERT IGNORE INTO user_backgrounds (user_id, background_slug) VALUES (?,?)',
        [userId, slug]
      );
      backgrounds.push(slug);
    }

    return { rewards, backgrounds };
  },
};
