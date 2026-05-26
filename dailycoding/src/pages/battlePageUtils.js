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
export const JUDGE_PRO_BENEFITS_SLOT = Object.freeze({
  id: 'judge-result-banner',
  titleKey: 'proBenefitsJudgeTitle',
  descriptionKey: 'proBenefitsJudgeDesc',
  type: 'image',
  imageUrl: '',
  ctaKey: 'proBenefitsCta',
  ctaUrl: '/pricing',
});

export const BATTLE_PRO_BENEFITS_SLOTS = Object.freeze({
  lobby: {
    id: 'battle-lobby-top',
    titleKey: 'proBenefitsBattleLobbyTitle',
    descriptionKey: 'proBenefitsBattleLobbyDesc',
    type: 'image',
    imageUrl: '',
    ctaKey: 'proBenefitsCta',
    ctaUrl: '/pricing',
  },
  battle: {
    id: 'battle-inplay-bottom',
    titleKey: 'proBenefitsBattleLiveTitle',
    descriptionKey: 'proBenefitsBattleLiveDesc',
    type: 'video',
    videoUrl: '',
    posterUrl: '',
    ctaKey: 'proBenefitsCta',
    ctaUrl: '/pricing',
  },
});


export function fmtTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
