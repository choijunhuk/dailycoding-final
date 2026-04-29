export function getTierImageUrl(tier) {
  const map = {
    unranked:    '/tiers/unrank.webp',
    iron:        '/tiers/iron.webp',
    bronze:      '/tiers/bronze.webp',
    silver:      '/tiers/silver.webp',
    gold:        '/tiers/gold.webp',
    platinum:    '/tiers/platinum.webp',
    emerald:     '/tiers/emerald.webp',
    diamond:     '/tiers/diamond.webp',
    master:      '/tiers/master.webp',
    grandmaster: '/tiers/grandmaster.webp',
    challenger:  '/tiers/challenger.webp',
  };
  return map[tier?.toLowerCase()] || '/tiers/unrank.webp';
}

export function getTierGlowStyle(tier) {
  const glowMap = {
    challenger:  { animation: 'challengerGlow 2s ease-in-out infinite' },
    grandmaster: { animation: 'grandmasterGlow 2.5s ease-in-out infinite' },
    master:      { animation: 'masterGlow 3s ease-in-out infinite' },
    diamond:     { animation: 'diamondShimmer 2.5s ease-in-out infinite' },
    emerald:     { filter: 'drop-shadow(0 0 3px #00d18f)' },
  };
  return glowMap[tier?.toLowerCase()] || {};
}

export const TIER_COLORS = {
  unranked:    '#888',
  iron:        '#a8a8a8',
  bronze:      '#cd7f32',
  silver:      '#c0c0c0',
  gold:        '#ffd700',
  platinum:    '#00e5cc',
  emerald:     '#00d18f',
  diamond:     '#b9f2ff',
  master:      '#9b59b6',
  grandmaster: '#e74c3c',
  challenger:  '#f1c40f',
};
