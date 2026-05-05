import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, PlayCircle, Moon, Sun, Sparkles, Star, Target, Swords, Bot, RotateCcw } from 'lucide-react'
import { useTheme } from '../context/ThemeContext.jsx'
import './LandingPage.css'
import { TIER_THRESHOLDS } from '../data/constants.js'
import { PLAN_META } from '../data/pricingPlans.js'

const TESTIMONIALS = [
  { name: '김개발', tier: 'gold', text: '매일 한 문제씩 풀다 보니 실력이 눈에 띄게 늘었어요.', company: '카카오 인턴' },
  { name: '이코딩', tier: 'platinum', text: '오답을 다시 풀어야 할 순서가 보여서 복습이 덜 밀립니다.', company: '스타트업 재직중' },
  { name: '박알고', tier: 'silver', text: '배틀보다 평소 루틴 기록이 더 자극돼요. 꾸준히 들어오게 됩니다.', company: '대학원생' },
]

const TIERS = [
  { name: 'Iron',        label: '아이언',      color: '#a8a8a8', range: `${TIER_THRESHOLDS.iron.toLocaleString('ko-KR')} - ${(TIER_THRESHOLDS.bronze - 1).toLocaleString('ko-KR')}점` },
  { name: 'Bronze',      label: '브론즈',      color: '#cd7f32', range: `${TIER_THRESHOLDS.bronze.toLocaleString('ko-KR')} - ${(TIER_THRESHOLDS.silver - 1).toLocaleString('ko-KR')}점` },
  { name: 'Silver',      label: '실버',        color: '#c0c0c0', range: `${TIER_THRESHOLDS.silver.toLocaleString('ko-KR')} - ${(TIER_THRESHOLDS.gold - 1).toLocaleString('ko-KR')}점` },
  { name: 'Gold',        label: '골드',        color: '#ffd700', range: `${TIER_THRESHOLDS.gold.toLocaleString('ko-KR')} - ${(TIER_THRESHOLDS.platinum - 1).toLocaleString('ko-KR')}점` },
  { name: 'Platinum',    label: '플래티넘',    color: '#00e5cc', range: `${TIER_THRESHOLDS.platinum.toLocaleString('ko-KR')} - ${(TIER_THRESHOLDS.emerald - 1).toLocaleString('ko-KR')}점` },
  { name: 'Emerald',     label: '에메랄드',    color: '#00d18f', range: `${TIER_THRESHOLDS.emerald.toLocaleString('ko-KR')} - ${(TIER_THRESHOLDS.diamond - 1).toLocaleString('ko-KR')}점` },
  { name: 'Diamond',     label: '다이아몬드',  color: '#b9f2ff', range: `${TIER_THRESHOLDS.diamond.toLocaleString('ko-KR')} - ${(TIER_THRESHOLDS.master - 1).toLocaleString('ko-KR')}점` },
  { name: 'Master',      label: '마스터',      color: '#9b59b6', range: `${TIER_THRESHOLDS.master.toLocaleString('ko-KR')} - ${(TIER_THRESHOLDS.grandmaster - 1).toLocaleString('ko-KR')}점` },
  { name: 'Grandmaster', label: '그랜드마스터',color: '#e74c3c', range: `${TIER_THRESHOLDS.grandmaster.toLocaleString('ko-KR')}점 이상` },
  { name: 'Challenger',  label: '챌린저',      color: '#f1c40f', range: '상위 3명' },
]

const STATS = [
  { value: 5000, suffix: '+', label: '문제 풀이 완료' },
  { value: 1200, suffix: '+', label: '회원' },
  { value: 98, suffix: '%', label: '정확도' },
  { value: 5, suffix: '개', label: '언어 지원' },
]

const STEPS = [
  { id: 1, title: '회원가입', desc: '30초 안에 가입하고 바로 문제 풀이를 시작합니다.' },
  { id: 2, title: '오늘의 루틴 실행', desc: '추천 문제, 오답 복구, 일일 미션을 한 화면에서 처리합니다.' },
  { id: 3, title: 'XP와 프로필 보상', desc: '랭킹과 분리된 경험치로 배지, 칭호, 프로필 배경을 해금합니다.' },
]

const DIFFERENTIATORS = [
  {
    icon: Target,
    title: '오늘 할 일이 보이는 학습 루틴',
    desc: '문제 목록을 던져주는 데서 끝나지 않고, 대시보드에서 추천 문제와 미션, 주간 챌린지를 바로 이어줍니다.',
    tag: 'Daily loop',
  },
  {
    icon: RotateCcw,
    title: '오답을 다시 잡는 복구 큐',
    desc: '최근 실패 제출을 원인별로 정리해 재도전과 AI 오답 코치로 연결합니다.',
    tag: 'Recovery',
  },
  {
    icon: Swords,
    title: '혼자 푸는 연습을 배틀로 확장',
    desc: '실시간 1:1 배틀과 랭킹을 통해 짧은 압박 상황에서도 풀이 속도와 정확도를 점검합니다.',
    tag: 'Battle',
  },
  {
    icon: Bot,
    title: '필요할 때만 쓰는 제출 코치',
    desc: '힌트와 코드 리뷰는 제출 기록 옆에서 보조 도구로 작동합니다. 중심은 풀이 기록과 복습 루틴입니다.',
    tag: 'Coach',
  },
  {
    icon: Star,
    title: '랭킹을 건드리지 않는 XP 보상',
    desc: '일일 미션은 권위가 걸린 랭킹 점수가 아니라 배지, 칭호, 프로필 배경을 여는 개인 성장 보상으로 쌓입니다.',
    tag: 'Rewards',
  },
]

const CODE_LINES = [
  'function solve(input) {',
  '  const values = input.trim().split("\\n")',
  '  return values.map(Number).reduce((sum, n) => sum + n, 0)',
  '}',
  'console.log(solve("1\\n2\\n3")) // 6',
]

function useCountUp(enabled) {
  const [values, setValues] = useState(STATS.map(() => 0))

  useEffect(() => {
    if (!enabled) return undefined
    const startedAt = performance.now()
    let frame = 0

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / 1000)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValues(STATS.map((item) => Math.round(item.value * eased)))
      if (progress < 1) frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [enabled])

  return values
}

export default function LandingPage({ onLogin, onSignup, onPricing }) {
  const { theme, toggleTheme } = useTheme()
  const statsRef = useRef(null)
  const [statsVisible, setStatsVisible] = useState(false)
  const [typedText, setTypedText] = useState('')
  const countValues = useCountUp(statsVisible)

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
            <button className="btn btn-ghost" onClick={onPricing}>요금제</button>
            <button className="btn btn-ghost" onClick={onLogin}>로그인</button>
            <button className="btn btn-primary" onClick={onSignup}>무료로 시작하기</button>
            <button className="btn btn-ghost" onClick={toggleTheme} aria-label="theme toggle">
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>

        <section className="landing-hero-grid" style={{ maxWidth: 1200, margin: '0 auto', padding: '72px 24px 64px', display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, .9fr)', gap: 28, alignItems: 'center' }}>
          <div className="animate-fade-in-up">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999, background: 'rgba(121,192,255,.1)', border: '1px solid rgba(121,192,255,.2)', color: 'var(--blue)', fontSize: 12, fontWeight: 700, marginBottom: 20 }}>
              <Star size={14} />
              문제 풀이 · 오답 복구 · 프로필 성장
            </div>
            <h1 style={{ fontSize: 'clamp(42px, 8vw, 72px)', lineHeight: 1.03, fontWeight: 900, letterSpacing: 0, marginBottom: 18 }}>
              <span className="gradient-text">매일 푸는</span><br />
              코딩 루틴
            </h1>
            <p style={{ fontSize: 18, color: 'var(--text2)', lineHeight: 1.75, maxWidth: 640, marginBottom: 28 }}>
              DailyCoding은 오늘 풀 문제, 다시 잡을 오답, 쌓이는 XP를 한 흐름으로 보여줍니다.
              경쟁 점수는 공정하게 두고, 꾸준함은 배지와 칭호, 프로필 배경으로 남깁니다.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
              <button className="btn btn-primary pulse-cta" onClick={onSignup} style={{ padding: '14px 22px', fontSize: 15 }}>
                무료로 시작하기 <ArrowRight size={16} />
              </button>
              <button className="btn btn-ghost" onClick={() => document.getElementById('landing-demo')?.scrollIntoView({ behavior: 'smooth' })} style={{ padding: '14px 22px', fontSize: 15 }}>
                데모 보기 <PlayCircle size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {tierRows.map((tier) => (
                <span key={tier.name} style={{ padding: '6px 10px', borderRadius: 999, background: `${tier.color}14`, border: `1px solid ${tier.color}30`, color: tier.color, fontSize: 12, fontWeight: 700 }}>
                  {tier.label}
                </span>
              ))}
            </div>
          </div>

          <div id="landing-demo" className="animate-fade-in-up animate-delay-2">
            <div className="card card-hover glow-blue" style={{ padding: 18, background: 'rgba(13,17,23,.75)', border: '1px solid rgba(121,192,255,.18)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>Live Editor Preview</div>
                  <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>오늘의 합계 문제</div>
                </div>
                <span className="badge badge-blue">Python 3</span>
              </div>
              <div style={{ background: '#0b0f14', borderRadius: 16, border: '1px solid rgba(121,192,255,.15)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid rgba(121,192,255,.1)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f85149' }} />
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#e3b341' }} />
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#56d364' }} />
                  <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text3)' }}>sum-problem.py</span>
                </div>
                <pre style={{ margin: 0, minHeight: 260, padding: '18px 18px 22px', color: '#c9d1d9', fontSize: 13, lineHeight: 1.8, fontFamily: "'Space Mono', monospace", whiteSpace: 'pre-wrap' }}>
{typedText}
<span style={{ color: 'var(--blue)' }}>|</span>
                </pre>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 14 }}>
                <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(86,211,100,.08)', border: '1px solid rgba(86,211,100,.18)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>AI Review</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>시간복잡도 O(n) 유지</div>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(121,192,255,.08)', border: '1px solid rgba(121,192,255,.18)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Battle Ready</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>실시간 제출/비교 지원</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section ref={statsRef} style={{ background: 'var(--bg2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '18px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          {STATS.map((item, index) => (
            <div key={item.label} className={`animate-fade-in-up animate-delay-${Math.min(index + 1, 3)}`} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "'Space Mono', monospace", color: 'var(--blue)' }}>
                {countValues[index].toLocaleString('ko-KR')}{item.suffix}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '72px 24px 16px' }}>
        <div style={{ marginBottom: 34 }}>
          <div style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>Why DailyCoding</div>
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 900, marginBottom: 10 }}>문제만 많은 사이트가 아니라, 다시 풀게 만드는 플랫폼</h2>
          <p style={{ maxWidth: 720, color: 'var(--text2)', lineHeight: 1.7 }}>
            Codeforces식 대회 문화, solved.ac식 티어 정보, HackerRank식 AI 평가와 다르게 DailyCoding은 매일의 루틴, 오답 복구, AI 코치, 배틀을 한 화면에서 이어주는 데 집중합니다.
          </p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(230px, 1fr))', gap:16 }}>
          {DIFFERENTIATORS.map((item, index) => {
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
          <div style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>Social Proof</div>
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 900, marginBottom: 10 }}>성장하는 개발자들이 먼저 선택했습니다</h2>
          <p style={{ maxWidth: 620, margin: '0 auto', color: 'var(--text2)', lineHeight: 1.7 }}>DailyCoding은 학습, 피드백, 경쟁을 한 흐름으로 묶어 실제 실력 향상에 집중합니다.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
          {TESTIMONIALS.map((item, index) => (
            <div key={item.name} className={`card card-hover animate-fade-in-up animate-delay-${Math.min(index + 1, 3)}`} style={{ padding: '22px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontWeight: 800 }}>{item.name}</div>
                <span style={{ padding: '4px 8px', borderRadius: 999, background: 'var(--bg3)', color: 'var(--blue)', fontSize: 11, fontWeight: 700 }}>{item.tier.toUpperCase()}</span>
              </div>
              <div style={{ color: 'var(--text2)', lineHeight: 1.7, fontSize: 14, minHeight: 72 }}>"{item.text}"</div>
              <div style={{ marginTop: 18, fontSize: 12, color: 'var(--text3)' }}>{item.company}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '56px 24px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>How It Works</div>
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 900, marginBottom: 10 }}>어떻게 작동하나요?</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18, alignItems: 'stretch' }}>
          {STEPS.map((step, index) => (
            <div key={step.id} className={`card card-hover animate-fade-in-up animate-delay-${Math.min(index + 1, 3)}`} style={{ padding: '22px 20px', position: 'relative' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--gradient-brand)', color: '#0d1117', display: 'grid', placeItems: 'center', fontWeight: 900, marginBottom: 14 }}>{step.id}</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>0{step.id}. {step.title}</div>
              <div style={{ color: 'var(--text2)', lineHeight: 1.7, fontSize: 14 }}>{step.desc}</div>
              {index < STEPS.length - 1 && (
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
              <div style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>요금제 미리보기</div>
              <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>상업적 플랜 구성으로 바로 전환 가능합니다</div>
              <div style={{ color: 'var(--text2)', lineHeight: 1.7 }}>
                {PLAN_META.pro.name} 월 ${PLAN_META.pro.monthlyPrice} / 연 ${PLAN_META.pro.annualPrice},
                {PLAN_META.team.name} 월 ${PLAN_META.team.monthlyPrice} / 연 ${PLAN_META.team.annualPrice}입니다.
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12 }}>
              {[
                { name:'무료', price:'무료', accent:'var(--text3)' },
                { name:PLAN_META.pro.name, price:PLAN_META.pro.compactPrice, accent:'var(--blue)' },
                { name:PLAN_META.team.name, price:PLAN_META.team.compactPrice, accent:'#f2cc60' },
              ].map((plan) => (
                <div key={plan.name} style={{ padding:'14px 16px', borderRadius:18, background:'var(--bg2)', border:`1px solid ${plan.accent}30` }}>
                  <div style={{ fontSize:12, color:plan.accent, fontWeight:900, letterSpacing:'.08em' }}>{plan.name}</div>
                  <div style={{ fontSize:24, fontWeight:900, marginTop:6 }}>{plan.price}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              <button className="btn btn-ghost" onClick={onPricing}>요금제 보기</button>
              <button className="btn btn-primary" onClick={onSignup}>시작하기</button>
            </div>
          </div>
        </div>
      </section>

      <footer style={{ background: 'var(--bg2)', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '36px 24px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 24 }}>
          {[
            { title: '제품', links: ['문제', '랭킹', '요금제', '커뮤니티'] },
            { title: '리소스', links: ['도움말', '문의하기', 'API 상태', '가이드'] },
            { title: '회사', links: ['이용약관', '개인정보처리방침', '학생 할인', '채용'] },
            { title: '소셜', links: ['GitHub', 'Discord', 'Blog', 'Instagram'] },
          ].map((group) => (
            <div key={group.title}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>{group.title}</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {group.links.map((link) => (
                  <button key={link} onClick={link === '요금제' ? onPricing : undefined} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'var(--text2)', cursor: link === '요금제' ? 'pointer' : 'default', fontSize: 13 }}>
                    {link}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', color: 'var(--text3)', fontSize: 12 }}>
          <div>© 2026 DailyCoding. All rights reserved.</div>
          <button className="btn btn-ghost" onClick={toggleTheme}>{theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />} 테마 전환</button>
        </div>
      </footer>
    </div>
  )
}
