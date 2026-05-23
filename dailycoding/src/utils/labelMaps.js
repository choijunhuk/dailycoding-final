const normalizeLang = (lang) => (lang === 'kr' || lang === 'ko' ? 'ko' : 'en');
const normalizeKey = (value = '') => String(value).trim().toLowerCase().replace(/[\s_-]+/g, '-');

export const tierLabels = {
  ko: {
    unranked: '언랭크드', iron: '아이언', bronze: '브론즈', silver: '실버', gold: '골드',
    platinum: '플래티넘', emerald: '에메랄드', diamond: '다이아몬드', ruby: '루비',
    master: '마스터', grandmaster: '그랜드마스터', challenger: '챌린저',
  },
  en: {
    unranked: 'Unranked', iron: 'Iron', bronze: 'Bronze', silver: 'Silver', gold: 'Gold',
    platinum: 'Platinum', emerald: 'Emerald', diamond: 'Diamond', ruby: 'Ruby',
    master: 'Master', grandmaster: 'Grandmaster', challenger: 'Challenger',
  },
};

export const difficultyLabels = {
  ko: { easy: '쉬움', normal: '보통', medium: '보통', hard: '어려움' },
  en: { easy: 'Easy', normal: 'Medium', medium: 'Medium', hard: 'Hard' },
};

export const problemTypeLabels = {
  ko: {
    algorithm: '알고리즘', coding: '알고리즘', 'fill-blank': '빈칸 채우기', 'bug-fix': '버그 수정',
    troubleshooting: '트러블슈팅', 'performance-fix': '성능 최적화', 'refactor-fix': '리팩터링',
  },
  en: {
    algorithm: 'Algorithm', coding: 'Algorithm', 'fill-blank': 'Fill in the Blank', 'bug-fix': 'Bug Fix',
    troubleshooting: 'Troubleshooting', 'performance-fix': 'Performance Optimization', 'refactor-fix': 'Refactoring',
  },
};

export const problemTypeShortLabels = {
  ko: {
    algorithm: '알고리즘', coding: '알고리즘', 'fill-blank': '빈칸', 'bug-fix': '버그',
    troubleshooting: '트러블슈팅', 'performance-fix': '성능', 'refactor-fix': '리팩터링',
  },
  en: {
    algorithm: 'Algorithm', coding: 'Algorithm', 'fill-blank': 'Fill', 'bug-fix': 'Bug',
    troubleshooting: 'Trouble', 'performance-fix': 'Perf', 'refactor-fix': 'Refactor',
  },
};

const TECH_TERMS = new Set(['bfs', 'dfs', 'dp', 'sql', 'api', 'rest', 'jwt', 'oauth', 'http', 'https', 'tcp', 'udp', 'json', 'xml', 'git', 'github', 'docker', 'redis', 'mysql', 'react', 'node.js', 'nodejs', 'gemini ai']);

const TAG_KO_TO_EN = {
  '입출력': 'I/O', '구현': 'Implementation', '수학': 'Math', '문자열': 'String', '정렬': 'Sorting',
  '자료 구조': 'Data Structure', '자료구조': 'Data Structure', '해시': 'Hash', '스택': 'Stack', '큐': 'Queue',
  '스택/큐': 'Stack / Queue', '트리': 'Tree', '힙': 'Heap', '우선순위 큐': 'Priority Queue',
  '세그먼트 트리': 'Segment Tree', '그리디': 'Greedy', '탐욕': 'Greedy', '이분 탐색': 'Binary Search',
  '투 포인터': 'Two Pointers', '누적 합': 'Prefix Sum', '누적합': 'Prefix Sum',
  '다이나믹 프로그래밍': 'Dynamic Programming', '동적 계획법': 'Dynamic Programming', '동적계획법': 'Dynamic Programming',
  '그래프 이론': 'Graph Theory', '그래프': 'Graph', '그래프 탐색': 'Graph Traversal', '탐색': 'Search',
  '최단 경로': 'Shortest Path', '기하': 'Geometry', '시뮬레이션': 'Simulation', '완전 탐색': 'Brute Force',
  '브루트포스': 'Brute Force', '백트래킹': 'Backtracking', '분리 집합': 'Disjoint Set',
  '유니온-파인드': 'Union-Find', '비트마스크': 'Bitmask', '소수': 'Prime Numbers', '정수론': 'Number Theory',
  '알고리즘': 'Algorithm',
  '다익스트라': 'Dijkstra', '벨만-포드': 'Bellman-Ford', '플로이드-워셜': 'Floyd-Warshall',
  '크루스칼': 'Kruskal', '프림': 'Prim', '위상 정렬': 'Topological Sort',
  '최소 신장 트리': 'Minimum Spanning Tree', 'mst': 'MST',
  '강한 연결 요소': 'SCC', '이분 그래프': 'Bipartite Graph',
  '최대 유량': 'Max Flow', '네트워크 유량': 'Network Flow',
  '문자열 검색': 'String Search', 'kmp': 'KMP', '트라이': 'Trie',
  '슬라이딩 윈도우': 'Sliding Window', '분할 정복': 'Divide and Conquer',
  '재귀': 'Recursion', '피보나치': 'Fibonacci', '메모이제이션': 'Memoization',
  '정수': 'Integer', '소인수분해': 'Prime Factorization', '유클리드': 'Euclidean',
  '조합': 'Combinations', '순열': 'Permutations', '경우의 수': 'Combinatorics',
  '덱': 'Deque', '연결 리스트': 'Linked List', '배열': 'Array', '집합': 'Set', '맵': 'Map',
};

const TAG_EN_TO_KO = Object.fromEntries(Object.entries(TAG_KO_TO_EN).map(([ko, en]) => [en.toLowerCase(), ko]));
Object.assign(TAG_EN_TO_KO, {
  'dynamic-programming': '동적 계획법', dynamicprogramming: '동적 계획법', dp: 'DP', graph: '그래프', search: '탐색',
  sorting: '정렬', string: '문자열', 'binary-search': '이분 탐색', binarysearch: '이분 탐색',
  'shortest-path': '최단 경로', shortestpath: '최단 경로', geometry: '기하', simulation: '시뮬레이션',
  'brute-force': '브루트포스', bruteforce: '브루트포스', backtracking: '백트래킹', 'prefix-sum': '누적합',
  prefixsum: '누적합', 'two-pointer': '투 포인터', 'two-pointers': '투 포인터', twopointer: '투 포인터',
  twopointers: '투 포인터', stack: '스택', queue: '큐', tree: '트리', heap: '힙', hash: '해시',
  algorithm: '알고리즘', implementation: '구현', math: '수학', greedy: '그리디', 'data-structure': '자료구조',
  datastructure: '자료구조', 'data-structures': '자료구조', datastructures: '자료구조',
});

export const tagLabels = { ko: TAG_EN_TO_KO, en: TAG_KO_TO_EN };

export const statusLabels = {
  ko: {
    all: '전체', solved: '해결', unsolved: '미해결', bookmarked: '북마크', correct: '정답', wrong: '오답',
    accepted: '정답', pending: '대기 중', judging: '채점 중', timeout: '시간 초과', error: '오류', compile: '컴파일 에러',
    live: '진행 중', running: '진행 중', upcoming: '예정', waiting: '대기 중', ended: '종료', approved: '승인됨', rejected: '거절됨',
  },
  en: {
    all: 'All', solved: 'Solved', unsolved: 'Unsolved', bookmarked: 'Bookmarked', correct: 'Accepted', wrong: 'Wrong Answer',
    accepted: 'Accepted', pending: 'Pending', judging: 'Judging', timeout: 'Timeout', error: 'Error', compile: 'Compile Error',
    live: 'Live', running: 'Running', upcoming: 'Upcoming', waiting: 'Waiting', ended: 'Ended', approved: 'Approved', rejected: 'Rejected',
  },
};

export const sortLabels = {
  ko: { id: '번호순', newest: '최신순', difficulty: '쉬운순', '-difficulty': '어려운순', solved: '많이 푼 순' },
  en: { id: 'By ID', newest: 'Newest', difficulty: 'Easiest First', '-difficulty': 'Hardest First', solved: 'Most solved' },
};

export const filterLabels = {
  ko: { tier: '티어', difficulty: '난이도', type: '문제 유형', tags: '태그', status: '상태', sort: '정렬' },
  en: { tier: 'Tier', difficulty: 'Difficulty', type: 'Problem Type', tags: 'Tags', status: 'Status', sort: 'Sort' },
};

export function getTierLabel(tier, lang = 'en') {
  const locale = normalizeLang(lang);
  const key = normalizeKey(tier);
  return tierLabels[locale][key] || tierLabels.en[key] || String(tier || '').toUpperCase();
}

export function getDifficultyLabel(difficulty, lang = 'en') {
  const locale = normalizeLang(lang);
  if (typeof difficulty === 'number' || /^\d+$/.test(String(difficulty))) {
    const value = Number(difficulty);
    if (value <= 3) return difficultyLabels[locale].easy;
    if (value <= 6) return difficultyLabels[locale].medium;
    return difficultyLabels[locale].hard;
  }
  const key = normalizeKey(difficulty);
  return difficultyLabels[locale][key] || difficultyLabels.en[key] || String(difficulty || '');
}

export function getProblemTypeLabel(type, lang = 'en', { short = false } = {}) {
  const locale = normalizeLang(lang);
  const key = normalizeKey(type || 'coding');
  const source = short ? problemTypeShortLabels : problemTypeLabels;
  return source[locale][key] || source.en[key] || String(type || '');
}

export function getTagLabel(tag, lang = 'en') {
  if (!tag) return '';
  const text = String(tag);
  const lowered = text.toLowerCase();
  if (TECH_TERMS.has(lowered)) return text;
  const locale = normalizeLang(lang);
  if (locale === 'en') return TAG_KO_TO_EN[text] || text;
  return TAG_EN_TO_KO[lowered] || TAG_EN_TO_KO[normalizeKey(text)] || text;
}

export function getStatusLabel(status, lang = 'en') {
  const locale = normalizeLang(lang);
  const key = normalizeKey(status);
  return statusLabels[locale][key] || statusLabels.en[key] || String(status || '');
}

export function getSortLabel(sort, lang = 'en') {
  const locale = normalizeLang(lang);
  return sortLabels[locale][sort] || sortLabels.en[sort] || String(sort || '');
}

export function getFilterLabel(filter, lang = 'en') {
  const locale = normalizeLang(lang);
  const key = normalizeKey(filter);
  return filterLabels[locale][key] || filterLabels.en[key] || String(filter || '');
}
