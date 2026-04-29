import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext.jsx';
import api from '../api.js';

export default function EmailVerifyGate({ feature = '', children }) {
  const { user } = useAuth();
  const { t } = useLang();
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  // 인증된 유저 또는 OAuth 유저는 통과
  if (user?.emailVerified) return children;

  const featureLabel = feature || t('emailVerifyRequired');

  const handleResend = async () => {
    setLoading(true); setError('');
    try {
      await api.post('/auth/resend-verification');
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || t('sending'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: 'calc(100vh - 120px)', gap: 0,
      padding: '40px 24px',
    }}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid rgba(227,179,65,.3)',
        borderRadius: 16, padding: '48px 40px', maxWidth: 420, width: '100%',
        textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,.3)',
      }}>
        {/* 아이콘 */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(227,179,65,.1)', border: '1px solid rgba(227,179,65,.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, margin: '0 auto 24px',
        }}>📧</div>

        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10, color: 'var(--text)' }}>
          {t('emailVerifyRequired')}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 28 }}>
          <strong style={{ color: 'var(--yellow)' }}>{featureLabel}</strong>
        </p>

        {/* 제한 목록 */}
        <div style={{
          background: 'var(--bg3)', borderRadius: 10, padding: '14px 18px',
          marginBottom: 24, textAlign: 'left',
        }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>
            {t('afterVerification')}
          </div>
          {[t('emailVerifyFeatureAi'), t('emailVerifyFeatureContest'), t('emailVerifyFeatureBattle'), t('emailVerifyFeatureRanking')].map(item => (
            <div key={item} style={{ fontSize: 13, color: 'var(--text2)', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--green)', fontSize: 10 }}>●</span> {item}
            </div>
          ))}
        </div>

        {sent ? (
          <div style={{
            padding: '12px 16px', borderRadius: 9,
            background: 'rgba(86,211,100,.08)', border: '1px solid rgba(86,211,100,.2)',
            color: 'var(--green)', fontSize: 13, marginBottom: 12,
          }}>
            {t('emailResent')}
          </div>
        ) : (
          <>
            {error && (
              <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>{error}</div>
            )}
            <button
              onClick={handleResend}
              disabled={loading}
              style={{
                width: '100%', padding: '12px', borderRadius: 9, border: 'none',
                background: 'var(--yellow)', color: '#0d1117',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                opacity: loading ? 0.6 : 1, transition: 'opacity .2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginBottom: 10,
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid rgba(0,0,0,.2)', borderTopColor: '#0d1117',
                    animation: '_evg_spin .7s linear infinite', display: 'inline-block',
                  }}/>
                  {t('sending')}
                </>
              ) : t('resendEmailBtn')}
            </button>
          </>
        )}

        <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
          {t('noVerifyForProblems')}
        </p>
      </div>
      <style>{`@keyframes _evg_spin { to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
