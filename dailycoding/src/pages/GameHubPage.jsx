import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, ArrowRight, Bot, Crown, Flame, RefreshCcw, Shield, Swords, Target, Trophy, Zap } from 'lucide-react'
import api from '../api.js'
import './GameHubPage.css'

const emptySummary = {
  ghost: { candidates: 0, challenges: [], bestTarget: null },
  dungeon: { boss: null, rooms: [], progress: { cleared: 0, total: 0, percent: 0, damageDealt: 0 } },
  season: { territories: [], mySolvedThisWeek: 0, totalSolvedThisWeek: 0 },
}

function formatSeconds(sec) {
  const value = Number(sec) || 0
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  if (!minutes) return `${seconds}초`
  return `${minutes}분 ${String(seconds).padStart(2, '0')}초`
}

function tierLabel(tier) {
  return ({
    iron: '아이언', bronze: '브론즈', silver: '실버', gold: '골드', platinum: '플래티넘', emerald: '에메랄드', diamond: '다이아', master: '마스터', grandmaster: '그마', challenger: '챌린저',
  })[tier] || tier || '훈련'
}

export default function GameHubPage() {
  const navigate = useNavigate()
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
      setError(err?.response?.data?.message || '게임 데이터를 불러오지 못했습니다.')
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
          <span className="game-eyebrow"><Swords size={14} /> DailyCoding Arcade</span>
          <h1>문제 풀이를 게임처럼 이어가는 코딩 게임 허브</h1>
          <p>
            실시간 배틀뿐 아니라 고스트 레이스, 오늘의 던전, 시즌 점령전을 한 곳에서 시작하세요.
            랭킹 점수는 건드리지 않고 풀이 동기와 반복 플레이를 강화합니다.
          </p>
          <div className="game-hero-actions">
            <button className="btn btn-primary" onClick={() => navigate('/battle')}>실시간 배틀 입장 <ArrowRight size={16} /></button>
            <button className="btn btn-ghost" onClick={loadSummary} disabled={loading}><RefreshCcw size={15} /> 새로고침</button>
          </div>
        </div>
        <div className="game-hero-panel">
          <div className="game-boss-orb">{boss?.emoji || '🎮'}</div>
          <div>
            <div className="game-panel-label">오늘의 보스</div>
            <strong>{boss?.name || '준비 중인 보스'}</strong>
            <small>{dungeonProgress.cleared}/{dungeonProgress.total} 방 클리어 · {dungeonProgress.percent}% 진행</small>
          </div>
        </div>
      </section>

      {error && (
        <div className="game-alert card">
          <span>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/problems')}>문제부터 풀기</button>
        </div>
      )}

      <section className="game-stat-grid">
        <div className="game-stat card card-hover">
          <Zap size={18} />
          <span>고스트 후보</span>
          <strong>{loading ? '-' : summary.ghost?.candidates || 0}</strong>
        </div>
        <div className="game-stat card card-hover">
          <Flame size={18} />
          <span>던전 피해량</span>
          <strong>{loading ? '-' : dungeonProgress.damageDealt || 0}</strong>
        </div>
        <div className="game-stat card card-hover">
          <Crown size={18} />
          <span>점령 지역</span>
          <strong>{loading ? '-' : `${controlledCount}/${territories.length || 5}`}</strong>
        </div>
      </section>

      <div className="game-grid">
        <section className="game-section card card-pad">
          <div className="game-section-head">
            <div>
              <span className="game-section-kicker"><Bot size={14} /> Async Race</span>
              <h2>고스트 배틀</h2>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/submissions')}>내 기록 보기</button>
          </div>
          <p className="game-section-desc">다른 사용자의 정답 코드 내용은 공개하지 않고 목표 시간만 가져와 혼자 레이스합니다.</p>
          <div className="game-list">
            {ghostChallenges.length === 0 && !loading && (
              <div className="game-empty">아직 도전할 고스트가 부족합니다. 문제를 풀수록 후보가 더 정교해집니다.</div>
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
                  <small>{challenge.ghost?.username || '고스트'} · 목표 {formatSeconds(challenge.ghost?.targetTimeSec)}</small>
                </span>
                <span className="game-pill">{tierLabel(challenge.tier)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="game-section card card-pad game-dungeon-card">
          <div className="game-section-head">
            <div>
              <span className="game-section-kicker"><Shield size={14} /> Daily Dungeon</span>
              <h2>오늘의 던전</h2>
            </div>
            <span className="game-pill danger">HP {boss?.hp ?? '-'}/{boss?.maxHp ?? '-'}</span>
          </div>
          <div className="game-boss-bar" aria-label="보스 체력">
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
                  <strong>{room.order}방 · {room.title}</strong>
                  <small>{room.cleared ? '클리어 완료' : `클리어 시 ${room.damage} 피해`}</small>
                </span>
                <span className="game-pill">{tierLabel(room.tier)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="game-section card card-pad game-season-card">
          <div className="game-section-head">
            <div>
              <span className="game-section-kicker"><Activity size={14} /> Weekly Conquest</span>
              <h2>시즌 점령전</h2>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/battle')}>점령전 배틀</button>
          </div>
          <p className="game-section-desc">최근 7일 정답 기록으로 태그별 영토 점유율을 계산합니다. 실시간 점령전과 자연스럽게 이어지는 메타 목표입니다.</p>
          <div className="territory-list">
            {territories.map((territory) => (
              <div key={territory.id} className="territory-row">
                <div className="territory-title">
                  <strong>{territory.label}</strong>
                  <small>{territory.mySolves}/{territory.totalSolves} solves</small>
                </div>
                <div className="territory-bar"><span style={{ width: `${territory.progress || 0}%` }} /></div>
                <span className={`territory-status${territory.controlled ? ' on' : ''}`}>{territory.controlled ? '점령' : '도전'}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
