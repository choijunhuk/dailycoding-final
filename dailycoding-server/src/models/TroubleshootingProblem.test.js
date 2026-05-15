import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_HOST = 'invalid_host';
process.env.REDIS_URL = 'redis://invalid:6379';
process.env.JWT_SECRET = 'test_secret';

import { insert, waitForDB } from '../config/mysql.js';
import { TroubleshootingProblem } from './TroubleshootingProblem.js';

test('troubleshooting config stores files and hides hidden tests for public reads', async () => {
  await waitForDB();
  const problemId = await insert(
    'INSERT INTO problems (title, problem_type, description) VALUES (?,?,?)',
    ['Troubleshooting API', 'troubleshooting', 'Fix slow API']
  );

  await TroubleshootingProblem.upsertConfig(problemId, {
    scenarioTitle: '느린 API 개선',
    scenarioDescription: '응답 시간을 줄이세요.',
    initialFiles: [{ path: 'server.js', content: 'console.log("slow")', editable: true }],
    visibleTests: [{ name: 'visible', command: ['node', 'server.js'], expectedOutput: 'fast' }],
    hiddenTests: [{ name: 'hidden', command: ['node', 'server.js'], expectedOutput: 'fast' }],
    targetResponseTimeMs: 500,
    allowedFiles: ['server.js'],
    forbiddenPatterns: ['eval\\('],
  });

  const publicConfig = await TroubleshootingProblem.findConfig(problemId);
  assert.equal(publicConfig.scenarioTitle, '느린 API 개선');
  assert.equal(publicConfig.hiddenTests, undefined);
  assert.equal(publicConfig.hiddenTestCount, 1);
  assert.equal(publicConfig.initialFiles[0].path, 'server.js');

  const adminConfig = await TroubleshootingProblem.findConfig(problemId, { includeHidden: true });
  assert.equal(adminConfig.hiddenTests.length, 1);
});

test('troubleshooting submission persists rich scoring fields', async () => {
  await waitForDB();
  const problemId = await insert(
    'INSERT INTO problems (title, problem_type, description) VALUES (?,?,?)',
    ['Troubleshooting Submit', 'performance-fix', 'Fix perf']
  );

  const row = await TroubleshootingProblem.createSubmission({
    userId: 1,
    problemId,
    submittedFiles: [{ path: 'server.js', content: 'console.log("fast")' }],
    evaluation: {
      result: 'correct',
      totalScore: 95,
      correctnessScore: 50,
      performanceScore: 30,
      readabilityScore: 15,
      testPassCount: 2,
      totalTestCount: 2,
      executionTimeMs: 120,
      memoryUsedMb: null,
      changedFilesCount: 2,
      improvementRate: 0.8,
      feedback: '좋습니다.',
    },
  });

  assert.equal(row.result, 'correct');
  assert.equal(row.totalScore, 95);
  assert.equal(row.testPassCount, 2);
  assert.equal(row.changedFilesCount, 2);
  assert.equal(row.detail.totalScore, 95);
});
