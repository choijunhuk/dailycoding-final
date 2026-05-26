import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, PlayCircle, Moon, Sun, Sparkles, Star, Target, Swords, Bot, RotateCcw } from 'lucide-react'
import { useTheme } from '../context/ThemeContext.jsx'
import { useLang } from '../context/LangContext.jsx'
import './LandingPage.css'
import { TIER_THRESHOLDS } from '../data/constants.js'
import { PLAN_META } from '../data/pricingPlans.js'
import api from '../api.js'
import { getDateLocale, pickLangText } from '../utils/languageMode.js'
import { getTierLabel } from '../utils/labelMaps.js'

const TIERS = [
  { name: 'Iron',        label: 'Iron',        color: '#a8a8a8', range: `${TIER_THRESHOLDS.iron.toLocaleString()} - ${(TIER_THRESHOLDS.bronze - 1).toLocaleString()} pts` },
  { name: 'Bronze',      label: 'Bronze',      color: '#cd7f32', range: `${TIER_THRESHOLDS.bronze.toLocaleString()} - ${(TIER_THRESHOLDS.silver - 1).toLocaleString()} pts` },
  { name: 'Silver',      label: 'Silver',      color: '#c0c0c0', range: `${TIER_THRESHOLDS.silver.toLocaleString()} - ${(TIER_THRESHOLDS.gold - 1).toLocaleString()} pts` },
  { name: 'Gold',        label: 'Gold',        color: '#ffd700', range: `${TIER_THRESHOLDS.gold.toLocaleString()} - ${(TIER_THRESHOLDS.platinum - 1).toLocaleString()} pts` },
  { name: 'Platinum',    label: 'Platinum',    color: '#00e5cc', range: `${TIER_THRESHOLDS.platinum.toLocaleString()} - ${(TIER_THRESHOLDS.emerald - 1).toLocaleString()} pts` },
  { name: 'Emerald',     label: 'Emerald',     color: '#00d18f', range: `${TIER_THRESHOLDS.emerald.toLocaleString()} - ${(TIER_THRESHOLDS.diamond - 1).toLocaleString()} pts` },
  { name: 'Diamond',     label: 'Diamond',     color: '#b9f2ff', range: `${TIER_THRESHOLDS.diamond.toLocaleString()} - ${(TIER_THRESHOLDS.master - 1).toLocaleString()} pts` },
  { name: 'Master',      label: 'Master',      color: '#9b59b6', range: `${TIER_THRESHOLDS.master.toLocaleString()} - ${(TIER_THRESHOLDS.grandmaster - 1).toLocaleString()} pts` },
  { name: 'Grandmaster', label: 'Grandmaster', color: '#e74c3c', range: `${TIER_THRESHOLDS.grandmaster.toLocaleString()} pts+` },
  { name: 'Challenger',  label: 'Challenger',  color: '#f1c40f', range: 'Top 3 players' },
]

const CODE_LINES = [
  'function solve(input) {',
  '  const values = input.trim().split("\\n")',
  '  return values.map(Number).reduce((sum, n) => sum + n, 0)',
  '}',
  'console.log(solve("1\\n2\\n3")) // 6',
]

function useCountUp(targets, enabled) {
  const [values, setValues] = useState(targets.map(() => 0))
  const targetsKey = targets.join('|')

  useEffect(() => {
    if (!enabled) return undefined
    const startedAt = performance.now()
    let frame = 0

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / 1000)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValues(targets.map((value) => Math.round(value * eased)))
      if (progress < 1) frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [enabled, targetsKey])

  return values
}

export default function LandingPage({ onLogin, onSignup, onPricing }) {
  const { theme, toggleTheme } = useTheme()
  const { lang, toggleLang } = useLang()
  const txt = (ko, en) => pickLangText(lang, ko, en)
  const dateLocale = getDateLocale(lang)
  const statsRef = useRef(null)
  const [statsVisible, setStatsVisible] = useState(false)
  const [typedText, setTypedText] = useState('')
  const [activeBattleCount, setActiveBattleCount] = useState(null)
  const [siteStats, setSiteStats] = useState(null)
  const openAfterLogin = (path) => {
    sessionStorage.setItem('postLoginRedirect', path)
    onLogin?.()
  }

  const footerGroups = [
    {
      title: txt('서비스', 'Service'),
      links: [
        { label: txt('문제', 'Problems'), action: () => openAfterLogin('/problems') },
        { label: txt('랭킹', 'Ranking'), action: () => openAfterLogin('/ranking') },
        { label: txt('요금제', 'Pricing'), action: onPricing },
        { label: txt('커뮤니티', 'Community'), action: () => openAfterLogin('/community') },
      ],
    },
    {
      title: txt('지원', 'Support'),
      links: [
        { label: txt('문의', 'Contact'), href: 'mailto:choijunhuk2007@gmail.com' },
        { label: txt('이용약관', 'Terms'), href: '/terms' },
        { label: txt('개인정보처리방침', 'Privacy Policy'), href: '/privacy' },
      ],
    },
  ]

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setStatsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.35 }
    )
    if (statsRef.current) observer.observe(statsRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    let timer = 0
    const loadActiveBattleCount = () => {
      api.get('/battles/public/active-count')
        .then(({ data }) => {
          if (!cancelled) setActiveBattleCount(Number(data?.count || 0))
        })
        .catch(() => {
          if (!cancelled) setActiveBattleCount(null)
        })
    }
    loadActiveBattleCount()
    timer = window.setInterval(loadActiveBattleCount, 15000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    api.get('/stats')
      .then(({ data }) => {
        if (!cancelled) {
          setSiteStats({
            users: Number(data?.users || 0),
            problems: Number(data?.problems || 0),
            submissions: Number(data?.submissions || 0),
            correct: Number(data?.correct || 0),
          })
        }
      })
      .catch(() => {
        if (!cancelled) setSiteStats(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let lineIndex = 0
    let charIndex = 0
    let timer = 0

    const write = () => {
      const current = CODE_LINES[lineIndex]
      const built = CODE_LINES.slice(0, lineIndex).join('\n')
      const nextLine = current.slice(0, charIndex + 1)
      setTypedText(`${built}${built ? '\n' : ''}${nextLine}`)

      if (charIndex < current.length - 1) {
        charIndex += 1
      } else if (lineIndex < CODE_LINES.length - 1) {
        lineIndex += 1
        charIndex = 0
      } else {
        lineIndex = 0
        charIndex = 0
        setTypedText('')
      }

      timer = window.setTimeout(write, 42)
    }

    timer = window.setTimeout(write, 120)
    return () => window.clearTimeout(timer)
  }, [])

  const tierRows = useMemo(() => TIERS, [])
  const statsLoaded = Boolean(siteStats)
  const localizedStats = [
    { value: siteStats?.correct ?? 0, loaded: statsLoaded, suffix: '', label: txt('정답 제출', 'Accepted Submissions') },
    { value: siteStats?.users ?? 0, loaded: statsLoaded, suffix: '', label: txt('인증 멤버', 'Verified Members') },
    { value: siteStats?.submissions ? Math.round((siteStats.correct / Math.max(1, siteStats.submissions)) * 100) : 0, loaded: statsLoaded, suffix: '%', label: txt('정답률', 'Acceptance Rate') },
    { value: siteStats?.problems ?? 0, loaded: statsLoaded, suffix: '', label: txt('공개 문제', 'Public Problems') },
  ]
  const countValues = useCountUp(localizedStats.map((item) => item.value), statsVisible)
  const localizedSteps = [
    { id: 1, title: txt('회원가입', 'Sign Up'), desc: txt('30초만에 계정을 만들고 바로 문제를 풀기 시작하세요.', 'Create an account in 30 seconds and start solving immediately.') },
    { id: 2, title: txt('데일리 루틴 실행', 'Run Your Daily Routine'), desc: txt('추천 문제, 오답 복습, 데일리 미션을 한 화면에서 처리하세요.', 'Handle recommended problems, wrong-answer review, and daily missions on one screen.') },
    { id: 3, title: txt('XP와 프로필 보상 획득', 'Earn XP and Profile Rewards'), desc: txt('랭킹 점수와 별개로 XP로 뱃지, 칭호, 프로필 배경을 해금하세요.', 'Unlock badges, titles, and profile backgrounds with XP separate from ranking points.') },
  ]
  const localizedModes = lang === 'ko'
    ? ['⚡ 스피드', '💀 서바이벌', '✨ 이펙트', '🎒 아이템', '🏴 영토', '👻 고스트', '🐉 던전']
    : ['⚡ Speed', '💀 Survival', '✨ Effects', '🎒 Items', '🏴 Territory', '👻 Ghost', '🐉 Dungeon']
  const localizedDifferentiators = [
    {
      icon: Target,
      title: txt('무엇을 해야 할지 알려주는 데일리 루틴', 'A Daily Routine That Shows What To Do'),
      desc: txt('문제 목록만 던져주는 것에 그치지 않고 — 대시보드가 추천 문제, 미션, 주간 챌린지를 하나의 흐름으로 연결합니다.', 'Instead of only listing problems, the dashboard connects recommendations, missions, and weekly challenges into one flow.'),
      tag: txt('데일리 루프', 'Daily Loop'),
    },
    {
      icon: RotateCcw,
      title: txt('오답을 해결하는 복습 큐', 'A Review Queue That Resolves Wrong Answers'),
      desc: txt('최근 틀린 제출을 원인별로 정리하고 재도전 및 AI 오답 코치와 연결합니다.', 'Recent wrong submissions are grouped by cause and linked to retries plus AI coaching.'),
      tag: txt('복습', 'Review'),
    },
    {
      icon: Swords,
      title: txt('혼자 연습에서 배틀로 확장', 'From Solo Practice To Battles'),
      desc: txt('실시간 1v1 배틀, 고스트 레이스, 데일리 던전으로 짧은 압박 속에서 풀이 속도와 정확도를 확인하세요.', 'Use real-time 1v1 battles, ghost races, and daily dungeons to test speed and accuracy under pressure.'),
      tag: txt('배틀', 'Battle'),
    },
    {
      icon: Bot,
      title: txt('필요할 때만 쓰는 제출 코치', 'A Submission Coach Only When Needed'),
      desc: txt('힌트와 코드 리뷰가 제출 기록 옆에 보조 도구로 작동합니다. 핵심은 풀이 기록과 복습 루틴입니다.', 'Hints and code reviews act as helper tools beside submission history; the core is your solving record and review routine.'),
      tag: txt('코치', 'Coach'),
    },
    {
      icon: Star,
      title: txt('랭킹에 영향 없는 XP 보상', 'XP Rewards That Do Not Affect Ranking'),
      desc: txt('데일리 미션이 뱃지, 칭호, 프로필 배경이라는 개인 성장 보상으로 쌓입니다 — 경쟁 점수가 아닌 성장의 증거로.', 'Daily missions build personal growth rewards such as badges, titles, and profile backgrounds, not competitive score.'),
      tag: txt('보상', 'Rewards'),
    },
  ]
  const localizedScenarios = [
    { name: txt('데일리 루틴형', 'Daily Routine'), tier: 'gold', text: txt('하루 한 문제, 오답 복구, 주간 챌린지를 한 흐름으로 이어갑니다.', 'Connect one daily problem, wrong-answer recovery, and weekly challenges into one flow.'), company: txt('꾸준함 중심', 'Consistency-first') },
    { name: txt('복습 집중형', 'Recovery Focus'), tier: 'platinum', text: txt('틀린 제출을 다시 찾지 않고, 복습 후보를 바로 열어 재도전합니다.', 'Open retry candidates directly instead of digging through old wrong submissions.'), company: txt('오답 관리', 'Wrong-answer review') },
    { name: txt('배틀 훈련형', 'Battle Training'), tier: 'silver', text: txt('실시간 배틀과 게임 허브로 시간 압박 속 풀이 감각을 점검합니다.', 'Use live battles and the game hub to practice under time pressure.'), company: txt('실전 감각', 'Match practice') },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="hero-gradient-surface" style={{ borderBottom: '1px solid var(--border)' }}>
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '14px 24px',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)',
        }}>
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <Sparkles size={18} color="var(--blue)" />
            <span className="gradient-text">DailyCoding</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={onPricing}>{txt('요금제', 'Pricing')}</button>
            <button className="btn btn-ghost" onClick={onLogin}>{txt('로그인', 'Log In')}</button>
            <button className="btn btn-primary" onClick={onSignup}>{txt('무료 시작', 'Start Free')}</button>
            <button className="btn btn-ghost" onClick={toggleTheme} aria-label={txt('테마 전환', 'theme toggle')}>
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button className="btn btn-ghost" onClick={toggleLang} style={{ fontWeight: 700, fontSize: 12 }}>
              {lang === 'ko' ? 'EN' : 'KO'}
            </button>
          </div>
        </div>

        <section className="landing-hero-grid" style={{ maxWidth: 1200, margin: '0 auto', padding: '72px 24px 64px', display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, .9fr)', gap: 28, alignItems: 'center' }}>
          <div className="animate-fade-in-up">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999, background: 'rgba(121,192,255,.1)', border: '1px solid rgba(121,192,255,.2)', color: 'var(--blue)', fontSize: 12, fontWeight: 700, marginBottom: 20 }}>
              <Swords size={14} />
              {txt('다른 코딩 플랫폼에는 없는 실시간 1v1 알고리즘 배틀', 'Real-time 1v1 algorithm battles you will not find on typical coding platforms')}
            </div>
            <h1 style={{ fontSize: 'clamp(42px, 8vw, 72px)', lineHeight: 1.03, fontWeight: 900, letterSpacing: 0, marginBottom: 18 }}>
              <span className="gradient-text">{txt('실시간으로 배틀하고,', 'Battle in real time,')}</span><br />
              {txt('데일리 코딩 습관을 만드세요', 'build a daily coding habit')}
            </h1>
            <p style={{ fontSize: 18, color: 'var(--text2)', lineHeight: 1.75, maxWidth: 640, marginBottom: 28 }}>
              {txt(
                'HP, 아이템, 문제 이펙트, 영토 점령 등 5가지 실시간 배틀 모드로 압박 속에서 실력을 키우세요. 배틀 사이에는 데일리 문제, 오답 복습, XP 보상으로 꾸준함을 유지하세요.',
                'Build skill under pressure with real-time battle modes such as HP, items, problem effects, and territory capture. Between battles, stay consistent with daily problems, wrong-answer review, and XP rewards.',
              )}
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
              <button className="btn btn-primary pulse-cta" onClick={onSignup} style={{ padding: '14px 22px', fontSize: 15 }}>
                {txt('무료 시작', 'Start Free')} <ArrowRight size={16} />
              </button>
              <button className="btn btn-ghost" onClick={() => document.getElementById('landing-demo')?.scrollIntoView({ behavior: 'smooth' })} style={{ padding: '14px 22px', fontSize: 15 }}>
                {txt('미리보기', 'Preview')} <PlayCircle size={16} />
              </button>
            </div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:24}}>
              {localizedModes.map((mode) => (
                <span key={mode} style={{padding:'7px 10px',borderRadius:999,background:'var(--bg2)',border:'1px solid var(--border)',fontSize:12,fontWeight:800,color:'var(--text2)'}}>
                  {mode}
                </span>
              ))}
              <span style={{padding:'7px 10px',borderRadius:999,background:'rgba(248,81,73,.1)',border:'1px solid rgba(248,81,73,.24)',fontSize:12,fontWeight:900,color:'var(--red)'}}>
                {activeBattleCount == null ? '-' : activeBattleCount.toLocaleString(dateLocale)}{txt('개 배틀 진행 중', ' active battles')}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {tierRows.map((tier) => (
                <span key={tier.name} style={{ padding: '6px 10px', borderRadius: 999, background: `${tier.color}14`, border: `1px solid ${tier.color}30`, color: tier.color, fontSize: 12, fontWeight: 700 }}>
                  {getTierLabel(tier.name, lang)}
                </span>
              ))}
            </div>
          </div>

          <div id="landing-demo" className="animate-fade-in-up animate-delay-2">
            <div className="card card-hover glow-blue" style={{ padding: 18, background: 'rgba(13,17,23,.75)', border: '1px solid rgba(121,192,255,.18)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>{txt('샘플 배틀 화면', 'Sample Battle Preview')}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>{txt('실제 배틀 모드 예시', 'Example Battle Mode')}</div>
                </div>
                <span className="badge badge-blue">{txt('샘플', 'SAMPLE')}</span>
              </div>
              <div style={{ background: '#0b0f14', borderRadius: 16, border: '1px solid rgba(121,192,255,.15)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid rgba(121,192,255,.1)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f85149' }} />
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#e3b341' }} />
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#56d364' }} />
                  <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text3)' }}>{txt('샘플 풀이.py', 'sample-solve.py')}</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,padding:'12px 14px',borderBottom:'1px solid rgba(121,192,255,.1)'}}>
                  <div style={{padding:10,borderRadius:12,background:'rgba(63,185,80,.08)',border:'1px solid rgba(63,185,80,.18)'}}>
                    <div style={{fontSize:11,color:'var(--text3)'}}>{txt('나', 'Me')}</div>
                    <div style={{fontWeight:900,color:'#56d364'}}>{txt('샘플 HP 72 · 320 pts', 'Sample HP 72 · 320 pts')}</div>
                  </div>
                  <div style={{padding:10,borderRadius:12,background:'rgba(248,81,73,.08)',border:'1px solid rgba(248,81,73,.18)'}}>
                    <div style={{fontSize:11,color:'var(--text3)'}}>{txt('상대방', 'Opponent')}</div>
                    <div style={{fontWeight:900,color:'#f85149'}}>{txt('샘플 HP 41 · 280 pts', 'Sample HP 41 · 280 pts')}</div>
                  </div>
                </div>
                <pre style={{ margin: 0, minHeight: 220, padding: '18px 18px 22px', color: '#c9d1d9', fontSize: 13, lineHeight: 1.8, fontFamily: "'Space Mono', monospace", whiteSpace: 'pre-wrap' }}>
{typedText}
<span style={{ color: 'var(--blue)' }}>|</span>
                </pre>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 14 }}>
                <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(86,211,100,.08)', border: '1px solid rgba(86,211,100,.18)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>{txt('정답', 'Correct')}</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>⚔️ {txt('예시 타격 · 상대 HP -28', 'Example hit · Opponent HP -28')}</div>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(121,192,255,.08)', border: '1px solid rgba(121,192,255,.18)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>{txt('영토', 'Territory')}</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{txt('예시 영토 · 5문제 점령', 'Example territory · 5 problems captured')}</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section ref={statsRef} style={{ background: 'var(--bg2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '18px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          {localizedStats.map((item, index) => (
            <div key={item.label} className={`animate-fade-in-up animate-delay-${Math.min(index + 1, 3)}`} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "'Space Mono', monospace", color: 'var(--blue)' }}>
                {item.loaded ? `${countValues[index].toLocaleString(dateLocale)}${item.suffix}` : '-'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '72px 24px 16px' }}>
        <div style={{ marginBottom: 34 }}>
          <div style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>{txt('왜 데일리코딩인가', 'Why DailyCoding')}</div>
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 900, marginBottom: 10 }}>{txt('문제만 많은 사이트가 아닌 — 다시 풀게 만드는 플랫폼', 'More than a problem bank: a platform that brings you back to solve again')}</h2>
          <p style={{ maxWidth: 720, color: 'var(--text2)', lineHeight: 1.7 }}>
            {txt(
              'Codeforces식 대회 문화, solved.ac식 티어 정보, HackerRank식 AI 채점과 달리 데일리코딩은 데일리 루틴, 오답 복습, AI 코치, 배틀을 하나의 흐름으로 연결합니다.',
              'Unlike platforms focused on contests, tier metadata, or isolated AI grading, DailyCoding connects daily routines, wrong-answer review, AI coaching, and battles into one flow.',
            )}
          </p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(230px, 1fr))', gap:16 }}>
          {localizedDifferentiators.map((item, index) => {
            const Icon = item.icon
            return (
              <div key={item.title} className={`card card-hover animate-fade-in-up animate-delay-${Math.min(index + 1, 3)}`} style={{ padding:'22px 20px', borderRadius:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'center', marginBottom:16 }}>
                  <div style={{ width:42, height:42, borderRadius:12, display:'grid', placeItems:'center', background:'rgba(121,192,255,.1)', color:'var(--blue)' }}>
                    <Icon size={20} />
                  </div>
                  <span style={{ padding:'4px 8px', borderRadius:999, background:'var(--bg3)', color:'var(--text3)', fontSize:11, fontWeight:800 }}>
                    {item.tag}
                  </span>
                </div>
                <div style={{ fontSize:17, fontWeight:900, marginBottom:8 }}>{item.title}</div>
                <div style={{ color:'var(--text2)', lineHeight:1.7, fontSize:14 }}>{item.desc}</div>
              </div>
            )
          })}
        </div>
      </section>

      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '80px 24px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>{txt('사용 시나리오', 'Use Cases')}</div>
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 900, marginBottom: 10 }}>{txt('학습 방식에 맞게 루틴을 잡습니다', 'Shape the routine around how you learn')}</h2>
          <p style={{ maxWidth: 620, margin: '0 auto', color: 'var(--text2)', lineHeight: 1.7 }}>{txt('데일리코딩은 학습, 피드백, 경쟁을 하나의 흐름으로 엮어 진짜 실력 향상에 집중할 수 있게 합니다.', 'DailyCoding ties learning, feedback, and competition into one flow so you can focus on real improvement.')}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
          {localizedScenarios.map((item, index) => (
            <div key={item.name} className={`card card-hover animate-fade-in-up animate-delay-${Math.min(index + 1, 3)}`} style={{ padding: '22px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontWeight: 800 }}>{item.name}</div>
                <span style={{ padding: '4px 8px', borderRadius: 999, background: 'var(--bg3)', color: 'var(--blue)', fontSize: 11, fontWeight: 700 }}>{getTierLabel(item.tier, lang)}</span>
              </div>
              <div style={{ color: 'var(--text2)', lineHeight: 1.7, fontSize: 14, minHeight: 72 }}>{item.text}</div>
              <div style={{ marginTop: 18, fontSize: 12, color: 'var(--text3)' }}>{item.company}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '56px 24px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>{txt('사용 방법', 'How It Works')}</div>
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 900, marginBottom: 10 }}>{txt('어떻게 시작하나요?', 'How do I start?')}</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18, alignItems: 'stretch' }}>
          {localizedSteps.map((step, index) => (
            <div key={step.id} className={`card card-hover animate-fade-in-up animate-delay-${Math.min(index + 1, 3)}`} style={{ padding: '22px 20px', position: 'relative' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--gradient-brand)', color: '#0d1117', display: 'grid', placeItems: 'center', fontWeight: 900, marginBottom: 14 }}>{step.id}</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>0{step.id}. {step.title}</div>
              <div style={{ color: 'var(--text2)', lineHeight: 1.7, fontSize: 14 }}>{step.desc}</div>
              {index < localizedSteps.length - 1 && (
                <ArrowRight size={18} style={{ position: 'absolute', top: 28, right: 16, color: 'var(--text3)' }} />
              )}
            </div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '56px 24px 88px' }}>
        <div className="card" style={{ padding: '26px 24px', background: 'linear-gradient(135deg, rgba(121,192,255,.08), rgba(210,168,255,.08))' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 18 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>{txt('요금제 미리보기', 'Pricing Preview')}</div>
              <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>{txt('언제든 유료 플랜으로 업그레이드 가능합니다', 'Upgrade to a paid plan anytime')}</div>
              <div style={{ color: 'var(--text2)', lineHeight: 1.7 }}>
                {PLAN_META.pro.name} {PLAN_META.pro.compactPrice[lang] ?? PLAN_META.pro.compactPrice.ko} ·{' '}
                {PLAN_META.team.name} {PLAN_META.team.compactPrice[lang] ?? PLAN_META.team.compactPrice.ko}.
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12 }}>
              {[
                { name:txt('무료', 'Free'), price:'Free', accent:'var(--text3)' },
                { name:PLAN_META.pro.name, price:PLAN_META.pro.compactPrice[lang] ?? PLAN_META.pro.compactPrice.ko, accent:'var(--blue)' },
                { name:PLAN_META.team.name, price:PLAN_META.team.compactPrice[lang] ?? PLAN_META.team.compactPrice.ko, accent:'#f2cc60' },
              ].map((plan) => (
                <div key={plan.name} style={{ padding:'14px 16px', borderRadius:18, background:'var(--bg2)', border:`1px solid ${plan.accent}30` }}>
                  <div style={{ fontSize:12, color:plan.accent, fontWeight:900, letterSpacing:'.08em' }}>{plan.name}</div>
                  <div style={{ fontSize:24, fontWeight:900, marginTop:6 }}>{plan.price}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              <button className="btn btn-ghost" onClick={onPricing}>{txt('요금제 보기', 'View Pricing')}</button>
              <button className="btn btn-primary" onClick={onSignup}>{txt('시작하기', 'Get Started')}</button>
            </div>
          </div>
        </div>
      </section>

      <footer style={{ background: 'var(--bg2)', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '36px 24px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 24 }}>
          {footerGroups.map((group) => (
            <div key={group.title}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>{group.title}</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {group.links.map((link) => (
                  link.href ? (
                    <a key={link.label} href={link.href} style={{ color: 'var(--text2)', textDecoration: 'none', fontSize: 13 }}>
                      {link.label}
                    </a>
                  ) : (
                    <button key={link.label} onClick={link.action} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'var(--text2)', cursor: 'pointer', fontSize: 13 }}>
                      {link.label}
                    </button>
                  )
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', color: 'var(--text3)', fontSize: 12 }}>
          <div>© 2026 DailyCoding. All rights reserved.</div>
          <button className="btn btn-ghost" onClick={toggleTheme}>{theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />} {txt('테마 변경', 'Change Theme')}</button>
        </div>
      </footer>
    </div>
  )
}
