const FALLBACK_COLOR = 'var(--blue)';

const TIER_LABELS_KO = {
  unranked: '언랭크드', iron: '아이언', bronze: '브론즈', silver: '실버', gold: '골드',
  platinum: '플래티넘', emerald: '에메랄드', diamond: '다이아몬드',
  master: '마스터', grandmaster: '그랜드마스터', challenger: '챌린저',
};
const TIER_LABELS_EN = {
  unranked: 'Unranked', iron: 'Iron', bronze: 'Bronze', silver: 'Silver', gold: 'Gold',
  platinum: 'Platinum', emerald: 'Emerald', diamond: 'Diamond',
  master: 'Master', grandmaster: 'Grandmaster', challenger: 'Challenger',
};

function tierLabel(tier, lang) {
  if (!tier) return '';
  const key = String(tier).toLowerCase();
  return (lang === 'ko' ? TIER_LABELS_KO[key] : TIER_LABELS_EN[key]) || String(tier).toUpperCase();
}

function pickLangText(lang, ko, en) {
  return lang === 'ko' ? ko : en;
}

function compactText(value, fallback = '') {
  return String(value || fallback).trim();
}

function problemLabel(problem, lang) {
  if (!problem) return '';
  const tags = Array.isArray(problem.tags) && problem.tags.length > 0
    ? problem.tags.slice(0, 2).join(' · ')
    : '';
  const tier = tierLabel(problem.tier, lang);
  return [tier, tags].filter(Boolean).join(' · ');
}

export function buildDailyFocusPlan({
  todayProblem,
  recoveryQueue = {},
  weeklyChallenge,
  progression,
  solvedCount = 0,
  totalProblems = 0,
  lang = 'en',
} = {}) {
  const txt = (ko, en) => pickLangText(lang, ko, en);
  const cards = [];
  const recoveryItems = Array.isArray(recoveryQueue.items) ? recoveryQueue.items : [];
  const pendingRecovery = recoveryItems.find((item) => item?.problemId) || null;
  const solvedRatio = totalProblems > 0
    ? Math.round((Number(solvedCount) || 0) / totalProblems * 100)
    : 0;

  if (todayProblem?.id) {
    cards.push({
      key: 'today-problem',
      title: txt('오늘의 추천 문제', "Today's Recommended Problem"),
      description: compactText(todayProblem.title, `Problem ${todayProblem.id}`),
      stat: problemLabel(todayProblem, lang) || txt(`전체 진행률 ${solvedRatio}%`, `Overall Progress ${solvedRatio}%`),
      path: `/problems/${todayProblem.id}`,
      color: 'var(--blue)',
      icon: 'target',
    });
  }

  if (pendingRecovery) {
    cards.push({
      key: 'recovery',
      title: txt('오답 복구', 'Wrong Answer Recovery'),
      description: compactText(pendingRecovery.problemTitle, `Problem ${pendingRecovery.problemId}`),
      stat: pendingRecovery.priority === 'high' ? txt('우선 복구', 'Priority Recovery') : txt(`${recoveryQueue.count || recoveryItems.length}개 대기`, `${recoveryQueue.count || recoveryItems.length} pending`),
      path: `/problems/${pendingRecovery.problemId}`,
      color: 'var(--red)',
      icon: 'file',
    });
  } else if (weeklyChallenge?.problemId && weeklyChallenge.isSolved !== true) {
    cards.push({
      key: 'weekly-challenge',
      title: txt('주간 챌린지', 'Weekly Challenge'),
      description: compactText(weeklyChallenge.problemTitle, `Problem ${weeklyChallenge.problemId}`),
      stat: [tierLabel(weeklyChallenge.tier, lang), weeklyChallenge.difficulty ? txt(`난이도 ${weeklyChallenge.difficulty}`, `Difficulty ${weeklyChallenge.difficulty}`) : ''].filter(Boolean).join(' · '),
      path: `/problems/${weeklyChallenge.problemId}`,
      color: 'var(--purple)',
      icon: 'trophy',
    });
  } else if (progression) {
    cards.push({
      key: 'progression',
      title: txt('성장 보상 확인', 'Check Growth Rewards'),
      description: `Lv.${progression.level || 1} · ${(progression.xp || 0).toLocaleString()} XP`,
      stat: `${Math.min(100, Math.max(0, progression.progressPercent || 0))}%`,
      path: '/profile',
      color: 'var(--yellow)',
      icon: 'trophy',
    });
  }

  cards.push({
    key: 'ai-coach',
    title: txt('AI 코치', 'AI Coach'),
    description: txt('막힌 부분을 풀고 접근을 바로 리뷰하세요', 'Get unstuck and review your approach instantly'),
    stat: pendingRecovery ? txt('오답 분석', 'Wrong Answer Analysis') : txt('힌트 & 리뷰', 'Hints & Review'),
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
    title: txt('실시간 배틀', 'Live Battle'),
    description: txt('시간 압박 속에서 속도와 안정성을 테스트하세요', 'Test your speed and stability under time pressure'),
    stat: txt('실시간 매치', 'Live Match'),
    path: '/battle',
    color: 'var(--orange)',
    icon: 'swords',
  });

  return cards
    .filter((card) => card.path && card.title)
    .slice(0, 4)
    .map((card) => ({ ...card, color: card.color || FALLBACK_COLOR }));
}
