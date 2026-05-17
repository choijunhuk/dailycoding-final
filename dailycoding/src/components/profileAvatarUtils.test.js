import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getEffectiveProfileAvatarMode,
  getProfileAvatarColor,
  getProfileAvatarEmoji,
  getProfileAvatarSource,
} from './profileAvatarUtils.js';

test('avatar defaults to saved site profile when configured', () => {
  const profile = {
    username: 'coder',
    avatarUrl: 'https://provider.example/avatar.png',
    avatarUrlCustom: '/uploads/avatars/1.png',
  };
  assert.equal(getEffectiveProfileAvatarMode(profile), 'site');
  assert.equal(getProfileAvatarSource(profile), '/uploads/avatars/1.png');
});

test('avatar falls back to provider profile when no site profile exists', () => {
  const profile = { username: 'coder', avatar_url: 'https://provider.example/avatar.png' };
  assert.equal(getEffectiveProfileAvatarMode(profile), 'provider');
  assert.equal(getProfileAvatarSource(profile), 'https://provider.example/avatar.png');
});

test('provider mode ignores saved site avatar without deleting it', () => {
  const profile = {
    username: 'coder',
    avatar_source: 'provider',
    avatar_url: 'https://provider.example/avatar.png',
    avatar_url_custom: '/uploads/avatars/1.png',
    avatar_emoji: '🚀',
    avatar_color: '#ffd700',
  };
  assert.equal(getEffectiveProfileAvatarMode(profile), 'provider');
  assert.equal(getProfileAvatarSource(profile), 'https://provider.example/avatar.png');
  assert.equal(getProfileAvatarEmoji(profile), null);
  assert.notEqual(getProfileAvatarColor(profile), '#ffd700');
});

test('site mode can use emoji and color without image', () => {
  const profile = {
    username: 'coder',
    avatarSource: 'site',
    avatarUrl: 'https://provider.example/avatar.png',
    avatarEmoji: '🦊',
    avatarColor: '#79c0ff',
  };
  assert.equal(getProfileAvatarSource(profile), null);
  assert.equal(getProfileAvatarEmoji(profile), '🦊');
  assert.equal(getProfileAvatarColor(profile), '#79c0ff');
});
