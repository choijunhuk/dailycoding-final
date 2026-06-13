import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Crown, Gamepad2, RefreshCcw, Trophy } from 'lucide-react'
import api from '../api.js'
import { useLang } from '../context/LangContext.jsx'
import './ArcadePage.css'

const FALLBACK_GAMES = [
  { key: 'output-guess', name: 'Output Guess',   nameKo: '출력 맞추기',  category: 'algorithm', emoji: '🔮' },
  { key: 'bigo-quiz',    name: 'Big-O Quiz',     nameKo: '빅오 퀴즈',    category: 'algorithm', emoji: '📈' },
  { key: 'bug-hunt',     name: 'Bug Hunt',       nameKo: '버그 헌트',    category: 'debug',     emoji: '🐞' },
  { key: 'code-typing',  name: 'Code Typing',    nameKo: '코드 타자',    category: 'typing',    emoji: '⌨️' },
  { key: 'tetris',       name: 'Tetris',         nameKo: '테트리스',     category: 'classic',   emoji: '🟦' },
  { key: 'snake',        name: 'Vim Snake',      nameKo: '빔 스네이크',  category: 'classic',   emoji: '🐍' },
  { key: '2048',         name: '2048',           nameKo: '2048',         category: 'classic',   emoji: '🔢' },
  { key: 'minesweeper',  name: 'Minesweeper',    nameKo: '지뢰찾기',     category: 'classic',   emoji: '💣' },
  { key: 'memory-match', name: 'Memory Match',   nameKo: '메모리 매치',  category: 'algorithm', emoji: '🃏' },
  { key: 'fifteen',      name: '15 Puzzle',      nameKo: '15 퍼즐',      category: 'classic',   emoji: '🧩' },
  { key: 'code-wordle',  name: 'Code Wordle',    nameKo: '코드 워들',    category: 'typing',    emoji: '🔤' },
]

const CATEGORY_LABEL = {
  algorithm: { ko: '알고리즘', en: 'Algorithm' },
  debug:     { ko: '디버깅',   en: 'Debug' },
  typing:    { ko: '타이핑',   en: 'Typing' },
  classic:   { ko: '클래식',   en: 'Classic' },
}

export default function ArcadePage() {
  const navigate = useNavigate()
  const { lang } = useLang()
  const txt = (ko, en) => (lang === 'ko' ? ko : en)
  const [games, setGames] = useState(FALLBACK_GAMES)
  const [bestByGame, setBestByGame] = useState({})
  const [topByGame, setTopByGame] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [gamesRes, bestRes, topRes] = await Promise.all([
        api.get('/arcade/games'),
        api.get('/arcade/my-best'),
        api.get('/arcade/top', { params: { limit: 3 } }),
      ])
      if (Array.isArray(gamesRes.data?.games) && gamesRes.data.games.length) {
        setGames(gamesRes.data.games)
      }
      setBestByGame(bestRes.data?.bestByGame || {})
      setTopByGame(topRes.data?.topByGame || {})
    } catch (err) {
      setError(err?.response?.data?.message || txt('아케이드 데이터를 불러오지 못했습니다.', 'Failed to load arcade data.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const grouped = games.reduce((acc, g) => {
    const cat = g.category || 'misc'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(g)
    return acc
  }, {})

  return (
    <div className="arcade-page">
      <section className="arcade-hero card card-pad">
        <div className="arcade-hero-copy">
          <span className="arcade-eyebrow"><Gamepad2 size={14} /> {txt('데일리코딩 아케이드', 'DailyCoding Arcade')}</span>
          <h1>{txt('코딩하다 머리 식히는 미니게임 8종', '8 mini games for coders to wind down')}</h1>
          <p>{txt('알고리즘 퀴즈, 디버깅, 클래식 게임까지. 점수 올리고 리더보드 1등 노려보세요.', 'Algorithm quizzes, debugging, classic arcades. Climb the leaderboards.')}</p>
          <button className="btn btn-ghost" onClick={load} disabled={loading}>
            <RefreshCcw size={14} /> {txt('새로고침', 'Refresh')}
          </button>
        </div>
        <div className="arcade-hero-art" aria-hidden>🎮 ⌨️ 🐍 🔢 💣 🟦 🐞 📈</div>
      </section>

      {error && (
        <div className="arcade-alert card">
          <span>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={load}>{txt('다시 시도', 'Retry')}</button>
        </div>
      )}

      {Object.entries(grouped).map(([cat, list]) => (
        <section key={cat} className="arcade-section">
          <div className="arcade-section-head">
            <h2>{CATEGORY_LABEL[cat]?.[lang === 'ko' ? 'ko' : 'en'] || cat}</h2>
            <span className="arcade-section-count">{list.length} {txt('게임', 'games')}</span>
          </div>
          <div className="arcade-grid">
            {list.map((g) => {
              const best = bestByGame[g.key]?.best || 0
              const plays = bestByGame[g.key]?.plays || 0
              const top = topByGame[g.key] || []
              return (
                <div key={g.key} className="arcade-card card card-hover">
                  <div className="arcade-card-head">
                    <span className="arcade-emoji">{g.emoji}</span>
                    <div>
                      <h3>{lang === 'ko' ? g.nameKo || g.name : g.name}</h3>
                      <p>{lang === 'ko' ? (g.descKo || '') : (g.desc || '')}</p>
                    </div>
                  </div>
                  <div className="arcade-stats">
                    <div>
                      <span>{txt('최고점', 'Best')}</span>
                      <strong>{best}</strong>
                    </div>
                    <div>
                      <span>{txt('플레이', 'Plays')}</span>
                      <strong>{plays}</strong>
                    </div>
                  </div>
                  {top.length > 0 && (
                    <div className="arcade-top-mini">
                      <div className="arcade-top-mini-head"><Crown size={12} /> {txt('Top 3', 'Top 3')}</div>
                      <ul>
                        {top.slice(0, 3).map((row) => (
                          <li key={row.userId}>
                            <span>{row.rank}. {row.username}</span>
                            <strong>{row.score}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="arcade-card-actions">
                    <button className="btn btn-primary" onClick={() => navigate(`/arcade/${g.key}`)}>
                      {txt('플레이', 'Play')} <ArrowRight size={14} />
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/arcade/${g.key}?tab=leaderboard`)}>
                      <Trophy size={13} /> {txt('랭킹', 'Ranking')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
