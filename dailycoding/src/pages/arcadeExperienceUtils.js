const QUICK_GAME_KEYS = ['code-typing', 'bigo-quiz', 'output-guess', 'snake']
const TIME_METRICS = {
  tetris: { sprint: 'time', classic: 'survival', invisible: 'survival' },
  minesweeper: { easy: 'time', medium: 'time', hard: 'time' },
}

function pickLang(lang, ko, en) {
  return lang === 'ko' ? ko : en
}

export function formatGoalElapsed(sec) {
  const s = Math.max(0, Number(sec) || 0)
  if (s < 60) return `${s.toFixed(s < 10 && s > 0 ? 1 : 0)}s`
  const m = Math.floor(s / 60)
  const r = Math.round(s - m * 60)
  return `${m}m ${String(r).padStart(2, '0')}s`
}

function gameName(game, lang) {
  if (!game) return ''
  return lang === 'ko' ? (game.nameKo || game.name || game.key) : (game.name || game.nameKo || game.key)
}

export function buildArcadeRecommendations({ games = [], bestByGame = {}, topByGame = {}, lang = 'en' } = {}) {
  const txt = (ko, en) => pickLang(lang, ko, en)
  const safeGames = Array.isArray(games) ? games : []
  const recs = []
  const bestEntry = Object.entries(bestByGame || {})
    .map(([key, value]) => ({ key, best: Number(value?.best || 0), plays: Number(value?.plays || 0) }))
    .filter((entry) => entry.best > 0 || entry.plays > 0)
    .sort((a, b) => b.best - a.best || b.plays - a.plays)[0]

  if (bestEntry) {
    const game = safeGames.find((item) => item.key === bestEntry.key)
    recs.push({
      key: 'continue-best',
      gameKey: bestEntry.key,
      title: txt('최고 기록 갱신하기', 'Beat your best'),
      description: txt(`${gameName(game, lang)}에서 가장 좋은 흐름이 있습니다.`, `${gameName(game, lang)} is your strongest current game.`),
      stat: txt(`최고 ${bestEntry.best}`, `best ${bestEntry.best}`),
      actionLabel: txt('도전', 'Play'),
    })
  }

  const quickGame = safeGames.find((game) => QUICK_GAME_KEYS.includes(game.key)) || safeGames[0]
  if (quickGame) {
    recs.push({
      key: 'quick-run',
      gameKey: quickGame.key,
      title: txt('1분 워밍업', 'One-minute warmup'),
      description: txt('긴 문제풀이 전에 손과 집중력을 짧게 깨우세요.', 'Wake up your hands and focus before a longer solve.'),
      stat: gameName(quickGame, lang),
      actionLabel: txt('바로 플레이', 'Quick play'),
    })
  }

  const topEntry = Object.entries(topByGame || {})
    .find(([, rows]) => Array.isArray(rows) && rows.length > 0)
  if (topEntry) {
    const [gameKey, rows] = topEntry
    const game = safeGames.find((item) => item.key === gameKey)
    recs.push({
      key: 'leaderboard-chase',
      gameKey,
      title: txt('랭킹 추격', 'Chase the leaderboard'),
      description: txt(`${rows[0].username}의 기록을 보고 목표를 잡으세요.`, `Use ${rows[0].username}'s score as the target.`),
      stat: gameName(game, lang),
      actionLabel: txt('랭킹 보기', 'View ranking'),
      tab: 'leaderboard',
    })
  }

  return recs.slice(0, 3)
}

function resultMetric(gameKey, meta = {}) {
  return TIME_METRICS[gameKey]?.[meta.mode] || 'score'
}

export function buildArcadeResultGoal({ gameKey, result = {}, lang = 'en' } = {}) {
  const txt = (ko, en) => pickLang(lang, ko, en)
  const meta = result.meta || {}
  const metric = resultMetric(gameKey, meta)

  if (metric === 'time') {
    const elapsed = Number(meta.elapsed ?? meta.seconds ?? 0)
    const target = Math.max(1, Math.floor(elapsed * 0.96))
    return {
      key: 'shave-time',
      title: txt('다음 목표: 시간 줄이기', 'Next target: shave time'),
      description: txt('같은 모드에서 실수 하나만 줄여도 기록이 바로 좋아집니다.', 'In the same mode, removing one mistake can immediately improve the run.'),
      target: formatGoalElapsed(target),
    }
  }

  if (metric === 'survival') {
    const elapsed = Number(meta.elapsed ?? meta.seconds ?? 0)
    const target = elapsed + 5
    return {
      key: 'survive-longer',
      title: txt('다음 목표: 5초 더 버티기', 'Next target: survive 5s longer'),
      description: txt('큰 전략보다 한 번 더 침착하게 버티는 것이 다음 기록입니다.', 'The next record is one calmer survival window, not a big strategy change.'),
      target: formatGoalElapsed(target),
    }
  }

  const best = Number(result.best || 0)
  const current = Number(result.score || 0)
  const target = Math.max(best, current) + 1
  return {
    key: 'beat-score',
    title: best > 0 ? txt('다음 목표: 최고점 넘기기', 'Next target: beat your best') : txt('다음 목표: 첫 기준점 만들기', 'Next target: set a benchmark'),
    description: txt('다음 한 판은 점수보다 한 단계 높은 기준을 만드는 데 집중하세요.', 'Use the next run to create a slightly higher benchmark.'),
    target: target.toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US'),
  }
}
