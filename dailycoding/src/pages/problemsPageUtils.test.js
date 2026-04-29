import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getProblemTypeMeta,
  getStoredView,
  parsePositiveInt,
  resolveStoredView,
  sortProblems,
} from './problemsPageUtils.js';

test('resolveStoredView and getStoredView fall back to table', () => {
  assert.equal(resolveStoredView('card'), 'card');
  assert.equal(resolveStoredView('weird'), 'table');
  assert.equal(getStoredView({ getItem: () => 'table' }), 'table');
  assert.equal(getStoredView({ getItem: () => 'invalid' }), 'table');
});

test('parsePositiveInt clamps invalid values', () => {
  assert.equal(parsePositiveInt('7'), 7);
  assert.equal(parsePositiveInt('0', 3), 3);
  assert.equal(parsePositiveInt('nope', 2), 2);
});

test('sortProblems supports newest and solved ordering', () => {
  const rows = [
    { id: 1, created_at: '2026-01-01', solved_count: 3 },
    { id: 2, created_at: '2026-02-01', solved_count: 1 },
    { id: 3, created_at: '2026-03-01', solved_count: 5 },
  ];
  assert.deepEqual(sortProblems(rows, 'newest').map((row) => row.id), [3, 2, 1]);
  assert.deepEqual(sortProblems(rows, 'solved').map((row) => row.id), [3, 1, 2]);
});

test('getProblemTypeMeta returns coding fallback', () => {
  assert.equal(getProblemTypeMeta('fill-blank').short, '빈칸');
  assert.equal(getProblemTypeMeta('unknown').short, '코딩');
});
