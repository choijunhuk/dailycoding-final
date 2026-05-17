import test from 'node:test';
import assert from 'node:assert/strict';

import { COMPANY_TAG_PREFIX, PROBLEMS, MIN_HIDDEN_TESTCASES } from './problemCatalog.js';

test('shared problem catalog exposes expanded seeded problems with unique ids', () => {
  const ids = PROBLEMS.map((problem) => problem.id);
  assert.ok(PROBLEMS.length >= 280, `expected at least 280 problems, got ${PROBLEMS.length}`);
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


test('problem catalog keeps user-facing titles unique', () => {
  const seen = new Set();
  for (const problem of PROBLEMS) {
    assert.equal(seen.has(problem.title), false, `duplicate title: ${problem.title}`);
    seen.add(problem.title);
  }
});

test('practice expansion pack exposes company tags and seed editorials', () => {
  const expansion = PROBLEMS.filter((problem) => problem.id >= 8001 && problem.id <= 8100);
  assert.equal(expansion.length, 100, 'practice expansion pack should add exactly 100 problems');
  for (const problem of expansion) {
    assert.ok(problem.tags.some((tag) => tag.startsWith(COMPANY_TAG_PREFIX)), `problem ${problem.id} needs a company tag`);
    assert.ok(problem.tags.includes('학습팩'), `problem ${problem.id} should be discoverable as 학습팩`);
    assert.match(problem.solution, /공식 해설/, `problem ${problem.id} should include seed editorial text`);
  }
});

test('compact grid catalog problems use digit-by-digit parsing', () => {
  const problem = PROBLEMS.find((item) => item.id === 3059);
  assert.ok(problem, 'problem 3059 should exist');
  assert.equal(problem.examples[0].output, '4');
  assert.equal(problem.testcases.find((item) => item.input === '3 3\n111\n111\n111')?.output, '9');
});
