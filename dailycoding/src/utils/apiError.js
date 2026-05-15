export function getApiErrorMessage(err, fallback = '알 수 없는 오류가 발생했습니다.') {
  return err?.response?.data?.message || err?.message || fallback;
}
