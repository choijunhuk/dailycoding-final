import { useEffect, useState } from 'react'
import api from '../../api.js'
import { useLang } from '../../context/LangContext.jsx'
import { getTierLabel } from '../../utils/labelMaps.js'

export default function ArcadeLeaderboard({ gameKey, version }) {
  const { lang } = useLang()
  const txt = (ko, en) => (lang === 'ko' ? ko : en)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    api.get(`/arcade/leaderboard/${gameKey}`, { params: { limit: 50 } })
      .then(({ data }) => { if (!cancelled) setRows(data?.leaderboard || []) })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message || txt('랭킹을 불러오지 못했습니다.', 'Failed to load ranking.'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [gameKey, version])

  return (
    <div className="arcade-lb card card-pad">
      <div className="arcade-lb-head">
        <h2>{txt('Top 50', 'Top 50')}</h2>
        {loading && <span>{txt('불러오는 중...', 'Loading...')}</span>}
      </div>
      {error && <div className="arcade-alert"><span>{error}</span></div>}
      {!loading && rows.length === 0 && (
        <div className="arcade-empty">{txt('아직 점수가 없습니다. 첫 번째 기록을 남겨보세요!', 'No scores yet — be the first!')}</div>
      )}
      {rows.length > 0 && (
        <table className="arcade-lb-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>#</th>
              <th>{txt('유저', 'User')}</th>
              <th>{txt('티어', 'Tier')}</th>
              <th style={{ textAlign: 'right' }}>{txt('점수', 'Score')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.userId} className={row.rank <= 3 ? `top-${row.rank}` : ''}>
                <td>{row.rank}</td>
                <td>{row.username}</td>
                <td>{getTierLabel(row.tier, lang) || row.tier}</td>
                <td style={{ textAlign: 'right', fontFamily: 'Space Mono, monospace', fontWeight: 700 }}>{row.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
