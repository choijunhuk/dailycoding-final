import test from 'node:test';
import assert from 'node:assert/strict';

import { PROBLEMS, MIN_HIDDEN_TESTCASES } from './problemCatalog.js';

test('shared problem catalog exposes at least 70 seeded problems with unique ids', () => {
  const ids = PROBLEMS.map((problem) => problem.id);
  assert.ok(PROBLEMS.length >= 70, `expected at least 70 problems, got ${PROBLEMS.length}`);
  assert.equal(new Set(ids).size, ids.length, 'problem ids must be unique');
});

test('every seeded problem includes the minimum hidden testcase count', () => {
  for (const problem of PROBLEMS) {
    assert.ok(
      Array.isArray(problem.testcases) && problem.testcases.length >= MIN_HIDDEN_TESTCASES,
      `problem ${problem.id} is missing hidden testcases`,
    );
  }
});
