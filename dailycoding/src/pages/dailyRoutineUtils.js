function pickLang(lang, ko, en) {
  return lang === 'ko' ? ko : en;
}

function compact(value, fallback = '') {
  return String(value || fallback).trim();
}

export function normalizeOnboardingPlan(onboardingPlan = {}) {
  const totalDays = Number(onboardingPlan?.totalDays) > 0
    ? Number(onboardingPlan.totalDays)
    : 14;

  return {
    ...onboardingPlan,
    active: Boolean(onboardingPlan?.active),
    dayNumber: Number(onboardingPlan?.dayNumber) > 0
      ? Number(onboardingPlan.dayNumber)
      : 1,
    totalDays,
    problems: Array.isArray(onboardingPlan?.problems) ? onboardingPlan.problems : [],
  };
}

function getOnboardingProgress(onboardingPlan = {}) {
  const normalized = normalizeOnboardingPlan(onboardingPlan);
  const problems = normalized.problems;
  const completed = problems.filter((problem) => Boolean(problem.solvedToday)).length;
  const remaining = Math.max(0, problems.length - completed);
  const nextProblem = problems.find((problem) => !problem.solvedToday) || problems[0] || null;

  return {
    active: normalized.active,
    completed,
    remaining,
    total: problems.length,
    nextProblem,
    dayNumber: normalized.dayNumber,
    totalDays: normalized.totalDays,
  };
}

function baseAction(overrides) {
  return {
    key: 'explore',
    title: 'Problems',
    description: 'Pick the next problem and start solving.',
    stat: '',
    reason: '',
    path: '/problems',
    color: 'var(--blue)',
    icon: 'target',
    ...overrides,
  };
}

function buildChecklist({ recoveryQueue, onboarding, reviewQueue, solvedCount, lang }) {
  const recoveryCount = Number(recoveryQueue?.count || 0);
  const reviewCount = Array.isArray(reviewQueue) ? reviewQueue.length : 0;
  return [
    {
      key: 'recovery',
      label: pickLang(lang, '오답 복구', 'Recover mistakes'),
      done: recoveryCount === 0,
      stat: recoveryCount > 0 ? `${recoveryCount}` : pickLang(lang, '완료', 'done'),
    },
    {
      key: 'onboarding',
      label: pickLang(lang, '오늘 루틴', "Today's routine"),
      done: onboarding.active ? onboarding.remaining === 0 : Number(solvedCount || 0) > 0,
      stat: onboarding.active && onboarding.total > 0
        ? `${onboarding.completed}/${onboarding.total}`
        : `${Number(solvedCount || 0)}`,
    },
    {
      key: 'review',
      label: pickLang(lang, '복습 큐', 'Review queue'),
      done: reviewCount === 0,
      stat: reviewCount > 0 ? `${reviewCount}` : pickLang(lang, '정리됨', 'clear'),
    },
  ];
}

export function buildDailyRoutine({
  todayProblem,
  recoveryQueue = {},
  onboardingPlan = {},
  battleSummary = {},
  reviewQueue = [],
  progression = null,
  solvedCount = 0,
  totalProblems = 0,
  lang = 'en',
} = {}) {
  const txt = (ko, en) => pickLang(lang, ko, en);
  const onboarding = getOnboardingProgress(onboardingPlan);
  const recoveryItems = Array.isArray(recoveryQueue.items) ? recoveryQueue.items : [];
  const pendingRecovery = recoveryItems.find((item) => item?.problemId) || null;
  const reviewCount = Array.isArray(reviewQueue) ? reviewQueue.length : 0;
  const solvedRatio = totalProblems > 0
    ? Math.round((Number(solvedCount) || 0) / totalProblems * 100)
    : 0;

  const secondary = [];
  let primary = null;

  if (pendingRecovery) {
    primary = baseAction({
      key: 'recovery',
      title: txt('지금은 오답 복구부터', 'Recover mistakes first'),
      description: compact(pendingRecovery.problemTitle, `Problem ${pendingRecovery.problemId}`),
      stat: pendingRecovery.priority === 'high' ? txt('우선 복구', 'priority') : txt(`${recoveryQueue.count || recoveryItems.length}개 대기`, `${recoveryQueue.count || recoveryItems.length} pending`),
      reason: txt('최근 오답이 남아 있어 새 문제보다 먼저 복구하는 편이 효율적입니다.', 'A recent wrong answer is unresolved, so recovery is the highest-leverage next step.'),
      path: '/recovery',
      state: {
        highlightId: pendingRecovery.submissionId,
        problemId: pendingRecovery.problemId,
        result: pendingRecovery.result,
      },
      color: 'var(--red)',
      icon: 'file',
    });
  } else if (onboarding.active && onboarding.remaining > 0 && onboarding.nextProblem?.id) {
    primary = baseAction({
      key: 'onboarding',
      title: txt('오늘 온보딩 루틴 이어가기', 'Continue today’s onboarding routine'),
      description: txt(
        `Day ${onboarding.dayNumber} / ${onboarding.totalDays} · ${onboarding.nextProblem.title}`,
        `Day ${onboarding.dayNumber} / ${onboarding.totalDays} · ${onboarding.nextProblem.title}`,
      ),
      stat: txt(`${onboarding.completed}/${onboarding.total} 완료`, `${onboarding.completed}/${onboarding.total} done`),
      reason: txt('초반 2주 루틴을 끊기지 않게 오늘 남은 문제부터 처리하세요.', 'Keep the first two-week routine moving by finishing the next onboarding problem.'),
      path: `/problems/${onboarding.nextProblem.id}`,
      color: 'var(--purple)',
      icon: 'target',
    });
  } else if (todayProblem?.id) {
    primary = baseAction({
      key: 'today-problem',
      title: txt('오늘의 추천 문제', "Today's recommended problem"),
      description: compact(todayProblem.title, `Problem ${todayProblem.id}`),
      stat: txt(`진행률 ${solvedRatio}%`, `${solvedRatio}% progress`),
      reason: txt('현재 풀이 흐름에서 바로 이어가기 좋은 문제입니다.', 'This is the most practical next problem for your current progress.'),
      path: `/problems/${todayProblem.id}`,
      color: 'var(--blue)',
      icon: 'target',
    });
  } else {
    primary = baseAction({
      key: 'explore',
      title: txt('문제 목록에서 시작하기', 'Start from the problem list'),
      description: txt('아직 추천할 풀이 기록이 부족합니다.', 'There is not enough solving history for a personalized recommendation yet.'),
      stat: txt('첫 문제 선택', 'pick first'),
      reason: txt('한 문제를 풀면 추천과 복구 루틴이 더 정확해집니다.', 'After one solve, recommendations and recovery become more useful.'),
      path: '/problems',
      color: 'var(--blue)',
      icon: 'target',
    });
  }

  if (reviewCount > 0) {
    secondary.push(baseAction({
      key: 'review',
      title: txt('복습 큐 정리', 'Clear the review queue'),
      description: txt('오래된 풀이를 다시 확인하세요.', 'Review older solved problems before they get stale.'),
      stat: txt(`${reviewCount}개 대기`, `${reviewCount} pending`),
      reason: txt('정답을 맞힌 문제도 시간이 지나면 다시 틀릴 수 있습니다.', 'Even accepted problems can become weak again over time.'),
      path: '/submissions',
      color: 'var(--orange)',
      icon: 'file',
    }));
  }

  if (progression) {
    secondary.push(baseAction({
      key: 'progression',
      title: txt('성장 보상 확인', 'Check growth rewards'),
      description: `Lv.${progression.level || 1} · ${(progression.xp || 0).toLocaleString()} XP`,
      stat: `${Math.min(100, Math.max(0, progression.progressPercent || 0))}%`,
      reason: txt('오늘 루틴의 보상 진행도를 확인하세요.', 'Check how today’s routine moves your reward progress.'),
      path: '/profile',
      color: 'var(--yellow)',
      icon: 'trophy',
    }));
  }

  secondary.push(baseAction({
    key: 'battle',
    title: txt('짧은 배틀로 실전 확인', 'Validate with a short battle'),
    description: battleSummary.total > 0
      ? txt(`최근 승률 ${battleSummary.winRate || 0}%`, `${battleSummary.winRate || 0}% recent win rate`)
      : txt('첫 실시간 매치를 시작해 보세요.', 'Start your first live match.'),
    stat: txt('실전 감각', 'match ready'),
    reason: txt('추천/복구 뒤에는 짧은 대결로 실전 감각을 확인하세요.', 'After practice or recovery, use a short duel to test match readiness.'),
    path: '/battle',
    color: 'var(--red)',
    icon: 'swords',
  }));

  return {
    primary,
    secondary: secondary.filter((item) => item.key !== primary.key).slice(0, 3),
    checklist: buildChecklist({ recoveryQueue, onboarding, reviewQueue, solvedCount, lang }),
    onboarding,
  };
}
