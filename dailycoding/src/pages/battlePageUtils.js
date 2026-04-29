export const POLL_MS = 2500;
export const BATTLE_SEC = 1800;

export const BATTLE_DURATIONS = [
  { label: '⚡ 블리츠', sec: 300,  desc: '5분' },
  { label: '⚔️ 스탠다드', sec: 1800, desc: '30분' },
  { label: '🏔️ 마라톤', sec: 3600, desc: '60분' },
];
export const TYPE_LABEL = { coding: '코딩', 'fill-blank': '빈칸채우기', 'bug-fix': '버그수정' };
export const TYPE_COLOR = { coding: 'var(--blue)', 'fill-blank': 'var(--green)', 'bug-fix': 'var(--yellow)' };
export const BATTLE_AD_SLOTS = Object.freeze({
  lobby: {
    id: 'battle-lobby-top',
    title: '스폰서 배너 슬롯 (예시)',
    description: '여기에 이미지 광고를 연결할 수 있습니다.',
    type: 'image',
    imageUrl: '',
    ctaText: '광고 링크 자리',
    ctaUrl: '#',
  },
  battle: {
    id: 'battle-inplay-bottom',
    title: '영상 광고 슬롯 (예시)',
    description: '나중에 videoUrl만 넣으면 동영상 광고로 교체됩니다.',
    type: 'video',
    videoUrl: '',
    posterUrl: '',
    ctaText: '동영상 광고 링크 자리',
    ctaUrl: '#',
  },
});

export function getSocketUrl(apiUrl, locationLike) {
  if (apiUrl) return apiUrl.replace(/\/api$/, '');
  if (locationLike?.port === '5173') {
    return `${locationLike.protocol}//${locationLike.hostname}:4000`;
  }
  return locationLike ? locationLike.origin : '';
}

export function fmtTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
