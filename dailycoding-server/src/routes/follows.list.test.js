import assert from 'node:assert/strict';
import test from 'node:test';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

async function getJSON(baseUrl, token, path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  return body;
}

test('follow list endpoints expose followers and following user summaries', async (t) => {
  const [
    { createApp },
    { waitForDB, run },
    { User },
    { makeToken },
    { default: redis },
  ] = await Promise.all([
    import('../app.js'),
    import('../config/mysql.js'),
    import('../models/User.js'),
    import('./auth/helpers.js'),
    import('../config/redis.js'),
  ]);

  await waitForDB();
  await run('DELETE FROM follows');
  await redis.clearPrefix('auth:status:');

  const suffix = Date.now();
  const viewer = await User.create({ email: `follow-viewer-${suffix}@example.com`, password: 'password', username: `follow_viewer_${suffix}` });
  const target = await User.create({ email: `follow-target-${suffix}@example.com`, password: 'password', username: `follow_target_${suffix}` });
  const other = await User.create({ email: `follow-other-${suffix}@example.com`, password: 'password', username: `follow_other_${suffix}` });

  await run('INSERT INTO follows (follower_id, following_id) VALUES (?,?)', [viewer.id, target.id]);
  await run('INSERT INTO follows (follower_id, following_id) VALUES (?,?)', [target.id, other.id]);

  const app = createApp();
  const server = app.listen(0);
  t.after(() => server.close());
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const token = makeToken(viewer);

  const followers = await getJSON(baseUrl, token, `/api/follows/${target.id}/followers`);
  assert.equal(followers.type, 'followers');
  assert.equal(followers.total, 1);
  assert.equal(followers.items[0].id, viewer.id);
  assert.equal(followers.items[0].username, viewer.username);

  const following = await getJSON(baseUrl, token, `/api/follows/${target.id}/following`);
  assert.equal(following.type, 'following');
  assert.equal(following.total, 1);
  assert.equal(following.items[0].id, other.id);
  assert.equal(following.items[0].username, other.username);
});
