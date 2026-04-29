import test from 'node:test';
import assert from 'node:assert/strict';
import { BATTLE_AD_SLOTS, BATTLE_SEC, fmtTime, getSocketUrl, POLL_MS, TYPE_LABEL } from './battlePageUtils.js';

test('battle constants and labels remain stable', () => {
  assert.equal(POLL_MS, 2500);
  assert.equal(BATTLE_SEC, 1800);
  assert.equal(TYPE_LABEL['bug-fix'], '버그수정');
  assert.equal(BATTLE_AD_SLOTS.lobby.id, 'battle-lobby-top');
});

test('getSocketUrl derives local dev and apiUrl-based origins', () => {
  assert.equal(getSocketUrl('https://api.example.com/api', { origin: 'https://app.example.com' }), 'https://api.example.com');
  assert.equal(getSocketUrl('', { protocol: 'http:', hostname: 'localhost', port: '5173', origin: 'http://localhost:5173' }), 'http://localhost:4000');
  assert.equal(getSocketUrl('', { origin: 'https://app.example.com' }), 'https://app.example.com');
});

test('fmtTime formats seconds as mm:ss', () => {
  assert.equal(fmtTime(0), '00:00');
  assert.equal(fmtTime(65), '01:05');
});
