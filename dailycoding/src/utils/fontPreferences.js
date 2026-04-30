export const FONT_OPTIONS = [
  {
    id: 'noto',
    label: 'Noto Sans KR',
    sample: '기본에 가까운 깔끔한 한글 UI',
    stack: "'Noto Sans KR', sans-serif",
  },
  {
    id: 'ibm',
    label: 'IBM Plex Sans KR',
    sample: '또렷하고 기술 문서에 어울리는 느낌',
    stack: "'IBM Plex Sans KR', 'Noto Sans KR', sans-serif",
  },
  {
    id: 'gowun',
    label: 'Gowun Dodum',
    sample: '부드럽고 읽기 편한 둥근 인상',
    stack: "'Gowun Dodum', 'Noto Sans KR', sans-serif",
  },
  {
    id: 'nanum',
    label: 'Nanum Gothic',
    sample: '익숙한 고딕 계열의 안정감',
    stack: "'Nanum Gothic', 'Noto Sans KR', sans-serif",
  },
  {
    id: 'mono',
    label: 'Space Mono',
    sample: '코딩 감성이 강한 고정폭 스타일',
    stack: "'Space Mono', 'Noto Sans KR', monospace",
  },
];

export function getFontOption(fontId) {
  return FONT_OPTIONS.find((option) => option.id === fontId) || FONT_OPTIONS[0];
}

export function applyAppFontPreference(fontId) {
  const option = getFontOption(fontId);
  document.documentElement.style.setProperty('--app-font', option.stack);
  localStorage.setItem('dc_app_font', option.id);
  return option;
}
