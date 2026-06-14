import { memo, useState, useEffect, useRef, useCallback } from 'react';
import './Dashboard.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext.jsx';
import { TIERS } from '../data/problems';
import api from '../api.js';
import { useRankingData } from '../hooks/useRankingData.js';
import { BarChart3, BookOpen, Bot, CheckCircle2, FileText, Flame, Sparkles, Swords, Target, TrendingUp, Trophy } from 'lucide-react';
import ProfileAvatar from '../components/ProfileAvatar';
import OnboardingModal from '../components/OnboardingModal.jsx';
import { useLang } from '../context/LangContext.jsx';
import { withVars } from '../utils/languageMode.js';
import { buildDailyFocusPlan } from './dashboardPlanUtils.js';
import { getTagLabelLang } from './problemsPageUtils.js';
import { getTierLabel } from '../utils/labelMaps.js';
import { copyText } from '../utils/clipboard.js';

const TIER_META = {
  unranked:    { label:'Unranked',    color:'#888',    next:'Iron',        bg:'rgba(136,136,136,.06)' },
  iron:        { label:'Iron',        color:'#a8a8a8', next:'Bronze',      bg:'rgba(168,168,168,.06)' },
  bronze:      { label:'Bronze',      color:'#cd7f32', next:'Silver',      bg:'rgba(205,127,50,.08)'  },
  silver:      { label:'Silver',      color:'#c0c0c0', next:'Gold',        bg:'rgba(192,192,192,.08)' },
  gold:        { label:'Gold',        color:'#ffd700', next:'Platinum',    bg:'rgba(255,215,0,.08)'   },
  platinum:    { label:'Platinum',    color:'#00e5cc', next:'Emerald',     bg:'rgba(0,229,204,.08)'   },
  emerald:     { label:'Emerald',     color:'#00d18f', next:'Diamond',     bg:'rgba(0,209,143,.08)'   },
  diamond:     { label:'Diamond',     color:'#b9f2ff', next:'Master',      bg:'rgba(185,242,255,.08)' },
  master:      { label:'Master',      color:'#9b59b6', next:'Grandmaster', bg:'rgba(155,89,182,.08)'  },
  grandmaster: { label:'Grandmaster', color:'#e74c3c', next:'Challenger',  bg:'rgba(231,76,60,.08)'   },
  challenger:  { label:'Challenger',  color:'#f1c40f', next:'MAX',         bg:'rgba(241,196,15,.08)'  },
};

const DAILY_FOCUS_ICONS = {
  target: Target,
  file: FileText,
  trophy: Trophy,
  bot: Bot,
  swords: Swords,
};

const StatCard = memo(function StatCard({ icon, value, label, color, sub, delta, onClick }) {
  const [displayed, setDisplayed] = useState(0);
  const ref = useRef(false);
  useEffect(() => {
    if (ref.current) return;
    ref.current = true;
    const target = Number(value) || 0;
    if (!target) { setDisplayed(value); return; }
    let s = 0; const steps = 30;
    const t = setInterval(() => {
      s++;
      setDisplayed(Math.floor(target * (1 - Math.pow(1 - s/steps, 3))));
      if (s >= steps) { setDisplayed(target); clearInterval(t); }
    }, 900/steps);
    return () => clearInterval(t);
  }, [value]);

  return (
    <div className="card card-pad card-hover" style={{
      display:'flex', alignItems:'center', gap:16,
      position:'relative', overflow:'hidden',
      transition:'border-color .2s, box-shadow .2s',
      cursor: onClick ? 'pointer' : 'default',
    }}
      onClick={onClick}
      onMouseEnter={e=>{e.currentTarget.style.borderColor=`${color}50`;e.currentTarget.style.boxShadow=`0 8px 28px rgba(0,0,0,.3), 0 0 0 1px ${color}20`;}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.boxShadow='';}}
    >
      <div className="stat-card-accent" style={{background:`linear-gradient(90deg, ${color}80, ${color}20)`}} />
      <div style={{
        width:48,height:48,borderRadius:14,
        background:`linear-gradient(135deg, ${color}25, ${color}08)`,
        border:`1px solid ${color}20`,
        display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0,
        color,
      }}>{icon}</div>
      <div>
        <div style={{
          fontFamily:'Space Mono,monospace',fontSize:22,fontWeight:700,color,lineHeight:1,
        }}>{typeof displayed==='number'?displayed.toLocaleString():displayed}</div>
        <div style={{fontSize:12,color:'var(--text2)',marginTop:3}}>{label}</div>
        {sub&&<div style={{fontSize:11,color:'var(--text3)',marginTop:1}}>{sub}</div>}
        {delta&&<div style={{fontSize:11,color:'var(--green)',marginTop:3,fontWeight:700}}>{delta}</div>}
      </div>
    </div>
  );
});

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, isAdmin, applyUser } = useAuth();
  const { solved, grassData, problems: appProblems } = useApp();
  const toast = useToast();
  const { t, lang } = useLang();
  const txt = (ko, en) => lang === 'ko' ? ko : en;
  const tierLbl = (tier) => getTierLabel(tier, lang || 'ko') || tier;
  const CAUSE_KO = { 'Wrong Answer': '오답', 'Compile Error': '컴파일 오류', 'Time Limit Exceeded': '시간 초과', 'Runtime Error': '런타임 오류', 'Memory Limit Exceeded': '메모리 초과' };
  const [weeklyChallenge, setWeeklyChallenge] = useState(null);
  const [missions, setMissions] = useState([]);
  const [followFeed, setFollowFeed] = useState([]);
  const [promotion, setPromotion] = useState({ active: null, recent: null });
  const [referral, setReferral] = useState(null);
  const [recoveryQueue, setRecoveryQueue] = useState({ count: 0, items: [], summary: '' });
  const [progression, setProgression] = useState(null);
  const [battleSummary, setBattleSummary] = useState({ total: 0, wins: 0, draws: 0, losses: 0, winRate: 0, recent: [] });
  const [gameSummary, setGameSummary] = useState({ ghost: 0, dungeon: 0, territory: 0 });
  const [reviewQueue, setReviewQueue] = useState([]);
  const [tagStats, setTagStats] = useState([]);
  const [smartRecommendations, setSmartRecommendations] = useState([]);
  const [reviewQueueLoadFailed, setReviewQueueLoadFailed] = useState(false);
  const [streakFreeze, setStreakFreeze] = useState(null);
  const [onboardingPlan, setOnboardingPlan] = useState(null);
  const [tagStatsLoadFailed, setTagStatsLoadFailed] = useState(false);
  const [gameSummaryLoadFailed, setGameSummaryLoadFailed] = useState(false);
  const [battleSummaryLoadFailed, setBattleSummaryLoadFailed] = useState(false);
  const [adminStats, setAdminStats] = useState(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [copiedReferral, setCopiedReferral] = useState(false);
  const loadErrorToastShownRef = useRef(false);
  const { rankingData } = useRankingData();
  const PROBLEMS = appProblems;
  const recentRank = rankingData.slice(0, 5);
  const myRank = rankingData.find(u => u.id === user?.id)?.rank || null;
  const locale = lang === 'ko' ? 'ko-KR' : 'en-US';
  const tierMeta   = TIER_META[user?.tier] || TIER_META.bronze;
  const solvedList = PROBLEMS.filter(p => solved[p.id]);
  const recentSolved = solvedList.slice(-5).reverse();
  const unsolved   = PROBLEMS.filter(p => !solved[p.id]);
  const todayProb  = unsolved[0] || PROBLEMS[0];
  const recommendedProblems = (smartRecommendations.length > 0 ? smartRecommendations : (unsolved.length > 0 ? unsolved : PROBLEMS)).slice(0, 6);
  const dailyFocusPlan = buildDailyFocusPlan({
    todayProblem: todayProb,
    recoveryQueue,
    weeklyChallenge,
    progression,
    solvedCount: solvedList.length,
    totalProblems: PROBLEMS.length,
    lang,
  });
  const accuracy   = appProblems.length > 0
    ? Math.round((solvedList.length / Math.max(PROBLEMS.length,1)) * 100)
    : 0;
  const activityDays = grassData.filter(g => (g.count || 0) > 0 || g.level > 0).length;
  const activityColor = (count, level) => {
    if ((count || 0) <= 0 && level <= 0) return 'var(--bg3)';
    if ((count || 0) === 1 || level === 1) return 'rgba(86,211,100,.28)';
    if ((count || 0) <= 3 || level === 2) return 'rgba(86,211,100,.5)';
    return 'var(--green)';
  };
  const showLoadErrorToast = useCallback((message = 'Error loading dashboard.') => {
    if (loadErrorToastShownRef.current) return;
    loadErrorToastShownRef.current = true;
    toast?.show(message, 'error');
  }, [toast]);

  useEffect(() => {
    if (!user?.id) {
      setOnboardingOpen(false);
      return;
    }
    setOnboardingOpen(Number(user.onboarding_completed ?? user.onboardingCompleted ?? 0) === 0);
  }, [user?.id, user?.onboarding_completed, user?.onboardingCompleted]);

  const completeOnboarding = useCallback(async () => {
    setOnboardingOpen(false);
    applyUser?.({
      ...user,
      onboarding_completed: 1,
      onboardingCompleted: true,
    });
    try {
      const { data } = await api.patch('/auth/onboarding/complete');
      if (data?.user) applyUser?.(data.user);
    } catch (err) {
      showLoadErrorToast(err?.response?.data?.message || 'Failed to save onboarding completion.');
    }
  }, [applyUser, showLoadErrorToast, user]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    api.get('/submissions/review-queue')
      .then((res) => {
        if (!cancelled) {
          setReviewQueue(res.data || []);
          setReviewQueueLoadFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReviewQueue([]);
          setReviewQueueLoadFailed(true);
        }
      });
    api.get('/submissions/tag-stats').then((res) => {
      const stats = res.data || [];
      if (!cancelled) {
        setTagStats(stats);
        setTagStatsLoadFailed(false);
      }
      const weakTags = stats.filter((item) => item.total >= 2 && Number(item.accuracy) < 50).slice(0, 4).map((item) => item.tag);
      return api.get('/problems/recommend', { params: weakTags.length ? { weakTags: weakTags.join(',') } : {} });
    }).then((res) => {
      if (!cancelled) setSmartRecommendations(res?.data || []);
    }).catch(() => {
      if (!cancelled) {
        setTagStats([]);
        setSmartRecommendations([]);
        setTagStatsLoadFailed(true);
      }
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    api.get('/admin/stats')
      .then(({ data }) => {
        if (!cancelled) setAdminStats(data || null);
      })
      .catch(() => {
        if (!cancelled) setAdminStats(null);
      });
    return () => { cancelled = true; };
  }, [isAdmin]);

  // 레이팅 진행도
  const tierBands = [800,1000,1400,2000,2800,9999];
  const tierIdx   = tierBands.findIndex(t => (user?.rating||800) < t) - 1;
  const ratingMin = tierBands[Math.max(tierIdx,0)];
  const ratingMax = tierBands[Math.min(tierIdx+1, tierBands.length-1)];
  const ratingPct = Math.min(100, Math.max(0,
    ((user?.rating||800) - ratingMin) / (ratingMax - ratingMin) * 100
  ));


  useEffect(() => {
    let cancelled = false;
    api.get('/weekly')
      .then(({ data }) => {
        if (!cancelled) setWeeklyChallenge(data || null);
      })
      .catch((err) => {
        if (!cancelled) setWeeklyChallenge(null);
        if (err?.response?.status !== 401) {
          showLoadErrorToast(err?.response?.data?.message || 'Failed to load weekly challenge.');
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.get('/promotion')
      .then(({ data }) => {
        if (!cancelled) setPromotion(data || { active: null, recent: null });
      })
      .catch((err) => {
        if (!cancelled) setPromotion({ active: null, recent: null });
        if (err?.response?.status !== 401) {
          showLoadErrorToast(err?.response?.data?.message || txt('승급전 정보를 불러오지 못했습니다.', 'Failed to load promotion info.'));
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.get('/follows/feed')
      .then(({ data }) => {
        if (!cancelled) setFollowFeed(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setFollowFeed([]);
        if (err?.response?.status !== 401) {
          showLoadErrorToast(err?.response?.data?.message || 'Failed to load follow feed.');
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.get('/referral/my-code')
      .then(({ data }) => {
        if (!cancelled) setReferral(data);
      })
      .catch(() => {
        if (!cancelled) setReferral(null);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.get('/auth/me/streak-freeze')
      .then(({ data }) => { if (!cancelled) setStreakFreeze(data); })
      .catch(() => { if (!cancelled) setStreakFreeze(null); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.get('/onboarding-plan/today')
      .then(({ data }) => { if (!cancelled && data?.active) setOnboardingPlan(data); })
      .catch(() => { if (!cancelled) setOnboardingPlan(null); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.get('/missions/daily')
      .then(({ data }) => {
        if (!cancelled) setMissions(data.missions || []);
      })
      .catch(() => {
        if (!cancelled) setMissions([]);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.get('/submissions/recovery', { params: { limit: 3 } })
      .then(({ data }) => {
        if (!cancelled) setRecoveryQueue(data || { count: 0, items: [], summary: '' });
      })
      .catch(() => {
        if (!cancelled) setRecoveryQueue({ count: 0, items: [], summary: '' });
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.get('/rewards/progression')
      .then(({ data }) => {
        if (!cancelled) setProgression(data || null);
      })
      .catch(() => {
        if (!cancelled) setProgression(null);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.get('/game/summary')
      .then(({ data }) => {
        if (!cancelled) {
          setGameSummary({
            ghost: data?.ghost?.candidates || 0,
            dungeon: data?.dungeon?.progress?.percent || 0,
            territory: (data?.season?.territories || []).filter((item) => item.controlled).length,
          });
          setGameSummaryLoadFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGameSummary({ ghost: 0, dungeon: 0, territory: 0 });
          setGameSummaryLoadFailed(true);
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.get('/battles/summary')
      .then(({ data }) => {
        if (!cancelled) {
          setBattleSummary(data || { total: 0, wins: 0, draws: 0, losses: 0, winRate: 0, recent: [] });
          setBattleSummaryLoadFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBattleSummary({ total: 0, wins: 0, draws: 0, losses: 0, winRate: 0, recent: [] });
          setBattleSummaryLoadFailed(true);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const adminProblemCount = adminStats?.problemTypeCounts
    ? Object.values(adminStats.problemTypeCounts).reduce((sum, count) => sum + Number(count || 0), 0)
    : PROBLEMS.length;
  const adminActiveToday = adminStats?.userStats?.activeToday ?? 0;
  const adminSubmissionsToday = adminStats?.submissionStats?.totalToday ?? 0;
  const adminCorrectRate = adminStats?.submissionStats?.correctRate ?? 0;

  // 관리자 대시보드
  if (isAdmin) return (
    <div className="dashboard-admin-root" style={{padding:'28px 32px',overflowY:'auto',height:'100%'}}>
      <div style={{marginBottom:28}}>
        <h1 style={{fontSize:22,fontWeight:800,marginBottom:4}}>👑 {t('dashboardAdminTitle')}</h1>
        <p style={{color:'var(--text2)',fontSize:13}}>{t('dashboardAdminDesc')}</p>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:14,marginBottom:28}}>
        <StatCard icon={<BookOpen size={20} />} value={adminProblemCount} label={t('dashboardRegisteredProblems')} color="var(--blue)" />
        <StatCard icon={<Sparkles size={20} />} value={adminActiveToday} label={t('dashboardActiveToday')} color="var(--green)" />
        <StatCard icon={<BarChart3 size={20} />} value={adminSubmissionsToday} label={t('dashboardSubmissionsToday')} color="var(--orange)" />
        <StatCard icon={<CheckCircle2 size={20} />} value={`${adminCorrectRate}%`} label={t('dashboardCorrectRate')} color="var(--yellow)" />
      </div>
      <div className="admin-dash-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div className="card card-pad">
          <div style={{fontWeight:700,fontSize:14,marginBottom:16}}>🏅 {t('dashboardRecentRanking')}</div>
          {recentRank.map((r,i)=>(
            <div key={r.id} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 0',
              borderBottom:i<recentRank.length-1?'1px solid var(--border)':'none'}}>
              <span style={{fontFamily:'Space Mono,monospace',fontSize:12,color:'var(--text3)',width:20}}>{i+1}</span>
              <span style={{flex:1,fontWeight:600,fontSize:13}}>{r.name||r.username}</span>
              <span style={{fontFamily:'Space Mono,monospace',fontSize:12,color:'var(--blue)'}}>{r.rating}</span>
            </div>
          ))}
        </div>
        <div className="card card-pad">
          <div style={{fontWeight:700,fontSize:14,marginBottom:16}}>⚡ {t('quickAction')}</div>
          {[
            {label:t('dashboardCreateProblem'),   icon:<BookOpen size={15} />, page:'admin',    color:'var(--blue)'  },
            {label:t('problemList'),     icon:<BookOpen size={15} />, page:'problems', color:'var(--green)' },
            {label:t('dashboardManageContest'),     icon:<Trophy size={15} />, page:'contest',  color:'var(--yellow)'},
            {label:t('dashboardGenerateAiProblem'),  icon:<Bot size={15} />, page:'admin',    color:'var(--purple)'},
          ].map(a=>(
            <button key={a.label} onClick={()=>navigate('/'+a.page)} className="action-list-btn" style={{'--action-accent':a.color}}>
              {a.icon} {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="dashboard-root" style={{padding:'24px 28px',overflowY:'auto',height:'100%',maxWidth:1200,margin:'0 auto'}}>
      <OnboardingModal open={onboardingOpen} onComplete={completeOnboarding} onSkip={completeOnboarding} />
      {/* 상단 환영 */}
      <div className="dashboard-welcome" style={{
        background:`linear-gradient(135deg, ${tierMeta.bg} 0%, var(--bg2) 100%)`,
        border:`1px solid ${tierMeta.color}30`, borderRadius:14,
        padding:'24px 28px', marginBottom:20,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        flexWrap:'wrap', gap:16,
      }}>
        <div>
          <div style={{fontSize:13,color:'var(--text2)',marginBottom:4}}>
            {new Date().toLocaleDateString(locale,{month:'long',day:'numeric',weekday:'long'})}
          </div>
          <h1 style={{fontSize:22,fontWeight:800,marginBottom:6}}>
            {t('welcome')}, {user?.username}{lang === 'ko' ? '님' : ''} 👋
          </h1>
          <div style={{fontSize:14,color:'var(--text2)',marginBottom:10}}>{t('dashboardGreetingLine')}</div>
          <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
            <span style={{
              padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:700,
              background:tierMeta.bg, color:tierMeta.color,
              border:`1px solid ${tierMeta.color}40`,
            }}>● {tierLbl(user?.tier)}</span>
            <span style={{fontSize:13,color:'var(--text2)'}}>
              {t('rating')} <strong style={{color:'var(--blue)',fontFamily:'Space Mono,monospace'}}>{user?.rating}</strong>
            </span>
            {myRank && <span style={{fontSize:13,color:'var(--text2)'}}>
              {t('ranking')} <strong style={{color:'var(--purple)',fontFamily:'Space Mono,monospace'}}>#{myRank}</strong>
            </span>}
          </div>
          {/* 레이팅 바 */}
          <div style={{marginTop:12,maxWidth:300}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text3)',marginBottom:4}}>
              <span>{tierLbl(user?.tier)}</span>
              <span>{tierLbl(tierMeta.next)} +{ratingMax - (user?.rating||800)} pts</span>
            </div>
            <div style={{height:5,background:'var(--bg3)',borderRadius:3,overflow:'hidden'}}>
              <div style={{
                height:'100%',width:`${ratingPct}%`,borderRadius:3,
                background:`linear-gradient(90deg, ${tierMeta.color}80, ${tierMeta.color})`,
                transition:'width 1s ease',
              }}/>
            </div>
          </div>
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
          <ProfileAvatar
            profile={user}
            size={72}
            style={{cursor:'pointer',flexShrink:0}}
            onClick={() => navigate('/profile')}
          />
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          {[
            {v:t('dashboardStreakValue').replace('{n}', String(user?.streak || 0)), l:t('streak'),          color:'rgba(227,179,65,', icon:'🔥'},
            {v:solvedList.length,                                                   l:t('solved'),           color:'rgba(86,211,100,', icon:'✓'},
            {v:`${accuracy}%`,                                                      l:t('dashboardAccuracy'),color:'rgba(121,192,255,', icon:'◎'},
          ].map(s=>(
            <div key={s.l} className="stat-mini" style={{background:`${s.color}.08)`, border:`1px solid ${s.color}.2)`, position:'relative'}}>
              <div className="stat-mini-value" style={{color:`${s.color}1)`}}>{s.v}</div>
              <div className="stat-mini-label">{s.l}</div>
              {s.l === t('streak') && streakFreeze?.isPro && streakFreeze?.monthlyAllowance > 0 && (
                <div title={`이번 달 streak freeze ${streakFreeze.remaining}/${streakFreeze.monthlyAllowance}개 남음`}
                     style={{
                       position:'absolute', top:6, right:8,
                       fontSize:11, fontWeight:700,
                       color: streakFreeze.remaining > 0 ? 'var(--blue)' : 'var(--text3)',
                       background:'var(--bg2)',
                       border:'1px solid var(--border)',
                       borderRadius:999,
                       padding:'2px 6px',
                       lineHeight:1,
                     }}>
                  ❄ {streakFreeze.remaining}/{streakFreeze.monthlyAllowance}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {onboardingPlan?.active && (
        <div style={{
          marginBottom: 20,
          padding: '16px 20px',
          background: 'linear-gradient(90deg, rgba(108,99,255,.12), rgba(34,211,238,.08))',
          border: '1px solid rgba(108,99,255,.35)',
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', letterSpacing: '.05em' }}>
              온보딩 플랜
            </div>
            <div style={{ fontWeight: 800, fontSize: 17, marginTop: 4 }}>
              Day {onboardingPlan.dayNumber} / {onboardingPlan.totalDays} · 오늘의 3문제
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {onboardingPlan.problems.slice(0, 3).map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/problems/${p.id}`)}
                  style={{
                    padding: '6px 12px',
                    background: p.solvedToday ? 'rgba(86,211,100,.18)' : 'var(--bg2)',
                    color: p.solvedToday ? 'var(--green)' : 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 13,
                    cursor: 'pointer',
                    textDecoration: p.solvedToday ? 'line-through' : 'none',
                  }}
                >
                  {p.solvedToday ? '✓ ' : ''}{p.title}
                </button>
              ))}
            </div>
          </div>
          <div style={{
            width: 64, height: 64, borderRadius: 32,
            background: 'conic-gradient(var(--accent, #6c63ff) ' +
              `${Math.round((onboardingPlan.dayNumber / onboardingPlan.totalDays) * 360)}deg, var(--bg3) 0)`,
            display: 'grid', placeItems: 'center',
            flexShrink: 0,
          }}>
            <div style={{
              width: 50, height: 50, borderRadius: 25,
              background: 'var(--bg)', display: 'grid', placeItems: 'center',
              fontSize: 14, fontWeight: 800,
            }}>
              {Math.round((onboardingPlan.dayNumber / onboardingPlan.totalDays) * 100)}%
            </div>
          </div>
        </div>
      )}

      {/* 통계 카드 */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:20}}>
        <StatCard icon={<CheckCircle2 size={20} />} value={solvedList.length}  label={t('solved')}  color="var(--green)" delta={solvedList.length > 0 ? `▲ ${Math.min(99, Math.round(solvedList.length / Math.max(PROBLEMS.length, 1) * 100))}%` : null} onClick={() => navigate('/submissions')} />
        <StatCard icon={<TrendingUp size={20} />} value={progression ? `Lv.${progression.level}` : (user?.rating||800)}  label={progression ? txt('성장 레벨', 'Growth Level') : t('rating')}  color="var(--yellow)" delta={progression ? `${progression.xp.toLocaleString()} XP` : ((user?.streak||0) > 0 ? `+${(user.streak) * 2} Growth` : null)} onClick={() => navigate('/profile')} />
        <StatCard icon={<Target size={20} />} value={myRank?`#${myRank}`:'−'} label={t('dashboardMyRank')} color="var(--purple)" delta={t('dashboardRealtimeTrack')} onClick={() => navigate('/ranking')} />
        <div className="card card-pad card-hover" onClick={() => navigate('/battle')} style={{display:'flex',alignItems:'center',gap:14,cursor:'pointer',position:'relative',overflow:'hidden'}}>
          <div className="stat-card-accent" style={{background:'linear-gradient(90deg, rgba(248,81,73,.75), rgba(248,81,73,.16))'}} />
          <div style={{width:48,height:48,borderRadius:14,background:'rgba(248,81,73,.12)',border:'1px solid rgba(248,81,73,.22)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--red)',flexShrink:0}}>
            <Swords size={20} />
          </div>
          <div style={{minWidth:0}}>
            <div style={{fontFamily:'Space Mono,monospace',fontSize:22,fontWeight:800,color:'var(--red)',lineHeight:1}}>
              {battleSummaryLoadFailed ? '−' : (battleSummary.total > 0 ? `${battleSummary.winRate}%` : '0%')}
            </div>
            <div style={{fontSize:12,color:'var(--text2)',marginTop:3}}>{txt('배틀 승률', 'Battle Win Rate')}</div>
            {battleSummaryLoadFailed ? (
              <div className="dashboard-inline-error">{t('dashboardBattleSummaryLoadFailed')}</div>
            ) : (
              <>
                <div style={{display:'flex',gap:4,marginTop:6}}>
                  {(battleSummary.recent || []).slice(0, 5).map((item, index) => (
                    <span key={`${item.roomId || index}-${item.result}`} title={item.result} style={{
                      width:20,height:20,borderRadius:999,display:'grid',placeItems:'center',
                      background:item.result === 'win' ? 'rgba(86,211,100,.16)' : item.result === 'draw' ? 'rgba(227,179,65,.16)' : 'rgba(248,81,73,.14)',
                      color:item.result === 'win' ? 'var(--green)' : item.result === 'draw' ? 'var(--yellow)' : 'var(--red)',
                      fontSize:10,fontWeight:900,
                    }}>
                      {item.result === 'win' ? 'W' : item.result === 'draw' ? 'D' : 'L'}
                    </span>
                  ))}
                  {(!battleSummary.recent || battleSummary.recent.length === 0) && (
                    <span style={{fontSize:11,color:'var(--text3)'}}>{t('dashNoRecentResult')}</span>
                  )}
                </div>
                {battleSummary.recap && (
                  <div className="dashboard-battle-recap">
                    <strong>{battleSummary.recap.headline}</strong>
                    <span>{battleSummary.recap.nextStep}</span>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(battleSummary.recap.suggestedAction || '/battle');
                      }}
                    >
                      {battleSummary.recap.suggestedAction === '/recovery' ? txt('복구 센터', 'Recovery') : txt('배틀 시작', 'Start Battle')}
                    </button>
                  </div>
                )}
              </>
              )}
          </div>
        </div>
      </div>

      <div className="dashboard-game-banner card card-hover" onClick={() => navigate('/game')} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') navigate('/game'); }}>
        <div className="dashboard-game-banner-icon"><Sparkles size={22} /></div>
        <div className="dashboard-game-banner-body">
          <span>{txt('새 게임 허브', 'NEW GAME HUB')}</span>
          <strong>{txt('고스트 배틀 · 데일리 던전 · 시즌 정복 — 한 곳에서', 'Ghost Battle · Daily Dungeon · Season Conquest — all in one place')}</strong>
          <small>{gameSummaryLoadFailed ? t('dashboardGameSummaryLoadFailed') : `${txt('고스트', 'Ghost')} ${gameSummary.ghost} · ${txt('던전', 'Dungeon')} ${gameSummary.dungeon}% · ${txt('영역', 'Territories')} ${gameSummary.territory}`}</small>
        </div>
        <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); navigate('/game'); }}>{txt('게임 허브', 'Game Hub')}</button>
      </div>

      {dailyFocusPlan.length > 0 && (
        <div className="dashboard-learning-modes" aria-label={txt('오늘의 학습 루틴', "Today's learning routine")}>
          {dailyFocusPlan.map((item) => {
            const Icon = DAILY_FOCUS_ICONS[item.icon] || Target;
            return (
              <button
                key={item.key}
                type="button"
                className="dashboard-learning-card"
                style={{ '--mode-color': item.color }}
                onClick={() => navigate(item.path, item.state ? { state: item.state } : undefined)}
                aria-label={`${item.title}: ${item.description}`}
              >
                <span className="dashboard-learning-icon" aria-hidden="true">
                  <Icon size={20} />
                </span>
                <span className="dashboard-learning-body">
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                  {item.reason && <span className="dashboard-learning-reason">{item.reason}</span>}
                </span>
                <span className="dashboard-learning-stat">{item.stat}</span>
              </button>
            );
          })}
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 360px',gap:16}} className="dashboard-main-grid">
        {/* 왼쪽 */}
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {promotion.active && (
            <div style={{
              background:'linear-gradient(135deg, rgba(255,215,0,.14), var(--bg2))',
              border:'2px solid #ffd700',
              borderRadius:12,
              padding:'14px 20px',
              display:'flex',
              alignItems:'center',
              gap:16,
              marginBottom:4,
            }}>
              <span style={{ fontSize:28 }}>⚔️</span>
              <div>
                <div style={{ fontWeight:800, color:'#ffd700' }}>{t('dashboardPromotionActive')}</div>
                <div style={{ color:'var(--text2)', fontSize:13 }}>
                  {t('dashboardPromotionRecord').replace('{from}', tierLbl(promotion.active.from_tier)).replace('{to}', tierLbl(promotion.active.to_tier)).replace('{wins}', String(promotion.active.wins)).replace('{losses}', String(promotion.active.losses))}
                </div>
              </div>
              <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
                {Array(3).fill(0).map((_, index) => (
                  <div
                    key={index}
                    style={{
                      width:16,
                      height:16,
                      borderRadius:'50%',
                      background: index < promotion.active.wins ? 'var(--green)' : 'var(--bg3)',
                      border:'2px solid var(--border)',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {promotion.recent?.status === 'promoted' && (
            <div style={{
              textAlign:'center',
              padding:24,
              borderRadius:16,
              border:'1px solid rgba(255,215,0,.35)',
              background:'linear-gradient(135deg, rgba(255,215,0,.12), var(--bg2))',
            }}>
              <div style={{ fontSize:56 }}>🎉</div>
              <h3 style={{ margin:'8px 0 6px', fontSize:22, fontWeight:800 }}>{t('dashboardPromotionAchieved').replace('{tier}', tierLbl(promotion.recent.to_tier))}</h3>
              <p style={{ color:'var(--text2)', marginBottom:14 }}>
                {t('dashboardPromotionDesc').replace('{wins}', String(promotion.recent.wins)).replace('{from}', tierLbl(promotion.recent.from_tier)).replace('{to}', tierLbl(promotion.recent.to_tier))}
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/ranking')}>{t('dashboardCheckRanking')}</button>
            </div>
          )}

          {progression && (
            <div className="dashboard-xp-card card card-hover">
              <div className="dashboard-xp-head">
                <div>
                  <div className="dashboard-xp-kicker">{txt('개인 성장 보상', 'Personal Growth Rewards')}</div>
                  <div className="dashboard-xp-title">Lv.{progression.level} · {progression.xp.toLocaleString()} XP</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/profile')}>{txt('프로필 보상', 'Profile Rewards')}</button>
              </div>
              <div className="dashboard-xp-bar">
                <div style={{ width:`${Math.min(100, Math.max(0, progression.progressPercent || 0))}%` }} />
              </div>
              <div className="dashboard-xp-note">
                {txt('미션 보상은 랭킹 점수에 영향을 주지 않으며 XP, 뱃지, 칭호, 프로필 배경으로만 쌓입니다.', 'Mission rewards do not affect ranking points — they accumulate as XP, badges, titles, and profile backgrounds only.')}
              </div>
            </div>
          )}


          {missions.length > 0 && (
            <div className="card card-pad" style={{marginBottom:4}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <h3 style={{margin:0}}>⚡ {t('dashboardDailyMissions')}</h3>
                {missions.every(m => m.isCompleted) && (
                  <span style={{fontSize:12,color:'var(--green)',fontWeight:700}}>{t('dashboardMissionAllDone')}</span>
                )}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {missions.map(m => {
                  const labelKey = {
                    solve_1: 'missionSolve1',
                    solve_3: 'missionSolve3',
                    correct_streak_3: 'missionStreak3',
                    battle_win: 'missionBattleWin',
                    review_ai: 'missionReviewAi',
                  }[m.type];
                  return (
                    <div key={m.type} style={{
                      display:'flex',alignItems:'center',gap:10,
                      padding:'8px 12px',borderRadius:8,
                      background: m.isCompleted ? 'rgba(86,211,100,.08)' : 'var(--bg3)',
                      border: `1px solid ${m.isCompleted ? 'rgba(86,211,100,.25)' : 'var(--border)'}`,
                      opacity: m.isCompleted ? 0.8 : 1,
                    }}>
                      <span style={{fontSize:16}}>{m.isCompleted ? '✅' : '⭕'}</span>
                      <span style={{flex:1,fontSize:13,color:m.isCompleted?'var(--text2)':'var(--text)',textDecoration:m.isCompleted?'line-through':'none'}}>
                        {labelKey ? t(labelKey) : m.label}
                      </span>
                      <span style={{fontSize:11,fontWeight:700,color:'var(--yellow)',whiteSpace:'nowrap'}}>
                        +{m.rewardValue} {t('dashboardMissionXp')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {referral && (
            <div className="card card-pad" style={{marginBottom:4}}>
              <h3>👥 {t('dashboardReferralTitle')}</h3>
              <p style={{ color:'var(--text2)', fontSize:14 }}>
                {t('dashboardReferralDescPrefix')} <strong style={{ color:'var(--blue)' }}>{t('dashboardReferralReward')}</strong> {t('dashboardReferralDescSuffix')}
              </p>
              <div style={{ display:'flex', gap:8, marginTop:12 }}>
                <input
                  readOnly
                  value={referral.inviteUrl}
                  style={{ flex:1, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', color:'var(--text)', fontSize:13 }}
                />
                <button className="btn btn-primary" onClick={async () => {
                  const copied = await copyText(referral.inviteUrl)
                  if (copied) {
                    setCopiedReferral(true)
                    setTimeout(() => setCopiedReferral(false), 2000)
                  } else {
                    toast?.show(t('copyFailed'), 'error')
                  }
                }}>
                  {copiedReferral ? t('copied') : t('copy')}
                </button>
              </div>
              <div style={{ color:'var(--text3)', fontSize:12, marginTop:8 }}>
                {t('dashboardReferralStats').replace('{referrals}', String(referral.totalReferrals)).replace('{rewards}', String(referral.rewardedCount))}
              </div>
            </div>
          )}

          {weeklyChallenge && (
            <div style={{
              padding:'18px 22px',
              borderRadius:16,
              background:'linear-gradient(135deg, var(--purple) 18%, var(--bg2))',
              border:'1px solid rgba(210,168,255,.27)',
            }}>
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:8, fontWeight:700 }}>🏆 {t('dashboardWeeklyProblem')}</div>
              <div style={{ fontSize:18, fontWeight:800, marginBottom:6 }}>{weeklyChallenge.problemTitle}</div>
              <div style={{ fontSize:13, color:'var(--text2)', marginBottom:12 }}>
                {tierLbl(weeklyChallenge.tier)} · {t('difficulty')} {weeklyChallenge.difficulty} · {t('dashboardRewardLabel')}: {weeklyChallenge.rewardCode}
              </div>
              {weeklyChallenge.isSolved ? (
                <span style={{ color:'var(--green)', fontSize:13, fontWeight:700 }}>✓ {t('dashboardCompleted')}</span>
              ) : (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate(`/problems/${weeklyChallenge.problemId}`)}
                >
                  {t('tryProblem')}
                </button>
              )}
            </div>
          )}

          <div className="card card-pad card-hover">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,marginBottom:14}}>
              <div>
                <div style={{fontWeight:800,fontSize:14,display:'flex',alignItems:'center',gap:8}}>
                  <Target size={16} />{txt('오답 복구 큐', 'Wrong Answer Recovery Queue')}
                </div>
                <div style={{fontSize:12,color:'var(--text3)',marginTop:4,lineHeight:1.5}}>
                  {recoveryQueue.summary || txt('틀린 문제를 다시 풀어 약점을 없애세요.', 'Retry incorrect problems to eliminate weaknesses.')}
                </div>
              </div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:8}}>
                <span style={{
                  padding:'4px 9px',borderRadius:999,
                  background:recoveryQueue.count > 0 ? 'rgba(248,81,73,.1)' : 'rgba(86,211,100,.1)',
                  color:recoveryQueue.count > 0 ? 'var(--red)' : 'var(--green)',
                  fontSize:11,fontWeight:800,whiteSpace:'nowrap',
                }}>
                  {recoveryQueue.count > 0 ? withVars(t('dashQueuePending'), { n: recoveryQueue.count }) : t('dashAllDone')}
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/recovery')}>
                  {txt('복구 센터', 'Recovery Center')}
                </button>
              </div>
            </div>
            {recoveryQueue.items?.length > 0 ? (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {recoveryQueue.items.slice(0,3).map((item) => (
                  <div key={item.submissionId} style={{
                    padding:'12px 14px',borderRadius:10,
                    background:'var(--bg3)',border:'1px solid var(--border)',
                  }}>
                    <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'flex-start'}}>
                      <div style={{minWidth:0}}>
                        <button
                          onClick={() => navigate(`/problems/${item.problemId}`)}
                          style={{
                            background:'none',border:'none',padding:0,color:'var(--text)',
                            fontSize:13,fontWeight:800,fontFamily:'inherit',cursor:'pointer',
                            textAlign:'left',
                          }}
                        >
                          {item.problemTitle}
                        </button>
                        <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>
                          {(lang === 'ko' ? CAUSE_KO[item.cause] || item.cause : item.cause)} · {tierLbl(item.tier)} · {item.lang}
                        </div>
                      </div>
                      <span style={{
                        color:item.priority === 'high' ? 'var(--red)' : 'var(--orange)',
                        fontSize:11,fontWeight:800,whiteSpace:'nowrap',
                      }}>
                        {item.priority === 'high' ? t('dashPriorityHigh') : t('dashPriorityReview')}
                      </span>
                    </div>
                    <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.6,marginTop:8}}>
                      {item.action}
                    </div>
                    {item.tags?.length > 0 && (
                      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:8}}>
                        {item.tags.map((tagName) => (
                          <span key={tagName} style={{
                            padding:'2px 7px',borderRadius:999,
                            background:'rgba(121,192,255,.08)',
                            color:'var(--blue)',fontSize:10,fontWeight:700,
                          }}>
                            {getTagLabelLang(tagName, lang)}
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/problems/${item.problemId}`)}
                      >
                        {txt('다시 풀기', 'Retry')}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate('/submissions', { state: { scope: 'me', result: item.result, highlightId: item.submissionId, autoCoach: true } })}
                      >
                        {txt('AI 코치 보기', 'View AI Coach')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{padding:'14px 0',fontSize:13,color:'var(--text3)',lineHeight:1.7}}>
                {txt('현재 미해결 오답이 없습니다. 추천 문제나 배틀로 새로운 약점을 발견해 보세요.', 'No unresolved wrong answers right now. Try recommended problems or battles to discover new weaknesses.')}
              </div>
            )}
          </div>

          {/* 잔디 */}
          <div className="card card-pad card-hover">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:14,display:'flex',alignItems:'center',gap:8}}><Flame size={16} />{t('dashboardStreakCalendar')}</div>
              <span style={{fontSize:12,color:'var(--green)',fontFamily:'Space Mono,monospace'}}>
                {t('dashboardActivityDays').replace('{n}', String(activityDays))}
              </span>
            </div>
            <div style={{display:'grid',gridTemplateRows:'repeat(7, 11px)',gridAutoFlow:'column',gap:3,justifyContent:'start',overflowX:'auto',paddingBottom:4}}>
              {grassData.map((g,i)=>(
                <div key={i} title={`${g.date} · ${(g.count || 0) > 0 ? t('dashboardSolvedProblemsCount').replace('{n}', String(g.count)) : t('dashboardNoRecord')}`} style={{
                  width:11,height:11,borderRadius:2,flexShrink:0,
                  background: activityColor(g.count || 0, g.level || 0),
                  cursor:'default',transition:'transform .1s',
                }}
                  onMouseEnter={e=>e.currentTarget.style.transform='scale(1.4)'}
                  onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
                />
              ))}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6,marginTop:10,fontSize:11,color:'var(--text3)'}}>
              <span>{t('dashboardLowActivity')}</span>
              {[0,1,2,4].map((count) => (
                <div key={count} style={{width:11,height:11,borderRadius:2,background:activityColor(count, count)}} />
              ))}
              <span>{t('dashboardHighActivity')}</span>
            </div>
          </div>

          {(reviewQueueLoadFailed || reviewQueue.length > 0) && (
            <div className="card card-pad card-hover">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:12}}>
                <div>
                  <div style={{fontSize:11,color:'var(--orange)',fontWeight:800,letterSpacing:.5}}>{txt('복습 큐', 'REVIEW QUEUE')}</div>
                  <h3 style={{fontSize:17,fontWeight:800,margin:'4px 0 0'}}>{t('dashReviewQueue')}</h3>
                </div>
                {!reviewQueueLoadFailed && (
                  <span style={{fontSize:12,color:'var(--text3)'}}>{withVars(t('dashQueuePending'), { n: reviewQueue.length })}</span>
                )}
              </div>
              {reviewQueueLoadFailed ? (
                <div className="dashboard-section-error">{t('dashboardReviewQueueLoadFailed')}</div>
              ) : (
                <div style={{display:'grid',gap:8}}>
                  {reviewQueue.slice(0,5).map((item) => (
                    <button key={item.problemId} onClick={() => navigate('/problems/'+item.problemId)} style={{border:'1px solid var(--border)',borderRadius:12,padding:'10px 12px',background:'var(--bg3)',color:'var(--text)',textAlign:'left',cursor:'pointer',display:'flex',justifyContent:'space-between',gap:10}}>
                      <span style={{fontWeight:700}}>{item.title}</span>
                      <span style={{fontSize:11,color:TIERS[item.tier]?.color||'var(--text3)'}}>{tierLbl(item.tier)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {(tagStatsLoadFailed || tagStats.length > 0) && (
            <div className="card card-pad card-hover">
              <div style={{fontWeight:800,fontSize:15,marginBottom:12,display:'flex',alignItems:'center',gap:8}}><Target size={16} />{txt('태그별 정확도', 'Tag Proficiency')}</div>
              {tagStatsLoadFailed ? (
                <div className="dashboard-section-error">{t('dashboardTagStatsLoadFailed')}</div>
              ) : (
                <div style={{display:'grid',gap:10}}>
                  {tagStats.slice(0,6).map((item) => (
                    <div key={item.tag}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:5}}>
                        <span style={{fontWeight:700}}>{getTagLabelLang(item.tag, lang)}</span>
                        <span style={{color:'var(--text3)'}}>{item.accuracy}% · {item.correct}/{item.total}</span>
                      </div>
                      <div style={{height:8,borderRadius:999,background:'var(--bg3)',overflow:'hidden'}}>
                        <div style={{width:`${item.accuracy}%`,height:'100%',background:item.accuracy < 50 ? 'var(--red)' : item.accuracy < 75 ? 'var(--yellow)' : 'var(--green)'}} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 추천 문제 */}
          {recommendedProblems.length > 0 && (
            <div className="card card-pad card-hover">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:12}}>
                <div>
                  <div style={{fontSize:11,color:'var(--text3)',fontWeight:700,marginBottom:4,textTransform:'uppercase',letterSpacing:.5}}>
                    {t('recommendedProblems')}
                  </div>
                  <h3 style={{fontSize:17,fontWeight:800,margin:0}}>{t('dashRecommendedSection')}</h3>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={()=>navigate('/problems')}>{t('dashViewAll')}</button>
              </div>
              <div className="dashboard-problem-rail">
                {recommendedProblems.map((problem) => (
                  <button
                    key={problem.id}
                    type="button"
                    className="dashboard-problem-card"
                    onClick={()=>navigate('/problems/'+problem.id, { state: { problem } })}
                  >
                    <span style={{
                      alignSelf:'flex-start',
                      padding:'4px 9px',borderRadius:20,fontSize:11,fontWeight:800,
                      background:TIERS[problem.tier]?.bg||'var(--bg3)',
                      color:TIERS[problem.tier]?.color||'var(--text2)',
                    }}>● {tierLbl(problem.tier)}</span>
                    <strong>{problem.title}</strong>
                    {problem.reason && (
                      <span style={{
                        alignSelf:'flex-start',
                        padding:'3px 8px',
                        borderRadius:999,
                        background:'var(--glass-bg)',
                        border:'1px solid var(--border)',
                        color:'var(--blue)',
                        fontSize:'0.72rem',
                        fontWeight:800,
                      }}>
                        {problem.reason}
                      </span>
                    )}
                    <small>{(problem.desc||problem.description||'').slice(0,72)}...</small>
                    <span className="dashboard-problem-meta">
                      {t('dashboardEstimatedTime').replace('{n}', String(problem.timeLimit||problem.time_limit||2))}
                      {' · '}
                      {t('dashboardSolvedYesterday').replace('{n}', (problem.solved||problem.solved_count||0).toLocaleString())}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 티어별 진행률 */}
          <div className="card card-pad card-hover">
            <div style={{fontWeight:700,fontSize:14,marginBottom:16,display:'flex',alignItems:'center',gap:8}}><BarChart3 size={16} />{t('dashboardTierConquest')}</div>
            {Object.entries(TIERS).map(([k,v])=>{
              const cnt = PROBLEMS.filter(p=>p.tier===k&&solved[p.id]).length;
              const tot = PROBLEMS.filter(p=>p.tier===k).length;
              const pct = tot ? Math.round(cnt/tot*100) : 0;
              return (
                <div key={k} style={{marginBottom:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:11,fontWeight:700,fontFamily:'Space Mono,monospace',color:v.color}}>● {tierLbl(k)}</span>
                    </div>
                    <span style={{fontSize:11,color:'var(--text2)',fontFamily:'Space Mono,monospace'}}>{cnt}/{tot}</span>
                  </div>
                  <div style={{height:6,background:'var(--bg3)',borderRadius:3,overflow:'hidden'}}>
                    <div style={{
                      height:'100%',width:`${pct}%`,borderRadius:3,
                      background:v.color, transition:'width 1.2s ease',
                      opacity:.85,
                    }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 오른쪽 */}
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {/* 랭킹 TOP5 */}
          <div className="card card-pad card-hover">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontWeight:700,fontSize:14,display:'flex',alignItems:'center',gap:8}}><Trophy size={16} />{txt('실시간 랭킹', 'Live Ranking')}</div>
              <button onClick={()=>navigate('/ranking')} style={{
                fontSize:12,color:'var(--blue)',background:'none',border:'none',cursor:'pointer',
              }}>{t('dashboardViewAll')}</button>
            </div>
            {recentRank.length === 0 && (
              <div className="empty-state" style={{padding:'20px 0'}}>
                {t('dashboardRankingLoading')}
              </div>
            )}
            {recentRank.map((r,i)=>{
              const isMe = r.id === user?.id;
              const medals = ['🥇','🥈','🥉'];
              return (
                <div key={r.id}
                  onClick={() => navigate(isMe ? '/profile' : `/user/${r.id}`)}
                  style={{
                    display:'flex',alignItems:'center',gap:10,
                    padding:'10px 12px',borderRadius:8,marginBottom:4,
                    background: isMe ? 'rgba(121,192,255,.06)' : 'transparent',
                    border: isMe ? '1px solid rgba(121,192,255,.15)' : '1px solid transparent',
                    transition:'background .15s',
                    cursor:'pointer',
                  }}
                  onMouseEnter={e=>{if(!isMe)e.currentTarget.style.background='var(--bg3)';}}
                  onMouseLeave={e=>{e.currentTarget.style.background=isMe?'rgba(121,192,255,.06)':'transparent';}}
                >
                  <span style={{fontSize:i<3?16:12,width:22,textAlign:'center',
                    color:i>=3?'var(--text3)':'inherit',fontFamily:'Space Mono,monospace',fontWeight:700}}>
                    {i<3 ? medals[i] : `${i+1}`}
                  </span>
                  <ProfileAvatar
                    profile={r}
                    size={28}
                    border={`1.5px solid ${TIER_META[r.tier]?.color||'#888'}50`}
                  />
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{
                      fontSize:13,fontWeight:600,
                      color:isMe?'var(--blue)':'var(--text)',
                      overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                    }}>{r.name||r.username}{isMe&&` (${t('rankingMe')})`}</div>
                    <div style={{fontSize:11,color:'var(--text3)'}}>{t('dashboardSolvedProblemsCount').replace('{n}', String(r.solved||0))}</div>
                  </div>
                  <span style={{
                    fontFamily:'Space Mono,monospace',fontSize:12,
                    color:'var(--yellow)',fontWeight:700,flexShrink:0,
                  }}>{r.rating}</span>
                </div>
              );
            })}
          </div>

          {/* 최근 푼 문제 */}
          <div className="card card-pad card-hover">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:14,display:'flex',alignItems:'center',gap:8}}><CheckCircle2 size={16} />{t('dashboardRecentSubmissionFeed')}</div>
              <button onClick={()=>navigate('/submissions')} style={{fontSize:12,color:'var(--blue)',background:'none',border:'none',cursor:'pointer'}}>{t('showMore')}</button>
            </div>
            {recentSolved.length === 0
              ? <div style={{color:'var(--text3)',fontSize:13,textAlign:'center',padding:'16px 0'}}>
                  {t('noSolvedProblems')}<br/>
                  <button onClick={()=>navigate('/problems')} style={{
                    marginTop:10,padding:'7px 16px',borderRadius:7,
                    background:'var(--bg3)',border:'1px solid var(--border)',
                    color:'var(--blue)',cursor:'pointer',fontSize:12,fontFamily:'inherit',
                  }}>{t('dashboardGoSolve')}</button>
                </div>
              : recentSolved.map(p=>(
                <div key={p.id} onClick={()=>navigate('/problems/'+p.id, { state: { problem: p } })} style={{
                  display:'flex',alignItems:'center',gap:10,padding:'8px 0',
                  borderBottom:'1px solid var(--border)',cursor:'pointer',
                  transition:'color .15s',
                }}
                  onMouseEnter={e=>e.currentTarget.style.color='var(--blue)'}
                  onMouseLeave={e=>e.currentTarget.style.color=''}
                >
                  <CheckCircle2 size={14} color="var(--green)" />
                  <span style={{flex:1,fontSize:13,fontWeight:500}}>{p.title}</span>
                  <span className="badge badge-blue">{user?.defaultLanguage || 'python'}</span>
                  <span style={{fontSize:10,color:TIERS[p.tier]?.color,fontFamily:'Space Mono,monospace'}}>
                    {tierLbl(p.tier)}
                  </span>
                </div>
              ))
            }
          </div>

          {followFeed.length > 0 && (
            <div className="card card-pad card-hover">
              <div style={{fontWeight:700,fontSize:14,marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
                <Sparkles size={16} />{t('dashboardFollowActivity')}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {followFeed.map((item, index) => (
                  <div key={`${item.type}-${item.userId}-${item.createdAt}-${index}`} style={{padding:'10px 12px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:10}}>
                    {item.type === 'solved' ? (
                      <div style={{fontSize:13,lineHeight:1.7}}>
                        <strong>{item.avatarEmoji || '🙂'} {item.username}</strong>{lang === 'ko' ? t('dashboardUserSuffix') : ''}{' '}
                        <button
                          onClick={() => navigate(`/problems/${item.problemId}`)}
                          style={{background:'none',border:'none',padding:0,color:'var(--blue)',cursor:'pointer',font: 'inherit'}}
                        >
                          {item.problemTitle}
                        </button>{' '}
                        {t('dashboardSolvedWithLang').replace('{lang}', item.lang)}
                      </div>
                    ) : (
                      <div style={{fontSize:13,lineHeight:1.7}}>
                        <strong>{item.avatarEmoji || '🙂'} {item.username}</strong>{lang === 'ko' ? t('dashboardUserSuffix') : ''}{' '}
                        <button
                          onClick={() => navigate(`/community/${item.board || 'qna'}/${item.postId}`)}
                          style={{background:'none',border:'none',padding:0,color:'var(--blue)',cursor:'pointer',font: 'inherit'}}
                        >
                          {item.postTitle}
                        </button>{' '}
                        {t('dashboardWrotePost')}
                      </div>
                    )}
                    <div style={{fontSize:11,color:'var(--text3)',marginTop:6}}>
                      {new Date(item.createdAt).toLocaleString(locale)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 빠른 이동 + 특수 기능 */}
          <div className="card card-pad card-hover">
            <div style={{fontWeight:700,fontSize:14,marginBottom:14,display:'flex',alignItems:'center',gap:8}}><Sparkles size={16} />{t('quickAction')}</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {[
                {icon:<BookOpen size={16} />, label:t('problemList'),  page:'problems',    color:'var(--blue)',   rgba:'rgba(121,192,255,'},
                {icon:<Sparkles size={16} />, label:txt('학습 경로', 'Learning Path'),    page:'learning',    color:'var(--purple)', rgba:'rgba(210,168,255,'},
                {icon:<Trophy size={16} />,   label:t('joinContest'),   page:'contest',     color:'var(--yellow)', rgba:'rgba(227,179,65,'},
                {icon:<FileText size={16} />, label:t('submissions'),   page:'submissions', color:'var(--green)',  rgba:'rgba(86,211,100,'},
              ].map(a=>(
                <button key={a.label} onClick={()=>navigate('/'+a.page)} style={{
                  padding:'14px 8px', borderRadius:10,
                  background:'var(--bg3)', border:'1px solid var(--border)',
                  color:'var(--text)', cursor:'pointer', fontSize:11, fontWeight:600,
                  fontFamily:'inherit', display:'flex', flexDirection:'column', alignItems:'center',
                  gap:8, justifyContent:'center', transition:'all .18s',
                }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=a.color;e.currentTarget.style.background=`${a.rgba}.1)`;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--bg3)';}}
                >
                  <span style={{
                    width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center',
                    background:`${a.rgba}.14)`, color:a.color, flexShrink:0,
                  }}>{a.icon}</span>
                  {a.label}
                </button>
              ))}
            </div>

            {/* ★ 랜덤 디펜스 */}
            <button onClick={async()=>{
              try {
                const r = await api.get('/problems/random/pick');
                if (r.data?.id) { navigate('/problems/'+r.data.id, { state: { problem: r.data } }); toast?.show(t('randomPicked').replace('{title}', r.data.title), 'info'); }
                else toast?.show(r.data?.message || t('dashboardNoProblems'), 'warning');
              } catch { toast?.show(t('randomFailed'), 'error'); }
            }} style={{
              width:'100%',marginTop:10,padding:'12px',borderRadius:8,
              background:'linear-gradient(135deg,rgba(121,192,255,.08),rgba(86,211,100,.08))',
              border:'1px solid rgba(121,192,255,.2)',
              color:'var(--text)',cursor:'pointer',fontSize:13,fontWeight:700,
              fontFamily:'inherit',display:'flex',alignItems:'center',gap:8,justifyContent:'center',
              transition:'all .2s',
            }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--blue)';e.currentTarget.style.background='rgba(121,192,255,.12)';}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(121,192,255,.2)';e.currentTarget.style.background='linear-gradient(135deg,rgba(121,192,255,.08),rgba(86,211,100,.08))';}}
            ><Swords size={15} />{t('dashboardRandomDefense')}</button>

          </div>
        </div>
      </div>

      {/* ★ 알고리즘 로드맵 */}
      <div style={{marginTop:20}} className="fade-up">
        <h3 style={{fontSize:16,fontWeight:800,marginBottom:14}}>🗺️ {t('dashboardRoadmap')}</h3>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
          {[
            { step:1, title:t('dashboardRoadmapStep1'),   tags:['구현','수학'],          icon:'🔢', color:'#cd7f32' },
            { step:2, title:t('dashboardRoadmapStep2'),   tags:['구현','문자열'],        icon:'🔄', color:'#cd7f32' },
            { step:3, title:t('dashboardRoadmapStep3'),   tags:['정렬','배열'],          icon:'📊', color:'#c0c0c0' },
            { step:4, title:t('dashboardRoadmapStep4'),   tags:['스택','큐'],            icon:'📚', color:'#c0c0c0' },
            { step:5, title:t('dashboardRoadmapStep5'),   tags:['완전탐색','백트래킹'],  icon:'🔍', color:'#ffd700' },
            { step:6, title:t('dashboardRoadmapStep6'),   tags:['BFS','DFS','그래프'],   icon:'🌐', color:'#ffd700' },
            { step:7, title:t('dashboardRoadmapStep7'),   tags:['DP','동적프로그래밍'],  icon:'💎', color:'#00e5cc' },
            { step:8, title:t('dashboardRoadmapStep8'),   tags:['이분탐색','그리디','분할정복'], icon:'🏆', color:'#b9f2ff' },
          ].map(stage => {
            const stageProblems = PROBLEMS.filter(p => (p.tags||[]).some(t => stage.tags.includes(t)));
            const stageSolved = stageProblems.filter(p => solved[p.id]).length;
            const total = stageProblems.length || 1;
            const pct = Math.round(stageSolved / total * 100);
            const isComplete = pct >= 100;
            return (
              <div key={stage.step} className="card" style={{
                padding:'16px 18px',transition:'all .2s',cursor:'pointer',
                borderLeft:`3px solid ${isComplete ? 'var(--green)' : stage.color}`,
                opacity: stageSolved > 0 || stage.step <= 2 ? 1 : 0.6,
              }}
                onClick={()=>navigate('/problems')}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=stage.color;e.currentTarget.style.transform='translateY(-2px)';}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.transform='none';}}
              >
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:18}}>{stage.icon}</span>
                    <div>
                      <div style={{fontSize:10,color:stage.color,fontWeight:700,fontFamily:'Space Mono,monospace'}}>STEP {stage.step}</div>
                      <div style={{fontSize:13,fontWeight:700}}>{stage.title}</div>
                    </div>
                  </div>
                  {isComplete && <span style={{fontSize:16}}>✅</span>}
                </div>
                <div style={{height:5,background:'var(--bg4)',borderRadius:3,overflow:'hidden',marginBottom:6}}>
                  <div style={{height:'100%',width:`${pct}%`,background:stage.color,borderRadius:3,transition:'width 1s ease'}}/>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text3)'}}>
                  <span>{stageSolved}/{stageProblems.length}{lang === 'ko' ? t('dashboardProblemsUnit') : ` ${t('solvedCount').toLowerCase()}`}</span>
                  <span style={{fontFamily:'Space Mono,monospace',color:isComplete?'var(--green)':'var(--text3)'}}>{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
