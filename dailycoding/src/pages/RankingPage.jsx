import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api.js';
import { useRankingData } from '../hooks/useRankingData.js';
import { getTierImageUrl, getTierGlowStyle } from '../utils/tierImage.js';
import { useLang } from '../context/LangContext.jsx';
import { TIER_THRESHOLDS, TIER_ORDER } from '../data/constants.js';

const TIER_META = {
  unranked:    { color:'#888888', bg:'rgba(136,136,136,.12)', label:'Unranked'    },
  iron:        { color:'#a8a8a8', bg:'rgba(168,168,168,.12)', label:'Iron'        },
  bronze:      { color:'#cd7f32', bg:'rgba(205,127,50,.12)',  label:'Bronze'      },
  silver:      { color:'#c0c0c0', bg:'rgba(192,192,192,.12)', label:'Silver'      },
  gold:        { color:'#ffd700', bg:'rgba(255,215,0,.12)',   label:'Gold'        },
  platinum:    { color:'#00e5cc', bg:'rgba(0,229,204,.12)',   label:'Platinum'    },
  emerald:     { color:'#00d18f', bg:'rgba(0,209,143,.12)',   label:'Emerald'     },
  diamond:     { color:'#b9f2ff', bg:'rgba(185,242,255,.12)', label:'Diamond'     },
  master:      { color:'#9b59b6', bg:'rgba(155,89,182,.12)',  label:'Master'      },
  grandmaster: { color:'#e74c3c', bg:'rgba(231,76,60,.12)',   label:'Grandmaster' },
  challenger:  { color:'#f1c40f', bg:'rgba(241,196,15,.12)',  label:'Challenger'  },
};

// Derived tier ranges from shared constants — single source of truth
const TIER_RANGES = TIER_ORDER
  .filter(t => t !== 'unranked')
  .map((key, i, arr) => {
    const min = TIER_THRESHOLDS[key];
    const nextKey = arr[i + 1];
    return { key, min, max: nextKey ? TIER_THRESHOLDS[nextKey] - 1 : Infinity };
  });

function getTierProgress(rating) {
  for (let i = TIER_RANGES.length - 1; i >= 0; i--) {
    if (rating >= TIER_RANGES[i].min) {
      const t    = TIER_RANGES[i];
      const next = TIER_RANGES[i + 1];
      if (!next) return { pct: 100, nextTier: null, nextRating: null };
      const range = next.min - t.min;
      const pct   = Math.min(100, Math.round(((rating - t.min) / range) * 100));
      return { pct, nextTier: next.key, nextRating: next.min };
    }
  }
  // 아직 bronze 미달 (unranked)
  const bronze = TIER_RANGES[0];
  return { pct: Math.min(100, Math.round((rating / bronze.min) * 100)), nextTier: 'bronze', nextRating: bronze.min };
}

const MEDALS = ['🥇','🥈','🥉'];

// ─── sub-components ──────────────────────────────────────────────────────────

function Avatar({ name, tier, size = 38, radius = '50%' }) {
  const tm = TIER_META[tier] || TIER_META.unranked;
  return (
    <div style={{
      width: size, height: size, borderRadius: radius,
      background: `radial-gradient(circle at 30% 30%, ${tm.color}40, ${tm.bg})`,
      border: `2px solid ${tm.color}80`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.29), fontWeight: 800, color: tm.color,
      flexShrink: 0, letterSpacing: 0.5,
      boxShadow: `0 0 8px ${tm.color}30`,
    }}>
      {(name || '??').slice(0, 2).toUpperCase()}
    </div>
  );
}

function TierBadge({ tier }) {
  const tm = TIER_META[tier] || TIER_META.unranked;
  const glow = getTierGlowStyle(tier);
  return (
    <span style={{
      padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700,
      background: tm.bg, color: tm.color, border: `1px solid ${tm.color}50`,
      whiteSpace: 'nowrap', display:'inline-flex', alignItems:'center', gap:6,
      ...glow,
    }}>
      <img src={getTierImageUrl(tier)} alt={tier} style={{ width:18, height:18, objectFit:'contain' }} />
      {tm.label}
    </span>
  );
}

const MAX_RATING = 16500;

function RatingBar({ rating, width = 80 }) {
  const barW = Math.min(width, (rating / MAX_RATING) * width);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        fontFamily: 'Space Mono, monospace', fontSize: 13, fontWeight: 700,
        color: 'var(--yellow)',
      }}>
        {(rating || 0).toLocaleString()}
      </span>
      <div style={{
        width, height: 4, borderRadius: 2, background: 'var(--bg3)',
        overflow: 'hidden', flexShrink: 0,
      }}>
        <div style={{
          width: barW, height: '100%',
          background: 'linear-gradient(90deg, #f59e0b, #fde68a)',
          borderRadius: 2,
        }} />
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function RankingPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { t, lang } = useLang();
  const [mode,         setMode]         = useState('global');
  const [page,         setPage]         = useState(1);
  const [search,       setSearch]       = useState('');
  const [tierFilter,   setTierFilter]   = useState('all');
  const [sortBy,       setSortBy]       = useState('rating');
  const [seasonPayload, setSeasonPayload] = useState({ season: null, remainingDays: null, items: [] });
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [seasonError, setSeasonError] = useState(null);
  const [followingSet, setFollowingSet] = useState(new Set());
  const [followPending, setFollowPending] = useState(new Set());
  const limit = 20;
  const { rankingData, pagination, loading, error, refreshRankingData } = useRankingData({ page, limit, tier: tierFilter, sort: sortBy });
  const seasonRankers = (seasonPayload.items || []).map((item) => ({
    id: item.id,
    username: item.username,
    name: item.username,
    tier: item.tier,
    rating: item.seasonRating,
    solved_count: item.solvedCount,
    solved: item.solvedCount,
    avatarEmoji: item.avatarEmoji,
    rank: item.rank,
    battleWins: item.battleWins,
  }));
  const rankers = mode === 'season'
    ? seasonRankers
    : rankingData.map((u) => ({ ...u, name: u.username || u.name }));

  useEffect(() => {
    if (!user) return;
    api.get('/follows/my').then(r => {
      setFollowingSet(new Set(r.data));
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (mode !== 'season') return;
    let cancelled = false;
    setSeasonLoading(true);
    setSeasonError(null);
    api.get('/ranking/season')
      .then(({ data }) => {
        if (!cancelled) setSeasonPayload(data || { season: null, remainingDays: null, items: [] });
      })
      .catch((seasonFetchError) => {
        if (!cancelled) {
          setSeasonPayload({ season: null, remainingDays: null, items: [] });
          setSeasonError(seasonFetchError);
        }
      })
      .finally(() => {
        if (!cancelled) setSeasonLoading(false);
      });
    return () => { cancelled = true; };
  }, [mode]);

  const toggleFollow = useCallback(async (targetId) => {
    if (!user) return toast?.show(t('rankingLoginRequired'), 'warning');
    if (followPending.has(targetId)) return;
    setFollowPending(p => new Set(p).add(targetId));
    const isFollowing = followingSet.has(targetId);
    try {
      if (isFollowing) {
        await api.delete(`/follows/${targetId}`);
        setFollowingSet(p => { const s = new Set(p); s.delete(targetId); return s; });
        toast?.show(t('rankingUnfollowed'), 'info');
      } else {
        await api.post(`/follows/${targetId}`);
        setFollowingSet(p => new Set(p).add(targetId));
        toast?.show(t('rankingFollowed'), 'success');
      }
    } catch {
      toast?.show(t('rankingGenericError'), 'error');
    } finally {
      setFollowPending(p => { const s = new Set(p); s.delete(targetId); return s; });
    }
  }, [user, followingSet, followPending, toast]);

  const filtered = rankers.filter(r =>
    (r.name || '').toLowerCase().includes(search.toLowerCase())
  );
  const top3   = filtered.slice(0, 3);
  const myRank = mode === 'season'
    ? ((rankers.findIndex(r => r.id === user?.id) + 1) || null)
    : (pagination.myRank || (rankers.findIndex(r => r.id === user?.id) + 1) || null);
  const myData = rankers.find(r => r.id === user?.id);
  const myProgress = myData ? getTierProgress(myData.rating || 0) : null;
  const myPage = myRank ? Math.ceil(myRank / limit) : null;
  const pageNumbers = Array.from({ length: Math.min(5, pagination.totalPages || 1) }, (_, index) => {
    const start = Math.max(1, Math.min((pagination.totalPages || 1) - 4, page - 2));
    return start + index;
  }).filter((value, index, arr) => value >= 1 && value <= (pagination.totalPages || 1) && arr.indexOf(value) === index);

  return (
    <div style={{ padding: '28px 28px 48px', overflowY: 'auto', height: '100%', maxWidth: 980, margin: '0 auto' }}>

      {/* ── HEADER ── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4, letterSpacing: -0.5 }}>
          🏆 {t('ranking')}
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: 13, margin: 0 }}>
          {mode === 'season'
            ? (seasonLoading ? '...' : t('rankingSeasonSummary').replace('{season}', seasonPayload.season || t('rankingThisSeason')).replace('{count}', rankers.length.toLocaleString()))
            : (loading ? '...' : t('rankingGlobalSummary').replace('{count}', rankers.length.toLocaleString()))}
        </p>
        <div style={{ display:'flex', gap:8, marginTop:12, alignItems:'center', flexWrap:'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setMode('global')} style={{ opacity: mode === 'global' ? 1 : 0.6 }}>
            {t('rankingGlobalMode')}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setMode('season')} style={{ opacity: mode === 'season' ? 1 : 0.6 }}>
            {t('rankingSeasonMode')}
          </button>
          {mode === 'season' && seasonPayload.remainingDays != null && (
            <span style={{ fontSize:12, color:'var(--text3)' }}>
              {t('rankingSeasonEndsIn').replace('{n}', String(seasonPayload.remainingDays))}
            </span>
          )}
        </div>
      </div>

      {/* ── MY RANK CARD ── */}
      {myData && myProgress && (
        <div style={{
          background: `linear-gradient(135deg, ${TIER_META[myData.tier]?.bg || 'var(--bg3)'}, var(--bg2))`,
          border: `1px solid ${TIER_META[myData.tier]?.color || 'var(--border)'}50`,
          borderRadius: 16, padding: '20px 24px', marginBottom: 24,
          boxShadow: `0 4px 24px ${TIER_META[myData.tier]?.color || '#0000'}18`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
            {/* left: avatar + name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Avatar name={myData.name} tier={myData.tier} size={56} radius={14} />
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>{t('rankingMyCurrentRank')}</div>
                <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 2 }}>
                  {myData.name}
                  <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400, marginLeft: 6 }}>({t('rankingMe')})</span>
                </div>
                <TierBadge tier={myData.tier} />
              </div>
            </div>

            {/* right: stats */}
            <div style={{ display: 'flex', gap: 32 }}>
              {[
                { v: `#${myRank}`, l: t('rankingRankLabel'),   c: 'var(--blue)'   },
                { v: myData?.rating?.toLocaleString() || '-', l: t('rating'), c: 'var(--yellow)' },
                { v: myData?.solved || '-',  l: t('solved'),   c: 'var(--green)'  },
                { v: t('rankingStreakDays').replace('{n}', String(myData?.streak || 0)), l: t('streak'), c: 'var(--orange)' },
              ].map(s => (
                <div key={s.l} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 20, fontWeight: 700, color: s.c }}>
                    {s.v}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* rating progress bar */}
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 11, color: 'var(--text3)' }}>
              <span style={{ color: TIER_META[myData.tier]?.color, fontWeight: 700 }}>
                {TIER_META[myData.tier]?.label}
              </span>
              {myProgress.nextTier ? (
                <span>
                  {myData.rating} / {myProgress.nextRating} →&nbsp;
                  <span style={{ color: TIER_META[myProgress.nextTier]?.color, fontWeight: 700 }}>
                    {TIER_META[myProgress.nextTier]?.label}
                  </span>
                </span>
              ) : (
                <span style={{ color: TIER_META.challenger.color, fontWeight: 700 }}>{t('rankingHighestTier')}</span>
              )}
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--bg3)', overflow: 'hidden' }}>
              <div style={{
                width: `${myProgress.pct}%`, height: '100%', borderRadius: 3,
                background: `linear-gradient(90deg, ${TIER_META[myData.tier]?.color}90, ${TIER_META[myData.tier]?.color})`,
                transition: 'width .6s ease',
              }} />
            </div>
            <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
              {myProgress.pct}%
            </div>
          </div>
        </div>
      )}

      {(mode === 'global' ? error : seasonError) && (
        <div style={{
          marginBottom: 20,
          background: 'rgba(248,81,73,.08)',
          border: '1px solid rgba(248,81,73,.2)',
          color: 'var(--text)',
          borderRadius: 14,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>{t('rankingLoadFailedTitle')}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              {rankers.length > 0 ? t('rankingShowingCached') : t('rankingRetryLater')}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => {
            if (mode === 'global') refreshRankingData();
            else setMode('season');
          }}>
            {t('tryAgain')}
          </button>
        </div>
      )}

      {/* ── FILTER BAR ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        {/* search */}
        <div style={{
          flex: 1, minWidth: 200,
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '9px 14px', display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <span style={{ fontSize: 14 }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('rankingSearchPlaceholder')}
            style={{
              background: 'none', border: 'none', outline: 'none',
              color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', width: '100%',
            }}
          />
        </div>

        {mode === 'global' && (
          <select
            value={tierFilter}
            onChange={(e) => {
              setTierFilter(e.target.value)
              setPage(1)
            }}
            style={{
              padding: '9px 14px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--bg2)',
              color: 'var(--text)',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          >
            <option value="all">{t('rankingAllTiers')}</option>
            {Object.entries(TIER_META).map(([key, value]) => (
              <option key={key} value={key}>{value.label}</option>
            ))}
          </select>
        )}

        {mode === 'global' && (
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value)
              setPage(1)
            }}
            style={{
              padding: '9px 14px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--bg2)',
              color: 'var(--text)',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          >
            <option value="rating">{t('rankingSortByRating')}</option>
            <option value="solved_count">{t('rankingSortBySolved')}</option>
          </select>
        )}

        {mode === 'global' && myPage ? (
          <button
            onClick={() => setPage(myPage)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: '1px solid var(--border)',
              background: 'var(--bg2)',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'inherit',
            }}
          >
            {t('rankingGoToMine')}
          </button>
        ) : null}
      </div>

      {/* ── LOADING ── */}
      {(mode === 'global' ? loading : seasonLoading) && (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text3)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
          <div style={{ fontSize: 14 }}>{t('rankingLoading')}</div>
        </div>
      )}

      {/* ── TOP 3 PODIUM ── */}
      {!(mode === 'global' ? loading : seasonLoading) && (mode === 'season' || page === 1) && top3.length >= 3 && (mode === 'season' || (tierFilter === 'all' && sortBy === 'rating')) && !search && (
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '32px 24px 0', marginBottom: 16, overflow: 'hidden',
        }}>
          <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 20 }}>
            {t('rankingTopPlayers')}
          </div>
          {/* podium order: 2nd left, 1st center, 3rd right */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12 }}>
            {[top3[1], top3[0], top3[2]].map((r, idx) => {
              const realIdx = idx === 0 ? 1 : idx === 1 ? 0 : 2;
              // heights: 2nd=90px, 1st=130px, 3rd=70px
              const podiumHeights = [90, 130, 70];
              const h = podiumHeights[idx];
              const tm = TIER_META[r?.tier] || TIER_META.bronze;
              if (!r) return null;
              return (
                <div key={r.rank || realIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: idx === 1 ? '0 0 160px' : '0 0 130px' }}>
                  {/* medal */}
                  <div style={{ fontSize: 28, lineHeight: 1 }}>{MEDALS[realIdx]}</div>

                  {/* circular avatar with tier gradient border */}
                  <div style={{
                    width: idx === 1 ? 64 : 52,
                    height: idx === 1 ? 64 : 52,
                    borderRadius: '50%',
                    background: `radial-gradient(circle at 30% 30%, ${tm.color}50, ${tm.bg})`,
                    border: `3px solid ${tm.color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: idx === 1 ? 16 : 13, fontWeight: 800, color: tm.color,
                    boxShadow: `0 4px 16px ${tm.color}50`,
                  }}>
                    {(r.name || '??').slice(0, 2).toUpperCase()}
                  </div>

                  {/* name */}
                  <div style={{ fontWeight: 700, fontSize: idx === 1 ? 14 : 12, textAlign: 'center', color: 'var(--text)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.name}
                  </div>

                  {/* tier badge */}
                  <TierBadge tier={r.tier} />

                  {/* rating */}
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--yellow)', fontWeight: 700 }}>
                    {t('rankingPoints').replace('{n}', (r.rating || 0).toLocaleString())}
                  </div>

                  {/* solved */}
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    <span style={{ color: 'var(--green)', fontWeight: 700 }}>{r.solved || 0}</span> {t('solved')}
                  </div>

                  {/* podium block */}
                  <div style={{
                    width: '100%', height: h,
                    background: `linear-gradient(180deg, ${tm.color}25, ${tm.color}10)`,
                    border: `1px solid ${tm.color}40`,
                    borderBottom: 'none',
                    borderRadius: '10px 10px 0 0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: idx === 1 ? 26 : 20, fontWeight: 800, color: `${tm.color}cc`,
                  }}>
                    #{realIdx + 1}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── RANKING TABLE ── */}
      {!(mode === 'global' ? loading : seasonLoading) && (
        <div>
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 16, overflow: 'hidden',
          }}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 700 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '56px 1fr 160px 100px 70px 80px 80px',
                padding: '10px 20px',
                borderBottom: '1px solid var(--border)',
                fontSize: 10, fontWeight: 700, color: 'var(--text3)',
                textTransform: 'uppercase', letterSpacing: 0.8,
              }}>
                <span>{t('rankingRankLabel')}</span>
                <span>{t('rankingPlayerLabel')}</span>
                <span>{t('rating')}</span>
                <span style={{ textAlign: 'center' }}>{t('tier')}</span>
                <span style={{ textAlign: 'center' }}>{t('solved')}</span>
                <span style={{ textAlign: 'center' }}>{t('streak')}</span>
                <span style={{ textAlign: 'center' }}>{t('follow')}</span>
              </div>

              {filtered.length === 0 && (
                <div style={{ padding: '64px 0', textAlign: 'center', color: 'var(--text3)' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>{error ? '⚠️' : '🔍'}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                    {error ? t('rankingNoDataTitle') : t('noResults')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {error ? t('rankingNoDataErrorDesc') : t('rankingNoDataSearchDesc')}
                  </div>
                </div>
              )}

              {filtered.map((r, i) => {
                const isMe = r.id === user?.id;
                const tm   = TIER_META[r.tier] || TIER_META.bronze;
                const showMedal = i < 3 && !search && (mode === 'season' || (tierFilter === 'all' && sortBy === 'rating'));
                return (
                  <div
                    key={r.rank || i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '56px 1fr 160px 100px 70px 80px 80px',
                      padding: '12px 20px', alignItems: 'center',
                      borderBottom: '1px solid var(--border)',
                      background: isMe ? `${tm.color}09` : 'transparent',
                      borderLeft: isMe ? `3px solid ${tm.color}` : '3px solid transparent',
                      transition: 'background .15s',
                      cursor: 'default',
                    }}
                    onMouseEnter={e => { if (!isMe) e.currentTarget.style.background = 'var(--bg3)'; }}
                    onMouseLeave={e => { if (!isMe) e.currentTarget.style.background = 'transparent'; }}
                  >
                {/* rank */}
                <div style={{
                  fontFamily: 'Space Mono, monospace',
                  fontSize: showMedal ? 22 : 13,
                  fontWeight: 700,
                  color: 'var(--text3)',
                  lineHeight: 1,
                }}>
                  {showMedal ? MEDALS[i] : `#${r.rank || i + 1}`}
                </div>

                {/* player */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={r.name} tier={r.tier} size={38} radius="50%" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: isMe ? tm.color : 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      {r.name}
                      {isMe && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                          background: `${tm.color}20`, color: tm.color, border: `1px solid ${tm.color}40`,
                        }}>{t('rankingMe')}</span>
                      )}
                    </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                    {mode === 'season'
                      ? t('rankingSeasonWinsScore').replace('{wins}', String(r.battleWins || 0)).replace('{score}', (r.rating || 0).toLocaleString())
                      : (r.joinDate ? t('rankingJoinedOn').replace('{date}', new Date(r.joinDate).toLocaleDateString(locale)) : '')}
                  </div>
                  </div>
                </div>

                {/* rating with mini bar */}
                <div>
                  <RatingBar rating={r.rating || 0} width={80} />
                </div>

                {/* tier badge */}
                <div style={{ textAlign: 'center' }}>
                  <TierBadge tier={r.tier} />
                </div>

                {/* solved */}
                <div style={{
                  textAlign: 'center',
                  fontFamily: 'Space Mono, monospace',
                  fontSize: 13, fontWeight: 700, color: 'var(--green)',
                }}>
                  {r.solved || 0}
                </div>

                {/* streak */}
                <div style={{
                  textAlign: 'center',
                  fontFamily: 'Space Mono, monospace',
                  fontSize: 12, color: 'var(--orange)', fontWeight: 700,
                }}>
                  {mode === 'season' ? `⚔️${r.battleWins || 0}` : `🔥${r.streak || 0}`}
                </div>

                {/* follow button */}
                <div style={{ textAlign: 'center' }}>
                  {!isMe && (
                    <button
                      onClick={() => toggleFollow(r.id)}
                      disabled={followPending.has(r.id)}
                      style={{
                        padding: '4px 12px', borderRadius: 20, border: 'none',
                        cursor: followPending.has(r.id) ? 'default' : 'pointer',
                        fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
                        transition: 'all .15s',
                        background: followingSet.has(r.id) ? 'var(--bg3)' : 'var(--blue)',
                        color: followingSet.has(r.id) ? 'var(--text2)' : '#0d1117',
                        outline: followingSet.has(r.id) ? '1px solid var(--border)' : 'none',
                        opacity: followPending.has(r.id) ? 0.5 : 1,
                      }}
                    >
                      {followPending.has(r.id) ? '...' : followingSet.has(r.id) ? t('rankingFollowing') : `+ ${t('follow')}`}
                    </button>
                  )}
                </div>
                  </div>
                );
              })}
            </div>
          </div>
          </div>
          {mode === 'global' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                {t('rankingPageSummary').replace('{page}', String(pagination.page)).replace('{totalPages}', String(pagination.totalPages)).replace('{total}', pagination.total.toLocaleString())}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                  style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.45 : 1 }}
                >
                  {t('prev')}
                </button>
                {pageNumbers.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    onClick={() => setPage(pageNumber)}
                    style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: pageNumber === page ? 'var(--blue)' : 'var(--bg2)', color: pageNumber === page ? '#0d1117' : 'var(--text)', cursor: 'pointer', fontWeight: 700 }}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  onClick={() => setPage((current) => Math.min(pagination.totalPages || 1, current + 1))}
                  disabled={page >= (pagination.totalPages || 1)}
                  style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', cursor: page >= (pagination.totalPages || 1) ? 'default' : 'pointer', opacity: page >= (pagination.totalPages || 1) ? 0.45 : 1 }}
                >
                  {t('next')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
  const locale = lang === 'ko' ? 'ko-KR' : 'en-US';
