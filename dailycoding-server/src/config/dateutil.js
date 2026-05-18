/**
 * MySQL DATETIME 형식으로 변환 (UTC 기준)
 * MySQL 연결이 timezone:'Z' (UTC)이므로 항상 UTC 시각을 저장해야 올바르게 읽힘.
 * '2026-03-29T16:16:31.654Z' → '2026-03-29 16:16:31'
 */
export function toMySQL(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

export function nowMySQL() {
  return toMySQL(new Date());
}
