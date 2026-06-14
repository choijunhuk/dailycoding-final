const BRAND_ICON_SRC = '/brand/dailycoding-icon.png';

export default function BrandMark({
  iconSize = 24,
  textSize = 16,
  gap = 8,
  justify = 'flex-start',
  className,
  style,
}) {
  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: justify, gap, ...style }}>
      <img
        src={BRAND_ICON_SRC}
        alt=""
        aria-hidden="true"
        style={{
          width: iconSize,
          height: iconSize,
          borderRadius: Math.max(6, Math.round(iconSize * 0.28)),
          objectFit: 'cover',
          display: 'block',
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: textSize, fontWeight: 800, letterSpacing: -0.5 }}>DailyCoding</span>
    </div>
  );
}
