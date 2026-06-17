import { test } from 'vitest'
import assert from 'node:assert/strict'
import { buildArcadeRecommendations, buildArcadeResultGoal } from './arcadeExperienceUtils.js'

const games = [
  { key: 'snake', name: 'Vim Snake', nameKo: '빔 스네이크', category: 'classic' },
  { key: 'code-typing', name: 'Code Typing', nameKo: '코드 타자', category: 'typing' },
  { key: 'bigo-quiz', name: 'Big-O Quiz', nameKo: '빅오 퀴즈', category: 'algorithm' },
]

test('buildArcadeRecommendations starts with the best owned game', () => {
  const recs = buildArcadeRecommendations({
    games,
    bestByGame: { snake: { best: 420, plays: 5 } },
    topByGame: {},
    lang: 'ko',
  })

  assert.equal(recs[0].key, 'continue-best')
  assert.equal(recs[0].gameKey, 'snake')
  assert.match(recs[0].stat, /420/)
})

test('buildArcadeRecommendations includes quick and leaderboard actions', () => {
  const recs = buildArcadeRecommendations({
    games,
    bestByGame: {},
    topByGame: { 'bigo-quiz': [{ username: 'ranker', score: 9 }] },
    lang: 'en',
  })

  assert.equal(recs.some((rec) => rec.key === 'quick-run'), true)
  assert.equal(recs.some((rec) => rec.key === 'leaderboard-chase'), true)
})

test('buildArcadeResultGoal creates a score target', () => {
  const goal = buildArcadeResultGoal({
    gameKey: 'snake',
    result: { score: 120, best: 150, approxRank: 8 },
    lang: 'ko',
  })

  assert.equal(goal.key, 'beat-score')
  assert.match(goal.target, /151/)
})

test('buildArcadeResultGoal creates a time target', () => {
  const goal = buildArcadeResultGoal({
    gameKey: 'tetris',
    result: { score: 0, meta: { mode: 'sprint', elapsed: 73, finished: true } },
    lang: 'en',
  })

  assert.equal(goal.key, 'shave-time')
  assert.match(goal.target, /1m 10s/)
})

test('buildArcadeResultGoal creates a survival target', () => {
  const goal = buildArcadeResultGoal({
    gameKey: 'tetris',
    result: { score: 0, meta: { mode: 'classic', elapsed: 45 } },
    lang: 'ko',
  })

  assert.equal(goal.key, 'survive-longer')
  assert.match(goal.target, /50s/)
})
