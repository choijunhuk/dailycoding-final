function pickLang(lang, ko, en) {
  return lang === 'ko' ? ko : en
}

function recentRecord(historyRows = []) {
  const recent = historyRows.slice(0, 5)
  const wins = recent.filter((row) => row.result === 'win').length
  const losses = recent.filter((row) => row.result === 'lose').length
  const draws = recent.filter((row) => row.result === 'draw').length
  return { total: recent.length, wins, losses, draws }
}

export function buildBattleLobbyCoach({
  activeBattles = [],
  historyRows = [],
  selectedBattleMode = 'race',
  selectedDuration = 900,
  lang = 'en',
} = {}) {
  const txt = (ko, en) => pickLang(lang, ko, en)
  const record = recentRecord(historyRows)

  if (activeBattles.length > 0) {
    return {
      key: 'spectate-live',
      action: 'spectate',
      title: txt('라이브 관전으로 속도 감각 보기', 'Watch a live match first'),
      description: txt('진행 중인 방이 있습니다. 바로 들어가기 전 풀이 속도와 문제 선택 흐름을 관찰하세요.', 'There are active rooms. Watch pacing and problem selection before jumping in.'),
      stat: txt(`${activeBattles.length}개 진행 중`, `${activeBattles.length} live`),
      actionLabel: txt('관전 목록 보기', 'View live rooms'),
      tone: 'info',
    }
  }

  if (record.losses >= 2) {
    return {
      key: 'rematch-loss',
      action: 'history',
      title: txt('최근 패배 복기 후 재대결', 'Review losses, then rematch'),
      description: txt(`최근 ${record.losses}번의 패배가 있습니다. 기록에서 문제와 상대를 확인하고 짧은 재대결로 복구하세요.`, `You have ${record.losses} recent losses. Review the match history and recover with a short rematch.`),
      stat: txt(`${record.wins}승 ${record.losses}패`, `${record.wins}W ${record.losses}L`),
      actionLabel: txt('기록 보기', 'Open history'),
      tone: 'danger',
    }
  }

  if (record.total >= 3 && record.wins >= 2) {
    return {
      key: 'raise-pressure',
      action: 'invite',
      title: txt('압박을 한 단계 올리기', 'Raise the pressure'),
      description: txt(
        selectedBattleMode === 'race' || selectedDuration <= 300
          ? '최근 흐름이 좋습니다. 더 긴 제한 시간이나 팀/영토전으로 난도를 올려보세요.'
          : '최근 흐름이 좋습니다. 더 어려운 상대나 빠른 모드로 압박을 올려보세요.',
        selectedBattleMode === 'race' || selectedDuration <= 300
          ? 'Your recent record is strong. Try a harder format with longer pressure or territory/team play.'
          : 'Your recent record is strong. Try a harder opponent or faster mode.',
      ),
      stat: txt(`${record.wins}/${record.total} 좋은 흐름`, `${record.wins}/${record.total} strong`),
      actionLabel: txt('초대 보내기', 'Send invite'),
      tone: 'success',
    }
  }

  return {
    key: 'first-invite',
    action: 'invite',
    title: txt('첫 1대1 대결 시작', 'Start your first 1v1'),
    description: txt('상대 이름과 언어를 고르고 짧은 배틀로 실전 감각을 확인하세요.', 'Pick an opponent and language, then use a short match to test real pressure.'),
    stat: txt('대기 중', 'ready'),
    actionLabel: txt('상대 초대', 'Invite opponent'),
    tone: 'neutral',
  }
}

export function buildAlgorithmRoomCoach({
  room = {},
  me = null,
  isSpectating = false,
  isDrafting = false,
  config = {},
  timeLeftSec = 0,
  lang = 'en',
} = {}) {
  const txt = (ko, en) => pickLang(lang, ko, en)

  if (isSpectating) {
    return {
      key: 'spectating',
      tone: 'info',
      title: txt('관전 모드', 'Spectator mode'),
      description: txt('제출, 아이템, 준비 버튼은 비활성입니다. 플레이어의 풀이 속도와 점수 변화를 보세요.', 'Submit, item, and ready actions are disabled. Watch player pacing and score changes.'),
      stat: txt('보기 전용', 'view only'),
      actionLabel: txt('라이브 분석', 'Watch flow'),
    }
  }

  if (room?.status === 'finished') {
    return {
      key: 'finished-review',
      tone: 'done',
      title: txt('결과 복기', 'Review the result'),
      description: txt(`최종 ${me?.score || 0}점입니다. 리플레이, 재대결, 오답 복구 중 다음 행동을 고르세요.`, `Final score: ${me?.score || 0}. Pick replay, rematch, or recovery as the next step.`),
      stat: txt('종료', 'finished'),
      actionLabel: txt('복기하기', 'Review'),
    }
  }

  if (isDrafting) {
    return {
      key: 'drafting',
      tone: 'warning',
      title: txt('드래프트 선택 중', 'Draft in progress'),
      description: txt('밴/픽 선택이 끝나야 문제가 확정됩니다. 상대 선택도 함께 기다리는 단계입니다.', 'The problem locks after bans and picks finish. You are waiting on both draft choices.'),
      stat: txt('전략 단계', 'strategy'),
      actionLabel: txt('선택 확인', 'Check picks'),
    }
  }

  if (room?.status === 'playing') {
    const firstCorrect = config?.winCondition === 'first-correct'
    return {
      key: firstCorrect ? 'playing-first-correct' : 'playing-score',
      tone: 'live',
      title: firstCorrect ? txt('첫 정답이 승부', 'First correct decides it') : txt('점수와 HP 관리', 'Manage score and HP'),
      description: firstCorrect
        ? txt('첫 정답 제출이 즉시 승리 조건입니다. 실행보다 제출 정확도를 우선하세요.', 'The first correct submission wins. Prioritize submission accuracy over local runs.')
        : txt('남은 시간 안에 점수, HP, 아이템 타이밍을 같이 관리하세요.', 'Manage score, HP, and item timing before time runs out.'),
      stat: timeLeftSec > 0 ? txt(`${Math.ceil(timeLeftSec / 60)}분 남음`, `${Math.ceil(timeLeftSec / 60)}m left`) : txt('진행 중', 'live'),
      actionLabel: txt('제출 준비', 'Prepare submit'),
    }
  }

  return {
    key: me?.isReady ? 'waiting-opponent' : 'waiting-ready',
    tone: me?.isReady ? 'info' : 'ready',
    title: me?.isReady ? txt('상대 준비 대기', 'Waiting for opponent') : txt('준비하고 규칙 확인', 'Ready up and check rules'),
    description: me?.isReady
      ? txt('준비는 끝났습니다. 상대가 준비하면 문제가 확정됩니다.', 'You are ready. The problem locks when the opponent is ready.')
      : txt('준비 전에 모드 규칙, 초대 코드, 언어 설정을 확인하세요.', 'Before readying up, check mode rules, invite code, and language settings.'),
    stat: me?.isReady ? txt('준비 완료', 'ready') : txt('준비 필요', 'not ready'),
    actionLabel: me?.isReady ? txt('대기', 'Wait') : txt('준비', 'Ready'),
  }
}
