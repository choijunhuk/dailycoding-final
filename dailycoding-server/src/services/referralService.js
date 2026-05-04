import crypto from 'crypto';
import { insert, queryOne, run } from '../config/mysql.js';
import { User } from '../models/User.js';
import { Notification } from '../models/Notification.js';

function addDays(baseDate, days) {
  const next = new Date(baseDate);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 19).replace('T', ' ');
}

export async function getOrCreateReferralCode(userId) {
  let row = await queryOne('SELECT * FROM referrals WHERE referrer_id = ? ORDER BY id ASC LIMIT 1', [userId]);
  if (row?.referral_code) return row.referral_code;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = crypto.randomBytes(6).toString('hex');
    try {
      await insert('INSERT INTO referrals (referrer_id, referral_code) VALUES (?, ?)', [userId, code]);
      return code;
    } catch {
      // Retry on rare referral-code collision.
    }
  }

  row = await queryOne('SELECT * FROM referrals WHERE referrer_id = ? ORDER BY id ASC LIMIT 1', [userId]);
  return row?.referral_code || null;
}

export async function attachReferralCode(referralCode, referredUserId) {
  if (!referralCode) return null;
  const row = await queryOne('SELECT * FROM referrals WHERE referral_code = ?', [referralCode]);
  if (!row || row.referrer_id === referredUserId) return null;

  await run(
    'UPDATE referrals SET referred_user_id = ?, status = ? WHERE id = ?',
    [referredUserId, 'signed_up', row.id]
  );
  return row;
}

export async function claimReferralReward(referredUserId) {
  const referral = await queryOne(
    'SELECT * FROM referrals WHERE referred_user_id = ? AND status = ? LIMIT 1',
    [referredUserId, 'signed_up']
  );
  if (!referral) return null;

  const referrer = await User.findById(referral.referrer_id);
  if (!referrer) return null;

  const currentExpiry = referrer.subscription_expires_at ? new Date(referrer.subscription_expires_at) : new Date();
  const base = currentExpiry > new Date() ? currentExpiry : new Date();
  const nextExpiry = addDays(base, 7);
  await User.updateSubscription(referrer.id, {
    subscription_tier: 'pro',
    subscription_expires_at: nextExpiry,
  });
  await run(
    'UPDATE referrals SET status = ?, reward_granted_at = ? WHERE id = ?',
    ['rewarded', new Date().toISOString().slice(0, 19).replace('T', ' '), referral.id]
  );
  await Notification.create(referrer.id, '친구가 첫 문제를 풀었습니다! Pro 7일이 추가되었습니다.', 'pricing');
  return referral;
}
