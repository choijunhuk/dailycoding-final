import { getTierImageUrl, getTierGlowStyle } from '../utils/tierImage.js';

const TIER_BADGE_CFG = {
  unranked:    { color: '#888888' },
  iron:        { color: '#a8a8a8' },
  bronze:      { color: '#cd7f32' },
  silver:      { color: '#b0b8c8' },
  gold:        { color: '#ffd700' },
  platinum:    { color: '#00e5cc' },
  emerald:     { color: '#00d18f' },
  diamond:     { color: '#b9f2ff' },
  master:      { color: '#9b59b6' },
  grandmaster: { color: '#e74c3c' },
  challenger:  { color: '#f1c40f' },
};

export function TierBadge({ tier, size = 30, title = '' }) {
  const cfg = TIER_BADGE_CFG[tier] || { color: '#555' };
  const glow = getTierGlowStyle(tier);
  return (
    <div
      title={title}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.2),
        background: `${cfg.color}18`,
        border: `1.5px solid ${cfg.color}55`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: cfg.color,
        fontWeight: 800,
        fontSize: size * 0.38,
        fontFamily: 'Space Mono,monospace',
        flexShrink: 0,
        overflow: 'hidden',
        ...glow,
      }}
    >
      <img src={getTierImageUrl(tier)} alt={tier} style={{ width: size - 6, height: size - 6, objectFit: 'contain' }} />
    </div>
  );
}

export function DonutChart({ data, total }) {
  const cx = 90;
  const cy = 90;
  const r = 72;
  const ir = 46;
  const toRad = (degree) => degree * Math.PI / 180;
  let currentDegree = -90;
  const segments = [];

  data.forEach((item) => {
    if (!item.count || !total) return;
    const angle = (item.count / total) * 360;
    const startDegree = currentDegree;
    const endDegree = currentDegree + angle;
    const x1 = cx + r * Math.cos(toRad(startDegree));
    const y1 = cy + r * Math.sin(toRad(startDegree));
    const x2 = cx + r * Math.cos(toRad(endDegree));
    const y2 = cy + r * Math.sin(toRad(endDegree));
    const ix1 = cx + ir * Math.cos(toRad(endDegree));
    const iy1 = cy + ir * Math.sin(toRad(endDegree));
    const ix2 = cx + ir * Math.cos(toRad(startDegree));
    const iy2 = cy + ir * Math.sin(toRad(startDegree));
    const largeArc = angle > 180 ? 1 : 0;
    segments.push({
      d: `M${x1},${y1}A${r},${r},0,${largeArc},1,${x2},${y2}L${ix1},${iy1}A${ir},${ir},0,${largeArc},0,${ix2},${iy2}Z`,
      fill: item.color,
    });
    currentDegree += angle;
  });

  return (
    <svg viewBox="0 0 180 180" width="180" height="180" style={{ display: 'block' }}>
      {total === 0
        ? <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg3)" strokeWidth={r - ir} />
        : segments.map((segment, index) => <path key={index} d={segment.d} fill={segment.fill} />)}
      <text x={cx} y={cy - 7} textAnchor="middle" fill="var(--text)" fontSize="24" fontWeight="800" fontFamily="Space Mono,monospace">{total}</text>
      <text x={cx} y={cy + 13} textAnchor="middle" fill="var(--text3)" fontSize="11">문제 해결</text>
    </svg>
  );
}

export function YearHeatmap({ cells }) {
  const cell = 11;
  const gap = 4;
  const width = 52 * (cell + gap);
  const height = 7 * (cell + gap);
  const colorFor = (level) => (
    level === 0 ? 'var(--bg3)'
      : level === 1 ? 'rgba(88,166,255,.22)'
      : level === 2 ? 'rgba(88,166,255,.42)'
      : level === 3 ? 'rgba(63,185,80,.55)'
      : 'rgba(63,185,80,.85)'
  );

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
      {cells.map((cellData) => (
        <rect
          key={cellData.date}
          x={cellData.week * (cell + gap)}
          y={cellData.day * (cell + gap)}
          width={cell}
          height={cell}
          rx="3"
          fill={colorFor(cellData.level)}
          stroke="var(--border)"
        >
          <title>{`${cellData.date} · ${cellData.level > 0 ? `${cellData.level}문제` : '기록 없음'}`}</title>
        </rect>
      ))}
    </svg>
  );
}
