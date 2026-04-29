import { query, queryOne, run } from '../config/mysql.js';

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
};
