function getDefaultOrigin() {
  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
}

export function getInternalRedirectPath(redirect, origin = getDefaultOrigin()) {
  const value = typeof redirect === 'string' ? redirect.trim() : '';
  if (!value) return null;

  try {
    const url = new URL(value, origin);
    if (url.origin !== origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function resolvePostLoginRedirect(redirect, fallbackPath = '/') {
  return getInternalRedirectPath(redirect) || fallbackPath;
}
