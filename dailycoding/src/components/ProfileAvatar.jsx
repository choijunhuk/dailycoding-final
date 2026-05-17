import { useEffect, useState } from 'react';
import {
  getProfileAvatarColor,
  getProfileAvatarEmoji,
  getProfileAvatarInitials,
  getProfileAvatarSource,
} from './profileAvatarUtils.js';

export {
  getEffectiveProfileAvatarMode,
  getProfileAvatarColor,
  getProfileAvatarEmoji,
  getProfileAvatarInitials,
  getProfileAvatarPreference,
  getProfileAvatarSource,
  hasSiteAvatar,
} from './profileAvatarUtils.js';

export default function ProfileAvatar({
  profile,
  size,
  radius = '50%',
  className,
  style,
  border = '1px solid var(--border)',
  fontSize,
  alt,
  ...props
}) {
  const [imgError, setImgError] = useState(false);
  const src = getProfileAvatarSource(profile);
  const color = getProfileAvatarColor(profile);
  const emoji = getProfileAvatarEmoji(profile);
  const sharedStyle = {
    ...(size ? { width: size, height: size } : {}),
    borderRadius: radius,
    border,
    background: color,
    flexShrink: 0,
    overflow: 'hidden',
    ...style,
  };

  useEffect(() => {
    setImgError(false);
  }, [src]);

  if (src && !imgError) {
    return (
      <img
        className={className}
        src={src}
        alt={alt || profile?.username || 'avatar'}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        width={size}
        height={size}
        style={{ objectFit: 'cover', ...sharedStyle }}
        onError={() => setImgError(true)}
        {...props}
      />
    );
  }

  return (
    <span
      className={className}
      aria-label={alt || profile?.username || 'avatar'}
      {...props}
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
