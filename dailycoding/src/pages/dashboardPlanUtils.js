const FALLBACK_COLOR = 'var(--blue)';

function compactText(value, fallback = '') {
  return String(value || fallback).trim();
}

function problemLabel(problem) {
  if (!problem) return '';
  const tags = Array.isArray(problem.tags) && problem.tags.length > 0
    ? problem.tags.slice(0, 2).join(' · ')
    : '';
  const tier = compactText(problem.tier);
  return [tier, tags].filter(Boolean).join(' · ');
}

export function buildDailyFocusPlan({
  todayProblem,
  recoveryQueue = {},
  weeklyChallenge,
  progression,
  solvedCount = 0,
  totalProblems = 0,
} = {}) {
  const cards = [];
  const recoveryItems = Array.isArray(recoveryQueue.items) ? recoveryQueue.items : [];
  const pendingRecovery = recoveryItems.find((item) => item?.problemId) || null;
  const solvedRatio = totalProblems > 0
    ? Math.round((Number(solvedCount) || 0) / totalProblems * 100)
    : 0;

  if (todayProblem?.id) {
    cards.push({
      key: 'today-problem',
      title: '오늘의 추천 문제',
      description: compactText(todayProblem.title, `문제 ${todayProblem.id}`),
      stat: problemLabel(todayProblem) || `전체 진행률 ${solvedRatio}%`,
      path: `/problems/${todayProblem.id}`,
      color: 'var(--blue)',
      icon: 'target',
    });
  }

  if (pendingRecovery) {
    cards.push({
      key: 'recovery',
      title: '오답 복구',
      description: compactText(pendingRecovery.problemTitle, `문제 ${pendingRecovery.problemId}`),
      stat: pendingRecovery.priority === 'high' ? '우선 복구' : `${recoveryQueue.count || recoveryItems.length}개 대기`,
      path: `/problems/${pendingRecovery.problemId}`,
      color: 'var(--red)',
      icon: 'file',
    });
  } else if (weeklyChallenge?.problemId && weeklyChallenge.isSolved !== true) {
    cards.push({
      key: 'weekly-challenge',
      title: '주간 챌린지',
      description: compactText(weeklyChallenge.problemTitle, `문제 ${weeklyChallenge.problemId}`),
      stat: [weeklyChallenge.tier, weeklyChallenge.difficulty ? `난이도 ${weeklyChallenge.difficulty}` : ''].filter(Boolean).join(' · '),
      path: `/problems/${weeklyChallenge.problemId}`,
      color: 'var(--purple)',
      icon: 'trophy',
    });
  } else if (progression) {
    cards.push({
      key: 'progression',
      title: '성장 보상 확인',
      description: `Lv.${progression.level || 1} · ${(progression.xp || 0).toLocaleString()} XP`,
      stat: `${Math.min(100, Math.max(0, progression.progressPercent || 0))}%`,
      path: '/profile',
      color: 'var(--yellow)',
      icon: 'trophy',
    });
  }

  cards.push({
    key: 'ai-coach',
    title: 'AI 코치',
    description: '막힌 풀이와 복습 방향을 바로 점검',
    stat: pendingRecovery ? '오답 분석 추천' : '힌트 · 리뷰',
    path: pendingRecovery ? '/submissions' : '/ai',
    state: pendingRecovery ? {
      scope: 'me',
      result: pendingRecovery.result,
      highlightId: pendingRecovery.submissionId,
      autoCoach: true,
    } : undefined,
    color: 'var(--green)',
    icon: 'bot',
  });

  cards.push({
    key: 'battle',
    title: '실전 배틀',
    description: '제한 시간 안에서 풀이 속도와 안정성 점검',
    stat: '라이브 대결',
    path: '/battle',
    color: 'var(--orange)',
    icon: 'swords',
  });

  return cards
    .filter((card) => card.path && card.title)
    .slice(0, 4)
    .map((card) => ({ ...card, color: card.color || FALLBACK_COLOR }));
}
