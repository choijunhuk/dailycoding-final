import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ??= 'test-secret';
process.env.NODE_ENV = 'test';

test('validateAvatarUpload accepts valid signatures and rejects mismatches', async () => {
  const { validateAvatarUpload } = await import('./profile.js');

  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
  const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

  assert.equal(validateAvatarUpload({ mimetype: 'image/jpeg', buffer: jpeg }), 'jpg');
  assert.equal(validateAvatarUpload({ mimetype: 'image/png', buffer: png }), 'png');
  assert.equal(validateAvatarUpload({ mimetype: 'image/webp', buffer: webp }), 'webp');
  assert.equal(validateAvatarUpload({ mimetype: 'image/jpeg', buffer: Buffer.from('alert(1)') }), null);
  assert.equal(validateAvatarUpload({ mimetype: 'image/jpeg', buffer: png }), null);
});
