import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { PROBLEMS as DEFAULT_PROBLEMS, TIERS, TIER_COLORS } from '../data/problems';
import api from '../api.js';
import { getPushStatus, subscribePush, unsubscribePush } from '../utils/pushSubscribe.js';
import { useToast } from '../context/ToastContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus.js';
import { useSubscriptionCheckout } from '../hooks/useSubscriptionCheckout.js';
import { JUDGE_LANGUAGE_OPTIONS } from '../data/judgeLanguages.js';
import { TIER_POINTS, TIER_ORDER } from '../data/constants.js';
import ProfileAvatar from '../components/ProfileAvatar.jsx';
import FollowListModal from '../components/FollowListModal.jsx';
import { buildYearHeatmap, formatDuration, profileBackgroundToCss, PROFILE_TIER_LABELS, PROFILE_TIER_THRESHOLDS } from './profilePageUtils.js';
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
  AWS:'/tech/aws.webp', GCP:'/tech/gcp.png', Azure:'/tech/azure.svg', Git:'/tech/git.png',
};


const DEFAULT_PROFILE_BACKGROUND_SLUG = 'solid-slate';
const DEFAULT_PROFILE_BACKGROUND_CSS = '#2d4057';
const LEGACY_PROFILE_BACKGROUND_SLUGS = new Set(['gradient-midnight', 'solid-ink', 'solid-dark']);

function normalizeProfileBackgroundSlug(slug) {
  if (!slug) return DEFAULT_PROFILE_BACKGROUND_SLUG;
  return LEGACY_PROFILE_BACKGROUND_SLUGS.has(slug) ? DEFAULT_PROFILE_BACKGROUND_SLUG : slug;
}

const SOCIAL_ICON_META = {
  github:    { label:'GitHub',    color:'var(--text2)', icon:<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg> },
  instagram: { label:'Instagram', color:'#e1306c',      icon:<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg> },
  x:         { label:'X',         color:'var(--text2)', icon:<img src="/social/x.webp"       width="14" height="14" alt="X"        style={{ objectFit:'contain' }} /> },
  twitter:   { label:'X',         color:'var(--text2)', icon:<img src="/social/x.webp"       width="14" height="14" alt="X"        style={{ objectFit:'contain' }} /> },
  linkedin:  { label:'LinkedIn',  color:'#0077b5',      icon:<img src="/social/linkedin.png" width="14" height="14" alt="LinkedIn" style={{ objectFit:'contain' }} /> },
  velog:     { label:'Velog',     color:'#20c997',      icon:<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="12" fill="#20c997"/><text x="12" y="16" textAnchor="middle" fill="white" fontSize="12" fontWeight="900" fontFamily="sans-serif">V</text></svg> },
  tistory:   { label:'Tistory',   color:'#ff5a00',      icon:<img src="/social/tistory.png"  width="14" height="14" alt="Tistory" style={{ objectFit:'contain' }} /> },
};

const countFilledProfileLinks = (links = {}) => Object.values(links || {}).filter(Boolean).length;

export default function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, updateUser, applyUser } = useAuth();
  const toast = useToast();
  const { lang } = useLang();
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
  const [avatarSource, setAvatarSource] = useState(user?.avatarSource || user?.avatar_source || 'site');
  const [backgrounds, setBackgrounds] = useState([]);
  const [pushStatus, setPushStatus] = useState({ subscribed: false, configured: false });
  const [equippedBackground, setEquippedBackground] = useState(normalizeProfileBackgroundSlug(user?.equippedBackground));
  const [rewards,       setRewards]       = useState([]);
  const [equippedBadge, setEquippedBadge] = useState(user?.equippedBadge || null);
  const [equippedTitle, setEquippedTitle] = useState(user?.equippedTitle || null);
  const [progression, setProgression] = useState(null);
  const [followStats,   setFollowStats]   = useState({ followers:0, following:0 });
  const [followModalType, setFollowModalType] = useState(null);
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
  const [yearCorrectSubs, setYearCorrectSubs] = useState([]);
  const [yearSubsLoaded, setYearSubsLoaded] = useState(false);
  const [solveStats, setSolveStats] = useState({
    avgSolveTime: null,
    fastestSolve: null,
    totalSolveTime: 0,
    solveTimeByTier: {},
  });
  const [learningActivity, setLearningActivity] = useState(null);
  const [weaknessStats, setWeaknessStats] = useState([]);
  const loadErrorToastShownRef = useRef(false);

  useEffect(() => {
    setDefaultLanguage(user?.defaultLanguage || 'python');
    setSubmissionsPublic(user?.submissionsPublic ?? true);
    setDisplayName(user?.displayName || '');
    setSocialLinks(user?.socialLinks || {});
    setTechStack(user?.techStack || []);
  }, [user?.id]);

  const showLoadErrorToast = (message = 'Failed to load profile data.') => {
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
      if (err?.response?.status !== 401) showLoadErrorToast(err?.response?.data?.message || 'Failed to load reward info.');
    });
    api.get('/auth/top100').then(r => setTop100(r.data || [])).catch((err) => {
      if (err?.response?.status !== 401) showLoadErrorToast(err?.response?.data?.message || 'Failed to load ranking stats.');
    });
    if (user?.id) {
      api.get(`/follows/${user.id}/stats`).then(r => setFollowStats(r.data)).catch((err) => {
        if (err?.response?.status !== 401) showLoadErrorToast(err?.response?.data?.message || 'Failed to load follow stats.');
      });
      api.get('/auth/me/stats').then(r => setSolveStats(r.data)).catch((err) => {
        if (err?.response?.status !== 401) showLoadErrorToast(err?.response?.data?.message || 'Failed to load solve stats.');
      });
      api.get('/submissions/stats').then(r => setWeaknessStats(r.data?.weaknessStats || [])).catch(() => {
        setWeaknessStats([]);
      });
      api.get(`/auth/profile/${user.id}`).then(r => setLearningActivity(r.data?.learningActivity || null)).catch(() => {
        setLearningActivity(null);
      });
    }
    const params = new URLSearchParams(location.search);
    if (params.get('payment') === 'success') {
      invalidateSubscriptionStatus();
      refreshSubscriptionStatus().then(() => {
        setPaymentFeedback(buildPaymentFeedback('success', lang));
        toast?.show('🎉 Subscription complete! Your plan has been activated.', 'success', 5000);
        navigate('/profile', { replace: true });
      });
    } else if (params.get('payment') === 'cancelled') {
      setPaymentFeedback(buildPaymentFeedback('cancelled', lang));
      toast?.show('Payment was cancelled.', 'info');
      navigate('/profile', { replace: true });
    }
  }, [user?.id, location.search, invalidateSubscriptionStatus, navigate, refreshSubscriptionStatus, toast]);

  useEffect(() => {
    setAvatarUrlCustom(user?.avatarUrlCustom || null);
    setAvatarColor(user?.avatarColor || null);
    setAvatarEmoji(user?.avatarEmoji || null);
    setAvatarSource(user?.avatarSource || user?.avatar_source || 'site');
    setEquippedBackground(normalizeProfileBackgroundSlug(user?.equippedBackground));
  }, [user?.avatarUrlCustom, user?.avatarColor, user?.avatarEmoji, user?.avatarSource, user?.avatar_source, user?.equippedBackground]);

  useEffect(() => {
    if (!user?.id) return;
    getPushStatus().then(setPushStatus).catch(() => setPushStatus({ subscribed: false, configured: false }));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    api.get(`/auth/grass/${user.id}`).then((res) => {
      setFullGrass(Array.isArray(res.data) ? res.data : []);
    }).catch(() => {
      setFullGrass([]);
    });
    api.get('/submissions?result=correct&limit=500').then((res) => {
      setYearCorrectSubs(Array.isArray(res.data) ? res.data : []);
    }).catch(() => {
      setYearCorrectSubs([]);
    }).finally(() => {
      setYearSubsLoaded(true);
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
  const solvedByTier = useMemo(() => {
    const groups = Object.entries(TIERS).map(([tier, meta]) => ({
      tier,
      label: meta.label,
      color: meta.color,
      problems: solvedProblems.filter((problem) => problem.tier === tier),
    }));
    const extras = solvedProblems.filter((problem) => !TIERS[problem.tier]);
    if (extras.length > 0) {
      groups.push({ tier: 'unranked', label: '기타', color: 'var(--text3)', problems: extras });
    }
    return groups.filter((group) => group.problems.length > 0);
  }, [solvedProblems]);

  const top100RatingSum = top100.reduce((s, p) => s + (TIER_POINTS[p.tier] || 20), 0);

  const tc       = TIER_COLORS[user?.tier] || '#888';
  const visibleBackgrounds = backgrounds.filter((item) => !LEGACY_PROFILE_BACKGROUND_SLUGS.has(item.slug));
  const equippedBgMeta = visibleBackgrounds.find((item) => item.slug === equippedBackground);
  const profileBannerBackground = profileBackgroundToCss(equippedBgMeta?.image_url) || DEFAULT_PROFILE_BACKGROUND_CSS;
  const tierIdx  = TIER_ORDER.indexOf(user?.tier || 'unranked');
  const nextTier = TIER_ORDER[tierIdx + 1];
  const curThres = PROFILE_TIER_THRESHOLDS[user?.tier || 'unranked'] || 0;
  const nextThres = nextTier ? PROFILE_TIER_THRESHOLDS[nextTier] : null;
  const ratingProgress = nextThres
    ? Math.min(Math.max(((user?.rating || 0) - curThres) / (nextThres - curThres) * 100, 0), 100)
    : 100;
  const nextProgressReward = progression?.nextReward
    ? progression.nextReward.kind === 'background'
      ? `Lv.${progression.nextReward.level} Profile Background`
      : `Lv.${progression.nextReward.level} Reward`
    : 'All growth rewards unlocked';
  const rewardByCode = new Map(rewards.map((reward) => [reward.code, reward]));
  const equippedBadgeMeta = equippedBadge ? rewardByCode.get(equippedBadge) : null;
  const equippedTitleMeta = equippedTitle ? rewardByCode.get(equippedTitle) : null;
  const isSettingsTab = mainTab === 'settings';
  const savedSocialLinks = user?.socialLinks || {};
  const providerAvatarUrl = user?.avatarUrl || user?.avatar_url || null;
  const hasCustomAvatarProfile = Boolean(avatarUrlCustom || avatarEmoji || avatarColor);
  const savedTechStack = user?.techStack || [];
  const headerDisplayName = isSettingsTab
    ? (displayName || user?.displayName || user?.username)
    : (user?.displayName || user?.username);
  const headerBio = isSettingsTab ? bio : user?.bio;
  const headerTechStack = isSettingsTab ? techStack : savedTechStack;
  const headerSocialLinks = isSettingsTab ? socialLinks : savedSocialLinks;
  const profileDraftChanged = isSettingsTab && (
    (displayName || '') !== (user?.displayName || '') ||
    (bio || '') !== (user?.bio || '') ||
    JSON.stringify(socialLinks || {}) !== JSON.stringify(savedSocialLinks || {}) ||
    JSON.stringify(techStack || []) !== JSON.stringify(savedTechStack || [])
  );
  const profileCompletenessItems = [
    { label:'소개', done:Boolean((bio || '').trim()) },
    { label:'아바타', done:Boolean(hasCustomAvatarProfile || providerAvatarUrl) },
    { label:'배경', done:Boolean(equippedBackground) },
    { label:'기술', done:techStack.length > 0 },
    { label:'링크', done:countFilledProfileLinks(socialLinks) > 0 },
    { label:'보상', done:Boolean(equippedBadge || equippedTitle) },
  ];
  const profileCompleteness = Math.round(
    profileCompletenessItems.filter((item) => item.done).length / profileCompletenessItems.length * 100
  );

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
  const [heatmapHover, setHeatmapHover] = useState(null);

  const solvedByDate = useMemo(() => {
    const map = {};
    const allCorrect = yearCorrectSubs.length > 0 ? yearCorrectSubs : submissions.filter(s => s.result === 'correct');
    allCorrect.forEach(s => {
      const rawDate = s.submitted_at || s.date || s.createdAt || '';
      const date = String(rawDate).slice(0, 10);
      if (!date || date.length < 10) return;
      if (!map[date]) map[date] = [];
      const pid = s.problem_id || s.problemId;
      const title = s.problem_title || s.problemTitle || `#${pid}`;
      if (pid && !map[date].find(p => p.id === pid)) {
        map[date].push({ id: pid, title });
      }
    });
    return map;
  }, [yearCorrectSubs, submissions]);
  const upgradePlans = getProfileUpgradePlans(lang);

  const handlePwChange = async () => {
    if (pwNext !== pwConfirm) { setPwMsg('New passwords do not match.'); return; }
    if (pwNext.length < 8)    { setPwMsg('Password must be at least 8 characters.'); return; }
    setPwLoading(true);
    try {
      await api.patch('/auth/password', { current: pwCurrent, next: pwNext });
      setPwMsg('✅ Password changed successfully!');
      toast?.show('🔒 Password changed.', 'success');
      setPwCurrent(''); setPwNext(''); setPwConfirm('');
    } catch (err) {
      setPwMsg('❌ ' + (err.response?.data?.message || 'Failed to change password'));
    }
    setPwLoading(false);
  };

  const handleUpgrade = async (planId) => {
    const result = await startCheckout(planId);
    if (!result.ok) {
      toast?.show(result.reason || 'Failed to create payment session', 'error');
    }
  };

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    setCancelMsg('');
    try {
      const { data } = await api.post('/subscription/cancel');
      await refreshSubscriptionStatus();
      setCancelMsg(data?.message || 'Cancellation scheduled successfully.');
      toast?.show(data?.message || 'Cancellation scheduled successfully.', 'success');
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to schedule cancellation.';
      setCancelMsg(message);
      toast?.show(message, 'error');
    }
    setCancelLoading(false);
  };

  const handleEquip = async (type, code) => {
    const current = type === 'badge' ? equippedBadge : equippedTitle;
    const newCode = current === code ? null : code;
    try {
      const { data } = await api.post('/rewards/equip', { type, code: newCode });
      if (type === 'badge') setEquippedBadge(newCode);
      else setEquippedTitle(newCode);
      applyUser(data?.user);
      toast?.show(newCode ? '✅ Equipped' : 'Unequipped', 'success');
    } catch (err) {
      toast?.show('❌ ' + (err.response?.data?.message || 'Failed'), 'error');
    }
  };

  const handleAvatarSourceChange = async (source) => {
    if (source === 'provider' && !providerAvatarUrl) {
      toast?.show('No linked provider profile image found.', 'info');
      return;
    }
    try {
      const updated = await updateUser({ avatar_source: source });
      setAvatarSource(updated?.avatarSource || updated?.avatar_source || source);
      toast?.show(source === 'provider' ? 'Using original profile photo.' : 'Using DailyCoding profile.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || 'Failed to save profile photo selection', 'error');
    }
  };

  const handleSavePreferences = async () => {
    setPrefsSaving(true);
    try {
      await updateUser({
        default_language: defaultLanguage,
        submissions_public: submissionsPublic,
      });
      toast?.show('✅ Submission/language settings saved.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || 'Failed to save settings', 'error');
    }
    setPrefsSaving(false);
  };

  const handleSaveProfileInfo = async () => {
    setProfileInfoSaving(true);
    try {
      const filteredLinks = Object.fromEntries(Object.entries(socialLinks).filter(([, v]) => v));
      const { data } = await api.patch('/auth/profile/extended', {
        display_name: displayName,
        bio,
        social_links: filteredLinks,
        tech_stack: techStack,
      });
      applyUser(data);
      toast?.show('✅ Profile info saved.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || 'Failed to save', 'error');
    }
    setProfileInfoSaving(false);
  };

  const TABS = [
    ['solved',   '풀이'],
    ['top100',   'Top 100'],
    ['stats',    '통계'],
    ['streak',   '스트릭'],
    ['settings', '설정'],
  ];

  return (
    <div className="profile-page">

      {/* ── 배너 헤더 ── */}
      <div className={`profile-header-card ${isSettingsTab ? 'settings-active' : ''}`}>
        {/* 배너 배경 */}
        <div className="profile-header-banner" style={{ background: profileBannerBackground }}/>

        {/* 프로필 콘텐츠 */}
        <div className="profile-header-content">
          <div className="profile-header-mode-row">
            <span className={`profile-mode-pill ${isSettingsTab ? 'editing' : ''}`}>
              {isSettingsTab ? '편집 미리보기' : '공개 프로필'}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setMainTab(isSettingsTab ? 'solved' : 'settings')}
            >
              {isSettingsTab ? '프로필 보기' : '프로필 설정'}
            </button>
          </div>

          {/* 아바타 */}
          <ProfileAvatar
            profile={{ ...user, avatarUrlCustom, avatarColor, avatarEmoji, avatarSource }}
            className="profile-header-avatar"
            border={`3px solid ${tc}`}
            style={{ boxShadow: `0 0 0 4px var(--bg2), 0 6px 28px ${tc}55` }}
          />

          {/* 정보 */}
          <div className="profile-header-info">
            <div className="profile-header-name-row">
              {equippedBadge && (
                <span className="profile-equipped-badge" title={equippedBadgeMeta?.name}>
                  {equippedBadgeMeta?.icon}
                </span>
              )}
              <span className="profile-username">{headerDisplayName}</span>
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
                  {equippedTitleMeta?.icon} {equippedTitleMeta?.name}
                </span>
              )}
              {profileDraftChanged && <span className="profile-unsaved-pill">Unsaved</span>}
            </div>
            {headerBio && <div className="profile-bio">{headerBio}</div>}
            <div className="profile-meta-info">@{user?.username} · Joined {user?.joinDate} · {user?.email}</div>
            {headerTechStack.length > 0 && (
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
                {headerTechStack.slice(0, 10).map(tech => (
                  <span key={tech} className="badge" style={{ display:'flex', alignItems:'center', gap:4, fontSize:11 }}>
                    {TECH_LOGO_MAP[tech] && <img src={TECH_LOGO_MAP[tech]} width={12} height={12} alt="" style={{ objectFit:'contain', flexShrink:0 }}/>}
                    {tech}
                  </span>
                ))}
              </div>
            )}
            {Object.entries(headerSocialLinks).some(([, v]) => v) && (
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:6 }}>
                {Object.entries(headerSocialLinks).filter(([, url]) => url).map(([key, url]) => {
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
                { v: user?.rating||0,         l:'레이팅',   c:tc,              mono:true },
                { v: solvedProblemsMain.length, l:'풀이',    c:'var(--green)'          },
                { v: `🔥${user?.streak||0}`,  l:'스트릭',   c:'var(--yellow)'             },
                { v: `${accuracy}%`,           l:'정확도',   c:'var(--orange)'             },
                { v: followStats.followers,    l:'팔로워',   c:'var(--blue)', action:'followers' },
                { v: followStats.following,    l:'팔로잉',   c:'var(--purple)', action:'following' },
              ].map(s=> s.action ? (
                <button key={s.l} type="button" className="profile-stat-item clickable" onClick={() => setFollowModalType(s.action)}>
                  <div className="profile-stat-value" style={{ color:s.c, fontFamily:s.mono?'Space Mono,monospace':undefined }}>{s.v}</div>
                  <div className="profile-stat-label">{s.l}</div>
                </button>
              ) : (
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
                  <span>{Math.max(0,(nextThres||0)-(user?.rating||0))} pts to {nextTier.toUpperCase()}</span>
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
              <div className="profile-growth-kicker">Growth XP</div>
              <div className="profile-growth-title">Lv.{progression.level} · {progression.xp.toLocaleString()} XP</div>
              <div className="profile-growth-copy">
                Daily mission rewards accumulate as XP only, not ranking points. Only cosmetic rewards like badges, titles, and profile backgrounds are unlocked.
              </div>
            </div>
            <div className="profile-growth-next">
              <span>Next Unlock</span>
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

      <div className="profile-learning-activity card">
        {[
          { label:'Problems Solved', value: learningActivity?.solvedProblems ?? solvedProblemsMain.length, color:'var(--green)' },
          { label:'XP Level', value: `Lv.${learningActivity?.xpLevel ?? 1}`, color:'var(--orange)' },
          { label:'Battle Win Rate', value: `${learningActivity?.battleWinRate ?? 0}%`, color:'var(--red)' },
          { label:'Reviews Approved', value: learningActivity?.reviewAcceptedCount ?? 0, color:'var(--blue)' },
          { label:'Collaboration Score', value: learningActivity?.collaborationScore ?? 0, color:'var(--purple)' },
        ].map((item) => (
          <div key={item.label} className="profile-learning-stat">
            <div style={{ color:item.color }}>{item.value}</div>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

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
            <div className="profile-solved-count-label">{solvedProblemsMain.length} solved (main)</div>
            <DonutChart
              data={Object.entries(TIERS).map(([k,v])=>({ color:v.color, count:tierCounts[k]||0 }))}
              total={solvedProblemsMain.length}
            />
            <div style={{ marginTop: 12, display:'grid', gap:6, width:'100%' }}>
              <div style={{ fontSize: 12, color:'var(--text2)' }}>Fill-in-the-blank: <strong>{practiceTracks.fillBlank?.solvedCount ?? solvedFillBlank.length}</strong> solved · Tier {String(practiceTracks.fillBlank?.tier || 'unranked').toUpperCase()}</div>
              <div style={{ fontSize: 12, color:'var(--text2)' }}>Bug fix: <strong>{practiceTracks.bugFix?.solvedCount ?? solvedBugFix.length}</strong> solved · Tier {String(practiceTracks.bugFix?.tier || 'unranked').toUpperCase()}</div>
            </div>
          </div>

          <div className="card">
            <div className="profile-panel-header">
              난이도 분포
            </div>
            {/* header */}
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
                <div className="profile-panel-subtitle">푼 문제</div>
                <div className="profile-solved-group-list">
                  {solvedByTier.map((group) => (
                    <div key={group.tier} className="profile-solved-group">
                      <div className="profile-solved-group-head">
                        <span style={{ color: group.color }}>{group.label}</span>
                        <strong>{group.problems.length}문제</strong>
                      </div>
                      <div className="profile-solved-list">
                        {group.problems.map(p=>(
                          <button key={p.id} type="button" className="profile-solved-item" onClick={() => navigate(`/problems/${p.id}`)}>
                            <TierBadge tier={p.tier} size={24}/>
                            <span className="profile-solved-title">{p.title}</span>
                            <span className="profile-solved-id">#{p.id}</span>
                          </button>
                        ))}
                      </div>
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
                <div className="profile-top100-label">Difficulty sum of top 100 problems</div>
                <div className="profile-top100-value">
                  +{top100RatingSum}
                </div>
              </div>
              <div className="profile-top100-count">
                <div className="profile-top100-label">Problems counted</div>
                <div className="profile-top100-value-small">
                  {top100.length}<span className="profile-top100-total">/100</span>
                </div>
              </div>
            </div>

            {/* 티어 배지 격자 */}
            <div className="profile-top100-grid">
              {top100.map(p=>(
                <div key={p.id} title={`#${p.id} ${p.title}\n+${TIER_POINTS[p.tier]||20}pts (${p.tier})`} onClick={() => navigate(`/problems/${p.id}`)} style={{ cursor: 'pointer' }}>
                  <TierBadge tier={p.tier} size={34} />
                </div>
              ))}
              {Array.from({ length: Math.max(0, 100-top100.length) }, (_,i)=>(
                <div key={`e${i}`} className="profile-top100-empty-slot"/>
              ))}
            </div>
            <div className="profile-top100-note">
              Click a badge to go to that problem · B=Bronze S=Silver G=Gold P=Platinum D=Diamond
            </div>
          </div>

          {/* 문제 목록 */}
          <div className="card">
            <div className="profile-panel-header">
              Problems in Rating ({top100.length})
            </div>
            {top100.length === 0
              ? <div className="profile-empty-msg">No problems solved yet.</div>
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
          {/* Submission summary cards */}
          <div className="profile-stats-summary">
            {[
              { label:'총 제출',    v:submissions.length,   color:'var(--blue)'   },
              { label:'맞았습니다', v:resultStats.correct,  color:'var(--green)'  },
              { label:'틀렸습니다', v:resultStats.wrong,    color:'var(--red)'    },
              { label:'시간 초과',  v:resultStats.timeout,  color:'var(--yellow)' },
            ].map(s=>(
              <div key={s.label} className="card profile-stat-mini">
                <div className="profile-stat-mini-value" style={{ color:s.color }}>{s.v}</div>
                <div className="profile-stat-mini-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Submissions by language */}
          <div className="card card-pad">
            <div className="section-header-title" style={{ marginBottom:14 }}>언어별 제출</div>
            {topLang.length===0
              ? <div style={{ color:'var(--text3)', fontSize:13 }}>제출 기록이 없습니다.</div>
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
                        <span style={{ fontSize:12, color:'var(--text2)' }}>{cnt}x</span>
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

          {/* Weekly report */}
          <div className="card card-pad">
            <div className="section-header-title" style={{ marginBottom:14 }}>This Week</div>
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
                    {[{v:weekTotal,l:'제출',c:'var(--blue)'},{v:weekCorrect,l:'정답',c:'var(--green)'},{v:`${weekRate}%`,l:'정확도',c:'var(--yellow)'}].map(s=>(
                      <div key={s.l} style={{ textAlign:'center', flex:1 }}>
                        <div style={{ fontSize:22, fontWeight:800, color:s.c, fontFamily:'Space Mono,monospace' }}>{s.v}</div>
                        <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:4, alignItems:'end', height:60 }}>
                    {dailyCounts.map((cnt,i)=>(
                      <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                        <div style={{ width:'100%', height:`${Math.max(4,cnt/maxDaily*50)}px`, background:cnt>0?'var(--blue)':'var(--bg3)', borderRadius:3 }} title={`${dayNames[i]}: ${cnt}`}/>
                        <span style={{ fontSize:9, color:'var(--text3)' }}>{dayNames[i]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="card card-pad">
            <div className="section-header" style={{ marginBottom:12 }}>
              <div className="section-header-title">취약 태그 분석</div>
              <span style={{ fontSize:11, color:'var(--text3)' }}>태그별 오답률 기준</span>
            </div>
            {weaknessStats.length === 0 ? (
              <div className="empty-state" style={{ padding:'24px 0' }}>
                <div className="empty-state-icon">📊</div>
                <div style={{ fontSize:13, color:'var(--text3)', lineHeight:1.7 }}>
                  같은 유형 제출이 2개 이상이면 자동으로 취약 태그가 표시됩니다.
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {weaknessStats.slice(0, 5).map((item) => {
                  const color = item.priority === 'high' ? 'var(--red)' : item.priority === 'medium' ? 'var(--yellow)' : 'var(--blue)';
                  return (
                    <div key={item.label} className="card card-pad-sm" style={{ background:'var(--bg3)' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', gap:10, marginBottom:6 }}>
                        <span style={{ fontSize:13, fontWeight:800, color }}>{item.label}</span>
                        <span style={{ fontSize:12, color:'var(--text2)' }}>
                          Error rate {item.missRate}% · {item.attempts} attempts
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

          <div className="card card-pad">
            <div className="section-header-title" style={{ marginBottom:12 }}>풀이 시간 통계</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:10, marginBottom:14 }}>
              {[
                { label:'평균 풀이 시간', value: formatDuration(solveStats.avgSolveTime) },
                { label:'총 풀이 시간', value: formatDuration(solveStats.totalSolveTime) },
                { label:'최단 풀이', value: solveStats.fastestSolve ? `${solveStats.fastestSolve.problemTitle} · ${formatDuration(solveStats.fastestSolve.timeSec)}` : '기록 없음' },
              ].map((item) => (
                <div key={item.label} className="card card-pad-sm">
                  <div style={{ fontSize:11, color:'var(--text3)', marginBottom:6 }}>{item.label}</div>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{item.value}</div>
                </div>
              ))}
            </div>
            {Object.keys(solveStats.solveTimeByTier || {}).length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {Object.entries(solveStats.solveTimeByTier).map(([tierName, stat]) => (
                  <div key={tierName} className="list-item-hover" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', border:'1px solid var(--border)', borderRadius:10 }}>
                    <span style={{ fontSize:12, fontWeight:700, textTransform:'capitalize' }}>{tierName}</span>
                    <span style={{ fontSize:12, color:'var(--text2)' }}>
                      평균 {formatDuration(stat.avgSec)} · {stat.count}문제
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="card card-pad">
            <div className="section-header-title" style={{ marginBottom:12 }}>최근 활동</div>
            {submissions.length===0
              ? <div className="empty-state" style={{ padding:'24px 0' }}>
                  <div className="empty-state-icon">📋</div>
                  <div style={{ fontSize:13, color:'var(--text3)' }}>제출 기록이 없습니다.</div>
                </div>
              : submissions.slice(0,8).map(s=>(
                <div key={s.id} className="list-item-hover" onClick={() => navigate(`/problems/${s.problem_id || s.problemId}`)} style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 0', borderBottom:'1px solid var(--border)', cursor:'pointer' }}>
                  <span style={{ flex:1, fontSize:13, fontWeight:500 }}>{s.problem_title || s.problemTitle}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:s.result==='correct'?'var(--green)':s.result==='wrong'?'var(--red)':'var(--yellow)' }}>
                    {s.result==='correct'?'✓ 정답':s.result==='wrong'?'✗ 오답':'시간 초과'}
                  </span>
                  <span style={{ fontSize:11, color:'var(--text3)' }}>{(s.submitted_at || s.date || '').slice(0,10)}</span>
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
          <div className="card card-pad" style={{ position:'relative' }}>
            <div className="section-header" style={{ marginBottom:16 }}>
              <div>
                <div style={{ fontSize:22, fontWeight:800 }}>{user?.streak||0}일</div>
                <div style={{ fontSize:13, color:'var(--text3)', marginTop:2 }}>현재 스트릭</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:13, color:'var(--text3)' }}>활성 일수 (52주)</div>
                <div style={{ fontSize:20, fontWeight:800, fontFamily:'Space Mono,monospace' }}>{activeHeatmapDays}일</div>
              </div>
            </div>
            <YearHeatmap cells={heatmapCells} onCellHover={(cell) => setHeatmapHover(cell)} />
            <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:12, fontSize:11, color:'var(--text3)' }}>
              <span>없음</span>
              {[0,1,2,3,4].map(l=>(
                <div key={l} className={`gcell lv${l}`} style={{ width:12, height:12, borderRadius:3, flexShrink:0 }}/>
              ))}
              <span>많음</span>
            </div>
          </div>
          {heatmapHover && heatmapHover.level > 0 && (
            <div className="card card-pad" style={{ borderColor:'var(--blue)', borderWidth:1, borderStyle:'solid' }}>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:8, color:'var(--blue)' }}>
                📅 {heatmapHover.date} — {['없음','약함','보통','많음','매우 많음'][heatmapHover.level]} ({heatmapHover.count}문제)
              </div>
              {!yearSubsLoaded ? (
                <div style={{ fontSize:12, color:'var(--text3)', display:'flex', alignItems:'center', gap:6 }}>
                  <span className="spinner" style={{ width:12, height:12, borderWidth:2 }} />
                  Loading...
                </div>
              ) : (solvedByDate[heatmapHover?.date] || []).length > 0 ? (
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {solvedByDate[heatmapHover.date].map(p => (
                    <div key={p.id} onClick={() => navigate(`/problems/${p.id}`)}
                      style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:8, cursor:'pointer', background:'var(--bg2)' }}
                      className="list-item-hover">
                      <span style={{ fontSize:11, color:'var(--text3)', fontFamily:'Space Mono,monospace' }}>#{p.id}</span>
                      <span style={{ fontSize:13 }}>{p.title}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize:12, color:'var(--text3)' }}>Problem details not found. ({heatmapHover.count} problems solved on this day)</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════
          탭 5: 설정 (아바타 · 보상 · 구독 · 비밀번호)
      ══════════════════════════════════════ */}
      {mainTab==='settings' && (
        <div className="fade-up profile-settings-layout">
          <div className="profile-settings-hero">
            <div>
              <div className="profile-settings-kicker">프로필 설정</div>
              <h2>{headerDisplayName}'s Profile</h2>
            </div>
            <div className="profile-completion-card">
              <div className="profile-completion-head">
                <span>완성도</span>
                <strong>{profileCompleteness}%</strong>
              </div>
              <div className="profile-completion-bar">
                <div style={{ width:`${profileCompleteness}%` }} />
              </div>
              <div className="profile-completion-list">
                {profileCompletenessItems.map((item) => (
                  <span key={item.label} className={item.done ? 'done' : ''}>{item.label}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="profile-settings-preview-grid">
            <div className="profile-live-preview">
              <div className="profile-live-banner" style={{ background: profileBannerBackground }} />
              <div className="profile-live-body">
                <ProfileAvatar
                  profile={{ ...user, avatarUrlCustom, avatarColor, avatarEmoji, avatarSource }}
                  className="profile-live-avatar"
                  border={`3px solid ${tc}`}
                />
                <div className="profile-live-info">
                  <div className="profile-live-name-row">
                    {equippedBadgeMeta && <span>{equippedBadgeMeta.icon}</span>}
                    <strong>{headerDisplayName}</strong>
                    <span className="profile-live-tier" style={{ color:tc, borderColor:`${tc}55`, background:`${tc}16` }}>
                      {PROFILE_TIER_LABELS[user?.tier || 'unranked']}
                    </span>
                  </div>
                  <p>{headerBio || '소개를 추가하면 프로필 상단에 표시됩니다.'}</p>
                  {equippedTitleMeta && <div className="profile-live-title">{equippedTitleMeta.icon} {equippedTitleMeta.name}</div>}
                  <div className="profile-live-chips">
                    {headerTechStack.slice(0, 5).map((tech) => <span key={tech}>{tech}</span>)}
                    {countFilledProfileLinks(headerSocialLinks) > 0 && <span>{countFilledProfileLinks(headerSocialLinks)}개 링크</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className="profile-settings-notes">
              <div>
                <span>공개 범위</span>
                <strong>{submissionsPublic ? '제출 공개' : '제출 비공개'}</strong>
              </div>
              <div>
                <span>기본 언어</span>
                <strong>{JUDGE_LANGUAGE_OPTIONS.find((option) => option.value === defaultLanguage)?.label || defaultLanguage}</strong>
              </div>
              <div>
                <span>변경사항</span>
                <strong>{profileDraftChanged ? '미저장' : '저장됨'}</strong>
              </div>
            </div>
          </div>

          <div className="profile-settings-main-grid">
            <div className="profile-settings-column">

          {/* 프로필 정보 */}
          <div className="card profile-settings-card">
            <div className="profile-section-head"><span>🧑</span><div><strong>프로필 정보</strong><p>공개 프로필에 표시되는 이름, 소개, 링크를 수정합니다.</p></div></div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div className="form-group">
                <label>표시 이름</label>
                <input className="settings-input" value={displayName} onChange={e => setDisplayName(e.target.value)}
                  placeholder={user?.username || '표시 이름'} style={{ maxWidth:360 }} />
              </div>
              <div className="form-group">
                <label>소개</label>
                <textarea className="settings-input" value={bio} onChange={e => setBio(e.target.value)}
                  placeholder="자신을 소개해주세요" rows={3}
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

          <div className="card profile-settings-card" style={{ width:'100%' }}>
            <div className="profile-section-head"><span>⚙️</span><div><strong>제출 및 개인정보 설정</strong><p>기본 언어를 설정하고 제출 내역 공개 범위를 제어합니다.</p></div></div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div className="form-group">
                <label>기본 언어</label>
                <select value={defaultLanguage} onChange={(e) => setDefaultLanguage(e.target.value)}>
                  {JUDGE_LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="card card-pad-sm">
                <div className="section-header-title" style={{ marginBottom:6 }}>제출 내역 공개 범위</div>
                <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.6, marginBottom:10 }}>
                  활성화하면 다른 유저가 제출 목록을 볼 수 있습니다. 코드는 항상 비공개입니다.
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSubmissionsPublic(true)} style={{
                    background: submissionsPublic ? 'var(--blue)' : 'var(--bg2)',
                    color: submissionsPublic ? '#fff' : 'var(--text2)',
                  }}>공개</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSubmissionsPublic(false)} style={{
                    background: !submissionsPublic ? 'var(--orange)' : 'var(--bg2)',
                    color: !submissionsPublic ? '#fff' : 'var(--text2)',
                  }}>비공개</button>
                </div>
              </div>

              <button className="btn btn-primary" onClick={handleSavePreferences} disabled={prefsSaving} style={{ alignSelf:'flex-start', padding:'10px 24px' }}>
                {prefsSaving ? <span className="spinner"/> : '설정 저장'}
              </button>
            </div>
          </div>

          {/* 아바타 꾸미기 */}
          <div className="card profile-settings-card profile-avatar-card">
            <div className="profile-section-head"><span>🎨</span><div><strong>프로필 사진 및 배경</strong><p>DailyCoding 프로필과 OAuth 원본 사진 중 선택하고 배경과 색상을 커스터마이즈합니다.</p></div></div>
            <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
              <ProfileAvatar
                profile={{ ...user, avatarUrlCustom, avatarColor, avatarEmoji, avatarSource }}
                size={80}
                fontSize={36}
              />
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
                      if (file.size > 2 * 1024 * 1024) { toast?.show('Image must be under 2MB', 'error'); return }
                      const formData = new FormData()
                      formData.append('avatar', file)
                      try {
                        const { data } = await api.post('/auth/profile/avatar', formData, {
                          headers: { 'Content-Type': 'multipart/form-data' },
                        })
                        setAvatarUrlCustom(data.avatarUrl)
                        setAvatarSource(data.user?.avatarSource || data.user?.avatar_source || 'site')
                        applyUser(data.user)
                        toast?.show('Avatar uploaded.', 'success')
                      } catch (err) {
                        toast?.show(err.response?.data?.message || 'Avatar upload failed', 'error')
                      }
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="profile-avatar-source-grid">
              <button
                type="button"
                className={`profile-avatar-source-card ${avatarSource !== 'provider' ? 'selected' : ''}`}
                onClick={() => handleAvatarSourceChange('site')}
              >
                <span className="avatar-source-icon">DC</span>
                <span>
                  <strong>DailyCoding 프로필 사용</strong>
                  <small>업로드한 이미지, 이모지, 또는 색상을 프로필로 표시합니다.</small>
                </span>
                {avatarSource !== 'provider' && <em>선택됨</em>}
              </button>
              <button
                type="button"
                className={`profile-avatar-source-card provider ${avatarSource === 'provider' ? 'selected' : ''}`}
                onClick={() => handleAvatarSourceChange('provider')}
                disabled={!providerAvatarUrl}
              >
                <span className="avatar-source-icon">OAuth</span>
                <span>
                  <strong>원본 프로필 사진 사용</strong>
                  <small>Google/GitHub 로그인 제공자의 원본 사진으로 되돌립니다.</small>
                </span>
                {avatarSource === 'provider' && <em>선택됨</em>}
              </button>
            </div>
            <div className="profile-avatar-status-note">
              {avatarSource === 'provider'
                ? '원본 제공자 사진을 사용 중입니다. DailyCoding 프로필은 저장되어 있으며 언제든지 다시 활성화할 수 있습니다.'
                : hasCustomAvatarProfile
                  ? '저장된 DailyCoding 프로필을 사용 중입니다.'
                  : providerAvatarUrl
                    ? '사이트 프로필이 없습니다 — 원본 제공자 사진이 자동으로 표시됩니다.'
                    : '제공자 사진을 찾을 수 없습니다 — 이모지/색상 또는 이니셜이 표시됩니다.'}
            </div>
            <div style={{ marginBottom:16, padding:14, border:'1px solid var(--border)', borderRadius:14, background:'var(--bg2)' }}>
              <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}>
                <div>
                  <div style={{fontSize:13,fontWeight:800}}>푸시 알림</div>
                  <small style={{color:'var(--text3)'}}>배틀 초대 및 일일 초기화 알림을 브라우저에서 받습니다.</small>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={async()=>{
                  try {
                    if (pushStatus.subscribed) {
                      await unsubscribePush();
                      setPushStatus((prev) => ({...prev, subscribed:false}));
                      toast?.show('Push notifications disabled.', 'info');
                    } else {
                      await subscribePush();
                      setPushStatus((prev) => ({...prev, subscribed:true, configured:true}));
                      toast?.show('Push notifications enabled.', 'success');
                    }
                  } catch (err) {
                    toast?.show(err.message || 'Failed to update push notification settings', 'error');
                  }
                }}>{pushStatus.subscribed ? '비활성화' : '활성화'}</button>
              </div>
              {!pushStatus.configured && <div style={{fontSize:11,color:'var(--yellow)',marginTop:8}}>서버에 VAPID 키가 설정된 후 사용 가능합니다.</div>}
            </div>

            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:13, color:'var(--text3)', fontWeight:600, marginBottom:10 }}>🖼️ 프로필 배경</div>
              <div className="profile-background-grid">
                {visibleBackgrounds.map((bg) => (
                  <div key={bg.slug} className="profile-background-option">
                    <button
                      onClick={async () => {
                        try {
                          const { data } = await api.patch('/auth/profile/background', { backgroundSlug: bg.slug })
                          setEquippedBackground(bg.slug)
                          applyUser(data)
                          toast?.show('Background applied.', 'success')
                        } catch (err) {
                          toast?.show(err.response?.data?.message || 'Failed to apply background', 'error')
                        }
                      }}
                      className="profile-background-preview"
                      style={{
                        border:`2px solid ${equippedBackground === bg.slug ? 'var(--blue)' : 'var(--border)'}`,
                        background:profileBackgroundToCss(bg.image_url),
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
                    try {
                      const updated = await updateUser({avatar_color:c, avatar_source:'site'});
                      setAvatarColor(updated?.avatarColor || null);
                      setAvatarSource(updated?.avatarSource || updated?.avatar_source || 'site');
                    } catch {
                      toast?.show('Failed to save avatar color', 'error');
                    }
                  }} style={{
                    width:28, height:28, borderRadius:'50%', background:c,
                    border: avatarColor===c ? '3px solid var(--text)' : '2px solid var(--border)',
                    cursor:'pointer', transition:'transform .15s',
                  }} onMouseEnter={e=>e.currentTarget.style.transform='scale(1.2)'} onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}/>
                ))}
                <button onClick={async()=>{
                  try {
                    const updated = await updateUser({avatar_color:null, avatar_source:'site'});
                    setAvatarColor(updated?.avatarColor || null);
                    setAvatarSource(updated?.avatarSource || updated?.avatar_source || 'site');
                  } catch {
                    toast?.show('Failed to reset avatar color', 'error');
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
                    try {
                      const updated = await updateUser({avatar_emoji:e, avatar_source:'site'});
                      setAvatarEmoji(updated?.avatarEmoji || null);
                      setAvatarSource(updated?.avatarSource || updated?.avatar_source || 'site');
                    } catch {
                      toast?.show('Failed to save avatar emoji', 'error');
                    }
                  }} style={{
                    width:36, height:36, borderRadius:8, fontSize:18,
                    border: avatarEmoji===e ? '2px solid var(--text)' : '1px solid var(--border)',
                    background: avatarEmoji===e ? 'var(--bg3)' : 'transparent', cursor:'pointer',
                  }}>{e}</button>
                ))}
                <button onClick={async()=>{
                  try {
                    const updated = await updateUser({avatar_emoji:null, avatar_source:'site'});
                    setAvatarEmoji(updated?.avatarEmoji || null);
                    setAvatarSource(updated?.avatarSource || updated?.avatar_source || 'site');
                  } catch {
                    toast?.show('Failed to reset avatar emoji', 'error');
                  }
                }} style={{
                  width:36, height:36, borderRadius:8, border:'1px dashed var(--border)',
                  background:'transparent', cursor:'pointer', fontSize:11, color:'var(--text3)',
                }} title="초기화">✕</button>
              </div>
            </div>
          </div>

            </div>
            <div className="profile-settings-column profile-settings-side-column">

          {/* 보상 */}
          {rewards.length > 0 && (
            <div className="card profile-settings-card">
              <div className="profile-section-head"><span>🎁</span><div><strong>보상 및 장착</strong><p>획득한 배지와 칭호를 프로필에 적용합니다.</p></div></div>
              {/* 현재 장착 */}
              <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
                {[{type:'badge',current:equippedBadge,label:'장착된 배지'},{type:'title',current:equippedTitle,label:'장착된 칭호'}].map(item=>(
                  <div key={item.type} className="card card-pad-sm" style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:180 }}>
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
                  <div className="profile-rewards-subtitle">배지</div>
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
                  <div className="profile-rewards-subtitle">칭호</div>
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
          <div className="card profile-settings-card">
            <div className="profile-section-head"><span>💳</span><div><strong>Subscription</strong><p>View your current plan and manage upgrades or cancellations.</p></div></div>
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
              <div className="sub-label">Current Plan</div>
              <div className="sub-value">
                {formatCurrentSubscriptionLabel(subPlan?.tier, lang)}
              </div>
              {subPlan?.expires && (
                <div className="sub-expiry">Expires: {new Date(subPlan.expires).toLocaleDateString('en-US')}</div>
              )}
              <div className="sub-note">
                {subPlan?.tier && subPlan.tier !== 'free'
                  ? 'Your paid plan is active. You can schedule a cancellation or compare plans below.'
                  : 'You are on the free plan. Upgrade for more AI usage and premium features.'}
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
                    }}>{loadingPlan === plan.id ? 'Processing...' : 'Upgrade →'}</button>
                  </div>
                ))}
              </div>
            )}
            {subPlan?.tier && subPlan.tier!=='free' && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:10, alignItems:'center' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/pricing')}>
                  💳 Compare Plans
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleCancelSubscription}
                  disabled={cancelLoading}
                  style={{ color:'var(--red)', borderColor:'rgba(248,81,73,.25)' }}
                >
                  {cancelLoading ? 'Processing...' : 'Schedule Cancellation'}
                </button>
                <a href="mailto:choijunhuk2007@gmail.com" style={{ color:'var(--blue)', fontSize:13 }}>
                  choijunhuk2007@gmail.com
                </a>
              </div>
            )}
            {cancelMsg && (
              <div style={{ marginTop:12, fontSize:12, fontWeight:600, color:cancelMsg.toLowerCase().includes('fail') || cancelMsg.toLowerCase().includes('error') ? 'var(--red)' : 'var(--green)' }}>
                {cancelMsg}
              </div>
            )}
          </div>

          {/* 비밀번호 변경 */}
          <div className="card profile-settings-card">
            <div className="profile-section-head"><span>🔒</span><div><strong>Change Password</strong><p>Only applies to password accounts. Leave blank for OAuth accounts.</p></div></div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div className="form-group"><label>Current Password</label><input type="password" value={pwCurrent} onChange={e=>setPwCurrent(e.target.value)} placeholder="Current password"/></div>
              <div className="form-group"><label>New Password</label><input type="password" value={pwNext} onChange={e=>setPwNext(e.target.value)} placeholder="New password (min 8 chars)"/></div>
              <div className="form-group"><label>Confirm New Password</label><input type="password" value={pwConfirm} onChange={e=>setPwConfirm(e.target.value)} placeholder="Re-enter new password"/></div>
              {pwMsg && <div style={{ fontSize:13, color:pwMsg.startsWith('✅')?'var(--green)':'var(--red)', fontWeight:600 }}>{pwMsg}</div>}
              <button className="btn btn-primary" onClick={handlePwChange} disabled={pwLoading||!pwCurrent||!pwNext||!pwConfirm} style={{ alignSelf:'flex-start', padding:'10px 24px' }}>
                {pwLoading ? <span className="spinner"/> : 'Change Password'}
              </button>
            </div>
          </div>
            </div>
          </div>
        </div>
      )}
      <FollowListModal
        userId={user?.id}
        initialType={followModalType || 'followers'}
        open={Boolean(followModalType)}
        onClose={() => setFollowModalType(null)}
      />
    </div>
  );
}
