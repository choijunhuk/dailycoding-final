export function errorResponse(res, status, code, message, extra = {}) {
  return res.status(status).json({
    success: false,
    error: { code, message },
    message,
    ...extra,
  });
}

export function internalError(res, message = '서버 오류') {
  return errorResponse(res, 500, 'INTERNAL_ERROR', message);
}
