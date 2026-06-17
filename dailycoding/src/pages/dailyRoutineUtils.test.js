import { test } from 'vitest';
import assert from 'node:assert/strict';
import { buildDailyRoutine } from './dailyRoutineUtils.js';

const todayProblem = {
  id: 1001,
  title: 'A+B',
  tier: 'bronze',
  tags: ['math'],
};

test('buildDailyRoutine puts unresolved recovery work first', () => {
  const routine = buildDailyRoutine({
    todayProblem,
    recoveryQueue: {
      count: 2,
      items: [{ problemId: 2001, problemTitle: '실패 문제', result: 'wrong', submissionId: 9, priority: 'high' }],
    },
    solvedCount: 4,
    totalProblems: 20,
    lang: 'ko',
  });

  assert.equal(routine.primary.key, 'recovery');
  assert.equal(routine.primary.path, '/recovery');
  assert.equal(routine.primary.state.highlightId, 9);
  assert.match(routine.primary.reason, /오답/);
  assert.equal(routine.checklist[0].done, false);
});

test('buildDailyRoutine prioritizes onboarding when no recovery is pending', () => {
  const routine = buildDailyRoutine({
    todayProblem,
    recoveryQueue: { count: 0, items: [] },
    onboardingPlan: {
      active: true,
      dayNumber: 3,
      totalDays: 14,
      problems: [
        { id: 1001, title: 'A+B', solvedToday: true },
        { id: 1002, title: '사칙연산', solvedToday: false },
        { id: 1003, title: '피보나치', solvedToday: false },
      ],
    },
    lang: 'ko',
  });

  assert.equal(routine.primary.key, 'onboarding');
  assert.equal(routine.primary.path, '/problems/1002');
  assert.equal(routine.primary.stat, '1/3 완료');
  assert.match(routine.primary.description, /Day 3/);
  assert.equal(routine.onboarding.completed, 1);
  assert.equal(routine.onboarding.remaining, 2);
});

test('buildDailyRoutine recommends battle after practice is in good shape', () => {
  const routine = buildDailyRoutine({
    todayProblem,
    recoveryQueue: { count: 0, items: [] },
    battleSummary: { total: 12, winRate: 58 },
    reviewQueue: [],
    solvedCount: 18,
    totalProblems: 30,
    lang: 'en',
  });

  assert.equal(routine.primary.key, 'today-problem');
  assert.equal(routine.secondary.some((item) => item.key === 'battle'), true);
  assert.match(routine.secondary.find((item) => item.key === 'battle').reason, /match readiness/i);
});

test('buildDailyRoutine returns a useful empty state when no problem exists', () => {
  const routine = buildDailyRoutine({
    recoveryQueue: { count: 0, items: [] },
    reviewQueue: [],
    solvedCount: 0,
    totalProblems: 0,
    lang: 'ko',
  });

  assert.equal(routine.primary.key, 'explore');
  assert.equal(routine.primary.path, '/problems');
  assert.match(routine.primary.title, /문제/);
});
