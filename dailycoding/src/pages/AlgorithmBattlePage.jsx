import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Ban, MessageCircle, Play, Plus, Shield, Smile, Swords, Trophy, Zap } from 'lucide-react';
import api from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { JUDGE_LANGUAGE_OPTIONS } from '../data/judgeLanguages.js';
import './AlgorithmBattlePage.css';

const Editor = lazy(() => import('@monaco-editor/react'));

const DEFAULT_CODE = `import sys

input = sys.stdin.readline
n = int(input())
arr = list(map(int, input().split()))
arr.sort()
print(*arr)
`;

const FALLBACK_MODES = [
  {
    key: 'sort-speed',
    title: '정렬 스피드전',
    description: '빠르고 정확한 제출이 공격력으로 전환됩니다.',
    itemsEnabled: false,
    effectsEnabled: false,
    itemCooldownSec: 25,
  },
  {
    key: 'duel-effects',
    title: '효과 결투',
    description: '문제 효과와 아이템으로 상대를 흔드는 1:1 모드입니다.',
    itemsEnabled: true,
    effectsEnabled: true,
    itemCooldownSec: 20,
  },
  {
    key: 'chaos-items',
    title: '아이템 난투',
    description: '짧은 쿨다운 아이템으로 빠르게 주도권을 잡습니다.',
    itemsEnabled: true,
    effectsEnabled: true,
    itemCooldownSec: 12,
  },
];

const FALLBACK_BANNABLE_TAGS = ['정렬', '그래프', 'DP', '문자열', '구현', '수학', '탐색'];
const EMOTE_LABELS = {
  gg: 'GG',
  nice: 'NICE',
  oops: 'OOPS',
  focus: 'FOCUS',
  taunt: 'EZ?',
};

function getSocketOrigin() {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) return apiUrl.replace(/\/api$/, '');
  if (typeof window !== 'undefined' && /^51\d{2}$/.test(window.location.port)) {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }
  return typeof window !== 'undefined' ? window.location.origin : '';
}

function fmtMs(value) {
  return value == null ? '-' : `${value}ms`;
}

function fmtSec(seconds) {
  const sec = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function timeLeft(room) {
  if (!room?.startedAt || room.status !== 'playing') return room?.durationSec || 180;
  const elapsed = Math.floor((Date.now() - new Date(room.startedAt).getTime()) / 1000);
  return Math.max(0, (room.durationSec || 180) - elapsed);
}

function formatEvent(event) {
  if (!event) return { title: '', detail: '' };
  const payload = event.payload || {};
  if (event.type === 'player.attack') return { title: '공격 성공', detail: `damage ${payload.damage || 0} · score ${payload.score || 0}` };
  if (event.type === 'player.miss') return { title: '공격 실패', detail: payload.detail || '오답 제출' };
  if (event.type === 'problem.effect') return { title: payload.effectLabel || '문제 효과', detail: payload.description || '' };
  if (event.type === 'item.used') {
    const stat = payload.stat ? Object.entries(payload.stat).map(([key, value]) => `${key} ${value > 0 ? '+' : ''}${value}`).join(' · ') : '';
    return { title: payload.itemLabel || '아이템 사용', detail: stat };
  }
  if (event.type === 'player.chat') return { title: '채팅', detail: payload.message || '' };
  if (event.type === 'player.emote') return { title: '이모트', detail: EMOTE_LABELS[payload.emote] || payload.emote || '' };
  if (event.type === 'player.activity') return { title: '활동', detail: payload.activity || '' };
  return { title: event.type, detail: payload.damage ? `damage ${payload.damage}` : payload.score ? `score ${payload.score}` : '' };
}

function PlayerCard({ player, me, attacking, activity }) {
  const hpPct = Math.max(0, Math.min(100, player.characterHp || 0));
  return (
    <div className={`ab-player-card ${me ? 'me' : ''} ${attacking ? 'attacking' : ''}`}>
      <div className="ab-player-head">
        <div>
          <strong>{player.username}</strong>
          {me && <span>나</span>}
        </div>
        <b>{player.score}</b>
      </div>
      <div className="ab-hp">
        <div style={{ width: `${hpPct}%` }} />
      </div>
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

export default function AlgorithmBattlePage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [rooms, setRooms] = useState([]);
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [battleModes, setBattleModes] = useState(FALLBACK_MODES);
  const [bannableTags, setBannableTags] = useState(FALLBACK_BANNABLE_TAGS);
  const [selectedMode, setSelectedMode] = useState('duel-effects');
  const [bannedTags, setBannedTags] = useState([]);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [language, setLanguage] = useState(user?.defaultLanguage || 'python');
  const [submitting, setSubmitting] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [countdown, setCountdown] = useState(null);
  const [attackUserId, setAttackUserId] = useState(null);
  const [clock, setClock] = useState(0);
  const lastActivityRef = useRef(0);
  const currentRoom = state?.room || null;
  const config = state?.config || battleModes.find((mode) => mode.key === currentRoom?.mode) || FALLBACK_MODES[0];
  const participants = state?.participants || [];
  const problem = state?.problem || null;
  const events = state?.events || [];
  const activityByUserId = state?.activityByUserId || {};
  const latestSubmission = state?.submissions?.[0] || null;
  const me = participants.find((player) => player.userId === user?.id);
  const opponents = participants.filter((player) => player.userId !== user?.id);
  const sortedParticipants = useMemo(() => [...participants].sort((a, b) => b.score - a.score || b.characterHp - a.characterHp), [participants]);
  const recentEffect = useMemo(() => [...events].reverse().find((event) => event.type === 'problem.effect' || event.type === 'item.used'), [events]);
  const ownRecentItem = useMemo(() => [...events].reverse().find((event) => event.type === 'item.used' && event.userId === user?.id), [events, user?.id]);
  const itemCooldownLeft = useMemo(() => {
    if (!ownRecentItem?.createdAt) return 0;
    const cooldown = Number(config?.itemCooldownSec || 20) * 1000;
    const left = cooldown - (Date.now() - new Date(ownRecentItem.createdAt).getTime());
    return Math.max(0, Math.ceil(left / 1000));
  }, [clock, config?.itemCooldownSec, ownRecentItem]);

  const loadRooms = useCallback(async () => {
    try {
      const { data } = await api.get('/battles/rooms');
      setRooms(data.rooms || []);
    } catch {
      setRooms([]);
    }
  }, []);

  const loadBattleModes = useCallback(async () => {
    try {
      const { data } = await api.get('/battles/modes');
      if (Array.isArray(data.modes) && data.modes.length) setBattleModes(data.modes);
      if (Array.isArray(data.bannableTags) && data.bannableTags.length) setBannableTags(data.bannableTags);
    } catch {
      setBattleModes(FALLBACK_MODES);
      setBannableTags(FALLBACK_BANNABLE_TAGS);
    }
  }, []);

  const loadRoom = useCallback(async (id = roomId) => {
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/battles/rooms/${id}`);
      setState(data);
    } catch (err) {
      toast?.show(err.response?.data?.message || '배틀 방을 불러오지 못했습니다.', 'error');
      navigate('/battle', { replace: true });
    } finally {
      setLoading(false);
    }
  }, [navigate, roomId, toast]);

  useEffect(() => {
    if (roomId) return;
    loadBattleModes();
    loadRooms();
    const timer = setInterval(loadRooms, 4000);
    return () => clearInterval(timer);
  }, [loadBattleModes, loadRooms, roomId]);

  useEffect(() => {
    if (!roomId) {
      setState(null);
      return undefined;
    }
    loadRoom(roomId);
    return undefined;
  }, [loadRoom, roomId]);

  useEffect(() => {
    if (!roomId || !user?.id) return undefined;
    const socket = io(getSocketOrigin(), {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    socketRef.current = socket;
    socket.on('connect', () => {
      socket.emit('authenticate');
      socket.emit('battle:join', { roomId }, (ack) => {
        if (ack?.state) setState(ack.state);
      });
    });
    socket.on('battle:room:update', (nextState) => {
      if (nextState?.room?.id === roomId) setState(nextState);
    });
    socket.on('battle:countdown', ({ seconds }) => setCountdown(seconds || 3));
    socket.on('battle:started', (nextState) => {
      if (nextState?.room?.id === roomId) setState(nextState);
      setCountdown(null);
    });
    socket.on('battle:submission:result', (payload) => {
      toast?.show(payload.result === 'correct' ? '공격 성공' : '공격 실패', payload.result === 'correct' ? 'success' : 'warning');
    });
    socket.on('battle:player:attack', (event) => {
      setAttackUserId(event.userId);
      setTimeout(() => setAttackUserId(null), 700);
    });
    socket.on('battle:finished', (nextState) => {
      if (nextState?.room?.id === roomId) setState(nextState);
      toast?.show('배틀이 종료되었습니다.', 'info');
    });
    socket.on('battle:effect', (event) => {
      toast?.show(event?.payload?.effectLabel || '문제 효과 발동', 'info');
    });
    socket.on('battle:item:used', (event) => {
      toast?.show(event?.payload?.itemLabel || '아이템 사용', 'info');
    });
    return () => {
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [roomId, toast, user?.id]);

  useEffect(() => {
    const timer = setInterval(() => setClock((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (countdown == null) return undefined;
    if (countdown <= 0) {
      setCountdown(null);
      return undefined;
    }
    const timer = setTimeout(() => setCountdown((value) => value == null ? null : value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (!currentRoom || currentRoom.status !== 'playing') return undefined;
    const left = timeLeft(currentRoom);
    if (left > 0) return undefined;
    api.post(`/battles/rooms/${currentRoom.id}/finish`, { reason: 'timeout' }).catch(() => {});
    return undefined;
  }, [clock, currentRoom]);

  const emitActivity = useCallback((activity, message = '') => {
    if (!roomId || !socketRef.current?.connected) return;
    const now = Date.now();
    if (now - lastActivityRef.current < 2500) return;
    lastActivityRef.current = now;
    socketRef.current.emit('battle:activity', { roomId, activity, message });
  }, [roomId]);

  const toggleBannedTag = (tag) => {
    setBannedTags((prev) => {
      if (prev.includes(tag)) return prev.filter((item) => item !== tag);
      if (prev.length >= 3) return prev;
      return [...prev, tag];
    });
  };

  const createRoom = async () => {
    setCreating(true);
    try {
      const { data } = await api.post('/battles/rooms', {
        mode: selectedMode,
        maxPlayers: 2,
        durationSec: battleModes.find((mode) => mode.key === selectedMode)?.durationSec || 180,
        bannedTags,
      });
      navigate(`/battle/${data.room.id}`);
    } catch (err) {
      toast?.show(err.response?.data?.message || '방 생성 실패', 'error');
    } finally {
      setCreating(false);
    }
  };

  const joinRoom = async (id) => {
    try {
      await api.post(`/battles/rooms/${id}/join`);
      navigate(`/battle/${id}`);
    } catch (err) {
      toast?.show(err.response?.data?.message || '방 참가 실패', 'error');
    }
  };

  const ready = async () => {
    if (!currentRoom) return;
    try {
      const { data } = await api.post(`/battles/rooms/${currentRoom.id}/ready`);
      setState(data);
    } catch (err) {
      toast?.show(err.response?.data?.message || '준비 실패', 'error');
    }
  };

  const submit = async () => {
    if (!currentRoom || submitting) return;
    setSubmitting(true);
    try {
      emitActivity('채점 요청 중');
      const { data } = await api.post(`/battles/rooms/${currentRoom.id}/submit`, { code, language });
      setState(data);
      toast?.show(data.submissionResult === 'correct' ? '제출 성공' : '제출 실패', data.submissionResult === 'correct' ? 'success' : 'warning');
    } catch (err) {
      toast?.show(err.response?.data?.message || '제출 실패', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const sendChat = async (event) => {
    event.preventDefault();
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
    } catch (err) {
      toast?.show(err.response?.data?.message || '이모트 전송 실패', 'error');
    }
  };

  const useItem = async (itemType) => {
    if (!currentRoom || itemCooldownLeft > 0) return;
    try {
      const { data } = await api.post(`/battles/rooms/${currentRoom.id}/item`, { itemType });
      if (data.state) setState(data.state);
    } catch (err) {
      toast?.show(err.response?.data?.message || '아이템 사용 실패', 'error');
    }
  };

  const leave = async () => {
    if (!currentRoom) return;
    try {
      await api.post(`/battles/rooms/${currentRoom.id}/leave`);
    } catch {
      // leaving is best-effort
    }
    navigate('/battle');
  };

  if (!roomId) {
    return (
      <div className="ab-page">
        <div className="ab-header">
          <div>
            <h1>실시간 알고리즘 배틀</h1>
            <p>같은 정렬 문제를 동시에 풀고, 실행 성능으로 공격력과 속도를 겨룹니다.</p>
          </div>
          <button className="btn btn-primary" onClick={createRoom} disabled={creating}>
            {creating ? <span className="spinner" /> : <Plus size={16} />} 방 만들기
          </button>
        </div>

        <section className="ab-mode-strip">
          {battleModes.map((mode) => (
            <button
              type="button"
              key={mode.key}
              className={`ab-mode ${selectedMode === mode.key ? 'active' : ''}`}
              onClick={() => setSelectedMode(mode.key)}
            >
              {mode.itemsEnabled ? <Shield size={18} /> : <Swords size={18} />}
              <div>
                <strong>{mode.title}</strong>
                <span>{mode.description}</span>
              </div>
            </button>
          ))}
        </section>

        <section className="ab-ban-panel">
          <div>
            <div className="ab-section-title">문제 영역 밴</div>
            <p>최대 3개까지 밴하면 자동 선택 문제에서 해당 영역을 우선 제외합니다.</p>
          </div>
          <div className="ab-ban-tags">
            {bannableTags.map((tag) => (
              <button
                type="button"
                key={tag}
                className={bannedTags.includes(tag) ? 'active' : ''}
                onClick={() => toggleBannedTag(tag)}
              >
                <Ban size={13} /> {tag}
              </button>
            ))}
          </div>
        </section>

        <section className="ab-room-list">
          <div className="ab-section-title">방 목록</div>
          {rooms.length === 0 ? (
            <div className="ab-empty">대기 중인 방이 없습니다. 새 방을 만들어 시작하세요.</div>
          ) : rooms.map((item) => (
            <div key={item.room.id} className="ab-room-row">
              <div>
                <strong>{item.problem?.title || '정렬 배틀'}</strong>
                <span>{item.config?.title || item.room.mode} · {item.room.status} · {item.participants.length}/{item.room.maxPlayers}명 · {item.room.durationSec}s</span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => joinRoom(item.room.id)}>
                참가
              </button>
            </div>
          ))}
        </section>
      </div>
    );
  }

  return (
    <div className="ab-room-page">
      <div className="ab-room-top">
        <button className="btn btn-ghost btn-sm" onClick={leave}>← 나가기</button>
        <div>
          <strong>{problem?.title || '배틀 문제'}</strong>
          <span>{config?.title || currentRoom?.mode || 'battle'} · {currentRoom?.status || 'loading'} · 남은 시간 {fmtSec(timeLeft(currentRoom))}</span>
        </div>
        {currentRoom?.status === 'waiting' && (
          <button className="btn btn-success btn-sm" onClick={ready} disabled={me?.isReady}>준비 완료</button>
        )}
        {currentRoom?.status === 'playing' && (
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={submitting}>
            {submitting ? <span className="spinner" /> : <Play size={14} />} 제출
          </button>
        )}
      </div>

      {countdown != null && <div className="ab-countdown">{countdown}</div>}

      <div className="ab-room-grid">
        <aside className="ab-left">
          <div className="ab-section-title">참가자</div>
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

          <div className="ab-section-title">실시간 상태</div>
          <div className="ab-presence">
            {opponents.length === 0 ? (
              <span>상대 입장 대기 중</span>
            ) : opponents.map((player) => (
              <div key={player.userId}>
                <Zap size={14} />
                <span>{player.username}: {activityByUserId[String(player.userId)]?.label || '대기 중'}</span>
              </div>
            ))}
          </div>

          <div className="ab-section-title">순위표</div>
          <div className="ab-rank-list">
            {sortedParticipants.map((player, index) => (
              <div key={player.userId}>
                <span>#{index + 1} {player.username}</span>
                <strong>{player.score}</strong>
              </div>
            ))}
          </div>
        </aside>

        <main className="ab-center">
          <div className="ab-problem">
            <h2>{problem?.title || '문제 로딩 중'}</h2>
            <p>{problem?.desc || (loading ? '불러오는 중...' : '문제 정보가 없습니다.')}</p>
            {problem?.examples?.[0] && (
              <div className="ab-example">
                <pre>{problem.examples[0].input}</pre>
                <pre>{problem.examples[0].output}</pre>
              </div>
            )}
          </div>
          <div className="ab-editor-toolbar">
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="mono">
              {JUDGE_LANGUAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <span>{config.effectsEnabled ? '정답이면 공격 + 문제 효과 발동' : '정답이면 공격, 오답이면 공격 실패'}</span>
          </div>
          <div className="ab-editor">
            <Suspense fallback={<div className="ab-empty">에디터 로딩 중...</div>}>
              <Editor
                height="100%"
                language={JUDGE_LANGUAGE_OPTIONS.find((option) => option.value === language)?.monaco || 'python'}
                theme="vs-dark"
                value={code}
                onChange={(value) => {
                  setCode(value || '');
                  emitActivity('코드 작성 중');
                }}
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

        <aside className="ab-right">
          <div className="ab-section-title">전술</div>
          <div className="ab-tactics">
            {config.itemsEnabled ? (
              <div className="ab-item-grid">
                {(config.availableItems || []).map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    onClick={() => useItem(item.key)}
                    disabled={currentRoom?.status !== 'playing' || itemCooldownLeft > 0}
                    title={item.description}
                  >
                    <Shield size={14} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="ab-empty">이 모드는 아이템 없이 순수 성능으로 겨룹니다.</div>
            )}
            {config.itemsEnabled && itemCooldownLeft > 0 && <div className="ab-cooldown">아이템 쿨다운 {itemCooldownLeft}s</div>}
            {recentEffect && (
              <div className="ab-effect-card">
                <Zap size={15} />
                <div>
                  <strong>{formatEvent(recentEffect).title}</strong>
                  <span>{formatEvent(recentEffect).detail}</span>
                </div>
              </div>
            )}
          </div>

          <div className="ab-section-title">제출 결과</div>
          {latestSubmission ? (
            <div className={`ab-submit-card ${latestSubmission.isCorrect ? 'correct' : 'wrong'}`}>
              <strong>{latestSubmission.isCorrect ? '정답' : '오답'}</strong>
              <span>{latestSubmission.language} · {fmtMs(latestSubmission.executionTimeMs)} · +{latestSubmission.score}</span>
              <p>{latestSubmission.detail}</p>
            </div>
          ) : (
            <div className="ab-empty">아직 제출이 없습니다.</div>
          )}

          <div className="ab-section-title">전투 로그</div>
          <div className="ab-log">
            {events.length === 0 ? <span>이벤트가 없습니다.</span> : events.slice().reverse().map((event) => {
              const formatted = formatEvent(event);
              return (
                <div key={event.id}>
                  <b>{formatted.title}</b>
                  <span>{formatted.detail}</span>
                </div>
              );
            })}
          </div>

          <div className="ab-section-title">채팅 / 이모트</div>
          <div className="ab-social">
            <div className="ab-emotes">
              {(config.availableEmotes || Object.keys(EMOTE_LABELS)).map((emote) => (
                <button type="button" key={emote} onClick={() => sendEmote(emote)}>
                  <Smile size={13} /> {EMOTE_LABELS[emote] || emote}
                </button>
              ))}
            </div>
            <form onSubmit={sendChat} className="ab-chat-form">
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                maxLength={220}
                placeholder="메시지"
              />
              <button type="submit" className="btn btn-ghost btn-sm">
                <MessageCircle size={14} />
              </button>
            </form>
          </div>

          {currentRoom?.status === 'finished' && (
            <div className="ab-result">
              <Trophy size={22} />
              <strong>{sortedParticipants[0]?.userId === user?.id ? '승리' : '배틀 종료'}</strong>
              <span>최종 점수 {me?.score || 0}</span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
