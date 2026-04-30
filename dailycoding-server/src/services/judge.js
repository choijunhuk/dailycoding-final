/**
 * Docker Sandbox Judge
 * 실제 코드를 Docker 컨테이너 안에서 실행해서 채점합니다.
 *
 * 필요 조건:
 *   - Docker Engine 설치 (docker --version 으로 확인)
 *   - npm install dockerode
 *
 * 사용 이미지 (처음 실행 시 자동 pull):
 *   - python:3.12-alpine  (Python)
 *   - node:20-alpine       (JavaScript)
 *   - gcc:13-alpine        (C / C++)
 *   - openjdk:21-alpine    (Java)
 */

import Docker from 'dockerode';
import { spawn } from 'child_process';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

// Windows: named pipe, Linux/Mac: unix socket
const isWindows = process.platform === 'win32';
const docker = new Docker(
  isWindows
    ? { socketPath: '//./pipe/docker_engine' }
    : { socketPath: '/var/run/docker.sock' }
);

export const ALL_LANGS = Object.freeze(['python', 'javascript', 'cpp', 'c', 'java']);
const NATIVE_SUPPORTED_LANGS = Object.freeze(['python', 'javascript', 'cpp', 'c', 'java']);
const NATIVE_RUNTIME_COMMANDS = Object.freeze({
  python: ['python3'],
  javascript: ['node'],
  cpp: ['g++'],
  c: ['gcc'],
  java: ['java', 'javac'],
});
const PUBLIC_LANGUAGE_ALIASES = Object.freeze({
  'Python 3': 'python',
  Python: 'python',
  python: 'python',
  JavaScript: 'javascript',
  'JavaScript (Node)': 'javascript',
  javascript: 'javascript',
  'C++17': 'cpp',
  'C++': 'cpp',
  cpp: 'cpp',
  'Java 11': 'java',
  Java: 'java',
  java: 'java',
  C99: 'c',
  C: 'c',
  c: 'c',
});
const CANONICAL_PUBLIC_LANGUAGE_LABELS = Object.freeze({
  python: 'Python 3',
  javascript: 'JavaScript',
  cpp: 'C++17',
  java: 'Java 11',
  c: 'C99',
});

export function getConfiguredJudgeMode(env = process.env) {
  const raw = String(env.JUDGE_MODE || 'auto').trim().toLowerCase();
  return ['auto', 'native', 'docker'].includes(raw) ? raw : 'auto';
}

export function isNativeLanguageSupported(lang) {
  return NATIVE_SUPPORTED_LANGS.includes(lang);
}

export function normalizeJudgeLanguage(lang) {
  if (lang == null) return null;
  return PUBLIC_LANGUAGE_ALIASES[String(lang).trim()] || null;
}

export function isPublicJudgeLanguage(lang) {
  return normalizeJudgeLanguage(lang) !== null;
}

export function getPublicJudgeLanguageLabel(lang) {
  return CANONICAL_PUBLIC_LANGUAGE_LABELS[lang] || null;
}

export function isRuntimeLanguageSupported(runtime, lang) {
  return Boolean(runtime?.supportedLanguages?.includes(lang));
}

export function buildJudgeRuntime({ env = process.env, dockerAvailable }) {
  const configuredMode = getConfiguredJudgeMode(env);
  const mode = configuredMode === 'native'
    ? 'native-subprocess'
    : configuredMode === 'docker'
      ? 'docker-sandbox'
      : dockerAvailable
        ? 'docker-sandbox'
        : 'native-subprocess';

  return {
    configuredMode,
    dockerAvailable: Boolean(dockerAvailable),
    mode,
    supportedLanguages: mode === 'native-subprocess'
      ? [...NATIVE_SUPPORTED_LANGS]
      : [...ALL_LANGS],
  };
}

export function resolveNativeSupportedLanguages(commandAvailability = {}) {
  return NATIVE_SUPPORTED_LANGS.filter((lang) =>
    (NATIVE_RUNTIME_COMMANDS[lang] || []).every((command) => Boolean(commandAvailability[command]))
  );
}

let nativeRuntimeDiagnostics = null;
let nativeRuntimeDiagnosticsAt = 0;
const NATIVE_DIAGNOSTIC_CACHE_MS = 60_000;

function detectCommandAvailability(command) {
  return new Promise((resolve) => {
    const proc = spawn('sh', ['-c', `command -v ${command} >/dev/null 2>&1`], {
      env: { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' },
      stdio: 'ignore',
    });
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

async function getNativeRuntimeDiagnostics() {
  if (nativeRuntimeDiagnostics && (Date.now() - nativeRuntimeDiagnosticsAt) < NATIVE_DIAGNOSTIC_CACHE_MS) {
    return nativeRuntimeDiagnostics;
  }

  const commands = [...new Set(Object.values(NATIVE_RUNTIME_COMMANDS).flat())];
  const availabilityEntries = await Promise.all(
    commands.map(async (command) => [command, await detectCommandAvailability(command)])
  );
  const commandAvailability = Object.fromEntries(availabilityEntries);
  const supportedLanguages = resolveNativeSupportedLanguages(commandAvailability);

  nativeRuntimeDiagnostics = {
    commandAvailability,
    supportedLanguages,
    healthy: supportedLanguages.length > 0,
  };
  nativeRuntimeDiagnosticsAt = Date.now();
  return nativeRuntimeDiagnostics;
}

export async function getJudgeRuntime(env = process.env) {
  const configuredMode = getConfiguredJudgeMode(env);
  const dockerAvailable = configuredMode === 'native'
    ? false
    : await isDockerAvailable();
  const runtime = buildJudgeRuntime({ env, dockerAvailable });

  if (runtime.mode !== 'native-subprocess') {
    return runtime;
  }

  const nativeDiagnostics = await getNativeRuntimeDiagnostics();
  return {
    ...runtime,
    mode: nativeDiagnostics.healthy ? runtime.mode : 'unavailable',
    supportedLanguages: nativeDiagnostics.supportedLanguages,
    nativeHealthy: nativeDiagnostics.healthy,
    nativeCommandAvailability: nativeDiagnostics.commandAvailability,
    unavailableReason: nativeDiagnostics.healthy ? null : 'native-runtime-missing',
  };
}

// ── 언어별 설정 ────────────────────────────────────────────────────────────────
const LANG_CONFIG = {
  python: {
    image:   'python:3.12-alpine',
    file:    'main.py',
    cmd:     ['python', 'main.py'],
    compile: null,
  },
  javascript: {
    image:   'node:20-alpine',
    file:    'main.js',
    cmd:     ['node', 'main.js'],
    compile: null,
  },
  cpp: {
    image:   'gcc:13',
    file:    'main.cpp',
    cmd:     ['./main'],
    compile: ['g++', '-std=c++17', '-O2', '-o', 'main', 'main.cpp'],
  },
  c: {
    image:   'gcc:13',
    file:    'main.c',
    cmd:     ['./main'],
    compile: ['gcc', '-std=c99', '-O2', '-o', 'main', 'main.c'],
  },
  java: {
    image:   'openjdk:21-slim',
    file:    'Main.java',
    cmd:     ['java', 'Main'],
    compile: ['javac', 'Main.java'],
  },
};

const OUTPUT_LIMIT = 512 * 1024; // 512KB — 출력 폭탄 방지 (Docker/native 공통)

function normalizeOutputText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

export function outputsMatch(actual, expected) {
  const normalizedActual = normalizeOutputText(actual);
  const normalizedExpected = normalizeOutputText(expected);
  if (normalizedActual === normalizedExpected) return true;

  const actualTokens = normalizedActual.length > 0 ? normalizedActual.split(/\s+/) : [];
  const expectedTokens = normalizedExpected.length > 0 ? normalizedExpected.split(/\s+/) : [];
  if (actualTokens.length !== expectedTokens.length) return false;
  return actualTokens.every((token, index) => token === expectedTokens[index]);
}

// ── 채점 동시 실행 제한 ──────────────────────────────────────────────────────
const MAX_CONCURRENT_JUDGES = 4;
let activeJudges = 0;
const judgeQueue = [];

function acquireJudgeSlot(timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    if (activeJudges < MAX_CONCURRENT_JUDGES) { activeJudges++; resolve(); return; }
    const entry = {};
    const timer = setTimeout(() => {
      const idx = judgeQueue.indexOf(entry);
      if (idx !== -1) judgeQueue.splice(idx, 1);
      reject(new Error('JUDGE_QUEUE_TIMEOUT'));
    }, timeoutMs);
    entry.resolve = resolve;
    entry.timer = timer;
    judgeQueue.push(entry);
  });
}

function releaseJudgeSlot() {
  if (judgeQueue.length > 0) {
    const next = judgeQueue.shift();
    clearTimeout(next.timer);
    next.resolve(); // activeJudges count stays the same — slot transferred
  } else {
    activeJudges--;
  }
}

// ── 이미지 pull (없으면 자동) ─────────────────────────────────────────────────
const pulledImages = new Set();

async function ensureImage(image) {
  if (pulledImages.has(image)) return;
  try {
    await docker.getImage(image).inspect();
    pulledImages.add(image);
  } catch {
    console.log(`[Judge] Pulling image: ${image} ...`);
    await new Promise((resolve, reject) => {
      docker.pull(image, (err, stream) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, (err) => err ? reject(err) : resolve());
      });
    });
    pulledImages.add(image);
    console.log(`[Judge] Image ready: ${image}`);
  }
}

// ── 컨테이너 실행 헬퍼 ────────────────────────────────────────────────────────
async function runInContainer({ image, cmd, binds, stdin, timeoutMs, memoryLimit = 128 * 1024 * 1024 }) {
  let container;
  try {
    container = await docker.createContainer({
      Image:       image,
      Cmd:         cmd,
      WorkingDir:  '/code',
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      OpenStdin:   true,
      StdinOnce:   true,
      NetworkDisabled: true,
      HostConfig: {
        Binds:       binds,
        Memory:      memoryLimit,
        MemorySwap:  memoryLimit,
        CpuPeriod:   100000,
        CpuQuota:    50000,
        PidsLimit:   64,
        ReadonlyRootfs: true,        // 루트 파일시스템 쓰기 금지
        Tmpfs: { '/tmp': 'rw,noexec,nosuid,size=32m' }, // 임시 파일용 tmpfs만 허용
        CapDrop: ['ALL'],             // 모든 커널 권한 제거
        SecurityOpt: ['no-new-privileges:true'],
        NetworkMode: 'none',          // 네트워크 완전 격리 (중복 보장)
        OomKillDisable: false,        // OOM 발생 시 즉시 종료 허용
        AutoRemove:  true,
      },
    });
  } catch (err) {
    console.error('[Judge] Container creation failed:', err.message);
    return { stdout: '', stderr: '샌드박스 초기화 실패', exitCode: -1, timedOut: false };
  }

  let stdout = '';
  let stderr = '';

  try {
    const stream = await container.attach({ stream: true, stdin: true, stdout: true, stderr: true });
    const streamClosed = new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      stream.on('end', done);
      stream.on('close', done);
      stream.on('error', done);
    });

    container.modem.demuxStream(stream, {
      write: (chunk) => { stdout += chunk.toString(); },
    }, {
      write: (chunk) => { stderr += chunk.toString(); },
    });

    await container.start();

    stream.write(stdin || '');
    stream.end();

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
    );
    const waitPromise = container.wait();

    let exitCode = 0;
    try {
      const result = await Promise.race([waitPromise, timeoutPromise]);
      exitCode = result?.StatusCode ?? 0;
    } catch (e) {
      if (e.message === 'TIMEOUT') {
        try { await container.kill(); } catch {}
        return { stdout: '', stderr: '', exitCode: -1, timedOut: true };
      }
      throw e;
    }

    // Docker's wait can resolve before the attached stdout/stderr stream has
    // delivered its final chunk, which makes fast correct programs look wrong.
    await Promise.race([
      streamClosed,
      new Promise((resolve) => setTimeout(resolve, 250)),
    ]);

    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode, timedOut: false };
  } catch (err) {
    console.error('[Judge] Container execution failed:', err.message);
    return { stdout: stdout.trim(), stderr: stderr.trim() || '샌드박스 실행 오류', exitCode: -1, timedOut: false };
  }
}

// ── 메인 채점 함수 ────────────────────────────────────────────────────────────
/**
 * @param {object} opts
 * @param {string} opts.lang       - 'python' | 'javascript' | 'cpp' | 'c' | 'java'
 * @param {string} opts.code       - 제출 코드
 * @param {Array}  opts.examples   - [{ input, output }, ...]
 * @param {number} opts.timeLimit  - 초 단위 (기본 2)
 * @returns {Promise<{ result, time, mem, detail }>}
 */
export async function judgeCode({ lang, code, examples, timeLimit = 2, userTier = 'free' }) {
  const cfg = LANG_CONFIG[lang];
  if (!cfg) return { result: 'error', time: '-', mem: '-', detail: `지원하지 않는 언어: ${lang}` };

  const isPremium = userTier === 'pro' || userTier === 'team';
  const memLimit = (isPremium ? 512 : 128) * 1024 * 1024;
  const maxTime = isPremium ? 15 : 5;
  const effectiveTimeLimit = Math.min(timeLimit, maxTime);

  // 작업 디렉토리 생성
  const workDir = join(tmpdir(), `judge_${randomUUID()}`);
  mkdirSync(workDir, { recursive: true });
  // 컴파일 단계는 rw(쓰기 필요), 실행 단계는 ro(보안)
  const rwBinds = [`${workDir}:/code`];
  const roBinds = [`${workDir}:/code:ro`];

  try {
    await ensureImage(cfg.image);

    // 코드 파일 작성
    writeFileSync(join(workDir, cfg.file), code, 'utf-8');

    // ── 컴파일 단계 (C/C++/Java) ─────────────────────────────────
    if (cfg.compile) {
      const compileResult = await runInContainer({
        image:     cfg.image,
        cmd:       cfg.compile,
        binds:     rwBinds,           // 컴파일 결과물 쓰기 필요
        stdin:     '',
        timeoutMs: 10000,
        memoryLimit: memLimit,
      });
      if (compileResult.exitCode !== 0) {
        return {
          result: 'compile',
          time: '-', mem: '-',
          detail: compileResult.stderr || '컴파일 오류',
        };
      }
    }

    // ── 테스트케이스 실행 ────────────────────────────────────────
    let totalMs = 0;
    for (const ex of examples) {
      const start = Date.now();
      const run   = await runInContainer({
        image:     cfg.image,
        cmd:       cfg.cmd,
        binds:     roBinds,           // 실행 단계는 읽기 전용 마운트
        stdin:     ex.input,
        timeoutMs: effectiveTimeLimit * 1000 + 500,
        memoryLimit: memLimit,
      });
      const elapsed = Date.now() - start;
      totalMs = Math.max(totalMs, elapsed);

      if (run.timedOut) {
        return { result: 'timeout', time: '-', mem: '-', detail: '시간 초과' };
      }
      if (run.exitCode !== 0) {
        return { result: 'error', time: `${elapsed}ms`, mem: '-', detail: run.stderr || '런타임 오류' };
      }

      // 정답 비교 (줄바꿈·공백 trim)
      if (!outputsMatch(run.stdout, ex.output)) {
        return {
          result: 'wrong',
          time: `${elapsed}ms`, mem: '-',
          detail: '정답과 일치하지 않습니다.',
        };
      }
    }

    return {
      result: 'correct',
      time:   `${totalMs}ms`,
      mem:    '-',   // 메모리 측정은 docker stats API 별도 필요
      detail: '모든 테스트케이스 통과',
    };

  } finally {
    // 작업 디렉토리 정리
    try { rmSync(workDir, { recursive: true, force: true }); } catch {}
  }
}

export async function runCode({ lang, code, input = '', timeLimit = 2, userTier = 'free' }) {
  const cfg = LANG_CONFIG[lang];
  if (!cfg) return { result: 'error', time: '-', mem: '-', detail: `지원하지 않는 언어: ${lang}`, output: '' };

  const isPremium = userTier === 'pro' || userTier === 'team';
  const memLimit = (isPremium ? 512 : 128) * 1024 * 1024;
  const maxTime = isPremium ? 15 : 5;
  const effectiveTimeLimit = Math.min(timeLimit, maxTime);

  const workDir = join(tmpdir(), `judge_${randomUUID()}`);
  mkdirSync(workDir, { recursive: true });
  const rwBinds = [`${workDir}:/code`];
  const roBinds = [`${workDir}:/code:ro`];

  try {
    await ensureImage(cfg.image);
    writeFileSync(join(workDir, cfg.file), code, 'utf-8');

    if (cfg.compile) {
      const compileResult = await runInContainer({
        image: cfg.image,
        cmd: cfg.compile,
        binds: rwBinds,
        stdin: '',
        timeoutMs: 10000,
        memoryLimit: memLimit,
      });
      if (compileResult.exitCode !== 0) {
        return {
          result: 'compile',
          time: '-',
          mem: '-',
          detail: compileResult.stderr || '컴파일 오류',
          output: '',
        };
      }
    }

    const start = Date.now();
    const run = await runInContainer({
      image: cfg.image,
      cmd: cfg.cmd,
      binds: roBinds,
      stdin: input,
      timeoutMs: effectiveTimeLimit * 1000 + 500,
      memoryLimit: memLimit,
    });
    const elapsed = Date.now() - start;

    if (run.timedOut) {
      return { result: 'timeout', time: '-', mem: '-', detail: '시간 초과', output: '' };
    }
    if (run.exitCode !== 0) {
      return {
        result: 'error',
        time: `${elapsed}ms`,
        mem: '-',
        detail: run.stderr || '런타임 오류',
        output: run.stdout.trim(),
      };
    }

    return {
      result: 'success',
      time: `${elapsed}ms`,
      mem: '-',
      detail: '실행 완료',
      output: run.stdout.trim(),
    };
  } finally {
    try { rmSync(workDir, { recursive: true, force: true }); } catch {}
  }
}

// ── Docker 사용 가능 여부 체크 ─────────────────────────────────────────────
export async function isDockerAvailable() {
  try {
    await docker.ping();
    return true;
  } catch {
    return false;
  }
}

// ── Native Subprocess Judge ────────────────────────────────────────────────
// Docker 없이 Railway 컨테이너 안에서 직접 실행 (child_process + ulimit 샌드박싱)
// Dockerfile에서 python3, gcc, g++, openjdk21 설치 필요

// vmKb: OS-level virtual memory cap (ulimit -v, in KB)
// Java JVM needs 512MB+ for bootstrap; Node needs 256MB; C/C++/Python are fine at 128MB
const NATIVE_LANG = {
  python:     { file: 'main.py',   vmKb: 131072,  run: (d) => `python3 "${d}/main.py"`,                        compile: null },
  javascript: { file: 'main.js',   vmKb: 262144,  run: (d) => `node --max-old-space-size=64 "${d}/main.js"`,   compile: null },
  cpp:        { file: 'main.cpp',  vmKb: 131072,  run: (d) => `"${d}/main"`,                                   compile: (d) => `g++ -std=c++17 -O2 -o "${d}/main" "${d}/main.cpp"` },
  c:          { file: 'main.c',    vmKb: 131072,  run: (d) => `"${d}/main"`,                                   compile: (d) => `gcc -std=c99 -O2 -o "${d}/main" "${d}/main.c"` },
  java:       { file: 'Main.java', vmKb: 524288,  run: (d) => `java -Xmx64m -Xms16m -cp "${d}" Main`,         compile: (d) => `javac "${d}/Main.java"` },
};

function execShell(cmd, stdin, timeoutMs, vmKb = 131072) {
  return new Promise((resolve) => {
    // ulimit: virtual memory (per-lang), CPU 10s hard, max 64 processes
    const safe = `ulimit -v ${vmKb} -t 10 -u 64 2>/dev/null; ${cmd}`;
    const proc = spawn('sh', ['-c', safe], {
      env:   { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '', stderr = '', killed = false, outputExceeded = false;
    const timer = setTimeout(() => { killed = true; proc.kill('SIGKILL'); }, timeoutMs);

    proc.stdout.on('data', (d) => {
      if (outputExceeded) return;
      stdout += d;
      if (stdout.length > OUTPUT_LIMIT) {
        outputExceeded = true;
        stdout = stdout.slice(0, OUTPUT_LIMIT);
        proc.kill('SIGKILL');
      }
    });
    proc.stderr.on('data', (d) => {
      if (stderr.length < OUTPUT_LIMIT) stderr += d;
    });
    proc.stdin.write(stdin || '');
    proc.stdin.end();

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (outputExceeded) {
        resolve({ stdout: '', stderr: '출력 크기 초과 (최대 512KB)', exitCode: -1, timedOut: false, outputExceeded: true });
      } else {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code ?? 0, timedOut: killed });
      }
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ stdout: '', stderr: err.message, exitCode: -1, timedOut: false });
    });
  });
}

/**
 * 네이티브 subprocess 채점 (Docker/외부API 없이 동작)
 */
export async function judgeCodeNative({ lang, code, examples, timeLimit = 2, userTier = 'free' }) {
  const cfg = NATIVE_LANG[lang];
  if (!cfg) return { result: 'error', time: '-', mem: '-', detail: `지원하지 않는 언어: ${lang}` };

  const isPremium = userTier === 'pro' || userTier === 'team';
  const vmMultiplier = isPremium ? 2 : 1;
  const maxTime = isPremium ? 15 : 5;
  const effectiveTimeLimit = Math.min(timeLimit, maxTime);
  const effectiveVmKb = cfg.vmKb * vmMultiplier;

  const workDir = join(tmpdir(), `judge_${randomUUID()}`);
  mkdirSync(workDir, { recursive: true });

  try {
    writeFileSync(join(workDir, cfg.file), code, 'utf-8');

    // 컴파일 단계 (C/C++/Java) — 컴파일은 높은 vmKb로 (javac 자체가 JVM)
    if (cfg.compile) {
      const compVmKb = Math.max(effectiveVmKb, 524288); // javac는 최소 512MB 권장
      const comp = await execShell(cfg.compile(workDir), '', 15000, compVmKb);
      if (comp.exitCode !== 0) {
        return { result: 'compile', time: '-', mem: '-', detail: comp.stderr || '컴파일 오류' };
      }
    }

    let totalMs = 0;
    for (const ex of examples) {
      const start = Date.now();
      const run   = await execShell(cfg.run(workDir), ex.input, effectiveTimeLimit * 1000 + 500, effectiveVmKb);
      const elapsed = Date.now() - start;
      totalMs = Math.max(totalMs, elapsed);

      if (run.timedOut)        return { result: 'timeout', time: '-',            mem: '-', detail: '시간 초과' };
      if (run.outputExceeded)  return { result: 'error',   time: `${elapsed}ms`, mem: '-', detail: '출력 크기 초과 (최대 512KB)' };
      if (run.exitCode !== 0)  return { result: 'error',   time: `${elapsed}ms`, mem: '-', detail: run.stderr || '런타임 오류' };

      if (!outputsMatch(run.stdout, ex.output)) {
        return { result: 'wrong', time: `${elapsed}ms`, mem: '-', detail: '정답과 일치하지 않습니다.' };
      }
    }

    return { result: 'correct', time: `${totalMs}ms`, mem: '-', detail: '모든 테스트케이스 통과' };

  } finally {
    try { rmSync(workDir, { recursive: true, force: true }); } catch {}
  }
}

export async function runCodeNative({ lang, code, input = '', timeLimit = 2, userTier = 'free' }) {
  const cfg = NATIVE_LANG[lang];
  if (!cfg) return { result: 'error', time: '-', mem: '-', detail: `지원하지 않는 언어: ${lang}`, output: '' };

  const isPremium = userTier === 'pro' || userTier === 'team';
  const vmMultiplier = isPremium ? 2 : 1;
  const maxTime = isPremium ? 15 : 5;
  const effectiveTimeLimit = Math.min(timeLimit, maxTime);
  const effectiveVmKb = cfg.vmKb * vmMultiplier;

  const workDir = join(tmpdir(), `judge_${randomUUID()}`);
  mkdirSync(workDir, { recursive: true });

  try {
    writeFileSync(join(workDir, cfg.file), code, 'utf-8');

    if (cfg.compile) {
      const compVmKb = Math.max(effectiveVmKb, 524288);
      const comp = await execShell(cfg.compile(workDir), '', 15000, compVmKb);
      if (comp.exitCode !== 0) {
        return {
          result: 'compile',
          time: '-',
          mem: '-',
          detail: comp.stderr || '컴파일 오류',
          output: '',
        };
      }
    }

    const start = Date.now();
    const run = await execShell(cfg.run(workDir), input, effectiveTimeLimit * 1000 + 500, effectiveVmKb);
    const elapsed = Date.now() - start;

    if (run.timedOut) {
      return { result: 'timeout', time: '-', mem: '-', detail: '시간 초과', output: '' };
    }
    if (run.outputExceeded) {
      return {
        result: 'error',
        time: `${elapsed}ms`,
        mem: '-',
        detail: '출력 크기 초과 (최대 512KB)',
        output: '',
      };
    }
    if (run.exitCode !== 0) {
      return {
        result: 'error',
        time: `${elapsed}ms`,
        mem: '-',
        detail: run.stderr || '런타임 오류',
        output: run.stdout.trim(),
      };
    }

    return {
      result: 'success',
      time: `${elapsed}ms`,
      mem: '-',
      detail: '실행 완료',
      output: run.stdout.trim(),
    };
  } finally {
    try { rmSync(workDir, { recursive: true, force: true }); } catch {}
  }
}

export async function executeJudgeRequest({
  judgeRuntime,
  lang,
  code,
  cases = [],
  timeLimit = 2,
  executionMode = 'judge',
  input = '',
  userTier = 'free',
}) {
  const runtime = judgeRuntime ?? await getJudgeRuntime();
  const useDocker = runtime.mode === 'docker-sandbox';
  let slotAcquired = false;

  try {
    await acquireJudgeSlot();
    slotAcquired = true;

    if (executionMode === 'run') {
      return useDocker
        ? runCode({ lang, code, input, timeLimit, userTier })
        : runCodeNative({ lang, code, input, timeLimit, userTier });
    }

    return useDocker
      ? judgeCode({ lang, code, examples: cases, timeLimit, userTier })
      : judgeCodeNative({ lang, code, examples: cases, timeLimit, userTier });
  } catch (err) {
    if (err?.message === 'JUDGE_QUEUE_TIMEOUT') {
      return executionMode === 'run'
        ? { result: 'error', time: '-', mem: '-', detail: '채점 요청이 많습니다. 잠시 후 다시 시도해주세요.', output: '' }
        : { result: 'error', time: '-', mem: '-', detail: '채점 요청이 많습니다. 잠시 후 다시 시도해주세요.' };
    }
    throw err;
  } finally {
    if (slotAcquired) releaseJudgeSlot();
  }
}
