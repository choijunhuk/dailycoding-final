import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ??= 'test-secret';
process.env.NODE_ENV = 'test';

test('parseRefreshTokenValue validates malformed refresh tokens', async () => {
  const { parseRefreshTokenValue } = await import('./local.js');

  assert.deepEqual(
    parseRefreshTokenValue('abc.token'),
    { errorCode: 'INVALID_TOKEN', message: '유효하지 않은 토큰 형식입니다.' }
  );
  assert.deepEqual(
    parseRefreshTokenValue('0.token'),
    { errorCode: 'INVALID_TOKEN', message: '유효하지 않은 토큰 형식입니다.' }
  );
  assert.deepEqual(
    parseRefreshTokenValue('.token'),
    { errorCode: 'INVALID_TOKEN', message: '유효하지 않은 토큰 형식입니다.' }
  );
  assert.deepEqual(
    parseRefreshTokenValue('1234.'),
    { errorCode: 'INVALID_TOKEN', message: '유효하지 않은 리프레시 토큰입니다.' }
  );
  assert.deepEqual(
    parseRefreshTokenValue('1234.valid.token'),
    { userId: 1234, token: 'valid.token' }
  );
});
