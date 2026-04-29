import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test_secret';

const { normalizeProblemMutationPayload } = await import('./problems.js');

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
