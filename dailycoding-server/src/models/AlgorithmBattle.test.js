import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_HOST = 'invalid_host';
process.env.REDIS_URL = 'redis://invalid:6379';
process.env.JWT_SECRET = 'test_secret';

import { insert, query, run, waitForDB } from '../config/mysql.js';
import { AlgorithmBattle, calculateBattleScore } from './AlgorithmBattle.js';

test('battle score rewards correctness and fast execution', () => {
  const fast = calculateBattleScore({ isCorrect: true, executionTimeMs: 100, memoryMb: 16, elapsedSec: 5 });
  const slow = calculateBattleScore({ isCorrect: true, executionTimeMs: 1500, memoryMb: 128, elapsedSec: 60 });
  const wrong = calculateBattleScore({ isCorrect: false, executionTimeMs: 50, elapsedSec: 5 });

  assert.equal(fast.correctnessBase, 100);
  assert.ok(fast.score > slow.score);
  assert.ok(fast.speed > slow.speed);
  assert.equal(wrong.score, 0);
  assert.equal(wrong.attackPower, 0);
});

test('algorithm battle lifecycle creates, joins, starts, submits, and finishes', async () => {
  await waitForDB();
  const userA = await insert('INSERT INTO users (email, username, role) VALUES (?,?,?)', ['battle-a@test.com', 'BattleA', 'user']);
  const userB = await insert('INSERT INTO users (email, username, role) VALUES (?,?,?)', ['battle-b@test.com', 'BattleB', 'user']);
  const problemId = await insert(
    'INSERT INTO problems (title, problem_type, description, visibility) VALUES (?,?,?,?)',
    ['Sort Battle Test', 'coding', 'Sort numbers', 'global']
  );

  const created = await AlgorithmBattle.createRoom({
    creatorId: userA,
    problemId,
    mode: 'duel-effects',
    maxPlayers: 2,
    durationSec: 120,
    bannedTags: ['그래프'],
  });
  assert.equal(created.room.status, 'waiting');
  assert.equal(created.participants.length, 1);
  assert.equal(created.config.key, 'duel-effects');
  assert.deepEqual(created.config.bannedTags, ['그래프']);

  const joined = await AlgorithmBattle.joinRoom(created.room.id, userB);
  assert.equal(joined.participants.length, 2);

  await AlgorithmBattle.markReady(created.room.id, userA);
  const started = await AlgorithmBattle.markReady(created.room.id, userB);
  assert.equal(started.room.status, 'playing');

  const activity = await AlgorithmBattle.recordActivity(created.room.id, userA, { activity: '코드 작성 중' });
  assert.equal(activity.event.type, 'player.activity');
  assert.equal(activity.state.activityByUserId[String(userA)].label, '코드 작성 중');

  const chat = await AlgorithmBattle.recordChat(created.room.id, userA, { message: '<b>gg</b>' });
  assert.equal(chat.event.payload.message, '<b>gg</b>');

  const emote = await AlgorithmBattle.recordEmote(created.room.id, userB, { emote: 'taunt' });
  assert.equal(emote.event.payload.emote, 'taunt');

  const item = await AlgorithmBattle.useItem(created.room.id, userA, { itemType: 'lag-spike' });
  assert.equal(item.event.type, 'item.used');
  assert.deepEqual(item.event.payload.targetUserIds, [userB]);
  await assert.rejects(
    () => AlgorithmBattle.useItem(created.room.id, userA, { itemType: 'shield' }),
    /쿨다운/
  );

  const submitted = await AlgorithmBattle.recordSubmission({
    roomId: created.room.id,
    userId: userA,
    code: 'print(sorted(input().split()))',
    language: 'Python 3',
    judgeResult: { result: 'correct', timeMs: 120, memoryMb: 12, detail: 'ok' },
  });
  const playerA = submitted.participants.find((player) => player.userId === userA);
  const playerB = submitted.participants.find((player) => player.userId === userB);
  assert.ok(playerA.score > 0);
  assert.ok(playerB.characterHp < 100);
  assert.equal(submitted.submissions[0].isCorrect, true);
  assert.ok(submitted.events.some((event) => event.type === 'problem.effect'));

  const finished = await AlgorithmBattle.finishRoom(created.room.id, { reason: 'test' });
  assert.equal(finished.room.status, 'finished');
});

test('algorithm battle list hides and expires stale waiting rooms', async () => {
  await waitForDB();
  const userA = await insert('INSERT INTO users (email, username, role) VALUES (?,?,?)', ['battle-stale-a@test.com', 'BattleStaleA', 'user']);
  const problemId = await insert(
    'INSERT INTO problems (title, problem_type, description, visibility) VALUES (?,?,?,?)',
    ['Stale Battle Guard', 'coding', 'Sort numbers', 'global']
  );
  const created = await AlgorithmBattle.createRoom({ creatorId: userA, problemId, maxPlayers: 2 });
  await run(
    'UPDATE battle_rooms SET created_at = ?, lobby_expires_at = ? WHERE id = ?',
    ['2020-01-01 00:00:00', '2020-01-01 00:05:00', created.room.id]
  );

  const rooms = await AlgorithmBattle.listRooms();
  assert.equal(rooms.some((item) => item.room.id === created.room.id), false);

  const rows = await query('SELECT * FROM battle_rooms WHERE id = ?', [created.room.id]);
  assert.equal(rows[0]?.status, 'finished');
});

test('algorithm battle keeps a newly created room waiting in the lobby', async () => {
  await waitForDB();
  const userA = await insert('INSERT INTO users (email, username, role) VALUES (?,?,?)', ['battle-wait-a@test.com', 'BattleWaitA', 'user']);
  const problemId = await insert(
    'INSERT INTO problems (title, problem_type, description, visibility) VALUES (?,?,?,?)',
    ['Waiting Battle Guard', 'coding', 'Sort numbers', 'global']
  );

  const created = await AlgorithmBattle.createRoom({ creatorId: userA, problemId, maxPlayers: 2 });
  const createdAtMs = new Date(created.room.createdAt).getTime();
  const lobbyExpiresAtMs = new Date(created.room.lobbyExpiresAt).getTime();
  assert.ok(lobbyExpiresAtMs > createdAtMs);

  const rooms = await AlgorithmBattle.listRooms();
  const listed = rooms.find((item) => item.room.id === created.room.id);
  assert.equal(listed?.room.status, 'waiting');
  assert.equal(listed?.participants.length, 1);
});

test('algorithm battle does not award wins for abandoned single-player rooms', async () => {
  await waitForDB();
  const userA = await insert('INSERT INTO users (email, username, role) VALUES (?,?,?)', ['battle-solo-a@test.com', 'BattleSoloA', 'user']);
  const problemId = await insert(
    'INSERT INTO problems (title, problem_type, description, visibility) VALUES (?,?,?,?)',
    ['Solo Battle Guard', 'coding', 'Sort numbers', 'global']
  );
  const created = await AlgorithmBattle.createRoom({ creatorId: userA, problemId, maxPlayers: 2 });

  const finished = await AlgorithmBattle.finishRoom(created.room.id, { reason: 'lobby_expired' });
  assert.equal(finished.room.status, 'finished');

  const results = await query('SELECT * FROM battle_results WHERE room_id = ?', [created.room.id]);
  assert.equal(results.length, 0);
});

test('algorithm battle exposes mode metadata and blocks items in classic mode', async () => {
  await waitForDB();
  const modes = AlgorithmBattle.getBattleModes();
  assert.ok(modes.modes.some((mode) => mode.key === 'duel-effects'));
  assert.ok(modes.bannableTags.includes('정렬'));

  const userA = await insert('INSERT INTO users (email, username, role) VALUES (?,?,?)', ['battle-mode-a@test.com', 'BattleModeA', 'user']);
  const userB = await insert('INSERT INTO users (email, username, role) VALUES (?,?,?)', ['battle-mode-b@test.com', 'BattleModeB', 'user']);
  const problemId = await insert(
    'INSERT INTO problems (title, problem_type, description, visibility) VALUES (?,?,?,?)',
    ['Classic Battle Guard', 'coding', 'Sort numbers', 'global']
  );
  const created = await AlgorithmBattle.createRoom({ creatorId: userA, problemId, mode: 'sort-speed', maxPlayers: 2 });
  await AlgorithmBattle.joinRoom(created.room.id, userB);
  await AlgorithmBattle.startRoom(created.room.id);

  await assert.rejects(
    () => AlgorithmBattle.useItem(created.room.id, userA, { itemType: 'shield' }),
    /아이템/
  );
});

test('algorithm battle prevents non-participant submissions', async () => {
  await waitForDB();
  const userA = await insert('INSERT INTO users (email, username, role) VALUES (?,?,?)', ['battle-c@test.com', 'BattleC', 'user']);
  const intruder = await insert('INSERT INTO users (email, username, role) VALUES (?,?,?)', ['battle-x@test.com', 'BattleX', 'user']);
  const problemId = await insert(
    'INSERT INTO problems (title, problem_type, description, visibility) VALUES (?,?,?,?)',
    ['Sort Battle Guard', 'coding', 'Sort numbers', 'global']
  );
  const created = await AlgorithmBattle.createRoom({ creatorId: userA, problemId, maxPlayers: 2 });
  await AlgorithmBattle.startRoom(created.room.id);

  await assert.rejects(
    () => AlgorithmBattle.recordSubmission({
      roomId: created.room.id,
      userId: intruder,
      code: '',
      language: 'Python 3',
      judgeResult: { result: 'wrong', detail: 'nope' },
    }),
    /방 참가자/
  );
});
