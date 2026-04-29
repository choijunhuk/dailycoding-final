ALTER TABLE problems ADD COLUMN problem_type ENUM('coding','fill-blank','bug-fix') NOT NULL DEFAULT 'coding' AFTER title;
ALTER TABLE problems ADD COLUMN preferred_language VARCHAR(20) NULL AFTER problem_type;
ALTER TABLE problems ADD COLUMN special_config JSON NULL AFTER preferred_language;

INSERT INTO problems (
  title, problem_type, preferred_language, special_config, tier, difficulty, time_limit, mem_limit,
  description, input_desc, output_desc, hint, solution, visibility, solved_count, submit_count, created_at
)
SELECT
  '빈칸 채우기: 피보나치 재귀', 'fill-blank', 'python',
  JSON_OBJECT(
    'codeTemplate', 'def fib(n):\n    if n <= ___1___:\n        return n\n    return fib(n - ___2___) + fib(n - ___3___)',
    'blanks', JSON_ARRAY('1', '1', '2'),
    'hint', 'fib(0)=0, fib(1)=1을 만족하도록 빈칸을 채우세요.'
  ),
  'bronze', 3, 1, 128,
  '재귀 피보나치 코드의 빈칸을 채워 정답 코드를 완성하세요.',
  '입력 없음', '출력 없음',
  '베이스 케이스와 재귀 감소량을 확인하세요.',
  '',
  'global', 0, 0, NOW()
WHERE NOT EXISTS (SELECT 1 FROM problems WHERE title = '빈칸 채우기: 피보나치 재귀' AND problem_type = 'fill-blank');

INSERT INTO problems (
  title, problem_type, preferred_language, special_config, tier, difficulty, time_limit, mem_limit,
  description, input_desc, output_desc, hint, solution, visibility, solved_count, submit_count, created_at
)
SELECT
  '빈칸 채우기: 이진 탐색', 'fill-blank', 'python',
  JSON_OBJECT(
    'codeTemplate', 'def binary_search(arr, target):\n    lo, hi = ___1___, len(arr) - 1\n    while lo <= hi:\n        mid = (lo + hi) // ___2___\n        if arr[mid] == target: return mid\n        elif arr[mid] < target: lo = ___3___\n        else: hi = mid - 1\n    return -1',
    'blanks', JSON_ARRAY('0', '2', 'mid + 1'),
    'hint', '탐색 구간의 시작/중간/증가 연산을 점검하세요.'
  ),
  'silver', 4, 1, 128,
  '이진 탐색 코드 빈칸을 채워 완성하세요.',
  '입력 없음', '출력 없음',
  'mid 계산과 lo 갱신을 확인해보세요.',
  '',
  'global', 0, 0, NOW()
WHERE NOT EXISTS (SELECT 1 FROM problems WHERE title = '빈칸 채우기: 이진 탐색' AND problem_type = 'fill-blank');

INSERT INTO problems (
  title, problem_type, preferred_language, special_config, tier, difficulty, time_limit, mem_limit,
  description, input_desc, output_desc, hint, solution, visibility, solved_count, submit_count, created_at
)
SELECT
  '틀린부분 찾기: 최댓값 찾기', 'bug-fix', 'python',
  JSON_OBJECT(
    'buggyCode', 'def find_max(arr):\n    max_val = 0\n    for x in arr:\n        if x > max_val:\n            max_val = x\n    return max_val',
    'keywords', JSON_ARRAY('arr[0]'),
    'hint', '모든 수가 음수일 때도 동작해야 합니다.',
    'explanation', '초기값을 0으로 두면 음수 배열에서 오답이 됩니다.'
  ),
  'silver', 4, 1, 128,
  '버그가 있는 코드를 보고 수정 포인트를 찾아보세요.',
  '입력 없음', '출력 없음',
  '초기화 값을 확인하세요.',
  '',
  'global', 0, 0, NOW()
WHERE NOT EXISTS (SELECT 1 FROM problems WHERE title = '틀린부분 찾기: 최댓값 찾기' AND problem_type = 'bug-fix');

INSERT INTO problems (
  title, problem_type, preferred_language, special_config, tier, difficulty, time_limit, mem_limit,
  description, input_desc, output_desc, hint, solution, visibility, solved_count, submit_count, created_at
)
SELECT
  '틀린부분 찾기: 버블 정렬 인덱스', 'bug-fix', 'python',
  JSON_OBJECT(
    'buggyCode', 'def bubble_sort(arr):\n    n = len(arr)\n    for i in range(n):\n        for j in range(n - i):\n            if arr[j] > arr[j + 1]:\n                arr[j], arr[j + 1] = arr[j + 1], arr[j]\n    return arr',
    'keywords', JSON_ARRAY('n - i - 1'),
    'hint', 'j+1 접근 시 배열 범위를 넘지 않아야 합니다.',
    'explanation', '내부 반복의 상한이 1 크게 설정돼 IndexError를 유발합니다.'
  ),
  'gold', 5, 1, 128,
  '버그를 찾아 올바른 수정 코드를 입력하세요.',
  '입력 없음', '출력 없음',
  '반복문의 upper bound를 점검하세요.',
  '',
  'global', 0, 0, NOW()
WHERE NOT EXISTS (SELECT 1 FROM problems WHERE title = '틀린부분 찾기: 버블 정렬 인덱스' AND problem_type = 'bug-fix');

INSERT INTO problems (
  title, problem_type, preferred_language, special_config, tier, difficulty, time_limit, mem_limit,
  description, input_desc, output_desc, hint, solution, visibility, solved_count, submit_count, created_at
)
SELECT
  '빈칸 채우기: 누적합', 'fill-blank', 'python',
  JSON_OBJECT(
    'codeTemplate', 'arr = [1, 2, 3, 4]\nprefix = [0] * (len(arr) + 1)\nfor i in range(len(arr)):\n    prefix[i+1] = prefix[i] + ___1___',
    'blanks', JSON_ARRAY('arr[i]'),
    'hint', 'prefix[i+1]은 이전 합에 현재 값을 더합니다.'
  ),
  'bronze', 3, 1, 128,
  '누적합 코드의 빈칸을 채워 완성하세요.',
  '입력 없음', '출력 없음', '인덱스 i의 현재 값을 더하세요.', '',
  'global', 0, 0, NOW()
WHERE NOT EXISTS (SELECT 1 FROM problems WHERE title = '빈칸 채우기: 누적합' AND problem_type = 'fill-blank');

INSERT INTO problems (
  title, problem_type, preferred_language, special_config, tier, difficulty, time_limit, mem_limit,
  description, input_desc, output_desc, hint, solution, visibility, solved_count, submit_count, created_at
)
SELECT
  '빈칸 채우기: DFS 방문', 'fill-blank', 'python',
  JSON_OBJECT(
    'codeTemplate', 'def dfs(node):\n    visited[node] = True\n    for nxt in graph[node]:\n        if not visited[nxt]:\n            ___1___',
    'blanks', JSON_ARRAY('dfs(nxt)'),
    'hint', '재귀 DFS는 다음 노드를 다시 dfs로 방문합니다.'
  ),
  'silver', 4, 1, 128,
  'DFS 재귀 코드의 핵심 빈칸을 완성하세요.',
  '입력 없음', '출력 없음', '재귀 호출 문장을 채우면 됩니다.', '',
  'global', 0, 0, NOW()
WHERE NOT EXISTS (SELECT 1 FROM problems WHERE title = '빈칸 채우기: DFS 방문' AND problem_type = 'fill-blank');

INSERT INTO problems (
  title, problem_type, preferred_language, special_config, tier, difficulty, time_limit, mem_limit,
  description, input_desc, output_desc, hint, solution, visibility, solved_count, submit_count, created_at
)
SELECT
  '틀린부분 찾기: 이진 탐색 종료조건', 'bug-fix', 'python',
  JSON_OBJECT(
    'buggyCode', 'while lo < hi:\n    mid = (lo + hi) // 2\n    if arr[mid] < target:\n        lo = mid + 1\n    else:\n        hi = mid - 1',
    'keywords', JSON_ARRAY('while lo <= hi', 'hi = mid'),
    'hint', '경계 포함 여부와 hi 갱신식이 맞는지 보세요.',
    'explanation', '종료조건/경계 갱신이 잘못되면 값을 놓치거나 무한루프가 납니다.'
  ),
  'gold', 5, 1, 128,
  '이진 탐색 코드의 버그를 찾아 수정하세요.',
  '입력 없음', '출력 없음', '경계 포함을 확인하세요.', '',
  'global', 0, 0, NOW()
WHERE NOT EXISTS (SELECT 1 FROM problems WHERE title = '틀린부분 찾기: 이진 탐색 종료조건' AND problem_type = 'bug-fix');

INSERT INTO problems (
  title, problem_type, preferred_language, special_config, tier, difficulty, time_limit, mem_limit,
  description, input_desc, output_desc, hint, solution, visibility, solved_count, submit_count, created_at
)
SELECT
  '틀린부분 찾기: 큐 초기화', 'bug-fix', 'python',
  JSON_OBJECT(
    'buggyCode', 'from collections import deque\nq = deque\nq.append(start)',
    'keywords', JSON_ARRAY('q = deque()'),
    'hint', 'deque 클래스를 인스턴스로 만들어야 합니다.',
    'explanation', 'q = deque 는 함수 참조이며 append 호출 시 오류가 납니다.'
  ),
  'silver', 4, 1, 128,
  '큐 초기화 버그를 수정하세요.',
  '입력 없음', '출력 없음', '괄호 누락 여부를 확인하세요.', '',
  'global', 0, 0, NOW()
WHERE NOT EXISTS (SELECT 1 FROM problems WHERE title = '틀린부분 찾기: 큐 초기화' AND problem_type = 'bug-fix');
