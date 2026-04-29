import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../api.js';
import { io } from 'socket.io-client';
import { invalidateRankingData } from '../hooks/useRankingData.js';
import { useAuth } from './AuthContext';

const AppContext = createContext(null);

function getSocketUrl() {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) return apiUrl.replace(/\/api$/, '');
  if (typeof window !== 'undefined' && window.location.port === '5173') {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }
  return typeof window !== 'undefined' ? window.location.origin : '';
}

function formatRelativeTime(value) {
  if (!value) return '방금 전';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '방금 전';
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return '방금 전';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  return `${Math.floor(diffHour / 24)}일 전`;
}

function normalizeNotification(item) {
  const rawLink = item?.link || null;
  return {
    id: item?.id || Date.now(),
    msg: item?.msg || item?.message || '',
    link: rawLink && !String(rawLink).startsWith('/') ? `/${rawLink}` : rawLink,
    read: Boolean(item?.read ?? item?.is_read ?? item?.isRead),
    time: item?.time || formatRelativeTime(item?.created_at || item?.createdAt),
    createdAt: item?.created_at || item?.createdAt || new Date().toISOString(),
  };
}

export function AppProvider({ children }) {
  const { user } = useAuth();
  const [solved,        setSolved]        = useState({});
  const [bookmarks,     setBookmarks]     = useState({});
  const [grassData,     setGrassData]     = useState([]);
  const [submissions,   setSubmissions]   = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [problems,      setProblems]      = useState([]);
  const [contests,      setContests]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const socketRef = useRef(null);

  const hasSession = () => Boolean(user?.id);

  const loadProblems = useCallback(async () => {
    if (!hasSession()) return;
    try {
      const res = await api.get('/problems');
      setProblems(res.data);
      const sv = {}; const bm = {};
      res.data.forEach(p => {
        if (p.isSolved)     sv[p.id] = true;
        if (p.isBookmarked) bm[p.id] = true;
      });
      setSolved(sv);
      setBookmarks(bm);
    } catch { /* 서버 꺼져있으면 무시 */ }
  }, [user?.id]);

  const loadGrass = useCallback(async (userId) => {
    if (!userId || !hasSession()) return;
    try {
      const res = await api.get('/auth/me/activity');
      const raw = res.data && typeof res.data === 'object' && !Array.isArray(res.data) ? res.data : {};
      const today = new Date();
      const cells = [];
      for (let i = 363; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const count = Number(raw[key] || 0);
        cells.push({
          date: key,
          count,
          level: count <= 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : 3,
        });
      }
      setGrassData(cells);
    } catch {
      try {
        const res = await api.get(`/auth/grass/${userId}`);
        const map = {};
        res.data.forEach(r => { map[r.date] = Math.min(4, r.level || 1); });
        const today = new Date();
        const cells = [];
        for (let i = 363; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const key = d.toISOString().slice(0, 10);
          cells.push({ date: key, count: map[key] || 0, level: map[key] || 0 });
        }
        setGrassData(cells);
      } catch { /* 폴백: 빈 잔디 유지 */ }
    }
  }, [user?.id]);

  const loadSubmissions = useCallback(async () => {
    if (!hasSession()) return;
    try {
      const res = await api.get('/submissions');
      setSubmissions(res.data);
    } catch {
      // 네트워크 지연 시 기존 목록 유지
    }
  }, [user?.id]);

  const loadNotifications = useCallback(async () => {
    if (!hasSession()) return;
    try {
      const res = await api.get('/notifications');
      setNotifications((res.data || []).map(normalizeNotification));
    } catch {
      // 알림 조회 실패 시 현재 상태 유지
    }
  }, [user?.id]);

  const loadContests = useCallback(async () => {
    if (!hasSession()) return;
    try {
      const res = await api.get('/contests');
      setContests(res.data);
    } catch {
      // 대회 목록 조회 실패 시 현재 상태 유지
    }
  }, [user?.id]);

  // 로그인 후 데이터 로드 (토큰 생긴 뒤 호출용)
  const loadAll = useCallback(async (userId) => {
    setLoading(true);
    await Promise.all([loadProblems(), loadSubmissions(), loadNotifications(), loadContests()]);
    if (userId) await loadGrass(userId);
    setLoading(false);
  }, [loadProblems, loadSubmissions, loadNotifications, loadContests, loadGrass]);

  // 로딩 초기값: App.jsx의 loadAll이 user 확정 후 호출하므로 여기선 false로만 설정
  useEffect(() => { setLoading(false); }, []);

  // ── 코드 제출 ───────────────────────────────────────────────
  const addSubmission = useCallback(async (payload) => {
    try {
      const res = await api.post('/submissions', payload);
      const sub = res.data;
      setSubmissions(prev => [sub, ...prev]);
      if (sub.result === 'correct') {
        setSolved(prev => ({ ...prev, [sub.problemId]: true }));
        setProblems(prev => prev.map(p =>
          p.id === sub.problemId ? { ...p, isSolved: true } : p
        ));
        invalidateRankingData();
        if (user?.id) await loadGrass(user.id);
      }
      await loadNotifications();
      return sub;
    } catch (err) {
      // 서버 오류 시 시뮬레이션 금지 — 채점은 반드시 서버에서만 수행
      console.error('[addSubmission] 제출 실패:', err.message);
      throw err; // 호출부(JudgePage)에서 에러 메시지 표시
    }
  }, [loadGrass, loadNotifications, user?.id]);

  // ── 북마크 토글 ─────────────────────────────────────────────
  const toggleBookmark = useCallback(async (id) => {
    const { data } = await api.post(`/problems/${id}/bookmark`);
    const bookmarked = Boolean(data?.bookmarked);
    setBookmarks(prev => ({ ...prev, [id]: bookmarked }));
    setProblems(prev => prev.map(p =>
      p.id === id ? { ...p, isBookmarked: bookmarked } : p
    ));
    return data;
  }, []);

  // ── 알림 읽음 ───────────────────────────────────────────────
  const markRead = useCallback(async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
    } catch {
      // 서버 반영이 실패해도 로컬 읽음 상태는 유지
    }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  // ── 로컬 알림 추가 ──────────────────────────────────────────
  const addNotification = useCallback((msg, link) => {
    setNotifications(prev => [
      normalizeNotification({ id: Date.now(), msg, link, read: false, createdAt: new Date().toISOString() }),
      ...prev,
    ]);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const socket = io(getSocketUrl(), {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on('notification:new', (payload) => {
      setNotifications((prev) => [normalizeNotification(payload), ...prev]);
    });

    socket.on('connect_error', () => {});

    return () => {
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [user?.id]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <AppContext.Provider value={{
      solved, bookmarks, grassData, submissions, notifications, unreadCount,
      problems, contests, loading,
      loadProblems, loadSubmissions, loadNotifications, loadContests, loadAll, loadGrass,
      addSubmission, toggleBookmark, markRead, addNotification,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
