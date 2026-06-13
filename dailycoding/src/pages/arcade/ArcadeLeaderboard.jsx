import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api.js'
import { useLang } from '../../context/LangContext.jsx'
import { getTierLabel } from '../../utils/labelMaps.js'

const TIME_METRIC_GAMES = new Set([
  'tetris', 'code-typing', 'code-wordle', 'memory-match', 'fifteen', 'minesweeper',
])

function fmtTime(sec) {
  const s = Number(sec) || 0
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`
  const m = Math.floor(s / 60)
  const r = Math.round(s - m * 60)
  return `${m}m ${r.toString().padStart(2, '0')}s`
}

export default function ArcadeLeaderboard({ gameKey, version }) {
  const { lang } = useLang()
  const txt = (ko, en) => (lang === 'ko' ? ko : en)
  const supportsTime = TIME_METRIC_GAMES.has(gameKey)
  const [metric, setMetric] = useState('score')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supportsTime && metric === 'time') setMetric('score')
  }, [supportsTime, metric])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    api.get(`/arcade/leaderboard/${gameKey}`, { params: { limit: 50, metric } })
      .then(({ data }) => { if (!cancelled) setRows(data?.leaderboard || []) })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message || txt('랭킹을 불러오지 못했습니다.', 'Failed to load ranking.'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [gameKey, version, metric])

  return (
    <div className="arcade-lb card card-pad">
      <div className="arcade-lb-head">
        <h2>{txt('Top 50', 'Top 50')}</h2>
        {supportsTime && (
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
      {error && <div className="arcade-alert"><span>{error}</span></div>}
      {!loading && rows.length === 0 && (
        <div className="arcade-empty">
          {metric === 'time'
            ? txt('이 게임의 타임 랭킹 기록이 아직 없습니다.', 'No time records yet for this game.')
            : txt('아직 점수가 없습니다. 첫 번째 기록을 남겨보세요!', 'No scores yet — be the first!')}
        </div>
      )}
      {rows.length > 0 && (
        <table className="arcade-lb-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>#</th>
              <th>{txt('유저', 'User')}</th>
              <th>{txt('티어', 'Tier')}</th>
              <th style={{ textAlign: 'right' }}>
                {metric === 'time' ? txt('시간', 'Time') : txt('점수', 'Score')}
              </th>
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
                  {metric === 'time' ? fmtTime(row.elapsedSec) : row.score}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
