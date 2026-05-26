import { useEffect, useMemo, useState } from 'react';
import api from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { formatWithLang, pickLangText } from '../utils/languageMode.js';
import './BadgesPage.css';

const CATEGORY_LABELS = {
  coding:  { ko: '코딩 챌린지', label: 'Coding Challenges', emoji: '💻' },
  streak:  { ko: '꾸준함',       label: 'Consistency',       emoji: '🔥' },
  ranking: { ko: '티어 업적',    label: 'Tier Achievements', emoji: '🏆' },
  battle:  { ko: '배틀',         label: 'Battle',            emoji: '⚔️' },
  xp:      { ko: '성장',         label: 'Growth',            emoji: '🌱' },
  explore: { ko: '탐험',         label: 'Exploration',       emoji: '🔍' },
};

const RARITY_META = {
  common:    { label: 'COMMON',    labelKo: '일반',   color: '#94a3b8' },
  uncommon:  { label: 'UNCOMMON',  labelKo: '고급',   color: '#22c55e' },
  rare:      { label: 'RARE',      labelKo: '희귀',   color: '#38bdf8' },
  epic:      { label: 'EPIC',      labelKo: '영웅',   color: '#a78bfa' },
  legendary: { label: 'LEGENDARY', labelKo: '전설',   color: '#f59e0b' },
};

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const CATEGORY_ORDER = ['coding', 'streak', 'ranking', 'battle', 'xp', 'explore'];

function formatMessage(template, values = {}) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value)),
    template
  );
}

function formatPercent(value) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function ItemCard({ item, isEquipped, isShowcased, onEquip, onToggleShowcase, stats, lang, t }) {
  const rarity = RARITY_META[item.rarity] || RARITY_META.common;
  const earned = Boolean(item.earned);
  const isTitle = item.type === 'title';
  const showStatusRibbon = (isTitle && isEquipped) || (!isTitle && isShowcased);
  const ownerRatio = item.ownerStats?.ownerRatio ?? stats?.ownerRatio ?? stats?.pct ?? null;
  const ownerRatioText = formatPercent(ownerRatio);
  const progressPercent = item.progress?.percentage ?? (earned ? 100 : null);

  const earnedDate = item.earned_at
    ? formatWithLang(lang, item.earned_at, { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  return (
    <div
      className="badge-card"
      style={{
        border: isEquipped
          ? '2px solid var(--blue)'
          : `1.5px solid ${earned ? rarity.color : 'var(--border)'}`,
        borderRadius: 16,
        padding: '20px 16px',
        background: isEquipped
          ? 'linear-gradient(135deg, var(--bg2), rgba(88,166,255,.08))'
          : earned ? `linear-gradient(135deg, var(--bg2), ${rarity.color}0d)` : 'var(--bg2)',
        boxShadow: isEquipped
          ? '0 0 20px rgba(88,166,255,.25)'
          : earned ? `0 0 18px ${rarity.color}33` : 'none',
        filter: earned ? 'none' : 'grayscale(1)',
        opacity: earned ? 1 : 0.45,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        textAlign: 'center',
        position: 'relative',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
    >
      {showStatusRibbon && (
        <div style={{
          position: 'absolute', top: 8, left: 8,
          fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 20,
          background: 'var(--blue)', color: '#fff', letterSpacing: 0.3,
        }}>
          {isTitle ? t('rewards.equippedTitle') : t('rewards.showcased')}
        </div>
      )}
      {earned && !isEquipped && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          width: 8, height: 8, borderRadius: '50%',
          background: rarity.color, boxShadow: `0 0 6px ${rarity.color}`,
        }} />
      )}

      <div style={{
        fontSize: isTitle ? '2rem' : '2.6rem', lineHeight: 1,
        filter: earned ? `drop-shadow(0 0 8px ${rarity.color}88)` : 'none',
        marginTop: isEquipped ? 12 : 0,
      }}>
        {item.icon || (isTitle ? '🏷️' : '🎖️')}
      </div>

      <div style={{ fontWeight: 800, fontSize: 14, color: earned ? 'var(--text)' : 'var(--text3)' }}>
        {lang === 'ko' ? (item.name_ko || item.name) : item.name}
      </div>

      {isTitle && (
        <div style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
          background: earned ? `${rarity.color}22` : 'var(--bg3)',
          color: earned ? rarity.color : 'var(--text3)',
          border: `1px solid ${earned ? `${rarity.color}44` : 'var(--border)'}`,
        }}>
          {t('rewards.title')}
        </div>
      )}

      <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5, flex: 1 }}>
        {lang === 'ko' ? (item.description_ko || item.description) : item.description}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', marginTop: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 0.8, color: rarity.color }}>
            {lang === 'ko' ? rarity.labelKo : rarity.label}
          </div>
          {ownerRatioText !== null && (
            <div style={{ fontSize: 10, color: 'var(--text3)' }} title={t('rewards.ownerRatioHelp')}>
              {formatMessage(t('rewards.ownerRatioValue'), { ratio: ownerRatioText })}
            </div>
          )}
        </div>
        {progressPercent !== null && (
          <div style={{ width: '100%', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginBottom: 3 }}>
              <span>{t('rewards.progress')}</span>
              <span>{progressPercent}%</span>
            </div>
            <div style={{ height: 5, borderRadius: 999, background: 'var(--bg3)', overflow: 'hidden' }}>
              <div style={{ width: `${progressPercent}%`, height: '100%', background: earned ? rarity.color : 'var(--blue)' }} />
            </div>
            {item.progress?.target ? (
              <div style={{ fontSize: 9.5, color: 'var(--text3)', marginTop: 3 }}>
                {formatMessage(t('rewards.progressCount'), { current: item.progress.current ?? 0, target: item.progress.target })}
              </div>
            ) : null}
          </div>
        )}
        {earned && earnedDate && (
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>{t('rewards.earnedAt')} {earnedDate}</div>
        )}
        {earned ? (
          <>
            <button
              type="button"
              onClick={() => onEquip(item.type, item.code)}
              style={{
                marginTop: 4, padding: '5px 0', width: '100%',
                border: `1px solid ${isEquipped ? 'var(--purple)' : 'var(--blue)'}`,
                borderRadius: 8,
                background: isEquipped ? 'rgba(167,139,250,.15)' : 'rgba(88,166,255,.12)',
                color: isEquipped ? 'var(--purple)' : 'var(--blue)',
                fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'opacity 0.15s',
              }}
            >
              {isEquipped
                ? (isTitle ? t('rewards.equippedTitle') : t('rewards.equippedBadge'))
                : (isTitle ? t('rewards.equipTitle') : t('rewards.equipBadge'))}
            </button>
            {!isTitle && (
              <button
                type="button"
                onClick={() => onToggleShowcase(item.code, !isShowcased)}
                style={{
                  marginTop: 4, padding: '5px 0', width: '100%',
                  border: `1px solid ${isShowcased ? 'var(--red)' : 'var(--border)'}`,
                  borderRadius: 8,
                  background: isShowcased ? 'rgba(248,81,73,.12)' : 'transparent',
                  color: isShowcased ? 'var(--red)' : 'var(--text3)',
                  fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'opacity 0.15s',
                }}
              >
                {isShowcased ? t('rewards.removeShowcase') : t('rewards.showcaseBadge')}
              </button>
            )}
          </>
        ) : (
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>🔒 {t('rewards.notOwned')}</div>
        )}
      </div>
    </div>
  );
}

function Section({ title, emoji, items, equippedBadge, equippedTitle, showcasedCodes, onEquip, onToggleShowcase, stats, accentColor, lang, t }) {
  const earned = items.filter((b) => b.earned).length;
  const color = accentColor || 'var(--blue)';

  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
        paddingBottom: 10, borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: '1.3rem' }}>{emoji}</span>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{title}</h2>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
          background: earned > 0 ? `${color}22` : 'var(--bg3)',
          color: earned > 0 ? color : 'var(--text3)',
          border: `1px solid ${earned > 0 ? `${color}44` : 'var(--border)'}`,
        }}>
          {earned} / {items.length}
        </span>
      </div>
      <div className="badges-grid">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            isEquipped={item.type === 'title' ? equippedTitle === item.code : equippedBadge === item.code}
            isShowcased={showcasedCodes.has(item.code)}
            onEquip={onEquip}
            onToggleShowcase={onToggleShowcase}
            stats={stats?.[item.code]}
            lang={lang}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

export default function BadgesPage() {
  const toast = useToast();
  const { applyUser } = useAuth();
  const { lang, t } = useLang();
  const txt = (ko, en) => pickLangText(lang, ko, en);
  const [badges, setBadges] = useState([]);
  const [titles, setTitles] = useState([]);
  const [stats, setStats] = useState({});
  const [equippedBadge, setEquippedBadge] = useState(null);
  const [equippedTitle, setEquippedTitle] = useState(null);
  const [showcasedBadges, setShowcasedBadges] = useState([]);
  const [badgeShowcaseLimit, setBadgeShowcaseLimit] = useState(3);
  const [earnedCount, setEarnedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [progression, setProgression] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('badges');

  useEffect(() => {
    (async () => {
      await api.post('/badges/sync').catch(() => {});
      try {
        const [badgesRes, titlesRes, statsRes, rewardsRes] = await Promise.all([
          api.get('/badges'),
          api.get('/badges/titles'),
          api.get('/badges/stats').catch(() => ({ data: {} })),
          api.get('/rewards/my').catch(() => ({ data: null })),
        ]);
        const badgeList = badgesRes.data?.badges || [];
        const titleList = titlesRes.data?.titles || [];
        setBadges(badgeList);
        setTitles(titleList);
        setStats(statsRes.data || {});
        setEquippedBadge(badgesRes.data?.equippedBadge || null);
        setEquippedTitle(badgesRes.data?.equippedTitle || null);
        setShowcasedBadges(rewardsRes.data?.showcasedBadges || []);
        setBadgeShowcaseLimit(rewardsRes.data?.badgeShowcaseLimit || 3);
        setEarnedCount((badgesRes.data?.earnedCount || 0) + (titlesRes.data?.earnedCount || 0));
        setTotalCount((badgesRes.data?.totalCount || 0) + (titlesRes.data?.totalCount || 0));
        if (rewardsRes.data) setProgression(rewardsRes.data.progression || null);
      } catch {
        toast?.show(t('rewards.loadFailed'), 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleEquip = async (type, code) => {
    const current = type === 'badge' ? equippedBadge : equippedTitle;
    const newCode = current === code ? null : code;
    try {
      const { data } = await api.post('/rewards/equip', { type, code: newCode });
      if (type === 'badge') setEquippedBadge(newCode);
      else setEquippedTitle(newCode);
      if (data?.user) applyUser(data.user);
      const successKey = type === 'badge'
        ? (newCode ? 'rewards.badgeEquippedToast' : 'rewards.badgeUnequippedToast')
        : (newCode ? 'rewards.titleEquippedToast' : 'rewards.titleUnequippedToast');
      toast?.show(t(successKey), 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || t('rewards.equipFailed'), 'error');
    }
  };

  const handleToggleShowcase = async (code, showcased) => {
    try {
      const { data } = await api.post('/rewards/showcase', { code, showcased });
      setShowcasedBadges(data?.showcasedBadges || []);
      setBadgeShowcaseLimit(data?.badgeShowcaseLimit || badgeShowcaseLimit);
      toast?.show(showcased ? t('rewards.badgeShowcasedToast') : t('rewards.badgeRemovedToast'), 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || t('rewards.showcaseFailed'), 'error');
    }
  };

  const showcasedCodes = useMemo(() => new Set(showcasedBadges.map((badge) => badge.code)), [showcasedBadges]);

  const grouped = useMemo(() => {
    if (activeTab === 'titles') return {};
    const source = badges;
    const map = {};
    for (const badge of source) {
      const cat = badge.category || 'etc';
      if (!map[cat]) map[cat] = [];
      map[cat].push(badge);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => {
        const ri = RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity);
        return ri !== 0 ? ri : (a.sort_order || 0) - (b.sort_order || 0);
      });
    }
    return map;
  }, [badges, activeTab]);

  const orderedCategories = useMemo(() => {
    const keys = Object.keys(grouped);
    return [...CATEGORY_ORDER.filter((c) => keys.includes(c)), ...keys.filter((c) => !CATEGORY_ORDER.includes(c))];
  }, [grouped]);

  const progressPct = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;

  const equippedBadgeMeta = badges.find((b) => b.code === equippedBadge);
  const equippedTitleMeta = titles.find((t) => t.code === equippedTitle);

  const tabs = [
    { key: 'badges', label: t('rewards.badges'), emoji: '🎖️' },
    { key: 'titles', label: t('rewards.titles'), emoji: '🏷️' },
  ];

  if (loading) {
    return (
      <div style={{ padding: '40px 28px', maxWidth: 960, margin: '0 auto' }}>
        <div className="skeleton-line" style={{ width: '30%', height: 28, marginBottom: 16 }} />
        <div className="badges-grid">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton-line" style={{ height: 200, borderRadius: 16 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="badges-page" style={{ padding: '32px 28px', maxWidth: 960, margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 13, color: 'var(--blue)', fontWeight: 900, marginBottom: 6 }}>{t('rewards.inventoryLabel')}</div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: 'var(--text)' }}>{t('rewards.inventory')}</h1>
        <p style={{ margin: '8px 0 0', color: 'var(--text3)', fontSize: 13 }}>
          {t('rewards.inventoryDesc')}
        </p>
      </div>

      {progression && (
        <section style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 18, padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: 'var(--text3)', fontSize: 11, fontWeight: 800 }}>{t('rewards.xpLevel')}</div>
            <div style={{ fontSize: 26, fontWeight: 900 }}>Lv. {progression.level || 1}</div>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${progression.progressPercent || 0}%`, height: '100%', background: 'linear-gradient(90deg, var(--blue), var(--purple))', transition: 'width .4s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, color: 'var(--text3)', fontSize: 11 }}>
              <span>{(progression.xp || 0).toLocaleString()} XP</span>
              <span>{t('rewards.nextLevel')} {(progression.nextLevelXp || 120).toLocaleString()} XP</span>
            </div>
          </div>
          {progression.nextReward && (
            <div style={{ fontSize: 12, color: 'var(--text2)', flexShrink: 0 }}>
              {t('rewards.nextReward')}: <b style={{ color: 'var(--text)' }}>{t('rewards.level')} {progression.nextReward.level}</b>
            </div>
          )}
        </section>
      )}

      {/* Currently equipped strip */}
      {(equippedBadgeMeta || equippedTitleMeta) && (
        <div style={{
          background: 'var(--bg2)', border: '1px solid rgba(88,166,255,.3)', borderRadius: 14,
          padding: '12px 18px', marginBottom: 20,
          display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', flexShrink: 0 }}>{t('rewards.currentlyActive')}</span>
          {equippedBadgeMeta && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <span>{equippedBadgeMeta.icon}</span>
              <span style={{ color: 'var(--text)', fontWeight: 700 }}>{lang === 'ko' ? (equippedBadgeMeta.name_ko || equippedBadgeMeta.name) : equippedBadgeMeta.name}</span>
              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: 'rgba(88,166,255,.15)', color: 'var(--blue)', fontWeight: 800 }}>{t('rewards.badge')}</span>
            </span>
          )}
          {equippedTitleMeta && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <span>{equippedTitleMeta.icon}</span>
              <span style={{ color: 'var(--blue)', fontWeight: 800 }}>{lang === 'ko' ? (equippedTitleMeta.name_ko || equippedTitleMeta.name) : equippedTitleMeta.name}</span>
              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: 'rgba(167,139,250,.15)', color: 'var(--purple)', fontWeight: 800 }}>{t('rewards.title')}</span>
            </span>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div style={{
        background: 'var(--glass-bg)', border: '1px solid var(--border)', borderRadius: 16,
        padding: '20px 24px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 20,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
              {earnedCount} / {totalCount} {t('rewards.owned')}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{progressPct}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--bg3)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4,
              background: 'linear-gradient(90deg, var(--blue), var(--purple))',
              width: `${progressPct}%`, transition: 'width 0.6s ease',
            }} />
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--accent)' }}>{earnedCount}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{t('rewards.earnedSummary')}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 28 }}>
        {tabs.map(({ key, label, emoji }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            style={{
              padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
              border: activeTab === key ? '1.5px solid var(--blue)' : '1.5px solid var(--border)',
              background: activeTab === key ? 'rgba(88,166,255,.13)' : 'var(--bg2)',
              color: activeTab === key ? 'var(--blue)' : 'var(--text2)',
            }}
          >
            {emoji ? `${emoji} ${label}` : label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ color: 'var(--text3)', fontSize: 12, margin: '-14px 0 20px' }}>
        {formatMessage(t('rewards.showcaseLimit'), { count: showcasedBadges.length, limit: badgeShowcaseLimit })}
      </div>

      {activeTab === 'titles' ? (
        <Section
          title={t('rewards.titles')}
          emoji="🏷️"
          items={titles}
          equippedBadge={equippedBadge}
          equippedTitle={equippedTitle}
          showcasedCodes={showcasedCodes}
          onEquip={handleEquip}
          onToggleShowcase={handleToggleShowcase}
          stats={stats}
          accentColor="var(--purple)"
          lang={lang}
          t={t}
        />
      ) : orderedCategories.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text3)' }}>
          {t('rewards.noBadges')}
        </div>
      ) : (
        orderedCategories.map((cat) => {
          const meta = CATEGORY_LABELS[cat] || { ko: cat, label: cat, emoji: '🎯' };
          return (
            <Section
              key={cat}
              title={txt(meta.ko, meta.label)}
              emoji={meta.emoji}
              items={grouped[cat] || []}
              equippedBadge={equippedBadge}
              equippedTitle={equippedTitle}
              showcasedCodes={showcasedCodes}
              onEquip={handleEquip}
              onToggleShowcase={handleToggleShowcase}
              stats={stats}
              lang={lang}
              t={t}
            />
          );
        })
      )}
    </div>
  );
}
