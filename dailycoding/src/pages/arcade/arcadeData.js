// Shared question banks and snippets for the arcade quiz/debug games.
// Kept on the frontend because each round draws from a small public pool;
// difficulty/scoring is the gameplay layer, not the snippet itself.

export const OUTPUT_QUESTIONS = [
  {
    code: `nums = [1, 2, 3]\nprint(sum(nums) * 2)`,
    options: ['6', '12', '9', '0'],
    answer: '12',
  },
  {
    code: `a = "hello"\nprint(a[::-1])`,
    options: ['hello', 'olleh', 'h e l l o', 'Error'],
    answer: 'olleh',
  },
  {
    code: `print([i*i for i in range(4)])`,
    options: ['[0, 1, 2, 3]', '[0, 1, 4, 9]', '[1, 4, 9, 16]', '[1, 2, 4, 8]'],
    answer: '[0, 1, 4, 9]',
  },
  {
    code: `d = {'a': 1, 'b': 2}\nprint(len(d))`,
    options: ['1', '2', '3', 'Error'],
    answer: '2',
  },
  {
    code: `console.log(typeof null)`,
    options: ['"null"', '"undefined"', '"object"', '"boolean"'],
    answer: '"object"',
  },
  {
    code: `console.log([1,2,3].map(x => x + 1))`,
    options: ['[1,2,3]', '[2,3,4]', '[1,3,5]', 'undefined'],
    answer: '[2,3,4]',
  },
  {
    code: `let x = 5;\nlet y = "5";\nconsole.log(x == y, x === y)`,
    options: ['true true', 'false false', 'true false', 'false true'],
    answer: 'true false',
  },
  {
    code: `int x = 10;\nprintf("%d\\n", x++ + ++x);`,
    options: ['20', '21', '22', '23'],
    answer: '22',
  },
  {
    code: `s = "abc"\nprint(s * 3)`,
    options: ['abc abc abc', 'abcabcabc', 'abc3', 'Error'],
    answer: 'abcabcabc',
  },
  {
    code: `print(bool(0), bool([]), bool("0"))`,
    options: ['True True True', 'False False False', 'False False True', 'False True False'],
    answer: 'False False True',
  },
  {
    code: `console.log(0.1 + 0.2 === 0.3)`,
    options: ['true', 'false', 'NaN', 'undefined'],
    answer: 'false',
  },
  {
    code: `arr = [1,2,3]\narr.append(arr)\nprint(len(arr))`,
    options: ['3', '4', 'Infinite', 'Error'],
    answer: '4',
  },
]

export const BIGO_QUESTIONS = [
  {
    code: `for i in range(n):\n    print(i)`,
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'],
    answer: 'O(n)',
  },
  {
    code: `for i in range(n):\n    for j in range(n):\n        print(i, j)`,
    options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(2ⁿ)'],
    answer: 'O(n²)',
  },
  {
    code: `def bsearch(arr, target):\n    lo, hi = 0, len(arr)-1\n    while lo <= hi:\n        mid = (lo+hi)//2\n        if arr[mid] == target: return mid\n        elif arr[mid] < target: lo = mid+1\n        else: hi = mid-1`,
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
    answer: 'O(log n)',
  },
  {
    code: `def fib(n):\n    if n <= 1: return n\n    return fib(n-1) + fib(n-2)`,
    options: ['O(n)', 'O(n²)', 'O(2ⁿ)', 'O(n!)'],
    answer: 'O(2ⁿ)',
  },
  {
    code: `arr.sort()  # standard library sort`,
    options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'],
    answer: 'O(n log n)',
  },
  {
    code: `def access(arr, i):\n    return arr[i]`,
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'],
    answer: 'O(1)',
  },
  {
    code: `i = n\nwhile i > 0:\n    i //= 2`,
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(√n)'],
    answer: 'O(log n)',
  },
  {
    code: `def perms(arr):\n    if len(arr) <= 1: return [arr]\n    res = []\n    for i in range(len(arr)):\n        for p in perms(arr[:i]+arr[i+1:]):\n            res.append([arr[i]]+p)\n    return res`,
    options: ['O(n²)', 'O(2ⁿ)', 'O(n!)', 'O(nⁿ)'],
    answer: 'O(n!)',
  },
  {
    code: `# Merge two sorted arrays of size n\nresult = []\ni = j = 0\nwhile i < n and j < n:\n    if a[i] < b[j]: result.append(a[i]); i+=1\n    else: result.append(b[j]); j+=1`,
    options: ['O(log n)', 'O(n)', 'O(n log n)', 'O(n²)'],
    answer: 'O(n)',
  },
  {
    code: `for i in range(n):\n    j = 1\n    while j < n:\n        j *= 2`,
    options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(n²)'],
    answer: 'O(n log n)',
  },
]

export const BUG_HUNT_SNIPPETS = [
  {
    lang: 'python',
    title: '평균 구하기',
    lines: [
      'def avg(arr):',
      '    s = 0',
      '    for x in arr:',
      '        s += x',
      '    return s / len(s)',
      '',
      'print(avg([1, 2, 3, 4]))',
    ],
    buggyLine: 4, // 0-indexed: "return s / len(s)" — should be len(arr)
    explain: 'len(s)는 정수에 호출되어 오류. len(arr)이어야 함.',
  },
  {
    lang: 'javascript',
    title: '최댓값',
    lines: [
      'function findMax(arr) {',
      '  let max = 0;',
      '  for (let x of arr) {',
      '    if (x > max) max = x;',
      '  }',
      '  return max;',
      '}',
      'console.log(findMax([-3, -1, -5])); // -1 기대',
    ],
    buggyLine: 1, // "let max = 0;" — negative numbers break it
    explain: '음수 배열에서 0이 반환됨. max를 arr[0] 또는 -Infinity로 초기화해야 함.',
  },
  {
    lang: 'python',
    title: '문자열 뒤집기',
    lines: [
      'def reverse(s):',
      '    out = ""',
      '    for i in range(len(s)):',
      '        out = s[i] + out',
      '    return out[::-1]',
      '',
      'print(reverse("abc"))  # cba 기대',
    ],
    buggyLine: 4, // return out[::-1] — out is already reversed
    explain: 'out은 이미 뒤집힌 상태인데 또 뒤집어서 원본이 출력됨.',
  },
  {
    lang: 'cpp',
    title: '벡터 순회',
    lines: [
      '#include <vector>',
      'using namespace std;',
      'int sumAll(vector<int>& v) {',
      '  int s = 0;',
      '  for (int i = 0; i <= v.size(); i++) {',
      '    s += v[i];',
      '  }',
      '  return s;',
      '}',
    ],
    buggyLine: 4, // "i <= v.size()" — out of range
    explain: 'i <= v.size()는 범위를 넘어 접근. < 으로 바꿔야 함.',
  },
  {
    lang: 'javascript',
    title: '비동기 합계',
    lines: [
      'async function total(ids) {',
      '  let sum = 0;',
      '  ids.forEach(async (id) => {',
      '    const val = await fetchValue(id);',
      '    sum += val;',
      '  });',
      '  return sum;',
      '}',
    ],
    buggyLine: 2, // forEach with async — sum returned before promises resolve
    explain: 'forEach는 async 콜백을 기다리지 않음. for...of 또는 Promise.all 필요.',
  },
  {
    lang: 'python',
    title: '딕셔너리 카운트',
    lines: [
      'def count(words):',
      '    counter = {}',
      '    for w in words:',
      '        counter[w] = counter[w] + 1',
      '    return counter',
      '',
      'print(count(["a", "b", "a"]))',
    ],
    buggyLine: 3, // counter[w] when key absent → KeyError
    explain: '키가 없을 때 KeyError. counter.get(w, 0) + 1 로 해야 함.',
  },
  {
    lang: 'python',
    title: '배열 복사',
    lines: [
      'def shifted(arr, k):',
      '    out = arr',
      '    for i in range(k):',
      '        out.append(out.pop(0))',
      '    return out',
      '',
      'data = [1, 2, 3]',
      'print(shifted(data, 1), data)',
    ],
    buggyLine: 1, // "out = arr" reference, not copy
    explain: '리스트 참조를 공유. arr[:] 또는 list(arr)로 복사해야 함.',
  },
]

export const TYPING_SNIPPETS = [
  `function reverse(s) {\n  return s.split('').reverse().join('');\n}`,
  `def fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a`,
  `const sum = arr => arr.reduce((a, b) => a + b, 0);`,
  `int bsearch(int* a, int n, int t) {\n  int lo = 0, hi = n - 1;\n  while (lo <= hi) {\n    int m = (lo + hi) / 2;\n    if (a[m] == t) return m;\n    if (a[m] < t) lo = m + 1; else hi = m - 1;\n  }\n  return -1;\n}`,
  `class Node:\n    def __init__(self, v):\n        self.v = v\n        self.next = None`,
  `for (let i = 0; i < n; i++) {\n  for (let j = i + 1; j < n; j++) {\n    if (arr[i] + arr[j] === target) return [i, j];\n  }\n}`,
]
