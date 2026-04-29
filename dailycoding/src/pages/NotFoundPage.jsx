import { useNavigate } from 'react-router-dom';
import { useLang } from '../context/LangContext.jsx';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { t } = useLang();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', gap: 20, padding: 40,
      textAlign: 'center',
    }}>
      <div style={{
        fontFamily: 'Space Mono, monospace', fontSize: 96, fontWeight: 700,
        lineHeight: 1, color: 'var(--border2)',
        letterSpacing: -4, userSelect: 'none',
      }}>404</div>

      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '10px 18px',
        fontFamily: 'Space Mono, monospace', fontSize: 13, color: 'var(--text3)',
      }}>
        <span style={{ color: 'var(--red)' }}>Error</span>
        {': page not found at '}
        <span style={{ color: 'var(--blue)' }}>{window.location.pathname}</span>
      </div>

      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>
        {t('pageNotFound')}
      </div>
      <div style={{ fontSize: 14, color: 'var(--text2)', maxWidth: 340, lineHeight: 1.7 }}>
        {t('pageNotFoundDesc')}<br/>
        {t('pageNotFoundHint')}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={() => navigate('/')} className="btn btn-primary">
          {t('goHome')}
        </button>
        <button onClick={() => navigate('/problems')} className="btn btn-ghost">
          📋 {t('problemList')}
        </button>
        <button onClick={() => navigate(-1)} className="btn btn-ghost">
          {t('goBack')}
        </button>
      </div>
    </div>
  );
}
