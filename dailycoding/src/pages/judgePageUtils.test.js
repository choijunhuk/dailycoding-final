import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CODE,
  getDraftStorageKey,
  getLegacyDraftStorageKey,
  getSnippetStorageKey,
  parseSpecialConfig,
  TEMPLATES,
} from './judgePageUtils.js';

test('judge storage keys stay stable', () => {
  assert.equal(getDraftStorageKey(10, 'python'), 'judge:draft:10:python');
  assert.equal(getLegacyDraftStorageKey(10, 'python'), 'dc_code_10_python');
  assert.equal(getSnippetStorageKey(10, 'python'), 'snippet:10:python');
});

test('parseSpecialConfig handles object, json, and invalid values', () => {
  assert.deepEqual(parseSpecialConfig({ a: 1 }), { a: 1 });
  assert.deepEqual(parseSpecialConfig('{"a":1}'), { a: 1 });
  assert.equal(parseSpecialConfig('bad-json'), null);
});

test('judge defaults expose expected languages and templates', () => {
  assert.ok(DEFAULT_CODE.python.startsWith('# Python 3'));
  assert.ok(Array.isArray(TEMPLATES.python));
  assert.ok(TEMPLATES.python.length > 0);
});
