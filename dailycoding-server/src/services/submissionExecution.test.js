import test from 'node:test';
import assert from 'node:assert/strict';

import { executeSubmissionFlow } from './submissionExecution.js';

test('non-persist run flow does not trigger persistence or ranking side effects', async () => {
  const calls = [];
  const problem = {
    id: 1,
    title: 'Echo',
    tier: 'bronze',
    timeLimit: 2,
    examples: [{ input: '1', output: '1' }],
    testcases: [{ input: '2', output: '2' }],
  };

  const result = await executeSubmissionFlow({
    problem,
    problemId: 1,
    userId: 7,
    rawLang: 'Python 3',
    code: 'print(input())',
    judgeRuntime: { mode: 'native-subprocess', supportedLanguages: ['python'] },
    persist: false,
    customInput: 'hello',
  }, {
    executeJudgeRequest: async (payload) => {
      calls.push({ type: 'executeJudgeRequest', payload });
      return { result: 'success', time: '1ms', mem: '-', detail: '실행 완료', output: 'hello' };
    },
    findSolvedSubmission: async () => { calls.push({ type: 'findSolvedSubmission' }); return null; },
    createSubmission: async () => { calls.push({ type: 'createSubmission' }); },
    incrementSubmit: async () => { calls.push({ type: 'incrementSubmit' }); },
    incrementSolved: async () => { calls.push({ type: 'incrementSolved' }); },
    onSolve: async () => { calls.push({ type: 'onSolve' }); },
    createNotification: async () => { calls.push({ type: 'createNotification' }); },
    invalidateRanking: async () => { calls.push({ type: 'invalidateRanking' }); },
  });

  assert.equal(result.execution.output, 'hello');
  assert.deepEqual(
    calls.map((entry) => entry.type),
    ['executeJudgeRequest']
  );
  assert.equal(calls[0].payload.executionMode, 'run');
  assert.equal(calls[0].payload.input, 'hello');
});

test('non-persist example run uses example cases only', async () => {
  let capturedPayload = null;
  const problem = {
    id: 1,
    title: 'Sample',
    tier: 'bronze',
    timeLimit: 2,
    examples: [{ input: '1', output: '1' }],
    testcases: [{ input: '2', output: '2' }],
  };

  await executeSubmissionFlow({
    problem,
    problemId: 1,
    userId: 7,
    rawLang: 'Python 3',
    code: 'print(input())',
    judgeRuntime: { mode: 'native-subprocess', supportedLanguages: ['python'] },
    persist: false,
  }, {
    executeJudgeRequest: async (payload) => {
      capturedPayload = payload;
      return { result: 'correct', time: '1ms', mem: '-', detail: 'ok' };
    },
  });

  assert.equal(capturedPayload.executionMode, 'judge');
  assert.deepEqual(capturedPayload.cases, problem.examples);
});

test('non-persist judge can opt into hidden cases without persistence side effects', async () => {
  let capturedPayload = null;
  const calls = [];
  const problem = {
    id: 2,
    title: 'Battle Sample',
    tier: 'bronze',
    timeLimit: 2,
    examples: [{ input: '1', output: '1' }],
    testcases: [{ input: '2', output: '2' }],
  };

  await executeSubmissionFlow({
    problem,
    problemId: 2,
    userId: 7,
    rawLang: 'Python 3',
    code: 'print(input())',
    judgeRuntime: { mode: 'native-subprocess', supportedLanguages: ['python'] },
    persist: false,
    includeHiddenCases: true,
  }, {
    executeJudgeRequest: async (payload) => {
      capturedPayload = payload;
      calls.push('executeJudgeRequest');
      return { result: 'correct', time: '1ms', mem: '-', detail: 'ok' };
    },
    createSubmission: async () => { calls.push('createSubmission'); },
  });

  assert.equal(capturedPayload.executionMode, 'judge');
  assert.deepEqual(capturedPayload.cases, [...problem.examples, ...problem.testcases]);
  assert.deepEqual(calls, ['executeJudgeRequest']);
});

test('persisted correct submit preserves submission-side effects', async () => {
  const calls = [];
  const problem = {
    id: 3,
    title: 'Solved',
    tier: 'silver',
    timeLimit: 2,
    examples: [{ input: '1', output: '1' }],
    testcases: [{ input: '2', output: '2' }],
  };

  const result = await executeSubmissionFlow({
    problem,
    problemId: 3,
    userId: 9,
    rawLang: 'Python 3',
    code: 'print(input())',
    judgeRuntime: { mode: 'native-subprocess', supportedLanguages: ['python'] },
    persist: true,
  }, {
    executeJudgeRequest: async (payload) => {
      calls.push({ type: 'executeJudgeRequest', payload });
      return { result: 'correct', time: '7ms', mem: '-', detail: '모든 테스트케이스 통과' };
    },
    findSolvedSubmission: async (...args) => {
      calls.push({ type: 'findSolvedSubmission', args });
      return null;
    },
    createSubmission: async (payload) => {
      calls.push({ type: 'createSubmission', payload });
      return { id: 55, problem_id: payload.problemId, result: payload.result, detail: payload.detail, submitted_at: new Date().toISOString() };
    },
    incrementSubmit: async (problemId) => { calls.push({ type: 'incrementSubmit', problemId }); },
    incrementSolved: async (problemId) => { calls.push({ type: 'incrementSolved', problemId }); },
    getTierPoints: (tier) => {
      calls.push({ type: 'getTierPoints', tier });
      return 35;
    },
    onSolve: async (userId, tier) => { calls.push({ type: 'onSolve', userId, tier }); },
    createNotification: async (userId, message, link) => { calls.push({ type: 'createNotification', userId, message, link }); },
    invalidateRanking: async () => { calls.push({ type: 'invalidateRanking' }); },
  });

  assert.equal(result.submission.id, 55);
  assert.deepEqual(
    calls.map((entry) => entry.type),
    [
      'executeJudgeRequest',
      'findSolvedSubmission',
      'createSubmission',
      'incrementSubmit',
      'getTierPoints',
      'incrementSolved',
      'onSolve',
      'createNotification',
      'invalidateRanking',
      'findSolvedSubmission',
    ]
  );
  assert.deepEqual(calls[0].payload.cases, [...problem.examples, ...problem.testcases]);
});
