function pickLang(lang, ko, en) {
  return lang === 'ko' ? ko : en;
}

export function buildAdminQualitySignals(adminStats = {}, lang = 'en') {
  const txt = (ko, en) => pickLang(lang, ko, en);
  const activeToday = Number(adminStats?.userStats?.activeToday || 0);
  const totalToday = Number(adminStats?.submissionStats?.totalToday || 0);
  const correctRate = Number(adminStats?.submissionStats?.correctRate || 0);
  const recentReviews = Array.isArray(adminStats?.recentReviews) ? adminStats.recentReviews : [];
  const pendingReviews = recentReviews.filter((review) => !['resolved', 'closed', 'done'].includes(String(review.status || '').toLowerCase())).length;
  const battleStatus = adminStats?.battleStatus || {};
  const liveBattles = Number(battleStatus.playing || 0);
  const waitingBattles = Number(battleStatus.waiting || 0);
  const signals = [];

  if (activeToday <= 0) {
    signals.push({
      key: 'activity',
      tone: 'warning',
      title: txt('오늘 활성 사용자 없음', 'No active users today'),
      stat: '0',
      description: txt('랜딩/대시보드 진입과 추천 루틴이 정상인지 확인하세요.', 'Check landing, dashboard entry, and recommendation loops.'),
    });
  } else {
    signals.push({
      key: 'activity',
      tone: 'ok',
      title: txt('오늘 활성 사용자', 'Active users today'),
      stat: activeToday.toLocaleString(),
      description: txt('오늘 제출/랭킹/커뮤니티 흐름을 이어서 확인하세요.', 'Continue watching submissions, ranking, and community flow.'),
    });
  }

  if (totalToday > 0 && correctRate < 35) {
    signals.push({
      key: 'correct-rate',
      tone: 'danger',
      title: txt('정답률 급락 확인', 'Acceptance rate needs attention'),
      stat: `${correctRate}%`,
      description: txt('최근 추가 문제, 테스트케이스, 난이도 표기를 점검하세요.', 'Check recent problems, test cases, and difficulty labels.'),
    });
  } else {
    signals.push({
      key: 'correct-rate',
      tone: 'ok',
      title: txt('오늘 정답률', 'Acceptance rate today'),
      stat: totalToday > 0 ? `${correctRate}%` : txt('제출 없음', 'no submissions'),
      description: txt('문제 품질 이상 신호는 아직 크지 않습니다.', 'No strong quality warning from today’s acceptance rate.'),
    });
  }

  signals.push({
    key: 'reviews',
    tone: pendingReviews > 0 ? 'warning' : 'ok',
    title: txt('코드 리뷰 대기', 'Code reviews'),
    stat: txt(`${pendingReviews}개 대기`, `${pendingReviews} pending`),
    description: pendingReviews > 0
      ? txt('리뷰 대기열을 줄이면 커뮤니티 신뢰도가 올라갑니다.', 'Reducing review backlog improves community trust.')
      : txt('최근 리뷰 대기열이 정리되어 있습니다.', 'Recent review queue is clear.'),
  });

  signals.push({
    key: 'battles',
    tone: liveBattles > 0 || waitingBattles > 0 ? 'ok' : 'neutral',
    title: txt('배틀 룸 상태', 'Battle room status'),
    stat: txt(`${liveBattles}개 진행 중`, `${liveBattles} live`),
    description: waitingBattles > 0
      ? txt(`${waitingBattles}개 방이 상대를 기다리는 중입니다.`, `${waitingBattles} rooms are waiting for opponents.`)
      : txt('대기 중인 방이 많지 않습니다.', 'There are not many waiting rooms.'),
  });

  return signals;
}
