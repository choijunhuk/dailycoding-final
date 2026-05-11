import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import ProfileAvatar from './ProfileAvatar.jsx';

const TAB_TYPES = ['followers', 'following'];

export default function FollowListModal({ userId, initialType = 'followers', open, onClose }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, lang } = useLang();
  const [activeType, setActiveType] = useState(initialType);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (open) setActiveType(initialType);
  }, [initialType, open]);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    async function loadList() {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get(`/follows/${userId}/${activeType}`, {
          params: { limit: 50 },
        });
        if (cancelled) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setTotal(Number(data?.total || 0));
      } catch (err) {
        if (cancelled) return;
        setItems([]);
        setTotal(0);
        setError(err.response?.data?.message || (lang === 'ko' ? '목록을 불러오지 못했습니다.' : 'Failed to load the list.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadList();
    return () => { cancelled = true; };
  }, [activeType, lang, open, userId]);

  if (!open) return null;

  const title = activeType === 'followers' ? t('followers') : t('following');
  const emptyText = activeType === 'followers'
    ? (lang === 'ko' ? '아직 팔로워가 없습니다.' : 'No followers yet.')
    : (lang === 'ko' ? '아직 팔로잉한 사용자가 없습니다.' : 'Not following anyone yet.');

  const goProfile = (targetId) => {
    onClose?.();
    navigate(Number(targetId) === Number(user?.id) ? '/profile' : `/user/${targetId}`);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,.56)',
        display: 'grid',
        placeItems: 'center',
        padding: 18,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(100%, 520px)',
          maxHeight: 'min(720px, calc(100vh - 36px))',
          display: 'grid',
          gridTemplateRows: 'auto auto minmax(0, 1fr)',
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          boxShadow: '0 24px 80px rgba(0,0,0,.42)',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 18px 12px' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 850, color: 'var(--text)' }}>{title}</div>
            <div style={{ marginTop: 3, fontSize: 12, color: 'var(--text3)' }}>
              {total.toLocaleString()} {lang === 'ko' ? '명' : 'users'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={lang === 'ko' ? '닫기' : 'Close'}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--bg3)',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: 20,
              lineHeight: 1,
            }}
          >
            x
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, padding: '0 18px 14px' }}>
          {TAB_TYPES.map((type) => {
            const isActive = activeType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setActiveType(type)}
                style={{
                  border: `1px solid ${isActive ? 'rgba(121,192,255,.55)' : 'var(--border)'}`,
                  background: isActive ? 'rgba(121,192,255,.14)' : 'var(--bg3)',
                  color: isActive ? 'var(--blue)' : 'var(--text2)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {type === 'followers' ? t('followers') : t('following')}
              </button>
            );
          })}
        </div>

        <div style={{ overflow: 'auto', padding: '0 18px 18px', display: 'grid', gap: 10 }}>
          {loading ? (
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: '20px 0' }}>
              {lang === 'ko' ? '불러오는 중...' : 'Loading...'}
            </div>
          ) : error ? (
            <div style={{ color: 'var(--red)', fontSize: 13, padding: '20px 0' }}>{error}</div>
          ) : items.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: '20px 0' }}>{emptyText}</div>
          ) : items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => goProfile(item.id)}
              style={{
                display: 'grid',
                gridTemplateColumns: '48px minmax(0, 1fr) auto',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                border: '1px solid var(--border)',
                borderRadius: 14,
                background: 'var(--bg3)',
                color: 'inherit',
                padding: 12,
                textAlign: 'left',
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              <ProfileAvatar profile={item} size={48} fontSize={item.avatar_emoji ? 22 : 15} />
              <div style={{ minWidth: 0 }}>
                <div style={{ color: 'var(--text)', fontWeight: 850, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.displayName || item.nickname || item.username}
                </div>
                <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  @{item.username}
                </div>
              </div>
              <div style={{ display: 'grid', justifyItems: 'end', gap: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 999, padding: '4px 8px', background: 'var(--bg)' }}>
                  {String(item.tier || 'unranked').toUpperCase()}
                </span>
                {item.isFollowing && Number(item.id) !== Number(user?.id) ? (
                  <span style={{ fontSize: 10, color: 'var(--blue)', fontWeight: 800 }}>
                    {lang === 'ko' ? '팔로잉' : 'Following'}
                  </span>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
