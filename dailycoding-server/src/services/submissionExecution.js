import {
  executeJudgeRequest,
  getPublicJudgeLanguageLabel,
  isRuntimeLanguageSupported,
  normalizeJudgeLanguage,
} from './judge.js';
import { handleCorrectSubmissionMissions } from './missionService.js';
import { updateSeasonRating } from './seasonService.js';
import { claimReferralReward } from './referralService.js';

function createHttpError(status, body) {
  const err = new Error(body?.message || '요청 처리 실패');
  err.status = status;
  err.body = body;
  return err;
}

function toTimeMs(time) {
  if (!time || time === '-') return null;
  const parsed = parseInt(time, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function buildSubmitCases(problem) {
  return (problem.testcases && problem.testcases.length > 0)
    ? [...problem.examples, ...problem.testcases]
    : problem.examples || [];
}

function buildExecutableCode(problem, code) {
  const problemType = problem.problemType || problem.problem_type || 'coding';
  if (problemType !== 'build') return code;
  const starterCode = problem.starterCode || problem.starter_code || '';
  if (!starterCode) return code;
  if (starterCode.includes('// YOUR CODE HERE')) {
    return starterCode.replace('// YOUR CODE HERE', code);
  }
  return `${starterCode}\n${code}`;
}

const REQUIRED_SIDE_EFFECT_DEPS = [
  'findSolvedSubmission',
  'runQuery',
  'createSubmission',
  'incrementSubmit',
  'incrementSolved',
  'getTierPoints',
  'onSolve',
  'createNotification',
  'invalidateRanking',
  'updateRedisLeaderboard',
];

async function getDefaultDeps() {
  const [
    { queryOne, run },
    { default: redis },
    { Problem },
    { Submission },
    { User },
    { Notification },
    { Contest },
    { Reward }
  ] = await Promise.all([
    import('../config/mysql.js'),
    import('../config/redis.js'),
    import('../models/Problem.js'),
    import('../models/Submission.js'),
    import('../models/User.js'),
    import('../models/Notification.js'),
    import('../models/Contest.js'),
    import('../models/Reward.js'),
  ]);

  return {
    findSolvedSubmission: queryOne,
    runQuery: run,
    createSubmission: (payload) => Submission.create(payload),
    incrementSubmit: Problem.incrementSubmit,
    incrementSolved: Problem.incrementSolved,
    getTierPoints: User.tierPoints,
    onSolve: User.onSolve.bind(User),
    createNotification: Notification.create,
    invalidateRanking: () => redis.del('ranking:global:list'),
    updateRedisLeaderboard: (cid, uid, score) => Contest.updateRedisLeaderboard(cid, uid, score),
    grantReward: (userId, rewardCode) => Reward.grant(userId, rewardCode),
  };
}

function getCurrentWeekStartDate(date = new Date()) {
  const base = new Date(date);
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + diff);
  return base.toISOString().slice(0, 10);
}

export async function executeSubmissionFlow({
  problem,
  problemId,
  userId,
  rawLang,
  code,
  judgeRuntime,
  persist = true,
  includeHiddenCases = persist,
  customInput = null,
  userTier = 'free',
  solveTimeSec = null,
}, deps = {}) {
  const defaultDeps = !persist || REQUIRED_SIDE_EFFECT_DEPS.every((key) => key in deps)
    ? {}
    : await getDefaultDeps();
  const normalizeLanguage = deps.normalizeJudgeLanguage || normalizeJudgeLanguage;
  const runtimeSupportsLanguage = deps.isRuntimeLanguageSupported || isRuntimeLanguageSupported;
  const getDisplayLabel = deps.getPublicJudgeLanguageLabel || getPublicJudgeLanguageLabel;
  const executeJudge = deps.executeJudgeRequest || executeJudgeRequest;
  const findSolvedSubmission = deps.findSolvedSubmission || defaultDeps.findSolvedSubmission;
  const runQuery = deps.runQuery || defaultDeps.runQuery;
  const createSubmission = deps.createSubmission || defaultDeps.createSubmission;
  const incrementSubmit = deps.incrementSubmit || defaultDeps.incrementSubmit;
  const incrementSolved = deps.incrementSolved || defaultDeps.incrementSolved;
  const getTierPoints = deps.getTierPoints || defaultDeps.getTierPoints;
  const onSolve = deps.onSolve || defaultDeps.onSolve;
  const createNotification = deps.createNotification || defaultDeps.createNotification;
  const invalidateRanking = deps.invalidateRanking || defaultDeps.invalidateRanking;
  const updateRedisLeaderboard = deps.updateRedisLeaderboard || defaultDeps.updateRedisLeaderboard;
  const grantReward = deps.grantReward || defaultDeps.grantReward;
  const executionCases = customInput == null
    ? (includeHiddenCases ? buildSubmitCases(problem) : (problem.examples || []))
    : [];

  const normalizedLang = normalizeLanguage(rawLang || 'Python 3');
  if (!normalizedLang) {
    throw createHttpError(400, { message: '지원하지 않는 언어입니다.' });
  }

  if (!runtimeSupportsLanguage(judgeRuntime, normalizedLang)) {
    throw createHttpError(400, {
      message: `현재 채점 환경에서 지원하지 않는 언어입니다: ${rawLang || normalizedLang}`,
      mode: judgeRuntime.mode,
      supportedLanguages: judgeRuntime.supportedLanguages,
    });
  }

  const timeLimit = problem.timeLimit || problem.time_limit || 2;
  const execution = await executeJudge({
    judgeRuntime,
    lang: normalizedLang,
    code: buildExecutableCode(problem, code),
    cases: executionCases,
    timeLimit,
    executionMode: customInput == null ? 'judge' : 'run',
    input: customInput || '',
    userTier,
  });

  const displayLang = getDisplayLabel(normalizedLang) || rawLang || 'Python 3';
  if (!persist) {
    return {
      execution,
      normalizedLang,
      displayLang,
    };
  }

  const alreadySolved = await findSolvedSubmission(
    'SELECT 1 FROM submissions WHERE user_id=? AND problem_id=? AND result=? LIMIT 1',
    [userId, problemId, 'correct']
  );

  const timeMs = toTimeMs(execution.time);
  const submission = await createSubmission({
    userId,
    problemId: Number(problemId),
    lang: displayLang,
    code,
    result: execution.result,
    timeMs,
    memoryMb: null,
    solveTimeSec,
    detail: execution.detail,
  });

  await incrementSubmit(Number(problemId));

  if (execution.result === 'correct') {
    if (!alreadySolved) {
      const earnedPts = getTierPoints(problem.tier || 'bronze');
      await Promise.all([
        incrementSolved(Number(problemId)),
        onSolve(userId, problem),
        createNotification(userId, `🎉 "${problem.title}" 정답! +${earnedPts}점`, 'submissions'),
        invalidateRanking(),
        handleCorrectSubmissionMissions(userId),
        updateSeasonRating(userId, earnedPts),
        claimReferralReward(userId),
      ]);
    }

    // CONTEST LEADERBOARD OPTIMIZATION (T3)
    const contestId = problem.contestId || problem.contest_id;
    if (contestId) {
      const participation = await findSolvedSubmission(
        'SELECT joined_at, score FROM contest_participants WHERE contest_id=? AND user_id=?',
        [contestId, userId]
      );
      if (participation) {
        // Prevent double scoring in this contest: check if solved after joining but before this submission
        const alreadyInContest = await findSolvedSubmission(
          'SELECT 1 FROM submissions WHERE user_id=? AND problem_id=? AND result=? AND submitted_at >= ? AND id < ? LIMIT 1',
          [userId, problemId, 'correct', participation.joined_at, submission.id]
        );
        if (!alreadyInContest) {
          await runQuery('UPDATE contest_participants SET score = score + 1 WHERE contest_id=? AND user_id=?', [contestId, userId]);
          const updatedParticipation = await findSolvedSubmission('SELECT score FROM contest_participants WHERE contest_id=? AND user_id=?', [contestId, userId]);
          if (updatedParticipation) {
            await updateRedisLeaderboard(contestId, userId, updatedParticipation.score);
          }
        }
      }
    }

    const weeklyChallenge = await findSolvedSubmission(
      'SELECT problem_id, reward_code FROM weekly_challenges WHERE week_start = ?',
      [getCurrentWeekStartDate()]
    );
    if (weeklyChallenge && Number(weeklyChallenge.problem_id) === Number(problemId)) {
      await grantReward(userId, weeklyChallenge.reward_code);
    }
  }

  return {
    execution,
    normalizedLang,
    displayLang,
    submission,
  };
}
