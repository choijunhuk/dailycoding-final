import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../models/Battle.js';

test('Full Battle Flow: Invite -> Accept -> Submit -> End', async () => {
  // 1. 초기화 (Redis 폴백 확인)
  const inviter = { id: 1, username: 'user1' };
  const invited = { id: 2, username: 'user2' };

  // 2. 초대 생성
  const room = await Battle.createRoom(inviter, invited, { preferredLanguage: 'python' });
  assert.ok(room.id.startsWith('room_'));
  assert.equal(room.status, 'waiting');
  assert.equal(room.playerIds.length, 2);

  // 초대 확인
  const invite = await Battle.getInvite(invited.id);
  assert.equal(invite.roomId, room.id);
  assert.equal(invite.inviterName, inviter.username);

  // 3. 문제 선택 및 초대 수락
  const mockDbProblems = [
    { id: 101, title: 'Problem 1', problemType: 'coding', visibility: 'global' },
    { id: 102, title: 'Problem 2', problemType: 'coding', visibility: 'global' },
    { id: 'fb_1', title: 'Fill 1', problemType: 'fill-blank', visibility: 'global', specialConfig: { codeTemplate: '...', blanks: ['1'] } }
  ];
  
  const selectedProblems = await Battle.selectProblems(mockDbProblems, { preferredLanguage: 'python' });
  assert.ok(selectedProblems.length >= 1);

  const activeRoom = await Battle.acceptInvite(invited.id, room.id, selectedProblems);
  assert.equal(activeRoom.status, 'active');
  assert.ok(activeRoom.startTime > 0);
  assert.equal(activeRoom.problems.length, selectedProblems.length);

  // 초대 삭제 확인
  const deletedInvite = await Battle.getInvite(invited.id);
  assert.equal(deletedInvite, null);

  // 4. 답변 제출 (틀린 경우)
  const roomAfterFail = await Battle.submitAnswer(room.id, inviter.id, 101, false);
  assert.equal(roomAfterFail.players[inviter.id].score, 0);
  assert.equal(roomAfterFail.players[inviter.id].solved.length, 0);

  // 5. 답변 제출 (정답인 경우)
  const roomAfterSuccess = await Battle.submitAnswer(room.id, inviter.id, 101, true);
  assert.equal(roomAfterSuccess.players[inviter.id].score, 1);
  assert.equal(roomAfterSuccess.players[inviter.id].solved[0], "101");
  assert.equal(roomAfterSuccess.locked["101"], "team_1");

  // 6. 모든 문제 해결 시 자동 종료 확인
  // (현재 테스트 환경에서는 selectProblems 결과에 따라 다름. 하나 더 맞춰봄)
  for (const p of activeRoom.problems) {
    await Battle.submitAnswer(room.id, invited.id, p.id, true);
  }
  
  const finalRoom = await Battle.getRoom(room.id);
  assert.equal(finalRoom.status, 'ended');

  // 7. 명시적 종료 테스트
  const endedRoom = await Battle.endRoom(room.id);
  assert.equal(endedRoom.status, 'ended');
});

test('Battle: Typing indicator updates correctly', async () => {
  const inviter = { id: 1, username: 'user1' };
  const invited = { id: 2, username: 'user2' };
  const room = await Battle.createRoom(inviter, invited);

  await Battle.updateTyping(room.id, inviter.id, true);
  const updated = await Battle.getRoom(room.id);
  assert.equal(updated.players[inviter.id].typing, true);
  assert.ok(updated.players[inviter.id].typingAt > 0);
});
