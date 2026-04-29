/**
 * MySQL DATETIME 형식으로 변환
 * '2026-03-29T16:16:31.654Z' → '2026-03-29 16:16:31'
 */
export function toMySQL(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  // UTC → 로컬 포맷 (MySQL DATETIME)
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function nowMySQL() {
  return toMySQL(new Date());
}
