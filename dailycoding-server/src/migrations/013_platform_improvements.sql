ALTER TABLE problems ADD COLUMN battle_eligible TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE contests ADD COLUMN started_at DATETIME DEFAULT NULL;

CREATE TABLE IF NOT EXISTS admin_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id INT,
  detail JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_id (admin_id),
  INDEX idx_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS problem_editorials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  problem_id INT NOT NULL UNIQUE,
  content LONGTEXT NOT NULL,
  author_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
);

UPDATE problems
SET battle_eligible = 1
WHERE id IN (1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008);

INSERT IGNORE INTO problems (
  id, title, problem_type, preferred_language, special_config, tier, difficulty,
  time_limit, mem_limit, description, input_desc, output_desc, hint, solution,
  visibility, battle_eligible, solved_count, submit_count, author_id, created_at
) VALUES
(
  91001,
  '빈칸 채우기: 재귀 피보나치',
  'fill-blank',
  'python',
  JSON_OBJECT(
    'codeTemplate', 'def fib(n):\n    if n <= ___1___:\n        return n\n    return fib(n - ___2___) + fib(n - ___3___)',
    'blanks', JSON_ARRAY('1', '1', '2'),
    'hint', 'fib(0)=0, fib(1)=1이므로 n이 작을 때 바로 n을 반환합니다.'
  ),
  'bronze',
  2,
  1,
  128,
  '피보나치 수열을 구하는 재귀 함수의 빈칸을 채우세요.',
  '',
  '',
  '재귀의 종료 조건을 먼저 확인하세요.',
  '',
  'global',
  1,
  0,
  0,
  1,
  NOW()
),
(
  91002,
  '빈칸 채우기: 이진 탐색',
  'fill-blank',
  'python',
  JSON_OBJECT(
    'codeTemplate', 'def binary_search(arr, target):\n    lo, hi = ___1___, len(arr) - 1\n    while lo <= hi:\n        mid = (lo + hi) // ___2___\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            lo = ___3___\n        else:\n            hi = mid - 1\n    return -1',
    'blanks', JSON_ARRAY('0', '2', 'mid + 1'),
    'hint', '탐색 구간의 시작과 mid 계산을 다시 보세요.'
  ),
  'silver',
  3,
  1,
  128,
  '이진 탐색 코드의 빈칸을 채우세요.',
  '',
  '',
  'mid 이후 구간으로 이동하는 부분을 확인하세요.',
  '',
  'global',
  1,
  0,
  0,
  1,
  NOW()
),
(
  91003,
  '버그 수정: 최댓값 찾기',
  'bug-fix',
  'python',
  JSON_OBJECT(
    'buggyCode', 'def find_max(arr):\n    max_val = 0\n    for x in arr:\n        if x > max_val:\n            max_val = x\n    return max_val',
    'keywords', JSON_ARRAY('arr[0]'),
    'hint', '모든 원소가 음수인 경우를 생각해보세요.',
    'explanation', '0으로 초기화하면 음수 배열에서 잘못된 결과가 나옵니다.'
  ),
  'bronze',
  2,
  1,
  128,
  '배열에서 최댓값을 찾는 코드의 버그를 수정하세요.',
  '',
  '',
  '초기값 설정이 핵심입니다.',
  '',
  'global',
  1,
  0,
  0,
  1,
  NOW()
),
(
  91004,
  '버그 수정: 버블 정렬 IndexError',
  'bug-fix',
  'python',
  JSON_OBJECT(
    'buggyCode', 'def bubble_sort(arr):\n    n = len(arr)\n    for i in range(n):\n        for j in range(n - i):\n            if arr[j] > arr[j + 1]:\n                arr[j], arr[j + 1] = arr[j + 1], arr[j]\n    return arr',
    'keywords', JSON_ARRAY('n - i - 1'),
    'hint', 'j + 1이 배열 범위를 넘지 않아야 합니다.',
    'explanation', '내부 루프의 종료 조건이 하나 크게 잡혀 있습니다.'
  ),
  'silver',
  3,
  1,
  128,
  '버블 정렬 코드의 인덱스 버그를 수정하세요.',
  '',
  '',
  '루프 상한을 다시 계산해보세요.',
  '',
  'global',
  1,
  0,
  0,
  1,
  NOW()
);
