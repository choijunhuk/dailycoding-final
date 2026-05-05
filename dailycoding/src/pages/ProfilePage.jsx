import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { PROBLEMS as DEFAULT_PROBLEMS, TIERS, TIER_COLORS } from '../data/problems';
import api from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus.js';
import { useSubscriptionCheckout } from '../hooks/useSubscriptionCheckout.js';
import { JUDGE_LANGUAGE_OPTIONS } from '../data/judgeLanguages.js';
import { TIER_POINTS, TIER_ORDER } from '../data/constants.js';
import { buildYearHeatmap, formatDuration, PROFILE_TIER_LABELS, PROFILE_TIER_THRESHOLDS } from './profilePageUtils.js';
import { buildPaymentFeedback, formatCurrentSubscriptionLabel, getProfileUpgradePlans } from './profileSubscriptionUtils.js';
import { DonutChart, TierBadge, YearHeatmap } from './profilePageWidgets.jsx';
import './ProfilePage.css';

const TECH_OPTIONS = [
  'JavaScript','TypeScript','Python','Java','C++','C','Go','Rust','Kotlin','Swift',
  'React','Vue','Angular','Next.js','Node.js','Express','Spring','Django','FastAPI','Flutter',
  'MySQL','PostgreSQL','MongoDB','Redis','Docker','Kubernetes','AWS','GCP','Azure','Git',
];
const PROFILE_LINK_LABELS = { github:'GitHub', instagram:'Instagram', x:'X', linkedin:'LinkedIn', velog:'Velog', tistory:'Tistory' };

const TECH_LOGO_MAP = {
  JavaScript:'/tech/javascript.webp', Python:'/tech/python.png', Java:'/tech/java.webp',
  'C++':'/tech/cpp.png', C:'/tech/c.png', Go:'/tech/go.png', Rust:'/tech/rust.png',
  Kotlin:'/tech/kotlin.png', Swift:'/tech/swift.png', React:'/tech/react.png',
  Vue:'/tech/vue.png', Angular:'/tech/angular.png', 'Next.js':'/tech/nextjs.png',
  'Node.js':'/tech/nodejs.png', Express:'/tech/express.png', Spring:'/tech/spring.png',
  Django:'/tech/django.png', FastAPI:'/tech/fastapi.svg', Flutter:'/tech/flutter.png',
  MySQL:'/tech/mysql.png', PostgreSQL:'/tech/postgresql.png', MongoDB:'/tech/mongodb.png',
  Redis:'/tech/redis.webp', Docker:'/tech/docker.png', Kubernetes:'/tech/kubernetes.png',
  AWS:'/tech/aws.webp', GCP:'/tech/gcp.png', Azure:'/tech/azure.svg',
};

const SOCIAL_ICON_META = {
  github:    { label:'GitHub',    color:'var(--text2)', icon:<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg> },
  instagram: { label:'Instagram', color:'#e1306c',      icon:<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg> },
  x:         { label:'X',         color:'var(--text2)', icon:<img src="/social/x.webp"       width="14" height="14" alt="X"        style={{ objectFit:'contain' }} /> },
  twitter:   { label:'X',         color:'var(--text2)', icon:<img src="/social/x.webp"       width="14" height="14" alt="X"        style={{ objectFit:'contain' }} /> },
  linkedin:  { label:'LinkedIn',  color:'#0077b5',      icon:<img src="/social/linkedin.png" width="14" height="14" alt="LinkedIn" style={{ objectFit:'contain' }} /> },
  velog:     { label:'Velog',     color:'#20c997',      icon:<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="12" fill="#20c997"/><text x="12" y="16" textAnchor="middle" fill="white" fontSize="12" fontWeight="900" fontFamily="sans-serif">V</text></svg> },
  tistory:   { label:'Tistory',   color:'#ff5a00',      icon:<img src="/social/tistory.png"  width="14" height="14" alt="Tistory" style={{ objectFit:'contain' }} /> },
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const { solved, submissions, problems: appProblems } = useApp();
  const {
    subscriptionStatus: subPlan,
    refreshSubscriptionStatus,
    invalidateSubscriptionStatus,
  } = useSubscriptionStatus(user?.id);
  const { loadingPlan, startCheckout } = useSubscriptionCheckout();
  const PROBLEMS = appProblems.length > 0 ? appProblems : DEFAULT_PROBLEMS;

  const [mainTab,       setMainTab]       = useState('solved');
  const [top100,        setTop100]        = useState([]);
  const [avatarColor,   setAvatarColor]   = useState(user?.avatarColor || null);
  const [avatarEmoji,   setAvatarEmoji]   = useState(user?.avatarEmoji || null);
  const [avatarUrlCustom, setAvatarUrlCustom] = useState(user?.avatarUrlCustom || null);
  const [backgrounds, setBackgrounds] = useState([]);
  const [equippedBackground, setEquippedBackground] = useState(user?.equippedBackground || null);
  const [rewards,       setRewards]       = useState([]);
  const [equippedBadge, setEquippedBadge] = useState(user?.equippedBadge || null);
  const [equippedTitle, setEquippedTitle] = useState(user?.equippedTitle || null);
  const [progression, setProgression] = useState(null);
  const [followStats,   setFollowStats]   = useState({ followers:0, following:0 });
  const [bio,           setBio]           = useState(user?.bio || '');
  const [pwCurrent,     setPwCurrent]     = useState('');
  const [pwNext,        setPwNext]        = useState('');
  const [pwConfirm,     setPwConfirm]     = useState('');
  const [pwMsg,         setPwMsg]         = useState('');
  const [pwLoading,     setPwLoading]     = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMsg,     setCancelMsg]     = useState('');
  const [paymentFeedback, setPaymentFeedback] = useState(null);
  const [defaultLanguage, setDefaultLanguage] = useState(user?.defaultLanguage || 'python');
  const [submissionsPublic, setSubmissionsPublic] = useState(user?.submissionsPublic ?? true);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [socialLinks, setSocialLinks] = useState(user?.socialLinks || {});
  const [techStack, setTechStack] = useState(user?.techStack || []);
  const [profileInfoSaving, setProfileInfoSaving] = useState(false);
  const [fullGrass, setFullGrass] = useState([]);
  const [solveStats, setSolveStats] = useState({
    avgSolveTime: null,
    fastestSolve: null,
    totalSolveTime: 0,
    solveTimeByTier: {},
  });
  const [weaknessStats, setWeaknessStats] = useState([]);
  const loadErrorToastShownRef = useRef(false);

  useEffect(() => {
    setDefaultLanguage(user?.defaultLanguage || 'python');
    setSubmissionsPublic(user?.submissionsPublic ?? true);
    setDisplayName(user?.displayName || '');
    setSocialLinks(user?.socialLinks || {});
    setTechStack(user?.techStack || []);
  }, [user?.id]);

  const showLoadErrorToast = (message = '프로필 데이터를 불러오지 못했습니다.') => {
    if (loadErrorToastShownRef.current) return;
    loadErrorToastShownRef.current = true;
    toast?.show(message, 'error');
  };

  useEffect(() => {
    api.get('/rewards/my').then(r => {
      setRewards(r.data.rewards || []);
      setEquippedBadge(r.data.equippedBadge);
      setEquippedTitle(r.data.equippedTitle);
      setProgression(r.data.progression || null);
      return api.get('/auth/profile/backgrounds').then(bg => setBackgrounds(bg.data || []));
    }).catch((err) => {
      if (err?.response?.status !== 401) showLoadErrorToast(err?.response?.data?.message || '보상 정보를 불러오지 못했습니다.');
    });
    api.get('/auth/top100').then(r => setTop100(r.data || [])).catch((err) => {
      if (err?.response?.status !== 401) showLoadErrorToast(err?.response?.data?.message || '랭킹 통계를 불러오지 못했습니다.');
    });
    if (user?.id) {
      api.get(`/follows/${user.id}/stats`).then(r => setFollowStats(r.data)).catch((err) => {
        if (err?.response?.status !== 401) showLoadErrorToast(err?.response?.data?.message || '팔로우 통계를 불러오지 못했습니다.');
      });
      api.get('/auth/me/stats').then(r => setSolveStats(r.data)).catch((err) => {
        if (err?.response?.status !== 401) showLoadErrorToast(err?.response?.data?.message || '풀이 통계를 불러오지 못했습니다.');
      });
      api.get('/submissions/stats').then(r => setWeaknessStats(r.data?.weaknessStats || [])).catch(() => {
        setWeaknessStats([]);
      });
    }
    const params = new URLSearchParams(location.search);
    if (params.get('payment') === 'success') {
      invalidateSubscriptionStatus();
      refreshSubscriptionStatus().then(() => {
        setPaymentFeedback(buildPaymentFeedback('success'));
        toast?.show('🎉 구독이 완료됐습니다! 플랜이 적용됐어요.', 'success', 5000);
        navigate('/profile', { replace: true });
      });
    } else if (params.get('payment') === 'cancelled') {
      setPaymentFeedback(buildPaymentFeedback('cancelled'));
      toast?.show('결제가 취소됐습니다.', 'info');
      navigate('/profile', { replace: true });
    }
  }, [user?.id, location.search, invalidateSubscriptionStatus, navigate, refreshSubscriptionStatus, toast]);

  useEffect(() => {
    setAvatarUrlCustom(user?.avatarUrlCustom || null);
    setEquippedBackground(user?.equippedBackground || null);
  }, [user?.avatarUrlCustom, user?.equippedBackground]);

  useEffect(() => {
    if (!user?.id) return;
    api.get(`/auth/grass/${user.id}`).then((res) => {
      setFullGrass(Array.isArray(res.data) ? res.data : []);
    }).catch(() => {
      setFullGrass([]);
    });
  }, [user?.id]);

  const solvedProblemsMain = PROBLEMS.filter(p => solved[p.id] && (p.problemType || 'coding') === 'coding');
  const solvedFillBlank = PROBLEMS.filter(p => solved[p.id] && (p.problemType || 'coding') === 'fill-blank');
  const solvedBugFix = PROBLEMS.filter(p => solved[p.id] && (p.problemType || 'coding') === 'bug-fix');
  const practiceTracks = user?.practiceTracks || {
    fillBlank: { solvedCount: solvedFillBlank.length, tier: 'unranked' },
    bugFix: { solvedCount: solvedBugFix.length, tier: 'unranked' },
  };
  const solvedProblems = solvedProblemsMain;
  const correctCount   = submissions.filter(s => s.result === 'correct').length;
  const accuracy       = submissions.length ? Math.round(correctCount / submissions.length * 100) : 0;

  const tierCounts = { bronze:0, silver:0, gold:0, platinum:0, diamond:0 };
  solvedProblems.forEach(p => { if (p.tier && tierCounts[p.tier] !== undefined) tierCounts[p.tier]++; });

  const top100RatingSum = top100.reduce((s, p) => s + (TIER_POINTS[p.tier] || 20), 0);

  const tc       = TIER_COLORS[user?.tier] || '#888';
  const equippedBgMeta = backgrounds.find((item) => item.slug === equippedBackground);
  const profileBannerBackground = equippedBgMeta?.image_url?.startsWith('gradient:')
    ? equippedBgMeta.image_url.replace('gradient:', '')
    : equippedBgMeta?.image_url
      ? `url(${equippedBgMeta.image_url}) center/cover`
      : `linear-gradient(135deg, ${tc}28 0%, ${tc}08 50%, var(--bg2) 100%)`;
  const tierIdx  = TIER_ORDER.indexOf(user?.tier || 'unranked');
  const nextTier = TIER_ORDER[tierIdx + 1];
  const curThres = PROFILE_TIER_THRESHOLDS[user?.tier || 'unranked'] || 0;
  const nextThres = nextTier ? PROFILE_TIER_THRESHOLDS[nextTier] : null;
  const ratingProgress = nextThres
    ? Math.min(Math.max(((user?.rating || 0) - curThres) / (nextThres - curThres) * 100, 0), 100)
    : 100;
  const nextProgressReward = progression?.nextReward
    ? progression.nextReward.kind === 'background'
      ? `Lv.${progression.nextReward.level} 프로필 배경`
      : `Lv.${progression.nextReward.level} 보상`
    : '모든 성장 보상 해금';

  const langStats = submissions.reduce((acc, s) => { acc[s.lang] = (acc[s.lang]||0)+1; return acc; }, {});
  const topLang   = Object.entries(langStats).sort((a,b)=>b[1]-a[1]);
  const resultStats = {
    correct: submissions.filter(s=>s.result==='correct').length,
    wrong:   submissions.filter(s=>s.result==='wrong').length,
    timeout: submissions.filter(s=>s.result==='timeout').length,
    error:   submissions.filter(s=>s.result==='error'||s.result==='compile').length,
  };
  const heatmapCells = buildYearHeatmap(fullGrass);
  const activeHeatmapDays = heatmapCells.filter((item) => item.level > 0).length;
  const upgradePlans = getProfileUpgradePlans();

  const handlePwChange = async () => {
    if (pwNext !== pwConfirm) { setPwMsg('새 비밀번호가 일치하지 않습니다.'); return; }
    if (pwNext.length < 8)    { setPwMsg('비밀번호는 8자 이상이어야 합니다.'); return; }
    setPwLoading(true);
    try {
      await api.patch('/auth/password', { current: pwCurrent, next: pwNext });
      setPwMsg('✅ 비밀번호가 변경됐습니다!');
      toast?.show('🔒 비밀번호가 변경됐습니다.', 'success');
      setPwCurrent(''); setPwNext(''); setPwConfirm('');
    } catch (err) {
      setPwMsg('❌ ' + (err.response?.data?.message || '변경 실패'));
    }
    setPwLoading(false);
  };

  const handleUpgrade = async (planId) => {
    const result = await startCheckout(planId);
    if (!result.ok) {
      toast?.show(result.reason || '결제 세션 생성 실패', 'error');
    }
  };

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    setCancelMsg('');
    try {
      const { data } = await api.post('/subscription/cancel');
      await refreshSubscriptionStatus();
      setCancelMsg(data?.message || '구독 해지 예약이 등록되었습니다.');
      toast?.show(data?.message || '구독 해지 예약이 등록되었습니다.', 'success');
    } catch (err) {
      const message = err.response?.data?.message || '구독 해지 예약에 실패했습니다.';
      setCancelMsg(message);
      toast?.show(message, 'error');
    }
    setCancelLoading(false);
  };

  const handleEquip = async (type, code) => {
    const current = type === 'badge' ? equippedBadge : equippedTitle;
    const newCode = current === code ? null : code;
    try {
      await api.post('/rewards/equip', { type, code: newCode });
      if (type === 'badge') setEquippedBadge(newCode);
      else setEquippedTitle(newCode);
      toast?.show(newCode ? '✅ 장착됨' : '장착 해제됨', 'success');
    } catch (err) {
      toast?.show('❌ ' + (err.response?.data?.message || '실패'), 'error');
    }
  };

  const handleSavePreferences = async () => {
    setPrefsSaving(true);
    try {
      await updateUser({
        default_language: defaultLanguage,
        submissions_public: submissionsPublic,
      });
      toast?.show('✅ 제출/언어 설정이 저장됐습니다.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || '설정 저장 실패', 'error');
    }
    setPrefsSaving(false);
  };

  const handleSaveProfileInfo = async () => {
    setProfileInfoSaving(true);
    try {
      const filteredLinks = Object.fromEntries(Object.entries(socialLinks).filter(([, v]) => v));
      await api.patch('/auth/profile/extended', {
        display_name: displayName,
        bio,
        social_links: filteredLinks,
        tech_stack: techStack,
      });
      toast?.show('✅ 프로필 정보가 저장됐습니다.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || '저장 실패', 'error');
    }
    setProfileInfoSaving(false);
  };

  const TABS = [
    ['solved',   '해결현황'],
    ['top100',   '상위 100'],
    ['stats',    '통계'],
    ['streak',   '스트릭'],
    ['settings', '설정'],
  ];

  return (
    <div className="profile-page">

      {/* ── 배너 헤더 ── */}
      <div className="profile-header-card">
        {/* 배너 배경 */}
        <div className="profile-header-banner" style={{ background: profileBannerBackground }}/>

        {/* 프로필 콘텐츠 */}
        <div className="profile-header-content">
          {/* 아바타 */}
          <div className="profile-header-avatar" style={{
            border: `3px solid ${tc}`, background: avatarColor || 'var(--bg3)',
            boxShadow: `0 0 0 4px var(--bg2), 0 6px 28px ${tc}55`,
          }}>
            {avatarUrlCustom
              ? <img src={avatarUrlCustom} alt="avatar" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : (avatarEmoji || user?.username?.slice(0,2).toUpperCase())}
          </div>

          {/* 정보 */}
          <div className="profile-header-info">
            <div className="profile-header-name-row">
              {equippedBadge && (
                <span className="profile-equipped-badge" title={rewards.find(r=>r.code===equippedBadge)?.name}>
                  {rewards.find(r=>r.code===equippedBadge)?.icon}
                </span>
              )}
              <span className="profile-username">{user?.username}</span>
              <span className="profile-tier-badge" style={{
                background:`${tc}20`, color:tc, border:`1px solid ${tc}50`,
              }}>{PROFILE_TIER_LABELS[user?.tier || 'unranked']}</span>
              {subPlan?.tier && subPlan.tier !== 'free' && (
                <span className="profile-sub-badge" style={{
                  background: subPlan.tier==='team'?'rgba(255,215,0,.15)':'rgba(121,192,255,.15)',
                  color: subPlan.tier==='team'?'#ffd700':'#79c0ff',
                  border: `1px solid ${subPlan.tier==='team'?'rgba(255,215,0,.3)':'rgba(121,192,255,.3)'}`,
                }}>{subPlan.tier.toUpperCase()}</span>
              )}
              {equippedTitle && (
                <span className="profile-title-badge">
                  {rewards.find(r=>r.code===equippedTitle)?.icon} {rewards.find(r=>r.code===equippedTitle)?.name}
                </span>
              )}
            </div>
            {user?.bio && <div className="profile-bio">{user.bio}</div>}
            <div className="profile-meta-info">가입일 {user?.joinDate} · {user?.email}</div>
            {techStack.length > 0 && (
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
                {techStack.slice(0, 10).map(tech => (
                  <span key={tech} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, padding:'3px 8px', borderRadius:20, background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text2)' }}>
                    {TECH_LOGO_MAP[tech] && <img src={TECH_LOGO_MAP[tech]} width={12} height={12} alt="" style={{ objectFit:'contain', flexShrink:0 }}/>}
                    {tech}
                  </span>
                ))}
              </div>
            )}
            {Object.entries(socialLinks).some(([, v]) => v) && (
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:6 }}>
                {Object.entries(socialLinks).filter(([, url]) => url).map(([key, url]) => {
                  const meta = SOCIAL_ICON_META[key];
                  if (!meta) return null;
                  const href = url.startsWith('http') ? url : `https://${url}`;
                  return (
                    <a key={key} href={href} target="_blank" rel="noopener noreferrer"
                      title={meta.label}
                      style={{
                        display:'flex', alignItems:'center', gap:4,
                        padding:'3px 8px', borderRadius:20, background:'var(--bg3)',
                        border:'1px solid var(--border)', color:meta.color,
                        fontSize:11, fontWeight:600, textDecoration:'none',
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity='0.75'}
                      onMouseLeave={e => e.currentTarget.style.opacity='1'}
                    >{meta.icon}{meta.label}</a>
                  );
                })}
              </div>
            )}

            {/* 스탯 */}
            <div className="profile-header-stats">
              {[
                { v: user?.rating||0,         l:'레이팅',  c:tc,              mono:true },
                { v: solvedProblemsMain.length, l:'메인 풀이수', c:'var(--green)'          },
                { v: `🔥${user?.streak||0}`,  l:'스트릭',  c:'var(--yellow)'             },
                { v: `${accuracy}%`,           l:'정답률',  c:'var(--orange)'             },
                { v: followStats.followers,    l:'팔로워',  c:'var(--text)'               },
              ].map(s=>(
                <div key={s.l} className="profile-stat-item">
                  <div className="profile-stat-value" style={{ color:s.c, fontFamily:s.mono?'Space Mono,monospace':undefined }}>{s.v}</div>
                  <div className="profile-stat-label">{s.l}</div>
                </div>
              ))}
            </div>

            {/* 다음 티어 진행 바 */}
            {nextTier && (
              <div className="profile-tier-progress-container">
                <div className="profile-tier-progress-labels">
                  <span style={{ color:tc, fontWeight:700 }}>{PROFILE_TIER_LABELS[user?.tier||'unranked']}</span>
                  <span>{nextTier.toUpperCase()}까지 {Math.max(0,(nextThres||0)-(user?.rating||0))}점</span>
                </div>
                <div className="profile-tier-progress-bar-bg">
                  <div className="profile-tier-progress-bar-fill" style={{
                    width:`${ratingProgress}%`,
                    background:`linear-gradient(90deg, ${tc}70, ${tc})`,
                  }}/>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {progression && (
        <div className="profile-growth-card card">
          <div className="profile-growth-main">
            <div>
              <div className="profile-growth-kicker">성장 경험치</div>
              <div className="profile-growth-title">Lv.{progression.level} · {progression.xp.toLocaleString()} XP</div>
              <div className="profile-growth-copy">
                일일 미션 보상은 랭킹 점수가 아니라 XP로만 쌓입니다. 배지, 칭호, 프로필 배경처럼 개인 프로필을 꾸미는 보상만 해금됩니다.
              </div>
            </div>
            <div className="profile-growth-next">
              <span>다음 해금</span>
              <strong>{nextProgressReward}</strong>
            </div>
          </div>
          <div className="profile-growth-bar">
            <div className="profile-growth-fill" style={{ width:`${Math.min(100, Math.max(0, progression.progressPercent || 0))}%` }} />
          </div>
          <div className="profile-growth-meta">
            <span>{progression.currentLevelXp.toLocaleString()} XP</span>
            <span>{progression.nextLevelXp.toLocaleString()} XP</span>
          </div>
        </div>
      )}

      {/* ── 탭 네비게이션 ── */}
      <div className="profile-tabs" style={{ marginBottom:16 }}>
        {TABS.map(([k,l])=>(
          <button key={k} className={`ptab ${mainTab===k?'active':''}`} onClick={()=>setMainTab(k)}>{l}</button>
        ))}
      </div>

      {/* ══════════════════════════════════════
          탭 1: 해결현황 (도넛 차트 + 난이도 분포)
      ══════════════════════════════════════ */}
      {mainTab==='solved' && (
        <div className="profile-solved-layout fade-up">
          <div className="card profile-donut-card">
            <div className="profile-solved-count-label">{solvedProblemsMain.length}문제 해결 (메인)</div>
            <DonutChart
              data={Object.entries(TIERS).map(([k,v])=>({ color:v.color, count:tierCounts[k]||0 }))}
              total={solvedProblemsMain.length}
            />
            <div style={{ marginTop: 12, display:'grid', gap:6, width:'100%' }}>
              <div style={{ fontSize: 12, color:'var(--text2)' }}>빈칸 채우기: <strong>{practiceTracks.fillBlank?.solvedCount ?? solvedFillBlank.length}</strong>문제 · 티어 {String(practiceTracks.fillBlank?.tier || 'unranked').toUpperCase()}</div>
              <div style={{ fontSize: 12, color:'var(--text2)' }}>틀린부분 찾기: <strong>{practiceTracks.bugFix?.solvedCount ?? solvedBugFix.length}</strong>문제 · 티어 {String(practiceTracks.bugFix?.tier || 'unranked').toUpperCase()}</div>
            </div>
          </div>

          <div className="card">
            <div className="profile-panel-header">
              난이도 분포
            </div>
            {/* 헤더 */}
            <div className="profile-dist-header">
              {['레벨','','문제','비율'].map((h,i)=>(
                <span key={i} className={`dist-h-${i}`}>{h}</span>
              ))}
            </div>
            {Object.entries(TIERS).map(([k,v])=>{
              const cnt = tierCounts[k]||0;
              const pct = solvedProblems.length ? (cnt/solvedProblems.length*100).toFixed(1) : '0.0';
              return (
                <div key={k} className="profile-dist-row">
                  <span className="dist-level" style={{ color:v.color }}>● {v.label}</span>
                  <div className="dist-bar-bg">
                    <div className="dist-bar-fill" style={{ width:`${solvedProblems.length?cnt/solvedProblems.length*100:0}%`, background:v.color }}/>
                  </div>
                  <span className="dist-count">{cnt}</span>
                  <span className="dist-pct">{pct}%</span>
                </div>
              );
            })}

            {/* 푼 문제 목록 */}
            {solvedProblems.length > 0 && (
              <div style={{ marginTop:20 }}>
                <div className="profile-panel-subtitle">풀이 목록</div>
                <div className="profile-solved-list">
                  {solvedProblems.map(p=>(
                    <div key={p.id} className="profile-solved-item">
                      <TierBadge tier={p.tier} size={24}/>
                      <span className="profile-solved-title">{p.title}</span>
                      <span className="profile-solved-id">#{p.id}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          탭 2: 상위 100
      ══════════════════════════════════════ */}
      {mainTab==='top100' && (
        <div className="fade-up profile-top100-layout">
          <div className="card">
            <div className="profile-top100-header">
              <div className="profile-top100-rating">
                <div className="profile-top100-label">상위 100문제의 난이도 합</div>
                <div className="profile-top100-value">
                  +{top100RatingSum}
                </div>
              </div>
              <div className="profile-top100-count">
                <div className="profile-top100-label">반영된 문제</div>
                <div className="profile-top100-value-small">
                  {top100.length}<span className="profile-top100-total">/100</span>
                </div>
              </div>
            </div>

            {/* 티어 배지 격자 */}
            <div className="profile-top100-grid">
              {top100.map(p=>(
                <div key={p.id} title={`${p.title} (+${TIER_POINTS[p.tier]||20})`} onClick={() => navigate(`/problems/${p.id}`)} style={{ cursor: 'pointer' }}>
                  <TierBadge tier={p.tier} size={34} />
                </div>
              ))}
              {Array.from({ length: Math.max(0, 100-top100.length) }, (_,i)=>(
                <div key={`e${i}`} className="profile-top100-empty-slot"/>
              ))}
            </div>
            <div className="profile-top100-note">
              배지를 클릭하면 해당 문제로 이동합니다 · B=브론즈 S=실버 G=골드 P=플래티넘 D=다이아
            </div>
          </div>

          {/* 문제 목록 */}
          <div className="card">
            <div className="profile-panel-header">
              반영 문제 목록 ({top100.length}개)
            </div>
            {top100.length === 0
              ? <div className="profile-empty-msg">아직 푼 문제가 없어요.</div>
              : (
                <div className="profile-top100-list">
                  {top100.map((p,i)=>(
                    <div key={p.id} className="profile-top100-item" onClick={() => navigate(`/problems/${p.id}`)} style={{ cursor: 'pointer' }}>
                      <span className="profile-top100-rank">{i+1}</span>
                      <TierBadge tier={p.tier} size={28}/>
                      <span className="profile-top100-title">{p.title}</span>
                      <span className="profile-top100-points" style={{ color:TIERS[p.tier]?.color||'var(--text3)' }}>
                        +{TIER_POINTS[p.tier]||20}
                      </span>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          탭 3: 통계
      ══════════════════════════════════════ */}
      {mainTab==='stats' && (
        <div className="fade-up profile-stats-layout">
          {/* 제출 요약 카드 */}
          <div className="profile-stats-summary">
            {[
              { label:'총 제출',  v:submissions.length,   color:'var(--blue)'   },
              { label:'정답',     v:resultStats.correct,  color:'var(--green)'  },
              { label:'오답',     v:resultStats.wrong,    color:'var(--red)'    },
              { label:'시간초과', v:resultStats.timeout,  color:'var(--yellow)' },
            ].map(s=>(
              <div key={s.label} className="card profile-stat-mini">
                <div className="profile-stat-mini-value" style={{ color:s.color }}>{s.v}</div>
                <div className="profile-stat-mini-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* 언어별 제출 */}
          <div className="card">
            <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>언어별 제출</div>
            {topLang.length===0
              ? <div style={{ color:'var(--text3)', fontSize:13 }}>제출 기록이 없어요.</div>
              : topLang.map(([lang,cnt],i)=>{
                const colors=['var(--blue)','var(--green)','var(--yellow)','var(--orange)','var(--purple)'];
                const color=colors[i%colors.length];
                const pct=Math.round(cnt/submissions.length*100);
                return (
                  <div key={lang} style={{ marginBottom:14 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background:color }}/>
                        <span style={{ fontSize:13, fontFamily:'Space Mono,monospace' }}>{lang}</span>
                      </div>
                      <div style={{ display:'flex', gap:10 }}>
                        <span style={{ fontSize:12, color:'var(--text2)' }}>{cnt}회</span>
                        <span style={{ fontSize:11, color:'var(--text3)', fontFamily:'Space Mono,monospace', width:32, textAlign:'right' }}>{pct}%</span>
                      </div>
                    </div>
                    <div style={{ height:6, background:'var(--bg3)', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:3, transition:'width 1s' }}/>
                    </div>
                  </div>
                );
              })
            }
          </div>

          {/* 이번 주 리포트 */}
          <div className="card">
            <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>이번 주 리포트</div>
            {(()=>{
              const now=new Date();
              const weekAgo=new Date(now-7*24*60*60*1000);
              const weekSubs=submissions.filter(s=>{try{return new Date(s.date)>=weekAgo;}catch{return false;}});
              const weekCorrect=weekSubs.filter(s=>s.result==='correct').length;
              const weekTotal=weekSubs.length;
              const weekRate=weekTotal>0?Math.round(weekCorrect/weekTotal*100):0;
              const dailyCounts=[0,0,0,0,0,0,0];
              weekSubs.forEach(s=>{
                try {
                  dailyCounts[new Date(s.date).getDay()]++;
                } catch {
                  // 잘못된 날짜 데이터는 주간 막대 집계에서 제외
                }
              });
              const maxDaily=Math.max(...dailyCounts,1);
              const dayNames=['일','월','화','수','목','금','토'];
              return (
                <div>
                  <div style={{ display:'flex', gap:16, marginBottom:16 }}>
                    {[{v:weekTotal,l:'총 제출',c:'var(--blue)'},{v:weekCorrect,l:'정답',c:'var(--green)'},{v:`${weekRate}%`,l:'정답률',c:'var(--yellow)'}].map(s=>(
                      <div key={s.l} style={{ textAlign:'center', flex:1 }}>
                        <div style={{ fontSize:22, fontWeight:800, color:s.c, fontFamily:'Space Mono,monospace' }}>{s.v}</div>
                        <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:4, alignItems:'end', height:60 }}>
                    {dailyCounts.map((cnt,i)=>(
                      <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                        <div style={{ width:'100%', height:`${Math.max(4,cnt/maxDaily*50)}px`, background:cnt>0?'var(--blue)':'var(--bg3)', borderRadius:3 }} title={`${dayNames[i]}: ${cnt}회`}/>
                        <span style={{ fontSize:9, color:'var(--text3)' }}>{dayNames[i]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom:12 }}>
              <div style={{ fontWeight:700, fontSize:14 }}>취약 유형 분석</div>
              <span style={{ fontSize:11, color:'var(--text3)' }}>오답률 높은 태그 기준</span>
            </div>
            {weaknessStats.length === 0 ? (
              <div style={{ color:'var(--text3)', fontSize:13, lineHeight:1.7 }}>
                같은 유형 제출이 2회 이상 쌓이면 취약 태그가 자동으로 표시됩니다.
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {weaknessStats.slice(0, 5).map((item) => {
                  const color = item.priority === 'high' ? 'var(--red)' : item.priority === 'medium' ? 'var(--yellow)' : 'var(--blue)';
                  return (
                    <div key={item.label} style={{ padding:'11px 12px', border:'1px solid var(--border)', borderRadius:10, background:'var(--bg3)' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', gap:10, marginBottom:6 }}>
                        <span style={{ fontSize:13, fontWeight:800, color }}>{item.label}</span>
                        <span style={{ fontSize:12, color:'var(--text2)' }}>
                          오답률 {item.missRate}% · {item.attempts}회
                        </span>
                      </div>
                      <div style={{ height:6, background:'var(--bg2)', borderRadius:4, overflow:'hidden', marginBottom:8 }}>
                        <div style={{ width:`${Math.min(100, item.missRate)}%`, height:'100%', background:color }} />
                      </div>
                      <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.6 }}>{item.recommendation}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card">
            <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>풀이 시간 통계</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:10, marginBottom:14 }}>
              {[
                { label:'평균 풀이 시간', value: formatDuration(solveStats.avgSolveTime) },
                { label:'총 풀이 시간', value: formatDuration(solveStats.totalSolveTime) },
                { label:'최단 기록', value: solveStats.fastestSolve ? `${solveStats.fastestSolve.problemTitle} · ${formatDuration(solveStats.fastestSolve.timeSec)}` : '기록 없음' },
              ].map((item) => (
                <div key={item.label} style={{ padding:'12px 14px', border:'1px solid var(--border)', borderRadius:10, background:'var(--bg3)' }}>
                  <div style={{ fontSize:11, color:'var(--text3)', marginBottom:6 }}>{item.label}</div>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{item.value}</div>
                </div>
              ))}
            </div>
            {Object.keys(solveStats.solveTimeByTier || {}).length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {Object.entries(solveStats.solveTimeByTier).map(([tierName, stat]) => (
                  <div key={tierName} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', border:'1px solid var(--border)', borderRadius:10 }}>
                    <span style={{ fontSize:12, fontWeight:700, textTransform:'capitalize' }}>{tierName}</span>
                    <span style={{ fontSize:12, color:'var(--text2)' }}>
                      평균 {formatDuration(stat.avgSec)} · {stat.count}문제
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 최근 활동 */}
          <div className="card">
            <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>최근 활동</div>
            {submissions.length===0
              ? <div style={{ color:'var(--text3)', fontSize:13 }}>제출 기록이 없어요.</div>
              : submissions.slice(0,8).map(s=>(
                <div key={s.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 0', borderBottom:'1px solid var(--border)' }}>
                  <span style={{ flex:1, fontSize:13, fontWeight:500 }}>{s.problemTitle}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:s.result==='correct'?'var(--green)':s.result==='wrong'?'var(--red)':'var(--yellow)' }}>
                    {s.result==='correct'?'✓ 정답':s.result==='wrong'?'✗ 오답':'시간초과'}
                  </span>
                  <span style={{ fontSize:11, color:'var(--text3)' }}>{s.date}</span>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          탭 4: 스트릭 (잔디)
      ══════════════════════════════════════ */}
      {mainTab==='streak' && (
        <div className="fade-up" style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div>
                <div style={{ fontSize:22, fontWeight:800 }}>현재 {user?.streak||0}일</div>
                <div style={{ fontSize:13, color:'var(--text3)', marginTop:2 }}>연속 풀이 스트릭</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:13, color:'var(--text3)' }}>52주 활동일</div>
                <div style={{ fontSize:20, fontWeight:800, fontFamily:'Space Mono,monospace' }}>{activeHeatmapDays}일</div>
              </div>
            </div>
            <YearHeatmap cells={heatmapCells} />
            <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:12, fontSize:11, color:'var(--text3)' }}>
              <span>적음</span>
              {[0,1,2,3,4].map(l=>(
                <div key={l} className={`gcell lv${l}`} style={{ width:12, height:12, borderRadius:3, flexShrink:0 }}/>
              ))}
              <span>많음</span>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          탭 5: 설정 (아바타 · 보상 · 구독 · 비밀번호)
      ══════════════════════════════════════ */}
      {mainTab==='settings' && (
        <div className="fade-up profile-settings-layout">

          {/* 프로필 정보 */}
          <div className="card">
            <div className="pp-title">🧑 프로필 정보</div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div className="form-group">
                <label>표시 이름</label>
                <input className="settings-input" value={displayName} onChange={e => setDisplayName(e.target.value)}
                  placeholder={user?.username || '표시 이름'} style={{ maxWidth:360 }} />
              </div>
              <div className="form-group">
                <label>자기소개</label>
                <textarea className="settings-input" value={bio} onChange={e => setBio(e.target.value)}
                  placeholder="자기소개를 입력하세요" rows={3}
                  style={{ resize:'vertical', fontFamily:'inherit', lineHeight:1.6, maxWidth:480 }} />
              </div>
              <div className="form-group">
                <label>소셜 링크</label>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {Object.entries(PROFILE_LINK_LABELS).map(([key, label]) => (
                    <div key={key} style={{ display:'flex', alignItems:'center', gap:8, maxWidth:480 }}>
                      <span style={{ width:90, fontSize:13, color:'var(--text2)', flexShrink:0 }}>{label}</span>
                      <input className="settings-input" style={{ flex:1 }}
                        value={socialLinks[key] || ''} onChange={e => setSocialLinks(p => ({ ...p, [key]: e.target.value }))}
                        placeholder={`${label} URL`} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>기술 스택</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, maxWidth:560 }}>
                  {TECH_OPTIONS.map(tech => (
                    <button key={tech} onClick={() => setTechStack(prev => prev.includes(tech) ? prev.filter(x => x !== tech) : prev.length < 20 ? [...prev, tech] : prev)}
                      style={{
                        display:'flex', alignItems:'center', gap:4,
                        padding:'4px 10px', borderRadius:20, fontSize:12, cursor:'pointer', border:'1px solid var(--border)',
                        background: techStack.includes(tech) ? 'var(--accent)' : 'var(--bg3)',
                        color: techStack.includes(tech) ? '#fff' : 'var(--text2)',
                      }}>
                      {TECH_LOGO_MAP[tech] && <img src={TECH_LOGO_MAP[tech]} width={13} height={13} alt="" style={{ objectFit:'contain', flexShrink:0 }} />}
                      {tech}
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleSaveProfileInfo} disabled={profileInfoSaving} style={{ alignSelf:'flex-start', padding:'10px 24px' }}>
                {profileInfoSaving ? <span className="spinner"/> : '프로필 저장'}
              </button>
            </div>
          </div>

          <div className="card" style={{ width:'100%' }}>
            <div className="pp-title">⚙️ 제출 & 기본 언어 설정</div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div className="form-group">
                <label>기본 제출 언어</label>
                <select value={defaultLanguage} onChange={(e) => setDefaultLanguage(e.target.value)}>
                  {JUDGE_LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ padding:'12px 14px', border:'1px solid var(--border)', borderRadius:10, background:'var(--bg3)' }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:6 }}>제출 기록 공개</div>
                <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.6, marginBottom:10 }}>
                  켜면 다른 사용자가 제출 목록에서 내 제출 기록을 볼 수 있습니다. 코드는 항상 본인만 열람할 수 있습니다.
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSubmissionsPublic(true)} style={{
                    background: submissionsPublic ? 'var(--blue)' : 'var(--bg2)',
                    color: submissionsPublic ? '#fff' : 'var(--text2)',
                  }}>전체 공개</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSubmissionsPublic(false)} style={{
                    background: !submissionsPublic ? 'var(--orange)' : 'var(--bg2)',
                    color: !submissionsPublic ? '#fff' : 'var(--text2)',
                  }}>내꺼만 보기</button>
                </div>
              </div>

              <button className="btn btn-primary" onClick={handleSavePreferences} disabled={prefsSaving} style={{ alignSelf:'flex-start', padding:'10px 24px' }}>
                {prefsSaving ? <span className="spinner"/> : '설정 저장'}
              </button>
            </div>
          </div>

          {/* 아바타 꾸미기 */}
          <div className="card">
            <div className="pp-title">🎨 아바타 꾸미기</div>
            <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
              <div style={{ width:80, height:80, borderRadius:'50%', overflow:'hidden', background:'var(--bg3)', border:'1px solid var(--border)', display:'grid', placeItems:'center', fontSize:36 }}>
                {avatarUrlCustom
                  ? <img src={avatarUrlCustom} alt="avatar" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : (avatarEmoji || user?.username?.slice(0,2).toUpperCase())}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <label className="btn btn-ghost btn-sm" style={{ cursor:'pointer' }}>
                  📷 이미지 업로드
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display:'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (file.size > 2 * 1024 * 1024) { toast?.show('2MB 이하 이미지만 가능합니다', 'error'); return }
                      const formData = new FormData()
                      formData.append('avatar', file)
                      try {
                        const { data } = await api.post('/auth/profile/avatar', formData, {
                          headers: { 'Content-Type': 'multipart/form-data' },
                        })
                        setAvatarUrlCustom(data.avatarUrl)
                        toast?.show('아바타가 업로드되었습니다.', 'success')
                      } catch (err) {
                        toast?.show(err.response?.data?.message || '아바타 업로드 실패', 'error')
                      }
                    }}
                  />
                </label>
              </div>
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:13, color:'var(--text3)', fontWeight:600, marginBottom:10 }}>🖼️ 프로필 배경</div>
              <div className="profile-background-grid">
                <div className="profile-background-option">
                  <button
                    onClick={async () => {
                      try {
                        await api.patch('/auth/profile/background', { backgroundSlug: null })
                        setEquippedBackground(null)
                        toast?.show('배경이 초기화되었습니다.', 'success')
                      } catch (err) {
                        toast?.show(err.response?.data?.message || '배경 초기화 실패', 'error')
                      }
                    }}
                    className="profile-background-preview"
                    style={{
                      border:`2px ${!equippedBackground ? 'solid var(--blue)' : 'dashed var(--border)'}`,
                      background:'var(--bg3)', cursor:'pointer', fontSize:18, color:'var(--text3)',
                    }}
                    title="배경 없음"
                  >✕</button>
                  <div className="profile-background-name">없음</div>
                </div>
                {backgrounds.map((bg) => (
                  <div key={bg.slug} className="profile-background-option">
                    <button
                      onClick={async () => {
                        try {
                          await api.patch('/auth/profile/background', { backgroundSlug: bg.slug })
                          setEquippedBackground(bg.slug)
                          toast?.show('배경이 적용되었습니다.', 'success')
                        } catch (err) {
                          toast?.show(err.response?.data?.message || '배경 적용 실패', 'error')
                        }
                      }}
                      className="profile-background-preview"
                      style={{
                        border:`2px solid ${equippedBackground === bg.slug ? 'var(--blue)' : 'var(--border)'}`,
                        background:bg.image_url?.startsWith('gradient:') ? bg.image_url.replace('gradient:', '') : `url(${bg.image_url}) center/cover`,
                        cursor:'pointer',
                        boxShadow: equippedBackground === bg.slug ? '0 0 0 3px rgba(88,166,255,0.3)' : 'none',
                      }}
                      title={bg.name}
                    />
                    <div className="profile-background-name">{bg.name}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:8 }}>색상</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {['#cd7f32','#c0c0c0','#ffd700','#00e5cc','#b9f2ff','#79c0ff','#56d364','#f78166','#bc8cff','#e3b341','#ff7b72','#ffffff'].map(c=>(
                  <button key={c} onClick={async()=>{
                    setAvatarColor(c);
                    try {
                      await api.patch('/auth/me',{avatar_color:c});
                    } catch {
                      toast?.show('아바타 색상 저장 실패', 'error');
                    }
                  }} style={{
                    width:28, height:28, borderRadius:'50%', background:c,
                    border: avatarColor===c ? '3px solid var(--text)' : '2px solid var(--border)',
                    cursor:'pointer', transition:'transform .15s',
                  }} onMouseEnter={e=>e.currentTarget.style.transform='scale(1.2)'} onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}/>
                ))}
                <button onClick={async()=>{
                  setAvatarColor(null);
                  try {
                    await api.patch('/auth/me',{avatar_color:null});
                  } catch {
                    toast?.show('아바타 색상 초기화 실패', 'error');
                  }
                }} style={{
                  width:28, height:28, borderRadius:'50%', border:'2px dashed var(--border)', background:'transparent',
                  cursor:'pointer', fontSize:10, color:'var(--text3)',
                }} title="초기화">✕</button>
              </div>
            </div>
            <div>
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:8 }}>이모지</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {['🦊','🐼','🦁','🐯','🐸','🦄','🐉','🦋','🐙','🦀','🐬','⭐','🔥','💎','🎯','🚀'].map(e=>(
                  <button key={e} onClick={async()=>{
                    setAvatarEmoji(e);
                    try {
                      await api.patch('/auth/me',{avatar_emoji:e});
                    } catch {
                      toast?.show('아바타 이모지 저장 실패', 'error');
                    }
                  }} style={{
                    width:36, height:36, borderRadius:8, fontSize:18,
                    border: avatarEmoji===e ? '2px solid var(--text)' : '1px solid var(--border)',
                    background: avatarEmoji===e ? 'var(--bg3)' : 'transparent', cursor:'pointer',
                  }}>{e}</button>
                ))}
                <button onClick={async()=>{
                  setAvatarEmoji(null);
                  try {
                    await api.patch('/auth/me',{avatar_emoji:null});
                  } catch {
                    toast?.show('아바타 이모지 초기화 실패', 'error');
                  }
                }} style={{
                  width:36, height:36, borderRadius:8, border:'1px dashed var(--border)',
                  background:'transparent', cursor:'pointer', fontSize:11, color:'var(--text3)',
                }} title="초기화">✕</button>
              </div>
            </div>
          </div>

          {/* 보상 */}
          {rewards.length > 0 && (
            <div className="card">
              <div className="pp-title">🎁 보상 & 장착</div>
              {/* 현재 장착 */}
              <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
                {[{type:'badge',current:equippedBadge,label:'장착 뱃지'},{type:'title',current:equippedTitle,label:'장착 칭호'}].map(item=>(
                  <div key={item.type} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'var(--bg3)', borderRadius:10, flex:1, minWidth:180 }}>
                    <span style={{ fontSize:20 }}>{item.current ? rewards.find(r=>r.code===item.current)?.icon : (item.type==='badge'?'⬜':'📛')}</span>
                    <div>
                      <div style={{ fontSize:11, color:'var(--text3)', marginBottom:2 }}>{item.label}</div>
                      <div style={{ fontSize:13, fontWeight:600 }}>{item.current ? rewards.find(r=>r.code===item.current)?.name : '없음'}</div>
                    </div>
                    {item.current && (
                      <button className="btn btn-ghost btn-sm" style={{ marginLeft:'auto', fontSize:11 }} onClick={()=>handleEquip(item.type,item.current)}>해제</button>
                    )}
                  </div>
                ))}
              </div>

              {/* 뱃지 그리드 */}
              {rewards.filter(r=>r.type==='badge').length>0 && (
                <>
                  <div className="profile-rewards-subtitle">보유 뱃지</div>
                  <div className="profile-rewards-grid">
                    {rewards.filter(r=>r.type==='badge').map(r=>{
                      const isEquipped=equippedBadge===r.code;
                      return (
                        <div key={r.code} onClick={()=>handleEquip('badge',r.code)} className={`profile-reward-item ${isEquipped ? 'equipped' : ''}`}>
                          <div className="reward-icon">{r.icon}</div>
                          <div className="reward-name">{r.name}</div>
                          {isEquipped && <div className="reward-equipped-tag">✓ 장착 중</div>}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* 칭호 리스트 */}
              {rewards.filter(r=>r.type==='title').length>0 && (
                <>
                  <div className="profile-rewards-subtitle">보유 칭호</div>
                  <div className="profile-rewards-list">
                    {rewards.filter(r=>r.type==='title').map(r=>{
                      const isEquipped=equippedTitle===r.code;
                      return (
                        <div key={r.code} onClick={()=>handleEquip('title',r.code)} className={`profile-title-item ${isEquipped ? 'equipped' : ''}`}>
                          <span className="title-icon">{r.icon}</span>
                          <div className="title-info">
                            <div className="title-name">{r.name}</div>
                            <div className="title-desc">{r.description}</div>
                          </div>
                          {isEquipped && <div className="title-equipped-tag">✓ 장착 중</div>}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 구독 */}
          <div className="card">
            <div className="pp-title">💳 구독 관리</div>
            {paymentFeedback && (
              <div style={{
                marginBottom: 16,
                padding: '14px 16px',
                borderRadius: 14,
                background: paymentFeedback.tone === 'success' ? 'rgba(63,185,80,.12)' : 'rgba(121,192,255,.12)',
                border: paymentFeedback.tone === 'success' ? '1px solid rgba(63,185,80,.25)' : '1px solid rgba(121,192,255,.25)',
              }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>{paymentFeedback.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{paymentFeedback.body}</div>
              </div>
            )}
            <div className={`profile-sub-current-panel tier-${subPlan?.tier || 'free'}`}>
              <div className="sub-label">현재 플랜</div>
              <div className="sub-value">
                {formatCurrentSubscriptionLabel(subPlan?.tier)}
              </div>
              {subPlan?.expires && (
                <div className="sub-expiry">만료일: {new Date(subPlan.expires).toLocaleDateString('ko-KR')}</div>
              )}
              <div className="sub-note">
                {subPlan?.tier && subPlan.tier !== 'free'
                  ? '현재 유료 플랜이 활성화되어 있습니다. 필요하면 아래에서 해지 예약이나 플랜 비교를 진행할 수 있습니다.'
                  : '무료 플랜으로 이용 중입니다. AI 사용량과 프리미엄 기능이 더 필요하면 업그레이드하세요.'}
              </div>
            </div>

            {(!subPlan || subPlan.tier==='free') && (
              <div className="profile-plans-grid">
                {upgradePlans.map(plan=>(
                  <div key={plan.id} className="profile-plan-card" style={{ border:`1px solid ${plan.color}30`, background:`${plan.color}06` }}>
                    <div className="plan-header">
                      <div className="plan-name" style={{ color:plan.color }}>{plan.name}</div>
                      <div className="plan-price">{plan.price}</div>
                    </div>
                    <div className="plan-features">
                      {plan.features.map(f=>(
                        <div key={f} className="plan-feature">
                          <span className="feature-check">✓</span>{f}
                        </div>
                      ))}
                    </div>
                    <button onClick={() => handleUpgrade(plan.id)} disabled={loadingPlan === plan.id} className="btn-plan-upgrade" style={{
                      background:`${plan.color}20`, color:plan.color,
                      opacity: loadingPlan && loadingPlan !== plan.id ? 0.5 : 1,
                    }}>{loadingPlan === plan.id ? '처리 중...' : '업그레이드 →'}</button>
                  </div>
                ))}
              </div>
            )}
            {subPlan?.tier && subPlan.tier!=='free' && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:10, alignItems:'center' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/pricing')}>
                  💳 플랜 비교
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleCancelSubscription}
                  disabled={cancelLoading}
                  style={{ color:'var(--red)', borderColor:'rgba(248,81,73,.25)' }}
                >
                  {cancelLoading ? '처리 중...' : '구독 해지 예약'}
                </button>
                <a href="mailto:choijunhuk2007@gmail.com" style={{ color:'var(--blue)', fontSize:13 }}>
                  choijunhuk2007@gmail.com
                </a>
              </div>
            )}
            {cancelMsg && (
              <div style={{ marginTop:12, fontSize:12, fontWeight:600, color:cancelMsg.includes('실패') ? 'var(--red)' : 'var(--green)' }}>
                {cancelMsg}
              </div>
            )}
          </div>

          {/* 비밀번호 변경 */}
          <div className="card" style={{ maxWidth:480 }}>
            <div className="pp-title">🔒 비밀번호 변경</div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div className="form-group"><label>현재 비밀번호</label><input type="password" value={pwCurrent} onChange={e=>setPwCurrent(e.target.value)} placeholder="현재 비밀번호"/></div>
              <div className="form-group"><label>새 비밀번호</label><input type="password" value={pwNext} onChange={e=>setPwNext(e.target.value)} placeholder="새 비밀번호 (8자 이상)"/></div>
              <div className="form-group"><label>새 비밀번호 확인</label><input type="password" value={pwConfirm} onChange={e=>setPwConfirm(e.target.value)} placeholder="새 비밀번호 재입력"/></div>
              {pwMsg && <div style={{ fontSize:13, color:pwMsg.startsWith('✅')?'var(--green)':'var(--red)', fontWeight:600 }}>{pwMsg}</div>}
              <button className="btn btn-primary" onClick={handlePwChange} disabled={pwLoading||!pwCurrent||!pwNext||!pwConfirm} style={{ alignSelf:'flex-start', padding:'10px 24px' }}>
                {pwLoading ? <span className="spinner"/> : '비밀번호 변경'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
