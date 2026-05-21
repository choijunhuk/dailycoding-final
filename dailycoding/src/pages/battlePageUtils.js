import { getSocketUrl } from '../utils/socket.js';

export { getSocketUrl };

export const POLL_MS = 2500;
export const BATTLE_SEC = 1800;

export const BATTLE_DURATIONS = [
  { label: '⚡ Blitz', sec: 300,  desc: '5 min' },
  { label: '⚔️ Standard', sec: 1800, desc: '30 min' },
  { label: '🏔️ Marathon', sec: 3600, desc: '60 min' },
];

export const BATTLE_MODES = [
  { key: 'time', label: '⏱️ Timer', desc: 'Solve more problems within the time limit' },
  { key: 'race', label: '🏁 Race', desc: 'First to solve all problems wins' },
];
export const TYPE_LABEL = { coding: 'Coding', 'fill-blank': 'Fill in the Blank', 'bug-fix': 'Bug Fix' };
export const TYPE_COLOR = { coding: 'var(--blue)', 'fill-blank': 'var(--green)', 'bug-fix': 'var(--yellow)' };
export const JUDGE_AD_SLOT = Object.freeze({
  id: 'judge-result-banner',
  title: 'Sponsor Banner Slot',
  description: 'Connect an image ad here.',
  type: 'image',
  imageUrl: '',
  ctaText: 'Ad Link',
  ctaUrl: '#',
});

export const BATTLE_AD_SLOTS = Object.freeze({
  lobby: {
    id: 'battle-lobby-top',
    title: 'Sponsor Banner Slot',
    description: 'Connect an image ad here.',
    type: 'image',
    imageUrl: '',
    ctaText: 'Ad Link',
    ctaUrl: '#',
  },
  battle: {
    id: 'battle-inplay-bottom',
    title: 'Video Ad Slot',
    description: 'Replace with a video ad by setting videoUrl.',
    type: 'video',
    videoUrl: '',
    posterUrl: '',
    ctaText: 'Video Ad Link',
    ctaUrl: '#',
  },
});


export function fmtTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
