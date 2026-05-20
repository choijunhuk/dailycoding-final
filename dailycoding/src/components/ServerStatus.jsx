import { useState, useEffect } from 'react';
import api from '../api.js';
import { useLang } from '../context/LangContext.jsx';

export default function ServerStatus() {
  const [status, setStatus] = useState('checking'); // checking | online | offline
  const { t } = useLang();

  useEffect(() => {
    const check = async () => {
      try {
        await api.get('/health');
        setStatus('online');
      } catch {
        setStatus('offline');
      }
    };
    check();
    const timer = setInterval(check, 60000); // 1분마다 체크
    return () => clearInterval(timer);
  }, []);

  const cfg = {
    checking: { color: 'var(--text3)',  dot: '#666',        label: '...'     },
    online:   { color: 'var(--green)',  dot: 'var(--green)', label: t('serverOnline') },
    offline:  { color: 'var(--orange)', dot: 'var(--orange)',label: t('serverOffline') },
  }[status];

  return (
    <div title={status === 'online' ? t('serverOnlineTitle') : status === 'offline' ? t('serverOfflineTitle') : t('serverCheckingTitle')} style={{
      display: 'flex', alignItems: 'center', gap: 5,
      fontSize: 11, color: cfg.color, fontFamily: 'Space Mono, monospace',
      cursor: 'default', flexShrink: 0,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: cfg.dot,
        boxShadow: status === 'online' ? `0 0 6px ${cfg.dot}` : 'none',
        animation: status === 'checking' ? 'pulse 1s infinite' : 'none',
      }} />
      <span style={{ display: 'none' }}>{cfg.label}</span>
    </div>
  );
}
