export const COMPANY_TAG_PREFIX = '기업:';
export const FALLBACK_TAGS = ['수학', '다이나믹 프로그래밍', '그래프 이론', '문자열', '구현', '소수', 'BFS', 'DFS', '입출력', '그리디', '정렬', '이분 탐색'];
export const VALID_SORTS = new Set(['id', 'newest', 'difficulty', '-difficulty', 'solved']);
export const VALID_STATUS = new Set(['all', 'solved', 'unsolved', 'bookmarked']);
export const VALID_VIEWS = new Set(['table', 'card']);
export const PROBLEM_TYPE_META = {
  algorithm: { label: 'Algorithm', short: 'Algo', color: 'var(--blue)', bg: 'rgba(88,166,255,.12)' },
  coding: { label: 'Coding', short: 'Coding', color: 'var(--blue)', bg: 'rgba(88,166,255,.12)' },
  'fill-blank': { label: 'Fill in the Blank', short: 'Fill', color: 'var(--green)', bg: 'rgba(63,185,80,.12)' },
  'bug-fix': { label: 'Bug Fix', short: 'Bug', color: 'var(--yellow)', bg: 'rgba(227,179,65,.12)' },
  troubleshooting: { label: 'Troubleshooting', short: 'Debug', color: 'var(--orange)', bg: 'rgba(255,166,87,.12)' },
  'performance-fix': { label: 'Performance Fix', short: 'Perf', color: 'var(--red)', bg: 'rgba(248,81,73,.12)' },
  'refactor-fix': { label: 'Refactoring', short: 'Refactor', color: 'var(--purple)', bg: 'rgba(188,140,255,.12)' },
};
const PROBLEM_TYPE_META_KO = {
  algorithm: { label: '알고리즘', short: '알고', color: 'var(--blue)', bg: 'rgba(88,166,255,.12)' },
  coding: { label: '코딩', short: '코딩', color: 'var(--blue)', bg: 'rgba(88,166,255,.12)' },
  'fill-blank': { label: '빈칸 채우기', short: '빈칸', color: 'var(--green)', bg: 'rgba(63,185,80,.12)' },
  'bug-fix': { label: '버그 수정', short: '버그', color: 'var(--yellow)', bg: 'rgba(227,179,65,.12)' },
  troubleshooting: { label: '트러블슈팅', short: '디버그', color: 'var(--orange)', bg: 'rgba(255,166,87,.12)' },
  'performance-fix': { label: '성능 수정', short: '성능', color: 'var(--red)', bg: 'rgba(248,81,73,.12)' },
  'refactor-fix': { label: '리팩터링', short: '리팩터', color: 'var(--purple)', bg: 'rgba(188,140,255,.12)' },
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

export function getProblemTypeMeta(problemType = 'coding', lang = 'en') {
  const source = lang === 'ko' ? PROBLEM_TYPE_META_KO : PROBLEM_TYPE_META;
  return source[problemType] || source.coding;
}


const TAG_TRANSLATIONS_EN = {
  '입출력': 'I/O',
  '구현': 'Implementation',
  '수학': 'Math',
  '문자열': 'String',
  '정렬': 'Sorting',
  '자료 구조': 'Data Structures',
  '해시': 'Hash',
  '스택': 'Stack',
  '큐': 'Queue',
  '우선순위 큐': 'Priority Queue',
  '세그먼트 트리': 'Segment Tree',
  '그리디': 'Greedy',
  '이분 탐색': 'Binary Search',
  '투 포인터': 'Two Pointers',
  '누적 합': 'Prefix Sum',
  '다이나믹 프로그래밍': 'Dynamic Programming',
  '그래프 이론': 'Graph Theory',
  '그래프': 'Graph',
  '최단 경로': 'Shortest Path',
  '트리': 'Tree',
  '유니온-파인드': 'Union-Find',
  '비트마스크': 'Bitmask',
  '백트래킹': 'Backtracking',
  '분리 집합': 'Disjoint Set',
  '소수': 'Prime Numbers',
  '시뮬레이션': 'Simulation',
  '동적계획법': 'Dynamic Programming',
  '정수론': 'Number Theory',
};

export function isCompanyTag(tag) {
  return typeof tag === 'string' && tag.startsWith(COMPANY_TAG_PREFIX);
}

export function getTagLabel(tag) {
  return isCompanyTag(tag) ? tag.slice(COMPANY_TAG_PREFIX.length) : tag;
}

export function getTagLabelLang(tag, lang) {
  if (isCompanyTag(tag)) return tag.slice(COMPANY_TAG_PREFIX.length);
  if (lang === 'en') return TAG_TRANSLATIONS_EN[tag] || tag;
  return tag;
}

export function splitDiscoveryTags(tags = []) {
  const unique = [...new Set((tags || []).filter(Boolean))];
  const companyTags = unique.filter(isCompanyTag).sort((a, b) => getTagLabel(a).localeCompare(getTagLabel(b), 'ko'));
  const algorithmTags = unique.filter((tag) => !isCompanyTag(tag)).sort((a, b) => a.localeCompare(b, 'ko'));
  return { algorithmTags, companyTags };
}

export function getAcceptanceRate(problem) {
  if (problem?.acceptanceRate != null) return Number(problem.acceptanceRate);
  const solved = Number(problem?.solved || problem?.solved_count || 0);
  const submissions = Number(problem?.submissions || problem?.submit_count || 0);
  return submissions > 0 ? Math.round((solved / submissions) * 100) : null;
}
