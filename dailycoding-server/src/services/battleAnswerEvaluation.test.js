import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateBugFixAnswer, evaluateFillBlankAnswer } from './battleAnswerEvaluation.js';

test('fill blank answers can be grouped as order-insensitive', () => {
  const problem = {
    type: 'fill-blank',
    blanks: ['1', '1', '2'],
    answerGroups: [[0], [1, 2]],
  };

  assert.equal(evaluateFillBlankAnswer(problem, ['1', '2', '1']), true);
  assert.equal(evaluateFillBlankAnswer(problem, ['1', '2', '2']), false);
});

test('fill blank answers normalize code whitespace', () => {
  const problem = {
    type: 'fill-blank',
    blanks: ['mid + 1'],
  };

  assert.equal(evaluateFillBlankAnswer(problem, ['mid+1']), true);
  assert.equal(evaluateFillBlankAnswer(problem, ['mid - 1']), false);
});

test('fill blank evaluator infers fibonacci interchangeable recursive steps', () => {
  const problem = {
    title: '빈칸 채우기: 재귀 피보나치',
    codeTemplate: 'return fib(n - ___2___) + fib(n - ___3___)',
    blanks: ['1', '1', '2'],
  };

  assert.equal(evaluateFillBlankAnswer(problem, ['1', '2', '1']), true);
});

test('bug fix evaluator accepts keyword variants with whitespace differences', () => {
  const problem = {
    correctAnswerKeyword: 'n - i - 1',
  };

  assert.equal(evaluateBugFixAnswer(problem, 'for j in range(n-i-1):'), true);
});
