export default function PageLoader({ text = '로딩 중...' }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: 'calc(100vh - 54px)',
      gap: 16, color: 'var(--text3)',
    }}>
      <div style={{ position: 'relative', width: 40, height: 40 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '3px solid var(--bg3)',
          borderTopColor: 'var(--blue)',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
      <span style={{ fontSize: 13, fontFamily: 'Space Mono, monospace' }}>{text}</span>
    </div>
  );
}
