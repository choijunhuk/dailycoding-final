import assert from 'node:assert/strict';
import test from 'node:test';
import { BattleMode, validateBattleModeConfig } from './BattleMode.js';
import { waitForDB } from '../config/mysql.js';

const VALID_CONFIG = {
  baseHp: 120,
  timeLimit: 1800,
  allowItems: true,
  startingItems: ['shield'],
  rules: [
    {
      id: 'rule_1',
      event: 'ON_CORRECT_ANSWER',
      condition: { type: 'always' },
      action: { type: 'MODIFY_HP', target: 'self', value: 15 },
    },
  ],
};

test('BattleMode validates and stores workshop configs', async () => {
  await waitForDB();
  const mode = await BattleMode.create({
    name: `테스트 워크샵 ${Date.now()}`,
    description: '검증용 모드',
    authorId: null,
    config: VALID_CONFIG,
    isPublic: true,
  });

  assert.ok(mode.id);
  assert.equal(mode.config.baseHp, 120);
  assert.equal(mode.config.rules[0].event, 'ON_CORRECT_ANSWER');

  const like = await BattleMode.toggleLike(12345, mode.id);
  assert.deepEqual(like, { liked: true, likeCount: 1 });

  const unlike = await BattleMode.toggleLike(12345, mode.id);
  assert.deepEqual(unlike, { liked: false, likeCount: 0 });
});

test('BattleMode rejects unknown rule types and excessive rules', () => {
  assert.throws(() => validateBattleModeConfig({
    ...VALID_CONFIG,
    rules: [{ ...VALID_CONFIG.rules[0], event: 'ON_UNKNOWN' }],
  }), /지원하지 않는 이벤트/);

  assert.throws(() => validateBattleModeConfig({
    ...VALID_CONFIG,
    rules: Array.from({ length: 21 }, (_, index) => ({ ...VALID_CONFIG.rules[0], id: `rule_${index}` })),
  }), /최대 20개/);
});
