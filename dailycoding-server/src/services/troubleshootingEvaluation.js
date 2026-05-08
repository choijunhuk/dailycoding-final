import { spawn } from 'child_process';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, join, resolve, sep } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { outputsMatch } from './judge.js';

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_OUTPUT_BYTES = 512 * 1024;
const MAX_FILE_BYTES = 200 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024;
const ALLOWED_COMMANDS = new Set(['node', 'python3', 'python']);

export function isSafeRelativePath(filePath) {
  const value = String(filePath || '').trim();
  if (!value || value.length > 180) return false;
  if (value.startsWith('/') || value.startsWith('\\')) return false;
  const parts = value.split(/[\\/]+/);
  return parts.every((part) => part && part !== '.' && part !== '..');
}

function normalizeSubmittedFiles(value) {
  const raw = Array.isArray(value?.files) ? value.files : Array.isArray(value) ? value : [];
  return raw.map((file) => ({
    path: String(file?.path || '').trim(),
    content: String(file?.content ?? ''),
  })).filter((file) => file.path);
}

function buildFileMap(initialFiles, submittedFiles, allowedFiles = []) {
  const initialByPath = new Map((initialFiles || []).map((file) => [file.path, file]));
  const submittedByPath = new Map(normalizeSubmittedFiles(submittedFiles).map((file) => [file.path, file]));
  const allowedSet = new Set((allowedFiles || []).filter(Boolean));
  const merged = [];
  const violations = [];
  let totalBytes = 0;
  let changedFilesCount = 0;

  for (const file of initialFiles || []) {
    const submitted = submittedByPath.get(file.path);
    const content = submitted ? submitted.content : String(file.content ?? '');
    if (!isSafeRelativePath(file.path)) violations.push(`허용되지 않는 파일 경로입니다: ${file.path}`);
    if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) violations.push(`${file.path} 파일이 너무 큽니다.`);
    totalBytes += Buffer.byteLength(content, 'utf8');
    if (submitted && content !== String(file.content ?? '')) {
      changedFilesCount += 1;
      if (file.editable === false) violations.push(`수정할 수 없는 파일을 변경했습니다: ${file.path}`);
      if (allowedSet.size > 0 && !allowedSet.has(file.path)) violations.push(`수정 허용 목록에 없는 파일을 변경했습니다: ${file.path}`);
    }
    merged.push({ path: file.path, content, editable: file.editable !== false });
  }

  for (const file of submittedByPath.values()) {
    if (!initialByPath.has(file.path)) {
      violations.push(`초기 코드베이스에 없는 파일은 제출할 수 없습니다: ${file.path}`);
    }
  }

  if (totalBytes > MAX_TOTAL_BYTES) violations.push('제출 파일 전체 크기가 너무 큽니다.');
  return { files: merged, violations, changedFilesCount };
}

function parseCommand(command) {
  if (Array.isArray(command)) return command.map((part) => String(part)).filter(Boolean);
  return String(command || '').trim().split(/\s+/).filter(Boolean);
}

function commandIsAllowed(parts) {
  if (parts.length === 0) return false;
  return ALLOWED_COMMANDS.has(parts[0]);
}

function runCommand({ cwd, command, input = '', timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const parts = parseCommand(command);
  if (!commandIsAllowed(parts)) {
    return Promise.resolve({
      stdout: '',
      stderr: `허용되지 않는 테스트 명령입니다: ${parts[0] || '(empty)'}`,
      exitCode: -1,
      timedOut: false,
      elapsedMs: 0,
    });
  }

  return new Promise((resolveResult) => {
    const started = Date.now();
    const proc = spawn(parts[0], parts.slice(1), {
      cwd,
      env: { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let outputExceeded = false;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGKILL');
    }, Math.min(Math.max(Number(timeoutMs) || DEFAULT_TIMEOUT_MS, 500), 30000));

    proc.stdout.on('data', (chunk) => {
      if (outputExceeded) return;
      stdout += chunk.toString();
      if (Buffer.byteLength(stdout, 'utf8') > MAX_OUTPUT_BYTES) {
        outputExceeded = true;
        proc.kill('SIGKILL');
      }
    });
    proc.stderr.on('data', (chunk) => {
      if (Buffer.byteLength(stderr, 'utf8') < MAX_OUTPUT_BYTES) stderr += chunk.toString();
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      resolveResult({
        stdout: '',
        stderr: err.message,
        exitCode: -1,
        timedOut: false,
        elapsedMs: Date.now() - started,
      });
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolveResult({
        stdout: stdout.trim(),
        stderr: outputExceeded ? '출력 크기 초과' : stderr.trim(),
        exitCode: code ?? 0,
        timedOut,
        elapsedMs: Date.now() - started,
      });
    });
    proc.stdin.write(input || '');
    proc.stdin.end();
  });
}

function writeWorkspaceFiles(workDir, files) {
  const root = resolve(workDir);
  for (const file of files) {
    if (!isSafeRelativePath(file.path)) continue;
    const absolutePath = resolve(root, file.path);
    if (!absolutePath.startsWith(root + sep) && absolutePath !== root) {
      throw new Error(`허용되지 않는 파일 경로입니다: ${file.path}`);
    }
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, file.content, 'utf8');
  }
}

function checkForbiddenPatterns(files, patterns) {
  const violations = [];
  for (const pattern of patterns || []) {
    if (!pattern) continue;
    let re = null;
    try {
      re = new RegExp(pattern);
    } catch {
      re = null;
    }
    for (const file of files) {
      const hit = re ? re.test(file.content) : file.content.includes(pattern);
      if (hit) violations.push(`${file.path}: 금지 패턴 "${pattern}" 사용`);
    }
  }
  return violations;
}

function scorePerformance({ executionTimeMs, baselineTimeMs, targetResponseTimeMs, performanceLimitMs, testsPassed }) {
  if (!testsPassed) return { performanceScore: 0, improvementRate: 0 };
  const baseline = Number(baselineTimeMs) || null;
  const target = Number(targetResponseTimeMs) || null;
  const limit = Number(performanceLimitMs) || null;
  let improvementRate = 0;
  if (baseline && executionTimeMs != null) {
    improvementRate = Math.max(0, (baseline - executionTimeMs) / baseline);
  }

  if (!target && !limit && !baseline) return { performanceScore: 30, improvementRate };
  if (target && executionTimeMs <= target) return { performanceScore: 30, improvementRate };
  if (limit && executionTimeMs <= limit) return { performanceScore: Math.max(20, Math.round(30 * Math.max(improvementRate, 0.66))), improvementRate };
  if (baseline) return { performanceScore: Math.min(30, Math.round(improvementRate * 30)), improvementRate };
  return { performanceScore: 0, improvementRate };
}

function scoreReadability({ changedFilesCount, forbiddenViolations }) {
  const filePenalty = Math.max(0, changedFilesCount - 1) * 4;
  const forbiddenPenalty = forbiddenViolations.length * 10;
  return Math.max(0, 20 - filePenalty - forbiddenPenalty);
}

function buildFeedback({ allPassed, forbiddenViolations, fileViolations, testResults, executionTimeMs, targetResponseTimeMs }) {
  const feedback = [];
  if (fileViolations.length > 0) feedback.push(...fileViolations);
  if (forbiddenViolations.length > 0) feedback.push(...forbiddenViolations);
  if (allPassed) feedback.push('모든 테스트를 통과했습니다.');
  else {
    const failed = testResults.filter((test) => !test.passed).slice(0, 3);
    for (const test of failed) feedback.push(`${test.name}: ${test.detail}`);
  }
  if (targetResponseTimeMs && executionTimeMs != null) {
    feedback.push(`실행 시간 ${executionTimeMs}ms / 목표 ${targetResponseTimeMs}ms`);
  }
  return feedback.join('\n');
}

export async function evaluateTroubleshootingSubmission({
  config,
  submittedFiles,
  includeHidden = false,
}) {
  const merged = buildFileMap(config.initialFiles || [], submittedFiles, config.allowedFiles || []);
  const forbiddenViolations = checkForbiddenPatterns(merged.files, config.forbiddenPatterns || []);
  const tests = [
    ...(config.visibleTests || []).map((test) => ({ ...test, visibility: 'visible' })),
    ...(includeHidden ? (config.hiddenTests || []).map((test) => ({ ...test, visibility: 'hidden' })) : []),
  ];
  const testResults = [];
  let executionTimeMs = 0;
  let fatalResult = null;

  if (merged.violations.length === 0 && forbiddenViolations.length === 0 && tests.length > 0) {
    const workDir = join(tmpdir(), `troubleshooting_${randomUUID()}`);
    mkdirSync(workDir, { recursive: true });
    try {
      writeWorkspaceFiles(workDir, merged.files);
      for (const test of tests) {
        const run = await runCommand({
          cwd: workDir,
          command: test.command,
          input: test.input || '',
          timeoutMs: test.timeoutMs || config.performanceLimitMs || DEFAULT_TIMEOUT_MS,
        });
        executionTimeMs = Math.max(executionTimeMs, run.elapsedMs);
        const outputOk = test.expectedOutput == null || outputsMatch(run.stdout, test.expectedOutput);
        const passed = !run.timedOut && run.exitCode === 0 && outputOk;
        const detail = run.timedOut
          ? '시간 초과'
          : run.exitCode !== 0
            ? (run.stderr || '런타임 오류')
            : outputOk
              ? '통과'
              : `출력 불일치: ${run.stdout}`;
        if (run.timedOut) fatalResult = 'timeout';
        else if (run.exitCode !== 0 && !fatalResult) fatalResult = 'error';
        testResults.push({
          name: test.name,
          visibility: test.visibility,
          passed,
          executionTimeMs: run.elapsedMs,
          output: test.visibility === 'visible' ? run.stdout : '',
          detail,
        });
      }
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  }

  if (tests.length === 0) {
    testResults.push({
      name: 'static-validation',
      visibility: 'visible',
      passed: merged.violations.length === 0 && forbiddenViolations.length === 0,
      executionTimeMs: 0,
      output: '',
      detail: '테스트 명령 없이 정적 제약만 검사했습니다.',
    });
  }

  const testPassCount = testResults.filter((test) => test.passed).length;
  const totalTestCount = testResults.length;
  const allPassed = totalTestCount > 0 && testPassCount === totalTestCount;
  const correctnessScore = totalTestCount > 0 ? Math.round((testPassCount / totalTestCount) * 50) : 0;
  const { performanceScore, improvementRate } = scorePerformance({
    executionTimeMs,
    baselineTimeMs: config.baselineTimeMs,
    targetResponseTimeMs: config.targetResponseTimeMs,
    performanceLimitMs: config.performanceLimitMs,
    testsPassed: allPassed,
  });
  const readabilityScore = scoreReadability({
    changedFilesCount: merged.changedFilesCount,
    forbiddenViolations,
  });
  const totalScore = Math.max(0, Math.min(100, correctnessScore + performanceScore + readabilityScore));
  const result = merged.violations.length > 0 || forbiddenViolations.length > 0
    ? 'wrong'
    : allPassed && totalScore >= 80
      ? 'correct'
      : fatalResult || 'wrong';

  return {
    result,
    totalScore,
    correctnessScore,
    performanceScore,
    readabilityScore,
    testPassCount,
    totalTestCount,
    executionTimeMs,
    memoryUsedMb: null,
    changedFilesCount: merged.changedFilesCount,
    improvementRate,
    feedback: buildFeedback({
      allPassed,
      forbiddenViolations,
      fileViolations: merged.violations,
      testResults,
      executionTimeMs,
      targetResponseTimeMs: config.targetResponseTimeMs,
    }),
    tests: testResults,
  };
}
