import 'dotenv/config';
import { createServer } from 'http';
import { createHash } from 'crypto';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from './config/logger.js';
import { waitForDB, isConnected as mysqlConnected, getPool, run as dbRun } from './config/mysql.js';
import { resolveBootstrapConfig } from './config/bootstrap.js';
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
      } catch {}
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

async function seedGrowthCollections() {
  if (!mysqlConnected()) return;
  const pool = getPool();
  async function countRows(table) {
    const [[row]] = await pool.execute(`SELECT COUNT(*) AS cnt FROM ${table}`);
    return Number(row?.cnt ?? 0);
  }
  try {
    // profile_backgrounds has slug as unique key — INSERT IGNORE is safe
    await dbRun(
      `INSERT IGNORE INTO profile_backgrounds (slug, name, image_url, is_default, is_premium)
       VALUES
       ('default-dark', '기본 다크', '/backgrounds/bg-default.jpg', 1, 0),
       ('gradient-blue', '블루 그라데이션', 'gradient:linear-gradient(135deg,#0d1117,#0a2a4a)', 1, 0),
       ('gradient-purple', '퍼플 그라데이션', 'gradient:linear-gradient(135deg,#0d1117,#1a0a2e)', 1, 0),
       ('gradient-green', '그린 그라데이션', 'gradient:linear-gradient(135deg,#0d1117,#0a2e1a)', 1, 0)`,
      []
    );

    if (await countRows('learning_paths') === 0) {
      await dbRun(
        `INSERT INTO learning_paths (title, description, order_index, tag, icon, problem_ids)
         VALUES
         ('입력과 출력', '프로그래밍의 기초. 값을 입력받고 출력하는 방법을 배웁니다.', 1, '입출력', '📥', '[1,2]'),
         ('조건문', 'if/else를 이용해 조건에 따라 다른 동작을 만듭니다.', 2, '조건문', '🔀', '[3]'),
         ('반복문', 'for/while로 반복 작업을 처리합니다.', 3, '반복문', '🔁', '[4]')`,
        []
      );
    }

    if (await countRows('problem_sheets') === 0) {
      await dbRun(
        `INSERT INTO problem_sheets (title, description, category, contest_name, contest_year, problem_ids, is_official, created_by, thumbnail_color)
         VALUES
         ('초보자 입문 트랙', '프로그래밍을 처음 시작하는 분들을 위한 문제 모음', 'learning', NULL, NULL, '[1,2,3,4]', 1, 1, '#d2a8ff'),
         ('일반 코테 연습 A', '기초 알고리즘 2문제 · 80분', 'custom', NULL, NULL, '[1,2]', 1, 1, '#79c0ff'),
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
         ('일반 코테 연습 A', '기초 알고리즘 2문제 · 80분', 80, '[1,2]', 2.0, 0, NULL, 1),
         ('카카오 스타일 모의고사', '카카오 코테 유형 분석 세트', 120, '[1,2,3]', 3.5, 1, 'kakao', 1),
         ('네이버 스타일 모의고사', '네이버 코테 유형 분석 세트', 120, '[2,3,4]', 4.0, 1, 'naver', 1)`,
        []
      );
    }
  } catch (err) {
    logger.warn('⚠️ 성장 컬렉션 시드 실패:', { message: err.message });
  }
}
