import { useEffect, useMemo, useRef, useState } from 'react';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext.jsx';

export default function ProBenefitsSlot({ position = 'sidebar', onSkip }) {
  const { t } = useLang();
  const { user } = useAuth();
  const { tier, loading } = useSubscriptionStatus(user?.id);
  const [skipCountdown, setSkipCountdown] = useState(5);
  const [skipped, setSkipped] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (position !== 'video' || loading || tier !== 'free') return;
    timerRef.current = setInterval(() => {
      setSkipCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [position, loading, tier]);

  const adContent = useMemo(() => [
    { title: t('proBenefitsRemoveTitle'), desc: t('proBenefitsRemoveDesc') },
    { title: t('proBenefitsAiTitle'), desc: t('proBenefitsAiDesc') },
    { title: t('proBenefitsRankingTitle'), desc: t('proBenefitsRankingDesc') },
  ][Math.floor(Math.random() * 3)], [t]);

  if (loading || tier !== 'free') return null;
  if (skipped) return null;

  const styles = {
    sidebar: {
      width: '100%',
      minHeight: 250,
      background: 'var(--bg2)',
      border: '1px dashed var(--border)',
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      margin: '20px 0',
      textAlign: 'center',
    },
    bottom: {
      width: '100%',
      height: 90,
      background: 'rgba(121, 192, 255, 0.05)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 20px',
      position: 'relative',
    },
  };

  if (position === 'video') {
    const handleSkip = () => {
      setSkipped(true);
      onSkip?.();
    };
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,.85)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 720 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            {t('proBenefitsLabel')}
          </div>
          <div style={{
            minHeight: 320,
            borderRadius: 12,
            overflow: 'hidden',
            background: 'linear-gradient(135deg, rgba(121,192,255,.18), rgba(188,140,255,.14))',
            border: '1px solid rgba(255,255,255,.16)',
            display: 'grid',
            placeItems: 'center',
            padding: 28,
            textAlign: 'center',
          }}>
            <div>
              <div style={{ fontSize: 42, marginBottom: 14 }}>⚡</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 8 }}>{adContent.title}</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,.72)', maxWidth: 460, lineHeight: 1.6 }}>{adContent.desc}</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 12 }}>
            <a href="/pricing" style={{
              padding: '8px 18px', borderRadius: 8, background: 'var(--blue)', color: '#0d1117',
              fontSize: 13, fontWeight: 800, textDecoration: 'none',
            }}>
              {t('proBenefitsCta')}
            </a>
            <button
              onClick={skipCountdown === 0 ? handleSkip : undefined}
              disabled={skipCountdown > 0}
              style={{
                padding: '8px 18px', borderRadius: 8,
                background: skipCountdown === 0 ? 'var(--bg2)' : 'rgba(255,255,255,.1)',
                border: '1px solid rgba(255,255,255,.2)',
                color: skipCountdown === 0 ? 'var(--text)' : 'rgba(255,255,255,.5)',
                fontSize: 13, fontWeight: 700, cursor: skipCountdown === 0 ? 'pointer' : 'not-allowed',
                transition: 'all .2s',
              }}
            >
              {skipCountdown > 0
                ? t('proBenefitsSkipCountdown').replace('{seconds}', skipCountdown)
                : t('proBenefitsSkip')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (position === 'bottom') {
    return (
      <div style={styles.bottom}>
        <div style={{ fontSize: 10, color: 'var(--text3)', position: 'absolute', top: 4, left: 8, textTransform: 'uppercase' }}>{t('proBenefitsLabel')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 40, height: 40, background: 'var(--blue)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>⚡</div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{adContent.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{adContent.desc}</div>
          </div>
          <a href="/pricing" style={{
            padding: '6px 16px', borderRadius: 6, background: 'var(--bg3)', color: 'var(--blue)',
            fontSize: 12, fontWeight: 700, textDecoration: 'none', border: '1px solid var(--blue)40',
          }}>{t('upgrade')}</a>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.sidebar}>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>{t('proBenefitsLabel')}</div>
      <div style={{ width: 64, height: 64, background: 'var(--bg3)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 16, boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)' }}>💎</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{adContent.title}</div>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20, lineHeight: 1.5 }}>{adContent.desc}</div>
      <a href="/pricing" style={{
        width: '100%', padding: '10px 0', borderRadius: 8, background: 'var(--blue)', color: '#0d1117',
        fontSize: 13, fontWeight: 800, textDecoration: 'none', transition: 'transform 0.2s',
      }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
        {t('proBenefitsCta')}
      </a>
    </div>
  );
}
