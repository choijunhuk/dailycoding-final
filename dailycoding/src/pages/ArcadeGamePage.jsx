import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, RefreshCcw, Trophy } from 'lucide-react'
import api from '../api.js'
import { useLang } from '../context/LangContext.jsx'
import './ArcadePage.css'
import './arcade/ArcadeGames.css'

import QuizGame from './arcade/QuizGame.jsx'
import BugHuntGame from './arcade/BugHuntGame.jsx'
import CodeTypingGame from './arcade/CodeTypingGame.jsx'
import TetrisGame from './arcade/TetrisGame.jsx'
import SnakeGame from './arcade/SnakeGame.jsx'
import Game2048 from './arcade/Game2048.jsx'
import MinesweeperGame from './arcade/MinesweeperGame.jsx'
import MemoryMatchGame from './arcade/MemoryMatchGame.jsx'
import FifteenPuzzleGame from './arcade/FifteenPuzzleGame.jsx'
import CodeWordleGame from './arcade/CodeWordleGame.jsx'
import ArcadeLeaderboard from './arcade/ArcadeLeaderboard.jsx'
import { OUTPUT_QUESTIONS, BIGO_QUESTIONS } from './arcade/arcadeData.js'

const GAME_TITLES = {
  'output-guess': { ko: '출력 맞추기',  en: 'Output Guess' },
  'bigo-quiz':    { ko: '빅오 퀴즈',    en: 'Big-O Quiz' },
  'bug-hunt':     { ko: '버그 헌트',    en: 'Bug Hunt' },
  'code-typing':  { ko: '코드 타자',    en: 'Code Typing' },
  'tetris':       { ko: '테트리스',     en: 'Tetris' },
  'snake':        { ko: '빔 스네이크',  en: 'Vim Snake' },
  '2048':         { ko: '2048',         en: '2048' },
  'minesweeper':  { ko: '지뢰찾기',     en: 'Minesweeper' },
  'memory-match': { ko: '메모리 매치',  en: 'Memory Match' },
  'fifteen':      { ko: '15 퍼즐',      en: '15 Puzzle' },
  'code-wordle':  { ko: '코드 워들',    en: 'Code Wordle' },
}

export default function ArcadeGamePage() {
  const { key } = useParams()
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams()
  const { lang } = useLang()
  const txt = (ko, en) => (lang === 'ko' ? ko : en)
  const initialTab = search.get('tab') === 'leaderboard' ? 'leaderboard' : 'play'
  const [tab, setTab] = useState(initialTab)
  const [lastResult, setLastResult] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [leaderboardVersion, setLeaderboardVersion] = useState(0)
  const [resetKey, setResetKey] = useState(0)

  const title = GAME_TITLES[key]
  if (!title) {
    return (
      <div className="arcade-page">
        <div className="arcade-alert card">
          <span>{txt('알 수 없는 게임입니다.', 'Unknown game.')}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/arcade')}>{txt('아케이드로', 'Back to Arcade')}</button>
        </div>
      </div>
    )
  }

  useEffect(() => {
    setSearch(tab === 'leaderboard' ? { tab: 'leaderboard' } : {}, { replace: true })
  }, [tab])

  const submitScore = async (score, meta = {}) => {
    setSubmitting(true)
    setError('')
    try {
      const { data } = await api.post('/arcade/score', { gameKey: key, score: Math.max(0, Math.floor(score)), meta })
      setLastResult(data)
      setLeaderboardVersion((v) => v + 1)
    } catch (err) {
      setError(err?.response?.data?.message || txt('점수 저장 실패', 'Failed to save score'))
    } finally {
      setSubmitting(false)
    }
  }

  const renderGame = () => {
    const onComplete = (score, meta) => submitScore(score, meta)
    switch (key) {
      case 'output-guess': return <QuizGame key={resetKey} questions={OUTPUT_QUESTIONS} onComplete={onComplete} />
      case 'bigo-quiz':    return <QuizGame key={resetKey} questions={BIGO_QUESTIONS} onComplete={onComplete} />
      case 'bug-hunt':     return <BugHuntGame key={resetKey} onComplete={onComplete} />
      case 'code-typing':  return <CodeTypingGame key={resetKey} onComplete={onComplete} />
      case 'tetris':       return <TetrisGame key={resetKey} onComplete={onComplete} />
      case 'snake':        return <SnakeGame key={resetKey} onComplete={onComplete} />
      case '2048':         return <Game2048 key={resetKey} onComplete={onComplete} />
      case 'minesweeper':  return <MinesweeperGame key={resetKey} onComplete={onComplete} />
      case 'memory-match': return <MemoryMatchGame key={resetKey} onComplete={onComplete} />
      case 'fifteen':      return <FifteenPuzzleGame key={resetKey} onComplete={onComplete} />
      case 'code-wordle':  return <CodeWordleGame key={resetKey} onComplete={onComplete} />
      default: return null
    }
  }

  const restart = () => {
    setLastResult(null)
    setError('')
    setResetKey((k) => k + 1)
  }

  return (
    <div className="arcade-page arcade-game-page">
      <div className="arcade-game-head">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/arcade')}>
          <ArrowLeft size={14} /> {txt('아케이드', 'Arcade')}
        </button>
        <h1>{lang === 'ko' ? title.ko : title.en}</h1>
        <div className="arcade-tab-group">
          <button
            className={`arcade-tab${tab === 'play' ? ' active' : ''}`}
            onClick={() => setTab('play')}
          >{txt('플레이', 'Play')}</button>
          <button
            className={`arcade-tab${tab === 'leaderboard' ? ' active' : ''}`}
            onClick={() => setTab('leaderboard')}
          ><Trophy size={13} /> {txt('랭킹', 'Ranking')}</button>
        </div>
      </div>

      {error && <div className="arcade-alert card"><span>{error}</span></div>}

      {tab === 'play' ? (
        <div className="arcade-stage card card-pad">
          {lastResult ? (
            <div className="arcade-result">
              <div className="arcade-result-score">
                <span>{txt('이번 점수', 'Score')}</span>
                <strong>{lastResult.score}</strong>
              </div>
              <div className="arcade-result-stats">
                <div>
                  <span>{txt('내 최고점', 'My Best')}</span>
                  <strong>{lastResult.best}</strong>
                  {lastResult.isNewBest && <em className="badge-new">NEW</em>}
                </div>
                <div>
                  <span>{txt('현재 순위 (이 점수 기준)', 'Approx Rank')}</span>
                  <strong>#{lastResult.approxRank}</strong>
                </div>
              </div>
              <div className="arcade-result-actions">
                <button className="btn btn-primary" onClick={restart} disabled={submitting}>
                  <RefreshCcw size={14} /> {txt('한 판 더', 'Play Again')}
                </button>
                <button className="btn btn-ghost" onClick={() => setTab('leaderboard')}>
                  <Trophy size={14} /> {txt('랭킹 보기', 'View Ranking')}
                </button>
              </div>
            </div>
          ) : (
            renderGame()
          )}
          {submitting && <div className="arcade-submitting">{txt('점수 저장 중...', 'Saving score...')}</div>}
        </div>
      ) : (
        <ArcadeLeaderboard gameKey={key} version={leaderboardVersion} />
      )}
    </div>
  )
}
