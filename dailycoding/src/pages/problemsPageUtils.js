export const FALLBACK_TAGS = ['수학', '다이나믹 프로그래밍', '그래프 이론', '문자열', '구현', '소수', 'BFS', 'DFS', '입출력', '탐욕', '정렬', '이분 탐색'];
export const VALID_SORTS = new Set(['id', 'newest', 'difficulty', '-difficulty', 'solved']);
export const VALID_STATUS = new Set(['all', 'solved', 'unsolved', 'bookmarked']);
export const VALID_VIEWS = new Set(['table', 'card']);
export const PROBLEM_TYPE_META = {
  coding: { label: '일반 풀이', short: '코딩', color: 'var(--blue)', bg: 'rgba(88,166,255,.12)' },
  'fill-blank': { label: '빈칸 채우기', short: '빈칸', color: 'var(--green)', bg: 'rgba(63,185,80,.12)' },
  'bug-fix': { label: '틀린부분 찾기', short: '버그', color: 'var(--yellow)', bg: 'rgba(227,179,65,.12)' },
};
export const VIEW_PAGE_SIZE = { table: 10, card: 9 };

export function resolveStoredView(rawValue) {
  return VALID_VIEWS.has(rawValue) ? rawValue : 'table';
}

export function getStoredView(storage = typeof window !== 'undefined' ? window.localStorage : null) {
  if (!storage) return 'table';
  return resolveStoredView(storage.getItem('dc_problem_view'));
}

export function parsePositiveInt(value, fallback = 1) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function sortProblems(list, sort) {
  return [...list].sort((a, b) => {
    if (sort === 'difficulty') return (a.difficulty || 0) - (b.difficulty || 0);
    if (sort === '-difficulty') return (b.difficulty || 0) - (a.difficulty || 0);
    if (sort === 'newest') {
      return new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0);
    }
    if (sort === 'solved') return (b.solved || b.solved_count || 0) - (a.solved || a.solved_count || 0);
    return (a.id || 0) - (b.id || 0);
  });
}

export function getProblemTypeMeta(problemType = 'coding') {
  return PROBLEM_TYPE_META[problemType] || PROBLEM_TYPE_META.coding;
}
