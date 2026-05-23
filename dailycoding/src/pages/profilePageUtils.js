import { TIER_THRESHOLDS } from '../data/constants.js';

export const PROFILE_TIER_THRESHOLDS = { unranked: 0, ...TIER_THRESHOLDS };
export const PROFILE_TIER_LABELS = {
  unranked:    'UNRANKED',
  iron:        'IRON',
  bronze:      'BRONZE',
  silver:      'SILVER',
  gold:        'GOLD',
  platinum:    'PLATINUM',
  emerald:     'EMERALD',
  diamond:     'DIAMOND',
  master:      'MASTER',
  grandmaster: 'GRANDMASTER',
  challenger:  'CHALLENGER',
};

export const PROFILE_TIER_LABELS_KO = {
  unranked:    '언랭크드',
  iron:        '아이언',
  bronze:      '브론즈',
  silver:      '실버',
  gold:        '골드',
  platinum:    '플래티넘',
  emerald:     '에메랄드',
  diamond:     '다이아',
  master:      '마스터',
  grandmaster: '그랜드마스터',
  challenger:  '챌린저',
};

export function buildYearHeatmap(rows = [], today = new Date()) {
  const start = new Date(today);
  start.setDate(today.getDate() - 363);
  const rawMap = {};
  rows.forEach((row) => {
    rawMap[row.date] = Number(row.level) || 0;
  });

  const cells = [];
  for (let offset = 0; offset < 364; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    const key = date.toISOString().slice(0, 10);
    const count = rawMap[key] || 0;
    cells.push({
      date: key,
      count,
      level: Math.min(4, count),
      day: date.getDay(),
      week: Math.floor(offset / 7),
    });
  }
  return cells;
}

export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return 'No record';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export function profileBackgroundToCss(value) {
  if (!value) return null;
  if (value.startsWith('solid:')) return value.replace('solid:', '');
  if (value.startsWith('gradient:')) return value.replace('gradient:', '');
  return `url(${value}) center/cover`;
}
