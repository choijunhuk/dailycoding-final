import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../../api.js'
import { useLang } from '../../context/LangContext.jsx'
import { getTierLabel } from '../../utils/labelMaps.js'

const TIME_METRIC_GAMES = new Set([
  'tetris', 'code-typing', 'code-wordle', 'memory-match', 'fifteen', 'minesweeper',
])

// Mirror of MODE_GAMES on the server. Each mode declares its scoring metric;
// the UI auto-switches the leaderboard to match — manual metric toggle is
// hidden for moded games to keep mode meaning unambiguous.
const MODE_GAMES = {
  tetris: [
    { key: 'classic',   name: 'Classic',   nameKo: '클래식',     metric: 'survival', desc: '얼마나 오래 버텼는지 — 생존 시간 랭킹.', descEn: 'Longest survival time wins.' },
    { key: 'sprint',    name: 'Sprint 40', nameKo: '스프린트 40', metric: 'time',     desc: '40줄 가장 빠르게 클리어.',              descEn: 'Fastest 40-line clear wins.' },
    { key: 'ultra',     name: 'Ultra 2m',  nameKo: '울트라 2분',  metric: 'score',    desc: '2분 안에 최고 점수.',                   descEn: 'Highest score in 2 minutes wins.' },
    { key: 'invisible', name: 'Invisible', nameKo: '인비저블',   metric: 'survival', desc: '블록이 사라지는 모드에서 가장 오래.',  descEn: 'Longest survival in invisible mode.' },
  ],
  minesweeper: [
    { key: 'easy',   name: 'Easy 9x9',     nameKo: '이지 9x9',    metric: 'time', desc: '9x9 / 지뢰 10. 클리어 최단 시간.',  descEn: '9x9 / 10 mines. Fastest clear wins.' },
    { key: 'medium', name: 'Medium 16x16', nameKo: '미디엄 16x16', metric: 'time', desc: '16x16 / 지뢰 40. 클리어 최단 시간.', descEn: '16x16 / 40 mines. Fastest clear wins.' },
    { key: 'hard',   name: 'Hard 30x16',   nameKo: '하드 30x16',   metric: 'time', desc: '30x16 / 지뢰 99. 클리어 최단 시간.', descEn: '30x16 / 99 mines. Fastest clear wins.' },
  ],
  '2048': [
    { key: 'classic',     name: 'Classic',        nameKo: '클래식',       metric: 'score', desc: '무제한. 최고 점수까지 도달.',  descEn: 'No timer. Reach the highest score.' },
    { key: 'time-attack', name: 'Time Attack 3m', nameKo: '타임어택 3분', metric: 'score', desc: '3분 안에 최대한 높은 점수.',    descEn: 'Highest score in 3 minutes wins.' },
  ],
}

function fmtTime(sec) {
  const s = Number(sec) || 0
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`
  const m = Math.floor(s / 60)
  const r = Math.round(s - m * 60)
  return `${m}m ${r.toString().padStart(2, '0')}s`
}

function metricLabel(metric, lang) {
  if (metric === 'time') return lang === 'ko' ? '시간' : 'Time'
  if (metric === 'survival') return lang === 'ko' ? '버틴 시간' : 'Survived'
  return lang === 'ko' ? '점수' : 'Score'
}

export default function ArcadeLeaderboard({ gameKey, version }) {
  const { lang } = useLang()
  const txt = (ko, en) => (lang === 'ko' ? ko : en)
  const modes = useMemo(() => MODE_GAMES[gameKey] || null, [gameKey])
  const supportsTime = TIME_METRIC_GAMES.has(gameKey)
  const [searchParams, setSearchParams] = useSearchParams()

  const urlMode = searchParams.get('mode')
  const initialMode = (modes && urlMode && modes.find((m) => m.key === urlMode)) ? urlMode : (modes ? modes[0].key : null)
  const initialMetric = modes
    ? (modes.find((m) => m.key === initialMode)?.metric || modes[0].metric)
    : 'score'

  const [mode, setMode] = useState(initialMode)
  const [metric, setMetric] = useState(initialMetric)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Reset mode when the game changes.
  useEffect(() => {
    if (modes) {
      const m = (urlMode && modes.find((x) => x.key === urlMode)) ? modes.find((x) => x.key === urlMode) : modes[0]
      setMode(m.key)
      setMetric(m.metric)
    } else {
      setMode(null)
      setMetric('score')
    }
  }, [gameKey, modes, urlMode])

  useEffect(() => {
    if (!supportsTime && metric === 'time') setMetric('score')
  }, [supportsTime, metric])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const params = { limit: 50, metric }
    if (mode) params.mode = mode
    api.get(`/arcade/leaderboard/${gameKey}`, { params })
      .then(({ data }) => { if (!cancelled) setRows(data?.leaderboard || []) })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message || txt('랭킹을 불러오지 못했습니다.', 'Failed to load ranking.'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [gameKey, version, metric, mode])

  function selectMode(m) {
    setMode(m.key)
    setMetric(m.metric)
    // Sync to URL so a tab can be linked. Use replace so back-button isn't polluted.
    const next = new URLSearchParams(searchParams)
    next.set('mode', m.key)
    setSearchParams(next, { replace: true })
  }

  const activeMode = modes ? modes.find((m) => m.key === mode) : null
  const activeDesc = activeMode ? txt(activeMode.desc, activeMode.descEn) : null

  return (
    <div className="arcade-lb card card-pad">
      <div className="arcade-lb-head">
        <h2>{txt('Top 50', 'Top 50')}</h2>
        {modes && (
          <div className="arcade-metric-tabs" role="tablist">
            {modes.map((m) => (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={mode === m.key}
                className={`arcade-metric-tab${mode === m.key ? ' active' : ''}`}
                onClick={() => selectMode(m)}
              >
                {txt(m.nameKo, m.name)}
              </button>
            ))}
          </div>
        )}
        {!modes && supportsTime && (
          <div className="arcade-metric-tabs">
            <button
              type="button"
              className={`arcade-metric-tab${metric === 'score' ? ' active' : ''}`}
              onClick={() => setMetric('score')}
            >
              {txt('점수', 'Score')}
            </button>
            <button
              type="button"
              className={`arcade-metric-tab${metric === 'time' ? ' active' : ''}`}
              onClick={() => setMetric('time')}
            >
              {txt('타임', 'Time')}
            </button>
          </div>
        )}
        {loading && <span>{txt('불러오는 중...', 'Loading...')}</span>}
      </div>
      {activeDesc && (
        <div className="arcade-lb-mode-desc">{activeDesc}</div>
      )}
      {error && <div className="arcade-alert"><span>{error}</span></div>}
      {!loading && rows.length === 0 && (
        <div className="arcade-empty">
          {metric === 'time' && txt('이 모드의 타임 랭킹 기록이 아직 없습니다.', 'No time records yet for this mode.')}
          {metric === 'survival' && txt('이 모드의 생존 기록이 아직 없습니다.', 'No survival records yet for this mode.')}
          {metric === 'score' && txt('아직 점수가 없습니다. 첫 번째 기록을 남겨보세요!', 'No scores yet — be the first!')}
        </div>
      )}
      {rows.length > 0 && (
        <table className="arcade-lb-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>#</th>
              <th>{txt('유저', 'User')}</th>
              <th>{txt('티어', 'Tier')}</th>
              <th style={{ textAlign: 'right' }}>{metricLabel(metric, lang)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.userId} className={row.rank <= 3 ? `top-${row.rank}` : ''}>
                <td>{row.rank}</td>
                <td>
                  <Link to={`/user/${row.userId}`} className="arcade-lb-user-link">
                    {row.username}
                  </Link>
                </td>
                <td>{getTierLabel(row.tier, lang) || row.tier}</td>
                <td style={{ textAlign: 'right', fontFamily: 'Space Mono, monospace', fontWeight: 700 }}>
                  {(metric === 'time' || metric === 'survival') ? fmtTime(row.elapsedSec) : row.score}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
