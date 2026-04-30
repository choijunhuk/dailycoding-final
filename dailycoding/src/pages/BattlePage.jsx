import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import api from '../api.js';
import EmailVerifyGate from '../components/EmailVerifyGate.jsx';
import { JUDGE_LANGUAGE_OPTIONS, getJudgeLanguageOptionsForSupported } from '../data/judgeLanguages.js';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus.js';
import { useToast } from '../context/ToastContext.jsx';
import { BATTLE_AD_SLOTS, BATTLE_DURATIONS, BATTLE_SEC, fmtTime, getSocketUrl, POLL_MS, TYPE_COLOR, TYPE_LABEL } from './battlePageUtils.js';
import { BattleAdSlot, BugFixProblem, CodingProblem, FillBlankProblem, getBattleStarterCode } from './battleProblemViews.jsx';
import './BattlePage.css';

// ── Web Audio 타이핑 사운드 (외부 라이브러리 없음) ────────────────────────
function useTypingSound() {
  const ctxRef = useRef(null);
  useEffect(() => {
    return () => {
      const ctx = ctxRef.current;
      if (ctx && ctx.state !== 'closed') {
        ctx.close().catch(() => {});
      }
      ctxRef.current = null;
    };
  }, []);

  return useCallback(() => {
    try {
      if (!ctxRef.current) {
        ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = ctxRef.current;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.value = 180 + Math.random() * 320;
      gain.gain.setValueAtTime(0.025, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.055);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.055);
    } catch {
      // 오디오 컨텍스트가 막힌 브라우저에서는 무음 처리
    }
  }, []);
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────
export default function BattlePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const { tier: subscriptionTier } = useSubscriptionStatus(user?.id);
  const playTyping = useTypingSound();
  const isFreePlan = subscriptionTier === 'free';

  // ── 페이즈 상태
  const [phase, setPhase]           = useState('lobby');   // lobby | battle | ended
  const [lobbyPhase, setLobbyPhase] = useState('idle');    // idle | invite_sent | invite_received
  const [opponentName, setOpponentName] = useState('');
  const [inviteInput, setInviteInput]   = useState('');
  const [inviteError, setInviteError]   = useState('');
  const [pendingInvite, setPendingInvite] = useState(null); // { roomId, inviterName }
  const [roomId, setRoomId] = useState(null);
  const [lobbyTab, setLobbyTab] = useState(location.pathname === '/battles/history' ? 'history' : 'active');
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [rematchPending, setRematchPending] = useState(false);

  // ── 배틀 상태
  const [room, setRoom]             = useState(null);
  const [isSpectator, setIsSpectator] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [activeProbIdx, setActiveProbIdx] = useState(0);
  const [answers, setAnswers]       = useState({});  // { [pid]: string | string[] }
  const [codeMap, setCodeMap]       = useState({});  // { [pid]: { code, lang } }
  const [submitResults, setSubmitResults] = useState({}); // { [pid]: true|false|'locked'|string }
  const [judgeDetails, setJudgeDetails] = useState({}); // { [pid]: { detail, timeMs, memoryMb } }
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft]     = useState(BATTLE_SEC);
  const [opponentTyping, setOpponentTyping] = useState(false);
  const [judgeStatus, setJudgeStatus] = useState(null);
  const [activeBattles, setActiveBattles] = useState([]);
  const [selectedBattleLanguage, setSelectedBattleLanguage] = useState(user?.defaultLanguage || 'python');
  const [selectedDuration, setSelectedDuration] = useState(BATTLE_SEC);

  const timerRef       = useRef(null);
  const typingTimerRef = useRef(null);
  const socketRef      = useRef(null);
  const lastTypingRef  = useRef(0);
  const lastOppTypingRef = useRef(0);
  const roomIdRef      = useRef(null);
  const loadErrorToastShownRef = useRef(false);
  const availableLangOptions = getJudgeLanguageOptionsForSupported(judgeStatus?.supportedLanguages);
  const fallbackLang = availableLangOptions[0]?.value || '';
  const myId  = user?.id;
  const me    = room?.players?.[myId];
  const myTeamId = me?.teamId;
  const showLoadErrorToast = useCallback((message) => {
    if (loadErrorToastShownRef.current) return;
    loadErrorToastShownRef.current = true;
    toast?.show(message, 'error');
  }, [toast]);

  useEffect(() => {
    setLobbyTab(location.pathname === '/battles/history' ? 'history' : 'active');
  }, [location.pathname]);

  // roomId를 ref에도 저장 (폴링 클로저에서 사용)
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

  useEffect(() => {
    api.get('/submissions/judge-status').then(({ data }) => {
      setJudgeStatus(data);
    }).catch(() => {
      setJudgeStatus({
        supportedLanguages: JUDGE_LANGUAGE_OPTIONS.map((option) => option.value),
      });
    });
  }, []);

  // ── 배틀 목록 가져오기 (관전용)
  useEffect(() => {
    if (phase !== 'lobby') return;
    const fetchBattles = async () => {
      try {
        const { data } = await api.get('/battles/active');
        setActiveBattles(data.battles || []);
      } catch (err) {
        setActiveBattles([]);
        if (err?.response?.status !== 401) {
          showLoadErrorToast(err?.response?.data?.message || '배틀 목록을 불러오지 못했습니다.');
        }
      }
    };
    fetchBattles();
    const t = setInterval(fetchBattles, 5000);
    return () => clearInterval(t);
  }, [phase, showLoadErrorToast]);

  useEffect(() => {
    if (phase !== 'lobby') return;
    setHistoryLoading(true);
    api.get('/battles/history')
      .then(({ data }) => setHistoryRows(data.history || []))
      .catch((err) => {
        setHistoryRows([]);
        if (err?.response?.status !== 401) {
          showLoadErrorToast(err?.response?.data?.message || '배틀 기록을 불러오지 못했습니다.');
        }
      })
      .finally(() => setHistoryLoading(false));
  }, [phase, showLoadErrorToast]);

  useEffect(() => {
    if (!fallbackLang) return;

    setCodeMap((prev) => {
      let changed = false;
      const next = { ...prev };

      Object.entries(prev).forEach(([problemId, entry]) => {
        if (entry?.lang && !availableLangOptions.some((option) => option.value === entry.lang)) {
          next[problemId] = { ...entry, lang: fallbackLang };
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [availableLangOptions, fallbackLang]);

  useEffect(() => {
    const lang = room?.preferredLanguage || fallbackLang;
    if (phase !== 'battle' || !room?.problems?.length || !lang) return;

    setCodeMap((prev) => {
      let changed = false;
      const next = { ...prev };
      room.problems.forEach((problem) => {
        if (problem.type !== 'coding') return;
        const current = next[problem.id];
        if (String(current?.code || '').trim()) return;
        next[problem.id] = {
          lang,
          code: getBattleStarterCode(problem, lang),
        };
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [phase, room?.id, room?.preferredLanguage, room?.problems, fallbackLang]);

  // ── 배틀 종료 처리
  const handleRoomUpdate = useCallback((updatedRoom) => {
    setRoom(updatedRoom);
    if (updatedRoom.status === 'ended' || updatedRoom.status === 'declined') {
      setPhase('ended');
    }

    // 상대방 타이핑 감지 (팀원 제외)
    const myId = user?.id;
    const myTeamId = updatedRoom.players?.[myId]?.teamId;
    
    Object.values(updatedRoom.players || {}).forEach(p => {
      if (p.id !== myId && p.teamId !== myTeamId && p.typingAt > lastOppTypingRef.current) {
        lastOppTypingRef.current = p.typingAt;
        playTyping();
        setOpponentTyping(true);
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setOpponentTyping(false), 2000);
      }
    });
  }, [user?.id, playTyping]);

  // ── 타이머
  const startTimer = useCallback((startTime, roomDuration) => {
    const duration = roomDuration || BATTLE_SEC;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const left = Math.max(0, duration - elapsed);
      setTimeLeft(left);
      if (left === 0) {
        clearInterval(timerRef.current);
        // 타임아웃: 강제 종료
        if (roomIdRef.current) {
          api.post(`/battles/room/${roomIdRef.current}/end`).catch(() => {});
          setPhase('ended');
        }
      }
    }, 1000);
  }, []);

  const fetchRoomSnapshot = useCallback(async (targetRoomId = roomIdRef.current) => {
    if (!targetRoomId) return;
    try {
      const { data } = await api.get(`/battles/room/${targetRoomId}`);
      if (data?.room) handleRoomUpdate(data.room);
    } catch {
      // 폴링/소켓 재동기화 실패는 다음 주기에 재시도
    }
  }, [handleRoomUpdate]);

  useEffect(() => {
    const shouldConnect = Boolean(user?.id && roomId && (phase === 'battle' || lobbyPhase === 'invite_sent'));
    if (!shouldConnect) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
      return;
    }

    const socket = io(
      getSocketUrl(import.meta.env.VITE_API_URL, typeof window !== 'undefined' ? window.location : null),
      {
        transports: ['websocket', 'polling'],
        withCredentials: true,
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
      }
    );
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('authenticate');
      if (phase === 'battle') {
        if (isSpectator) socket.emit('battle:spectate', roomId);
        else socket.emit('battle:join', { battleId: roomId, teamId: myTeamId || room?.players?.[user?.id]?.teamId || null });
      } else {
        socket.emit('battle:spectate', roomId);
      }
    });

    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('battle:started', ({ room: startedRoom }) => {
      if (!startedRoom) return;
      setRoom(startedRoom);
      setPhase('battle');
      setLobbyPhase('idle');
      startTimer(startedRoom.startTime, startedRoom.duration);
    });
    socket.on('battle:opponent_submitted', () => {
      fetchRoomSnapshot(roomId);
    });
    socket.on('battle:ended', () => {
      fetchRoomSnapshot(roomId);
    });
    socket.on('battle:opponent_typing', ({ teamId, isTyping }) => {
      if (teamId && teamId === myTeamId) return;
      if (!isTyping) return;
      setOpponentTyping(true);
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setOpponentTyping(false), 2000);
    });

    return () => {
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
      setSocketConnected(false);
    };
  }, [fetchRoomSnapshot, isSpectator, lobbyPhase, myTeamId, phase, room?.players, roomId, startTimer, user?.id]);

  // ── 로비 폴링 (초대 대기)
  useEffect(() => {
    if (phase !== 'lobby') return;
    const t = setInterval(async () => {
      try {
        const { data } = await api.get('/battles/invite');
        if (data.invite) {
          setPendingInvite(data.invite);
          setLobbyPhase('invite_received');
          clearInterval(t);
        }
      } catch {
        // 초대 대기 중 일시 실패는 다음 폴링에서 재시도
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [phase]);

  // ── 배틀 폴링
  useEffect(() => {
    if (phase !== 'battle' || !roomId) return;
    if (socketConnected) return;
    const t = setInterval(async () => {
      try {
        const { data } = await api.get(`/battles/room/${roomId}`);
        handleRoomUpdate(data.room);
      } catch {
        // 소켓 미연결 시 폴링 실패는 다음 주기에 재시도
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [phase, roomId, handleRoomUpdate, socketConnected]);

  // ── 정리
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearTimeout(typingTimerRef.current);
    };
  }, []);

  // ── 배틀 초대 보내기
  const sendInvite = async () => {
    setInviteError('');
    if (!inviteInput.trim()) return;
    try {
      const payload = { username: inviteInput.trim(), language: selectedBattleLanguage, duration: selectedDuration };
      const { data } = await api.post('/battles/invite', payload);
      setRoomId(data.roomId);
      roomIdRef.current = data.roomId;
      setOpponentName(inviteInput.trim());
      setLobbyPhase('invite_sent');
      // invite_sent 상태에서 수락 대기 폴링
    } catch (err) {
      setInviteError(err.response?.data?.message || '초대 전송 실패');
    }
  };

  // ── invite_sent 상태에서 수락/거절 폴링
  useEffect(() => {
    if (lobbyPhase !== 'invite_sent' || !roomId) return;
    const t = setInterval(async () => {
      try {
        const { data } = await api.get(`/battles/room/${roomId}`);
        const r = data.room;
        if (r.status === 'active') {
          setRoom(r);
          setPhase('battle');
          setLobbyPhase('idle');
          startTimer(r.startTime, r.duration);
        } else if (r.status === 'declined') {
          setLobbyPhase('idle');
          setInviteError('상대방이 초대를 거절했습니다.');
          setRoomId(null);
        }
      } catch {
        // 초대 상태 조회 실패는 다음 폴링에서 재시도
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [lobbyPhase, roomId, startTimer]);

  // ── 초대 수락
  const acceptInvite = async () => {
    if (!pendingInvite) return;
    try {
      const { data } = await api.post(`/battles/accept/${pendingInvite.roomId}`);
      setRoom(data.room);
      setRoomId(data.room.id);
      roomIdRef.current = data.room.id;
      setPhase('battle');
      setLobbyPhase('idle');
      startTimer(data.room.startTime, data.room.duration);
    } catch (err) {
      setInviteError(err.response?.data?.message || '수락 실패');
    }
  };

  // ── 초대 거절
  const declineInvite = async () => {
    if (!pendingInvite) return;
    try {
      await api.post(`/battles/decline/${pendingInvite.roomId}`);
    } catch {
      // 거절 요청 실패 여부와 무관하게 로컬 초대창은 닫음
    }
    setPendingInvite(null);
    setLobbyPhase('idle');
  };

  // ── 타이핑 이벤트 전송 (500ms 쓰로틀)
  const handleCodeChange = (pid, val) => {
    setCodeMap(prev => ({ ...prev, [pid]: { ...(prev[pid] || {}), lang: room?.preferredLanguage || fallbackLang, code: val } }));
    const now = Date.now();
    if (now - lastTypingRef.current > 500 && roomId) {
      lastTypingRef.current = now;
      api.post(`/battles/room/${roomId}/typing`, { isTyping: true }).catch(() => {});
    }
  };

  const handleAnswerChange = (pid, val) => {
    setAnswers(prev => ({ ...prev, [pid]: val }));
    const now = Date.now();
    if (now - lastTypingRef.current > 500 && roomId) {
      lastTypingRef.current = now;
      api.post(`/battles/room/${roomId}/typing`, { isTyping: true }).catch(() => {});
    }
  };

  // ── 정답 제출
  const submitAnswer = async (problem) => {
    if (submitting || !roomId) return;
    setSubmitting(true);
    try {
      if (problem.type === 'coding') {
        const { code } = codeMap[problem.id] || { code: '' };
        const lang = room?.preferredLanguage || fallbackLang;
        if (!lang) {
          setSubmitResults(prev => ({ ...prev, [problem.id]: 'error' }));
          return;
        }
        const { data } = await api.post(`/battles/room/${roomId}/code-judge`, {
          problemId: problem.id, lang, code,
        });
        setSubmitResults(prev => ({ ...prev, [problem.id]: data.result }));
        setJudgeDetails(prev => ({
          ...prev,
          [problem.id]: {
            detail: data.detail || '',
            timeMs: Number.isFinite(data.timeMs) ? data.timeMs : null,
            memoryMb: Number.isFinite(data.memoryMb) ? data.memoryMb : null,
          },
        }));
        handleRoomUpdate(data.room);
      } else {
        const answer = answers[problem.id];
        const { data } = await api.post(`/battles/room/${roomId}/submit`, {
          problemId: problem.id, answer,
        });
        setSubmitResults(prev => ({ ...prev, [problem.id]: data.correct ? true : false }));
        setJudgeDetails(prev => ({ ...prev, [problem.id]: null }));
        if (data.room) handleRoomUpdate(data.room);
      }
    } catch (err) {
      setSubmitResults(prev => ({ ...prev, [problem.id]: 'error' }));
      setJudgeDetails(prev => ({
        ...prev,
        [problem.id]: { detail: err.response?.data?.message || '채점 요청에 실패했습니다.', timeMs: null, memoryMb: null },
      }));
    } finally {
      setSubmitting(false);
    }
  };

  // ── 관전하기
  const spectateBattle = async (targetRoomId) => {
    try {
      const { data } = await api.get(`/battles/room/${targetRoomId}`);
      setRoom(data.room);
      setRoomId(targetRoomId);
      setIsSpectator(true);
      setPhase('battle');
      startTimer(data.room.startTime, data.room.duration);
      navigate(`/battle/watch/${targetRoomId}`, { replace: true });
    } catch (err) {
      toast?.show(err?.response?.data?.message || '관전에 실패했습니다.', 'error');
    }
  };

  const copyWithFallback = async (text) => {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  };

  const buildShareText = (battleRoom, currentPlayer, opponentPlayer, didWin, didDraw) => {
    const outcome = didWin ? '승리' : didDraw ? '무승부' : '패배';
    const primaryProblemTitle = battleRoom?.problems?.[0]?.title || '배틀 문제';
    const elapsedSec = Math.max(0, BATTLE_SEC - timeLeft);
    return `DailyCoding 배틀에서 ${outcome}했습니다! 🔥 문제: ${primaryProblemTitle} | 점수 ${currentPlayer?.score ?? 0}:${opponentPlayer?.score ?? 0} | ${elapsedSec}s 소요`;
  };

  const handleShareCopy = async () => {
    if (!room) return;
    const opponent = Object.values(room.players || {}).find((player) => player.id !== myId);
    const myScore = me?.score ?? 0;
    const oppScore = opponent?.score ?? 0;
    const didWin = myScore > oppScore;
    const didDraw = myScore === oppScore;
    const shareText = buildShareText(room, me, opponent, didWin, didDraw);

    try {
      if (navigator.share && window.matchMedia?.('(max-width: 768px)')?.matches) {
        await navigator.share({ text: shareText });
        toast?.show('결과를 공유했습니다.', 'success');
        return;
      }

      const copied = await copyWithFallback(shareText);
      if (!copied) throw new Error('copy_failed');
      toast?.show('결과를 클립보드에 복사했습니다.', 'success');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      toast?.show('결과 공유에 실패했습니다.', 'error');
    }
  };

  const handleShareTwitter = () => {
    if (!room) return;
    const opponent = Object.values(room.players || {}).find((player) => player.id !== myId);
    const myScore = me?.score ?? 0;
    const oppScore = opponent?.score ?? 0;
    const didWin = myScore > oppScore;
    const didDraw = myScore === oppScore;
    const shareText = buildShareText(room, me, opponent, didWin, didDraw);
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
  };

  const resetBattleStateToLobby = () => {
    setPhase('lobby');
    setLobbyPhase('idle');
    setRoom(null);
    setRoomId(null);
    setAnswers({});
    setCodeMap({});
    setSubmitResults({});
    setInviteInput('');
    setInviteError('');
    setTimeLeft(BATTLE_SEC);
    setIsSpectator(false);
  };

  const requestRematch = async (battleRoomId, fallbackOpponentName = '') => {
    if (!battleRoomId || rematchPending) return;
    setRematchPending(true);
    try {
      const { data } = await api.post(`/battles/${battleRoomId}/rematch`);
      setOpponentName(data.opponentName || fallbackOpponentName);
      setRoomId(data.roomId);
      roomIdRef.current = data.roomId;
      setPendingInvite(null);
      setLobbyPhase('invite_sent');
      setPhase('lobby');
      setRoom(null);
      setIsSpectator(false);
      setAnswers({});
      setCodeMap({});
      setSubmitResults({});
      setInviteError('');
      setTimeLeft(BATTLE_SEC);
      navigate('/battle', { replace: true });
      toast?.show('리매치 요청을 보냈습니다.', 'success');
    } catch (error) {
      toast?.show(error?.response?.data?.message || '리매치 요청에 실패했습니다.', 'error');
    } finally {
      setRematchPending(false);
    }
  };

  useEffect(() => {
    if (!params.roomId) return;
    spectateBattle(params.roomId);
  }, [params.roomId]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: 이메일 인증 게이트
  // ─────────────────────────────────────────────────────────────────────────
  if (!user?.emailVerified) return <EmailVerifyGate feature="배틀 기능" />;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: 로비
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <div className="bp-page">
        {isFreePlan && (
          <div className="bp-free-plan-banner">
            무료 플랜도 1:1 배틀을 이용할 수 있으며, 대신 광고 슬롯이 노출됩니다.
          </div>
        )}
        {isFreePlan && <BattleAdSlot slot={BATTLE_AD_SLOTS.lobby} />}
        <div className="bp-lobby">
          <div className="bp-lobby-hero">
            <div className="bp-lobby-icon">⚔️</div>
            <h1>코딩 배틀</h1>
            <p>실시간으로 상대와 코딩 대결을 펼쳐보세요.<br/>모든 영토(문제)를 먼저 점령하는 팀이 승리!</p>
          </div>

          <div className="bp-lobby-main">
            <div className="bp-lobby-left">
              {lobbyPhase === 'idle' && (
                <div className="bp-invite-box">
                  <div className="bp-invite-title">상대방 초대</div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    {BATTLE_DURATIONS.map(d => (
                      <button
                        key={d.sec}
                        onClick={() => setSelectedDuration(d.sec)}
                        style={{
                          padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                          border: `1px solid ${selectedDuration === d.sec ? 'var(--blue)' : 'var(--border)'}`,
                          background: selectedDuration === d.sec ? 'rgba(121,192,255,.15)' : 'var(--bg3)',
                          color: selectedDuration === d.sec ? 'var(--blue)' : 'var(--text2)',
                          cursor: 'pointer', transition: 'all .15s', fontFamily: 'inherit',
                        }}
                      >
                        {d.label} <span style={{ opacity: 0.7, fontWeight: 400 }}>{d.desc}</span>
                      </button>
                    ))}
                  </div>
                  <div className="bp-invite-row">
                    <input
                      className="bp-invite-input"
                      value={inviteInput}
                      onChange={e => setInviteInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendInvite()}
                      placeholder="상대방 사용자명 입력"
                    />
                    <select
                      className="bp-invite-input"
                      style={{ maxWidth: 170 }}
                      value={selectedBattleLanguage}
                      onChange={(e) => setSelectedBattleLanguage(e.target.value)}
                    >
                      {JUDGE_LANGUAGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <button className="bp-btn-primary" onClick={sendInvite}>초대 보내기</button>
                  </div>
                  {inviteError && <div className="bp-error">{inviteError}</div>}
                </div>
              )}

              {lobbyPhase === 'invite_sent' && (
                <div className="bp-waiting-box">
                  <div className="bp-spinner" />
                  <div className="bp-waiting-text">
                    <strong>{opponentName}</strong>님의 수락을 기다리는 중...
                  </div>
                  <div className="bp-waiting-sub">상대방이 2분 내에 수락해야 합니다.</div>
                  <button className="bp-btn-ghost" onClick={() => {
                    setLobbyPhase('idle');
                    setRoomId(null);
                    setInviteError('');
                  }}>취소</button>
                </div>
              )}

              {lobbyPhase === 'invite_received' && pendingInvite && (
                <div className="bp-invite-received">
                  <div className="bp-invite-from">
                    <span className="bp-invite-icon">📩</span>
                    <div>
                      <div className="bp-invite-name">{pendingInvite.inviterName}님이 배틀을 신청했습니다!</div>
                      <div className="bp-invite-sub">지금 수락하지 않으면 2분 후 자동 만료됩니다.</div>
                    </div>
                  </div>
                  <div className="bp-invite-actions">
                    <button className="bp-btn-primary" onClick={acceptInvite}>수락</button>
                    <button className="bp-btn-danger"  onClick={declineInvite}>거절</button>
                  </div>
                </div>
              )}

              <div className="bp-active-battles">
                <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                  <button className="bp-btn-small" onClick={() => setLobbyTab('active')} style={{ opacity: lobbyTab === 'active' ? 1 : 0.7 }}>진행 중인 배틀</button>
                  <button className="bp-btn-small" onClick={() => setLobbyTab('history')} style={{ opacity: lobbyTab === 'history' ? 1 : 0.7 }}>히스토리</button>
                </div>
                {lobbyTab === 'active' ? (
                  <>
                    <div className="bp-section-title">진행 중인 배틀 (관전 가능)</div>
                    {activeBattles.length === 0 ? (
                      <div className="bp-empty-msg">현재 진행 중인 배틀이 없습니다.</div>
                    ) : (
                      <div className="bp-battle-list">
                        {activeBattles.map(b => (
                          <div key={b.id} className="bp-battle-item">
                            <div className="bp-battle-info">
                              <span className="bp-battle-tag">{b.isTeamBattle ? 'Team' : '1v1'}</span>
                              <span>{Object.values(b.players).map(p => p.username).join(' vs ')}</span>
                            </div>
                            <button className="bp-btn-small" onClick={() => spectateBattle(b.id)}>관전하기</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="bp-section-title">내 배틀 히스토리</div>
                    {historyLoading ? (
                      <div className="bp-empty-msg">히스토리를 불러오는 중입니다.</div>
                    ) : historyRows.length === 0 ? (
                      <div className="bp-empty-msg">아직 완료된 배틀이 없습니다.</div>
                    ) : (
                      <div className="bp-battle-list">
                        {historyRows.map((row) => (
                          <div key={row.id} className="bp-battle-item" style={{ alignItems:'flex-start', flexDirection:'column', gap:8 }}>
                            <div style={{ display:'flex', width:'100%', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
                              <div className="bp-battle-info">
                                <span className={`bp-battle-tag ${row.result}`}>{row.result === 'win' ? 'WIN' : row.result === 'lose' ? 'LOSE' : 'DRAW'}</span>
                                <span>{row.opponentName}</span>
                              </div>
                              <span style={{ fontSize:11, color:'var(--text3)' }}>{new Date(row.createdAt).toLocaleString('ko-KR')}</span>
                            </div>
                            <div style={{ fontSize:12, color:'var(--text2)' }}>
                              점수 {row.scoreFor} : {row.scoreAgainst} · 해결 {row.solvedFor} : {row.solvedAgainst}
                            </div>
                            <div style={{ fontSize:11, color:'var(--text3)' }}>
                              {(row.problems || []).map((problem) => problem.title).join(' · ')}
                            </div>
                            <div style={{ display:'flex', justifyContent:'flex-end', width:'100%' }}>
                              <button
                                className="bp-btn-small"
                                onClick={() => requestRematch(row.roomId, row.opponentName)}
                                disabled={rematchPending}
                              >
                                리매치
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="bp-rules">
              <div className="bp-rules-title">배틀 규칙</div>
              {(() => {
                const dur = BATTLE_DURATIONS.find(d => d.sec === selectedDuration) || BATTLE_DURATIONS[1];
                return (
                  <ul>
                    <li>⏱️ 제한 시간: <strong>{dur.desc}</strong> ({dur.label.replace(/[^\w가-힣]/g, '').trim()} 모드)</li>
                    {dur.sec === 300 && <li>⚡ 블리츠: 빠른 판단이 핵심입니다. 쉬운 문제부터 빠르게 선점하세요.</li>}
                    {dur.sec === 3600 && <li>🏔️ 마라톤: 긴 시간을 활용해 어려운 문제에 도전하세요. 팀원과 역할 분담이 중요합니다.</li>}
                    <li>🗺️ 영토 선점: 문제를 먼저 맞힌 팀이 영토를 점령하며, 상대 팀은 해당 문제를 풀 수 없습니다.</li>
                    <li>👥 팀 배틀: 팀원끼리 점수를 합산하며, 실시간으로 소통하며 문제를 나눠 풀어보세요.</li>
                    <li>👁️ 관전 모드: 다른 플레이어의 배틀을 실시간으로 관전할 수 있습니다.</li>
                  </ul>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: 배틀 진행 중
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'battle' && room) {
    const problems = room.problems || [];
    const activeProblem = problems[activeProbIdx] || problems[0];
    const pid = activeProblem?.id;
    const lockedTeamId = pid && room.locked?.[String(pid)];
    const isLocked = pid && lockedTeamId && lockedTeamId !== myTeamId;
    const isMine   = pid && lockedTeamId === myTeamId;
    const battleLang = room.preferredLanguage || fallbackLang;
    const battleLangLabel = JUDGE_LANGUAGE_OPTIONS.find((option) => option.value === battleLang)?.label || battleLang;
    const codeEntry = codeMap[pid] || { code: '', lang: battleLang };

    const players = Object.values(room.players || {});
    const team1Score = players.filter(p => p.teamId === 'team_1').reduce((acc, p) => acc + p.score, 0);
    const team2Score = players.filter(p => p.teamId === 'team_2').reduce((acc, p) => acc + p.score, 0);
    const myTeamScore = myTeamId === 'team_2' ? team2Score : team1Score;
    const opponentTeamScore = myTeamId === 'team_2' ? team1Score : team2Score;
    const opponentPlayers = players.filter((p) => p.teamId !== myTeamId);
    const opponentLabel = opponentPlayers.map((p) => p.username).join(', ') || '상대';

    return (
      <div className="bp-page bp-battle-page">
        {isFreePlan && <BattleAdSlot slot={BATTLE_AD_SLOTS.battle} />}
        {isSpectator && <div className="bp-spectator-banner">👁️ 현재 배틀을 관전 중입니다 (읽기 전용)</div>}
        
        {/* ── 상단 HUD ── */}
        <div className="bp-hud">
          <div className={`bp-hud-player team1 ${myTeamId === 'team_1' ? 'me' : ''}`}>
            <div className="bp-hud-players">
              {Object.values(room.players || {}).filter(p => p.teamId === 'team_1').map(p => (
                <span key={p.id} className={`bp-player-chip ${p.id === myId ? 'self' : ''}`}>{p.username}</span>
              ))}
            </div>
            <span className="bp-hud-score">{team1Score} pt</span>
          </div>

          <div className="bp-hud-center">
            <div className={`bp-timer ${timeLeft < 60 ? 'urgent' : timeLeft < 300 ? 'warning' : ''}`}>{fmtTime(timeLeft)}</div>
            {opponentTyping && <div className="bp-opp-typing">⌨️ 입력 중...</div>}
          </div>

          <div className={`bp-hud-player team2 ${myTeamId === 'team_2' ? 'me' : ''}`}>
            <span className="bp-hud-score">{team2Score} pt</span>
            <div className="bp-hud-players">
              {Object.values(room.players || {}).filter(p => p.teamId === 'team_2').map(p => (
                <span key={p.id} className={`bp-player-chip ${p.id === myId ? 'self' : ''}`}>{p.username}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="bp-scoreboard" aria-label="현재 배틀 점수">
          <div className="bp-score-card mine">
            <span className="bp-score-label">내 점수</span>
            <strong>{myTeamScore}점</strong>
            <small>{me?.username || '나'}</small>
          </div>
          <div className="bp-score-card opponent">
            <span className="bp-score-label">상대 점수</span>
            <strong>{opponentTeamScore}점</strong>
            <small>{opponentLabel}</small>
          </div>
        </div>

        {/* ── 영토 현황 ── */}
        <div className="bp-territory">
          {problems.map((p, i) => {
            const lockedBy = room.locked?.[String(p.id)];
            const byMe  = lockedBy === myTeamId;
            const byOpp = lockedBy && lockedBy !== myTeamId;
            return (
              <button
                key={p.id}
                className={`bp-territory-cell ${byMe ? 'mine' : byOpp ? 'opp' : ''} ${activeProbIdx === i ? 'active' : ''}`}
                onClick={() => setActiveProbIdx(i)}
              >
                <span className="bp-territory-num">{i + 1}</span>
                <span className="bp-territory-type" style={{ color: TYPE_COLOR[p.type] }}>{TYPE_LABEL[p.type]}</span>
                {byMe  && <span className="bp-territory-flag">🏳️ 내 것</span>}
                {byOpp && <span className="bp-territory-flag">🔒 선점됨</span>}
              </button>
            );
          })}
        </div>

        {/* ── 문제 영역 ── */}
        <div className="bp-problem-area">
          {activeProblem && (
            <>
              <div className="bp-problem-header">
                <span className="bp-type-badge" style={{ background: TYPE_COLOR[activeProblem.type] + '22', color: TYPE_COLOR[activeProblem.type] }}>
                  {TYPE_LABEL[activeProblem.type]}
                </span>
                <h2 className="bp-problem-title">{activeProblem.title}</h2>
                {isLocked && <span className="bp-locked-badge">🔒 상대가 선점한 문제</span>}
              </div>

              {activeProblem.type === 'fill-blank' && (
                <FillBlankProblem
                  problem={activeProblem}
                  answer={answers[pid]}
                  onChange={val => handleAnswerChange(pid, val)}
                  locked={isLocked || isSpectator}
                  correct={submitResults[pid] === true ? true : submitResults[pid] === false ? false : null}
                />
              )}
              {activeProblem.type === 'bug-fix' && (
                <BugFixProblem
                  problem={activeProblem}
                  answer={answers[pid]}
                  onChange={val => handleAnswerChange(pid, val)}
                  locked={isLocked || isSpectator}
                  correct={submitResults[pid] === true ? true : submitResults[pid] === false ? false : null}
                />
              )}
              {activeProblem.type === 'coding' && (
                <CodingProblem
                  problem={activeProblem}
                  code={codeEntry.code}
                  lang={codeEntry.lang}
                  lockedLanguageLabel={battleLangLabel}
                  onCodeChange={val => handleCodeChange(pid, val)}
                  onInsertStarter={(starter) => handleCodeChange(pid, starter)}
                  locked={isLocked || isSpectator}
                  result={submitResults[pid]}
                  judgeDetail={judgeDetails[pid]}
                />
              )}

              {!isLocked && !isMine && !isSpectator && submitResults[pid] !== true && submitResults[pid] !== 'correct' && (
                <button
                  className="bp-btn-submit"
                  onClick={() => submitAnswer(activeProblem)}
                  disabled={submitting}
                >
                  {submitting ? '채점 중...' : '제출'}
                </button>
              )}

              {(!isSpectator && submitResults[pid] === false) && (
                <div className="bp-feedback wrong">오답입니다. 다시 시도해보세요.</div>
              )}
              {(!isSpectator && (isMine || submitResults[pid] === true || submitResults[pid] === 'correct')) && (
                <div className="bp-feedback correct">정답! 영토를 점령했습니다 🎉</div>
              )}
              {(isSpectator && lockedTeamId) && (
                <div className={`bp-feedback ${lockedTeamId === 'team_1' ? 'team1' : 'team2'}`}>
                  {lockedTeamId === 'team_1' ? 'Team 1' : 'Team 2'}이 이 문제를 점령했습니다.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: 배틀 종료
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'ended' && room) {
    const opp = Object.values(room.players || {}).find((p) => p.id !== myId);
    const myScore  = me?.score  ?? 0;
    const oppScore = opp?.score ?? 0;
    const won = myScore > oppScore;
    const draw = myScore === oppScore;

    return (
      <div className="bp-page">
        <div className="bp-result">
          <div className={`bp-result-banner ${won ? 'win' : draw ? 'draw' : 'lose'}`}>
            {won ? '🏆 승리!' : draw ? '🤝 무승부' : '💀 패배'}
          </div>
          <div className="bp-result-scores">
            <div className="bp-result-player me">
              <div className="bp-result-name">{me?.username} (나)</div>
              <div className="bp-result-pts">{myScore}점</div>
              <div className="bp-result-solved">{me?.solved?.length ?? 0}문제 풀이</div>
            </div>
            <div className="bp-result-vs">VS</div>
            <div className="bp-result-player opp">
              <div className="bp-result-name">{opp?.username}</div>
              <div className="bp-result-pts">{oppScore}점</div>
              <div className="bp-result-solved">{opp?.solved?.length ?? 0}문제 풀이</div>
            </div>
          </div>

          <div className="bp-result-territory">
            <div className="bp-result-section-title">영토 결과</div>
            <div className="bp-territory">
              {(room.problems || []).map((p, i) => {
                const lockedBy = room.locked?.[String(p.id)];
                const byMe  = lockedBy === myTeamId;
                const byOpp = lockedBy && !byMe;
                return (
                  <div key={p.id} className={`bp-territory-cell ${byMe ? 'mine' : byOpp ? 'opp' : ''}`}>
                    <span className="bp-territory-num">{i + 1}</span>
                    <span className="bp-territory-type">{TYPE_LABEL[p.type]}</span>
                    <span className="bp-territory-flag">
                      {byMe ? `🏳️ 내 팀` : byOpp ? `🏴 상대 팀` : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bp-result-notice">
            ℹ️ 배틀 결과는 레이팅/티어에 반영되지 않습니다.
          </div>

          <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
            <button className="bp-btn-small" onClick={() => requestRematch(room.id, opp?.username)} disabled={rematchPending}>
              {rematchPending ? '요청 중...' : '🔄 리매치'}
            </button>
            <button className="bp-btn-small" onClick={() => navigate('/battles/history')}>
              🕘 히스토리
            </button>
            <button className="bp-btn-small" onClick={handleShareCopy}>📋 복사</button>
            <button className="bp-btn-small" onClick={handleShareTwitter}>🐦 트위터</button>
          </div>

          <button className="bp-btn-primary" onClick={resetBattleStateToLobby}>
            다시 배틀하기
          </button>
        </div>
      </div>
    );
  }

  // 로딩 상태
  return (
    <div className="bp-page" style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div className="bp-spinner" />
    </div>
  );
}
