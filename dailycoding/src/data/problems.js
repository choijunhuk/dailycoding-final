// Small constants defined locally to guarantee initialization order
// (avoids cross-package import TDZ in Vite/Rollup production builds)
export const MIN_HIDDEN_TESTCASES = 10

export const TIERS = {
  bronze:   { label: '브론즈',   color: '#cd7f32', bg: 'rgba(205,127,50,.15)'  },
  silver:   { label: '실버',     color: '#c0c0c0', bg: 'rgba(192,192,192,.12)' },
  gold:     { label: '골드',     color: '#ffd700', bg: 'rgba(255,215,0,.12)'   },
  platinum: { label: '플래티넘', color: '#00e5cc', bg: 'rgba(0,229,204,.12)'   },
  diamond:  { label: '다이아',   color: '#b9f2ff', bg: 'rgba(185,242,255,.12)' },
}

export const TIER_COLORS = {
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#ffd700',
  platinum: '#00e5cc',
  diamond: '#b9f2ff',
}

// Heavy data re-exported from cross-package path (only used inside component functions, never at module level)
export { PROBLEMS, ALL_TAGS } from './problemCatalog.js'
