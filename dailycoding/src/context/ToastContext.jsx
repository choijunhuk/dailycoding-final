import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ToastContext = createContext(null);

const ICONS = { success:'✅', error:'❌', info:'ℹ️', warning:'⚠️' };
const COLORS = {
  success: { bg:'rgba(86,211,100,.12)',  border:'rgba(86,211,100,.3)',  text:'var(--green)'  },
  error:   { bg:'rgba(248,81,73,.12)',   border:'rgba(248,81,73,.3)',   text:'var(--red)'    },
  info:    { bg:'rgba(121,192,255,.1)',  border:'rgba(121,192,255,.25)',text:'var(--blue)'   },
  warning: { bg:'rgba(227,179,65,.1)',   border:'rgba(227,179,65,.25)', text:'var(--yellow)' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((msg, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), duration);
  }, []);

  const remove = useCallback((id) => setToasts(p => p.filter(t => t.id !== id)), []);

  useEffect(() => {
    const handler = (event) => {
      const detail = event.detail || {};
      if (!detail.message) return;
      show(detail.message, detail.type || 'info', detail.duration || 3000);
    };
    window.addEventListener('dc:toast', handler);
    return () => window.removeEventListener('dc:toast', handler);
  }, [show]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => {
          const c = COLORS[t.type] || COLORS.info;
          return (
            <div key={t.id} style={{
              background: c.bg, border: `1px solid ${c.border}`,
              borderRadius: 10, padding: '11px 16px',
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 13, fontFamily: 'Noto Sans KR, sans-serif',
              color: 'var(--text)',
              boxShadow: '0 4px 20px rgba(0,0,0,.4)',
              animation: 'toastIn .3s cubic-bezier(.34,1.56,.64,1)',
              pointerEvents: 'all',
              minWidth: 220, maxWidth: 360,
            }}>
              <span style={{ fontSize: 16, color: c.text }}>{ICONS[t.type]}</span>
              <span style={{ flex: 1, lineHeight: 1.5 }}>{t.msg}</span>
              <button onClick={() => remove(t.id)} style={{
                background: 'none', border: 'none', color: 'var(--text3)',
                cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1,
              }}>✕</button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
