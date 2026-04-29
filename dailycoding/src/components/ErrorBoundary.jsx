import { Component } from 'react';
import { STRINGS_EB } from '../context/LangContext.jsx';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const lang = (typeof localStorage !== 'undefined' && localStorage.getItem('dc_lang')) || 'ko';
    const s = STRINGS_EB[lang] || STRINGS_EB.ko;
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh',
        background: 'var(--bg)', color: 'var(--text)', fontFamily: 'sans-serif',
        gap: 16, padding: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 52 }}>💥</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{s.unexpectedError}</h2>
        <p style={{ color: 'var(--text2)', fontSize: 14, maxWidth: 480, lineHeight: 1.6 }}>
          {s.refreshFix}
        </p>
        {this.state.error && (
          <details style={{ marginTop: 8 }}>
            <summary style={{ fontSize: 12, color: 'var(--text3)', cursor: 'pointer' }}>
              {s.errorDetails}
            </summary>
            <pre style={{
              marginTop: 8, padding: '10px 14px', background: 'var(--bg3)',
              borderRadius: 8, fontSize: 11, color: 'var(--red)',
              textAlign: 'left', maxWidth: 600, overflow: 'auto',
              fontFamily: 'Space Mono, monospace',
            }}>
              {this.state.error.toString()}
            </pre>
          </details>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 22px', borderRadius: 8, border: 'none',
              background: 'var(--blue)', color: '#fff', fontSize: 14,
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            {s.refresh}
          </button>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '10px 22px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'none',
              color: 'var(--text)', fontSize: 14, cursor: 'pointer',
            }}
          >
            {s.goBack}
          </button>
        </div>
      </div>
    );
  }
}
