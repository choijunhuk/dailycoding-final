import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext.jsx';
import { PROBLEMS as DEFAULT_PROBLEMS, TIERS, TIER_COLORS } from '../data/problems';
import api from '../api.js';
import { useRankingData } from '../hooks/useRankingData.js';
import { BarChart3, BookOpen, Bot, CheckCircle2, FileText, Flame, Sparkles, Swords, Target, TrendingUp, Trophy } from 'lucide-react';
import { TIER_THRESHOLDS } from '../data/constants.js';
import { useLang } from '../context/LangContext.jsx';

const TIER_META = {
  unranked:    { label:'언랭크드',      color:'#888',    next:'아이언',       threshold:TIER_THRESHOLDS.iron,         bg:'rgba(136,136,136,.06)' },
  iron:        { label:'아이언',        color:'#a8a8a8', next:'브론즈',       threshold:TIER_THRESHOLDS.bronze,       bg:'rgba(168,168,168,.06)' },
  bronze:      { label:'브론즈',        color:'#cd7f32', next:'실버',         threshold:TIER_THRESHOLDS.silver,       bg:'rgba(205,127,50,.08)'  },
  silver:      { label:'실버',          color:'#c0c0c0', next:'골드',         threshold:TIER_THRESHOLDS.gold,         bg:'rgba(192,192,192,.08)' },
  gold:        { label:'골드',          color:'#ffd700', next:'플래티넘',     threshold:TIER_THRESHOLDS.platinum,     bg:'rgba(255,215,0,.08)'   },
  platinum:    { label:'플래티넘',      color:'#00e5cc', next:'에메랄드',     threshold:TIER_THRESHOLDS.emerald,      bg:'rgba(0,229,204,.08)'   },
  emerald:     { label:'에메랄드',      color:'#00d18f', next:'다이아몬드',   threshold:TIER_THRESHOLDS.diamond,      bg:'rgba(0,209,143,.08)'   },
  diamond:     { label:'다이아몬드',    color:'#b9f2ff', next:'마스터',       threshold:TIER_THRESHOLDS.master,       bg:'rgba(185,242,255,.08)' },
  master:      { label:'마스터',        color:'#9b59b6', next:'그랜드마스터', threshold:TIER_THRESHOLDS.grandmaster,  bg:'rgba(155,89,182,.08)'  },
  grandmaster: { label:'그랜드마스터',  color:'#e74c3c', next:'챌린저',       threshold:16001,                        bg:'rgba(231,76,60,.08)'   },
  challenger:  { label:'챌린저',        color:'#f1c40f', next:'MAX',          threshold:99999,                        bg:'rgba(241,196,15,.08)'  },
};

const StatCard = memo(function StatCard({ icon, value, label, color, sub, delta }) {
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
    <div className="card card-hover" style={{
      background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12,
      padding:'20px 22px', display:'flex', alignItems:'center', gap:16,
      transition:'border-color .2s',
    }}
      onMouseEnter={e=>e.currentTarget.style.borderColor='var(--border2)'}
      onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}
    >
      <div style={{
        width:48,height:48,borderRadius:14,background:`linear-gradient(135deg, ${color}30, transparent)`,
        display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0,
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
  const { user, isAdmin } = useAuth();
  const { solved, grassData, problems: appProblems } = useApp();
  const toast = useToast();
  const { t, lang } = useLang();
  const [dailyMissions, setDailyMissions] = useState([]);
  const [weeklyChallenge, setWeeklyChallenge] = useState(null);
  const [followFeed, setFollowFeed] = useState([]);
  const [promotion, setPromotion] = useState({ active: null, recent: null });
  const [referral, setReferral] = useState(null);
  const [copiedReferral, setCopiedReferral] = useState(false);
  const loadErrorToastShownRef = useRef(false);
  const { rankingData } = useRankingData();
  const PROBLEMS = appProblems.length > 0 ? appProblems : DEFAULT_PROBLEMS;
  const recentRank = rankingData.slice(0, 5);
  const myRank = rankingData.find(u => u.id === user?.id)?.rank || null;
  const locale = lang === 'ko' ? 'ko-KR' : 'en-US';

  const tierMeta   = TIER_META[user?.tier] || TIER_META.bronze;
  const solvedList = PROBLEMS.filter(p => solved[p.id]);
  const recentSolved = solvedList.slice(-5).reverse();
  const unsolved   = PROBLEMS.filter(p => !solved[p.id]);
  const todayProb  = unsolved[0] || PROBLEMS[0];
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
  const showLoadErrorToast = useCallback((message = '대시보드 데이터를 불러오지 못했습니다.') => {
    if (loadErrorToastShownRef.current) return;
    loadErrorToastShownRef.current = true;
    toast?.show(message, 'error');
  }, [toast]);

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
    api.get('/missions/daily')
      .then(({ data }) => {
        if (!cancelled) setDailyMissions(Array.isArray(data?.missions) ? data.missions : []);
      })
      .catch((err) => {
        if (!cancelled) setDailyMissions([]);
        if (err?.response?.status !== 401) {
          showLoadErrorToast(err?.response?.data?.message || '일일 미션을 불러오지 못했습니다.');
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.get('/weekly')
      .then(({ data }) => {
        if (!cancelled) setWeeklyChallenge(data || null);
      })
      .catch((err) => {
        if (!cancelled) setWeeklyChallenge(null);
        if (err?.response?.status !== 401) {
          showLoadErrorToast(err?.response?.data?.message || '주간 챌린지를 불러오지 못했습니다.');
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
          showLoadErrorToast(err?.response?.data?.message || '승급 정보를 불러오지 못했습니다.');
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
          showLoadErrorToast(err?.response?.data?.message || '팔로우 피드를 불러오지 못했습니다.');
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

  // 관리자 대시보드
  if (isAdmin) return (
    <div style={{padding:'28px 32px',overflowY:'auto',height:'100%'}}>
      <div style={{marginBottom:28}}>
        <h1 style={{fontSize:22,fontWeight:800,marginBottom:4}}>👑 {t('dashboardAdminTitle')}</h1>
        <p style={{color:'var(--text2)',fontSize:13}}>{t('dashboardAdminDesc')}</p>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:14,marginBottom:28}}>
        <StatCard icon={<BookOpen size={20} />} value={PROBLEMS.length}     label={t('dashboardRegisteredProblems')} color="var(--blue)"   />
        <StatCard icon={<Sparkles size={20} />} value={recentRank.length}   label={t('dashboardActiveUsers')} color="var(--green)"  />
        <StatCard icon={<CheckCircle2 size={20} />} value={PROBLEMS.reduce((s,p)=>s+(p.solved||p.solved_count||0),0)} label={t('solvedCount')} color="var(--yellow)" />
        <StatCard icon={<BarChart3 size={20} />} value={PROBLEMS.reduce((s,p)=>s+(p.submissions||p.submit_count||0),0)} label={t('submissionCount')} color="var(--orange)" />
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:12,padding:22}}>
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
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:12,padding:22}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:16}}>⚡ {t('quickAction')}</div>
          {[
            {label:t('dashboardCreateProblem'),   icon:<BookOpen size={15} />, page:'admin',    color:'var(--blue)'  },
            {label:t('problemList'),     icon:<BookOpen size={15} />, page:'problems', color:'var(--green)' },
            {label:t('dashboardManageContest'),     icon:<Trophy size={15} />, page:'contest',  color:'var(--yellow)'},
            {label:t('dashboardGenerateAiProblem'),  icon:<Bot size={15} />, page:'admin',    color:'var(--purple)'},
          ].map(a=>(
            <button key={a.label} onClick={()=>navigate('/'+a.page)} style={{
              width:'100%',display:'flex',alignItems:'center',gap:10,
              padding:'10px 14px',marginBottom:8,borderRadius:8,
              background:'var(--bg3)',border:'1px solid var(--border)',
              color:'var(--text)',cursor:'pointer',fontFamily:'inherit',fontSize:13,
              textAlign:'left',transition:'all .15s',
            }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=a.color;e.currentTarget.style.color=a.color;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text)';}}
            >{a.icon} {a.label}</button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{padding:'24px 28px',overflowY:'auto',height:'100%',maxWidth:1200,margin:'0 auto'}}>
      {/* 상단 환영 */}
      <div style={{
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
            }}>● {tierMeta.label}</span>
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
              <span>{tierMeta.label}</span>
              <span>{tierMeta.next} +{ratingMax - (user?.rating||800)}점</span>
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
        <div style={{display:'flex',gap:24,flexWrap:'wrap'}}>
          {[
            {v:t('dashboardStreakValue').replace('{n}', String(user?.streak || 0)), l:t('streak')},
            {v:solvedList.length,      l:t('solved')},
            {v:`${accuracy}%`,         l:t('dashboardAccuracy')},
          ].map(s=>(
            <div key={s.l} style={{textAlign:'center'}}>
              <div style={{
                fontFamily:'Space Mono,monospace',fontSize:20,fontWeight:700,
                color:'var(--text)',lineHeight:1,
              }}>{s.v}</div>
              <div style={{fontSize:11,color:'var(--text2)',marginTop:4}}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 통계 카드 */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:20}}>
        <StatCard icon={<BookOpen size={20} />} value={PROBLEMS.length}    label={t('problems')}    color="var(--blue)" delta={t('dashboardProblemsDelta')} />
        <StatCard icon={<CheckCircle2 size={20} />} value={solvedList.length}  label={t('solved')}  color="var(--green)" delta={`▲ ${Math.min(99, solvedList.length || 1)}%`} />
        <StatCard icon={<TrendingUp size={20} />} value={user?.rating||800}  label={t('rating')}  color="var(--yellow)" delta={t('dashboardGrowthDelta').replace('{n}', String(Math.max(12, (user?.streak||0) * 2)))} />
        <StatCard icon={<Target size={20} />} value={myRank?`#${myRank}`:'−'} label={t('dashboardMyRank')} color="var(--purple)" delta={t('dashboardRealtimeTrack')} />
      </div>

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
                  {t('dashboardPromotionRecord').replace('{from}', promotion.active.from_tier).replace('{to}', promotion.active.to_tier).replace('{wins}', String(promotion.active.wins)).replace('{losses}', String(promotion.active.losses))}
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
              <h3 style={{ margin:'8px 0 6px', fontSize:22, fontWeight:800 }}>{t('dashboardPromotionAchieved').replace('{tier}', promotion.recent.to_tier)}</h3>
              <p style={{ color:'var(--text2)', marginBottom:14 }}>
                {t('dashboardPromotionDesc').replace('{wins}', String(promotion.recent.wins)).replace('{from}', promotion.recent.from_tier).replace('{to}', promotion.recent.to_tier)}
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/ranking')}>{t('dashboardCheckRanking')}</button>
            </div>
          )}

          {dailyMissions.length > 0 && (
            <div style={{
              padding:'18px 22px',
              borderRadius:16,
              border:'1px solid var(--border)',
              background:'var(--bg2)',
            }}>
              <h3 style={{ color:'var(--text)', marginBottom:12, fontSize:16, fontWeight:800 }}>📋 {t('dashboardDailyMissions')}</h3>
              {dailyMissions.map((mission) => (
                <div key={mission.type} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                  <span style={{ fontSize:18 }}>{mission.isCompleted ? '✅' : '⬜'}</span>
                  <span style={{
                    color: mission.isCompleted ? 'var(--text3)' : 'var(--text)',
                    textDecoration: mission.isCompleted ? 'line-through' : 'none',
                  }}>
                    {mission.label}
                  </span>
                  <span style={{ marginLeft:'auto', color:'var(--yellow)', fontSize:13 }}>+{mission.rewardValue}pt</span>
                </div>
              ))}
            </div>
          )}

          {referral && (
            <div style={{ border:'1px solid var(--border)', borderRadius:12, padding:20, marginBottom:4, background:'var(--bg2)' }}>
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
                  await navigator.clipboard.writeText(referral.inviteUrl)
                  setCopiedReferral(true)
                  setTimeout(() => setCopiedReferral(false), 2000)
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
                {weeklyChallenge.tier} · {t('difficulty')} {weeklyChallenge.difficulty} · {t('dashboardRewardLabel')}: {weeklyChallenge.rewardCode}
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

          {/* 잔디 */}
          <div className="card card-hover" style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:12,padding:22}}>
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

          {/* 오늘의 문제 */}
          {todayProb && (
            <div className="card-hover pulse-cta" style={{
              background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:12,
              padding:22,cursor:'pointer',transition:'border-color .2s',
            }}
              onMouseEnter={e=>e.currentTarget.style.borderColor='var(--blue)'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}
              onClick={()=>navigate('/problems/'+todayProb.id, { state: { problem: todayProb } })}
            >
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                <div>
                  <div style={{fontSize:11,color:'var(--text3)',fontWeight:600,marginBottom:4,textTransform:'uppercase',letterSpacing:.5}}>
                    {t('recommendedProblems')}
                  </div>
                  <h3 style={{fontSize:17,fontWeight:800}}>{todayProb.title}</h3>
                </div>
                <span style={{
                  padding:'4px 10px',borderRadius:20,fontSize:11,fontWeight:700,
                  background:TIERS[todayProb.tier]?.bg||'var(--bg3)',
                  color:TIERS[todayProb.tier]?.color||'var(--text2)',
                }}>● {TIERS[todayProb.tier]?.label||todayProb.tier}</span>
              </div>
              <p style={{fontSize:13,color:'var(--text2)',lineHeight:1.6,marginBottom:14}}>
                {(todayProb.desc||todayProb.description||'').slice(0,100)}...
              </p>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{display:'flex',gap:16,fontSize:12,color:'var(--text3)'}}>
                  <span>{t('dashboardEstimatedTime').replace('{n}', String(todayProb.timeLimit||todayProb.time_limit||2))}</span>
                  <span>{t('dashboardSolvedYesterday').replace('{n}', (todayProb.solved||todayProb.solved_count||0).toLocaleString())}</span>
                </div>
                <button style={{
                  padding:'7px 16px',borderRadius:7,background:'var(--blue)',
                  border:'none',color:'var(--bg)',fontSize:12,fontWeight:700,cursor:'pointer',
                }}>{t('dashboardSolveNow')}</button>
              </div>
            </div>
          )}

          {/* 티어별 진행률 */}
          <div className="card card-hover" style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:12,padding:22}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:16,display:'flex',alignItems:'center',gap:8}}><BarChart3 size={16} />{t('dashboardTierConquest')}</div>
            {Object.entries(TIERS).map(([k,v])=>{
              const cnt = PROBLEMS.filter(p=>p.tier===k&&solved[p.id]).length;
              const tot = PROBLEMS.filter(p=>p.tier===k).length;
              const pct = tot ? Math.round(cnt/tot*100) : 0;
              return (
                <div key={k} style={{marginBottom:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:11,fontWeight:700,fontFamily:'Space Mono,monospace',color:v.color}}>● {v.label}</span>
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
          <div className="card card-hover" style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:12,padding:22}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontWeight:700,fontSize:14,display:'flex',alignItems:'center',gap:8}}><Trophy size={16} />실시간 랭킹</div>
              <button onClick={()=>navigate('/ranking')} style={{
                fontSize:12,color:'var(--blue)',background:'none',border:'none',cursor:'pointer',
              }}>{t('dashboardViewAll')}</button>
            </div>
            {recentRank.length === 0 && (
              <div style={{textAlign:'center',padding:'20px 0',color:'var(--text3)',fontSize:13}}>
                {t('dashboardRankingLoading')}
              </div>
            )}
            {recentRank.map((r,i)=>{
              const isMe = r.id === user?.id;
              const medals = ['🥇','🥈','🥉'];
              return (
                <div key={r.id} style={{
                  display:'flex',alignItems:'center',gap:10,
                  padding:'10px 12px',borderRadius:8,marginBottom:4,
                  background: isMe ? 'rgba(121,192,255,.06)' : 'transparent',
                  border: isMe ? '1px solid rgba(121,192,255,.15)' : '1px solid transparent',
                  transition:'background .15s',
                }}>
                  <span style={{fontSize:i<3?16:12,width:22,textAlign:'center',
                    color:i>=3?'var(--text3)':'inherit',fontFamily:'Space Mono,monospace',fontWeight:700}}>
                    {i<3 ? medals[i] : `${i+1}`}
                  </span>
                  <div style={{
                    width:28,height:28,borderRadius:'50%',
                    background:`${TIER_META[r.tier]?.color||'#888'}20`,
                    border:`1.5px solid ${TIER_META[r.tier]?.color||'#888'}50`,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:10,fontWeight:700,color:TIER_META[r.tier]?.color,flexShrink:0,
                  }}>{(r.name||r.username||'?').slice(0,2).toUpperCase()}</div>
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
          <div className="card card-hover" style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:12,padding:22}}>
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
                    {TIERS[p.tier]?.label||p.tier}
                  </span>
                </div>
              ))
            }
          </div>

          {followFeed.length > 0 && (
            <div className="card card-hover" style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:12,padding:22}}>
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
                          onClick={() => navigate(`/community?post=${item.postId}`)}
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
          <div className="card card-hover" style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:12,padding:22}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:12,display:'flex',alignItems:'center',gap:8}}><Sparkles size={16} />{t('quickAction')}</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {[
                {icon:<BookOpen size={16} />,label:t('problemList'), page:'problems'},
                {icon:<Bot size={16} />,label:t('ai'),   page:'ai'},
                {icon:<Trophy size={16} />,label:t('joinContest'),  page:'contest'},
                {icon:<FileText size={16} />,label:t('submissions'),  page:'submissions'},
              ].map(a=>(
                <button key={a.label} onClick={()=>navigate('/'+a.page)} style={{
                  padding:'11px 10px',borderRadius:8,
                  background:'var(--bg3)',border:'1px solid var(--border)',
                  color:'var(--text)',cursor:'pointer',fontSize:12,fontWeight:600,
                  fontFamily:'inherit',display:'flex',alignItems:'center',
                  gap:6,justifyContent:'center',transition:'all .15s',
                }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--blue)';e.currentTarget.style.color='var(--blue)';}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text)';}}
                >{a.icon} {a.label}</button>
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
            { step:2, title:t('dashboardRoadmapStep2'),  tags:['구현','문자열'],        icon:'🔄', color:'#cd7f32' },
            { step:3, title:t('dashboardRoadmapStep3'),     tags:['정렬','배열'],          icon:'📊', color:'#c0c0c0' },
            { step:4, title:t('dashboardRoadmapStep4'),       tags:['스택','큐'],           icon:'📚', color:'#c0c0c0' },
            { step:5, title:t('dashboardRoadmapStep5'),       tags:['완전탐색','백트래킹'],   icon:'🔍', color:'#ffd700' },
            { step:6, title:t('dashboardRoadmapStep6'),     tags:['BFS','DFS','그래프'],   icon:'🌐', color:'#ffd700' },
            { step:7, title:t('dashboardRoadmapStep7'),  tags:['DP','동적프로그래밍'],   icon:'💎', color:'#00e5cc' },
            { step:8, title:t('dashboardRoadmapStep8'),   tags:['이분탐색','그리디','분할정복'], icon:'🏆', color:'#b9f2ff' },
          ].map(stage => {
            const stageProblems = PROBLEMS.filter(p => (p.tags||[]).some(t => stage.tags.includes(t)));
            const stageSolved = stageProblems.filter(p => solved[p.id]).length;
            const total = stageProblems.length || 1;
            const pct = Math.round(stageSolved / total * 100);
            const isComplete = pct >= 100;
            return (
              <div key={stage.step} style={{
                background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:12,
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
