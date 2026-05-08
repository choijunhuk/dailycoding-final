import { insert, query, queryOne, run } from '../config/mysql.js';
import { nowMySQL } from '../config/dateutil.js';

const JSON_FIELDS = [
  'initial_files',
  'visible_tests',
  'hidden_tests',
  'allowed_files',
  'forbidden_patterns',
  'scoring_rules',
  'submitted_files',
  'detail_json',
];

export const TROUBLESHOOTING_TYPES = new Set(['troubleshooting', 'performance-fix', 'refactor-fix']);

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeFiles(value) {
  const raw = Array.isArray(value?.files) ? value.files : Array.isArray(value) ? value : [];
  return raw
    .map((file) => ({
      path: String(file?.path || '').trim(),
      content: String(file?.content ?? ''),
      editable: file?.editable !== false,
    }))
    .filter((file) => file.path);
}

function normalizeTests(value) {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .map((test, index) => ({
      name: String(test?.name || `test-${index + 1}`).trim(),
      command: Array.isArray(test?.command)
        ? test.command.map((part) => String(part)).filter(Boolean)
        : String(test?.command || '').trim(),
      input: String(test?.input ?? ''),
      expectedOutput: test?.expectedOutput == null ? null : String(test.expectedOutput),
      timeoutMs: Number.isFinite(Number(test?.timeoutMs)) ? Number(test.timeoutMs) : null,
    }))
    .filter((test) => Array.isArray(test.command) ? test.command.length > 0 : test.command);
}

export function normalizeTroubleshootingConfig(input = {}) {
  const initialFiles = normalizeFiles(input.initialFiles ?? input.initial_files ?? []);
  const allowedFiles = Array.isArray(input.allowedFiles ?? input.allowed_files)
    ? (input.allowedFiles ?? input.allowed_files).map((item) => String(item || '').trim()).filter(Boolean)
    : initialFiles.filter((file) => file.editable).map((file) => file.path);

  const forbiddenPatterns = Array.isArray(input.forbiddenPatterns ?? input.forbidden_patterns)
    ? (input.forbiddenPatterns ?? input.forbidden_patterns).map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  const scoringRules = input.scoringRules ?? input.scoring_rules;
  return {
    scenarioTitle: String(input.scenarioTitle ?? input.scenario_title ?? '').trim(),
    scenarioDescription: String(input.scenarioDescription ?? input.scenario_description ?? '').trim(),
    initialFiles,
    visibleTests: normalizeTests(input.visibleTests ?? input.visible_tests ?? []),
    hiddenTests: normalizeTests(input.hiddenTests ?? input.hidden_tests ?? []),
    performanceLimitMs: Number.isFinite(Number(input.performanceLimitMs ?? input.performance_limit_ms))
      ? Number(input.performanceLimitMs ?? input.performance_limit_ms)
      : null,
    memoryLimitMb: Number.isFinite(Number(input.memoryLimitMb ?? input.memory_limit_mb))
      ? Number(input.memoryLimitMb ?? input.memory_limit_mb)
      : null,
    targetResponseTimeMs: Number.isFinite(Number(input.targetResponseTimeMs ?? input.target_response_time_ms))
      ? Number(input.targetResponseTimeMs ?? input.target_response_time_ms)
      : null,
    baselineTimeMs: Number.isFinite(Number(input.baselineTimeMs ?? input.baseline_time_ms))
      ? Number(input.baselineTimeMs ?? input.baseline_time_ms)
      : null,
    allowedFiles,
    forbiddenPatterns,
    scoringRules: scoringRules && typeof scoringRules === 'object' ? scoringRules : {
      correctness: 50,
      performance: 30,
      readability: 20,
    },
    evaluationMode: String(input.evaluationMode ?? input.evaluation_mode ?? 'command').trim() || 'command',
  };
}

function normalizeConfigRow(row, { includeHidden = false } = {}) {
  if (!row) return null;
  const parsed = { ...row };
  for (const field of JSON_FIELDS) {
    if (field in parsed) parsed[field] = parseJson(parsed[field], field === 'detail_json' ? null : []);
  }
  const payload = {
    problemId: Number(parsed.problem_id),
    scenarioTitle: parsed.scenario_title || '',
    scenarioDescription: parsed.scenario_description || '',
    initialFiles: normalizeFiles(parsed.initial_files),
    visibleTests: normalizeTests(parsed.visible_tests),
    hiddenTests: includeHidden ? normalizeTests(parsed.hidden_tests) : undefined,
    hiddenTestCount: normalizeTests(parsed.hidden_tests).length,
    performanceLimitMs: parsed.performance_limit_ms ?? null,
    memoryLimitMb: parsed.memory_limit_mb ?? null,
    targetResponseTimeMs: parsed.target_response_time_ms ?? null,
    baselineTimeMs: parsed.baseline_time_ms ?? null,
    allowedFiles: Array.isArray(parsed.allowed_files) ? parsed.allowed_files : [],
    forbiddenPatterns: Array.isArray(parsed.forbidden_patterns) ? parsed.forbidden_patterns : [],
    scoringRules: parsed.scoring_rules || { correctness: 50, performance: 30, readability: 20 },
    evaluationMode: parsed.evaluation_mode || 'command',
    createdAt: parsed.created_at || null,
    updatedAt: parsed.updated_at || null,
  };
  if (!includeHidden) delete payload.hiddenTests;
  return payload;
}

function normalizeSubmissionRow(row) {
  if (!row) return null;
  const detail = parseJson(row.detail_json, null);
  return {
    id: row.id,
    submissionId: row.submission_id ?? null,
    userId: row.user_id,
    problemId: row.problem_id,
    submittedFiles: parseJson(row.submitted_files, []),
    result: row.result,
    totalScore: Number(row.total_score || 0),
    correctnessScore: Number(row.correctness_score || 0),
    performanceScore: Number(row.performance_score || 0),
    readabilityScore: Number(row.readability_score || 0),
    testPassCount: Number(row.test_pass_count || 0),
    totalTestCount: Number(row.total_test_count || 0),
    executionTimeMs: row.execution_time_ms == null ? null : Number(row.execution_time_ms),
    memoryUsedMb: row.memory_used_mb == null ? null : Number(row.memory_used_mb),
    changedFilesCount: Number(row.changed_files_count || 0),
    improvementRate: row.improvement_rate == null ? null : Number(row.improvement_rate),
    feedback: row.feedback || '',
    detail,
    submittedAt: row.submitted_at,
  };
}

export const TroubleshootingProblem = {
  isTroubleshootingType(problemType) {
    return TROUBLESHOOTING_TYPES.has(problemType || '');
  },

  async findConfig(problemId, { includeHidden = false } = {}) {
    const row = await queryOne('SELECT * FROM troubleshooting_problem_configs WHERE problem_id = ?', [Number(problemId)]);
    return normalizeConfigRow(row, { includeHidden });
  },

  async upsertConfig(problemId, input = {}) {
    const normalized = normalizeTroubleshootingConfig(input);
    if (!normalized.scenarioTitle) {
      const err = new Error('시나리오 제목은 필수입니다.');
      err.status = 400;
      throw err;
    }
    if (normalized.initialFiles.length === 0) {
      const err = new Error('최소 1개 이상의 초기 파일이 필요합니다.');
      err.status = 400;
      throw err;
    }

    const existing = await queryOne('SELECT problem_id FROM troubleshooting_problem_configs WHERE problem_id = ?', [Number(problemId)]);
    const params = [
      normalized.scenarioTitle,
      normalized.scenarioDescription,
      JSON.stringify(normalized.initialFiles),
      JSON.stringify(normalized.visibleTests),
      JSON.stringify(normalized.hiddenTests),
      normalized.performanceLimitMs,
      normalized.memoryLimitMb,
      normalized.targetResponseTimeMs,
      normalized.baselineTimeMs,
      JSON.stringify(normalized.allowedFiles),
      JSON.stringify(normalized.forbiddenPatterns),
      JSON.stringify(normalized.scoringRules),
      normalized.evaluationMode,
    ];

    if (existing) {
      await run(
        `UPDATE troubleshooting_problem_configs
         SET scenario_title=?, scenario_description=?, initial_files=?, visible_tests=?, hidden_tests=?,
             performance_limit_ms=?, memory_limit_mb=?, target_response_time_ms=?, baseline_time_ms=?,
             allowed_files=?, forbidden_patterns=?, scoring_rules=?, evaluation_mode=?, updated_at=?
         WHERE problem_id=?`,
        [...params, nowMySQL(), Number(problemId)]
      );
    } else {
      await insert(
        `INSERT INTO troubleshooting_problem_configs
         (problem_id, scenario_title, scenario_description, initial_files, visible_tests, hidden_tests,
          performance_limit_ms, memory_limit_mb, target_response_time_ms, baseline_time_ms,
          allowed_files, forbidden_patterns, scoring_rules, evaluation_mode, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [Number(problemId), ...params, nowMySQL(), nowMySQL()]
      );
    }

    return this.findConfig(problemId, { includeHidden: true });
  },

  async deleteConfig(problemId) {
    await run('DELETE FROM troubleshooting_problem_configs WHERE problem_id = ?', [Number(problemId)]);
  },

  async createSubmission({
    userId,
    problemId,
    submissionId = null,
    submittedFiles,
    evaluation,
  }) {
    const id = await insert(
      `INSERT INTO troubleshooting_submissions
       (user_id, problem_id, submission_id, submitted_files, result, total_score, correctness_score,
        performance_score, readability_score, test_pass_count, total_test_count, execution_time_ms,
        memory_used_mb, changed_files_count, improvement_rate, feedback, detail_json, submitted_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        userId,
        Number(problemId),
        submissionId,
        JSON.stringify(submittedFiles || []),
        evaluation.result || 'wrong',
        evaluation.totalScore || 0,
        evaluation.correctnessScore || 0,
        evaluation.performanceScore || 0,
        evaluation.readabilityScore || 0,
        evaluation.testPassCount || 0,
        evaluation.totalTestCount || 0,
        evaluation.executionTimeMs ?? null,
        evaluation.memoryUsedMb ?? null,
        evaluation.changedFilesCount || 0,
        evaluation.improvementRate ?? null,
        evaluation.feedback || '',
        JSON.stringify(evaluation),
        nowMySQL(),
      ]
    );
    return this.findSubmissionById(id);
  },

  async findSubmissionById(id) {
    const row = await queryOne('SELECT * FROM troubleshooting_submissions WHERE id = ?', [Number(id)]);
    return normalizeSubmissionRow(row);
  },

  async findCorrectSubmission(userId, problemId) {
    return queryOne(
      'SELECT id FROM troubleshooting_submissions WHERE user_id = ? AND problem_id = ? AND result = ? LIMIT 1',
      [userId, Number(problemId), 'correct']
    );
  },

  async listSubmissions(userId, problemId, { limit = 20 } = {}) {
    const cap = Math.min(100, Math.max(1, Number(limit) || 20));
    const rows = await query(
      `SELECT * FROM troubleshooting_submissions
       WHERE user_id = ? AND problem_id = ?
       ORDER BY submitted_at DESC
       LIMIT ${cap}`,
      [userId, Number(problemId)]
    );
    return (rows || []).map(normalizeSubmissionRow);
  },
};
