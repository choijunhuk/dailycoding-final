import { test } from 'vitest';
import assert from 'node:assert/strict';
import { buildDailyFocusPlan } from './dashboardPlanUtils.js';

const todayProblem = {
  id: 1001,
  title: 'A+B',
  tier: 'bronze',
  tags: ['구현', '수학'],
};

test('buildDailyFocusPlan starts with the current recommended problem', () => {
  const plan = buildDailyFocusPlan({
    todayProblem,
    solvedCount: 3,
    totalProblems: 10,
  });

  assert.equal(plan[0].key, 'today-problem');
  assert.equal(plan[0].path, '/problems/1001');
  assert.equal(plan[0].stat, 'bronze · 구현 · 수학');
});

test('buildDailyFocusPlan prioritizes unresolved recovery work over weekly challenge', () => {
  const plan = buildDailyFocusPlan({
    todayProblem,
    recoveryQueue: {
      count: 2,
      items: [{ problemId: 2001, problemTitle: '틀린 문제', priority: 'high', result: 'wrong', submissionId: 9 }],
    },
    weeklyChallenge: { problemId: 3001, problemTitle: '주간 문제', isSolved: false },
  });

  assert.equal(plan[1].key, 'recovery');
  assert.equal(plan[1].path, '/problems/2001');
  assert.equal(plan[1].stat, '우선 복구');
  assert.equal(plan.find((card) => card.key === 'weekly-challenge'), undefined);
});

test('buildDailyFocusPlan uses weekly challenge when there is no recovery item', () => {
  const plan = buildDailyFocusPlan({
    todayProblem,
    recoveryQueue: { count: 0, items: [] },
    weeklyChallenge: { problemId: 3001, problemTitle: '주간 문제', isSolved: false, tier: 'silver', difficulty: 2 },
  });

  assert.equal(plan[1].key, 'weekly-challenge');
  assert.equal(plan[1].path, '/problems/3001');
  assert.equal(plan[1].stat, 'silver · 난이도 2');
});

test('buildDailyFocusPlan falls back to progression and caps the card count', () => {
  const plan = buildDailyFocusPlan({
    todayProblem,
    weeklyChallenge: { problemId: 3001, problemTitle: '주간 문제', isSolved: true },
    progression: { level: 4, xp: 1250, progressPercent: 87 },
  });

  assert.equal(plan.length, 4);
  assert.equal(plan[1].key, 'progression');
  assert.equal(plan[1].path, '/profile');
  assert.equal(plan[1].stat, '87%');
});
