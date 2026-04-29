import { useState, useEffect } from 'react';
import api from '../api.js';

export default function ServerStatus() {
  const [status, setStatus] = useState('checking'); // checking | online | offline

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
    const t = setInterval(check, 60000); // 1분마다 체크
    return () => clearInterval(t);
  }, []);

  const cfg = {
    checking: { color: 'var(--text3)',  dot: '#666',        label: '...'     },
    online:   { color: 'var(--green)',  dot: 'var(--green)', label: '서버 연결' },
    offline:  { color: 'var(--orange)', dot: 'var(--orange)',label: '오프라인' },
  }[status];

  return (
    <div title={status === 'online' ? '서버 정상 연결' : status === 'offline' ? '서버 연결 끊김 (오프라인 모드)' : '연결 확인 중'} style={{
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
