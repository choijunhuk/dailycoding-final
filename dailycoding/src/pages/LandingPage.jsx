import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, PlayCircle, Moon, Sun, Sparkles, Star, Target, Swords, Bot, RotateCcw } from 'lucide-react'
import { useTheme } from '../context/ThemeContext.jsx'
import './LandingPage.css'
import { TIER_THRESHOLDS } from '../data/constants.js'
import { PLAN_META } from '../data/pricingPlans.js'
import api from '../api.js'

const TESTIMONIALS = [
  { name: 'KimDev', tier: 'gold', text: 'Solving one problem a day has made a noticeable difference in my skills.', company: 'Kakao Intern' },
  { name: 'LeeCoding', tier: 'platinum', text: 'Seeing which wrong answers to retry keeps my review backlog from piling up.', company: 'Startup Employee' },
  { name: 'ParkAlgo', tier: 'silver', text: 'Tracking my daily routine is more motivating than battles. I keep coming back.', company: 'Graduate Student' },
]

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

const STATS = [
  { value: 5000, suffix: '+', label: 'Problems Solved' },
  { value: 1200, suffix: '+', label: 'Members' },
  { value: 98, suffix: '%', label: 'Accuracy' },
  { value: 5, suffix: '', label: 'Battle Modes' },
]

const STEPS = [
  { id: 1, title: 'Sign Up', desc: 'Create an account in 30 seconds and start solving problems right away.' },
  { id: 2, title: 'Run Your Daily Routine', desc: 'Handle recommended problems, wrong-answer recovery, and daily missions all in one screen.' },
  { id: 3, title: 'Earn XP & Profile Rewards', desc: 'Unlock badges, titles, and profile backgrounds with XP that is separate from your ranking score.' },
]

const DIFFERENTIATORS = [
  {
    icon: Target,
    title: 'A Daily Routine That Shows You What to Do',
    desc: 'It does not stop at handing you a problem list — the dashboard connects recommended problems, missions, and weekly challenges in one flow.',
    tag: 'Daily loop',
  },
  {
    icon: RotateCcw,
    title: 'A Recovery Queue That Tackles Wrong Answers',
    desc: 'Recent failed submissions are organized by root cause and linked to retry attempts and an AI wrong-answer coach.',
    tag: 'Recovery',
  },
  {
    icon: Swords,
    title: 'Extend Solo Practice into Battles',
    desc: 'Real-time 1v1 battles, ghost races, and the daily dungeon let you check your solving speed and accuracy even under short bursts of pressure.',
    tag: 'Battle',
  },
  {
    icon: Bot,
    title: 'A Submission Coach You Use Only When Needed',
    desc: 'Hints and code review work as supporting tools alongside your submission history. The focus stays on your solve record and review routine.',
    tag: 'Coach',
  },
  {
    icon: Star,
    title: 'XP Rewards That Leave Your Ranking Untouched',
    desc: 'Daily missions accumulate as personal growth rewards — badges, titles, and profile backgrounds — not as ranking points with competitive stakes.',
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
  const [activeBattleCount, setActiveBattleCount] = useState(null)
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
            <button className="btn btn-ghost" onClick={onPricing}>Pricing</button>
            <button className="btn btn-ghost" onClick={onLogin}>Log In</button>
            <button className="btn btn-primary" onClick={onSignup}>Get Started Free</button>
            <button className="btn btn-ghost" onClick={toggleTheme} aria-label="theme toggle">
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>

        <section className="landing-hero-grid" style={{ maxWidth: 1200, margin: '0 auto', padding: '72px 24px 64px', display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, .9fr)', gap: 28, alignItems: 'center' }}>
          <div className="animate-fade-in-up">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999, background: 'rgba(121,192,255,.1)', border: '1px solid rgba(121,192,255,.2)', color: 'var(--blue)', fontSize: 12, fontWeight: 700, marginBottom: 20 }}>
              <Swords size={14} />
              Real-time 1v1 algorithm battles unlike any other coding platform
            </div>
            <h1 style={{ fontSize: 'clamp(42px, 8vw, 72px)', lineHeight: 1.03, fontWeight: 900, letterSpacing: 0, marginBottom: 18 }}>
              <span className="gradient-text">Battle in Real Time,</span><br />
              Build a Daily Coding Habit
            </h1>
            <p style={{ fontSize: 18, color: 'var(--text2)', lineHeight: 1.75, maxWidth: 640, marginBottom: 28 }}>
              Train under solving pressure with 5 real-time battle modes featuring HP, items, problem effects, and territory capture.
              Between battles, stay consistent with daily problems, wrong-answer recovery, and XP rewards.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
              <button className="btn btn-primary pulse-cta" onClick={onSignup} style={{ padding: '14px 22px', fontSize: 15 }}>
                Get Started Free <ArrowRight size={16} />
              </button>
              <button className="btn btn-ghost" onClick={() => document.getElementById('landing-demo')?.scrollIntoView({ behavior: 'smooth' })} style={{ padding: '14px 22px', fontSize: 15 }}>
                See Demo <PlayCircle size={16} />
              </button>
            </div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:24}}>
              {['⚡ Speed', '💀 Survival', '✨ Effects', '🎒 Items', '🏴 Territory', '👻 Ghost', '🐉 Dungeon'].map((mode) => (
                <span key={mode} style={{padding:'7px 10px',borderRadius:999,background:'var(--bg2)',border:'1px solid var(--border)',fontSize:12,fontWeight:800,color:'var(--text2)'}}>
                  {mode}
                </span>
              ))}
              <span style={{padding:'7px 10px',borderRadius:999,background:'rgba(248,81,73,.1)',border:'1px solid rgba(248,81,73,.24)',fontSize:12,fontWeight:900,color:'var(--red)'}}>
                {activeBattleCount == null ? '-' : activeBattleCount.toLocaleString()} battles live now
              </span>
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
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>Live Battle Preview</div>
                  <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>HP 100 · Item Brawl</div>
                </div>
                <span className="badge badge-blue">LIVE</span>
              </div>
              <div style={{ background: '#0b0f14', borderRadius: 16, border: '1px solid rgba(121,192,255,.15)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid rgba(121,192,255,.1)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f85149' }} />
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#e3b341' }} />
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#56d364' }} />
                  <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text3)' }}>sum-problem.py</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,padding:'12px 14px',borderBottom:'1px solid rgba(121,192,255,.1)'}}>
                  <div style={{padding:10,borderRadius:12,background:'rgba(63,185,80,.08)',border:'1px solid rgba(63,185,80,.18)'}}>
                    <div style={{fontSize:11,color:'var(--text3)'}}>You</div>
                    <div style={{fontWeight:900,color:'#56d364'}}>HP 72 · 320 pts</div>
                  </div>
                  <div style={{padding:10,borderRadius:12,background:'rgba(248,81,73,.08)',border:'1px solid rgba(248,81,73,.18)'}}>
                    <div style={{fontSize:11,color:'var(--text3)'}}>Opponent</div>
                    <div style={{fontWeight:900,color:'#f85149'}}>HP 41 · 280 pts</div>
                  </div>
                </div>
                <pre style={{ margin: 0, minHeight: 220, padding: '18px 18px 22px', color: '#c9d1d9', fontSize: 13, lineHeight: 1.8, fontFamily: "'Space Mono', monospace", whiteSpace: 'pre-wrap' }}>
{typedText}
<span style={{ color: 'var(--blue)' }}>|</span>
                </pre>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 14 }}>
                <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(86,211,100,.08)', border: '1px solid rgba(86,211,100,.18)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Correct</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>⚔️ Opponent HP -28</div>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(121,192,255,.08)', border: '1px solid rgba(121,192,255,.18)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Territory</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>5 problems captured</div>
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
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 900, marginBottom: 10 }}>Not just a site with lots of problems — a platform that brings you back to solve them again</h2>
          <p style={{ maxWidth: 720, color: 'var(--text2)', lineHeight: 1.7 }}>
            Unlike Codeforces-style contest culture, solved.ac-style tier info, or HackerRank-style AI grading, DailyCoding focuses on connecting your daily routine, wrong-answer recovery, AI coach, and battles in a single flow.
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
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 900, marginBottom: 10 }}>Chosen first by developers who are serious about growth</h2>
          <p style={{ maxWidth: 620, margin: '0 auto', color: 'var(--text2)', lineHeight: 1.7 }}>DailyCoding ties learning, feedback, and competition into one flow so you can focus on real skill improvement.</p>
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
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 900, marginBottom: 10 }}>How does it work?</h2>
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
              <div style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>Pricing Preview</div>
              <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>Ready to upgrade to a commercial plan anytime</div>
              <div style={{ color: 'var(--text2)', lineHeight: 1.7 }}>
                {PLAN_META.pro.name} ${PLAN_META.pro.monthlyPrice}/mo · ${PLAN_META.pro.annualPrice}/yr,{' '}
                {PLAN_META.team.name} ${PLAN_META.team.monthlyPrice}/mo · ${PLAN_META.team.annualPrice}/yr.
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12 }}>
              {[
                { name:'Free', price:'Free', accent:'var(--text3)' },
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
              <button className="btn btn-ghost" onClick={onPricing}>View Pricing</button>
              <button className="btn btn-primary" onClick={onSignup}>Get Started</button>
            </div>
          </div>
        </div>
      </section>

      <footer style={{ background: 'var(--bg2)', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '36px 24px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 24 }}>
          {[
            { title: 'Product', links: ['Problems', 'Ranking', 'Pricing', 'Community'] },
            { title: 'Resources', links: ['Help', 'Contact', 'API Status', 'Guide'] },
            { title: 'Company', links: ['Terms of Service', 'Privacy Policy', 'Student Discount', 'Careers'] },
            { title: 'Social', links: ['GitHub', 'Discord', 'Blog', 'Instagram'] },
          ].map((group) => (
            <div key={group.title}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>{group.title}</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {group.links.map((link) => (
                  <button key={link} onClick={link === 'Pricing' ? onPricing : undefined} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'var(--text2)', cursor: link === 'Pricing' ? 'pointer' : 'default', fontSize: 13 }}>
                    {link}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', color: 'var(--text3)', fontSize: 12 }}>
          <div>© 2026 DailyCoding. All rights reserved.</div>
          <button className="btn btn-ghost" onClick={toggleTheme}>{theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />} Toggle Theme</button>
        </div>
      </footer>
    </div>
  )
}
