import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test_secret';

const { normalizeProblemMutationPayload, sanitizeProblemForClient } = await import('./problems.js');

test('coding problems still require minimum hidden testcases', () => {
  const result = normalizeProblemMutationPayload({
    problemType: 'coding',
    testcases: [{ input: '1', output: '2' }],
  });

  assert.equal(result.payload, undefined);
  assert.match(result.error, /히든 테스트케이스는 최소/);
});

test('fill-blank problems normalize special config without hidden testcase requirement', () => {
  const result = normalizeProblemMutationPayload({
    problemType: 'fill-blank',
    hint: '배열 합을 떠올려보세요.',
    testcases: [],
    specialConfig: {
      codeTemplate: 'def solve(nums):\n    return ___1___\n',
      blanks: ['sum(nums)', '  '],
      hint: '합계를 반환하세요.',
    },
  });

  assert.equal(result.error, undefined);
  assert.equal(result.payload.problemType, 'fill-blank');
  assert.deepEqual(result.payload.specialConfig, {
    codeTemplate: 'def solve(nums):\n    return ___1___',
    blanks: ['sum(nums)'],
    hint: '합계를 반환하세요.',
  });
});

test('bug-fix problems require at least one keyword and buggy code', () => {
  const missingKeywords = normalizeProblemMutationPayload({
    problemType: 'bug-fix',
    specialConfig: {
      buggyCode: 'function sum(arr) { return 1; }',
      keywords: [],
    },
  });
  assert.match(missingKeywords.error, /정답 키워드/);

  const valid = normalizeProblemMutationPayload({
    problemType: 'bug-fix',
    specialConfig: {
      buggyCode: 'function sum(arr) { return 1; }\n',
      keywords: ['return 0', '초기값'],
      explanation: '초기값이 잘못되었습니다.',
    },
  });

  assert.equal(valid.error, undefined);
  assert.deepEqual(valid.payload.specialConfig, {
    buggyCode: 'function sum(arr) { return 1; }',
    keywords: ['return 0', '초기값'],
    explanation: '초기값이 잘못되었습니다.',
  });
});

test('public problem payload hides solution and hidden testcases', () => {
  const safe = sanitizeProblemForClient({
    id: 1001,
    title: 'A+B',
    solution: 'printf("%d", a + b);',
    testcases: [
      { input: '1 2', output: '3' },
      { input: '3 4', output: '7' },
    ],
  });

  assert.equal(safe.solution, undefined);
  assert.equal(safe.testcases, undefined);
  assert.equal(safe.hiddenCount, 2);
});

test('admin problem payload keeps judge-only fields for editing', () => {
  const problem = {
    id: 1001,
    solution: 'answer',
    testcases: [{ input: '1 2', output: '3' }],
  };

  assert.equal(sanitizeProblemForClient(problem, { isAdmin: true }), problem);
});
