const FALLBACK_COLORS = ['#79c0ff', '#56d364', '#e3b341', '#f78166', '#bc8cff'];

function pickProfileValue(profile, camelKey, snakeKey) {
  return profile?.[camelKey] ?? profile?.[snakeKey] ?? null;
}

export function getProfileAvatarSource(profile) {
  return pickProfileValue(profile, 'avatarUrlCustom', 'avatar_url_custom');
}

export function getProfileAvatarColor(profile) {
  const configured = pickProfileValue(profile, 'avatarColor', 'avatar_color');
  if (configured) return configured;
  const seed = profile?.username || profile?.nickname || profile?.displayName || 'user';
  return FALLBACK_COLORS[(seed.charCodeAt(0) || 0) % FALLBACK_COLORS.length];
}

export function getProfileAvatarInitials(profile) {
  const seed = profile?.username || profile?.nickname || profile?.displayName || '??';
  return seed.slice(0, 2).toUpperCase();
}

export default function ProfileAvatar({
  profile,
  size,
  radius = '50%',
  className,
  style,
  border = '1px solid var(--border)',
  fontSize,
  alt,
}) {
  const src = getProfileAvatarSource(profile);
  const color = getProfileAvatarColor(profile);
  const emoji = pickProfileValue(profile, 'avatarEmoji', 'avatar_emoji');
  const sharedStyle = {
    ...(size ? { width: size, height: size } : {}),
    borderRadius: radius,
    border,
    background: color,
    flexShrink: 0,
    overflow: 'hidden',
    ...style,
  };

  if (src) {
    return (
      <img
        className={className}
        src={src}
        alt={alt || profile?.username || 'avatar'}
        loading="lazy"
        width={size}
        height={size}
        style={{ objectFit: 'cover', ...sharedStyle }}
      />
    );
  }

  return (
    <span
      className={className}
      aria-label={alt || profile?.username || 'avatar'}
      style={{
        color: 'var(--text)',
        display: 'grid',
        placeItems: 'center',
        fontSize: fontSize || (size ? (emoji ? Math.round(size * 0.5) : Math.max(10, Math.round(size * 0.32))) : undefined),
        fontWeight: 800,
        lineHeight: 1,
        ...sharedStyle,
      }}
    >
      {emoji || getProfileAvatarInitials(profile)}
    </span>
  );
}
