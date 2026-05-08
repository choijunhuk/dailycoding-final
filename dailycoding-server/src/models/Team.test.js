import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_HOST = 'invalid_host';
process.env.REDIS_URL = 'redis://invalid:6379';
process.env.JWT_SECRET = 'test_secret';

import { insert, waitForDB } from '../config/mysql.js';
import { Team } from './Team.js';

test('free team affiliation can be created, joined, and inspected by members', async () => {
  await waitForDB();
  const ownerId = await insert('INSERT INTO users (email, username, role, rating) VALUES (?,?,?,?)', ['team-owner@test.com', 'TeamOwner', 'user', 1500]);
  const memberId = await insert('INSERT INTO users (email, username, role, rating) VALUES (?,?,?,?)', ['team-member@test.com', 'TeamMember', 'user', 900]);

  const teamId = await Team.create('무료 알고리즘 스터디', ownerId);
  await Team.addMember(teamId, memberId);

  const ownerTeam = await Team.findByUser(ownerId);
  const memberTeam = await Team.findByUser(memberId);
  assert.equal(ownerTeam.id, teamId);
  assert.equal(memberTeam.id, teamId);

  const state = await Team.getTeamState(teamId);
  assert.equal(state.members.length, 2);
  assert.equal(state.stats.memberCount, 2);
  assert.equal(state.members.find((member) => member.id === ownerId).role, 'admin');
});

test('users can belong to multiple affiliations and switch by team id', async () => {
  await waitForDB();
  const ownerId = await insert('INSERT INTO users (email, username, role, rating) VALUES (?,?,?,?)', ['team-multi-owner@test.com', 'TeamMultiOwner', 'user', 1500]);
  const memberId = await insert('INSERT INTO users (email, username, role, rating) VALUES (?,?,?,?)', ['team-multi-member@test.com', 'TeamMultiMember', 'user', 900]);

  const firstTeamId = await Team.create('첫 번째 소속', ownerId);
  const secondTeamId = await Team.create('두 번째 소속', ownerId);
  await Team.addMember(firstTeamId, memberId);
  await Team.addMember(secondTeamId, memberId);

  const memberTeams = await Team.findAllByUser(memberId);
  assert.deepEqual(
    memberTeams.map((team) => team.id).sort((a, b) => a - b),
    [firstTeamId, secondTeamId].sort((a, b) => a - b)
  );

  const selectedSecond = await Team.findByUser(memberId, secondTeamId);
  assert.equal(selectedSecond.id, secondTeamId);

  await Team.leave(memberId, firstTeamId);
  const remainingTeams = await Team.findAllByUser(memberId);
  assert.deepEqual(remainingTeams.map((team) => team.id), [secondTeamId]);
});

test('team admins can promote, demote, and cannot remove the last admin', async () => {
  await waitForDB();
  const ownerId = await insert('INSERT INTO users (email, username, role) VALUES (?,?,?)', ['team-admin-owner@test.com', 'TeamAdminOwner', 'user']);
  const memberId = await insert('INSERT INTO users (email, username, role) VALUES (?,?,?)', ['team-admin-member@test.com', 'TeamAdminMember', 'user']);
  const teamId = await Team.create('관리자 지정 테스트', ownerId);
  await Team.addMember(teamId, memberId);

  await Team.setMemberRole(teamId, memberId, 'admin');
  assert.equal(await Team.countAdmins(teamId), 2);

  await Team.setMemberRole(teamId, memberId, 'member');
  assert.equal(await Team.countAdmins(teamId), 1);

  await assert.rejects(
    () => Team.setMemberRole(teamId, ownerId, 'member'),
    /마지막 관리자/
  );
  await assert.rejects(
    () => Team.removeMember(teamId, ownerId),
    /마지막 관리자/
  );
});

test('team state includes member activity stats', async () => {
  await waitForDB();
  const ownerId = await insert('INSERT INTO users (email, username, role, rating) VALUES (?,?,?,?)', ['team-activity-owner@test.com', 'TeamActivityOwner', 'user', 1200]);
  const teamId = await Team.create('활동 점검 테스트', ownerId);
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await insert(
    'INSERT INTO submissions (user_id, problem_id, lang, code, result, submitted_at) VALUES (?,?,?,?,?,?)',
    [ownerId, 1001, 'Python 3', 'print(1)', 'correct', now]
  );
  await insert(
    'INSERT INTO submissions (user_id, problem_id, lang, code, result, submitted_at) VALUES (?,?,?,?,?,?)',
    [ownerId, 1002, 'Python 3', 'print(2)', 'wrong', now]
  );

  const state = await Team.getTeamState(teamId);
  const owner = state.members.find((member) => member.id === ownerId);
  assert.equal(owner.activity.submissions, 2);
  assert.equal(owner.activity.correct, 1);
  assert.equal(owner.activity.weeklySolved, 1);
  assert.equal(state.stats.weeklySolved, 1);
});

test('team invite tokens can be created and resolved before expiry', async () => {
  await waitForDB();
  const ownerId = await insert('INSERT INTO users (email, username, role) VALUES (?,?,?)', ['team-invite-owner@test.com', 'TeamInviteOwner', 'user']);
  const teamId = await Team.create('초대 링크 테스트', ownerId);
  const token = `invite-token-${Date.now()}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

  await Team.createInvite(teamId, token, expiresAt);

  const invite = await Team.findInvite(token);
  assert.equal(Number(invite.team_id), teamId);
  assert.equal(invite.token, token);
});
