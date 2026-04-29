export const DEFAULT_CODE = {
  python: '# Python 3\n',
  javascript: '// JavaScript\n',
  cpp: '// C++17\n',
  java: '// Java\npublic class Main {\n    public static void main(String[] args) {\n\n    }\n}\n',
  c: '// C\n#include <stdio.h>\nint main(){\n\n}\n',
};

export const RESULT_INFO_COLORS = {
  correct: 'var(--green)',
  success: 'var(--green)',
  wrong: 'var(--red)',
  timeout: 'var(--yellow)',
  error: 'var(--orange)',
  compile: 'var(--orange)',
  judging: 'var(--blue)',
};

export function getDraftStorageKey(problemId, language) {
  return `judge:draft:${problemId || 'default'}:${language}`;
}

export function getLegacyDraftStorageKey(problemId, language) {
  return `dc_code_${problemId || 'default'}_${language}`;
}

export function getSnippetStorageKey(problemId, language) {
  return `snippet:${problemId || 'default'}:${language}`;
}

export function parseSpecialConfig(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

export const TEMPLATES = {
  python: [
    { name: '기본 입출력', code: 'import sys\ninput = sys.stdin.readline\n\nn = int(input())\narr = list(map(int, input().split()))\n\n# 풀이\nprint(result)\n' },
    { name: '여러 줄 입력', code: 'import sys\ninput = sys.stdin.readline\n\nn = int(input())\nfor _ in range(n):\n    line = input().strip()\n    # 처리\n' },
    { name: 'BFS 탐색', code: 'from collections import deque\n\ndef bfs(start):\n    visited = set([start])\n    q = deque([start])\n    while q:\n        cur = q.popleft()\n        for nxt in graph[cur]:\n            if nxt not in visited:\n                visited.add(nxt)\n                q.append(nxt)\n' },
    { name: 'DP 기본', code: 'n = int(input())\ndp = [0] * (n + 1)\n\n# 초기값\ndp[0] = 0\ndp[1] = 1\n\nfor i in range(2, n + 1):\n    dp[i] = dp[i-1] + dp[i-2]\n\nprint(dp[n])\n' },
  ],
  javascript: [
    { name: '기본 입출력 (Node)', code: 'const input = require("fs").readFileSync("/dev/stdin","utf8").trim().split("\\n");\nconst n = Number(input[0]);\nconst arr = input[1].split(" ").map(Number);\n\n// 풀이\nconsole.log(result);\n' },
    { name: 'BFS 탐색', code: 'function bfs(start, graph) {\n  const visited = new Set([start]);\n  const q = [start];\n  while (q.length) {\n    const cur = q.shift();\n    for (const nxt of graph[cur]) {\n      if (!visited.has(nxt)) {\n        visited.add(nxt);\n        q.push(nxt);\n      }\n    }\n  }\n}\n' },
  ],
  cpp: [
    { name: '기본 입출력', code: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    \n    int n;\n    cin >> n;\n    \n    // 풀이\n    \n    cout << result << "\\n";\n    return 0;\n}\n' },
    { name: 'BFS 탐색', code: '#include <bits/stdc++.h>\nusing namespace std;\n\nvector<int> graph[100001];\nbool visited[100001];\n\nvoid bfs(int start) {\n    queue<int> q;\n    q.push(start);\n    visited[start] = true;\n    while (!q.empty()) {\n        int cur = q.front(); q.pop();\n        for (int nxt : graph[cur]) {\n          if (!visited[nxt]) {\n            visited[nxt] = true;\n            q.push(nxt);\n          }\n        }\n    }\n}\n' },
  ],
  java: [
    { name: '기본 입출력', code: 'import java.io.*;\nimport java.util.*;\n\npublic class Main {\n    public static void main(String[] args) throws IOException {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        int n = Integer.parseInt(br.readLine());\n        StringTokenizer st = new StringTokenizer(br.readLine());\n        \n        // 풀이\n        \n        System.out.println(result);\n    }\n}\n' },
  ],
  c: [
    { name: '기본 입출력', code: '#include <stdio.h>\n\nint main() {\n    int n;\n    scanf("%d", &n);\n    \n    // 풀이\n    \n    printf("%d\\n", result);\n    return 0;\n}\n' },
  ],
};
