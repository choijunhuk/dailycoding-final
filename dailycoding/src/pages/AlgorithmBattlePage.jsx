import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Copy, MessageCircle, Play, Plus, Shield, Smile, Swords, Trophy, Zap, Lock, Unlock, Clock } from 'lucide-react';
import api from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { JUDGE_LANGUAGE_OPTIONS } from '../data/judgeLanguages.js';
import './AlgorithmBattlePage.css';

const Editor = lazy(() => import('@monaco-editor/react'));

// ── 상수 ─────────────────────────────────────────────────────────────────────
const EMOTE_EMOJI = { gg: '🤝', nice: '👏', oops: '😅', focus: '🎯', taunt: '😏' };
const CHAT_SHORTCUTS = {
  gg: '🤝 GG', nice: '👏 Nice!', oops: '😅 Oops', focus: '🎯 집중!',
  wp: '✨ Well played!', gl: '🍀 Good luck!', ez: '😏 EZ', lol: '😂',
};
const COMBAT_EVENT_TYPES = new Set([
  'player.attack', 'player.miss', 'problem.effect',
  'item.used', 'territory.claimed', 'player.chat', 'player.emote',
]);
const DURATION_PRESETS = [
  { label: '⚡ 블리츠 5분', sec: 300 },
  { label: '⚔️ 스탠다드 10분', sec: 600 },
  { label: '🏔️ 마라톤 20분', sec: 1200 },
];
const FALLBACK_MODES = [
  { key: 'sort-speed', title: '⚡ 스피드전', description: '빠른 정답 제출이 공격력으로!', itemsEnabled: false, effectsEnabled: false, problemCount: 1 },
  { key: 'duel-effects', title: '✨ 효과전', description: '문제 효과와 아이템 전투', itemsEnabled: true, effectsEnabled: true, problemCount: 1 },
  { key: 'chaos-items', title: '🎒 아이템 난투', description: '짧은 쿨다운 아이템 배틀', itemsEnabled: true, effectsEnabled: true, problemCount: 1 },
  { key: 'territory', title: '🏴 점령전', description: '5문제 땅따먹기! 더 많이 점령하면 승리', itemsEnabled: false, effectsEnabled: false, problemCount: 5 },
];

function getSocketOrigin() {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) return apiUrl.replace(/\/api$/, '');
  if (typeof window !== 'undefined' && /^5\d{3}$/.test(window.location.port)) {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }
  return typeof window !== 'undefined' ? window.location.origin : '';
}

function fmtSec(seconds) {
  const sec = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function timeLeft(room) {
  if (!room?.startedAt || room.status !== 'playing') return room?.durationSec || 300;
  const elapsed = Math.floor((Date.now() - new Date(room.startedAt).getTime()) / 1000);
  return Math.max(0, (room.durationSec || 300) - elapsed);
}

function lobbyTimeLeft(room) {
  if (!room?.lobbyExpiresAt || room.status !== 'waiting') return null;
  return Math.max(0, Math.floor((new Date(room.lobbyExpiresAt).getTime() - Date.now()) / 1000));
}

function formatCombatEvent(event, myId) {
  if (!event || !COMBAT_EVENT_TYPES.has(event.type)) return null;
  const payload = event.payload || {};
  const isMe = event.userId === myId;
  const who = isMe ? '나' : '상대';

  switch (event.type) {
    case 'player.attack':
      return {
        emoji: isMe ? '⚔️' : '🩸',
        text: `${who} 공격 성공 +${payload.score || 0}점${payload.damage ? ` · 피해 ${payload.damage}` : ''}`,
        color: isMe ? 'var(--blue)' : 'var(--red)',
      };
    case 'player.miss':
      return { emoji: '💨', text: `${who} 오답`, color: 'var(--text3)' };
    case 'problem.effect':
      return { emoji: '✨', text: payload.effectLabel || '문제 효과 발동', color: 'var(--purple)' };
    case 'item.used': {
      const statStr = payload.stat
        ? Object.entries(payload.stat).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(' ')
        : '';
      return { emoji: '🎒', text: `${payload.itemLabel || '아이템'}${statStr ? ` (${statStr})` : ''}`, color: 'var(--yellow)' };
    }
    case 'territory.claimed':
      return { emoji: '🏴', text: `${who} 점령!`, color: isMe ? 'var(--blue)' : 'var(--red)' };
    case 'player.chat': {
      const msg = payload.message || '';
      const shortcut = CHAT_SHORTCUTS[msg.toLowerCase()];
      return { emoji: '💬', text: shortcut || msg, color: 'var(--text2)' };
    }
    case 'player.emote':
      return { emoji: EMOTE_EMOJI[payload.emote] || '😊', text: '', color: 'var(--text2)' };
    default:
      return null;
  }
}

function PlayerCard({ player, me, attacking, activity }) {
  const hpPct = Math.max(0, Math.min(100, player.characterHp || 0));
  return (
    <div className={`ab-player-card ${me ? 'me' : ''} ${attacking ? 'attacking' : ''}`}>
      <div className="ab-player-head">
        <div><strong>{player.username}</strong>{me && <span> 나</span>}</div>
        <b>{player.score}</b>
      </div>
      <div className="ab-hp"><div style={{ width: `${hpPct}%` }} /></div>
      <div className="ab-stats">
        <span>HP {player.characterHp}</span>
        <span>ATK {player.attackPower}</span>
        <span>SPD {player.speed}</span>
      </div>
      {activity && (
        <div className="ab-activity-pill">
          <Zap size={12} /> {activity.label}{activity.message ? ` · ${activity.message}` : ''}
        </div>
      )}
      {player.isReady && <div className="ab-ready">READY</div>}
    </div>
  );
}

function TerritoryBar({ problems, claims, myId, onSelect, selectedIdx }) {
  if (!problems?.length) return null;
  return (
    <div className="ab-territory-bar">
      {problems.map((prob, idx) => {
        const claimUserId = claims?.[String(prob.id)];
        const mine = claimUserId === myId;
        const theirs = claimUserId != null && !mine;
        return (
          <button
            key={prob.id}
            type="button"
            className={`ab-territory-tab ${selectedIdx === idx ? 'active' : ''} ${mine ? 'mine' : theirs ? 'theirs' : ''}`}
            onClick={() => onSelect(idx)}
          >
            <span className="ab-territory-num">#{idx + 1}</span>
            <span className="ab-territory-title">{prob.title}</span>
            <span className="ab-territory-flag">
              {mine ? '🏴' : theirs ? '🚩' : '⬜'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function AlgorithmBattlePage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const socketRef = useRef(null);

  // ── 로비 상태
  const [rooms, setRooms] = useState([]);
  const [battleModes, setBattleModes] = useState(FALLBACK_MODES);
  const [selectedMode, setSelectedMode] = useState('duel-effects');
  const [selectedDuration, setSelectedDuration] = useState(300);
  const [preferredLanguage, setPreferredLanguage] = useState(user?.defaultLanguage || 'python');
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joiningByCode, setJoiningByCode] = useState(false);

  // ── 방 상태
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);

  // ── 배틀 상태
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState(user?.defaultLanguage || 'python');
  const [submitting, setSubmitting] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [countdown, setCountdown] = useState(null);
  const [attackUserId, setAttackUserId] = useState(null);
  const [clock, setClock] = useState(0);
  const [selectedProblemIdx, setSelectedProblemIdx] = useState(0);

  const lastActivityRef = useRef(0);

  // ── 파생 상태
  const currentRoom = state?.room || null;
  const config = state?.config || FALLBACK_MODES.find((m) => m.key === currentRoom?.mode) || FALLBACK_MODES[0];
  const participants = state?.participants || [];
  const events = state?.events || [];
  const activityByUserId = state?.activityByUserId || {};
  const isTerritoryMode = currentRoom?.mode === 'territory';
  const problems = isTerritoryMode ? (state?.problems || []) : null;
  const activeProblem = isTerritoryMode
    ? (problems?.[selectedProblemIdx] || problems?.[0] || null)
    : (state?.problem || null);
  const territoryClaims = currentRoom?.territoryClaims || {};
  const latestSubmission = state?.submissions?.[0] || null;
  const me = participants.find((p) => p.userId === user?.id);
  const opponents = participants.filter((p) => p.userId !== user?.id);
  const sortedParticipants = useMemo(
    () => [...participants].sort((a, b) => b.score - a.score || b.characterHp - a.characterHp),
    [participants]
  );
  const combatEvents = useMemo(
    () => events.filter((e) => COMBAT_EVENT_TYPES.has(e.type)),
    [events]
  );
  const ownRecentItem = useMemo(
    () => [...events].reverse().find((e) => e.type === 'item.used' && e.userId === user?.id),
    [events, user?.id]
  );
  const itemCooldownLeft = useMemo(() => {
    if (!ownRecentItem?.createdAt) return 0;
    const cooldown = Number(config?.itemCooldownSec || 20) * 1000;
    return Math.max(0, Math.ceil((cooldown - (Date.now() - new Date(ownRecentItem.createdAt).getTime())) / 1000));
  }, [clock, config?.itemCooldownSec, ownRecentItem]);
  const myClaimCount = useMemo(
    () => Object.values(territoryClaims).filter((uid) => uid === user?.id).length,
    [territoryClaims, user?.id]
  );

  // ── 방 목록 폴링
  const loadRooms = useCallback(async () => {
    try {
      const { data } = await api.get('/battles/rooms');
      setRooms(data.rooms || []);
    } catch { setRooms([]); }
  }, []);

  const loadBattleModes = useCallback(async () => {
    try {
      const { data } = await api.get('/battles/modes');
      if (Array.isArray(data.modes) && data.modes.length) setBattleModes(data.modes);
    } catch { setBattleModes(FALLBACK_MODES); }
  }, []);

  const loadRoom = useCallback(async (id = roomId) => {
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/battles/rooms/${id}`);
      setState(data);
      // Apply room's preferred language to editor
      if (data?.room?.preferredLanguage) setLanguage(data.room.preferredLanguage);
    } catch (err) {
      toast?.show(err.response?.data?.message || '배틀 방을 불러오지 못했습니다.', 'error');
      navigate('/battle', { replace: true });
    } finally { setLoading(false); }
  }, [navigate, roomId, toast]);

  useEffect(() => {
    if (roomId) return;
    loadBattleModes();
    loadRooms();
    const t = setInterval(loadRooms, 4000);
    return () => clearInterval(t);
  }, [loadBattleModes, loadRooms, roomId]);

  useEffect(() => {
    if (!roomId) { setState(null); return; }
    loadRoom(roomId);
  }, [loadRoom, roomId]);

  // ── 소켓
  useEffect(() => {
    if (!roomId || !user?.id) return undefined;
    const socket = io(getSocketOrigin(), { transports: ['websocket', 'polling'], withCredentials: true });
    socketRef.current = socket;
    socket.on('connect', () => {
      socket.emit('authenticate');
      socket.emit('battle:join', { roomId }, (ack) => { if (ack?.state) setState(ack.state); });
    });
    socket.on('battle:room:update', (next) => { if (next?.room?.id === roomId) setState(next); });
    socket.on('battle:countdown', ({ seconds }) => setCountdown(seconds || 3));
    socket.on('battle:started', (next) => { if (next?.room?.id === roomId) setState(next); setCountdown(null); });
    socket.on('battle:submission:result', (payload) => {
      toast?.show(payload.result === 'correct' ? '⚔️ 공격 성공!' : '💨 공격 실패', payload.result === 'correct' ? 'success' : 'warning');
    });
    socket.on('battle:player:attack', (event) => {
      setAttackUserId(event.userId);
      setTimeout(() => setAttackUserId(null), 700);
    });
    socket.on('battle:finished', (next) => {
      if (next?.room?.id === roomId) setState(next);
      toast?.show('배틀이 종료되었습니다.', 'info');
    });
    socket.on('battle:effect', (event) => { toast?.show(event?.payload?.effectLabel || '문제 효과 발동', 'info'); });
    socket.on('battle:item:used', (event) => { toast?.show(event?.payload?.itemLabel || '아이템 사용', 'info'); });
    return () => { socket.disconnect(); if (socketRef.current === socket) socketRef.current = null; };
  }, [roomId, toast, user?.id]);

  // ── 틱 (타이머/쿨다운용)
  useEffect(() => {
    const t = setInterval(() => setClock((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // ── 카운트다운
  useEffect(() => {
    if (countdown == null || countdown <= 0) { setCountdown(null); return; }
    const t = setTimeout(() => setCountdown((v) => (v == null ? null : v - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ── 게임 타임아웃 체크
  useEffect(() => {
    if (!currentRoom || currentRoom.status !== 'playing') return;
    if (timeLeft(currentRoom) <= 0) {
      api.post(`/battles/rooms/${currentRoom.id}/finish`, { reason: 'timeout' }).catch(() => {});
    }
  }, [clock, currentRoom]);

  const emitActivity = useCallback((activity, message = '') => {
    if (!roomId || !socketRef.current?.connected) return;
    const now = Date.now();
    if (now - lastActivityRef.current < 2500) return;
    lastActivityRef.current = now;
    socketRef.current.emit('battle:activity', { roomId, activity, message });
  }, [roomId]);

  // ── 방 만들기
  const createRoom = async () => {
    setCreating(true);
    try {
      const modeConfig = battleModes.find((m) => m.key === selectedMode);
      const { data } = await api.post('/battles/rooms', {
        mode: selectedMode,
        maxPlayers: 2,
        durationSec: modeConfig?.key === 'territory' ? 600 : selectedDuration,
        isPrivate,
        preferredLanguage,
      });
      navigate(`/battle/${data.room.id}`);
    } catch (err) {
      toast?.show(err.response?.data?.message || '방 생성 실패', 'error');
    } finally { setCreating(false); }
  };

  // ── 코드로 입장
  const joinByCode = async () => {
    if (!joinCode.trim()) return;
    setJoiningByCode(true);
    try {
      const { data } = await api.get(`/battles/rooms/join-by-code/${joinCode.trim().toUpperCase()}`);
      navigate(`/battle/${data.roomId}`);
    } catch (err) {
      toast?.show(err.response?.data?.message || '유효하지 않은 초대 코드입니다.', 'error');
    } finally { setJoiningByCode(false); }
  };

  const joinRoom = async (id) => {
    try {
      await api.post(`/battles/rooms/${id}/join`);
      navigate(`/battle/${id}`);
    } catch (err) { toast?.show(err.response?.data?.message || '방 참가 실패', 'error'); }
  };

  const ready = async () => {
    if (!currentRoom) return;
    try {
      const { data } = await api.post(`/battles/rooms/${currentRoom.id}/ready`);
      setState(data);
    } catch (err) { toast?.show(err.response?.data?.message || '준비 실패', 'error'); }
  };

  const submit = async () => {
    if (!currentRoom || submitting) return;
    setSubmitting(true);
    try {
      emitActivity('채점 요청 중');
      const body = { code, language };
      if (isTerritoryMode && activeProblem) body.problemId = activeProblem.id;
      const { data } = await api.post(`/battles/rooms/${currentRoom.id}/submit`, body);
      setState(data);
    } catch (err) {
      toast?.show(err.response?.data?.message || '제출 실패', 'error');
    } finally { setSubmitting(false); }
  };

  const sendChat = async (e) => {
    e.preventDefault();
    const message = chatInput.trim();
    if (!currentRoom || !message) return;
    setChatInput('');
    try {
      const { data } = await api.post(`/battles/rooms/${currentRoom.id}/chat`, { message });
      if (data.state) setState(data.state);
    } catch (err) {
      toast?.show(err.response?.data?.message || '채팅 전송 실패', 'error');
      setChatInput(message);
    }
  };

  const sendEmote = async (emote) => {
    if (!currentRoom) return;
    try {
      const { data } = await api.post(`/battles/rooms/${currentRoom.id}/emote`, { emote });
      if (data.state) setState(data.state);
    } catch (err) { toast?.show(err.response?.data?.message || '이모트 전송 실패', 'error'); }
  };

  const useItem = async (itemType) => {
    if (!currentRoom || itemCooldownLeft > 0) return;
    try {
      const { data } = await api.post(`/battles/rooms/${currentRoom.id}/item`, { itemType });
      if (data.state) setState(data.state);
    } catch (err) { toast?.show(err.response?.data?.message || '아이템 사용 실패', 'error'); }
  };

  const leave = async () => {
    if (currentRoom) {
      try { await api.post(`/battles/rooms/${currentRoom.id}/leave`); } catch { /* best-effort */ }
    }
    navigate('/battle');
  };

  const copyInviteCode = () => {
    const code = currentRoom?.inviteCode;
    if (!code) return;
    navigator.clipboard?.writeText(code).then(() => toast?.show('초대 코드 복사됨!', 'success')).catch(() => {});
  };

  // ════════════════════════════════════════════════
  // RENDER: 로비 (방 없을 때)
  // ════════════════════════════════════════════════
  if (!roomId) {
    const isTerritorySelected = selectedMode === 'territory';
    return (
      <div className="ab-page">
        <div className="ab-header">
          <div>
            <h1>실시간 알고리즘 배틀</h1>
            <p>실력을 겨루고 상대 HP를 0으로 만들어 승리하세요.</p>
          </div>
        </div>

        {/* 방 만들기 카드 */}
        <section className="ab-create-card">
          <div className="ab-section-title">방 만들기</div>

          {/* 모드 선택 */}
          <div className="ab-mode-strip">
            {battleModes.map((mode) => (
              <button
                type="button"
                key={mode.key}
                className={`ab-mode ${selectedMode === mode.key ? 'active' : ''}`}
                onClick={() => setSelectedMode(mode.key)}
              >
                {mode.itemsEnabled ? <Shield size={16} /> : <Swords size={16} />}
                <div>
                  <strong>{mode.title}</strong>
                  <span>{mode.description}</span>
                </div>
              </button>
            ))}
          </div>

          {/* 시간 + 언어 + 비밀방 설정 */}
          <div className="ab-create-options">
            {!isTerritorySelected && (
              <div className="ab-option-group">
                <label>게임 시간</label>
                <div className="ab-duration-pills">
                  {DURATION_PRESETS.map((d) => (
                    <button
                      key={d.sec}
                      type="button"
                      className={selectedDuration === d.sec ? 'active' : ''}
                      onClick={() => setSelectedDuration(d.sec)}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="ab-option-group">
              <label>언어 설정</label>
              <select
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                className="mono ab-lang-select"
              >
                {JUDGE_LANGUAGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="ab-option-group">
              <label>비밀방</label>
              <button
                type="button"
                className={`ab-private-toggle ${isPrivate ? 'active' : ''}`}
                onClick={() => setIsPrivate((v) => !v)}
              >
                {isPrivate ? <><Lock size={14} /> 비밀방 ON</> : <><Unlock size={14} /> 공개방</>}
              </button>
              {isPrivate && <p className="ab-private-hint">방 생성 후 초대 코드를 공유하세요.</p>}
            </div>
          </div>

          <button className="btn btn-primary ab-create-btn" onClick={createRoom} disabled={creating}>
            {creating ? <span className="spinner" /> : <Plus size={16} />} 방 만들기
          </button>
        </section>

        {/* 코드로 입장 */}
        <section className="ab-join-code-section">
          <div className="ab-section-title">초대 코드로 입장</div>
          <div className="ab-join-code-row">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && joinByCode()}
              placeholder="초대 코드 6자리 입력"
              maxLength={8}
              className="mono"
            />
            <button className="btn btn-ghost" onClick={joinByCode} disabled={joiningByCode || !joinCode.trim()}>
              {joiningByCode ? <span className="spinner" /> : '입장'}
            </button>
          </div>
        </section>

        {/* 공개 방 목록 */}
        <section className="ab-room-list">
          <div className="ab-section-title">공개 방 목록</div>
          {rooms.length === 0 ? (
            <div className="ab-empty">대기 중인 방이 없습니다. 새 방을 만들어 시작하세요.</div>
          ) : rooms.map((item) => {
            const modeLabel = battleModes.find((m) => m.key === item.room.mode)?.title || item.room.mode;
            return (
              <div key={item.room.id} className="ab-room-row">
                <div>
                  <strong>{item.problem?.title || '문제 로딩 중'}</strong>
                  <span>{modeLabel} · {item.participants.length}/{item.room.maxPlayers}명 · {fmtSec(item.room.durationSec)}</span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => joinRoom(item.room.id)}>참가</button>
              </div>
            );
          })}
        </section>
      </div>
    );
  }

  // ════════════════════════════════════════════════
  // RENDER: 방 내부
  // ════════════════════════════════════════════════
  const lobbyLeft = lobbyTimeLeft(currentRoom);

  return (
    <div className="ab-room-page">
      {/* 상단 바 */}
      <div className="ab-room-top">
        <button className="btn btn-ghost btn-sm" onClick={leave}>← 나가기</button>
        <div className="ab-room-title">
          <strong>{activeProblem?.title || '배틀'}</strong>
          <span>
            {config?.title || currentRoom?.mode} ·{' '}
            {currentRoom?.status === 'waiting'
              ? lobbyLeft != null ? `대기 중 (${fmtSec(lobbyLeft)} 남음)` : '대기 중'
              : currentRoom?.status === 'playing'
                ? `⏱ ${fmtSec(timeLeft(currentRoom))}`
                : '종료'}
          </span>
        </div>
        <div className="ab-room-actions">
          {currentRoom?.inviteCode && (
            <button className="btn btn-ghost btn-sm ab-invite-code" onClick={copyInviteCode} title="초대 코드 복사">
              <Copy size={13} /> {currentRoom.inviteCode}
            </button>
          )}
          {currentRoom?.status === 'waiting' && (
            <button className="btn btn-success btn-sm" onClick={ready} disabled={me?.isReady}>
              {me?.isReady ? '준비 완료 ✓' : '준비'}
            </button>
          )}
          {currentRoom?.status === 'playing' && (
            <button className="btn btn-primary btn-sm" onClick={submit} disabled={submitting}>
              {submitting ? <span className="spinner" /> : <><Play size={13} /> 제출</>}
            </button>
          )}
        </div>
      </div>

      {countdown != null && <div className="ab-countdown">{countdown > 0 ? countdown : '🔥 시작!'}</div>}

      {/* 점령전 문제 탭 */}
      {isTerritoryMode && problems && (
        <TerritoryBar
          problems={problems}
          claims={territoryClaims}
          myId={user?.id}
          onSelect={setSelectedProblemIdx}
          selectedIdx={selectedProblemIdx}
        />
      )}

      <div className="ab-room-grid">
        {/* 왼쪽: 플레이어 상태 */}
        <aside className="ab-left">
          <div className="ab-section-title">플레이어</div>
          <div className="ab-player-list">
            {participants.map((player) => (
              <PlayerCard
                key={player.userId}
                player={player}
                me={player.userId === user?.id}
                attacking={attackUserId === player.userId}
                activity={activityByUserId[String(player.userId)]}
              />
            ))}
          </div>

          {isTerritoryMode && (
            <>
              <div className="ab-section-title" style={{ marginTop: 12 }}>점령 현황</div>
              <div className="ab-territory-score">
                {participants.map((p) => {
                  const count = Object.values(territoryClaims).filter((uid) => uid === p.userId).length;
                  return (
                    <div key={p.userId} className="ab-territory-score-row">
                      <span>{p.username}{p.userId === user?.id ? ' (나)' : ''}</span>
                      <span className="ab-territory-count">{count} / {problems?.length || 5}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {!isTerritoryMode && (
            <>
              <div className="ab-section-title" style={{ marginTop: 12 }}>순위</div>
              <div className="ab-rank-list">
                {sortedParticipants.map((player, idx) => (
                  <div key={player.userId}>
                    <span>#{idx + 1} {player.username}</span>
                    <strong>{player.score}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>

        {/* 중앙: 문제 + 에디터 */}
        <main className="ab-center">
          {activeProblem ? (
            <div className="ab-problem">
              <h2>
                {activeProblem.title}
                {activeProblem.tier && (
                  <span className="ab-problem-tier" style={{ marginLeft: 8, fontSize: 12, opacity: 0.6 }}>
                    [{activeProblem.tier}]
                  </span>
                )}
              </h2>
              <p>{activeProblem.desc}</p>
              {activeProblem.examples?.[0] && (
                <div className="ab-example">
                  <pre><b>입력</b>{'\n'}{activeProblem.examples[0].input}</pre>
                  <pre><b>출력</b>{'\n'}{activeProblem.examples[0].output}</pre>
                </div>
              )}
            </div>
          ) : (
            <div className="ab-problem">
              <p style={{ color: 'var(--text3)' }}>{loading ? '불러오는 중...' : '대기 중 — 준비 완료 시 게임이 시작됩니다.'}</p>
            </div>
          )}

          <div className="ab-editor-toolbar">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="mono"
            >
              {JUDGE_LANGUAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>
              {config?.effectsEnabled ? '✨ 정답 → 공격 + 문제 효과' : '⚔️ 정답 → 공격'}
              {isTerritoryMode && ' 🏴 먼저 풀면 점령!'}
            </span>
          </div>

          <div className="ab-editor">
            <Suspense fallback={<div className="ab-empty">에디터 로딩 중...</div>}>
              <Editor
                height="100%"
                language={JUDGE_LANGUAGE_OPTIONS.find((o) => o.value === language)?.monaco || 'python'}
                theme="vs-dark"
                value={code}
                onChange={(v) => { setCode(v || ''); emitActivity('코드 작성 중'); }}
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  tabSize: 2,
                  fontFamily: "'Space Mono', 'Fira Code', Consolas, monospace",
                }}
              />
            </Suspense>
          </div>
        </main>

        {/* 오른쪽: 전술 + 로그 + 채팅 */}
        <aside className="ab-right">
          {/* 아이템 */}
          {config?.itemsEnabled && (
            <>
              <div className="ab-section-title">아이템</div>
              <div className="ab-tactics">
                <div className="ab-item-grid">
                  {(config.availableItems || []).map((item) => (
                    <button
                      type="button"
                      key={item.key}
                      onClick={() => useItem(item.key)}
                      disabled={currentRoom?.status !== 'playing' || itemCooldownLeft > 0}
                      title={item.description}
                    >
                      <Shield size={13} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
                {itemCooldownLeft > 0 && (
                  <div className="ab-cooldown"><Clock size={12} /> 쿨다운 {itemCooldownLeft}s</div>
                )}
              </div>
            </>
          )}

          {/* 제출 결과 */}
          <div className="ab-section-title">제출 결과</div>
          {latestSubmission ? (
            <div className={`ab-submit-card ${latestSubmission.isCorrect ? 'correct' : 'wrong'}`}>
              <strong>{latestSubmission.isCorrect ? '✅ 정답' : '❌ 오답'}</strong>
              <span>{latestSubmission.language} · {latestSubmission.executionTimeMs != null ? `${latestSubmission.executionTimeMs}ms` : '-'} · +{latestSubmission.score}</span>
              {latestSubmission.detail && <p>{latestSubmission.detail}</p>}
            </div>
          ) : (
            <div className="ab-empty">아직 제출이 없습니다.</div>
          )}

          {/* 전투 로그 */}
          <div className="ab-section-title">전투 로그</div>
          <div className="ab-log">
            {combatEvents.length === 0
              ? <span style={{ color: 'var(--text3)', fontSize: 12 }}>전투 이벤트 없음</span>
              : [...combatEvents].reverse().map((event) => {
                const fmt = formatCombatEvent(event, user?.id);
                if (!fmt) return null;
                return (
                  <div key={event.id} className="ab-log-entry" style={{ borderLeft: `2px solid ${fmt.color}` }}>
                    <span className="ab-log-emoji">{fmt.emoji}</span>
                    <span>{fmt.text}</span>
                  </div>
                );
              })}
          </div>

          {/* 채팅 + 이모트 */}
          <div className="ab-section-title">채팅 / 이모트</div>
          <div className="ab-social">
            <div className="ab-emotes">
              {(config?.availableEmotes || Object.keys(EMOTE_EMOJI)).map((emote) => (
                <button
                  type="button"
                  key={emote}
                  onClick={() => sendEmote(emote)}
                  title={emote}
                >
                  {EMOTE_EMOJI[emote] || <Smile size={13} />}
                </button>
              ))}
            </div>
            <form onSubmit={sendChat} className="ab-chat-form">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                maxLength={220}
                placeholder="채팅 (gg, nice, wp...)"
              />
              <button type="submit" className="btn btn-ghost btn-sm">
                <MessageCircle size={14} />
              </button>
            </form>
          </div>

          {/* 결과 */}
          {currentRoom?.status === 'finished' && (
            <div className="ab-result">
              <Trophy size={22} />
              <strong>
                {isTerritoryMode
                  ? myClaimCount > Math.floor((problems?.length || 5) / 2) ? '🏆 점령 승리!' : '배틀 종료'
                  : sortedParticipants[0]?.userId === user?.id ? '🏆 승리!' : '배틀 종료'}
              </strong>
              <span>
                {isTerritoryMode
                  ? `점령 ${myClaimCount}/${problems?.length || 5}`
                  : `최종 ${me?.score || 0}점`}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/battle')} style={{ marginTop: 8 }}>
                로비로
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
