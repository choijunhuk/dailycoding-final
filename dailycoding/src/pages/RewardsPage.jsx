import { useEffect, useMemo, useState } from 'react';
import api from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const RARITY_META = {
  common: { label: 'Common', color: '#94a3b8' },
  uncommon: { label: 'Uncommon', color: '#22c55e' },
  rare: { label: 'Rare', color: '#38bdf8' },
  epic: { label: 'Epic', color: '#a78bfa' },
  legendary: { label: 'Legendary', color: '#f59e0b' },
};

function RewardCard({ item, owned, equipped, onToggle }) {
  const rarity = RARITY_META[item.rarity] || RARITY_META.common;
  return (
    <button
      type="button"
      disabled={!owned}
      onClick={owned ? onToggle : undefined}
      title={item.description || item.name}
      style={{
        textAlign: 'left', border: `1px solid ${equipped ? rarity.color : 'var(--border)'}`,
        borderRadius: 18, padding: 16, minHeight: 136, cursor: owned ? 'pointer' : 'not-allowed',
        background: equipped ? `${rarity.color}18` : 'var(--bg2)', color: 'var(--text)',
        opacity: owned ? 1 : 0.35, filter: owned ? 'none' : 'grayscale(1)',
        boxShadow: equipped ? `0 0 0 3px ${rarity.color}22` : 'none',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: item.type === 'badge' ? 32 : 18, fontWeight: 900 }}>{item.icon || '칭호'}</span>
        {equipped && <span style={{ fontSize: 11, color: rarity.color, fontWeight: 900 }}>장착 중</span>}
      </div>
      <div>
        <div style={{ fontWeight: 900, fontSize: 15 }}>{item.name}</div>
        <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 5, lineHeight: 1.5 }}>{item.description}</div>
      </div>
      <div style={{ marginTop: 'auto', fontSize: 10, fontWeight: 900, color: rarity.color, letterSpacing: .5 }}>
        {rarity.label.toUpperCase()}
      </div>
    </button>
  );
}

export default function RewardsPage() {
  const { applyUser } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('badge');
  const [allRewards, setAllRewards] = useState([]);
  const [ownedRewards, setOwnedRewards] = useState([]);
  const [progression, setProgression] = useState(null);
  const [equippedBadge, setEquippedBadge] = useState(null);
  const [equippedTitle, setEquippedTitle] = useState(null);
  const [loading, setLoading] = useState(true);

  const ownedCodes = useMemo(() => new Set(ownedRewards.map((item) => item.code)), [ownedRewards]);
  const items = allRewards.filter((item) => item.type === tab);
  const nextReward = progression?.nextReward;

  const loadRewards = async () => {
    setLoading(true);
    try {
      const [mine, all] = await Promise.all([api.get('/rewards/my'), api.get('/rewards/all')]);
      setOwnedRewards(mine.data?.rewards || []);
      setProgression(mine.data?.progression || null);
      setEquippedBadge(mine.data?.equippedBadge || null);
      setEquippedTitle(mine.data?.equippedTitle || null);
      setAllRewards(all.data || []);
    } catch (err) {
      toast?.show(err.response?.data?.message || '보상 정보를 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRewards(); }, []);

  const toggleEquip = async (item) => {
    const current = item.type === 'badge' ? equippedBadge : equippedTitle;
    const code = current === item.code ? null : item.code;
    try {
      const { data } = await api.post('/rewards/equip', { type: item.type, code });
      if (item.type === 'badge') setEquippedBadge(code);
      else setEquippedTitle(code);
      if (data?.user) applyUser(data.user);
      toast?.show(code ? '보상을 장착했습니다.' : '장착을 해제했습니다.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || '보상 장착 실패', 'error');
    }
  };

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 20px 48px' }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 13, color: 'var(--blue)', fontWeight: 900, marginBottom: 8 }}>COLLECTION</div>
        <h1 style={{ margin: 0, fontSize: 34, letterSpacing: -1 }}>뱃지 & 칭호 보관함</h1>
        <p style={{ color: 'var(--text2)', marginTop: 10 }}>획득한 보상을 프로필에 장착하고 성장 기록을 보여주세요.</p>
      </div>

      <section style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 22, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ color: 'var(--text3)', fontSize: 12, fontWeight: 800 }}>XP LEVEL</div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>Lv. {progression?.level || 1}</div>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ height: 10, background: 'var(--bg3)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${progression?.progressPercent || 0}%`, height: '100%', background: 'linear-gradient(90deg, var(--blue), var(--purple))' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, color: 'var(--text3)', fontSize: 12 }}>
              <span>{(progression?.xp || 0).toLocaleString()} XP</span>
              <span>다음 레벨 {progression?.nextLevelXp?.toLocaleString?.() || 120} XP</span>
            </div>
          </div>
          <div style={{ minWidth: 170, color: 'var(--text2)', fontSize: 12 }}>
            다음 보상: <b style={{ color: 'var(--text)' }}>{nextReward ? `${nextReward.level}레벨` : '모두 획득'}</b>
          </div>
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {['badge', 'title'].map((type) => (
          <button key={type} onClick={() => setTab(type)} style={{
            border: '1px solid var(--border)', borderRadius: 999, padding: '9px 16px', cursor: 'pointer',
            background: tab === type ? 'var(--blue)' : 'var(--bg2)', color: tab === type ? '#fff' : 'var(--text2)', fontWeight: 900,
          }}>
            {type === 'badge' ? '뱃지' : '칭호'}
          </button>
        ))}
      </div>

      {loading ? <div className="skeleton-line" style={{ height: 240, borderRadius: 18 }} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
          {items.map((item) => (
            <RewardCard
              key={item.code}
              item={item}
              owned={ownedCodes.has(item.code)}
              equipped={(item.type === 'badge' ? equippedBadge : equippedTitle) === item.code}
              onToggle={() => toggleEquip(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
