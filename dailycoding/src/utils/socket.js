export function getSocketUrl(apiUrl = import.meta.env.VITE_API_URL, locationLike = typeof window !== 'undefined' ? window.location : null) {
  if (apiUrl) return apiUrl.replace(/\/api$/, '')
  if (locationLike?.port === '5173' || /^5\d{3}$/.test(locationLike?.port || '')) {
    return `${locationLike.protocol}//${locationLike.hostname}:4000`
  }
  return locationLike ? locationLike.origin : ''
}
