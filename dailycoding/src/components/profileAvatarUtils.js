const FALLBACK_COLORS = ['#79c0ff', '#56d364', '#e3b341', '#f78166', '#bc8cff'];

export function pickProfileValue(profile, camelKey, snakeKey) {
  return profile?.[camelKey] ?? profile?.[snakeKey] ?? null;
}

export function getProfileAvatarPreference(profile) {
  const raw = pickProfileValue(profile, 'avatarSource', 'avatar_source');
  return raw === 'provider' ? 'provider' : raw === 'site' ? 'site' : null;
}

export function hasSiteAvatar(profile) {
  return Boolean(
    pickProfileValue(profile, 'avatarUrlCustom', 'avatar_url_custom') ||
    pickProfileValue(profile, 'avatarEmoji', 'avatar_emoji') ||
    pickProfileValue(profile, 'avatarColor', 'avatar_color')
  );
}

export function getEffectiveProfileAvatarMode(profile) {
  const preference = getProfileAvatarPreference(profile);
  if (preference) return preference;
  return hasSiteAvatar(profile) ? 'site' : 'provider';
}

export function getProfileAvatarSource(profile) {
  const providerSource = pickProfileValue(profile, 'avatarUrl', 'avatar_url');
  const siteSource = pickProfileValue(profile, 'avatarUrlCustom', 'avatar_url_custom');
  const mode = getEffectiveProfileAvatarMode(profile);

  if (mode === 'provider') return providerSource || null;
  return siteSource || (hasSiteAvatar(profile) ? null : providerSource);
}

export function getProfileAvatarColor(profile) {
  const mode = getEffectiveProfileAvatarMode(profile);
  const configured = mode === 'site' ? pickProfileValue(profile, 'avatarColor', 'avatar_color') : null;
  if (configured) return configured;
  const seed = profile?.username || profile?.nickname || profile?.displayName || 'user';
  return FALLBACK_COLORS[(seed.charCodeAt(0) || 0) % FALLBACK_COLORS.length];
}

export function getProfileAvatarEmoji(profile) {
  return getEffectiveProfileAvatarMode(profile) === 'site'
    ? pickProfileValue(profile, 'avatarEmoji', 'avatar_emoji')
    : null;
}

export function getProfileAvatarInitials(profile) {
  const seed = profile?.username || profile?.nickname || profile?.displayName || '??';
  return seed.slice(0, 2).toUpperCase();
}
