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
import { getDateLocale, pickLangText } from '../utils/languageMode.js';
import { getTierLabel } from '../utils/labelMaps.js';
import ProfileAvatar from '../components/ProfileAvatar.jsx';
import FollowListModal from '../components/FollowListModal.jsx';
import { buildYearHeatmap, formatDuration, profileBackgroundToCss, PROFILE_TIER_LABELS, PROFILE_TIER_THRESHOLDS } from './profilePageUtils.js';
import { buildPaymentFeedback, formatCurrentSubscriptionLabel, getProfileUpgradePlans } from './profileSubscriptionUtils.js';
import { DonutChart, TierBadge, YearHeatmap } from './profilePageWidgets.jsx';
import { SocialIcon, TechIcon, TECH_STACK_OPTIONS, getSocialIconMeta } from '../components/icons/BrandIcon.jsx';
import './ProfilePage.css';

const PROFILE_LINK_LABELS = { github:'GitHub', instagram:'Instagram', x:'X', linkedin:'LinkedIn', velog:'Velog', tistory:'Tistory' };

function isValidSocialUrl(value = '') {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return false;
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.');
  } catch {
    return false;
  }
}

function normalizeSocialLinksForDisplay(links = {}) {
  return Object.fromEntries(Object.entries(links || {}).filter(([, value]) => isValidSocialUrl(value)));
}


const DEFAULT_PROFILE_BACKGROUND_SLUG = 'solid-slate';
const DEFAULT_PROFILE_BACKGROUND_CSS = '#2d4057';
const LEGACY_PROFILE_BACKGROUND_SLUGS = new Set(['gradient-midnight', 'solid-ink', 'solid-dark']);

function normalizeProfileBackgroundSlug(slug) {
  if (!slug) return DEFAULT_PROFILE_BACKGROUND_SLUG;
  return LEGACY_PROFILE_BACKGROUND_SLUGS.has(slug) ? DEFAULT_PROFILE_BACKGROUND_SLUG : slug;
}

const countFilledProfileLinks = (links = {}) => Object.values(normalizeSocialLinksForDisplay(links || {})).filter(Boolean).length;

export default function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, updateUser, applyUser } = useAuth();
  const toast = useToast();
  const { lang } = useLang();
  const txt = (ko, en) => pickLangText(lang, ko, en);
  const dateLocale = getDateLocale(lang);
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
  const [socialLinks, setSocialLinks] = useState(normalizeSocialLinksForDisplay(user?.socialLinks || {}));
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
    setSocialLinks(normalizeSocialLinksForDisplay(user?.socialLinks || {}));
    setTechStack(user?.techStack || []);
  }, [user?.id]);

  const showLoadErrorToast = (message = txt('프로필 데이터를 불러오지 못했습니다.', 'Failed to load profile data.')) => {
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
      if (err?.response?.status !== 401) showLoadErrorToast(err?.response?.data?.message || txt('보상 정보를 불러오지 못했습니다.', 'Failed to load reward info.'));
    });
    api.get('/auth/top100').then(r => setTop100(r.data || [])).catch((err) => {
      if (err?.response?.status !== 401) showLoadErrorToast(err?.response?.data?.message || txt('랭킹 통계를 불러오지 못했습니다.', 'Failed to load ranking stats.'));
    });
    if (user?.id) {
      api.get(`/follows/${user.id}/stats`).then(r => setFollowStats(r.data)).catch((err) => {
        if (err?.response?.status !== 401) showLoadErrorToast(err?.response?.data?.message || txt('팔로우 통계를 불러오지 못했습니다.', 'Failed to load follow stats.'));
      });
      api.get('/auth/me/stats').then(r => setSolveStats(r.data)).catch((err) => {
        if (err?.response?.status !== 401) showLoadErrorToast(err?.response?.data?.message || txt('풀이 통계를 불러오지 못했습니다.', 'Failed to load solve stats.'));
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
        toast?.show(txt('🎉 구독이 완료되었습니다! 플랜이 활성화되었습니다.', '🎉 Subscription complete! Your plan has been activated.'), 'success', 5000);
        navigate('/profile', { replace: true });
      });
    } else if (params.get('payment') === 'cancelled') {
      setPaymentFeedback(buildPaymentFeedback('cancelled', lang));
      toast?.show(txt('결제가 취소되었습니다.', 'Payment was cancelled.'), 'info');
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
      label: getTierLabel(tier, lang) || meta.label,
      color: meta.color,
      problems: solvedProblems.filter((problem) => problem.tier === tier),
    }));
    const extras = solvedProblems.filter((problem) => !TIERS[problem.tier]);
    if (extras.length > 0) {
      groups.push({ tier: 'unranked', label: txt('기타', 'Other'), color: 'var(--text3)', problems: extras });
    }
    return groups.filter((group) => group.problems.length > 0);
  }, [solvedProblems, lang]);

  const top100RatingSum = top100.reduce((s, p) => s + (TIER_POINTS[p.tier] || 20), 0);

  const tc       = TIER_COLORS[user?.tier] || '#888';
  const visibleBackgrounds = backgrounds.filter((item) => !LEGACY_PROFILE_BACKGROUND_SLUGS.has(item.slug));
  const equippedBgMeta = visibleBackgrounds.find((item) => item.slug === equippedBackground);
  const getBackgroundDisplayName = (bg) => {
    const names = {
      'gradient-blue': txt('파랑', 'Blue'),
      'gradient-purple': txt('보라', 'Purple'),
      'gradient-green': txt('초록', 'Green'),
      'gradient-red': txt('빨강', 'Red'),
      'gradient-orange': txt('주황', 'Orange'),
      'gradient-pink': txt('핑크', 'Pink'),
      'gradient-teal': txt('청록', 'Teal'),
      'gradient-gold': txt('골드', 'Gold'),
      'gradient-sunset': txt('선셋', 'Sunset'),
      'gradient-ocean': txt('오션', 'Ocean'),
      'gradient-forest': txt('포레스트', 'Forest'),
      'gradient-rose': txt('로즈', 'Rose'),
      'gradient-cyber': txt('사이버', 'Cyber'),
      'gradient-lava': txt('라바', 'Lava'),
      'solid-charcoal': txt('차콜', 'Charcoal'),
      'solid-black': txt('블랙', 'Black'),
      'solid-navy': txt('네이비', 'Navy'),
      'solid-slate': txt('기본 슬레이트', 'Default Slate'),
      'solid-brown': txt('브라운', 'Brown'),
      'solid-olive': txt('올리브', 'Olive'),
      'solid-wine': txt('와인', 'Wine'),
      'solid-cream': txt('크림', 'Cream'),
      'photo-1': txt('배경 1', 'Background 1'),
      'photo-2': txt('배경 2', 'Background 2'),
      'photo-3': txt('배경 3', 'Background 3'),
      'photo-4': txt('배경 4', 'Background 4'),
      'focus-grid': txt('포커스 그리드', 'Focus Grid'),
      'night-judge': txt('나이트 저지', 'Night Judge'),
    };
    return names[bg?.slug] || bg?.name || '';
  };
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
      ? txt(`Lv.${progression.nextReward.level} 프로필 배경`, `Lv.${progression.nextReward.level} Profile Background`)
      : txt(`Lv.${progression.nextReward.level} 보상`, `Lv.${progression.nextReward.level} Reward`)
    : txt('모든 성장 보상을 해금했습니다', 'All growth rewards unlocked');
  const rewardByCode = new Map(rewards.map((reward) => [reward.code, reward]));
  const equippedBadgeMeta = equippedBadge ? rewardByCode.get(equippedBadge) : null;
  const equippedTitleMeta = equippedTitle ? rewardByCode.get(equippedTitle) : null;
  const isSettingsTab = mainTab === 'settings';
  const savedSocialLinks = normalizeSocialLinksForDisplay(user?.socialLinks || {});
  const providerAvatarUrl = user?.avatarUrl || user?.avatar_url || null;
  const hasCustomAvatarProfile = Boolean(avatarUrlCustom || avatarEmoji || avatarColor);
  const savedTechStack = user?.techStack || [];
  const headerDisplayName = isSettingsTab
    ? (displayName || user?.displayName || user?.username)
    : (user?.displayName || user?.username);
  const headerBio = isSettingsTab ? bio : user?.bio;
  const headerTechStack = isSettingsTab ? techStack : savedTechStack;
  const headerSocialLinks = isSettingsTab ? normalizeSocialLinksForDisplay(socialLinks) : savedSocialLinks;
  const profileDraftChanged = isSettingsTab && (
    (displayName || '') !== (user?.displayName || '') ||
    (bio || '') !== (user?.bio || '') ||
    JSON.stringify(socialLinks || {}) !== JSON.stringify(savedSocialLinks || {}) ||
    JSON.stringify(techStack || []) !== JSON.stringify(savedTechStack || [])
  );
  const profileCompletenessItems = [
    { label:txt('소개', 'Bio'), done:Boolean((bio || '').trim()) },
    { label:txt('아바타', 'Avatar'), done:Boolean(hasCustomAvatarProfile || providerAvatarUrl) },
    { label:txt('배경', 'Background'), done:Boolean(equippedBackground) },
    { label:txt('기술', 'Skills'), done:techStack.length > 0 },
    { label:txt('링크', 'Links'), done:countFilledProfileLinks(socialLinks) > 0 },
    { label:txt('보상', 'Rewards'), done:Boolean(equippedBadge || equippedTitle) },
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
    if (pwNext !== pwConfirm) { setPwMsg(txt('새 비밀번호가 서로 일치하지 않습니다.', 'New passwords do not match.')); return; }
    if (pwNext.length < 8)    { setPwMsg(txt('비밀번호는 최소 8자 이상이어야 합니다.', 'Password must be at least 8 characters.')); return; }
    setPwLoading(true);
    try {
      await api.patch('/auth/password', { current: pwCurrent, next: pwNext });
      setPwMsg(txt('✅ 비밀번호가 변경되었습니다.', '✅ Password changed successfully!'));
      toast?.show(txt('🔒 비밀번호가 변경되었습니다.', '🔒 Password changed.'), 'success');
      setPwCurrent(''); setPwNext(''); setPwConfirm('');
    } catch (err) {
      setPwMsg('❌ ' + (err.response?.data?.message || txt('비밀번호 변경에 실패했습니다', 'Failed to change password')));
    }
    setPwLoading(false);
  };

  const handleUpgrade = async (planId) => {
    const result = await startCheckout(planId);
    if (!result.ok) {
      toast?.show(result.reason || txt('결제 세션 생성에 실패했습니다', 'Failed to create payment session'), 'error');
    }
  };

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    setCancelMsg('');
    try {
      const { data } = await api.post('/subscription/cancel');
      await refreshSubscriptionStatus();
      setCancelMsg(data?.message || txt('구독 취소가 예약되었습니다.', 'Cancellation scheduled successfully.'));
      toast?.show(data?.message || txt('구독 취소가 예약되었습니다.', 'Cancellation scheduled successfully.'), 'success');
    } catch (err) {
      const message = err.response?.data?.message || txt('구독 취소 예약에 실패했습니다.', 'Failed to schedule cancellation.');
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
      toast?.show(newCode ? txt('✅ 장착했습니다', '✅ Equipped') : txt('장착 해제했습니다', 'Unequipped'), 'success');
    } catch (err) {
      toast?.show('❌ ' + (err.response?.data?.message || txt('실패했습니다', 'Failed')), 'error');
    }
  };

  const handleAvatarSourceChange = async (source) => {
    if (source === 'provider' && !providerAvatarUrl) {
      toast?.show(txt('연결된 제공자 프로필 이미지를 찾을 수 없습니다.', 'No linked provider profile image found.'), 'info');
      return;
    }
    try {
      const updated = await updateUser({ avatar_source: source });
      setAvatarSource(updated?.avatarSource || updated?.avatar_source || source);
      toast?.show(source === 'provider' ? txt('원본 프로필 사진을 사용합니다.', 'Using original profile photo.') : txt('DailyCoding 프로필을 사용합니다.', 'Using DailyCoding profile.'), 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || txt('프로필 사진 선택 저장에 실패했습니다', 'Failed to save profile photo selection'), 'error');
    }
  };

  const handleSavePreferences = async () => {
    setPrefsSaving(true);
    try {
      await updateUser({
        default_language: defaultLanguage,
        submissions_public: submissionsPublic,
      });
      toast?.show(txt('✅ 제출/언어 설정이 저장되었습니다.', '✅ Submission/language settings saved.'), 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || txt('설정 저장에 실패했습니다', 'Failed to save settings'), 'error');
    }
    setPrefsSaving(false);
  };

  const handleSaveProfileInfo = async () => {
    setProfileInfoSaving(true);
    try {
      const filteredLinks = normalizeSocialLinksForDisplay(socialLinks);
      const { data } = await api.patch('/auth/profile/extended', {
        display_name: displayName,
        bio,
        social_links: filteredLinks,
        tech_stack: techStack,
      });
      applyUser(data);
      toast?.show(txt('✅ 프로필 정보가 저장되었습니다.', '✅ Profile info saved.'), 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || txt('저장에 실패했습니다', 'Failed to save'), 'error');
    }
    setProfileInfoSaving(false);
  };

  const TABS = [
    ['solved',   txt('풀이', 'Solved')],
    ['top100',   'Top 100'],
    ['stats',    txt('통계', 'Stats')],
    ['streak',   txt('스트릭', 'Streak')],
    ['settings', txt('설정', 'Settings')],
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
              {isSettingsTab ? txt('편집 미리보기', 'Edit Preview') : txt('공개 프로필', 'Public Profile')}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setMainTab(isSettingsTab ? 'solved' : 'settings')}
            >
              {isSettingsTab ? txt('프로필 보기', 'View Profile') : txt('프로필 설정', 'Profile Settings')}
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
              }}>{getTierLabel(user?.tier || 'unranked', lang) || PROFILE_TIER_LABELS[user?.tier || 'unranked']}</span>
              {subPlan?.tier && subPlan.tier !== 'free' && (
                <span className="profile-sub-badge" style={{
                  background: subPlan.tier==='team'?'rgba(255,215,0,.15)':'rgba(121,192,255,.15)',
                  color: subPlan.tier==='team'?'#ffd700':'#79c0ff',
                  border: `1px solid ${subPlan.tier==='team'?'rgba(255,215,0,.3)':'rgba(121,192,255,.3)'}`,
                }}>{subPlan.tier.toUpperCase()}</span>
              )}
              {equippedTitle && (
                <span className="profile-title-badge">
                  {equippedTitleMeta?.icon} {lang === 'ko' ? (equippedTitleMeta?.name_ko || equippedTitleMeta?.name) : equippedTitleMeta?.name}
                </span>
              )}
              {profileDraftChanged && <span className="profile-unsaved-pill">{txt('미저장', 'Unsaved')}</span>}
            </div>
            {headerBio && <div className="profile-bio">{headerBio}</div>}
            <div className="profile-meta-info">@{user?.username} · {txt('가입일', 'Joined')} {user?.joinDate} · {user?.email}</div>
            {headerTechStack.length > 0 && (
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
                {headerTechStack.slice(0, 10).map(tech => (
                  <span key={tech} className="badge" style={{ display:'flex', alignItems:'center', gap:4, fontSize:11 }}>
                    <TechIcon name={tech} size={12} />
                    {tech}
                  </span>
                ))}
              </div>
            )}
            {Object.entries(headerSocialLinks).some(([, v]) => v) && (
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:6 }}>
                {Object.entries(headerSocialLinks).filter(([, url]) => url).map(([key, url]) => {
                  const meta = getSocialIconMeta(key);
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
                    ><SocialIcon name={key} size={14} />{meta.label}</a>
                  );
                })}
              </div>
            )}

            {/* 스탯 */}
            <div className="profile-header-stats">
              {[
                { v: user?.rating||0,         l:txt('레이팅', 'Rating'),   c:tc,              mono:true },
                { v: solvedProblemsMain.length, l:txt('풀이', 'Solved'),    c:'var(--green)'          },
                { v: `🔥${user?.streak||0}`,  l:txt('스트릭', 'Streak'),   c:'var(--yellow)'             },
                { v: `${accuracy}%`,           l:txt('정확도', 'Accuracy'),   c:'var(--orange)'             },
                { v: followStats.followers,    l:txt('팔로워', 'Followers'),   c:'var(--blue)', action:'followers' },
                { v: followStats.following,    l:txt('팔로잉', 'Following'),   c:'var(--purple)', action:'following' },
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
                  <span>{Math.max(0,(nextThres||0)-(user?.rating||0))} {txt('점 남음', 'pts to')} {getTierLabel(nextTier, lang)}</span>
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
              <div className="profile-growth-kicker">{txt('성장 XP', 'Growth XP')}</div>
              <div className="profile-growth-title">Lv.{progression.level} · {progression.xp.toLocaleString()} XP</div>
              <div className="profile-growth-copy">
                {txt(
                  '데일리 미션 보상은 랭킹 점수가 아닌 XP로만 쌓입니다. 배지, 칭호, 프로필 배경 같은 꾸미기 보상만 해금됩니다.',
                  'Daily mission rewards accumulate as XP only, not ranking points. Only cosmetic rewards like badges, titles, and profile backgrounds are unlocked.',
                )}
              </div>
            </div>
            <div className="profile-growth-next">
              <span>{txt('다음 해금', 'Next Unlock')}</span>
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
          { label:txt('푼 문제', 'Problems Solved'), value: learningActivity?.solvedProblems ?? solvedProblemsMain.length, color:'var(--green)' },
          { label:txt('XP 레벨', 'XP Level'), value: `Lv.${learningActivity?.xpLevel ?? 1}`, color:'var(--orange)' },
          { label:txt('배틀 승률', 'Battle Win Rate'), value: `${learningActivity?.battleWinRate ?? 0}%`, color:'var(--red)' },
          { label:txt('리뷰 채택 수', 'Accepted Reviews'), value: learningActivity?.reviewAcceptedCount ?? 0, color:'var(--blue)' },
          { label:txt('협업 점수', 'Collaboration Score'), value: learningActivity?.collaborationScore ?? 0, color:'var(--purple)' },
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
            <div className="profile-solved-count-label">{txt(`${solvedProblemsMain.length}개 해결 (메인)`, `${solvedProblemsMain.length} Solved (Main)`)}</div>
            <DonutChart
              data={Object.entries(TIERS).map(([k,v])=>({ color:v.color, count:tierCounts[k]||0 }))}
              total={solvedProblemsMain.length}
            />
            <div style={{ marginTop: 12, display:'grid', gap:6, width:'100%' }}>
              <div style={{ fontSize: 12, color:'var(--text2)' }}>{txt('빈칸 채우기', 'Fill-in-the-blank')}: <strong>{practiceTracks.fillBlank?.solvedCount ?? solvedFillBlank.length}</strong> {txt('개 해결', 'solved')} · {txt('티어', 'Tier')} {getTierLabel(practiceTracks.fillBlank?.tier || 'unranked', lang)}</div>
              <div style={{ fontSize: 12, color:'var(--text2)' }}>{txt('버그 수정', 'Bug fix')}: <strong>{practiceTracks.bugFix?.solvedCount ?? solvedBugFix.length}</strong> {txt('개 해결', 'solved')} · {txt('티어', 'Tier')} {getTierLabel(practiceTracks.bugFix?.tier || 'unranked', lang)}</div>
            </div>
          </div>

          <div className="card">
            <div className="profile-panel-header">
              {txt('난이도 분포', 'Difficulty Distribution')}
            </div>
            {/* header */}
            <div className="profile-dist-header">
              {[txt('레벨', 'Level'),'',txt('문제', 'Problems'),txt('비율', 'Ratio')].map((h,i)=>(
                <span key={i} className={`dist-h-${i}`}>{h}</span>
              ))}
            </div>
            {Object.entries(TIERS).map(([k,v])=>{
              const cnt = tierCounts[k]||0;
              const pct = solvedProblems.length ? (cnt/solvedProblems.length*100).toFixed(1) : '0.0';
              return (
                <div key={k} className="profile-dist-row">
                    <span className="dist-level" style={{ color:v.color }}>● {getTierLabel(k, lang) || v.label}</span>
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
                <div className="profile-panel-subtitle">{txt('푼 문제', 'Solved Problems')}</div>
                <div className="profile-solved-group-list">
                  {solvedByTier.map((group) => (
                    <div key={group.tier} className="profile-solved-group">
                      <div className="profile-solved-group-head">
                        <span style={{ color: group.color }}>{group.label}</span>
                        <strong>{group.problems.length}{txt('문제', ' problems')}</strong>
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
                <div className="profile-top100-label">{txt('상위 100 문제 난이도 합계', 'Difficulty sum of top 100 problems')}</div>
                <div className="profile-top100-value">
                  +{top100RatingSum}
                </div>
              </div>
              <div className="profile-top100-count">
                <div className="profile-top100-label">{txt('반영된 문제 수', 'Problems counted')}</div>
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
              {txt('배지 클릭 시 해당 문제로 이동합니다', 'Click a badge to go to that problem')}
            </div>
          </div>

          {/* 문제 목록 */}
          <div className="card">
            <div className="profile-panel-header">
              {txt(`레이팅 문제 (${top100.length})`, `Problems in Rating (${top100.length})`)}
            </div>
            {top100.length === 0
              ? <div className="profile-empty-msg">{txt('아직 풀이한 문제가 없습니다.', 'No problems solved yet.')}</div>
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
              { label:txt('총 제출', 'Total Submissions'),    v:submissions.length,   color:'var(--blue)'   },
              { label:txt('맞았습니다', 'Accepted'), v:resultStats.correct,  color:'var(--green)'  },
              { label:txt('틀렸습니다', 'Wrong Answer'), v:resultStats.wrong,    color:'var(--red)'    },
              { label:txt('시간 초과', 'Timeout'),  v:resultStats.timeout,  color:'var(--yellow)' },
            ].map(s=>(
              <div key={s.label} className="card profile-stat-mini">
                <div className="profile-stat-mini-value" style={{ color:s.color }}>{s.v}</div>
                <div className="profile-stat-mini-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Submissions by language */}
          <div className="card card-pad">
            <div className="section-header-title" style={{ marginBottom:14 }}>{txt('언어별 제출', 'Submissions by Language')}</div>
            {topLang.length===0
              ? <div style={{ color:'var(--text3)', fontSize:13 }}>{txt('제출 기록이 없습니다.', 'No submission history yet.')}</div>
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
            <div className="section-header-title" style={{ marginBottom:14 }}>{txt('이번 주', 'This Week')}</div>
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
              const dayNames=lang === 'ko'
                ? ['일','월','화','수','목','금','토']
                : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
              return (
                <div>
                  <div style={{ display:'flex', gap:16, marginBottom:16 }}>
                    {[{v:weekTotal,l:txt('제출', 'Submissions'),c:'var(--blue)'},{v:weekCorrect,l:txt('정답', 'Accepted'),c:'var(--green)'},{v:`${weekRate}%`,l:txt('정확도', 'Accuracy'),c:'var(--yellow)'}].map(s=>(
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
              <div className="section-header-title">{txt('취약 태그 분석', 'Weak Tag Analysis')}</div>
              <span style={{ fontSize:11, color:'var(--text3)' }}>{txt('태그별 오답률 기준', 'Based on wrong-answer rate by tag')}</span>
            </div>
            {weaknessStats.length === 0 ? (
              <div className="empty-state" style={{ padding:'24px 0' }}>
                <div className="empty-state-icon">📊</div>
                <div style={{ fontSize:13, color:'var(--text3)', lineHeight:1.7 }}>
                  {txt('같은 유형 제출이 2개 이상이면 자동으로 취약 태그가 표시됩니다.', 'Weak tags appear automatically after at least two submissions of the same type.')}
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
                          {txt(`오답률 ${item.missRate}% · ${item.attempts}회 시도`, `Error rate ${item.missRate}% · ${item.attempts} attempts`)}
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
            <div className="section-header-title" style={{ marginBottom:12 }}>{txt('풀이 시간 통계', 'Solve Time Stats')}</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:10, marginBottom:14 }}>
              {[
                { label:txt('평균 풀이 시간', 'Average Solve Time'), value: formatDuration(solveStats.avgSolveTime) },
                { label:txt('총 풀이 시간', 'Total Solve Time'), value: formatDuration(solveStats.totalSolveTime) },
                { label:txt('최단 풀이', 'Fastest Solve'), value: solveStats.fastestSolve ? `${solveStats.fastestSolve.problemTitle} · ${formatDuration(solveStats.fastestSolve.timeSec)}` : txt('기록 없음', 'No records') },
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
                      {txt('평균', 'Avg')} {formatDuration(stat.avgSec)} · {stat.count}{txt('문제', ' problems')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="card card-pad">
            <div className="section-header-title" style={{ marginBottom:12 }}>{txt('최근 활동', 'Recent Activity')}</div>
            {submissions.length===0
              ? <div className="empty-state" style={{ padding:'24px 0' }}>
                  <div className="empty-state-icon">📋</div>
                  <div style={{ fontSize:13, color:'var(--text3)' }}>{txt('제출 기록이 없습니다.', 'No submission history yet.')}</div>
                </div>
              : submissions.slice(0,8).map(s=>(
                <div key={s.id} className="list-item-hover" onClick={() => navigate(`/problems/${s.problem_id || s.problemId}`)} style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 0', borderBottom:'1px solid var(--border)', cursor:'pointer' }}>
                  <span style={{ flex:1, fontSize:13, fontWeight:500 }}>{s.problem_title || s.problemTitle}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:s.result==='correct'?'var(--green)':s.result==='wrong'?'var(--red)':'var(--yellow)' }}>
                    {s.result==='correct' ? txt('✓ 정답', '✓ Accepted') : s.result==='wrong' ? txt('✗ 오답', '✗ Wrong') : txt('시간 초과', 'Timeout')}
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
                <div style={{ fontSize:22, fontWeight:800 }}>{user?.streak||0}{txt('일', ' days')}</div>
                <div style={{ fontSize:13, color:'var(--text3)', marginTop:2 }}>{txt('현재 스트릭', 'Current Streak')}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:13, color:'var(--text3)' }}>{txt('활성 일수 (52주)', 'Active Days (52 weeks)')}</div>
                <div style={{ fontSize:20, fontWeight:800, fontFamily:'Space Mono,monospace' }}>{activeHeatmapDays}{txt('일', ' days')}</div>
              </div>
            </div>
            <YearHeatmap cells={heatmapCells} onCellHover={(cell) => setHeatmapHover(cell)} />
            <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:12, fontSize:11, color:'var(--text3)' }}>
              <span>{txt('없음', 'None')}</span>
              {[0,1,2,3,4].map(l=>(
                <div key={l} className={`gcell lv${l}`} style={{ width:12, height:12, borderRadius:3, flexShrink:0 }}/>
              ))}
              <span>{txt('많음', 'More')}</span>
            </div>
          </div>
          {heatmapHover && heatmapHover.level > 0 && (
            <div className="card card-pad" style={{ borderColor:'var(--blue)', borderWidth:1, borderStyle:'solid' }}>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:8, color:'var(--blue)' }}>
                📅 {heatmapHover.date} — {(lang === 'ko' ? ['없음','약함','보통','많음','매우 많음'] : ['None','Light','Normal','Heavy','Very heavy'])[heatmapHover.level]} ({heatmapHover.count}{txt('문제', ' problems')})
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
                <div style={{ fontSize:12, color:'var(--text3)' }}>
                  {txt('문제 상세 정보를 찾을 수 없습니다.', 'Problem details not found.')} ({heatmapHover.count}{txt('문제 풀이', ' problems solved on this day')})
                </div>
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
              <div className="profile-settings-kicker">{txt('프로필 설정', 'Profile Settings')}</div>
              <h2>{headerDisplayName}'s Profile</h2>
            </div>
            <div className="profile-completion-card">
              <div className="profile-completion-head">
                <span>{txt('완성도', 'Completeness')}</span>
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
                      {getTierLabel(user?.tier || 'unranked', lang) || PROFILE_TIER_LABELS[user?.tier || 'unranked']}
                    </span>
                  </div>
                  <p>{headerBio || txt('소개를 추가하면 프로필 상단에 표시됩니다.', 'Add a bio to show it at the top of your profile.')}</p>
                  {equippedTitleMeta && <div className="profile-live-title">{equippedTitleMeta.icon} {lang === 'ko' ? (equippedTitleMeta.name_ko || equippedTitleMeta.name) : equippedTitleMeta.name}</div>}
                  <div className="profile-live-chips">
                    {headerTechStack.slice(0, 5).map((tech) => <span key={tech}>{tech}</span>)}
                    {countFilledProfileLinks(headerSocialLinks) > 0 && <span>{countFilledProfileLinks(headerSocialLinks)}{txt('개 링크', ' links')}</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className="profile-settings-notes">
              <div>
                <span>{txt('공개 범위', 'Visibility')}</span>
                <strong>{submissionsPublic ? txt('제출 공개', 'Submissions Public') : txt('제출 비공개', 'Submissions Private')}</strong>
              </div>
              <div>
                <span>{txt('기본 언어', 'Default Language')}</span>
                <strong>{JUDGE_LANGUAGE_OPTIONS.find((option) => option.value === defaultLanguage)?.label || defaultLanguage}</strong>
              </div>
              <div>
                <span>{txt('변경사항', 'Changes')}</span>
                <strong>{profileDraftChanged ? txt('미저장', 'Unsaved') : txt('저장됨', 'Saved')}</strong>
              </div>
            </div>
          </div>

          <div className="profile-settings-main-grid">
            <div className="profile-settings-column">

          {/* 프로필 정보 */}
          <div className="card profile-settings-card">
            <div className="profile-section-head"><span>🧑</span><div><strong>{txt('프로필 정보', 'Profile Info')}</strong><p>{txt('공개 프로필에 표시되는 이름, 소개, 링크를 수정합니다.', 'Edit the name, bio, and links shown on your public profile.')}</p></div></div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div className="form-group">
                <label>{txt('표시 이름', 'Display Name')}</label>
                <input className="settings-input" value={displayName} onChange={e => setDisplayName(e.target.value)}
                  placeholder={user?.username || txt('표시 이름', 'Display Name')} style={{ maxWidth:360 }} />
              </div>
              <div className="form-group">
                <label>{txt('소개', 'Bio')}</label>
                <textarea className="settings-input" value={bio} onChange={e => setBio(e.target.value)}
                  placeholder={txt('자신을 소개해주세요', 'Introduce yourself')} rows={3}
                  style={{ resize:'vertical', fontFamily:'inherit', lineHeight:1.6, maxWidth:480 }} />
              </div>
              <div className="form-group">
                <label>{txt('소셜 링크', 'Social Links')}</label>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {Object.entries(PROFILE_LINK_LABELS).map(([key, label]) => (
                    <div key={key} style={{ display:'flex', alignItems:'center', gap:8, maxWidth:480 }}>
                      <span style={{ width:90, fontSize:13, color:'var(--text2)', flexShrink:0 }}>{label}</span>
                      <input className="settings-input" style={{ flex:1 }}
                        value={socialLinks[key] || ''} onChange={e => setSocialLinks(p => ({ ...p, [key]: e.target.value }))}
                        name={`profile_${key}_url`} type="url" inputMode="url" autoComplete="off" spellCheck="false"
                        placeholder={`${label} URL`} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>{txt('기술 스택', 'Tech Stack')}</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, maxWidth:560 }}>
                  {TECH_STACK_OPTIONS.map(tech => (
                    <button key={tech} onClick={() => setTechStack(prev => prev.includes(tech) ? prev.filter(x => x !== tech) : prev.length < 20 ? [...prev, tech] : prev)}
                      style={{
                        display:'flex', alignItems:'center', gap:4,
                        padding:'4px 10px', borderRadius:20, fontSize:12, cursor:'pointer', border:'1px solid var(--border)',
                        background: techStack.includes(tech) ? 'var(--accent)' : 'var(--bg3)',
                        color: techStack.includes(tech) ? '#fff' : 'var(--text2)',
                      }}>
                      <TechIcon name={tech} size={13} />
                      {tech}
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleSaveProfileInfo} disabled={profileInfoSaving} style={{ alignSelf:'flex-start', padding:'10px 24px' }}>
                {profileInfoSaving ? <span className="spinner"/> : txt('프로필 저장', 'Save Profile')}
              </button>
            </div>
          </div>

          <div className="card profile-settings-card" style={{ width:'100%' }}>
            <div className="profile-section-head"><span>⚙️</span><div><strong>{txt('제출 및 개인정보 설정', 'Submission and Privacy Settings')}</strong><p>{txt('기본 언어를 설정하고 제출 내역 공개 범위를 제어합니다.', 'Set your default language and control submission history visibility.')}</p></div></div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div className="form-group">
                <label>{txt('기본 언어', 'Default Language')}</label>
                <select value={defaultLanguage} onChange={(e) => setDefaultLanguage(e.target.value)}>
                  {JUDGE_LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="card card-pad-sm">
                <div className="section-header-title" style={{ marginBottom:6 }}>{txt('제출 내역 공개 범위', 'Submission History Visibility')}</div>
                <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.6, marginBottom:10 }}>
                  {txt('활성화하면 다른 유저가 제출 목록을 볼 수 있습니다. 코드는 항상 비공개입니다.', 'When enabled, other users can see your submission list. Code is always private.')}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSubmissionsPublic(true)} style={{
                    background: submissionsPublic ? 'var(--blue)' : 'var(--bg2)',
                    color: submissionsPublic ? '#fff' : 'var(--text2)',
                  }}>{txt('공개', 'Public')}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSubmissionsPublic(false)} style={{
                    background: !submissionsPublic ? 'var(--orange)' : 'var(--bg2)',
                    color: !submissionsPublic ? '#fff' : 'var(--text2)',
                  }}>{txt('비공개', 'Private')}</button>
                </div>
              </div>

              <button className="btn btn-primary" onClick={handleSavePreferences} disabled={prefsSaving} style={{ alignSelf:'flex-start', padding:'10px 24px' }}>
                {prefsSaving ? <span className="spinner"/> : txt('설정 저장', 'Save Settings')}
              </button>
            </div>
          </div>

          {/* 아바타 꾸미기 */}
          <div className="card profile-settings-card profile-avatar-card">
            <div className="profile-section-head"><span>🎨</span><div><strong>{txt('프로필 사진 및 배경', 'Profile Photo and Background')}</strong><p>{txt('DailyCoding 프로필과 OAuth 원본 사진 중 선택하고 배경과 색상을 커스터마이즈합니다.', 'Choose between your DailyCoding profile and original OAuth photo, then customize background and colors.')}</p></div></div>
            <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
              <ProfileAvatar
                profile={{ ...user, avatarUrlCustom, avatarColor, avatarEmoji, avatarSource }}
                size={80}
                fontSize={36}
              />
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <label className="btn btn-ghost btn-sm" style={{ cursor:'pointer' }}>
                  📷 {txt('이미지 업로드', 'Upload Image')}
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
                  <strong>{txt('DailyCoding 프로필 사용', 'Use DailyCoding Profile')}</strong>
                  <small>{txt('업로드한 이미지, 이모지, 또는 색상을 프로필로 표시합니다.', 'Show your uploaded image, emoji, or color as your profile.')}</small>
                </span>
                {avatarSource !== 'provider' && <em>{txt('선택됨', 'Selected')}</em>}
              </button>
              <button
                type="button"
                className={`profile-avatar-source-card provider ${avatarSource === 'provider' ? 'selected' : ''}`}
                onClick={() => handleAvatarSourceChange('provider')}
                disabled={!providerAvatarUrl}
              >
                <span className="avatar-source-icon">OAuth</span>
                <span>
                  <strong>{txt('원본 프로필 사진 사용', 'Use Original Profile Photo')}</strong>
                  <small>{txt('Google/GitHub 로그인 제공자의 원본 사진으로 되돌립니다.', 'Revert to the original photo from your Google/GitHub login provider.')}</small>
                </span>
                {avatarSource === 'provider' && <em>{txt('선택됨', 'Selected')}</em>}
              </button>
            </div>
            <div className="profile-avatar-status-note">
              {avatarSource === 'provider'
                ? txt('원본 제공자 사진을 사용 중입니다. DailyCoding 프로필은 저장되어 있으며 언제든지 다시 활성화할 수 있습니다.', 'You are using the original provider photo. Your DailyCoding profile is saved and can be re-enabled anytime.')
                : hasCustomAvatarProfile
                  ? txt('저장된 DailyCoding 프로필을 사용 중입니다.', 'You are using your saved DailyCoding profile.')
                  : providerAvatarUrl
                    ? txt('사이트 프로필이 없습니다 — 원본 제공자 사진이 자동으로 표시됩니다.', 'No site profile exists; the original provider photo is shown automatically.')
                    : txt('제공자 사진을 찾을 수 없습니다 — 이모지/색상 또는 이니셜이 표시됩니다.', 'No provider photo found; emoji/color or initials are shown.')}
            </div>
            <div style={{ marginBottom:16, padding:14, border:'1px solid var(--border)', borderRadius:14, background:'var(--bg2)' }}>
              <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}>
                <div>
                  <div style={{fontSize:13,fontWeight:800}}>{txt('푸시 알림', 'Push Notifications')}</div>
                  <small style={{color:'var(--text3)'}}>{txt('배틀 초대 및 일일 초기화 알림을 브라우저에서 받습니다.', 'Receive battle invite and daily reset notifications in your browser.')}</small>
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
                }}>{pushStatus.subscribed ? txt('비활성화', 'Disable') : txt('활성화', 'Enable')}</button>
              </div>
              {!pushStatus.configured && <div style={{fontSize:11,color:'var(--yellow)',marginTop:8}}>{txt('서버에 VAPID 키가 설정된 후 사용 가능합니다.', 'Available after VAPID keys are configured on the server.')}</div>}
            </div>

            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:13, color:'var(--text3)', fontWeight:600, marginBottom:10 }}>🖼️ {txt('프로필 배경', 'Profile Background')}</div>
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
                      title={getBackgroundDisplayName(bg)}
                    />
                    <div className="profile-background-name">{getBackgroundDisplayName(bg)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:8 }}>{txt('색상', 'Color')}</div>
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
                }} title={txt('초기화', 'Reset')}>✕</button>
              </div>
            </div>
            <div>
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:8 }}>{txt('이모지', 'Emoji')}</div>
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
                }} title={txt('초기화', 'Reset')}>✕</button>
              </div>
            </div>
          </div>

            </div>
            <div className="profile-settings-column profile-settings-side-column">

          {/* 보상 */}
          {rewards.length > 0 && (
            <div className="card profile-settings-card">
              <div className="profile-section-head"><span>🎁</span><div><strong>{txt('보상 및 장착', 'Rewards and Equip')}</strong><p>{txt('획득한 배지와 칭호를 프로필에 적용합니다.', 'Apply earned badges and titles to your profile.')}</p></div></div>
              {/* 현재 장착 */}
              <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
                {[{type:'badge',current:equippedBadge,label:txt('장착된 배지', 'Equipped Badge')},{type:'title',current:equippedTitle,label:txt('장착된 칭호', 'Equipped Title')}].map(item=>(
                  <div key={item.type} className="card card-pad-sm" style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:180 }}>
                    <span style={{ fontSize:20 }}>{item.current ? rewards.find(r=>r.code===item.current)?.icon : (item.type==='badge'?'⬜':'📛')}</span>
                    <div>
                      <div style={{ fontSize:11, color:'var(--text3)', marginBottom:2 }}>{item.label}</div>
                      <div style={{ fontSize:13, fontWeight:600 }}>{item.current ? (lang === 'ko' ? (rewards.find(r=>r.code===item.current)?.name_ko || rewards.find(r=>r.code===item.current)?.name) : rewards.find(r=>r.code===item.current)?.name) : txt('없음', 'None')}</div>
                    </div>
                    {item.current && (
                      <button className="btn btn-ghost btn-sm" style={{ marginLeft:'auto', fontSize:11 }} onClick={()=>handleEquip(item.type,item.current)}>{txt('해제', 'Unequip')}</button>
                    )}
                  </div>
                ))}
              </div>

              {/* 뱃지 그리드 */}
              {rewards.filter(r=>r.type==='badge').length>0 && (
                <>
                  <div className="profile-rewards-subtitle">{txt('배지', 'Badges')}</div>
                  <div className="profile-rewards-grid">
                    {rewards.filter(r=>r.type==='badge').map(r=>{
                      const isEquipped=equippedBadge===r.code;
                      return (
                        <div key={r.code} onClick={()=>handleEquip('badge',r.code)} className={`profile-reward-item ${isEquipped ? 'equipped' : ''}`}>
                          <div className="reward-icon">{r.icon}</div>
                          <div className="reward-name">{lang === 'ko' ? (r.name_ko || r.name) : r.name}</div>
                          {isEquipped && <div className="reward-equipped-tag">✓ {txt('장착 중', 'Equipped')}</div>}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* 칭호 리스트 */}
              {rewards.filter(r=>r.type==='title').length>0 && (
                <>
                  <div className="profile-rewards-subtitle">{txt('칭호', 'Titles')}</div>
                  <div className="profile-rewards-list">
                    {rewards.filter(r=>r.type==='title').map(r=>{
                      const isEquipped=equippedTitle===r.code;
                      return (
                        <div key={r.code} onClick={()=>handleEquip('title',r.code)} className={`profile-title-item ${isEquipped ? 'equipped' : ''}`}>
                          <span className="title-icon">{r.icon}</span>
                          <div className="title-info">
                            <div className="title-name">{lang === 'ko' ? (r.name_ko || r.name) : r.name}</div>
                            <div className="title-desc">{lang === 'ko' ? (r.description_ko || r.description) : r.description}</div>
                          </div>
                          {isEquipped && <div className="title-equipped-tag">✓ {txt('장착 중', 'Equipped')}</div>}
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
            <div className="profile-section-head"><span>💳</span><div><strong>{txt('구독', 'Subscription')}</strong><p>{txt('현재 플랜을 확인하고 업그레이드 또는 취소를 관리합니다.', 'View your current plan and manage upgrades or cancellations.')}</p></div></div>
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
              <div className="sub-label">{txt('현재 플랜', 'Current Plan')}</div>
              <div className="sub-value">
                {formatCurrentSubscriptionLabel(subPlan?.tier, lang)}
              </div>
              {subPlan?.expires && (
                <div className="sub-expiry">{txt('만료일', 'Expires')}: {new Date(subPlan.expires).toLocaleDateString(dateLocale)}</div>
              )}
              <div className="sub-note">
                {subPlan?.tier && subPlan.tier !== 'free'
                  ? txt('유료 플랜이 활성화되어 있습니다. 아래에서 취소 예약 또는 플랜 비교를 할 수 있습니다.', 'Your paid plan is active. You can schedule a cancellation or compare plans below.')
                  : txt('현재 무료 플랜을 사용 중입니다. 더 많은 AI 사용량과 프리미엄 기능을 원하면 업그레이드하세요.', 'You are on the free plan. Upgrade for more AI usage and premium features.')}
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
                    }}>{loadingPlan === plan.id ? txt('처리 중...', 'Processing...') : txt('업그레이드 →', 'Upgrade →')}</button>
                  </div>
                ))}
              </div>
            )}
            {subPlan?.tier && subPlan.tier!=='free' && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:10, alignItems:'center' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/pricing')}>
                  💳 {txt('플랜 비교', 'Compare Plans')}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleCancelSubscription}
                  disabled={cancelLoading}
                  style={{ color:'var(--red)', borderColor:'rgba(248,81,73,.25)' }}
                >
                  {cancelLoading ? txt('처리 중...', 'Processing...') : txt('취소 예약', 'Schedule Cancellation')}
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
            <div className="profile-section-head"><span>🔒</span><div><strong>{txt('비밀번호 변경', 'Change Password')}</strong><p>{txt('비밀번호 계정에만 적용됩니다. OAuth 계정은 비워두세요.', 'Only applies to password accounts. Leave blank for OAuth accounts.')}</p></div></div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div className="form-group"><label>{txt('현재 비밀번호', 'Current Password')}</label><input type="password" value={pwCurrent} onChange={e=>setPwCurrent(e.target.value)} placeholder={txt('현재 비밀번호', 'Current password')}/></div>
              <div className="form-group"><label>{txt('새 비밀번호', 'New Password')}</label><input type="password" value={pwNext} onChange={e=>setPwNext(e.target.value)} placeholder={txt('새 비밀번호 (최소 8자)', 'New password (min 8 chars)')}/></div>
              <div className="form-group"><label>{txt('새 비밀번호 확인', 'Confirm New Password')}</label><input type="password" value={pwConfirm} onChange={e=>setPwConfirm(e.target.value)} placeholder={txt('새 비밀번호 다시 입력', 'Re-enter new password')}/></div>
              {pwMsg && <div style={{ fontSize:13, color:pwMsg.startsWith('✅')?'var(--green)':'var(--red)', fontWeight:600 }}>{pwMsg}</div>}
              <button className="btn btn-primary" onClick={handlePwChange} disabled={pwLoading||!pwCurrent||!pwNext||!pwConfirm} style={{ alignSelf:'flex-start', padding:'10px 24px' }}>
                {pwLoading ? <span className="spinner"/> : txt('비밀번호 변경', 'Change Password')}
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
