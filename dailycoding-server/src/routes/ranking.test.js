import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_HOST = 'invalid_host';
process.env.REDIS_URL = 'redis://invalid:6379';
process.env.JWT_SECRET = 'test_secret';

const { normalizeRankingUser, normalizeTeamRankingRow, teamAvatarEmoji } = await import('./ranking.js');

test('normalizeRankingUser preserves all avatar fields used by ranking profile UI', () => {
  const user = normalizeRankingUser({
    id: 7,
    username: 'Ranker',
    tier: 'gold',
    rating: 3210,
    solved_count: 42,
    streak: 5,
    avatar_url: 'https://cdn.example/base.png',
    avatar_url_custom: 'https://cdn.example/custom.png',
    avatar_emoji: '🧑‍💻',
    avatar_color: '#123456',
  });

  assert.equal(user.name, 'Ranker');
  assert.equal(user.avatarUrl, 'https://cdn.example/base.png');
  assert.equal(user.avatar_url, 'https://cdn.example/base.png');
  assert.equal(user.avatarUrlCustom, 'https://cdn.example/custom.png');
  assert.equal(user.avatar_url_custom, 'https://cdn.example/custom.png');
  assert.equal(user.avatarEmoji, '🧑‍💻');
  assert.equal(user.avatar_color, '#123456');
});

test('normalizeTeamRankingRow computes stable affiliation ranking fields without teams.avatar_emoji column', () => {
  const row = normalizeTeamRankingRow({
    id: 3,
    name: '알고왕 소속',
    member_count: '4',
    avg_rating: '1500',
    total_solved: '90',
    weekly_solved: '8',
    top_rating: '2200',
  }, 1);

  assert.equal(row.rank, 2);
  assert.equal(row.memberCount, 4);
  assert.equal(row.avgRating, 1500);
  assert.equal(row.totalSolved, 90);
  assert.equal(row.weeklySolved, 8);
  assert.equal(row.topRating, 2200);
  assert.equal(row.teamScore, 1840);
  assert.equal(row.avatarEmoji, teamAvatarEmoji('알고왕 소속'));
});
