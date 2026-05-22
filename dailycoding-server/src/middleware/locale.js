const SUPPORTED_LOCALES = new Set(['ko', 'en']);

const MESSAGE_PAIRS = [
  ['서버 오류', 'Internal server error.'],
  ['서버 오류', 'Internal server error'],
  ['문제를 찾을 수 없습니다.', 'Problem not found.'],
  ['조건에 맞는 문제가 없습니다.', 'No problems found matching the criteria.'],
  ['문제가 없습니다.', 'No problems available.'],
  ['유저 없음', 'User not found.'],
  ['해설이 없습니다.', 'No editorial found.'],
  ['해설 내용을 입력해주세요.', 'Editorial content is required.'],
  ['이미 해설이 존재합니다.', 'An editorial already exists for this problem.'],
  ['문제를 먼저 풀어야 해설을 볼 수 있습니다.', 'You must solve the problem before viewing the editorial.'],
  ['트러블슈팅 문제 유형이 아닙니다.', 'This problem is not a troubleshooting type.'],
  ['트러블슈팅 설정이 없습니다.', 'Troubleshooting configuration not found.'],
  ['실행 실패', 'Execution failed.'],
  ['제출 실패', 'Submission failed.'],
  ['삭제됐습니다.', 'Deleted successfully.'],
  ['삭제 실패', 'Delete failed.'],
  ['댓글은 1자 이상 500자 이하로 입력해주세요.', 'Comment must be between 1 and 500 characters.'],
  ['부모 댓글을 찾을 수 없습니다.', 'Parent comment not found.'],
  ['댓글을 찾을 수 없습니다.', 'Comment not found.'],
  ['삭제 권한이 없습니다.', 'You do not have permission to delete this comment.'],
  ['댓글이 없습니다.', 'Comment not found.'],
  ['검색어는 100자 이하여야 합니다.', 'Search query must be 100 characters or fewer.'],
  ['vote는 1~5 사이 정수여야 합니다.', 'Vote must be an integer between 1 and 5.'],
  ['지원하지 않는 언어입니다.', 'Unsupported language.'],
  ['지원하지 않는 배틀 언어입니다.', 'Unsupported battle language.'],
  ['code와 language가 필요합니다.', 'code and language are required'],
  ['히든 테스트케이스는 최소 3개 필요합니다.', 'At least 3 hidden test cases are required.'],
  ['히든 테스트케이스는 최소 10개 필요합니다.', 'At least 10 hidden test cases are required.'],
  ['빈칸 채우기 문제에는 코드 템플릿이 필요합니다.', 'A code template is required for fill-in-the-blank problems.'],
  ['빈칸 채우기 문제에는 최소 1개 이상의 정답 빈칸이 필요합니다.', 'At least one answer blank is required for fill-in-the-blank problems.'],
  ['틀린부분 찾기 문제에는 버그 코드가 필요합니다.', 'Buggy code is required for bug-fix problems.'],
  ['틀린부분 찾기 문제에는 최소 1개 이상의 정답 키워드가 필요합니다.', 'At least one answer keyword is required for bug-fix problems.'],
  ['틀린부분 찾기 문제에는 최소 1개 이상의 정답 키워드가 필요합니다.', 'Bug-fix problems require at least one answer keyword.'],
  ['아이템이 쿨다운 중입니다.', 'Item is on cooldown.'],
  ['이 모드에서는 아이템을 사용할 수 없습니다.', 'Items are not available in this mode.'],
  ['방 참가자만 제출할 수 있습니다.', 'Only room participants can submit.'],
  ['자기 자신의 제출에서는 리뷰 점수를 받을 수 없습니다.', 'You cannot earn review points on your own submission.'],
  ['정답 제출만 리뷰할 수 있습니다.', 'Only correct submissions can be reviewed.'],
  ['같은 문제를 먼저 정답 처리해야 리뷰할 수 있습니다.', 'You must solve the same problem correctly before reviewing it.'],
  ['리뷰 담당자만 제안을 제출할 수 있습니다.', 'Only the assigned reviewer can submit suggestions.'],
  ['종료된 리뷰에는 더 이상 작업할 수 없습니다.', 'No further actions can be taken on a closed review.'],
  ['취소된 리뷰는 병합할 수 없습니다.', 'A cancelled review cannot be merged.'],
  ['마지막 관리자는 강등할 수 없습니다.', 'The last admin cannot be demoted.'],
  ['마지막 관리자는 제거할 수 없습니다.', 'The last admin cannot be removed.'],
];

const MESSAGE_LOOKUP = new Map();
for (const [ko, en] of MESSAGE_PAIRS) {
  MESSAGE_LOOKUP.set(ko, { ko, en });
  MESSAGE_LOOKUP.set(en, { ko, en });
}

export function normalizeLocale(value) {
  const raw = String(value || '').toLowerCase();
  const primary = raw.split(',')[0]?.split('-')[0]?.trim();
  return SUPPORTED_LOCALES.has(primary) ? primary : 'en';
}

export function getRequestLocale(req) {
  return normalizeLocale(req?.headers?.['x-language'] || req?.headers?.['accept-language']);
}

export function localizeMessage(message, locale = 'en') {
  if (!message) return message;
  if (typeof message === 'object') {
    return message[locale] || message.en || message.ko || '';
  }
  const entry = MESSAGE_LOOKUP.get(String(message));
  return entry ? entry[locale] : message;
}

export function localizeResponseBody(body, locale = 'en') {
  if (!body || typeof body !== 'object' || Buffer.isBuffer(body)) return body;
  if (typeof body.message === 'string' || typeof body.message === 'object') {
    body.message = localizeMessage(body.message, locale);
  }
  if (body.error && typeof body.error === 'object' && (typeof body.error.message === 'string' || typeof body.error.message === 'object')) {
    body.error.message = localizeMessage(body.error.message, locale);
  }
  return body;
}

export function configureLocale(req, res, next) {
  req.locale = getRequestLocale(req);
  req.t = (ko, en) => localizeMessage({ ko, en }, req.locale);
  const json = res.json.bind(res);
  res.json = (body) => json(localizeResponseBody(body, req.locale));
  next();
}
