// Small constants defined locally to guarantee initialization order
// (avoids cross-package import TDZ in Vite/Rollup production builds)
export const MIN_HIDDEN_TESTCASES = 10

export const TIERS = {
  bronze:   { label: '브론즈',   color: '#b87333', bg: 'rgba(184,115,51,.16)'  },
  silver:   { label: '실버',     color: '#94a3b8', bg: 'rgba(148,163,184,.14)' },
  gold:     { label: '골드',     color: '#f4c430', bg: 'rgba(244,196,48,.14)'  },
  platinum: { label: '플래티넘', color: '#22c7b8', bg: 'rgba(34,199,184,.14)'  },
  diamond:  { label: '다이아',   color: '#4ea8ff', bg: 'rgba(78,168,255,.14)' },
}

export const TIER_COLORS = {
  bronze: '#b87333',
  silver: '#94a3b8',
  gold: '#f4c430',
  platinum: '#22c7b8',
  diamond: '#4ea8ff',
}

// Heavy data re-exported from cross-package path (only used inside component functions, never at module level)
export { PROBLEMS, ALL_TAGS } from './problemCatalog.js'
