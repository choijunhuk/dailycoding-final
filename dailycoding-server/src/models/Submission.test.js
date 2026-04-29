import test from 'node:test';
import assert from 'node:assert/strict';

import { Submission } from './Submission.js';

test('normalizeSolveTimeSec rejects unrealistic values and rounds valid input', () => {
  assert.equal(Submission.normalizeSolveTimeSec(-1), null);
  assert.equal(Submission.normalizeSolveTimeSec(3), null);
  assert.equal(Submission.normalizeSolveTimeSec(120), 120);
  assert.equal(Submission.normalizeSolveTimeSec(120.6), 121);
  assert.equal(Submission.normalizeSolveTimeSec(99999), null);
  assert.equal(Submission.normalizeSolveTimeSec(86400), 86400);
});
