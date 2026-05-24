export const FONT_OPTIONS = [
  {
    id: 'noto',
    label: 'Noto Sans KR',
    sample: 'Clean and natural UI font',
    stack: "'Noto Sans KR', sans-serif",
  },
  {
    id: 'ibm',
    label: 'IBM Plex Sans KR',
    sample: 'Sharp and technical document feel',
    stack: "'IBM Plex Sans KR', 'Noto Sans KR', sans-serif",
  },
  {
    id: 'gowun',
    label: 'Gowun Dodum',
    sample: 'Soft and easy to read, rounded style',
    stack: "'Gowun Dodum', 'Noto Sans KR', sans-serif",
  },
  {
    id: 'nanum',
    label: 'Nanum Gothic',
    sample: 'Familiar Gothic style, comfortable to read',
    stack: "'Nanum Gothic', 'Noto Sans KR', sans-serif",
  },
  {
    id: 'mono',
    label: 'Space Mono',
    sample: 'Monospace with a strong coding vibe',
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

export function normalizeAppFontSize(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 14;
  return Math.min(24, Math.max(10, Math.round(parsed)));
}

export function applyAppFontSizePreference(fontSize) {
  const normalized = normalizeAppFontSize(fontSize);
  document.documentElement.style.setProperty('--app-font-size', `${normalized}px`);
  if (document.body?.style) document.body.style.fontSize = `${normalized}px`;
  localStorage.setItem('dc_app_font_size', String(normalized));
  return normalized;
}

export function normalizeAppZoom(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 100;
  return Math.min(130, Math.max(80, Math.round(parsed / 5) * 5));
}

export function applyAppZoomPreference(zoom) {
  const normalized = normalizeAppZoom(zoom);
  document.body.style.zoom = normalized === 100 ? '' : String(normalized / 100);
  localStorage.setItem('dc_app_zoom', String(normalized));
  return normalized;
}

export function applyAppTypographyPreference({ fontFamily = 'noto', fontSize = 14, uiZoom } = {}) {
  const result = {
    font: applyAppFontPreference(fontFamily),
    fontSize: applyAppFontSizePreference(fontSize),
  };
  if (uiZoom !== undefined) {
    result.zoom = applyAppZoomPreference(uiZoom);
  }
  return result;
}
