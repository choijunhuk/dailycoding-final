import { test } from 'vitest';
import assert from 'node:assert/strict';
import { buildRecoveryGroups, pickPrimaryRecoveryAction } from './recoveryPageUtils.js';

const items = [
  { submissionId: 1, problemId: 101, problemTitle: '시간 제한', cause: '시간 초과', priority: 'high', tags: ['dp'], lang: 'python' },
  { submissionId: 2, problemId: 102, problemTitle: '컴파일', cause: '컴파일 오류', priority: 'medium', tags: ['문자열'], lang: 'cpp' },
  { submissionId: 3, problemId: 103, problemTitle: '다시 시간', cause: '시간 초과', priority: 'medium', tags: ['dp'], lang: 'python' },
];

test('buildRecoveryGroups groups queue items by cause and keeps counts', () => {
  const groups = buildRecoveryGroups(items, 'ko');

  assert.equal(groups.length, 2);
  assert.equal(groups[0].cause, '시간 초과');
  assert.equal(groups[0].count, 2);
  assert.deepEqual(groups[0].topTags, ['dp']);
  assert.equal(groups[1].cause, '컴파일 오류');
});

test('pickPrimaryRecoveryAction prefers high-priority failed work', () => {
  const action = pickPrimaryRecoveryAction(items, 'ko');

  assert.equal(action.problemId, 101);
  assert.equal(action.label, '가장 먼저 복구');
  assert.match(action.reason, /시간 초과/);
});

test('pickPrimaryRecoveryAction returns a positive empty-state action', () => {
  const action = pickPrimaryRecoveryAction([], 'en');

  assert.equal(action.problemId, null);
  assert.equal(action.label, 'Start a new challenge');
  assert.match(action.reason, /No unresolved/i);
});
