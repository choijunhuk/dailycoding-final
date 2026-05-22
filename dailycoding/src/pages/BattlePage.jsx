import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import api from '../api.js';
import EmailVerifyGate from '../components/EmailVerifyGate.jsx';
import { JUDGE_LANGUAGE_OPTIONS, getEffectiveJudgeLanguage, getJudgeLanguageOptionsForSupported } from '../data/judgeLanguages.js';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus.js';
import { useToast } from '../context/ToastContext.jsx';
import { BATTLE_AD_SLOTS, BATTLE_DURATIONS, BATTLE_MODES, BATTLE_SEC, fmtTime, getSocketUrl, POLL_MS, TYPE_COLOR, TYPE_LABEL } from './battlePageUtils.js';
import { BattleAdSlot, BugFixProblem, CodingProblem, FillBlankProblem, getBattleStarterCode } from './battleProblemViews.jsx';
import './BattlePage.css';

// ── Web Audio typing sound (no external libraries) ────────────────────────
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
      // Silently ignore in browsers that block AudioContext
    }
  }, []);
}

function BattleReplayViewer({ roomId }) {
  const navigate = useNavigate();
  const [replay, setReplay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    api.get(`/battles/${roomId}/replay`)
      .then((res) => {
        if (!ignore) {
          setReplay(res.data);
          setCursor(0);
        }
      })
      .catch(() => {
        if (!ignore) setReplay(null);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => { ignore = true; };
  }, [roomId]);

  const timeline = replay?.timeline || [];
  const visibleEvents = timeline.slice(0, cursor + 1);
  const progressByUser = visibleEvents.reduce((acc, event) => {
    const key = event.userId;
    if (!acc[key]) acc[key] = { pass: 0, fail: 0 };
    if (event.type === 'pass') acc[key].pass += 1;
    if (event.type === 'fail') acc[key].fail += 1;
    return acc;
  }, {});

  if (loading) {
    return <div className="bp-page" style={{display:'grid',placeItems:'center'}}><div className="bp-spinner" /></div>;
  }

  if (!replay) {
    return (
      <div className="bp-page" style={{display:'grid',placeItems:'center'}}>
        <div className="card card-pad-lg" style={{maxWidth:420,textAlign:'center'}}>
          <h2>리플레이를 찾을 수 없습니다</h2>
          <button className="btn btn-primary" onClick={() => navigate('/battle')}>배틀로 이동</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bp-page bp-replay-page">
      <div className="bp-result">
        <div className="bp-result-banner draw">🎬 Battle Replay</div>
        <div style={{fontSize:13,color:'var(--text2)',textAlign:'center',marginBottom:16}}>
          Room {replay.roomId} · {new Date(replay.createdAt).toLocaleString('ko-KR')}
        </div>

        <div className="bp-replay-progress">
          {(replay.players || []).map((player) => {
            const progress = progressByUser[player.userId] || { pass: 0, fail: 0 };
            return (
              <div key={player.userId} className="bp-replay-player">
                <strong>Player {player.userId}</strong>
                <span className="mono">{progress.pass} pass / {progress.fail} fail</span>
                <small>{player.result?.toUpperCase?.()} · {player.scoreFor}:{player.scoreAgainst}</small>
              </div>
            );
          })}
        </div>

        <input
          className="bp-replay-slider"
          type="range"
          min="0"
          max={Math.max(0, timeline.length - 1)}
          value={cursor}
          onChange={(e) => setCursor(Number(e.target.value))}
          disabled={timeline.length === 0}
        />

        <div className="bp-replay-events">
          {visibleEvents.length === 0 && <div className="bp-empty-msg">No submission events recorded.</div>}
          {visibleEvents.map((event, index) => (
            <div key={`${event.ts}-${index}`} className={`bp-replay-event ${event.type}`}>
              <span className="mono">{new Date(event.ts).toLocaleTimeString('ko-KR')}</span>
              <strong>User {event.userId}</strong>
              <span>P{event.problemId}</span>
              <span>{event.language || '-'}</span>
              <span>{event.type === 'pass' ? 'Pass' : 'Fail'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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
  const [phase, setPhase]           = useState('lobby');   // lobby | countdown | battle | ended
  const [countdown, setCountdown]   = useState(5);
  const [lobbyPhase, setLobbyPhase] = useState('idle');    // idle | invite_sent | invite_received
  const [opponentName, setOpponentName] = useState('');
  const [inviteInput, setInviteInput]   = useState('');
  const [inviteError, setInviteError]   = useState('');
  const [pendingInvite, setPendingInvite] = useState(null); // { roomId, inviterName }
  const [roomId, setRoomId] = useState(null);
  const [lobbyTab, setLobbyTab] = useState(location.pathname === '/battles/history' ? 'history' : 'active');
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const isReplayRoute = location.pathname.endsWith('/replay');
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
  const [selectedBattleMode, setSelectedBattleMode] = useState('time');
  const [spectatorMessages, setSpectatorMessages] = useState([]);
  const [spectatorMessage, setSpectatorMessage] = useState('');
  const [reactionBursts, setReactionBursts] = useState([]);

  const timerRef       = useRef(null);
  const typingTimerRef = useRef(null);
  const socketRef      = useRef(null);
  const lastTypingRef  = useRef(0);
  const lastOppTypingRef = useRef(0);
  const roomIdRef      = useRef(null);
  const pendingRoomRef = useRef(null);
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
          showLoadErrorToast(err?.response?.data?.message || 'Failed to load battle list.');
        }
      }
    };
    fetchBattles();
    const t = setInterval(fetchBattles, POLL_MS * 2);
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
          showLoadErrorToast(err?.response?.data?.message || 'Failed to load battle history.');
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

  // ── 카운트다운 (5→0 후 배틀 시작)
  useEffect(() => {
    if (phase !== 'countdown') return;
    let count = 5;
    setCountdown(count);
    const t = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(t);
        setPhase('battle');
        const pending = pendingRoomRef.current;
        if (pending) startTimer(pending.startTime, pending.duration);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [phase, startTimer]);

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
    const shouldConnect = Boolean(user?.id && roomId && (phase === 'battle' || phase === 'countdown' || lobbyPhase === 'invite_sent'));
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
      if (phase === 'battle' || phase === 'countdown') {
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
      pendingRoomRef.current = startedRoom;
      setCountdown(5);
      setPhase('countdown');
      setLobbyPhase('idle');
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
    socket.on('battle:spectator_chat', (message) => {
      setSpectatorMessages((prev) => [...prev.slice(-19), message]);
    });
    socket.on('battle:spectator_react', ({ emoji, at }) => {
      const id = `${emoji}-${at || Date.now()}-${Math.random()}`;
      setReactionBursts((prev) => [...prev.slice(-8), { id, emoji }]);
      setTimeout(() => {
        setReactionBursts((prev) => prev.filter((item) => item.id !== id));
      }, 1600);
    });

    return () => {
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
      setSocketConnected(false);
    };
  }, [fetchRoomSnapshot, isSpectator, lobbyPhase, myTeamId, phase, room?.players, roomId, startTimer, user?.id]);

  const sendSpectatorMessage = () => {
    const text = spectatorMessage.trim();
    if (!text || !roomId) return;
    socketRef.current?.emit('battle:spectator_chat', { roomId, message: text });
    setSpectatorMessage('');
  };

  const sendSpectatorReaction = (emoji) => {
    if (!roomId) return;
    socketRef.current?.emit('battle:spectator_react', { roomId, emoji });
  };

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
      const payload = { username: inviteInput.trim(), language: selectedBattleLanguage, duration: selectedDuration, battleMode: selectedBattleMode };
      const { data } = await api.post('/battles/invite', payload);
      setRoomId(data.roomId);
      roomIdRef.current = data.roomId;
      setOpponentName(inviteInput.trim());
      setLobbyPhase('invite_sent');
      // invite_sent 상태에서 수락 대기 폴링
    } catch (err) {
      setInviteError(err.response?.data?.message || 'Failed to send invite');
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
          pendingRoomRef.current = r;
          setCountdown(5);
          setPhase('countdown');
          setLobbyPhase('idle');
        } else if (r.status === 'declined') {
          setLobbyPhase('idle');
          setInviteError('The opponent declined your invite.');
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
      pendingRoomRef.current = data.room;
      setCountdown(5);
      setPhase('countdown');
      setLobbyPhase('idle');
    } catch (err) {
      setInviteError(err.response?.data?.message || 'Failed to accept invite');
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
    const currentLang = room?.preferredLanguage || fallbackLang;
    const effectiveLang = getEffectiveJudgeLanguage(val, currentLang, judgeStatus?.supportedLanguages);
    setCodeMap(prev => ({ ...prev, [pid]: { ...(prev[pid] || {}), lang: effectiveLang, code: val } }));
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
        const lang = getEffectiveJudgeLanguage(code, room?.preferredLanguage || fallbackLang, judgeStatus?.supportedLanguages);
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
        [problem.id]: { detail: err.response?.data?.message || 'Grading request failed.', timeMs: null, memoryMb: null },
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
      toast?.show(err?.response?.data?.message || 'Failed to spectate.', 'error');
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
    return `DailyCoding 배틀에서 ${outcome}했습니다! 🔥 문제: ${primaryProblemTitle} | 점수 ${currentPlayer?.score ?? 0}:${opponentPlayer?.score ?? 0} | ${elapsedSec}초 경과`;
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
        toast?.show('Result shared successfully.', 'success');
        return;
      }

      const copied = await copyWithFallback(shareText);
      if (!copied) throw new Error('copy_failed');
      toast?.show('Result copied to clipboard.', 'success');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      toast?.show('Failed to share result.', 'error');
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
      toast?.show('Rematch request sent.', 'success');
    } catch (error) {
      toast?.show(error?.response?.data?.message || 'Failed to send rematch request.', 'error');
    } finally {
      setRematchPending(false);
    }
  };

  useEffect(() => {
    if (!params.roomId || !user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/battles/room/${params.roomId}`);
        if (cancelled) return;
        const room = data?.room;
        if (!room) { spectateBattle(params.roomId); return; }
        if (room.playerIds?.includes(Number(user.id))) {
          setRoom(room);
          setRoomId(params.roomId);
          setIsSpectator(false);
          if (room.status === 'active' || room.status === 'ended') {
            setPhase('battle');
            startTimer(room.startTime, room.duration);
          } else {
            const isInviter = Number(room.playerIds[0]) === Number(user.id);
            if (isInviter) {
              setLobbyPhase('invite_sent');
            } else {
              try {
                const { data: inv } = await api.get('/battles/invite');
                if (cancelled) return;
                const matched = inv?.invite?.roomId === params.roomId ? inv.invite : null;
                setPendingInvite(matched || { roomId: params.roomId, inviterName: 'Opponent' });
              } catch {
                if (!cancelled) setPendingInvite({ roomId: params.roomId, inviterName: 'Opponent' });
              }
              if (!cancelled) setLobbyPhase('invite_received');
            }
          }
        } else {
          spectateBattle(params.roomId);
        }
      } catch (err) {
        if (cancelled) return;
        if (err?.response?.status === 404) {
          toast?.show('Battle room not found.', 'error');
        } else {
          spectateBattle(params.roomId);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [params.roomId, user?.id]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: 이메일 인증 게이트
  // ─────────────────────────────────────────────────────────────────────────
  if (isReplayRoute) {
    return <BattleReplayViewer roomId={params.id || params.roomId} />;
  }

  if (!user?.emailVerified) return <EmailVerifyGate feature="Battle" />;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: 로비
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <div className="bp-page">
        {isFreePlan && (
          <div className="bp-free-plan-banner">
            Free plan users can use 1:1 Battle, but ad slots will be shown.
          </div>
        )}
        {isFreePlan && <BattleAdSlot slot={BATTLE_AD_SLOTS.lobby} />}
        <div className="bp-lobby">
          <div className="bp-lobby-hero">
            <div className="bp-lobby-icon">⚔️</div>
            <h1>Coding Battle</h1>
            <p>Challenge opponents in real-time coding duels.<br/>The team that captures all territories (problems) first wins!</p>
          </div>

          <div className="bp-lobby-main">
            <div className="bp-lobby-left">
              {lobbyPhase === 'idle' && (
                <div className="bp-invite-box">
                  <div className="bp-invite-title">Invite Opponent</div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    {BATTLE_MODES.map(m => (
                      <button
                        key={m.key}
                        onClick={() => setSelectedBattleMode(m.key)}
                        style={{
                          padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                          border: `1px solid ${selectedBattleMode === m.key ? 'var(--purple)' : 'var(--border)'}`,
                          background: selectedBattleMode === m.key ? 'rgba(188,140,255,.15)' : 'var(--bg3)',
                          color: selectedBattleMode === m.key ? 'var(--purple)' : 'var(--text2)',
                          cursor: 'pointer', transition: 'all .15s', fontFamily: 'inherit',
                        }}
                        title={m.desc}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10, opacity: selectedBattleMode === 'race' ? 0.4 : 1, pointerEvents: selectedBattleMode === 'race' ? 'none' : 'auto' }}>
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
                      placeholder="상대방 사용자 이름 입력"
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
                    Waiting for <strong>{opponentName}</strong> to accept...
                  </div>
                  <div className="bp-waiting-sub">The opponent must accept within 2 minutes.</div>
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
                      <div className="bp-invite-name">{pendingInvite.inviterName} has challenged you to a Battle!</div>
                      <div className="bp-invite-sub">If you don't accept now, the invite expires in 2 minutes.</div>
                    </div>
                  </div>
                  <div className="bp-invite-actions">
                    <button className="bp-btn-primary" onClick={acceptInvite}>Accept</button>
                    <button className="bp-btn-danger"  onClick={declineInvite}>Decline</button>
                  </div>
                </div>
              )}

              <div className="bp-active-battles">
                <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                  <button className="bp-btn-small" onClick={() => setLobbyTab('active')} style={{ opacity: lobbyTab === 'active' ? 1 : 0.7 }}>Active Battles</button>
                  <button className="bp-btn-small" onClick={() => setLobbyTab('history')} style={{ opacity: lobbyTab === 'history' ? 1 : 0.7 }}>History</button>
                </div>
                {lobbyTab === 'active' ? (
                  <>
                    <div className="bp-section-title">Active Battles (Spectate available)</div>
                    {activeBattles.length === 0 ? (
                      <div className="bp-empty-msg">No battles in progress right now.</div>
                    ) : (
                      <div className="bp-battle-list">
                        {activeBattles.map(b => {
                          const elapsed = b.startTime ? Math.floor((Date.now() - b.startTime) / 1000) : 0;
                          const remaining = Math.max(0, (b.duration || BATTLE_SEC) - elapsed);
                          const showTimer = b.battleMode !== 'race' && b.startTime;
                          return (
                            <div key={b.id} className="bp-battle-item">
                              <div className="bp-battle-info">
                                <span className="bp-battle-tag">{b.isTeamBattle ? 'Team' : '1v1'}</span>
                                <span>{Object.values(b.players).map(p => p.username).join(' vs ')}</span>
                                {showTimer && (
                                  <span className="mono" style={{ fontSize: 11, color: remaining < 60 ? 'var(--red)' : remaining < 300 ? 'var(--yellow)' : 'var(--text3)', marginLeft: 4 }}>
                                    ⏱ {fmtTime(remaining)}
                                  </span>
                                )}
                              </div>
                              <button className="bp-btn-small" onClick={() => spectateBattle(b.id)}>Spectate</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="bp-section-title">My Battle History</div>
                    {historyRows.length > 0 && (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:14 }}>
                        {[
                          ['W', historyRows.filter(r=>r.result==='win').length, 'var(--green)'],
                          ['L', historyRows.filter(r=>r.result==='lose').length, 'var(--red)'],
                          ['D', historyRows.filter(r=>r.result==='draw').length, 'var(--yellow)'],
                        ].map(([label, count, color]) => (
                          <div key={label} style={{ padding:'10px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, textAlign:'center' }}>
                            <div style={{ color, fontSize:20, fontWeight:900 }}>{count}</div>
                            <div style={{ color:'var(--text3)', fontSize:11 }}>{label}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {historyLoading ? (
                      <div className="bp-empty-msg">Loading history...</div>
                    ) : historyRows.length === 0 ? (
                      <div className="bp-empty-msg">No completed battles yet.</div>
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
                              Score {row.scoreFor} : {row.scoreAgainst} · Solved {row.solvedFor} : {row.solvedAgainst}
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
                                Rematch
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
              <div className="bp-rules-title">Battle Rules</div>
              {selectedBattleMode === 'race' ? (
                <ul>
                  <li>🏁 First-to-finish: <strong>Solve all problems first to win instantly.</strong></li>
                  <li>⏰ No time limit: Speed decides the winner. Be fast and accurate!</li>
                  <li>🗺️ Territory capture: The team that answers first claims the territory; the opposing team cannot attempt that problem.</li>
                  <li>🎯 Strategy: Claim easy problems quickly, then focus on harder ones.</li>
                  <li>👥 Team battle: Communicate in real-time and divide roles to capture all territories fast.</li>
                  <li>👁️ Spectate mode: You can watch other players' battles in real-time.</li>
                </ul>
              ) : (
                (() => {
                  const dur = BATTLE_DURATIONS.find(d => d.sec === selectedDuration) || BATTLE_DURATIONS[1];
                  return (
                    <ul>
                      <li>⏱️ Time limit: <strong>{dur.desc}</strong> ({dur.label.replace(/[^\w가-힣]/g, '').trim()} mode)</li>
                      {dur.sec === 300 && <li>⚡ Blitz: Quick thinking is key. Claim easy problems first.</li>}
                      {dur.sec === 3600 && <li>🏔️ Marathon: Use the extra time to tackle hard problems. Teamwork and role division matter.</li>}
                      <li>🗺️ Territory capture: The team that answers first claims the territory; the opposing team cannot attempt that problem.</li>
                      <li>👥 Team battle: Combine scores with teammates and split problems in real-time.</li>
                      <li>👁️ Spectate mode: You can watch other players' battles in real-time.</li>
                    </ul>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: 카운트다운
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'countdown') {
    const players = Object.values(room?.players || {});
    return (
      <div className="bp-page" style={{ display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8, background:'var(--bg)' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:13, color:'var(--text3)', letterSpacing:3, marginBottom:16, textTransform:'uppercase' }}>배틀 시작까지</div>
          <div style={{ fontSize:128, fontWeight:900, color: countdown > 0 ? 'var(--blue)' : 'var(--green)', lineHeight:1, fontFamily:'Space Mono,monospace', minWidth:160, transition:'color 0.3s' }}>
            {countdown > 0 ? countdown : '🔥'}
          </div>
          <div style={{ fontSize:15, color:'var(--text2)', marginTop:20 }}>
            {countdown > 0 ? '잠시 후 문제가 공개됩니다...' : '배틀 시작!'}
          </div>
          {players.length > 0 && (
            <div style={{ marginTop:28, display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
              {players.map(p => (
                <div key={p.id} style={{ padding:'6px 18px', borderRadius:20, background:'var(--bg3)', border:`2px solid ${p.teamId === 'team_1' ? 'var(--blue)' : 'var(--red)'}`, fontSize:14, fontWeight:600, color:'var(--text)' }}>
                  {p.id === myId ? `${p.username} (나)` : p.username}
                </div>
              ))}
            </div>
          )}
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
    const codeEntry = codeMap[pid] || { code: '', lang: battleLang };
    const codeLang = getEffectiveJudgeLanguage(codeEntry.code, codeEntry.lang || battleLang, judgeStatus?.supportedLanguages);
    const battleLangLabel = JUDGE_LANGUAGE_OPTIONS.find((option) => option.value === codeLang)?.label || codeLang;

    const players = Object.values(room.players || {});
    const team1Score = players.filter(p => p.teamId === 'team_1').reduce((acc, p) => acc + p.score, 0);
    const team2Score = players.filter(p => p.teamId === 'team_2').reduce((acc, p) => acc + p.score, 0);
    const myTeamScore = myTeamId === 'team_2' ? team2Score : team1Score;
    const opponentTeamScore = myTeamId === 'team_2' ? team1Score : team2Score;
    const opponentPlayers = players.filter((p) => p.teamId !== myTeamId);
    const opponentLabel = opponentPlayers.map((p) => p.username).join(', ') || 'Opponent';

    return (
      <div className="bp-page bp-battle-page">
        {isFreePlan && <BattleAdSlot slot={BATTLE_AD_SLOTS.battle} />}
        {isSpectator && <div className="bp-spectator-banner">👁️ 관전 중입니다 (읽기 전용)</div>}
        
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
            {room?.battleMode === 'race'
              ? <div className="bp-timer" style={{ fontSize: 18, letterSpacing: 1 }}>🏁 First to Finish</div>
              : <div className={`bp-timer ${timeLeft < 60 ? 'urgent' : timeLeft < 300 ? 'warning' : ''}`}>{fmtTime(timeLeft)}</div>
            }
            {opponentTyping && <div className="bp-opp-typing">⌨️ Typing...</div>}
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

        <div className="bp-scoreboard" aria-label="Current battle score">
          <div className="bp-score-card mine">
            <span className="bp-score-label">My Score</span>
            <strong>{myTeamScore} pts</strong>
            <small>{me?.username || 'Me'}</small>
          </div>
          <div className="bp-score-card opponent">
            <span className="bp-score-label">Opponent Score</span>
            <strong>{opponentTeamScore} pts</strong>
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
                {byMe  && <span className="bp-territory-flag">🏳️ Captured</span>}
                {byOpp && <span className="bp-territory-flag">🔒 Taken</span>}
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
                {isLocked && <span className="bp-locked-badge">🔒 Claimed by opponent</span>}
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
                  lang={codeLang}
                  lockedLanguageLabel={battleLangLabel}
                  onCodeChange={val => handleCodeChange(pid, val)}
                  onInsertStarter={(starter) => handleCodeChange(pid, starter)}
                  locked={isLocked || isSpectator}
                  result={submitResults[pid]}
                  judgeDetail={judgeDetails[pid]}
                />
              )}

              {!isLocked && !isMine && !isSpectator && submitResults[pid] !== true && submitResults[pid] !== 'correct' && submitResults[pid] !== 'locked' && (
                <button
                  className="bp-btn-submit"
                  onClick={() => submitAnswer(activeProblem)}
                  disabled={submitting}
                >
                  {submitting ? '채점 중...' : '제출'}
                </button>
              )}

              {(!isSpectator && (submitResults[pid] === false || submitResults[pid] === 'wrong')) && (
                <div className="bp-feedback wrong">Incorrect. Please try again.</div>
              )}
              {(!isSpectator && (isMine || submitResults[pid] === true || submitResults[pid] === 'correct')) && (
                <div className="bp-feedback correct">Correct! Territory captured 🎉</div>
              )}
              {(!isSpectator && submitResults[pid] === 'error') && (
                <div className="bp-feedback error">{judgeDetails[pid]?.detail || 'An error occurred during grading. Please try again.'}</div>
              )}
              {(!isSpectator && submitResults[pid] === 'locked') && (
                <div className="bp-feedback locked">This territory has already been claimed by the opposing team.</div>
              )}
              {(isSpectator && lockedTeamId) && (
                <div className={`bp-feedback ${lockedTeamId === 'team_1' ? 'team1' : 'team2'}`}>
                  {lockedTeamId === 'team_1' ? 'Team 1' : 'Team 2'} has captured this territory.
                </div>
              )}
            </>
          )}
        </div>

        {isSpectator && (
          <div className="bp-spectator-panel">
            <div className="bp-spectator-reactions">
              {['🔥','👏','😮','💡','⚡'].map((emoji) => (
                <button key={emoji} type="button" onClick={() => sendSpectatorReaction(emoji)}>{emoji}</button>
              ))}
            </div>
            <div className="bp-reaction-stage" aria-hidden="true">
              {reactionBursts.map((item) => <span key={item.id}>{item.emoji}</span>)}
            </div>
            <div className="bp-spectator-chat">
              <div className="bp-spectator-chat-log">
                {spectatorMessages.length === 0 ? (
                  <div className="bp-spectator-empty">아직 관전자 메시지가 없습니다.</div>
                ) : spectatorMessages.map((item, index) => (
                  <div key={`${item.at}-${index}`} className="bp-spectator-message">
                    <strong>{item.username || 'Anonymous'}</strong>
                    <span>{item.message}</span>
                  </div>
                ))}
              </div>
              <div className="bp-spectator-chat-input">
                <input
                  value={spectatorMessage}
                  onChange={(e) => setSpectatorMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendSpectatorMessage(); }}
                  maxLength={100}
                  placeholder="관전자 응원 메시지"
                />
                <button type="button" onClick={sendSpectatorMessage}>전송</button>
              </div>
            </div>
          </div>
        )}
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
            {won ? '🏆 Victory!' : draw ? '🤝 Draw' : '💀 Defeat'}
          </div>
          <div className="bp-result-scores">
            <div className="bp-result-player me">
              <div className="bp-result-name">{me?.username} (You)</div>
              <div className="bp-result-pts">{myScore} pts</div>
              <div className="bp-result-solved">{me?.solved?.length ?? 0} solved</div>
            </div>
            <div className="bp-result-vs">VS</div>
            <div className="bp-result-player opp">
              <div className="bp-result-name">{opp?.username}</div>
              <div className="bp-result-pts">{oppScore} pts</div>
              <div className="bp-result-solved">{opp?.solved?.length ?? 0} solved</div>
            </div>
          </div>

          <div className="bp-result-territory">
            <div className="bp-result-section-title">Territory Results</div>
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
                      {byMe ? `🏳️ My Team` : byOpp ? `🏴 Opponent` : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bp-result-notice">
            ℹ️ Battle results do not affect your rating or tier.
          </div>

          <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
            <button className="bp-btn-small" onClick={() => requestRematch(room.id, opp?.username)} disabled={rematchPending}>
              {rematchPending ? 'Requesting...' : '🔄 Rematch'}
            </button>
            <button className="bp-btn-small" onClick={() => navigate('/battles/history')}>
              🕘 History
            </button>
            <button className="bp-btn-small" onClick={handleShareCopy}>📋 Copy</button>
            <button className="bp-btn-small" onClick={handleShareTwitter}>🐦 Twitter</button>
          </div>

          <button className="bp-btn-primary" onClick={resetBattleStateToLobby}>
            Play Again
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
