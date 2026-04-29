import React from 'react';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext.jsx';

export default function MockAd({ position = 'sidebar' }) {
  const { t } = useLang();
  const { user } = useAuth();
  const { tier } = useSubscriptionStatus(user?.id);

  if (tier !== 'free') return null;

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
    }
  };

  const adContent = [
    { title: t('mockAdRemoveTitle'), desc: t('mockAdRemoveDesc') },
    { title: t('mockAdAiTitle'), desc: t('mockAdAiDesc') },
    { title: t('mockAdRankingTitle'), desc: t('mockAdRankingDesc') }
  ][Math.floor(Math.random() * 3)];

  if (position === 'bottom') {
    return (
      <div style={styles.bottom}>
        <div style={{ fontSize: 10, color: 'var(--text3)', position: 'absolute', top: 4, left: 8, textTransform: 'uppercase' }}>Sponsored</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 40, height: 40, background: 'var(--blue)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>⚡</div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{adContent.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{adContent.desc}</div>
          </div>
          <a href="/pricing" style={{
            padding: '6px 16px', borderRadius: 6, background: 'var(--bg3)', color: 'var(--blue)',
            fontSize: 12, fontWeight: 700, textDecoration: 'none', border: '1px solid var(--blue)40'
          }}>{t('upgrade')}</a>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.sidebar}>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Advertisement</div>
      <div style={{ width: 64, height: 64, background: 'var(--bg3)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 16, boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)' }}>💎</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{adContent.title}</div>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20, lineHeight: 1.5 }}>{adContent.desc}</div>
      <a href="/pricing" style={{ 
        width: '100%', padding: '10px 0', borderRadius: 8, background: 'var(--blue)', color: '#0d1117', 
        fontSize: 13, fontWeight: 800, textDecoration: 'none', transition: 'transform 0.2s'
      }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
        {t('mockAdBenefitsCta')}
      </a>
    </div>
  );
}
