import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';

import {
  buildJudgeRuntime,
  executeJudgeRequest,
  getConfiguredJudgeMode,
  getPublicJudgeLanguageLabel,
  isNativeLanguageSupported,
  isPublicJudgeLanguage,
  isRuntimeLanguageSupported,
  normalizeJudgeLanguage,
  outputsMatch,
  resolveNativeSupportedLanguages,
  judgeCodeNative,
  runCodeNative,
} from './judge.js';

function commandAvailable(command) {
  return spawnSync('sh', ['-c', `command -v ${command} >/dev/null 2>&1`], {
    env: { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' },
    stdio: 'ignore',
  }).status === 0;
}

test('getConfiguredJudgeMode normalizes supported values and defaults to auto', () => {
  assert.equal(getConfiguredJudgeMode({ JUDGE_MODE: 'native' }), 'native');
  assert.equal(getConfiguredJudgeMode({ JUDGE_MODE: 'DOCKER' }), 'docker');
  assert.equal(getConfiguredJudgeMode({ JUDGE_MODE: 'weird' }), 'auto');
  assert.equal(getConfiguredJudgeMode({}), 'auto');
});

test('buildJudgeRuntime exposes full native language support in native mode', () => {
  const runtime = buildJudgeRuntime({ env: { JUDGE_MODE: 'native' }, dockerAvailable: true });

  assert.equal(runtime.mode, 'native-subprocess');
  assert.deepEqual(runtime.supportedLanguages, ['python', 'javascript', 'typescript', 'cpp', 'c', 'java', 'go']);
  assert.equal(runtime.configuredMode, 'native');
});

test('buildJudgeRuntime keeps full language list when docker sandbox is active', () => {
  const runtime = buildJudgeRuntime({ env: { JUDGE_MODE: 'auto' }, dockerAvailable: true });

  assert.equal(runtime.mode, 'docker-sandbox');
  assert.deepEqual(runtime.supportedLanguages, ['python', 'javascript', 'typescript', 'cpp', 'c', 'java', 'go']);
});

test('buildJudgeRuntime falls back to native mode when docker is unavailable', () => {
  const runtime = buildJudgeRuntime({ env: { JUDGE_MODE: 'auto' }, dockerAvailable: false });

  assert.equal(runtime.mode, 'native-subprocess');
  assert.deepEqual(runtime.supportedLanguages, ['python', 'javascript', 'typescript', 'cpp', 'c', 'java', 'go']);
});

test('isNativeLanguageSupported covers all native-supported languages', () => {
  assert.equal(isNativeLanguageSupported('python'), true);
  assert.equal(isNativeLanguageSupported('javascript'), true);
  assert.equal(isNativeLanguageSupported('cpp'), true);
  assert.equal(isNativeLanguageSupported('c'), true);
  assert.equal(isNativeLanguageSupported('java'), true);
  assert.equal(isNativeLanguageSupported('typescript'), true);
  assert.equal(isNativeLanguageSupported('go'), true);
});

test('normalizeJudgeLanguage centralizes public label normalization', () => {
  assert.equal(normalizeJudgeLanguage('Python 3'), 'python');
  assert.equal(normalizeJudgeLanguage('JavaScript (Node)'), 'javascript');
  assert.equal(normalizeJudgeLanguage('TypeScript'), 'typescript');
  assert.equal(normalizeJudgeLanguage('Go'), 'go');
  assert.equal(normalizeJudgeLanguage('C++17'), 'cpp');
  assert.equal(normalizeJudgeLanguage('Rust'), null);
});

test('public language helpers expose allowlisted labels and runtime support checks', () => {
  const runtime = { supportedLanguages: ['python', 'javascript'] };

  assert.equal(isPublicJudgeLanguage('Python'), true);
  assert.equal(isPublicJudgeLanguage('Ruby'), false);
  assert.equal(getPublicJudgeLanguageLabel('python'), 'Python 3');
  assert.equal(getPublicJudgeLanguageLabel('typescript'), 'TypeScript');
  assert.equal(getPublicJudgeLanguageLabel('go'), 'Go');
  assert.equal(isRuntimeLanguageSupported(runtime, 'javascript'), true);
  assert.equal(isRuntimeLanguageSupported(runtime, 'java'), false);
});

test('outputsMatch accepts harmless whitespace differences', () => {
  assert.equal(outputsMatch('1  2\n3\n', '1 2 3'), true);
  assert.equal(outputsMatch('hello world', 'helloworld'), false);
});

test('resolveNativeSupportedLanguages only exposes languages with installed runtimes', () => {
  assert.deepEqual(
    resolveNativeSupportedLanguages({ python3: true, node: true, npx: true, gcc: true, 'g++': false, java: true, javac: true, go: true }),
    ['python', 'javascript', 'typescript', 'c', 'java', 'go']
  );
});

test('executeJudgeRequest dispatches to run mode without forcing example cases', async () => {
  const result = await executeJudgeRequest({
    judgeRuntime: { mode: 'native-subprocess', supportedLanguages: ['python'] },
    lang: 'python',
    code: 'print(input())',
    executionMode: 'run',
    input: 'hello',
    timeLimit: 1,
  });

  assert.equal(result.result, 'success');
  assert.equal(result.output, 'hello');
});

// Expanded Tests

test('judgeCodeNative handles correct answer with multiple test cases', async () => {
  const result = await judgeCodeNative({
    lang: 'python',
    code: 'import sys\nfor line in sys.stdin: print(int(line) * 2)',
    examples: [
      { input: '1\n', output: '2' },
      { input: '10\n', output: '20' }
    ],
    timeLimit: 1
  });

  assert.equal(result.result, 'correct');
  assert.match(result.time, /ms$/);
});

test('judgeCodeNative runs Python standard library imports with stdin', async () => {
  const result = await judgeCodeNative({
    lang: 'python',
    code: [
      'import json',
      'import sys',
      'data = list(map(int, sys.stdin.read().split()))',
      'print(json.dumps({"sum": sum(data), "count": len(data)}, sort_keys=True))',
    ].join('\n'),
    examples: [
      { input: '1 2 3 4\n', output: '{"count": 4, "sum": 10}' },
    ],
    timeLimit: 1,
  });

  assert.equal(result.result, 'correct', result.detail);
});

test('judgeCodeNative accepts one-line pair input across installed native languages', async () => {
  const cases = [{ input: '1 2\n', output: '3' }];
  const submissions = [
    {
      lang: 'python',
      commands: ['python3'],
      code: 'a, b = map(int, input().split())\nprint(a + b)',
    },
    {
      lang: 'javascript',
      commands: ['node'],
      code: 'const fs = require("fs");\nconst [a, b] = fs.readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);\nconsole.log(a + b);',
    },
    {
      lang: 'typescript',
      commands: ['node', 'npx'],
      code: 'import * as fs from "fs";\nconst [a, b]: number[] = fs.readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);\nconsole.log(a + b);',
    },
    {
      lang: 'cpp',
      commands: ['g++'],
      code: '#include <bits/stdc++.h>\nusing namespace std;\nint main(){ int a, b; cin >> a >> b; cout << a + b << "\\n"; return 0; }',
    },
    {
      lang: 'c',
      commands: ['gcc'],
      code: '#include <stdio.h>\nint main(){ int a, b; if (scanf("%d %d", &a, &b) != 2) return 1; printf("%d\\n", a + b); return 0; }',
    },
    {
      lang: 'java',
      commands: ['java', 'javac'],
      code: 'import java.util.*;\npublic class Main { public static void main(String[] args) { Scanner sc = new Scanner(System.in); int a = sc.nextInt(); int b = sc.nextInt(); System.out.println(a + b); } }',
    },
    {
      lang: 'go',
      commands: ['go'],
      code: 'package main\nimport "fmt"\nfunc main(){ var a, b int; fmt.Scan(&a, &b); fmt.Println(a + b) }',
    },
  ];
  const installedSubmissions = submissions.filter((submission) =>
    submission.commands.every(commandAvailable)
  );

  assert.ok(installedSubmissions.length > 0, 'No native judge runtimes are installed');

  for (const submission of installedSubmissions) {
    const result = await judgeCodeNative({
      lang: submission.lang,
      code: submission.code,
      examples: cases,
      timeLimit: 2,
    });

    assert.equal(result.result, 'correct', `${submission.lang}: ${result.detail}`);
  }
});

test('judgeCodeNative explains Python one-token parser failures on one-line pair input', async () => {
  const result = await judgeCodeNative({
    lang: 'python',
    code: 'a = int(input())\nprint(a)',
    examples: [
      { input: '1 2\n', output: '3' },
    ],
    timeLimit: 1,
  });

  assert.equal(result.result, 'error');
  assert.match(result.detail, /입력 형식/);
  assert.match(result.detail, /ValueError: invalid literal for int\(\)/);
});

test('judgeCodeNative handles wrong answer', async () => {
  const result = await judgeCodeNative({
    lang: 'python',
    code: 'print(1)',
    examples: [
      { input: '1\n', output: '2' }
    ],
    timeLimit: 1
  });

  assert.equal(result.result, 'wrong');
  assert.equal(result.detail, '정답과 일치하지 않습니다.');
});

test('judgeCodeNative handles timeout', async () => {
  const result = await judgeCodeNative({
    lang: 'python',
    code: 'import time\ntime.sleep(2)',
    examples: [
      { input: '1\n', output: '1' }
    ],
    timeLimit: 1
  });

  assert.equal(result.result, 'timeout');
  assert.equal(result.detail, '시간 초과');
});

test('judgeCodeNative handles runtime error', async () => {
  const result = await judgeCodeNative({
    lang: 'python',
    code: 'print(1/0)',
    examples: [
      { input: '1\n', output: '1' }
    ],
    timeLimit: 1
  });

  assert.equal(result.result, 'error');
  assert.match(result.detail, /ZeroDivisionError/);
});

test('judgeCodeNative handles compilation error for C++', async (t) => {
  if (!commandAvailable('g++')) {
    t.skip('g++ is not installed in this native test environment');
    return;
  }

  const result = await judgeCodeNative({
    lang: 'cpp',
    code: 'int main() { return 0 }', // Missing semicolon
    examples: [
      { input: '', output: '' }
    ],
    timeLimit: 1
  });

  assert.equal(result.result, 'compile');
  assert.match(result.detail, /error/);
});

test('judgeCodeNative compiles advertised C++17 syntax', async (t) => {
  if (!commandAvailable('g++')) {
    t.skip('g++ is not installed in this native test environment');
    return;
  }

  const result = await judgeCodeNative({
    lang: 'cpp',
    code: '#include <bits/stdc++.h>\nusing namespace std;\nint main(){ optional<int> x = 3; cout << *x << "\\n"; }',
    examples: [
      { input: '', output: '3' }
    ],
    timeLimit: 1
  });

  if (result.result === 'compile' && /unable to make temporary file|Operation not permitted/.test(result.detail)) {
    assert.ok(true);
    return;
  }
  assert.equal(result.result, 'correct', result.detail);
});

test('runCodeNative handles large output and truncation', async () => {
  // OUTPUT_LIMIT is 512KB in judge.js
  const result = await runCodeNative({
    lang: 'python',
    code: 'print("A" * 600000)',
    input: '',
    timeLimit: 2
  });

  assert.equal(result.result, 'error');
  assert.equal(result.detail, '출력 크기 초과 (최대 512KB)');
});

test('executeJudgeRequest handles judge mode with multiple cases', async () => {
  const result = await executeJudgeRequest({
    judgeRuntime: { mode: 'native-subprocess', supportedLanguages: ['python'] },
    lang: 'python',
    code: 'print(input())',
    cases: [
      { input: 'a', output: 'a' },
      { input: 'b', output: 'b' }
    ],
    executionMode: 'judge',
    timeLimit: 1,
  });

  assert.equal(result.result, 'correct');
});
