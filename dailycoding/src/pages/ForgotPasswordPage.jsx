import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../context/LangContext.jsx';
import api from '../api.js';

const inputStyle = {
  width: '100%', padding: '11px 13px',
  background: 'var(--bg3)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text)', fontFamily: 'inherit',
  fontSize: 13, outline: 'none',
  transition: 'border-color .2s, box-shadow .2s',
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useLang();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
    } catch {}
    finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{
        width: 420, padding: '40px 36px',
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 14,
      }}>
        {/* 로고 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
          <span style={{ fontSize: 20 }}>⚡</span>
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.5 }}>DailyCoding</span>
        </div>

        {sent ? (
          /* 성공 메시지 */
          <div>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(86,211,100,.12)', border: '1px solid rgba(86,211,100,.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, marginBottom: 18,
            }}>✉️</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{t('checkEmail')}</h2>
            <p style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
              {t('checkEmailDesc')}
            </p>
            <button
              onClick={() => navigate('/')}
              style={{
                width: '100%', padding: '11px', borderRadius: 9, border: 'none',
                background: 'var(--blue)', color: 'var(--bg)',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {t('backToLogin')}
            </button>
          </div>
        ) : (
          /* 이메일 입력 폼 */
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>{t('resetPassword')}</h2>
              <p style={{ color: 'var(--text2)', fontSize: 13 }}>
                {t('resetPasswordDesc')}
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, display: 'block', marginBottom: 6 }}>{t('email')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  autoFocus
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'var(--blue)'; e.target.style.boxShadow = '0 0 0 3px rgba(121,192,255,.1)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                style={{
                  width: '100%', padding: '12px', borderRadius: 9, border: 'none',
                  background: 'var(--blue)', color: 'var(--bg)',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  opacity: (loading || !email) ? 0.6 : 1,
                  transition: 'opacity .2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  marginTop: 4,
                }}
              >
                {loading ? (
                  <>
                    <span style={{
                      width: 16, height: 16, borderRadius: '50%',
                      border: '2px solid rgba(0,0,0,.2)', borderTopColor: 'var(--bg)',
                      animation: '_spin .7s linear infinite', display: 'inline-block',
                    }} />
                    {t('sendingLink')}
                  </>
                ) : t('sendResetLink')}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text3)' }}>
              <button
                onClick={() => navigate('/')}
                style={{
                  background: 'none', border: 'none', color: 'var(--blue)',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}
              >
                {t('backToLogin')}
              </button>
            </p>
          </div>
        )}
      </div>
      <style>{`@keyframes _spin { to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
