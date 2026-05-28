ALTER TABLE learning_paths
  ADD COLUMN title_en VARCHAR(200) NULL DEFAULT NULL AFTER title,
  ADD COLUMN description_en TEXT NULL DEFAULT NULL AFTER description;

UPDATE learning_paths SET
  title_en = 'Hello, World!: Input & Output',
  description_en = 'Your first program! Learn how to print Hello World in Python, JS, C, C++, and Java — one output statement, five languages.'
WHERE title = 'Hello, World!: 입력과 출력';

UPDATE learning_paths SET
  title_en = 'Arithmetic & Variables',
  description_en = 'Read two numbers and output their sum. Learn basic I/O and variable usage across 5 languages.'
WHERE title = '사칙연산과 변수';

UPDATE learning_paths SET
  title_en = 'Conditionals',
  description_en = 'Use if/else to determine odd or even. Master conditional logic in 5 languages.'
WHERE title = '조건문 기초';

UPDATE learning_paths SET
  title_en = 'Loops & Accumulation',
  description_en = 'Find the maximum value and compute factorials with loops. Learn loop control flow in 5 languages.'
WHERE title = '반복문과 누적 계산';

UPDATE learning_paths SET
  title_en = 'Arrays & Collections',
  description_en = 'Compute averages and minimums, then sort arrays. Build your data structure foundation in 5 languages.'
WHERE title = '배열과 컬렉션';

UPDATE learning_paths SET
  title_en = 'Bug Hunt: Basic Errors',
  description_en = 'Analyze common beginner bugs — negative number handling, join arguments, pointer passing — in 5 languages.'
WHERE title = '버그 찾기: 기초 오류';

UPDATE learning_paths SET
  title_en = 'Bug Hunt: Loop & Boundary Errors',
  description_en = 'Drill boundary errors: reference copies, off-by-one, Fibonacci base cases, and string comparison bugs.'
WHERE title = '버그 찾기: 반복·경계 오류';

UPDATE learning_paths SET
  title_en = 'Coding Test Intro A',
  description_en = 'Seven must-know coding test problems: A+B, arithmetic, Fibonacci, odd/even, and maximum value.'
WHERE title = '코딩테스트 입문 A';

UPDATE learning_paths SET
  title_en = 'Coding Test Intro B',
  description_en = 'Complete your intro: factorial, string reversal, digit sum, divisors, and minimum value.'
WHERE title = '코딩테스트 입문 B';

UPDATE learning_paths SET
  title_en = 'Silver Challenge',
  description_en = 'Silver-level algorithm problems covering stacks, queues, and brute-force search. Serious coding test prep starts here.'
WHERE title = '실버 도전';
