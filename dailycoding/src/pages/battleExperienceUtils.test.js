import { test } from 'vitest'
import assert from 'node:assert/strict'
import { buildAlgorithmRoomCoach, buildBattleLobbyCoach } from './battleExperienceUtils.js'

test('buildBattleLobbyCoach recommends spectating when live battles exist', () => {
  const coach = buildBattleLobbyCoach({
    activeBattles: [{ id: 'r1' }],
    historyRows: [],
    lang: 'ko',
  })

  assert.equal(coach.key, 'spectate-live')
  assert.equal(coach.action, 'spectate')
  assert.match(coach.title, /관전/)
})

test('buildBattleLobbyCoach recommends rematch after recent losses', () => {
  const coach = buildBattleLobbyCoach({
    activeBattles: [],
    historyRows: [
      { result: 'lose', opponentName: 'neo', roomId: 'old-1' },
      { result: 'lose', opponentName: 'neo', roomId: 'old-2' },
      { result: 'win', opponentName: 'kim', roomId: 'old-3' },
    ],
    lang: 'ko',
  })

  assert.equal(coach.key, 'rematch-loss')
  assert.equal(coach.action, 'history')
  assert.match(coach.description, /패배/)
})

test('buildBattleLobbyCoach recommends harder mode after strong record', () => {
  const coach = buildBattleLobbyCoach({
    activeBattles: [],
    historyRows: [
      { result: 'win' },
      { result: 'win' },
      { result: 'draw' },
    ],
    selectedBattleMode: 'race',
    selectedDuration: 300,
    lang: 'en',
  })

  assert.equal(coach.key, 'raise-pressure')
  assert.match(coach.description, /harder/i)
})

test('buildBattleLobbyCoach gives first invite direction without history', () => {
  const coach = buildBattleLobbyCoach({ activeBattles: [], historyRows: [], lang: 'ko' })

  assert.equal(coach.key, 'first-invite')
  assert.equal(coach.action, 'invite')
  assert.match(coach.title, /첫/)
})

test('buildAlgorithmRoomCoach explains waiting room actions', () => {
  const coach = buildAlgorithmRoomCoach({
    room: { status: 'waiting', createdBy: 1 },
    me: { isReady: false },
    lang: 'ko',
  })

  assert.equal(coach.key, 'waiting-ready')
  assert.equal(coach.tone, 'ready')
  assert.match(coach.actionLabel, /준비/)
})

test('buildAlgorithmRoomCoach explains playing win condition', () => {
  const coach = buildAlgorithmRoomCoach({
    room: { status: 'playing', mode: 'sort-speed' },
    config: { winCondition: 'first-correct' },
    timeLeftSec: 220,
    lang: 'en',
  })

  assert.equal(coach.key, 'playing-first-correct')
  assert.match(coach.description, /first correct/i)
})

test('buildAlgorithmRoomCoach explains spectator restrictions', () => {
  const coach = buildAlgorithmRoomCoach({
    room: { status: 'playing' },
    isSpectating: true,
    lang: 'ko',
  })

  assert.equal(coach.key, 'spectating')
  assert.match(coach.description, /비활성/)
})

test('buildAlgorithmRoomCoach gives finished next action', () => {
  const coach = buildAlgorithmRoomCoach({
    room: { status: 'finished' },
    me: { score: 12 },
    lang: 'en',
  })

  assert.equal(coach.key, 'finished-review')
  assert.match(coach.actionLabel, /review/i)
})
