import crypto from 'crypto';

/**
 * user_id + 당일 날짜 salt → 16자리 anon_id 생성
 * 같은 유저는 당일 내 동일 ID, 익일이 되면 자동 교체 → 연속 추적 불가
 * @param {number} userId
 * @returns {string} 16자리 hex 문자열
 */
export function generateAnonId(userId) {
  const dateSalt = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  return crypto
    .createHash('sha256')
    .update(`${userId}:${dateSalt}:${process.env.DUMP_ANON_SALT || 'dc-dump-salt'}`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * 익명 닉네임은 무조건 'ㅇㅇ' 고정 (DC인사이드 유동닉 스타일)
 * 프론트엔드에서 anon_id의 앞 4자리와 조합해 'ㅇㅇ(a1b2)' 형태로 표시
 * @returns {string} 'ㅇㅇ'
 */
export function generateAnonName() {
  return 'ㅇㅇ';
}

/**
 * anon_id의 앞 4자리만 반환 — 프론트에서 'ㅇㅇ(a1b2)' 렌더링용
 * @param {string} anonId  16자리 hex 문자열
 * @returns {string} 4자리 hex 문자열
 */
export function shortAnonId(anonId) {
  return (anonId || '').slice(0, 4);
}
