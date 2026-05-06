import { createContext, useContext, useState, useEffect } from 'react';
import api, { AUTH_EXPIRED_EVENT, clearSessionMarker, markSessionActive } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(true);

  // 앱 시작 시 쿠키 기반 세션 복원 + OAuth 에러 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const oauthError = params.get('oauth_error');

    if (oauthError) {
      window.history.replaceState({}, '', window.location.pathname);
      setError(decodeURIComponent(oauthError));
      setLoading(false);
      return;
    }

    api.get('/auth/me')
      .then(res => {
        setUser(res.data);
        markSessionActive();
      })
      .catch(() => {
        clearSessionMarker();
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleAuthExpired = (event) => {
      setUser(null);
      setError(event.detail?.message || '세션이 만료되었습니다. 다시 로그인해주세요.');
      setLoading(false);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, []);

  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      markSessionActive();
      setUser(res.data.user);
      setError('');
      return true;
    } catch (err) {
      setError(err.response?.data?.message || '로그인에 실패했습니다.');
      return false;
    }
  };

  const register = async (email, password, username) => {
    try {
      const referralCode = localStorage.getItem('referralCode');
      const res = await api.post('/auth/register', { email, password, username, referralCode });
      markSessionActive();
      setUser(res.data.user);
      setError('');
      if (referralCode) localStorage.removeItem('referralCode');
      return true;
    } catch (err) {
      setError(err.response?.data?.message || '회원가입에 실패했습니다.');
      return false;
    }
  };

  const logout = () => {
    clearSessionMarker();
    setUser(null);
    api.post('/auth/logout').catch(() => {});
  };

  const updateUser = async (patch) => {
    try {
      const res = await api.patch('/auth/me', patch);
      setUser(res.data);
      return res.data;
    } catch (err) {
      // 서버가 거부한 경우 optimistic update 적용 금지 — 클라이언트 상태 유지
      console.error('[updateUser] 업데이트 실패:', err.response?.data?.message || err.message);
      throw err; // 호출부에서 에러 핸들링 가능하도록
    }
  };

  const applyUser = (nextUser) => {
    if (nextUser) setUser(nextUser);
  };

  const isAdmin = user?.role === 'admin';

  // 로딩 중일 때 스피너 (흰화면 방지)
  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh',
      background: localStorage.getItem('dc_theme') === 'light' ? '#ffffff' : '#0d1117',
      color: localStorage.getItem('dc_theme') === 'light' ? '#57606a' : '#8b949e',
      fontFamily: 'sans-serif', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ fontSize: 36 }}>⚡</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>DailyCoding</div>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        border: '3px solid rgba(121,192,255,.2)',
        borderTopColor: '#79c0ff',
        animation: 'spin .8s linear infinite',
      }}/>
    </div>
  );

  return (
    <AuthContext.Provider value={{
      user, isAdmin, login, register, logout, error, setError, updateUser, applyUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
