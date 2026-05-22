import { localizeMessage } from './locale.js';

export function errorResponse(res, status, code, message, extra = {}) {
  const locale = res?.req?.locale || 'en';
  const localizedMessage = localizeMessage(message, locale);
  return res.status(status).json({
    success: false,
    error: { code, message: localizedMessage },
    message: localizedMessage,
    ...extra,
  });
}

export function internalError(res, message = 'Internal server error') {
  return errorResponse(res, 500, 'INTERNAL_ERROR', message);
}
