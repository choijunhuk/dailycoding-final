import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, ArrowRight, Bot, Crown, Flame, RefreshCcw, Shield, Swords, Target, Trophy, Zap } from 'lucide-react'
import api from '../api.js'
import { useLang } from '../context/LangContext.jsx'
import { pickLangText } from '../utils/languageMode.js'
import { getTierLabel } from '../utils/labelMaps.js'
import './GameHubPage.css'

const emptySummary = {
  ghost: { candidates: 0, challenges: [], bestTarget: null },
  dungeon: { boss: null, rooms: [], progress: { cleared: 0, total: 0, percent: 0, damageDealt: 0 } },
  season: { territories: [], mySolvedThisWeek: 0, totalSolvedThisWeek: 0 },
}

function formatSeconds(sec, lang) {
  const value = Number(sec) || 0
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  if (lang === 'en') {
    if (!minutes) return `${seconds}s`
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`
  }
  if (!minutes) return `${seconds}초`
  return `${minutes}분 ${String(seconds).padStart(2, '0')}초`
}

function tierLabel(tier, lang) {
  return getTierLabel(tier, lang) || tier || (lang === 'ko' ? '훈련' : 'Training')
}

export default function GameHubPage() {
  const navigate = useNavigate()
  const { lang } = useLang()
  const txt = (ko, en) => pickLangText(lang, ko, en)
  const [summary, setSummary] = useState(emptySummary)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const dungeonProgress = summary.dungeon?.progress || emptySummary.dungeon.progress
  const boss = summary.dungeon?.boss
  const ghostChallenges = summary.ghost?.challenges || []
  const territories = summary.season?.territories || []
  const controlledCount = useMemo(() => territories.filter((item) => item.controlled).length, [territories])

  const loadSummary = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/game/summary')
      setSummary({ ...emptySummary, ...data })
    } catch (err) {
      setError(err?.response?.data?.message || txt('게임 데이터를 불러오지 못했습니다.', 'Failed to load game data.'))
      setSummary(emptySummary)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSummary()
  }, [])

  const openProblem = (problemId, state = {}) => {
    if (!problemId) return
    navigate(`/problems/${problemId}`, { state })
  }

  return (
    <div className="game-hub-page">
      <section className="game-hero card card-pad">
        <div className="game-hero-copy">
          <span className="game-eyebrow"><Swords size={14} /> {txt('데일리코딩 아케이드', 'DailyCoding Arcade')}</span>
          <h1>{txt('문제 풀이를 게임으로 바꾸는 코딩 게임 허브', 'A coding game hub that turns problem solving into a game')}</h1>
          <p>
            {txt('실시간 배틀을 넘어 고스트 레이스, 데일리 던전, 시즌 정복을 한곳에서 시작하세요.', 'Beyond real-time battles, start Ghost Race, Daily Dungeon, and Season Conquest all in one place.')}
            {' '}
            {txt('랭킹 점수에는 영향 없이 동기와 반복 플레이 가치를 높입니다.', 'Boosts your motivation and replay value without affecting your ranking score.')}
          </p>
          <div className="game-hero-actions">
            <button className="btn btn-primary" onClick={() => navigate('/battle')}>{txt('실시간 배틀 입장', 'Enter Live Battle')} <ArrowRight size={16} /></button>
            <button className="btn btn-ghost" onClick={loadSummary} disabled={loading}><RefreshCcw size={15} /> {txt('새로고침', 'Refresh')}</button>
          </div>
        </div>
        <div className="game-hero-panel">
          <div className="game-boss-orb">{boss?.emoji || '🎮'}</div>
          <div>
            <div className="game-panel-label">{txt('오늘의 보스', "Today's Boss")}</div>
            <strong>{(lang === 'ko' ? boss?.nameKo || boss?.name : boss?.name) || txt('보스 준비 중', 'Boss coming soon')}</strong>
            <small>{dungeonProgress.cleared}/{dungeonProgress.total} {txt('방 클리어', 'rooms cleared')} · {dungeonProgress.percent}% {txt('진행', 'progress')}</small>
          </div>
        </div>
      </section>

      {error && (
        <div className="game-alert card">
          <span>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/problems')}>{txt('먼저 문제 풀기', 'Solve Problems First')}</button>
        </div>
      )}

      <section className="game-stat-grid">
        <div className="game-stat card card-hover">
          <Zap size={18} />
          <span>{txt('고스트 후보', 'Ghost Candidates')}</span>
          <strong>{loading ? '-' : summary.ghost?.candidates || 0}</strong>
        </div>
        <div className="game-stat card card-hover">
          <Flame size={18} />
          <span>{txt('던전 피해량', 'Dungeon Damage')}</span>
          <strong>{loading ? '-' : dungeonProgress.damageDealt || 0}</strong>
        </div>
        <div className="game-stat card card-hover">
          <Crown size={18} />
          <span>{txt('점령 지역', 'Territories Held')}</span>
          <strong>{loading ? '-' : `${controlledCount}/${territories.length || 5}`}</strong>
        </div>
      </section>

      <div className="game-grid">
        <section className="game-section card card-pad">
          <div className="game-section-head">
            <div>
              <span className="game-section-kicker"><Bot size={14} /> {txt('비동기 레이스', 'Async Race')}</span>
              <h2>{txt('고스트 배틀', 'Ghost Battle')}</h2>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/submissions')}>{txt('내 기록 보기', 'View My History')}</button>
          </div>
          <p className="game-section-desc">{txt('다른 사용자의 정답 제출 시간만 목표로 삼아 혼자 레이스합니다. 코드는 공개되지 않습니다.', "Race alone against a target time taken from another user's accepted submission — their code stays private.")}</p>
          <div className="game-list">
            {ghostChallenges.length === 0 && !loading && (
              <div className="game-empty">{txt('아직 도전할 고스트가 충분하지 않습니다. 문제를 더 풀수록 후보가 좋아집니다.', 'Not enough ghosts to challenge yet. The more problems you solve, the better the candidates get.')}</div>
            )}
            {ghostChallenges.slice(0, 5).map((challenge) => (
              <button
                key={`${challenge.problemId}-${challenge.ghost?.targetTimeSec}`}
                type="button"
                className="game-row"
                onClick={() => openProblem(challenge.problemId, { gameMode: 'ghost', ghostChallenge: challenge })}
              >
                <span className="game-row-icon"><Zap size={16} /></span>
                <span className="game-row-main">
                  <strong>{challenge.title}</strong>
                  <small>{challenge.ghost?.username || txt('고스트', 'Ghost')} · {txt('목표', 'Target')} {formatSeconds(challenge.ghost?.targetTimeSec, lang)}</small>
                </span>
                <span className="game-pill">{tierLabel(challenge.tier, lang)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="game-section card card-pad game-dungeon-card">
          <div className="game-section-head">
            <div>
              <span className="game-section-kicker"><Shield size={14} /> {txt('데일리 던전', 'Daily Dungeon')}</span>
              <h2>{txt('오늘의 던전', "Today's Dungeon")}</h2>
            </div>
            <span className="game-pill danger">HP {boss?.hp ?? '-'}/{boss?.maxHp ?? '-'}</span>
          </div>
          <div className="game-boss-bar" aria-label={txt('보스 HP', 'Boss HP')}>
            <span style={{ width: `${Math.max(0, 100 - (dungeonProgress.percent || 0))}%` }} />
          </div>
          <div className="game-list">
            {(summary.dungeon?.rooms || []).map((room) => (
              <button
                key={room.problemId}
                type="button"
                className={`game-row${room.cleared ? ' cleared' : ''}`}
                onClick={() => openProblem(room.problemId, { gameMode: 'dungeon', dungeonRoom: room })}
              >
                <span className="game-row-icon">{room.cleared ? <Trophy size={16} /> : <Target size={16} />}</span>
                <span className="game-row-main">
                  <strong>{txt('방', 'Room')} {room.order} · {room.title}</strong>
                  <small>{room.cleared ? txt('클리어됨', 'Cleared') : txt(`클리어 시 ${room.damage} 피해`, `Deal ${room.damage} damage on clear`)}</small>
                </span>
                <span className="game-pill">{tierLabel(room.tier, lang)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="game-section card card-pad game-season-card">
          <div className="game-section-head">
            <div>
              <span className="game-section-kicker"><Activity size={14} /> {txt('주간 정복', 'Weekly Conquest')}</span>
              <h2>{txt('시즌 정복', 'Season Conquest')}</h2>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/battle')}>{txt('정복 배틀', 'Conquest Battle')}</button>
          </div>
          <p className="game-section-desc">{txt('태그별 지역 소유권은 최근 7일 정답 제출로 계산됩니다. 실시간 배틀을 자연스럽게 확장하는 메타 목표입니다.', 'Territory ownership per tag is calculated from correct submissions in the last 7 days. A meta-goal that naturally extends live battles.')}</p>
          <div className="territory-list">
            {territories.map((territory) => (
              <div key={territory.id} className="territory-row">
                <div className="territory-title">
                  <strong>{lang === 'ko' ? territory.labelKo || territory.label : territory.label}</strong>
                  <small>{territory.mySolves}/{territory.totalSolves} {txt('풀이', 'solves')}</small>
                </div>
                <div className="territory-bar"><span style={{ width: `${territory.progress || 0}%` }} /></div>
                <span className={`territory-status${territory.controlled ? ' on' : ''}`}>{territory.controlled ? txt('점령 중', 'Controlled') : txt('도전 중', 'Challenging')}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
