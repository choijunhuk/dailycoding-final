import 'dotenv/config';
import { createServer } from 'http';
import { createHash } from 'crypto';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from './config/logger.js';
import { waitForDB, isConnected as mysqlConnected, getPool, run as dbRun } from './config/mysql.js';
import { resolveBootstrapConfig } from './config/bootstrap.js';
import { PROFILE_BACKGROUND_SEEDS } from './config/profileBackgroundSeeds.js';
import { User } from './models/User.js';
import { PROBLEMS as SHARED_PROBLEMS } from './shared/problemCatalog.js';
import { initSocketServer } from './services/socketServer.js';
import { startScheduler } from './services/scheduler.js';
import { ALLOWED_ORIGINS } from './middleware/setup.js';
import { createApp } from './app.js';

const PORT = process.env.PORT || 4000;
const app = createApp();
const httpServer = createServer(app);
const io = initSocketServer(httpServer, ALLOWED_ORIGINS);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const bootstrapConfig = resolveBootstrapConfig();

app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

app.set('io', io);
global.io = io;

process.on('unhandledRejection', (reason) => {
  logger.error('UnhandledRejection:', { reason: String(reason) });
});

process.on('uncaughtException', (err) => {
  logger.error('UncaughtException:', { message: err.message, stack: err.stack });
  process.exit(1);
});

httpServer.listen(PORT, async () => {
  logger.info(`\n🚀 DailyCoding API Server v2.1`);
  logger.info(`   ➜  http://localhost:${PORT}/api/health`);
  logger.info(`   📦 MySQL + Redis + Docker 샌드박스 지원`);
  logger.info(`   🔌 Socket.io 실시간 서버 활성화\n`);

  await waitForDB();
  await initDatabase();
  await seedDefaultProblems();
  await seedSpecialProblems();
  await seedGrowthCollections();
  if (process.env.RESET_DB === 'true') {
    logger.warn('⚠️  RESET_DB=true 감지 — 모든 유저 데이터를 초기화합니다.');
    await cleanupUsersKeepAdmin();
  }
  await ensurePrimaryAdmin(bootstrapConfig);
  await ensureLocalBootstrapUsers(bootstrapConfig);
  startScheduler();
  logger.info('✅ 서버 초기화 완료!\n');
});

async function initDatabase() {
  if (!mysqlConnected()) return;
  try {
    const { readFileSync } = await import('fs');
    const __dir = dirname(fileURLToPath(import.meta.url));
    const dbPool = getPool();
    const runSql = async (filePath) => {
      const sql = readFileSync(filePath, 'utf8');
      const stmts = sql
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('--'))
        .join('\n')
        .split(';')
        .map((statement) => statement.trim())
        .filter((statement) => statement.length > 0);
      for (const stmt of stmts) {
        try {
          await dbPool.query(stmt);
        } catch (error) {
          logger.warn(`SQL 실패 [${error.code || '?'}]: ${error.message.slice(0, 120)} | stmt: ${stmt.slice(0, 60)}`);
        }
      }
    };

    await runSql(join(__dir, '..', 'init.sql'));
    await runSql(join(__dir, 'migrations', '001_commercial.sql'));
    await runSql(join(__dir, 'migrations', '002_tier_redesign.sql'));
    await runSql(join(__dir, 'migrations', '003_submission_preferences.sql'));
    await runSql(join(__dir, 'migrations', '004_premium_problems.sql'));
    await runSql(join(__dir, 'migrations', '005_contest_improvements.sql'));
    await runSql(join(__dir, 'migrations', '006_contest_rewards.sql'));
    await runSql(join(__dir, 'migrations', '007_problem_types.sql'));
    await runSql(join(__dir, 'migrations', '008_community.sql'));
    await runSql(join(__dir, 'migrations', '009_dump_anonymous.sql'));
    await runSql(join(__dir, 'migrations', '010_community_v2.sql'));
    await runSql(join(__dir, 'migrations', '011_profile_settings_v2.sql'));
    await runSql(join(__dir, 'migrations', '012_battle_history.sql'));
    await runSql(join(__dir, 'migrations', '013_platform_improvements.sql'));
    await runSql(join(__dir, 'migrations', '014_sharing_and_solve_time.sql'));
    await runSql(join(__dir, 'migrations', '015_v3_engagement.sql'));
    await runSql(join(__dir, 'migrations', '016_v4_audit_gaps.sql'));
    await runSql(join(__dir, 'migrations', '017_v5_v6_growth_ux.sql'));
    await runSql(join(__dir, 'migrations', '018_remaining_growth_platform.sql'));
    await runSql(join(__dir, 'migrations', '019_prompt_security_perf.sql'));
    logger.info('✅ DB 스키마 초기화 완료');
  } catch (err) {
    logger.warn('⚠️  DB 초기화 스킵:', { message: err.message });
  }
}

async function cleanupUsersKeepAdmin() {
  try {
    const tables = ['notifications', 'submissions', 'bookmarks', 'contest_participants', 'solve_logs', 'comments', 'problem_comments', 'problem_comment_likes'];
    for (const table of tables) {
      try {
        await dbRun(`DELETE FROM ${table} WHERE user_id NOT IN (SELECT id FROM users WHERE role = ?)`, ['admin']);
      } catch {
        // Some optional tables may not exist in older local schemas.
      }
    }
    await dbRun('DELETE FROM users WHERE role != ?', ['admin']);
    logger.info('🧹 유저 데이터 초기화 완료 (admin만 유지)');
  } catch (err) {
    logger.warn('⚠️  유저 클린업 스킵:', { message: err.message });
  }
}

async function seedDefaultProblems() {
  if (!mysqlConnected()) return;
  try {
    const dbPool = getPool();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const [existingRows] = await dbPool.execute('SELECT id FROM problems');
    const existingIds = new Set(existingRows.map((row) => row.id));

    let patchedCount = 0;

    for (const prob of SHARED_PROBLEMS) {
      const existed = existingIds.has(prob.id);
      const contentHash = createHash('md5').update(JSON.stringify({
        tags: prob.tags || [],
        examples: prob.examples || [],
        testcases: prob.testcases || [],
      })).digest('hex');
      const hashKey = `seed:hash:${prob.id}`;

      await dbPool.execute(
        `INSERT INTO problems (id,title,tier,difficulty,time_limit,mem_limit,description,input_desc,output_desc,hint,solution,author_id,created_at,visibility,is_premium,contest_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           title=VALUES(title), tier=VALUES(tier), difficulty=VALUES(difficulty),
           time_limit=VALUES(time_limit), mem_limit=VALUES(mem_limit),
           description=VALUES(description), input_desc=VALUES(input_desc),
           output_desc=VALUES(output_desc), hint=VALUES(hint), visibility='global', is_premium=VALUES(is_premium)`,
        [prob.id, prob.title, prob.tier, prob.difficulty, prob.timeLimit, prob.memLimit, prob.desc, prob.inputDesc, prob.outputDesc, prob.hint, '', null, now, 'global', prob.isPremium ? 1 : 0, null]
      );
      if (!existed) patchedCount++;
      const { redis } = await import('./config/redis.js');
      const cachedHash = await redis.get(hashKey);
      if (cachedHash === contentHash) continue;

      await dbPool.execute('DELETE FROM problem_tags WHERE problem_id=?', [prob.id]);
      for (const tag of prob.tags || []) {
        await dbPool.execute('INSERT IGNORE INTO problem_tags VALUES (?,?)', [prob.id, tag]);
      }

      await dbPool.execute('DELETE FROM problem_examples WHERE problem_id=?', [prob.id]);
      for (let index = 0; index < (prob.examples || []).length; index += 1) {
        await dbPool.execute(
          'INSERT INTO problem_examples (problem_id,input_data,output_data,ord) VALUES (?,?,?,?)',
          [prob.id, prob.examples[index].input, prob.examples[index].output, index]
        );
      }

      await dbPool.execute('DELETE FROM problem_testcases WHERE problem_id=?', [prob.id]);
      for (let index = 0; index < (prob.testcases || []).length; index += 1) {
        await dbPool.execute(
          'INSERT INTO problem_testcases (problem_id,input_data,output_data,ord) VALUES (?,?,?,?)',
          [prob.id, prob.testcases[index].input, prob.testcases[index].output, index]
        );
      }

      await redis.set(hashKey, contentHash);
    }
    logger.info(`✅ 기본 문제 시드 동기화 완료 (총 ${SHARED_PROBLEMS.length}개, 신규 ${patchedCount}개)`);
  } catch (err) {
    logger.warn('⚠️  기본 문제 시드 실패:', { message: err.message });
  }
}

async function ensurePrimaryAdmin(config) {
  try {
    const existing = await User.findByEmail(config.primaryAdmin.email);
    if (!existing) {
      if (!config.primaryAdmin.password) {
        const message = config.isProduction
          ? '[SETUP] Missing ADMIN_PASSWORD for primary admin creation in production.'
          : '[SETUP] Primary admin not created. Set ADMIN_PASSWORD or enable local bootstrap for local verification.';
        if (config.isProduction) {
          throw new Error(message);
        }
        logger.warn(message);
        return;
      }
      await User.create({
        email: config.primaryAdmin.email,
        password: config.primaryAdmin.password,
        username: config.primaryAdmin.username,
        role: 'admin',
        tier: 'diamond',
        rating: 3000,
      });
      logger.info(`✅ 관리자 계정 생성됨: ${config.primaryAdmin.email}`);
    } else if (existing.role !== 'admin') {
      await dbRun(
        "UPDATE users SET role='admin', tier='diamond', rating=3000, email_verified=1 WHERE email=?",
        [config.primaryAdmin.email]
      );
      logger.info('✅ 관리자 권한 복구됨');
    } else if (!existing.email_verified) {
      await dbRun('UPDATE users SET email_verified=1 WHERE email=?', [config.primaryAdmin.email]);
      logger.info('✅ 관리자 이메일 인증 자동 처리됨');
    } else {
      logger.info('✅ 관리자 계정 확인됨');
    }
  } catch (err) {
    logger.error('❌ 관리자 계정 처리 실패:', { message: err.message });
    if (config.isProduction) {
      throw err;
    }
  }
}

async function ensureLocalBootstrapUsers(config) {
  if (!config.localBootstrapEnabled || !config.localTestUser) return;

  try {
    const existing = await User.findByEmail(config.localTestUser.email);
    if (!existing) {
      const created = await User.create({
        email: config.localTestUser.email,
        password: config.localTestUser.password,
        username: config.localTestUser.username,
        role: config.localTestUser.role,
        tier: config.localTestUser.tier,
        rating: config.localTestUser.rating,
      });
      await dbRun('UPDATE users SET email_verified=1 WHERE id=?', [created.id]);
      logger.info(`✅ 로컬 테스트 계정 생성됨: ${config.localTestUser.email}`);
    } else if (!existing.email_verified) {
      await dbRun('UPDATE users SET email_verified=1 WHERE email=?', [config.localTestUser.email]);
      logger.info(`✅ 로컬 테스트 계정 인증 처리됨: ${config.localTestUser.email}`);
    } else {
      logger.info(`✅ 로컬 테스트 계정 확인됨: ${config.localTestUser.email}`);
    }
    logger.info('ℹ️  로컬 부트스트랩 활성화됨. 계정 정보는 README 또는 환경변수 설정을 확인하세요.');
  } catch (err) {
    logger.error('❌ 로컬 테스트 계정 처리 실패:', { message: err.message });
  }
}

async function seedSpecialProblems() {
  if (!mysqlConnected()) return;
  const pool = getPool();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const problems = [
    // ── Python 빈칸 채우기 (11–15) ───────────────────────────────────
    { id: 11, title: 'Python: Hello, World! 출력', difficulty: 1, lang: 'python', type: 'fill-blank',
      desc: 'Python에서 "Hello, World!"를 출력하는 빈칸을 채우세요.',
      hint: 'Python의 표준 출력 함수 이름을 입력하세요.',
      config: { codeTemplate: "___1___('Hello, World!')", blanks: ['print'], hint: 'Python에서 콘솔에 값을 출력할 때 사용하는 내장 함수입니다.' } },
    { id: 12, title: 'Python: 두 수의 합', difficulty: 1, lang: 'python', type: 'fill-blank',
      desc: '표준 입력으로 두 정수를 받아 합을 출력합니다.',
      hint: 'input().split() 후 map(int, ...)으로 정수를 받습니다.',
      config: { codeTemplate: "a, b = ___1___(int, input().split())\n___2___(a + b)", blanks: ['map', 'print'], hint: '문자열 리스트를 정수로 변환하는 함수와 출력 함수를 채우세요.' } },
    { id: 13, title: 'Python: 홀짝 판별', difficulty: 1, lang: 'python', type: 'fill-blank',
      desc: '정수 n이 홀수인지 짝수인지 판별하세요.',
      hint: '나머지 연산자(%)를 사용합니다.',
      config: { codeTemplate: "n = int(input())\nif n ___1___ 2 == 0:\n    print('짝수')\nelse:\n    print('___2___')", blanks: ['%', '홀수'], hint: '나머지 연산자와 홀수일 때 출력할 문자열을 채우세요.' } },
    { id: 14, title: 'Python: 배열 최댓값', difficulty: 1, lang: 'python', type: 'fill-blank',
      desc: '리스트에서 최댓값을 구하세요. Python 내장 함수를 활용합니다.',
      hint: 'max() 내장 함수를 사용합니다.',
      config: { codeTemplate: "nums = [3, 1, 4, 1, 5, 9, 2, 6]\nresult = ___1___(nums)\nprint(___2___)", blanks: ['max', 'result'], hint: '리스트 최댓값 내장 함수와 출력할 변수명을 채우세요.' } },
    { id: 15, title: 'Python: 배열 평균', difficulty: 1, lang: 'python', type: 'fill-blank',
      desc: '리스트 원소의 평균값을 구하세요. sum과 len을 사용합니다.',
      hint: 'sum(리스트) / len(리스트)로 평균을 구합니다.',
      config: { codeTemplate: "nums = [10, 20, 30, 40, 50]\navg = ___1___(nums) / ___2___(nums)\nprint(avg)", blanks: ['sum', 'len'], hint: '리스트 합계 함수와 길이 함수를 채우세요.' } },

    // ── Python 버그 찾기 (91001–91002) ───────────────────────────────
    { id: 91001, title: 'Python 버그: 최댓값 초기값 오류', difficulty: 2, lang: 'python', type: 'bug-fix',
      desc: '배열에서 최댓값을 구하지만 음수 배열에서 잘못된 결과를 반환합니다. 버그를 찾아 수정하세요.',
      hint: '초기값이 특정 경우에 문제가 됩니다.',
      config: { buggyCode: "# 배열의 최댓값을 구하는 함수\n# 버그: 모든 원소가 음수일 때 잘못된 결과 반환\ndef find_max(arr):\n    max_val = 0\n    for x in arr:\n        if x > max_val:\n            max_val = x\n    return max_val\nprint(find_max([-3, -1, -4]))  # -1이어야 하지만 0 반환", keywords: ['arr[0]', 'float(\'-inf\')', '-inf'], explanation: 'max_val을 0으로 초기화하면 모든 원소가 음수일 때 0이 반환됩니다. arr[0] 또는 float(\'-inf\')로 초기화해야 합니다.', hint: 'max_val 초기값을 arr[0]으로 바꾸세요.' } },
    { id: 91002, title: 'Python 버그: 리스트 복사 오류', difficulty: 2, lang: 'python', type: 'bug-fix',
      desc: '리스트를 복사해서 정렬하려 했는데 원본이 바뀌어 버립니다. 버그를 찾아 수정하세요.',
      hint: '할당(=)은 복사가 아니라 참조를 공유합니다.',
      config: { buggyCode: "# 원본을 유지하면서 정렬된 복사본을 반환\n# 버그: = 로 할당하면 같은 객체를 가리킴\ndef sorted_copy(arr):\n    copy = arr  # 버그!\n    copy.sort()\n    return copy\n\noriginal = [3, 1, 4, 1, 5]\nresult = sorted_copy(original)\nprint(original)  # [3,1,4,1,5]여야 하지만 정렬됨", keywords: ['arr[:]', 'arr.copy()', 'list(arr)'], explanation: 'copy = arr은 같은 리스트 객체를 가리킵니다. copy = arr[:] 또는 arr.copy()로 실제 복사를 해야 합니다.', hint: 'copy = arr을 copy = arr[:]로 바꾸세요.' } },

    // ── JavaScript 빈칸 채우기 (101–105) ─────────────────────────────
    { id: 101, title: 'JS: Hello, World! 출력', difficulty: 1, lang: 'javascript', type: 'fill-blank',
      desc: 'Node.js에서 "Hello, World!"를 출력하는 빈칸을 채우세요.',
      hint: 'Node.js의 표준 콘솔 출력 함수 이름을 입력하세요.',
      config: { codeTemplate: "___1___('Hello, World!');", blanks: ['console.log'], hint: 'Node.js에서 콘솔에 값을 출력할 때 사용하는 전역 함수입니다.' } },
    { id: 102, title: 'JS: 두 수의 합', difficulty: 1, lang: 'javascript', type: 'fill-blank',
      desc: '표준 입력으로 두 정수를 받아 합을 출력합니다.',
      hint: 'split 후 map(Number)로 정수 배열을 만드세요.',
      config: { codeTemplate: "const [a, b] = require('fs').readFileSync('/dev/stdin','utf8').trim().split(' ').___1___(Number);\nconsole.log(___2___);", blanks: ['map', 'a + b'], hint: '문자열 배열을 숫자 배열로 바꾸는 배열 메서드와, 두 수를 더하는 식을 채우세요.' } },
    { id: 103, title: 'JS: 홀짝 판별', difficulty: 1, lang: 'javascript', type: 'fill-blank',
      desc: '정수 n이 홀수인지 짝수인지 판별하세요.',
      hint: '나머지 연산자(%)를 사용합니다.',
      config: { codeTemplate: "const n = Number(require('fs').readFileSync('/dev/stdin','utf8').trim());\nif (n ___1___ 2 === 0) {\n  console.log('짝수');\n} else {\n  console.log('___2___');\n}", blanks: ['%', '홀수'], hint: '나머지 연산자와 홀수일 때 출력할 문자열을 채우세요.' } },
    { id: 104, title: 'JS: 배열 최댓값', difficulty: 1, lang: 'javascript', type: 'fill-blank',
      desc: '배열에서 최댓값을 구하세요. Math 객체의 메서드를 활용합니다.',
      hint: 'Math.max(...배열) 형태로 사용합니다.',
      config: { codeTemplate: "const nums = [3, 1, 4, 1, 5, 9, 2, 6];\nconst max = ___1___.___2___(...nums);\nconsole.log(max);", blanks: ['Math', 'max'], hint: 'Math 네임스페이스와 최댓값 함수 이름을 채우세요.' } },
    { id: 105, title: 'JS: 배열 평균', difficulty: 1, lang: 'javascript', type: 'fill-blank',
      desc: '배열 원소의 평균값을 구하세요. reduce를 사용합니다.',
      hint: 'reduce로 합계를 구한 뒤 length로 나눕니다.',
      config: { codeTemplate: "const nums = [10, 20, 30, 40, 50];\nconst sum = nums.___1___((acc, v) => acc + v, 0);\nconst avg = sum / nums.___2___;\nconsole.log(avg);", blanks: ['reduce', 'length'], hint: '배열 합산 고차함수와 배열 길이 속성을 채우세요.' } },

    // ── C 빈칸 채우기 (201–205) ───────────────────────────────────────
    { id: 201, title: 'C: Hello, World! 출력', difficulty: 1, lang: 'c', type: 'fill-blank',
      desc: 'C 언어로 "Hello, World!"를 출력합니다.',
      hint: 'printf 함수를 사용하고, stdio.h 헤더가 필요합니다.',
      config: { codeTemplate: "#include <___1___>\nint main() {\n  ___2___(\"Hello, World!\\n\");\n  return 0;\n}", blanks: ['stdio.h', 'printf'], hint: '표준 입출력 헤더파일 이름과 출력 함수 이름을 채우세요.' } },
    { id: 202, title: 'C: 두 수의 합', difficulty: 1, lang: 'c', type: 'fill-blank',
      desc: 'scanf로 두 정수를 입력받아 합을 출력하세요.',
      hint: 'scanf로 입력받고 printf로 출력합니다.',
      config: { codeTemplate: "#include <stdio.h>\nint main() {\n  int a, b;\n  ___1___(\"%d %d\", &a, &b);\n  printf(\"%d\\n\", ___2___);\n  return 0;\n}", blanks: ['scanf', 'a + b'], hint: '표준 입력 함수와 두 변수의 합 식을 채우세요.' } },
    { id: 203, title: 'C: 홀짝 판별', difficulty: 1, lang: 'c', type: 'fill-blank',
      desc: '정수가 홀수인지 짝수인지 판별하여 출력하세요.',
      hint: '% 연산자로 나머지를 구합니다.',
      config: { codeTemplate: "#include <stdio.h>\nint main() {\n  int n;\n  scanf(\"%d\", &n);\n  if (n % 2 ___1___ 0) {\n    printf(\"짝수\\n\");\n  } else {\n    printf(\"___2___\\n\");\n  }\n  return 0;\n}", blanks: ['==', '홀수'], hint: '짝수 비교 연산자와 홀수일 때 출력할 문자열을 채우세요.' } },
    { id: 204, title: 'C: 팩토리얼', difficulty: 1, lang: 'c', type: 'fill-blank',
      desc: '재귀 함수를 사용하여 n!을 계산하세요.',
      hint: '기저 조건(n<=1)과 재귀 호출 이름을 채웁니다.',
      config: { codeTemplate: "#include <stdio.h>\nint factorial(int n) {\n  if (n ___1___ 1) return 1;\n  return n * ___2___(n - 1);\n}\nint main() {\n  int n;\n  scanf(\"%d\", &n);\n  printf(\"%d\\n\", factorial(n));\n  return 0;\n}", blanks: ['<=', 'factorial'], hint: '기저 조건 비교 연산자와 재귀 호출할 함수 이름을 채우세요.' } },
    { id: 205, title: 'C: 배열 최솟값', difficulty: 1, lang: 'c', type: 'fill-blank',
      desc: '정수 배열에서 최솟값을 찾으세요.',
      hint: 'sizeof로 배열 크기를 구하고, < 로 비교합니다.',
      config: { codeTemplate: "#include <stdio.h>\nint main() {\n  int arr[] = {5, 3, 8, 1, 9, 2};\n  int n = ___1___(arr) / sizeof(arr[0]);\n  int min = arr[0];\n  for (int i = 1; i < n; i++) {\n    if (arr[i] ___2___ min) min = arr[i];\n  }\n  printf(\"%d\\n\", min);\n  return 0;\n}", blanks: ['sizeof', '<'], hint: '배열 전체 크기를 구하는 C 연산자와 최솟값 비교 연산자를 채우세요.' } },

    // ── C++ 빈칸 채우기 (301–305) ─────────────────────────────────────
    { id: 301, title: 'C++: Hello, World! 출력', difficulty: 1, lang: 'cpp', type: 'fill-blank',
      desc: 'C++에서 "Hello, World!"를 출력합니다.',
      hint: 'iostream 헤더와 cout을 사용합니다.',
      config: { codeTemplate: "#include <___1___>\nusing namespace std;\nint main() {\n  ___2___ << \"Hello, World!\" << endl;\n  return 0;\n}", blanks: ['iostream', 'cout'], hint: '표준 입출력 헤더와 출력 스트림 객체를 채우세요.' } },
    { id: 302, title: 'C++: 두 수의 합', difficulty: 1, lang: 'cpp', type: 'fill-blank',
      desc: 'cin으로 두 정수를 입력받아 합을 출력하세요.',
      hint: 'cin과 cout을 사용합니다.',
      config: { codeTemplate: "#include <iostream>\nusing namespace std;\nint main() {\n  int a, b;\n  ___1___ >> a >> b;\n  cout << ___2___ << endl;\n  return 0;\n}", blanks: ['cin', 'a + b'], hint: '표준 입력 스트림 객체와 두 수의 합 식을 채우세요.' } },
    { id: 303, title: 'C++: 홀짝 판별', difficulty: 1, lang: 'cpp', type: 'fill-blank',
      desc: '정수가 홀수인지 짝수인지 판별하세요.',
      hint: '나머지 연산자(%)를 사용합니다.',
      config: { codeTemplate: "#include <iostream>\nusing namespace std;\nint main() {\n  int n;\n  cin >> n;\n  if (n % 2 == ___1___) {\n    cout << \"짝수\" << endl;\n  } else {\n    cout << \"___2___\" << endl;\n  }\n  return 0;\n}", blanks: ['0', '홀수'], hint: '짝수 조건의 나머지 값과 홀수일 때 출력할 문자열을 채우세요.' } },
    { id: 304, title: 'C++: 벡터 정렬', difficulty: 2, lang: 'cpp', type: 'fill-blank',
      desc: 'vector를 오름차순으로 정렬하세요.',
      hint: 'algorithm 헤더의 sort 함수를 사용합니다.',
      config: { codeTemplate: "#include <iostream>\n#include <vector>\n#include <___1___>\nusing namespace std;\nint main() {\n  vector<int> v = {5, 3, 1, 4, 2};\n  ___2___(v.begin(), v.end());\n  for (int x : v) cout << x << \" \";\n  return 0;\n}", blanks: ['algorithm', 'sort'], hint: '정렬 알고리즘 헤더와 STL 정렬 함수 이름을 채우세요.' } },
    { id: 305, title: 'C++: 문자열 길이', difficulty: 1, lang: 'cpp', type: 'fill-blank',
      desc: '입력받은 문자열의 길이를 출력하세요.',
      hint: 'string 클래스의 멤버 함수를 사용합니다.',
      config: { codeTemplate: "#include <iostream>\n#include <string>\nusing namespace std;\nint main() {\n  string s;\n  ___1___ >> s;\n  cout << s.___2___() << endl;\n  return 0;\n}", blanks: ['cin', 'length'], hint: '입력 스트림 객체와 문자열 길이 반환 메서드를 채우세요.' } },

    // ── Java 빈칸 채우기 (401–405) ────────────────────────────────────
    { id: 401, title: 'Java: Hello, World! 출력', difficulty: 1, lang: 'java', type: 'fill-blank',
      desc: 'Java에서 "Hello, World!"를 출력하는 빈칸을 채우세요.',
      hint: 'System.out 객체의 메서드를 사용합니다.',
      config: { codeTemplate: "public class Main {\n  public static void main(String[] ___1___) {\n    System.out.___2___(\"Hello, World!\");\n  }\n}", blanks: ['args', 'println'], hint: 'main 메서드 매개변수명과 줄바꿈 포함 출력 메서드를 채우세요.' } },
    { id: 402, title: 'Java: 두 수의 합', difficulty: 1, lang: 'java', type: 'fill-blank',
      desc: 'Scanner로 두 정수를 입력받아 합을 출력하세요.',
      hint: 'java.util.Scanner를 사용합니다.',
      config: { codeTemplate: "import java.util.Scanner;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new ___1___(System.in);\n    int a = sc.nextInt();\n    int b = sc.nextInt();\n    System.out.println(___2___);\n  }\n}", blanks: ['Scanner', 'a + b'], hint: 'Scanner 클래스 이름과 두 수의 합 식을 채우세요.' } },
    { id: 403, title: 'Java: 홀짝 판별', difficulty: 1, lang: 'java', type: 'fill-blank',
      desc: '정수가 홀수인지 짝수인지 판별하여 출력하세요.',
      hint: '% 연산자로 나머지를 구합니다.',
      config: { codeTemplate: "import java.util.Scanner;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    int n = sc.nextInt();\n    if (n ___1___ 2 == 0) {\n      System.out.println(\"짝수\");\n    } else {\n      System.out.println(\"___2___\");\n    }\n  }\n}", blanks: ['%', '홀수'], hint: '나머지 연산자와 홀수일 때 출력할 문자열을 채우세요.' } },
    { id: 404, title: 'Java: 배열 합계', difficulty: 1, lang: 'java', type: 'fill-blank',
      desc: '정수 배열의 모든 원소의 합을 구하세요.',
      hint: '향상된 for문(for-each)으로 순회합니다.',
      config: { codeTemplate: "public class Main {\n  public static void main(String[] args) {\n    int[] nums = {1, 2, 3, 4, 5};\n    int sum = ___1___;\n    for (int n : nums) {\n      sum += ___2___;\n    }\n    System.out.println(sum);\n  }\n}", blanks: ['0', 'n'], hint: '합계 누적을 위한 초기값과 각 원소를 나타내는 변수명을 채우세요.' } },
    { id: 405, title: 'Java: 배열 최솟값', difficulty: 1, lang: 'java', type: 'fill-blank',
      desc: '정수 배열에서 최솟값을 찾으세요. 정렬 후 첫 번째 원소를 사용합니다.',
      hint: 'Arrays.sort() 후 첫 번째 인덱스를 확인합니다.',
      config: { codeTemplate: "import java.util.Arrays;\npublic class Main {\n  public static void main(String[] args) {\n    int[] nums = {5, 3, 8, 1, 9, 2};\n    Arrays.___1___(nums);\n    System.out.println(nums[___2___]);\n  }\n}", blanks: ['sort', '0'], hint: '배열을 정렬하는 메서드와 정렬 후 최솟값이 있는 인덱스를 채우세요.' } },

    // ── JavaScript 버그 찾기 (92001–92002) ───────────────────────────
    { id: 92001, title: 'JS 버그: 배열 최댓값 초기값 오류', difficulty: 2, lang: 'javascript', type: 'bug-fix',
      desc: '배열에서 최댓값을 구하지만 음수 배열에서 잘못된 결과를 반환합니다. 버그를 찾아 수정하세요.',
      hint: '초기값이 특정 경우에 문제가 됩니다.',
      config: { buggyCode: "// 배열의 최댓값을 구하는 함수\n// 버그: 모든 원소가 음수일 때 잘못된 결과 반환\nfunction findMax(arr) {\n  let max = 0;\n  for (let i = 0; i < arr.length; i++) {\n    if (arr[i] > max) max = arr[i];\n  }\n  return max;\n}\nconsole.log(findMax([-3, -1, -4]));  // -1이어야 하지만 0 반환", keywords: ['arr[0]', '-Infinity', 'Math.max'], explanation: 'max를 0으로 초기화하면 모든 원소가 음수일 때 0이 반환됩니다. arr[0] 또는 -Infinity로 초기화해야 합니다.', hint: 'max 초기값을 배열의 첫 번째 원소로 바꾸세요.' } },
    { id: 92002, title: 'JS 버그: 문자열 뒤집기 공백 오류', difficulty: 2, lang: 'javascript', type: 'bug-fix',
      desc: '문자열을 뒤집는 코드에 버그가 있습니다. "hello"가 "olleh"로 출력되어야 합니다.',
      hint: '배열 메서드 join의 인수를 확인하세요.',
      config: { buggyCode: "// 문자열을 뒤집는 함수\nfunction reverseString(s) {\n  return s.split('').reverse().join(' ');  // 버그 있음\n}\nconsole.log(reverseString('hello'));  // 'olleh' 출력해야 함", keywords: ["join('')", 'join'], explanation: "join(' ')는 각 문자 사이에 공백을 삽입합니다. join('')으로 고쳐야 공백 없이 합쳐집니다.", hint: "join의 인수를 공백 문자열(' ')에서 빈 문자열('')로 바꾸세요." } },

    // ── C 버그 찾기 (93001–93002) ─────────────────────────────────────
    { id: 93001, title: 'C 버그: swap 값 전달 오류', difficulty: 2, lang: 'c', type: 'bug-fix',
      desc: '두 변수를 교환하는 swap 함수가 제대로 동작하지 않습니다. 버그를 찾아 수정하세요.',
      hint: 'C에서 함수 밖의 변수를 수정하려면 포인터가 필요합니다.',
      config: { buggyCode: "#include <stdio.h>\n// 버그: 값에 의한 전달 — 원본이 바뀌지 않음\nvoid swap(int a, int b) {\n  int tmp = a;\n  a = b;\n  b = tmp;\n}\nint main() {\n  int x = 3, y = 7;\n  swap(x, y);\n  printf(\"%d %d\\n\", x, y);  // 7 3이어야 하지만 3 7 출력\n  return 0;\n}", keywords: ['int *a', 'int *b', '*a', '*b', '&x', '&y'], explanation: 'C는 함수 인자를 값으로 복사합니다. 원본을 바꾸려면 포인터로 받아야 합니다: swap(int *a, int *b).', hint: 'swap 매개변수를 포인터로 변경하고 main에서 &x, &y로 호출하세요.' } },
    { id: 93002, title: 'C 버그: 팩토리얼 범위 오류', difficulty: 2, lang: 'c', type: 'bug-fix',
      desc: 'n!을 계산하는 코드에 버그가 있습니다. 5! = 120이어야 합니다.',
      hint: '반복 범위를 다시 확인하세요.',
      config: { buggyCode: "#include <stdio.h>\nint main() {\n  int n = 5;\n  int fact = 1;\n  for (int i = 1; i < n; i++) {  // 버그: n을 포함하지 않음\n    fact *= i;\n  }\n  printf(\"%d\\n\", fact);  // 120이어야 하지만 24 출력\n  return 0;\n}", keywords: ['i <= n', '<='], explanation: 'i < n은 i가 1~4까지만 곱합니다. n까지 포함하려면 i <= n으로 바꿔야 합니다.', hint: 'for 루프의 조건을 i < n에서 i <= n으로 수정하세요.' } },

    // ── C++ 버그 찾기 (94001–94002) ───────────────────────────────────
    { id: 94001, title: 'C++ 버그: 벡터 범위 초과', difficulty: 2, lang: 'cpp', type: 'bug-fix',
      desc: '벡터를 순회하는 코드에 배열 범위 초과 버그가 있습니다.',
      hint: '인덱스 범위를 다시 확인하세요.',
      config: { buggyCode: "#include <iostream>\n#include <vector>\nusing namespace std;\nint main() {\n  vector<int> v = {1, 2, 3, 4, 5};\n  for (int i = 0; i <= v.size(); i++) {  // 버그: 범위 초과\n    cout << v[i] << \" \";\n  }\n  cout << endl;\n  return 0;\n}", keywords: ['i < v.size()', '<'], explanation: 'i <= v.size()는 인덱스 5(존재하지 않음)까지 접근합니다. i < v.size()로 수정해야 합니다.', hint: 'for 루프 조건을 i <= v.size()에서 i < v.size()로 바꾸세요.' } },
    { id: 94002, title: 'C++ 버그: 피보나치 기저 조건 오류', difficulty: 2, lang: 'cpp', type: 'bug-fix',
      desc: '재귀 피보나치 함수의 기저 조건에 버그가 있습니다. fib(10)은 55여야 합니다.',
      hint: 'fib(0)=0, fib(1)=1의 올바른 기저 조건을 생각해보세요.',
      config: { buggyCode: "#include <iostream>\nusing namespace std;\nint fib(int n) {\n  if (n <= 1) return 1;  // 버그: fib(0)=0이어야 함\n  return fib(n-1) + fib(n-2);\n}\nint main() {\n  cout << fib(10) << endl;  // 55이어야 하지만 89 출력\n  return 0;\n}", keywords: ['return n', 'if (n <= 1) return n'], explanation: 'fib(0)=0, fib(1)=1이어야 합니다. return n으로 바꾸면 n=0일 때 0, n=1일 때 1을 반환합니다.', hint: 'if (n <= 1) return n;으로 수정하세요.' } },

    // ── Java 버그 찾기 (95001–95002) ──────────────────────────────────
    { id: 95001, title: 'Java 버그: 배열 출력 주소값 오류', difficulty: 2, lang: 'java', type: 'bug-fix',
      desc: '정렬된 배열을 출력하는 코드가 의미없는 값을 출력합니다.',
      hint: '배열을 직접 println하면 어떻게 되는지 생각해보세요.',
      config: { buggyCode: "import java.util.Arrays;\npublic class Main {\n  public static void main(String[] args) {\n    int[] arr = {5, 3, 1, 4, 2};\n    Arrays.sort(arr);\n    System.out.println(arr);  // 버그: [I@해시값 출력\n  }\n}", keywords: ['Arrays.toString(arr)', 'Arrays.toString'], explanation: 'Java에서 배열을 직접 println하면 메모리 주소 해시값이 출력됩니다. Arrays.toString(arr)을 사용해야 합니다.', hint: 'println(arr) 대신 println(Arrays.toString(arr))을 사용하세요.' } },
    { id: 95002, title: 'Java 버그: 문자열 참조 비교 오류', difficulty: 2, lang: 'java', type: 'bug-fix',
      desc: '두 문자열이 같은지 비교하는 코드에 버그가 있습니다.',
      hint: 'Java에서 == 연산자와 equals() 메서드의 차이를 생각해보세요.',
      config: { buggyCode: "public class Main {\n  public static void main(String[] args) {\n    String s1 = new String(\"hello\");\n    String s2 = new String(\"hello\");\n    if (s1 == s2) {  // 버그: 참조(주소값) 비교\n      System.out.println(\"같다\");\n    } else {\n      System.out.println(\"다르다\");  // 잘못 출력됨\n    }\n  }\n}", keywords: ['s1.equals(s2)', '.equals('], explanation: 'Java에서 ==는 객체 참조(메모리 주소)를 비교합니다. 문자열 내용을 비교하려면 .equals() 메서드를 사용해야 합니다.', hint: 's1 == s2를 s1.equals(s2)로 바꾸세요.' } },
  ];

  try {
    let inserted = 0;
    for (const p of problems) {
      const [result] = await pool.execute(
        `INSERT IGNORE INTO problems
           (id,title,tier,difficulty,time_limit,mem_limit,description,input_desc,output_desc,hint,solution,author_id,created_at,visibility,is_premium,contest_id,problem_type,preferred_language,special_config)
         VALUES (?,?,?,?,2000,256,?,?,?,?,?,NULL,?,?,0,NULL,?,?,?)`,
        [p.id, p.title, 'bronze', p.difficulty, p.desc, '없음', '정해진 출력', p.hint, '', now, 'global', p.type, p.lang, JSON.stringify(p.config)]
      );
      if (result.affectedRows > 0) inserted++;
    }
    logger.info(`✅ 특수 문제 시드 완료 (총 ${problems.length}개, 신규 ${inserted}개)`);
  } catch (err) {
    logger.warn('⚠️ 특수 문제 시드 실패:', { message: err.message });
  }
}

async function seedGrowthCollections() {
  if (!mysqlConnected()) return;
  const pool = getPool();
  async function countRows(table) {
    const [[row]] = await pool.execute(`SELECT COUNT(*) AS cnt FROM ${table}`);
    return Number(row?.cnt ?? 0);
  }
  try {
    const backgroundRows = PROFILE_BACKGROUND_SEEDS.flatMap((bg) => [
      bg.slug,
      bg.name,
      bg.image_url,
      1,
      0,
    ]);
    const backgroundPlaceholders = PROFILE_BACKGROUND_SEEDS.map(() => '(?,?,?,?,?)').join(',');
    await dbRun(
      `INSERT INTO profile_backgrounds (slug, name, image_url, is_default, is_premium)
       VALUES ${backgroundPlaceholders}
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         image_url = VALUES(image_url),
         is_default = VALUES(is_default),
         is_premium = VALUES(is_premium)`,
      backgroundRows
    );

    // Deprecated practice set cleanup: keep old DBs aligned with current seed data.
    await dbRun("DELETE FROM problem_sheets WHERE REPLACE(title, ' ', '') = ?", ['일반코테연습A']);
    await dbRun("DELETE FROM exam_sets WHERE REPLACE(title, ' ', '') = ?", ['일반코테연습A']);

    // 항상 재시드 — 제목/문제 변경이 즉시 반영되도록
    await dbRun('DELETE FROM learning_paths');
    await dbRun(
      `INSERT INTO learning_paths (title, description, order_index, tag, icon, problem_ids) VALUES
       ('Hello, World!: 입력과 출력', '첫 번째 프로그램! Python·JS·C·C++·Java로 Hello World를 출력하며 각 언어의 출력 방식을 배웁니다.', 1, '입출력', '📥', '[11,101,201,301,401]'),
       ('사칙연산과 변수', '두 수를 입력받아 합을 출력합니다. 기본 입력 흐름과 변수 사용법을 5개 언어로 배웁니다.', 2, '연산', '🔢', '[12,102,202,302,402]'),
       ('조건문 기초', 'if/else로 홀짝을 판별합니다. 조건부 실행 흐름의 핵심을 5개 언어로 이해합니다.', 3, '조건문', '🔀', '[13,103,203,303,403]'),
       ('반복문과 누적 계산', '반복문으로 최댓값·팩토리얼을 구합니다. 루프의 제어 흐름을 5개 언어로 익힙니다.', 4, '반복문', '🔁', '[14,104,204,304,404]'),
       ('배열과 컬렉션', '배열에서 평균·최솟값을 구하고 정렬합니다. 자료구조의 기초를 5개 언어로 다집니다.', 5, '배열', '📦', '[15,105,205,305,405]'),
       ('버그 찾기: 기초 오류', '음수 처리, join 인자, 포인터 전달 등 초보자가 흔히 실수하는 버그를 5개 언어로 분석합니다.', 6, '디버깅', '🐛', '[91001,92001,93001,94001,95001]'),
       ('버그 찾기: 반복·경계 오류', '참조 복사, off-by-one, 피보나치 기저 조건, 문자열 비교 등 경계 오류를 집중 훈련합니다.', 7, '디버깅', '🐛', '[91002,92002,93002,94002,95002]'),
       ('코딩테스트 입문 A', 'A+B·사칙연산·피보나치·홀짝·최댓값 등 코딩테스트 빈출 유형 7문제입니다.', 8, '알고리즘', '💻', '[1001,1002,1003,1004,1005,1006,1007]'),
       ('코딩테스트 입문 B', '팩토리얼·문자열 뒤집기·자릿수 합·약수·최솟값 등 코딩테스트 입문을 완성하는 7문제입니다.', 9, '알고리즘', '💻', '[1008,1009,1010,11,12,13,14]'),
       ('실버 도전', '스택·큐·완전탐색 등 실버 수준 알고리즘 문제입니다. 코딩테스트를 본격 준비합니다.', 10, '중급', '🥈', '[2001,2002,2003,2004,2005,91001,92001]')`,
      []
    );

    if (await countRows('problem_sheets') === 0) {
      await dbRun(
        `INSERT INTO problem_sheets (title, description, category, contest_name, contest_year, problem_ids, is_official, created_by, thumbnail_color)
         VALUES
         ('초보자 입문 트랙', '프로그래밍을 처음 시작하는 분들을 위한 문제 모음', 'learning', NULL, NULL, '[1,2,3,4]', 1, 1, '#d2a8ff'),
         ('KOI 2023 기출 — 초등부·중등부', '정렬, 에라토스테네스의 체 유형 | 비상업적 교육 목적', 'contest', 'KOI', 2023, '[6001,6002]', 1, 1, '#1f6feb'),
         ('KOI 2022 기출 — 초등부·중등부', '탐욕법(거스름돈), 회문수 유형 | 비상업적 교육 목적', 'contest', 'KOI', 2022, '[6003,6004]', 1, 1, '#388bfd'),
         ('KOI 2021 기출 — 초등부·중등부', '문자열 암호, 해시+누적합 유형 | 비상업적 교육 목적', 'contest', 'KOI', 2021, '[6005,6006]', 1, 1, '#58a6ff'),
         ('KOI 2020 기출 — 초등부·중등부', '구현, 최장 공통 부분 문자열 유형 | 비상업적 교육 목적', 'contest', 'KOI', 2020, '[6007,6008]', 1, 1, '#79c0ff'),
         ('KOI 2019–2018 기출 — 고등부', '소수 경로 BFS, 히스토그램 스택 유형 | 비상업적 교육 목적', 'contest', 'KOI', 2019, '[6009,6010]', 1, 1, '#a5d6ff'),
         ('KOI 전체 기출 모음', '한국정보올림피아드 2018–2023 기출 유형 10선 | 비상업적 교육 목적', 'contest', 'KOI', NULL, '[6001,6002,6003,6004,6005,6006,6007,6008,6009,6010]', 1, 1, '#0d419d'),
         ('IOI 2016–2020 기출 유형', '팰린드롬 DP, BFS, 그리디 유형 | 비상업적 교육 목적', 'contest', 'IOI', 2020, '[7003,7004,7005,7001,7002]', 1, 1, '#8957e5'),
         ('IOI 2021–2023 기출 유형', 'XOR 쿼리, 최소 경로, 단조 스택 유형 | 비상업적 교육 목적', 'contest', 'IOI', 2023, '[7006,7007,7008]', 1, 1, '#d2a8ff'),
         ('IOI 전체 기출 모음', '국제정보올림피아드 2016–2023 기출 유형 8선 | 비상업적 교육 목적', 'contest', 'IOI', NULL, '[7001,7002,7003,7004,7005,7006,7007,7008]', 1, 1, '#6e40c9')`,
        []
      );
    }

    if (await countRows('exam_sets') === 0) {
      await dbRun(
        `INSERT INTO exam_sets (title, description, duration_min, problem_ids, difficulty_avg, is_pro, company_tag, created_by)
         VALUES
         ('카카오 스타일 모의고사', '카카오 코테 유형 분석 세트', 120, '[1,2,3]', 3.5, 1, 'kakao', 1),
         ('네이버 스타일 모의고사', '네이버 코테 유형 분석 세트', 120, '[2,3,4]', 4.0, 1, 'naver', 1)`,
        []
      );
    }
  } catch (err) {
    logger.warn('⚠️ 성장 컬렉션 시드 실패:', { message: err.message });
  }
}
