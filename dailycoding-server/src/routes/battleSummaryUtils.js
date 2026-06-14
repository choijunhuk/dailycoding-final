function langText(lang, ko, en) {
  return lang === 'ko' ? ko : en;
}

export function buildBattleRecap(summary = {}, lang = 'en') {
  const recent = Array.isArray(summary.recent) ? summary.recent : [];
  const total = Number(summary.total || 0);
  const winRate = Number(summary.winRate || 0);
  const recentWins = recent.filter((item) => item?.result === 'win').length;
  const recentLosses = recent.filter((item) => item?.result === 'lose').length;

  if (total === 0 || recent.length === 0) {
    return {
      tone: 'empty',
      headline: langText(lang, '첫 배틀로 실전 감각을 열어보세요.', 'Start your first battle to unlock match feedback.'),
      nextStep: langText(lang, '추천 문제를 한 번 푼 뒤 같은 난이도로 짧게 대결해 보세요.', 'Solve one recommended problem, then try a short duel at the same level.'),
      suggestedAction: '/battle',
    };
  }

  if (winRate >= 60 || recentWins >= 2) {
    return {
      tone: 'positive',
      headline: langText(lang, '배틀 흐름이 좋습니다.', 'Momentum is on your side.'),
      nextStep: langText(lang, '최근 승리 흐름을 같은 태그 리매치로 이어가세요.', 'Carry this momentum into a same-tag rematch.'),
      suggestedAction: '/battle',
    };
  }

  if (winRate <= 35 || recentLosses >= 2) {
    return {
      tone: 'recovery',
      headline: langText(lang, '속도보다 안정성이 먼저입니다.', 'Stability should come before speed.'),
      nextStep: langText(lang, '오답 복구를 먼저 끝낸 뒤 같은 난이도로 다시 배틀하세요.', 'Clear wrong-answer recovery first, then battle again at the same level.'),
      suggestedAction: '/recovery',
    };
  }

  return {
    tone: 'steady',
    headline: langText(lang, '균형 잡힌 배틀 기록입니다.', 'Your battle record is balanced.'),
    nextStep: langText(lang, '추천 문제 하나로 워밍업하고 바로 재도전하세요.', 'Warm up with one recommended problem, then queue again.'),
    suggestedAction: '/battle',
  };
}
