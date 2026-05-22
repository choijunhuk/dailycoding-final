import test from 'node:test';
import assert from 'node:assert/strict';

import { localizeMessage, normalizeLocale } from './locale.js';

test('normalizeLocale resolves supported app languages from request headers', () => {
  assert.equal(normalizeLocale('ko-KR,ko;q=0.9,en;q=0.8'), 'ko');
  assert.equal(normalizeLocale('en-US,en;q=0.9'), 'en');
  assert.equal(normalizeLocale('fr-FR,fr;q=0.9'), 'en');
});

test('localizeMessage maps known server messages in both directions', () => {
  assert.equal(localizeMessage('Problem not found.', 'ko'), '문제를 찾을 수 없습니다.');
  assert.equal(localizeMessage('문제를 찾을 수 없습니다.', 'en'), 'Problem not found.');
  assert.equal(localizeMessage('Item is on cooldown.', 'ko'), '아이템이 쿨다운 중입니다.');
  assert.equal(localizeMessage('At least 10 hidden test cases are required.', 'ko'), '히든 테스트케이스는 최소 10개 필요합니다.');
  assert.equal(localizeMessage({ ko: '삭제됐습니다.', en: 'Deleted successfully.' }, 'ko'), '삭제됐습니다.');
  assert.equal(localizeMessage({ ko: '삭제됐습니다.', en: 'Deleted successfully.' }, 'en'), 'Deleted successfully.');
});
