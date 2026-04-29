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

export function buildYearHeatmap(rows = [], today = new Date()) {
  const start = new Date(today);
  start.setDate(today.getDate() - 363);
  const map = {};
  rows.forEach((row) => {
    map[row.date] = Math.min(4, Number(row.level) || 0);
  });

  const cells = [];
  for (let offset = 0; offset < 364; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    const key = date.toISOString().slice(0, 10);
    cells.push({
      date: key,
      level: map[key] || 0,
      day: date.getDay(),
      week: Math.floor(offset / 7),
    });
  }
  return cells;
}

export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '기록 없음';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  if (minutes > 0) return `${minutes}분 ${secs}초`;
  return `${secs}초`;
}
