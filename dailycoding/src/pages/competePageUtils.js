function pickLang(lang, ko, en) {
  return lang === 'ko' ? ko : en;
}

export function buildCompeteGuidance({ battleSummary = {}, solvedCount = 0, lang = 'en' } = {}) {
  const txt = (ko, en) => pickLang(lang, ko, en);
  const battles = Number(battleSummary.total || 0);
  const winRate = Number(battleSummary.winRate || 0);
  const solved = Number(solvedCount || 0);
  const recommendWorkshop = battles >= 20 || solved >= 70;
  const recommendTournament = !recommendWorkshop && (battles >= 8 || solved >= 25 || winRate >= 60);
  const recommendBattle = !recommendWorkshop && !recommendTournament;

  return [
    {
      key: 'battle',
      recommended: recommendBattle,
      reason: recommendBattle
        ? txt('짧은 1v1로 현재 풀이 속도와 안정성을 바로 확인하세요.', 'Start with a short 1v1 to test speed and stability.')
        : txt('감각 유지용으로 짧게 돌리기 좋습니다.', 'Good for keeping match rhythm sharp.'),
      nextLabel: txt('배틀 시작', 'Start battle'),
    },
    {
      key: 'tournament',
      recommended: recommendTournament,
      reason: recommendTournament
        ? txt('풀이 경험이 쌓였으니 브래킷 압박에서 실력을 확인할 타이밍입니다.', 'Your practice volume is ready for bracket pressure.')
        : txt('배틀 기록이 조금 더 쌓이면 토너먼트가 더 재미있어집니다.', 'Tournaments become more useful after more battle history.'),
      nextLabel: txt('토너먼트 보기', 'Open brackets'),
    },
    {
      key: 'workshop',
      recommended: recommendWorkshop,
      reason: recommendWorkshop
        ? txt('이제 기본 대결을 넘어 직접 룰을 바꿔보면 좋습니다.', 'You have enough volume to start experimenting with custom rules.')
        : txt('커스텀 룰은 배틀 흐름에 익숙해진 뒤 추천합니다.', 'Custom rules are best after the normal battle flow feels familiar.'),
      nextLabel: txt('워크샵 열기', 'Open workshop'),
    },
  ];
}
