import assert from 'node:assert/strict';
import test from 'node:test';
import { insert, queryOne, waitForDB } from '../config/mysql.js';
import { AdminLog } from './AdminLog.js';

test('admin log stores security event details for review guardrails', async () => {
  await waitForDB();
  const userId = await insert(
    'INSERT INTO users (email, username, role, email_verified) VALUES (?,?,?,?)',
    ['review-security-log@test.local', 'ReviewSecurityLog', 'user', 1]
  );

  const id = await AdminLog.create({
    adminId: userId,
    action: 'review.forbidden_detail',
    targetType: 'code_review',
    targetId: 42,
    detail: { reason: '리뷰 참여자만 상세 내용을 볼 수 있습니다.' },
  });

  const stored = await queryOne('SELECT * FROM admin_logs WHERE id = ?', [id]);
  assert.equal(stored.action, 'review.forbidden_detail');
  assert.equal(stored.target_type, 'code_review');
  assert.equal(stored.target_id, 42);
  assert.match(stored.detail, /리뷰 참여자/);
});
