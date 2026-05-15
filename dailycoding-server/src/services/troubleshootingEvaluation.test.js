import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateTroubleshootingSubmission, isSafeRelativePath } from './troubleshootingEvaluation.js';

test('safe relative path validation rejects traversal and absolute paths', () => {
  assert.equal(isSafeRelativePath('server.js'), true);
  assert.equal(isSafeRelativePath('src/db.js'), true);
  assert.equal(isSafeRelativePath('../secret.js'), false);
  assert.equal(isSafeRelativePath('/etc/passwd'), false);
});

test('troubleshooting evaluator returns rich score fields for passing visible tests', async () => {
  const result = await evaluateTroubleshootingSubmission({
    config: {
      initialFiles: [
        { path: 'server.js', content: 'console.log("slow")\n', editable: true },
        { path: 'test.js', content: 'require("./server")\n', editable: false },
      ],
      visibleTests: [
        { name: 'prints-fast', command: ['node', 'test.js'], expectedOutput: 'fast' },
      ],
      hiddenTests: [],
      baselineTimeMs: 1000,
      targetResponseTimeMs: 1500,
      performanceLimitMs: 1000,
      forbiddenPatterns: ['eval\\('],
    },
    submittedFiles: [
      { path: 'server.js', content: 'console.log("fast")\n' },
      { path: 'test.js', content: 'require("./server")\n' },
    ],
    includeHidden: false,
  });

  assert.equal(result.result, 'correct');
  assert.equal(result.correctnessScore, 50);
  assert.equal(result.performanceScore, 30);
  assert.equal(result.readabilityScore, 20);
  assert.equal(result.testPassCount, 1);
  assert.equal(result.totalTestCount, 1);
  assert.equal(result.changedFilesCount, 1);
  assert.equal(typeof result.executionTimeMs, 'number');
  assert.match(result.feedback, /모든 테스트/);
});

test('troubleshooting evaluator rejects readonly file changes', async () => {
  const result = await evaluateTroubleshootingSubmission({
    config: {
      initialFiles: [
        { path: 'app.js', content: 'console.log("ok")\n', editable: true },
        { path: 'test.js', content: 'require("./app")\n', editable: false },
      ],
      visibleTests: [{ name: 'static', command: ['node', 'test.js'], expectedOutput: 'ok' }],
      forbiddenPatterns: [],
    },
    submittedFiles: [
      { path: 'app.js', content: 'console.log("ok")\n' },
      { path: 'test.js', content: 'console.log("tampered")\n' },
    ],
  });

  assert.equal(result.result, 'wrong');
  assert.match(result.feedback, /수정할 수 없는 파일/);
});
