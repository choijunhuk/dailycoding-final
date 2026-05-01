import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLang } from '../context/LangContext.jsx';
import api from '../api.js';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { t } = useLang();

  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg(t('invalidLinkSimple'));
      return;
    }

    api.get('/auth/verify-email', { params: { token } })
      .then(() => {
        setStatus('success');
      })
      .catch(err => {
        setStatus('error');
        setErrorMsg(err.response?.data?.message || t('verifyFailedDefault'));
      });
  }, [token]);

  // 성공 시 3초 후 대시보드로 이동
  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => navigate('/'), 3000);
      return () => clearTimeout(timer);
    }
  }, [status, navigate]);

  const handleResend = async () => {
    setResendLoading(true);
    try {
      await api.post('/auth/resend-verification');
      setResendSent(true);
    } catch {
      // Keep resend failures silent so the user can retry without noisy errors.
    }
    finally {
      setResendLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{
        width: 420, padding: '40px 36px',
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 14, textAlign: 'center',
      }}>
        {/* 로고 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
          <span style={{ fontSize: 20 }}>⚡</span>
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.5 }}>DailyCoding</span>
        </div>

        {status === 'loading' && (
          <div>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              border: '3px solid rgba(121,192,255,.2)', borderTopColor: 'var(--blue)',
              animation: '_spin .8s linear infinite',
              margin: '0 auto 20px',
            }} />
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{t('verifyingEmail')}</h2>
            <p style={{ color: 'var(--text2)', fontSize: 13 }}>{t('pleaseWait')}</p>
          </div>
        )}

        {status === 'success' && (
          <div>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(86,211,100,.12)', border: '1px solid rgba(86,211,100,.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, margin: '0 auto 20px',
            }}>✅</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{t('verifySuccess')}</h2>
            <p style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.7, marginBottom: 28 }}>
              {t('verifySuccessDesc')}
            </p>
            <button
              onClick={() => navigate('/')}
              style={{
                width: '100%', padding: '12px', borderRadius: 9, border: 'none',
                background: 'var(--blue)', color: 'var(--bg)',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {t('goToDashboard')}
            </button>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(248,81,73,.08)', border: '1px solid rgba(248,81,73,.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, margin: '0 auto 20px',
            }}>❌</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{t('verifyFailed')}</h2>
            <p style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
              {errorMsg}
            </p>

            {resendSent ? (
              <div style={{
                padding: '12px 16px', borderRadius: 8,
                background: 'rgba(86,211,100,.08)', border: '1px solid rgba(86,211,100,.2)',
                color: 'var(--green)', fontSize: 13, marginBottom: 16,
              }}>
                {t('resendSuccess')}
              </div>
            ) : (
              <button
                onClick={handleResend}
                disabled={resendLoading}
                style={{
                  width: '100%', padding: '12px', borderRadius: 9, border: 'none',
                  background: 'var(--blue)', color: 'var(--bg)',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  opacity: resendLoading ? 0.6 : 1,
                  transition: 'opacity .2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  marginBottom: 12,
                }}
              >
                {resendLoading ? (
                  <>
                    <span style={{
                      width: 16, height: 16, borderRadius: '50%',
                      border: '2px solid rgba(0,0,0,.2)', borderTopColor: 'var(--bg)',
                      animation: '_spin .7s linear infinite', display: 'inline-block',
                    }} />
                    {t('sending')}
                  </>
                ) : t('resendRequest')}
              </button>
            )}

            <button
              onClick={() => navigate('/')}
              style={{
                width: '100%', padding: '11px', borderRadius: 9,
                border: '1px solid var(--border)',
                background: 'var(--bg3)', color: 'var(--text)',
                fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {t('backToLogin')}
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes _spin { to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
