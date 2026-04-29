import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api.js';
import { useLang } from '../context/LangContext.jsx';

export default function VerificationBanner() {
  const { t } = useLang();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  if (!user || user.emailVerified !== false || dismissed) return null;

  const handleResend = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/resend-verification');
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || t('sendFailedTryLater'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: 'rgba(227,179,65,.08)',
      border: 'none',
      borderBottom: '1px solid rgba(227,179,65,.25)',
      padding: '10px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 15 }}>📧</span>

      <span style={{ fontSize: 13, color: 'var(--yellow)', fontWeight: 500, flex: 1, minWidth: 200 }}>
        {t('verifyBannerMessage')}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {sent ? (
          <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
            {t('emailResent')}
          </span>
        ) : (
          <>
            {error && (
              <span style={{ fontSize: 12, color: 'var(--red)' }}>{error}</span>
            )}
            <button
              onClick={handleResend}
              disabled={loading}
              style={{
                padding: '5px 12px', borderRadius: 7,
                border: '1px solid rgba(227,179,65,.4)',
                background: 'rgba(227,179,65,.12)', color: 'var(--yellow)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                opacity: loading ? 0.6 : 1,
                transition: 'opacity .2s, background .2s',
                display: 'flex', alignItems: 'center', gap: 6,
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'rgba(227,179,65,.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(227,179,65,.12)'; }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: 12, height: 12, borderRadius: '50%',
                    border: '2px solid rgba(227,179,65,.3)', borderTopColor: 'var(--yellow)',
                    animation: '_vb_spin .7s linear infinite', display: 'inline-block',
                  }} />
                  {t('sending')}
                </>
              ) : t('resendEmailBtn')}
            </button>
          </>
        )}

        <button
          onClick={() => setDismissed(true)}
          style={{
            background: 'none', border: 'none',
            color: 'var(--text3)', cursor: 'pointer',
            fontSize: 16, lineHeight: 1, padding: '2px 4px',
            display: 'flex', alignItems: 'center',
          }}
          title={t('close')}
        >
          ×
        </button>
      </div>

      <style>{`@keyframes _vb_spin { to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
