import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLang } from '../context/LangContext.jsx';
import api from '../api.js';

const inputStyle = {
  width: '100%', padding: '11px 13px',
  background: 'var(--bg3)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text)', fontFamily: 'inherit',
  fontSize: 13, outline: 'none',
  transition: 'border-color .2s, box-shadow .2s',
};

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { t } = useLang();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => navigate('/'), 3000);
      return () => clearTimeout(timer);
    }
  }, [success, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError(t('passwordMinLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('passwordMismatch2'));
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || t('resetFailed'));
    } finally {
      setLoading(false);
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

        {success ? (
          /* 성공 메시지 */
          <div>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(86,211,100,.12)', border: '1px solid rgba(86,211,100,.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, marginBottom: 18,
            }}>✅</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{t('passwordChangedTitle')}</h2>
            <p style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
              {t('passwordChangedRedirect')}
            </p>
            <button
              onClick={() => navigate('/')}
              style={{
                width: '100%', padding: '11px', borderRadius: 9, border: 'none',
                background: 'var(--blue)', color: 'var(--bg)',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {t('goToLogin')}
            </button>
          </div>
        ) : (
          /* 비밀번호 재설정 폼 */
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>{t('setNewPassword')}</h2>
              <p style={{ color: 'var(--text2)', fontSize: 13 }}>
                {t('newPasswordDesc')}
              </p>
            </div>

            {!token && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 16,
                background: 'rgba(248,81,73,.08)', border: '1px solid rgba(248,81,73,.2)',
                color: 'var(--red)', fontSize: 13,
              }}>
                {t('invalidLink')}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, display: 'block', marginBottom: 6 }}>{t('newPassword')}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder={t('min8Chars')}
                    autoComplete="new-password"
                    autoFocus
                    style={{ ...inputStyle, paddingRight: 40 }}
                    onFocus={e => { e.target.style.borderColor = 'var(--blue)'; e.target.style.boxShadow = '0 0 0 3px rgba(121,192,255,.1)'; }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                  />
                  <button type="button" onClick={() => setShowPw(p => !p)} style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text3)',
                    cursor: 'pointer', fontSize: 14, lineHeight: 1,
                  }}>{showPw ? '🙈' : '👁'}</button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, display: 'block', marginBottom: 6 }}>{t('confirmPassword')}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPw ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder={t('reEnterPassword')}
                    autoComplete="new-password"
                    style={{ ...inputStyle, paddingRight: 40 }}
                    onFocus={e => { e.target.style.borderColor = 'var(--blue)'; e.target.style.boxShadow = '0 0 0 3px rgba(121,192,255,.1)'; }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                  />
                  <button type="button" onClick={() => setShowConfirmPw(p => !p)} style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text3)',
                    cursor: 'pointer', fontSize: 14, lineHeight: 1,
                  }}>{showConfirmPw ? '🙈' : '👁'}</button>
                </div>
              </div>

              {/* 비밀번호 일치 표시 */}
              {confirmPassword && (
                <div style={{ fontSize: 12, color: newPassword === confirmPassword ? 'var(--green)' : 'var(--red)' }}>
                  {newPassword === confirmPassword ? t('passwordsMatch') : t('passwordsNoMatch')}
                </div>
              )}

              {/* 에러 메시지 */}
              {error && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8,
                  background: 'rgba(248,81,73,.08)', border: '1px solid rgba(248,81,73,.2)',
                  color: 'var(--red)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span>⚠️</span> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !newPassword || !confirmPassword || !token}
                style={{
                  width: '100%', padding: '12px', borderRadius: 9, border: 'none',
                  background: 'var(--blue)', color: 'var(--bg)',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  opacity: (loading || !newPassword || !confirmPassword || !token) ? 0.6 : 1,
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
                    {t('changingPassword')}
                  </>
                ) : t('changePasswordBtn')}
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
