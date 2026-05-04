import mysql  from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { resolveBootstrapConfig } from './bootstrap.js';
import { PROFILE_BACKGROUND_SEEDS } from './profileBackgroundSeeds.js';
import { PROBLEMS as SHARED_PROBLEMS } from '../shared/problemCatalog.js';

if (!Array.isArray(SHARED_PROBLEMS) || SHARED_PROBLEMS.length === 0) {
  throw new Error('shared/problemCatalog.js must export a non-empty PROBLEMS array');
}

// ── 연결 상태 ─────────────────────────────────────────────────────────────────
let pool      = null;
let connected = false;

// ★ 핵심 수정: 연결 완료를 기다릴 수 있는 Promise
let _resolveReady;
const readyPromise = new Promise(resolve => { _resolveReady = resolve; });

async function init() {
  if (process.env.NODE_ENV === 'test') {
    connected = false;
    pool = null;
    await initMemory();
    _resolveReady();
    return;
  }

  try {
    pool = mysql.createPool({
      host:               process.env.DB_HOST  || 'localhost',
      port:               Number(process.env.DB_PORT) || 3306,
      database:           process.env.DB_NAME  || 'dailycoding',
      user:               process.env.DB_USER  || 'dcuser',
      password:           process.env.DB_PASS  || 'dcpass1234',
      waitForConnections: true,
      connectionLimit:    10,
      connectTimeout:     5000,
      charset:            'utf8mb4',
      timezone:           '+09:00',
    });
    const conn = await pool.getConnection();
    conn.release();
    connected = true;
    console.log('✅ MySQL 연결 성공');
  } catch (err) {
    connected = false;
    pool = null;
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ [FATAL] Production 환경에서 MySQL 연결 실패 - 서버를 종료합니다:', err.message);
      process.exit(1);
    }
    console.warn('⚠️  MySQL 연결 실패 - 인메모리 모드로 동작합니다 (개발 환경 전용):', err.message);
    await initMemory();
  }
  _resolveReady();
}

export function waitForDB() { return readyPromise; }

// ── 인메모리 DB ───────────────────────────────────────────────────────────────
const MEM = {
  users: [], problems: [], problem_tags: [], problem_examples: [],
  problem_testcases: [],
  submissions: [], bookmarks: [], contests: [], contest_participants: [],
  comments: [], notifications: [], solve_logs: [], difficulty_votes: [],
  shared_submissions: [],
  weekly_challenges: [], problem_comments: [], problem_comment_likes: [],
  battle_history: [], daily_missions: [], season_rankings: [],
  user_onboarding: [], promotion_series: [],
  referrals: [], exam_sets: [], exam_attempts: [], build_problems: [],
  profile_backgrounds: [], user_backgrounds: [], problem_sheets: [], learning_paths: [],
};

function memNextId(table) {
  const rows = MEM[table] || [];
  if (rows.length === 0) return 1;
  return Math.max(...rows.map(r => r.id || 0)) + 1;
}

async function initMemory() {
  const bootstrapConfig = resolveBootstrapConfig();
  const seedUsers = [];

  if (bootstrapConfig.primaryAdmin.password) {
    seedUsers.push({
      email: bootstrapConfig.primaryAdmin.email,
      password: bootstrapConfig.primaryAdmin.password,
      username: bootstrapConfig.primaryAdmin.username,
      role: 'admin',
      tier: 'diamond',
      rating: 3000,
      streak: 60,
      solved_count: 500,
      email_verified: 1,
    });
  } else {
    console.warn('[SETUP] In-memory admin login skipped. Set ADMIN_PASSWORD or ENABLE_LOCAL_BOOTSTRAP=true for local admin access.');
  }

  if (bootstrapConfig.localBootstrapEnabled && bootstrapConfig.localTestUser) {
    seedUsers.push({
      email: bootstrapConfig.localTestUser.email,
      password: bootstrapConfig.localTestUser.password,
      username: bootstrapConfig.localTestUser.username,
      role: bootstrapConfig.localTestUser.role,
      tier: bootstrapConfig.localTestUser.tier,
      rating: bootstrapConfig.localTestUser.rating,
      streak: 3,
      solved_count: 12,
      email_verified: 1,
    });
  }

  for (let index = 0; index < seedUsers.length; index += 1) {
    const seedUser = seedUsers[index];
    const hashedPassword = await bcrypt.hash(seedUser.password, 10);
    MEM.users.push({
      id: index + 1,
      email: seedUser.email,
      password: hashedPassword,
      username: seedUser.username,
      role: seedUser.role,
      tier: seedUser.tier,
      rating: seedUser.rating,
      streak: seedUser.streak,
      solved_count: seedUser.solved_count,
      bio: '',
      join_date: '2024-01-01',
      last_login: null,
      email_verified: seedUser.email_verified,
      created_at: new Date().toISOString(),
    });
  }

  SHARED_PROBLEMS.forEach((problem) => {
    MEM.problems.push({
      id: problem.id,
      title: problem.title,
      tier: problem.tier,
      difficulty: problem.difficulty,
      time_limit: problem.timeLimit,
      mem_limit: problem.memLimit,
      description: problem.desc,
      input_desc: problem.inputDesc,
      output_desc: problem.outputDesc,
      hint: problem.hint,
      solution: '',
      solved_count: 0,
      submit_count: 0,
      author_id: MEM.users[0]?.id || null,
      visibility: 'global',
      contest_id: null,
      created_at: new Date().toISOString(),
    });
    (problem.tags || []).forEach((tag) => {
      MEM.problem_tags.push({ problem_id: problem.id, tag });
    });
    (problem.examples || []).forEach((example, i) => {
      MEM.problem_examples.push({
        id: MEM.problem_examples.length + 1,
        problem_id: problem.id,
        input_data: example.input,
        output_data: example.output,
        ord: i,
      });
    });
    (problem.testcases || []).forEach((testcase, i) => {
      MEM.problem_testcases.push({
        id: MEM.problem_testcases.length + 1,
        problem_id: problem.id,
        input_data: testcase.input,
        output_data: testcase.output,
        ord: i,
      });
    });
  });

  PROFILE_BACKGROUND_SEEDS.forEach((bg, i) => {
    MEM.profile_backgrounds.push({ id: i + 1, ...bg, is_default: 1, is_premium: 0 });
  });
}

init();

function snapshotMemory() {
  return Object.fromEntries(
    Object.entries(MEM).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))])
  );
}

function restoreMemory(snapshot) {
  for (const key of Object.keys(MEM)) {
    MEM[key] = (snapshot[key] || []).map((row) => ({ ...row }));
  }
}

// ── SQL → 인메모리 파서 ───────────────────────────────────────────────────────
function parseMem(sql, params = []) {
  sql = sql.trim();
  const up = sql.toUpperCase();

  if (up.startsWith('SELECT')) {
    if (up.includes('COUNT(*)')) {
      const tableMatch = sql.match(/FROM\s+(\w+)/i);
      if (!tableMatch) return [];
      let rows = [...(MEM[tableMatch[1]] || [])];
      if (up.includes('WHERE')) rows = applyWhere(rows, sql, params);
      return [{ cnt: rows.length }];
    }
    const tableMatch = sql.match(/FROM\s+(\w+)(?:\s+\w+)?/i);
    if (!tableMatch) return [];
    const table = tableMatch[1];
    let rows = [...(MEM[table] || [])];
    if (up.includes('WHERE')) rows = applyWhere(rows, sql, params);
    if (up.includes('ORDER BY')) {
      const m = sql.match(/ORDER BY\s+([\w.]+)\s*(ASC|DESC)?/i);
      if (m) {
        const col = m[1].split('.').pop();
        const desc = (m[2]||'').toUpperCase() === 'DESC';
        rows.sort((a,b) => desc ? (b[col]>a[col]?1:-1) : (a[col]>b[col]?1:-1));
      }
    }
    const limitM = sql.match(/LIMIT\s+(\d+)/i);
    if (limitM) rows = rows.slice(0, Number(limitM[1]));
    return rows;
  }

  if (up.startsWith('INSERT')) {
    const tableM = sql.match(/INTO\s+(\w+)/i);
    if (!tableM) return { insertId: 0 };
    const table = tableM[1];
    const colsM = sql.match(/\(([^)]+)\)\s*VALUES/i);
    if (!colsM) return { insertId: 0 };
    const cols = colsM[1].split(',').map(s => s.trim().replace(/`/g,''));
    const row = {};
    cols.forEach((col, i) => { row[col] = params[i]; });
    if (up.includes('INSERT IGNORE')) {
      const existing = MEM[table]?.find(r => cols.every((col) => r[col] === row[col]));
      if (existing) return { insertId: existing.id || 0, affectedRows: 0 };
    }
    if (up.includes('ON DUPLICATE KEY')) {
      const existing = MEM[table]?.find(r => Object.keys(row).some(k => r[k] === row[k]));
      if (existing) return { insertId: existing.id, affectedRows: 0 };
    }
    if (!row.id) row.id = memNextId(table);
    if (!row.created_at) row.created_at = new Date().toISOString();
    if (!MEM[table]) MEM[table] = [];
    MEM[table].push(row);
    return { insertId: row.id, affectedRows: 1 };
  }

  if (up.startsWith('UPDATE')) {
    const tableM = sql.match(/UPDATE\s+(\w+)/i);
    if (!tableM) return { affectedRows: 0 };
    const table = tableM[1];
    const setM = sql.match(/SET\s+(.+?)(?:\s+WHERE|$)/is);
    if (!setM) return { affectedRows: 0 };
    const setPairs = []; let paramIdx = 0;
    for (const clause of setM[1].split(',')) {
      const eqM = clause.match(/`?(\w+)`?\s*=\s*(.+)/);
      if (!eqM) continue;
      const col = eqM[1].trim(); const valStr = eqM[2].trim();
      if (valStr === '?') setPairs.push({ col, val: params[paramIdx++] });
      else if (valStr.includes('+')) setPairs.push({ col, expr:'incr', val: parseFloat(valStr.split('+')[1])||1 });
      else if (valStr.includes('CASE')) setPairs.push({ col, expr:'case' });
      else setPairs.push({ col, val: valStr.replace(/^'|'$/g,'') });
    }
    let rows = MEM[table] || [];
    if (up.includes('WHERE')) rows = rows.filter(r => matchWhere(r, sql, params.slice(paramIdx)));
    rows.forEach(row => {
      const actual = MEM[table].find(r => r.id === row.id);
      if (!actual) return;
      setPairs.forEach(({ col, val, expr }) => {
        if (expr === 'incr') actual[col] = (Number(actual[col])||0) + Number(val);
        else if (expr === 'case') actual[col] = evalCase(actual);
        else actual[col] = val;
      });
    });
    return { affectedRows: rows.length };
  }

  if (up.startsWith('DELETE')) {
    const tableM = sql.match(/FROM\s+(\w+)/i);
    if (!tableM) return { affectedRows: 0 };
    const table = tableM[1];
    const before = (MEM[table]||[]).length;
    if (up.includes('WHERE')) MEM[table] = (MEM[table]||[]).filter(r => !matchWhere(r, sql, params));
    else MEM[table] = [];
    return { affectedRows: before - (MEM[table]||[]).length };
  }
  return [];
}

function applyWhere(rows, sql, params) { return rows.filter(r => matchWhere(r, sql, params)); }

function matchWhere(row, sql, params) {
  // ★ 수정: 문자열 끝에서도 WHERE 절 캡처 (이전: $가 \s+ 뒤에 있어서 실패)
  const whereM = sql.match(/WHERE\s+(.+?)(?:\s+(?:GROUP|ORDER|LIMIT)\b|$)/is);
  if (!whereM) return true;
  let paramIdx = 0;
  return whereM[1].split(/\s+AND\s+/i).every(clause => {
    // NOT IN 서브쿼리 등 복잡한 절은 무시 (인메모리에서 지원 불가)
    const m = clause.match(/`?(\w+(?:\.\w+)?)`?\s*(=|!=|>=|<=|>|<|LIKE|IS)\s*\??/i);
    if (!m) return true;
    const col = m[1].split('.').pop(), op = m[2].toUpperCase();
    if (op === 'IS') return true; // IS NULL 등은 무시
    if (!clause.includes('?')) return true; // 값 없는 절 무시
    const val = params[paramIdx++];
    if (val === undefined) return true;
    const rv = row[col], rvStr = String(rv??''), valStr = String(val??'');
    if (op === '=')  return rvStr === valStr || rv == val;
    if (op === '!=') return rvStr !== valStr && rv != val;
    if (op === '>=') return Number(rv) >= Number(val);
    if (op === '<=') return Number(rv) <= Number(val);
    if (op === '>')  return Number(rv) >  Number(val);
    if (op === '<')  return Number(rv) <  Number(val);
    if (op === 'LIKE') return rvStr.includes(valStr.replace(/%/g,''));
    return true;
  });
}

function evalCase(row) {
  const r = row.rating || 800;
  if (r >= 16000) return 'grandmaster';
  if (r >= 15000) return 'master';
  if (r >= 13500) return 'diamond';
  if (r >= 10000) return 'emerald';
  if (r >= 6000)  return 'platinum';
  if (r >= 2800)  return 'gold';
  if (r >= 1000)  return 'silver';
  if (r >= 300)   return 'bronze';
  if (r >= 50)    return 'iron';
  return 'unranked';
}

// ── 공개 헬퍼 함수 ────────────────────────────────────────────────────────────
export async function query(sql, params = []) {
  if (connected && pool) {
    try { const [rows] = await pool.execute(sql, params); return rows; }
    catch (e) {
      if (e.code === 'ECONNREFUSED' || e.code === 'ER_ACCESS_DENIED_ERROR') connected = false;
      throw e;
    }
  }
  return parseMem(sql, params);
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return Array.isArray(rows) ? (rows[0] || null) : rows;
}

export async function insert(sql, params = []) {
  if (connected && pool) { const [result] = await pool.execute(sql, params); return result.insertId; }
  return (parseMem(sql, params)).insertId || 0;
}

export async function run(sql, params = []) {
  if (connected && pool) { const [result] = await pool.execute(sql, params); return result; }
  return parseMem(sql, params);
}

export async function transaction(callback) {
  if (connected && pool) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await callback(conn);
      await conn.commit();
      return result;
    } catch (err) {
      try {
        await conn.rollback();
      } catch {
        // Preserve the original transaction error if rollback also fails.
      }
      throw err;
    } finally {
      conn.release();
    }
  }

  const snapshot = snapshotMemory();
  const conn = {
    async beginTransaction() {},
    async query(sql, params = []) {
      return [parseMem(sql, params)];
    },
    async commit() {},
    async rollback() {
      restoreMemory(snapshot);
    },
    release() {},
  };

  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export const isConnected = () => connected;
export function getPool() { return pool; }
export async function closePool() {
  if (!pool) return;
  try {
    await pool.end();
  } catch {
    // Closing is best-effort during test and shutdown cleanup.
  }
  pool = null;
  connected = false;
}

// ★ pool을 동적 Proxy로 export (null일 때도 나중에 사용 가능)
export default new Proxy({}, {
  get(_, prop) {
    if (typeof prop === 'symbol') return undefined;
    if (prop === 'then') return undefined; // Promise 체이닝 방지
    if (!pool) return undefined;
    const val = pool[prop];
    return typeof val === 'function' ? val.bind(pool) : val;
  }
});
