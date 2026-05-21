export function getApiErrorMessage(err, fallback = 'An unknown error occurred.') {
  return err?.response?.data?.message || err?.message || fallback;
}
