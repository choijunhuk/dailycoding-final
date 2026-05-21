import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Copy, MessageCircle, Play, Plus, Shield, Smile, Swords, Trophy, Zap, Lock, Unlock, Clock } from 'lucide-react';
import api from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { JUDGE_LANGUAGE_OPTIONS } from '../data/judgeLanguages.js';
import { getSocketUrl } from '../utils/socket.js';
import './AlgorithmBattlePage.css';

const Editor = lazy(() => import('@monaco-editor/react'));

// ── 상수 ─────────────────────────────────────────────────────────────────────
const EMOTE_EMOJI = { gg: '🤝', nice: '👏', oops: '😅', focus: '🎯', taunt: '😏' };
const CHAT_SHORTCUTS = {
  gg: '🤝 GG', nice: '👏 Nice!', oops: '😅 Oops', focus: '🎯 Focus!',
  wp: '✨ Well played!', gl: '🍀 Good luck!', ez: '😏 EZ', lol: '😂',
};
const COMBAT_EVENT_TYPES = new Set([
  'player.attack', 'player.miss', 'problem.effect',
  'item.used', 'territory.claimed',
]);
const SOCIAL_EVENT_TYPES = new Set([
  'player.joined', 'player.left', 'player.ready', 'room.started',
  'room.problem_selected', 'draft.started', 'draft.selection', 'draft.completed',
  'player.chat', 'player.emote',
]);
const DURATION_PRESETS = [
  { label: '⚡ Blitz 5m', sec: 300 },
  { label: '⚔️ Standard 10m', sec: 600 },
  { label: '🏔️ Marathon 20m', sec: 1200 },
];
const FALLBACK_MODES = [
  { key: 'sort-speed', title: '⚡ Speed Race', description: 'Pure speed — first to submit the correct answer wins instantly.', winCondition: 'first-correct', rules: ['First correct submission wins immediately', 'Tie broken by score if time runs out'], itemsEnabled: false, effectsEnabled: false, problemCount: 1 },
  { key: 'survival', title: '💀 Survival', description: 'Reduce your opponent\'s HP to 0! Attack power grows with each correct submission.', winCondition: 'hp-knockout', rules: ['Correct answer → opponent HP decreases', 'Opponent HP 0 = instant win'], itemsEnabled: false, effectsEnabled: false, problemCount: 1 },
  { key: 'duel-effects', title: '✨ Effects Duel', description: 'Tag-based buffs/debuffs trigger on correct submissions! HP combat with random effects for comebacks.', winCondition: 'hp-knockout', rules: ['Correct answer → opponent HP loss + problem effect', 'Item cooldown 20s', 'HP 0 = defeat'], itemsEnabled: true, effectsEnabled: true, problemCount: 1 },
  { key: 'chaos-items', title: '🎒 Item Chaos', description: 'Fast-cooldown items to destabilize your opponent! Item strategy decides the match.', winCondition: 'hp-knockout', rules: ['Item cooldown 12s (fast)', 'Correct answer → opponent HP loss', 'HP 0 = defeat'], itemsEnabled: true, effectsEnabled: true, problemCount: 1 },
  { key: 'territory', title: '🏴 Territory', description: '5 problems revealed at once! Solve first to claim territory. Most territory wins.', winCondition: 'territory', rules: ['5 problems revealed simultaneously', 'Correct answer → claim that problem', 'Player with most territory wins'], itemsEnabled: false, effectsEnabled: false, problemCount: 5 },
  { key: 'draft-ban', title: '🚫 Draft Ban', description: 'Strategic 1v1 — both players ban/pick tiers and tags before the problem is locked in.', winCondition: 'hp-knockout', rules: ['No problem conditions at room creation', 'Draft starts after both players ready', 'Problem locked after draft', 'Correct answer → opponent HP loss + effect'], itemsEnabled: true, effectsEnabled: true, problemCount: 1, draftEnabled: true },
];

const FALLBACK_BANNABLE_TAGS = [
  '구현', '수학', '문자열', '정렬', '자료 구조', '해시',
  '그리디', '이분 탐색', '투 포인터', '누적 합', '다이나믹 프로그래밍',
  '그래프 이론', 'BFS', 'DFS', '최단 경로', '트리', '백트래킹',
];
const FALLBACK_PROBLEM_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
const PROBLEM_TIER_LABELS = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond',
};
const TAG_GROUP_LABELS = [
  { label: '기초', tags: ['입출력', '구현', '수학', '문자열', '정렬'] },
  { label: '자료구조', tags: ['자료 구조', '해시', '스택', '큐', '우선순위 큐'] },
  { label: '알고리즘', tags: ['그리디', '이분 탐색', '투 포인터', '누적 합', '다이나믹 프로그래밍', 'DP'] },
  { label: '그래프', tags: ['그래프 이론', '그래프', 'BFS', 'DFS', '최단 경로', '트리'] },
  { label: '심화', tags: ['백트래킹', '비트마스크', '분리 집합'] },
];
const DEFAULT_PROBLEM_FILTERS = {
  tierMode: 'auto',
  minTier: 'silver',
  maxTier: 'gold',
  allowedTiers: [],
  bannedTiers: [],
  requiredTags: [],
  bannedTags: [],
};


function fmtSec(seconds) {
  const sec = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function toggleListValue(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function sanitizeProblemFilters(filters, tiers) {
  const allowedTierSet = new Set(tiers);
  return {
    tierMode: filters.tierMode || 'auto',
    minTier: allowedTierSet.has(filters.minTier) ? filters.minTier : tiers[0],
    maxTier: allowedTierSet.has(filters.maxTier) ? filters.maxTier : tiers[tiers.length - 1],
    allowedTiers: (filters.allowedTiers || []).filter((tier) => allowedTierSet.has(tier)),
    bannedTiers: (filters.bannedTiers || []).filter((tier) => allowedTierSet.has(tier)),
    requiredTags: (filters.requiredTags || []).slice(0, 8),
    bannedTags: (filters.bannedTags || []).slice(0, 12),
  };
}

function getProblemFilterSummary(filters) {
  const parts = [];
  if (filters.tierMode === 'min') parts.push(`${PROBLEM_TIER_LABELS[filters.minTier] || filters.minTier}+`);
  if (filters.tierMode === 'max') parts.push(`≤${PROBLEM_TIER_LABELS[filters.maxTier] || filters.maxTier}`);
  if (filters.tierMode === 'range') parts.push(`${PROBLEM_TIER_LABELS[filters.minTier] || filters.minTier}~${PROBLEM_TIER_LABELS[filters.maxTier] || filters.maxTier}`);
  if (filters.tierMode === 'only' && filters.allowedTiers.length) {
    parts.push(filters.allowedTiers.map((tier) => PROBLEM_TIER_LABELS[tier] || tier).join(', '));
  }
  if (filters.bannedTiers.length) parts.push(`금지 티어: ${filters.bannedTiers.map((tier) => PROBLEM_TIER_LABELS[tier] || tier).join(', ')}`);
  if (filters.requiredTags.length) parts.push(`태그: ${filters.requiredTags.join(', ')}`);
  if (filters.bannedTags.length) parts.push(`금지 태그: ${filters.bannedTags.join(', ')}`);
  return parts.length ? parts.join(' · ') : '자동 추천';
}

function timeLeft(room) {
  if (!room?.startedAt || room.status !== 'playing') return room?.durationSec || 300;
  const elapsed = Math.floor((Date.now() - new Date(room.startedAt).getTime()) / 1000);
  return Math.max(0, (room.durationSec || 300) - elapsed);
}

function lobbyTimeLeft(room) {
  if (!room?.lobbyExpiresAt || room.status !== 'waiting') return null;
  const diff = Math.floor((new Date(room.lobbyExpiresAt).getTime() - Date.now()) / 1000);
  return diff < 0 ? 0 : Math.min(diff, 300);
}

function getBattleObjectiveText(config, isTerritoryMode) {
  if (isTerritoryMode) return '🏴 Claim territory by submitting correct answers';
  if (config?.winCondition === 'first-correct') return '⚡ First correct submission wins';
  if (config?.effectsEnabled) return '✨ Correct answer → attack + problem effect';
  return '⚔️ Correct answer → attack';
}

function formatCombatEvent(event, myId, participantById = {}) {
  if (!event || !COMBAT_EVENT_TYPES.has(event.type)) return null;
  const payload = event.payload || {};
  const isMe = event.userId === myId;
  const actor = participantById[String(event.userId)]?.username || (isMe ? 'me' : 'opponent');

  switch (event.type) {
    case 'player.attack':
      return {
        emoji: isMe ? '⚔️' : '🩸',
        label: `${actor} attack`,
        detail: `+${payload.score || 0}pts${payload.damage ? ` · dmg ${payload.damage}` : ''}`,
        color: isMe ? 'var(--blue)' : 'var(--red)',
      };
    case 'player.miss':
      return { emoji: '💨', label: `${actor} wrong`, detail: payload.detail || '', color: 'var(--text3)' };
    case 'problem.effect':
      return { emoji: '✨', label: payload.effectLabel || 'Problem effect', detail: payload.description || 'Effect triggered', color: 'var(--purple)' };
    case 'item.used': {
      const statStr = payload.stat
        ? Object.entries(payload.stat).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(' ')
        : '';
      return { emoji: '🎒', label: payload.itemLabel || 'Item', detail: statStr || 'Used', color: 'var(--yellow)' };
    }
    case 'territory.claimed':
      return { emoji: '🏴', label: `${actor} claimed`, detail: payload.problemId ? `Problem #${payload.problemId}` : '', color: isMe ? 'var(--blue)' : 'var(--red)' };
    default:
      return null;
  }
}

function formatSocialEvent(event, myId, participantById = {}) {
  if (!event || !SOCIAL_EVENT_TYPES.has(event.type)) return null;
  const payload = event.payload || {};
  const isMe = event.userId === myId;
  const actor = participantById[String(event.userId)]?.username || (isMe ? 'me' : 'opponent');

  switch (event.type) {
    case 'player.joined':
      return { kind: 'system', text: `${actor} joined.` };
    case 'player.left':
      return { kind: 'system', text: `${actor} left.` };
    case 'player.ready':
      return { kind: 'system', text: `${actor} is ready.` };
    case 'room.problem_selected':
      return { kind: 'system', text: 'Battle problem selected.' };
    case 'draft.started':
      return { kind: 'system', text: 'Draft started. Both players pick conditions and the problem will be finalized.' };
    case 'draft.selection':
      return { kind: 'system', text: `${actor} submitted draft.` };
    case 'draft.completed':
      return { kind: 'system', text: 'Draft complete. Battle problem finalized.' };
    case 'room.started':
      return { kind: 'system', text: 'All players ready. Battle started.' };
    case 'player.chat': {
      const msg = payload.message || '';
      const shortcut = CHAT_SHORTCUTS[msg.toLowerCase()];
      return { kind: isMe ? 'me' : 'chat', author: actor, text: shortcut || msg };
    }
    case 'player.emote':
      return { kind: isMe ? 'me' : 'chat', author: actor, text: EMOTE_EMOJI[payload.emote] || payload.emote || '😊' };
    default:
      return null;
  }
}

function PlayerCard({ player, me, attacking, activity, showHp = true }) {
  const hpPct = Math.max(0, Math.min(100, player.characterHp || 0));
  return (
    <div className={`ab-player-card ${me ? 'me' : ''} ${attacking ? 'attacking' : ''}`}>
      <div className="ab-player-head">
        <div><strong>{player.username}</strong>{me && <span> (me)</span>}</div>
        <b>{player.score}</b>
      </div>
      {showHp && <div className="ab-hp"><div style={{ width: `${hpPct}%` }} /></div>}
      <div className="ab-stats">
        {showHp && <span>HP {player.characterHp}</span>}
        {showHp && <span>ATK {player.attackPower}</span>}
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

function DraftBanPanel({
  draft,
  participants,
  me,
  problemTiers,
  tagGroups,
  bannedTier,
  setBannedTier,
  bannedTags,
  setBannedTags,
  pickedTags,
  setPickedTags,
  onSubmit,
  submitting,
  isSpectating,
}) {
  const submittedByUser = new Set((draft?.selections || []).map((selection) => Number(selection.userId)));
  const mySubmitted = me?.userId != null && submittedByUser.has(Number(me.userId));
  const canSubmit = !isSpectating && !mySubmitted && !submitting;

  const toggleBanTag = (tag) => {
    setBannedTags((prev) => {
      if (prev.includes(tag)) return prev.filter((item) => item !== tag);
      return prev.length >= 2 ? [prev[1], tag] : [...prev, tag];
    });
    setPickedTags((prev) => prev.filter((item) => item !== tag));
  };

  const togglePickTag = (tag) => {
    setPickedTags((prev) => (prev.includes(tag) ? [] : [tag]));
    setBannedTags((prev) => prev.filter((item) => item !== tag));
  };

  return (
    <div className="ab-draft-panel">
      <div className="ab-draft-head">
        <div>
          <strong>Draft Phase</strong>
          <span>{draft?.submittedCount || 0}/{draft?.requiredCount || 2} submitted</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={onSubmit} disabled={!canSubmit}>
          {mySubmitted ? 'Submitted ✓' : submitting ? <span className="spinner" /> : 'Submit Draft'}
        </button>
      </div>

      <div className="ab-draft-progress">
        {participants.map((player) => (
          <div key={player.userId} className={submittedByUser.has(Number(player.userId)) ? 'done' : ''}>
            <span>{player.username}{player.userId === me?.userId ? ' (me)' : ''}</span>
            <strong>{submittedByUser.has(Number(player.userId)) ? 'LOCKED' : 'PICKING'}</strong>
          </div>
        ))}
      </div>

      <div className="ab-draft-grid">
        <div className="ab-draft-block">
          <label>Ban Tier</label>
          <div className="ab-chip-list">
            {problemTiers.map((tier) => (
              <button
                type="button"
                key={tier}
                className={bannedTier === tier ? 'active danger' : ''}
                onClick={() => canSubmit && setBannedTier((prev) => (prev === tier ? '' : tier))}
                disabled={!canSubmit}
              >
                {PROBLEM_TIER_LABELS[tier] || tier}
              </button>
            ))}
          </div>
        </div>

        <div className="ab-draft-block">
          <label>Pick Preferred Tags</label>
          <div className="ab-tag-groups compact">
            {tagGroups.map((group) => (
              <div key={`draft-pick-${group.label}`} className="ab-tag-group">
                <span>{group.label}</span>
                <div className="ab-chip-list">
                  {group.tags.map((tag) => (
                    <button
                      type="button"
                      key={tag}
                      className={pickedTags.includes(tag) ? 'active include' : ''}
                      onClick={() => canSubmit && togglePickTag(tag)}
                      disabled={!canSubmit}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="ab-draft-block wide">
          <label>Ban Tags (max 2)</label>
          <div className="ab-tag-groups compact">
            {tagGroups.map((group) => (
              <div key={`draft-ban-${group.label}`} className="ab-tag-group">
                <span>{group.label}</span>
                <div className="ab-chip-list">
                  {group.tags.map((tag) => (
                    <button
                      type="button"
                      key={tag}
                      className={bannedTags.includes(tag) ? 'active danger' : ''}
                      onClick={() => canSubmit && toggleBanTag(tag)}
                      disabled={!canSubmit}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AlgorithmBattlePage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();
  const socketRef = useRef(null);

  // ── 로비 상태
  const [rooms, setRooms] = useState([]);
  const [battleModes, setBattleModes] = useState(FALLBACK_MODES);
  const [bannableTags, setBannableTags] = useState(FALLBACK_BANNABLE_TAGS);
  const [problemTiers, setProblemTiers] = useState(FALLBACK_PROBLEM_TIERS);
  const [selectedMode, setSelectedMode] = useState('duel-effects');
  const [selectedDuration, setSelectedDuration] = useState(300);
  const [preferredLanguage, setPreferredLanguage] = useState(user?.defaultLanguage || 'python');
  const [isPrivate, setIsPrivate] = useState(false);
  const [problemFilters, setProblemFilters] = useState(DEFAULT_PROBLEM_FILTERS);
  const [showProblemFilters, setShowProblemFilters] = useState(false);
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
  const [submissionResult, setSubmissionResult] = useState(null);
  const [mobileTab, setMobileTab] = useState('problem');
  const [chatInput, setChatInput] = useState('');
  const [spectatorMessages, setSpectatorMessages] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const [attackUserId, setAttackUserId] = useState(null);
  const [clock, setClock] = useState(0);
  const [selectedProblemIdx, setSelectedProblemIdx] = useState(0);
  const [showRules, setShowRules] = useState(false);
  const [draftBannedTier, setDraftBannedTier] = useState('');
  const [draftBannedTags, setDraftBannedTags] = useState([]);
  const [draftPickedTags, setDraftPickedTags] = useState([]);
  const [draftSubmitting, setDraftSubmitting] = useState(false);

  const lastActivityRef = useRef(0);
  const lobbyExpiredRef = useRef(false);
  const finishedRef = useRef(false);
  const chatFeedRef = useRef(null);

  // ── 파생 상태
  const currentRoom = state?.room || null;
  const config = state?.config || FALLBACK_MODES.find((m) => m.key === currentRoom?.mode) || FALLBACK_MODES[0];
  const participants = state?.participants || [];
  const events = state?.events || [];
  const activityByUserId = state?.activityByUserId || {};
  const isTerritoryMode = currentRoom?.mode === 'territory';
  const isDraftBanRoom = currentRoom?.mode === 'draft-ban';
  const draftState = state?.draft || null;
  const isDrafting = isDraftBanRoom && currentRoom?.status === 'waiting' && draftState?.phase === 'active';
  const problems = isTerritoryMode ? (state?.problems || []) : null;
  const activeProblem = isTerritoryMode
    ? (problems?.[selectedProblemIdx] || problems?.[0] || null)
    : (state?.problem || null);
  const territoryClaims = currentRoom?.territoryClaims || {};
  const latestSubmission = state?.submissions?.[0] || null;
  const me = participants.find((p) => p.userId === user?.id);
  const opponents = participants.filter((p) => p.userId !== user?.id);
  const hasOpponent = opponents.length > 0;
  const isSpectating = searchParams.get('spectate') === '1' || (currentRoom?.status === 'playing' && !me);
  const participantById = useMemo(
    () => Object.fromEntries(participants.map((player) => [String(player.userId), player])),
    [participants]
  );
  const sortedParticipants = useMemo(
    () => [...participants].sort((a, b) => b.score - a.score || b.characterHp - a.characterHp),
    [participants]
  );
  const combatEvents = useMemo(
    () => events.filter((e) => COMBAT_EVENT_TYPES.has(e.type)),
    [events]
  );
  const socialEvents = useMemo(
    () => events.filter((e) => SOCIAL_EVENT_TYPES.has(e.type)),
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
  const tagGroups = useMemo(() => {
    const available = new Set(bannableTags);
    const groups = TAG_GROUP_LABELS
      .map((group) => ({ ...group, tags: group.tags.filter((tag) => available.has(tag)) }))
      .filter((group) => group.tags.length > 0);
    const groupedTags = new Set(groups.flatMap((group) => group.tags));
    const extras = bannableTags.filter((tag) => !groupedTags.has(tag));
    return extras.length > 0 ? [...groups, { label: 'Other', tags: extras }] : groups;
  }, [bannableTags]);
  const normalizedProblemFilters = useMemo(
    () => sanitizeProblemFilters(problemFilters, problemTiers),
    [problemFilters, problemTiers]
  );

  // ── 방 목록 폴링
  const loadRooms = useCallback(async () => {
    try {
      const [waitingRes, playingRes] = await Promise.all([
        api.get('/battles/rooms', { params: { status: 'waiting', limit: 20 } }),
        api.get('/battles/rooms', { params: { status: 'playing', limit: 20 } }),
      ]);
      const merged = [...(waitingRes.data?.rooms || []), ...(playingRes.data?.rooms || [])];
      const seen = new Set();
      setRooms(merged.filter((item) => {
        const id = item?.room?.id;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      }));
    } catch { setRooms([]); }
  }, []);

  const loadBattleModes = useCallback(async () => {
    try {
      const { data } = await api.get('/battles/modes');
      if (Array.isArray(data.modes) && data.modes.length) setBattleModes(data.modes);
      if (Array.isArray(data.bannableTags) && data.bannableTags.length) setBannableTags(data.bannableTags);
      if (Array.isArray(data.problemTiers) && data.problemTiers.length) {
        setProblemTiers(data.problemTiers);
        setProblemFilters((prev) => sanitizeProblemFilters(prev, data.problemTiers));
      }
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
      toast?.show(err.response?.data?.message || 'Failed to load battle room.', 'error');
      navigate('/battle', { replace: true });
    } finally { setLoading(false); }
  }, [navigate, roomId, toast]);

    useEffect(() => {
      loadBattleModes();
      if (roomId) return;
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
    const socket = io(getSocketUrl(), { transports: ['websocket', 'polling'], withCredentials: true });
    socketRef.current = socket;
    socket.on('connect', () => {
      socket.emit('authenticate');
      if (searchParams.get('spectate') === '1') {
        socket.emit('battle:spectate', roomId);
      } else {
        socket.emit('battle:join', { roomId }, (ack) => {
          if (ack?.state) setState(ack.state);
          if (ack && ack.ok === false) {
            socket.emit('battle:spectate', roomId);
            navigate(`/battle/${roomId}?spectate=1`, { replace: true });
            toast?.show(ack.message || 'Switching to spectator mode.', 'info');
          }
        });
      }
    });
    socket.on('battle:room:update', (next) => { if (next?.room?.id === roomId) setState(next); });
    socket.on('battle:room:deleted', ({ roomId: deletedId }) => { if (deletedId === roomId) { toast?.show('Room deleted.', 'info'); navigate('/battle'); } });
    socket.on('battle:countdown', ({ seconds }) => setCountdown(seconds || 3));
    socket.on('battle:started', (next) => { if (next?.room?.id === roomId) setState(next); setCountdown(null); });
    socket.on('battle:submission:result', (payload) => {
      setSubmissionResult({ ...payload, receivedAt: Date.now() });
      toast?.show(payload.result === 'correct' ? '⚔️ Attack success!' : '💨 Attack failed', payload.result === 'correct' ? 'success' : 'warning');
    });
    socket.on('battle:player:attack', (event) => {
      setAttackUserId(event.userId);
      setTimeout(() => setAttackUserId(null), 700);
    });
    socket.on('battle:finished', (next) => {
      if (next?.room?.id !== roomId) return;
      const hasAnyOpponent = (next?.participants || []).some((p) => p.userId !== user?.id);
      if (!hasAnyOpponent) {
        toast?.show('Wait time expired. No opponent found, room closed.', 'warning');
        setTimeout(() => navigate('/battle', { replace: true }), 2500);
        return;
      }
      setState(next);
      toast?.show('Battle ended.', 'info');
    });
    socket.on('battle:effect', (event) => { toast?.show(event?.payload?.effectLabel || 'Problem effect triggered', 'info'); });
    socket.on('battle:item:used', (event) => { toast?.show(event?.payload?.itemLabel || 'Item used', 'info'); });
    socket.on('battle:spectator_chat', (msg) => {
      setSpectatorMessages((prev) => [...prev.slice(-39), { ...msg, isSpectator: true }]);
    });
    return () => { socket.disconnect(); if (socketRef.current === socket) socketRef.current = null; };
  }, [navigate, roomId, searchParams, toast, user?.id]);

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
      if (finishedRef.current) return;
      finishedRef.current = true;
      api.post(`/battles/rooms/${currentRoom.id}/finish`, { reason: 'timeout' }).catch(() => { /* best-effort timeout finish */ });
    }
  }, [clock, currentRoom]);

  // ── 로비 만료 체크 (대기 중 방) — 한 번만 실행
  useEffect(() => {
    lobbyExpiredRef.current = false;
    finishedRef.current = false;
    setSpectatorMessages([]);
    setDraftBannedTier('');
    setDraftBannedTags([]);
    setDraftPickedTags([]);
  }, [roomId]);

  // ── 채팅 자동 스크롤
  useEffect(() => {
    if (chatFeedRef.current) chatFeedRef.current.scrollTop = chatFeedRef.current.scrollHeight;
  }, [socialEvents, spectatorMessages]);
  useEffect(() => {
    if (!currentRoom || currentRoom.status !== 'waiting' || lobbyExpiredRef.current) return;
    const ll = lobbyTimeLeft(currentRoom);
    if (ll !== null && ll <= 0) {
      lobbyExpiredRef.current = true;
      toast?.show('Waiting time expired.', 'warning');
      const t = setTimeout(() => navigate('/battle', { replace: true }), 2500);
      return () => clearTimeout(t);
    }
  }, [clock, currentRoom, navigate, toast]);

  const emitActivity = useCallback((activity, message = '') => {
    if (!roomId || !socketRef.current?.connected) return;
    const now = Date.now();
    if (now - lastActivityRef.current < 2500) return;
    lastActivityRef.current = now;
    socketRef.current.emit('battle:activity', { roomId, activity, message });
  }, [roomId]);

  const updateProblemFilters = (patch) => {
    setProblemFilters((prev) => sanitizeProblemFilters({ ...prev, ...patch }, problemTiers));
  };

  const toggleFilterTier = (kind, tier) => {
    setProblemFilters((prev) => sanitizeProblemFilters({
      ...prev,
      [kind]: toggleListValue(prev[kind] || [], tier),
      ...(kind === 'bannedTiers' ? { allowedTiers: (prev.allowedTiers || []).filter((item) => item !== tier) } : {}),
      ...(kind === 'allowedTiers' ? { bannedTiers: (prev.bannedTiers || []).filter((item) => item !== tier) } : {}),
    }, problemTiers));
  };

  const toggleFilterTag = (kind, tag) => {
    setProblemFilters((prev) => {
      const otherKind = kind === 'requiredTags' ? 'bannedTags' : 'requiredTags';
      return {
        ...prev,
        [kind]: toggleListValue(prev[kind] || [], tag),
        [otherKind]: (prev[otherKind] || []).filter((item) => item !== tag),
      };
    });
  };

  // ── 방 만들기
    const createRoom = async () => {
      setCreating(true);
      try {
        const modeConfig = battleModes.find((m) => m.key === selectedMode);
        const safeFilters = sanitizeProblemFilters(normalizedProblemFilters, problemTiers);
        const roomProblemFilters = selectedMode === 'draft-ban' ? DEFAULT_PROBLEM_FILTERS : safeFilters;
        const { data } = await api.post('/battles/rooms', {
          mode: selectedMode,
          maxPlayers: 2,
          durationSec: modeConfig?.key === 'territory' ? 600 : selectedDuration,
          isPrivate,
          preferredLanguage,
          bannedTags: roomProblemFilters.bannedTags,
          problemFilters: roomProblemFilters,
        });
      if (data.room?.inviteCode && navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(data.room.inviteCode).then(() => {
          toast?.show(`Invite code ${data.room.inviteCode} copied.`, 'success');
        }).catch(() => {
          toast?.show(`Invite code: ${data.room.inviteCode}`, 'info');
        });
      }
      navigate(`/battle/${data.room.id}`);
    } catch (err) {
      if (err.response?.status === 409) {
        toast?.show(err.response.data?.message || 'You already have an active room.', 'error');
        try {
          const { data: listData } = await api.get('/battles/rooms', { params: { status: 'waiting' } });
          const myRoom = (listData.rooms || []).find((r) => r.room?.createdBy === user?.id);
          if (myRoom?.room?.id) navigate(`/battle/${myRoom.room.id}`);
        } catch { /* 조회 실패 시 무시 */ }
      } else {
        toast?.show(err.response?.data?.message || 'Failed to create room', 'error');
      }
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
      toast?.show(err.response?.data?.message || 'Invalid invite code.', 'error');
    } finally { setJoiningByCode(false); }
  };

  const joinRoom = async (id) => {
    try {
      await api.post(`/battles/rooms/${id}/join`);
      navigate(`/battle/${id}`);
    } catch (err) {
      try {
        const { data } = await api.get(`/battles/rooms/${id}`);
        if (data?.room?.status === 'playing') {
          toast?.show('Room already started, joining as spectator.', 'info');
          navigate(`/battle/${id}?spectate=1`);
          return;
        }
      } catch {
        // 참가 실패 원인을 확인하지 못하면 원래 오류를 표시합니다.
      }
      toast?.show(err.response?.data?.message || 'Failed to join room', 'error');
    }
  };

  const spectateRoom = (id) => {
    navigate(`/battle/${id}?spectate=1`);
  };

    const ready = async () => {
      if (!currentRoom || isSpectating) return;
      try {
        const { data } = await api.post(`/battles/rooms/${currentRoom.id}/ready`);
        setState(data);
      } catch (err) { toast?.show(err.response?.data?.message || 'Failed to ready', 'error'); }
    };

    const submitDraftSelection = async () => {
      if (!currentRoom || isSpectating || draftSubmitting) return;
      setDraftSubmitting(true);
      try {
        const { data } = await api.post(`/battles/rooms/${currentRoom.id}/draft`, {
          bannedTiers: draftBannedTier ? [draftBannedTier] : [],
          bannedTags: draftBannedTags,
          pickedTags: draftPickedTags,
        });
        setState(data);
        toast?.show(data?.room?.status === 'playing' ? 'Draft complete. Problem finalized.' : 'Draft submitted.', 'success');
      } catch (err) {
        toast?.show(err.response?.data?.message || 'Failed to submit draft', 'error');
      } finally {
        setDraftSubmitting(false);
      }
    };

  const submit = async () => {
    if (!currentRoom || submitting || isSpectating) return;
    setSubmitting(true);
    try {
      emitActivity('judging');
      const body = { code, language };
      if (isTerritoryMode && activeProblem) body.problemId = activeProblem.id;
      const { data } = await api.post(`/battles/rooms/${currentRoom.id}/submit`, body);
      setState(data);
      const latest = data?.submissions?.[0];
      if (latest) {
        setSubmissionResult({
          userId: user?.id,
          result: latest.isCorrect ? 'correct' : 'wrong',
          timeMs: latest.executionTimeMs,
          memoryMb: latest.memoryMb,
          detail: latest.detail,
          score: latest.score || 0,
          receivedAt: Date.now(),
        });
      }
    } catch (err) {
      toast?.show(err.response?.data?.message || 'Submission failed', 'error');
    } finally { setSubmitting(false); }
  };

  const sendChat = async (e) => {
    e.preventDefault();
    const message = chatInput.trim();
    if (!currentRoom || !message) return;
    setChatInput('');
    if (isSpectating) {
      if (socketRef.current?.connected) {
        socketRef.current.emit('battle:spectator_chat', { roomId, message });
      }
      return;
    }
    try {
      const { data } = await api.post(`/battles/rooms/${currentRoom.id}/chat`, { message });
      if (data.state) setState(data.state);
    } catch (err) {
      toast?.show(err.response?.data?.message || 'Failed to send chat', 'error');
      setChatInput(message);
    }
  };

  const sendEmote = async (emote) => {
    if (!currentRoom || isSpectating) return;
    try {
      const { data } = await api.post(`/battles/rooms/${currentRoom.id}/emote`, { emote });
      if (data.state) setState(data.state);
    } catch (err) { toast?.show(err.response?.data?.message || 'Failed to send emote', 'error'); }
  };

  const useItem = async (itemType) => {
    if (!currentRoom || isSpectating || itemCooldownLeft > 0) return;
    try {
      const { data } = await api.post(`/battles/rooms/${currentRoom.id}/item`, { itemType });
      if (data.state) setState(data.state);
    } catch (err) { toast?.show(err.response?.data?.message || 'Failed to use item', 'error'); }
  };

  const deleteRoom = async () => {
    if (!currentRoom) return;
    if (Number(currentRoom.createdBy) !== Number(user?.id)) {
      console.warn('[deleteRoom] createdBy mismatch', currentRoom.createdBy, user?.id);
      return;
    }
    try {
      await api.delete(`/battles/rooms/${currentRoom.id}`);
      toast?.show('Room deleted.', 'success');
      navigate('/battle');
    } catch (err) {
      console.error('[deleteRoom] error', err.response?.status, err.response?.data);
      toast?.show(err.response?.data?.message || 'Failed to delete room', 'error');
    }
  };

  const leave = async () => {
    if (currentRoom && !isSpectating) {
      try { await api.post(`/battles/rooms/${currentRoom.id}/leave`); } catch { /* best-effort */ }
    }
    navigate('/battle');
  };

  const copyInviteCode = () => {
    const code = currentRoom?.inviteCode;
    if (!code) return;
    navigator.clipboard?.writeText(code).then(() => {
      toast?.show('Invite code copied.', 'success');
    }).catch(() => {
      toast?.show(`Invite code: ${code}`, 'info');
    });
  };

  const createAgain = async () => {
    if (!currentRoom) { navigate('/battle'); return; }
    try {
      const previousFilters = config?.problemFilters || {};
      const { data } = await api.post('/battles/rooms', {
        mode: currentRoom.mode,
        maxPlayers: currentRoom.maxPlayers || 2,
        durationSec: currentRoom.durationSec,
        isPrivate: Boolean(currentRoom.isPrivate),
        preferredLanguage: currentRoom.preferredLanguage || language,
        bannedTags: previousFilters.bannedTags || config?.bannedTags || [],
        problemFilters: previousFilters,
      });
      navigate(`/battle/${data.room.id}`);
    } catch (err) {
      toast?.show(err.response?.data?.message || 'Failed to create new battle.', 'error');
      navigate('/battle');
    }
  };

  // ════════════════════════════════════════════════
  // RENDER: 로비 (방 없을 때)
  // ════════════════════════════════════════════════
  if (!roomId) {
    const isTerritorySelected = selectedMode === 'territory';
    const filterSummary = getProblemFilterSummary(normalizedProblemFilters);
    return (
      <div className="ab-page">
        <div className="ab-header">
          <div>
            <h1>Real-Time Algorithm Battle</h1>
            <p>Compete across 5 modes — Speed, HP Survival, Effects, Items, Territory.</p>
          </div>
        </div>

        {/* 방 만들기 카드 */}
        <section className="ab-create-card">
          <div className="ab-section-title">Create Room</div>

          {/* 모드 선택 */}
          <div className="ab-mode-strip">
            {battleModes.map((mode) => (
              <button
                type="button"
                key={mode.key}
                className={`ab-mode ${selectedMode === mode.key ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedMode(mode.key);
                    if (mode.key === 'draft-ban') setShowProblemFilters(false);
                  }}
              >
                {mode.itemsEnabled ? <Shield size={16} /> : <Swords size={16} />}
                <div>
                  <strong>{mode.title}</strong>
                  <span>{mode.description}</span>
                </div>
              </button>
            ))}
          </div>

          {/* 선택된 모드 규칙 */}
          {battleModes.find(m => m.key === selectedMode)?.rules && (
            <div className="ab-rules-card">
              <div className="ab-rules-title">
                📋 {battleModes.find(m => m.key === selectedMode)?.title} Rules
              </div>
              <ul>
                {(battleModes.find(m => m.key === selectedMode)?.rules || []).map((rule, i) => (
                  <li key={i}>{rule}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 시간 + 언어 + 비밀방 설정 */}
          <div className="ab-create-options">
            {!isTerritorySelected && (
              <div className="ab-option-group">
                <label>Game Time</label>
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
              <label>언어</label>
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
              <label>비공개 방</label>
              <button
                type="button"
                className={`ab-private-toggle ${isPrivate ? 'active' : ''}`}
                onClick={() => setIsPrivate((v) => !v)}
              >
                {isPrivate ? <><Lock size={14} /> 비공개 ON</> : <><Unlock size={14} /> 공개</>}
              </button>
              {isPrivate && <p className="ab-private-hint">방 생성 후 초대 코드를 공유하세요.</p>}
            </div>
          </div>

          {selectedMode === 'draft-ban' ? (
            <div className="ab-draft-lobby-note">
              <Shield size={16} />
              <div>
                <strong>드래프트는 방 입장 후 진행됩니다</strong>
                <span>방 생성 시 문제 조건을 설정하지 않습니다. 양쪽 플레이어가 준비 후 조건을 선택하고 문제가 확정됩니다.</span>
              </div>
            </div>
          ) : (
            <div className={`ab-filter-panel ${showProblemFilters ? 'open' : 'compact'}`}>
              <div className="ab-filter-head">
                <div>
                  <strong>문제 필터</strong>
                  <span>{filterSummary}</span>
                </div>
                <div className="ab-filter-actions">
                  {showProblemFilters && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setProblemFilters(DEFAULT_PROBLEM_FILTERS)}
                    >
                      Reset
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowProblemFilters((v) => !v)}
                  >
                    {showProblemFilters ? '접기' : '필터'}
                  </button>
                </div>
              </div>

              {showProblemFilters && (
                <div className="ab-filter-grid">
                  <div className="ab-filter-block">
                    <label>티어 범위</label>
                    <div className="ab-segmented">
                      {[
                        ['auto', '자동'],
                        ['min', '이상'],
                        ['max', '이하'],
                        ['range', '범위'],
                        ['only', '선택'],
                      ].map(([key, label]) => (
                        <button
                          type="button"
                          key={key}
                          className={normalizedProblemFilters.tierMode === key ? 'active' : ''}
                          onClick={() => updateProblemFilters({ tierMode: key })}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {normalizedProblemFilters.tierMode !== 'auto' && normalizedProblemFilters.tierMode !== 'only' && (
                      <div className="ab-tier-select-row">
                        {['min', 'range'].includes(normalizedProblemFilters.tierMode) && (
                          <select value={normalizedProblemFilters.minTier} onChange={(e) => updateProblemFilters({ minTier: e.target.value })}>
                            {problemTiers.map((tier) => <option key={tier} value={tier}>{PROBLEM_TIER_LABELS[tier] || tier}+</option>)}
                          </select>
                        )}
                        {normalizedProblemFilters.tierMode === 'range' && <span>~</span>}
                        {['max', 'range'].includes(normalizedProblemFilters.tierMode) && (
                          <select value={normalizedProblemFilters.maxTier} onChange={(e) => updateProblemFilters({ maxTier: e.target.value })}>
                            {problemTiers.map((tier) => <option key={tier} value={tier}>≤{PROBLEM_TIER_LABELS[tier] || tier}</option>)}
                          </select>
                        )}
                      </div>
                    )}
                    {normalizedProblemFilters.tierMode === 'only' && (
                      <div className="ab-chip-list">
                        {problemTiers.map((tier) => (
                          <button
                            type="button"
                            key={tier}
                            className={normalizedProblemFilters.allowedTiers.includes(tier) ? 'active include' : ''}
                            onClick={() => toggleFilterTier('allowedTiers', tier)}
                          >
                            {PROBLEM_TIER_LABELS[tier] || tier}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="ab-filter-block">
                    <label>Banned Tiers</label>
                    <div className="ab-chip-list">
                      {problemTiers.map((tier) => (
                        <button
                          type="button"
                          key={tier}
                          className={normalizedProblemFilters.bannedTiers.includes(tier) ? 'active danger' : ''}
                          onClick={() => toggleFilterTier('bannedTiers', tier)}
                        >
                          {PROBLEM_TIER_LABELS[tier] || tier}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="ab-filter-block wide">
                    <label>Required Tags</label>
                    <div className="ab-tag-groups">
                      {tagGroups.map((group) => (
                        <div key={`required-${group.label}`} className="ab-tag-group">
                          <span>{group.label}</span>
                          <div className="ab-chip-list">
                            {group.tags.map((tag) => (
                              <button
                                type="button"
                                key={tag}
                                className={normalizedProblemFilters.requiredTags.includes(tag) ? 'active include' : ''}
                                onClick={() => toggleFilterTag('requiredTags', tag)}
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="ab-filter-block wide">
                    <label>Banned Tags</label>
                    <div className="ab-tag-groups">
                      {tagGroups.map((group) => (
                        <div key={`banned-${group.label}`} className="ab-tag-group">
                          <span>{group.label}</span>
                          <div className="ab-chip-list">
                            {group.tags.map((tag) => (
                              <button
                                type="button"
                                key={tag}
                                className={normalizedProblemFilters.bannedTags.includes(tag) ? 'active danger' : ''}
                                onClick={() => toggleFilterTag('bannedTags', tag)}
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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
              placeholder="6자리 초대 코드 입력"
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
          <div className="ab-section-title">공개 방 / 관전</div>
          {rooms.length === 0 ? (
            <div className="ab-empty ab-empty-cta">
              <strong>첫 번째 방을 만들어보세요</strong>
              <span>스피드부터 테리토리 모드까지 도전하세요.</span>
              <button className="btn btn-primary btn-sm" onClick={createRoom} disabled={creating}>
                {creating ? <span className="spinner" /> : <Plus size={14} />} 방 만들기
              </button>
            </div>
          ) : rooms.map((item) => {
            const modeLabel = battleModes.find((m) => m.key === item.room.mode)?.title || item.room.mode;
            const isPlaying = item.room.status === 'playing';
            const participantCount = item.participantCount ?? item.participants?.length ?? 0;
            const isFull = participantCount >= item.room.maxPlayers;
            return (
              <div key={item.room.id} className={`ab-room-row ${isPlaying ? 'playing' : 'waiting'}`}>
                <div>
                  <strong>
                    {item.problem?.title || (isPlaying ? '진행 중' : modeLabel)}
                  </strong>
                  <span>
                    {modeLabel} · {participantCount}/{item.room.maxPlayers} · {isPlaying ? `⏱ ${fmtSec(timeLeft(item.room))} 남음` : (() => { const ll = lobbyTimeLeft(item.room); return ll != null ? `⏳ ${fmtSec(ll)} 대기` : '대기 중'; })()}
                  </span>
                </div>
                <div className="ab-room-row-actions">
                  {isPlaying && (
                    <span className="ab-live-badge">LIVE</span>
                  )}
                  {!isPlaying && Number(item.room.createdBy) === Number(user?.id) && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={async () => {
                        try {
                          await api.delete(`/battles/rooms/${item.room.id}`);
                          toast?.show('Room deleted.', 'success');
                          loadRooms();
                        } catch (err) {
                          toast?.show(err.response?.data?.message || 'Failed to delete room', 'error');
                        }
                      }}
                    >삭제</button>
                  )}
                  {!isPlaying && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => spectateRoom(item.room.id)}
                    >관전</button>
                  )}
                  <button
                    className={isPlaying ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                    onClick={() => (isPlaying ? spectateRoom(item.room.id) : joinRoom(item.room.id))}
                    disabled={!isPlaying && isFull}
                  >
                    {isPlaying ? '관전' : isFull ? '만석' : '입장'}
                  </button>
                </div>
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
  const topScore = sortedParticipants[0]?.score ?? 0;
  const topScoreCount = sortedParticipants.filter((player) => player.score === topScore).length;
  const isSpectatorResult = currentRoom?.status === 'finished' && !me;
  const didWin = !isSpectatorResult && hasOpponent && topScoreCount === 1 && sortedParticipants[0]?.userId === user?.id;
  const isDraw = hasOpponent && topScoreCount > 1;
  const resultTitle = isSpectatorResult
    ? 'Spectating Ended'
    : !hasOpponent
    ? 'No match'
    : isDraw
      ? 'Draw'
      : didWin
        ? '🏆 Victory!'
        : 'Battle Over';
  const resultTone = isSpectatorResult || !hasOpponent ? 'neutral' : isDraw ? 'draw' : didWin ? 'win' : 'lose';
  const opponentLabel = opponents.map((player) => player.username).join(', ') || 'No opponent';
  const winnerLabel = topScoreCount === 1 ? sortedParticipants[0]?.username : null;
  const resultSummary = isSpectatorResult
    ? winnerLabel ? `Winner: ${winnerLabel} · Final ${topScore}pts` : 'Draw'
    : isTerritoryMode
    ? `Claimed ${myClaimCount}/${problems?.length || 5}`
    : `Final ${me?.score || 0}pts`;

  return (
      <div className="ab-room-page">
        {/* 상단 바 */}
        <div className="ab-room-top">
          <button className="btn btn-ghost btn-sm" onClick={leave}>← Leave</button>
          <div className="ab-room-title">
            <strong>{isDrafting ? 'Draft in progress' : activeProblem?.title || 'Battle'}</strong>
            <span>
              {config?.title || currentRoom?.mode} ·{' '}
              {currentRoom?.status === 'waiting'
                ? isDrafting ? `Draft (${draftState?.submittedCount || 0}/${draftState?.requiredCount || 2})` : lobbyLeft != null ? `Waiting (${fmtSec(lobbyLeft)} left)` : 'Waiting'
                : currentRoom?.status === 'playing'
                  ? config?.winCondition === 'first-correct'
                  ? '⚡ First correct → instant win'
                  : `⏱ ${fmtSec(timeLeft(currentRoom))}`
                : 'Ended'}
          </span>
        </div>
        <div className="ab-room-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowRules(v => !v)} title="View mode rules">
            📋 Rules
          </button>
          {currentRoom?.inviteCode && (
            <button className="btn btn-ghost btn-sm ab-invite-code" onClick={copyInviteCode} title="Copy invite code">
              <Copy size={13} /> {currentRoom.inviteCode}
            </button>
          )}
          {currentRoom?.status === 'waiting' && Number(currentRoom?.createdBy) === Number(user?.id) && (
            <button className="btn btn-danger btn-sm" onClick={deleteRoom}>Delete Room</button>
          )}
            {currentRoom?.status === 'waiting' && !isDrafting && (
              <button className="btn btn-success btn-sm" onClick={ready} disabled={me?.isReady || isSpectating}>
                {me?.isReady ? 'Ready ✓' : 'Ready'}
              </button>
            )}
            {isDrafting && (
              <button className="btn btn-success btn-sm" disabled>
                Draft in progress
              </button>
            )}
          {currentRoom?.status === 'playing' && (
            <button className="btn btn-primary btn-sm" onClick={submit} disabled={submitting || isSpectating}>
              {isSpectating ? 'Spectating' : submitting ? <span className="spinner" /> : <><Play size={13} /> Submit</>}
            </button>
          )}
        </div>
      </div>

      {countdown != null && <div className="ab-countdown">{countdown > 0 ? countdown : '🔥 Start!'}</div>}
      {isSpectating && (
        <div className="ab-spectator-banner">
          👀 Spectator mode. Submit / items / ready are disabled — watch the live battle.
        </div>
      )}

      {/* 모드 규칙 패널 */}
      {showRules && config?.rules && (
        <div style={{ margin:'0 16px', padding:'12px 16px', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, fontSize:13 }}>
          <div style={{ fontWeight:700, marginBottom:8 }}>📋 {config.title} Rules</div>
          <ul style={{ margin:0, paddingLeft:18, display:'flex', flexDirection:'column', gap:4 }}>
            {config.rules.map((rule, i) => <li key={i} style={{ color:'var(--text2)' }}>{rule}</li>)}
          </ul>
        </div>
      )}

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

      <div className="ab-mobile-tabs">
          {[
            ['problem', currentRoom?.status === 'playing' ? 'Problem/Editor' : isDrafting ? 'Draft' : 'Lobby'],
            ['players', 'Players'],
            ['log', 'Chat/Log'],
        ].map(([key, label]) => (
          <button
            type="button"
            key={key}
            className={mobileTab === key ? 'active' : ''}
            onClick={() => setMobileTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={`ab-room-grid ab-mobile-${mobileTab}`}>
        {/* 왼쪽: 플레이어 상태 */}
        <aside className="ab-left">
          <div className="ab-section-title">Players</div>
          <div className="ab-player-list">
            {participants.map((player) => (
              <PlayerCard
                key={player.userId}
                player={player}
                me={player.userId === user?.id}
                attacking={attackUserId === player.userId}
                activity={activityByUserId[String(player.userId)]}
                showHp={config?.winCondition === 'hp-knockout'}
              />
            ))}
          </div>

          {isTerritoryMode && (
            <>
              <div className="ab-section-title" style={{ marginTop: 12 }}>Territory Status</div>
              <div className="ab-territory-score">
                {participants.map((p) => {
                  const count = Object.values(territoryClaims).filter((uid) => uid === p.userId).length;
                  return (
                    <div key={p.userId} className="ab-territory-score-row">
                      <span>{p.username}{p.userId === user?.id ? ' (me)' : ''}</span>
                      <span className="ab-territory-count">{count} / {problems?.length || 5}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {!isTerritoryMode && (
            <>
              <div className="ab-section-title" style={{ marginTop: 12 }}>Rankings</div>
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
            {currentRoom?.status !== 'playing' ? (
              isDrafting ? (
                <DraftBanPanel
                  draft={draftState}
                  participants={participants}
                  me={me}
                  problemTiers={problemTiers}
                  tagGroups={tagGroups}
                  bannedTier={draftBannedTier}
                  setBannedTier={setDraftBannedTier}
                  bannedTags={draftBannedTags}
                  setBannedTags={setDraftBannedTags}
                  pickedTags={draftPickedTags}
                  setPickedTags={setDraftPickedTags}
                  onSubmit={submitDraftSelection}
                  submitting={draftSubmitting}
                  isSpectating={isSpectating}
                />
              ) : (
                <div className="ab-wait-panel">
                  <strong>{loading ? 'Loading...' : 'Waiting'}</strong>
                  <span>When both players are ready, {isDraftBanRoom ? 'the draft phase will begin.' : 'problems will be finalized and the game will start.'}</span>
                </div>
              )
            ) : (
              <>
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
                        <pre><b>Input</b>{'\n'}{activeProblem.examples[0].input}</pre>
                        <pre><b>Output</b>{'\n'}{activeProblem.examples[0].output}</pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="ab-problem">
                    <p style={{ color: 'var(--text3)' }}>{loading ? 'Loading...' : 'Finalizing problems...'}</p>
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
                    {getBattleObjectiveText(config, isTerritoryMode)}
                  </span>
                </div>

                <div className="ab-editor">
                  <Suspense fallback={<div className="ab-empty">Loading editor...</div>}>
                    <Editor
                      height="100%"
                      language={JUDGE_LANGUAGE_OPTIONS.find((o) => o.value === language)?.monaco || 'python'}
                      theme="vs-dark"
                      value={code}
                      onChange={(v) => { setCode(v || ''); emitActivity('typing'); }}
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
              </>
            )}
          </main>

        {/* 오른쪽: 전술 + 로그 + 채팅 */}
        <aside className="ab-right">
          {/* 아이템 */}
          {config?.itemsEnabled && (
            <>
              <div className="ab-section-title">Items</div>
              <div className="ab-tactics">
                <div className="ab-item-grid">
                  {(config.availableItems || []).map((item) => (
                    <button
                      type="button"
                      key={item.key}
                      onClick={() => useItem(item.key)}
                      disabled={currentRoom?.status !== 'playing' || isSpectating || itemCooldownLeft > 0}
                      title={item.description}
                    >
                      <Shield size={13} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
                {itemCooldownLeft > 0 && (
                  <div className="ab-cooldown"><Clock size={12} /> Cooldown {itemCooldownLeft}s</div>
                )}
              </div>
            </>
          )}

          {/* 제출 결과 */}
          <div className="ab-section-title">Submission Result</div>
          {submissionResult && (
            <div className={`ab-submit-card ab-submit-flash ${submissionResult.result === 'correct' ? 'correct' : 'wrong'}`}>
              <strong>{submissionResult.result === 'correct' ? '⚔️ Attack Success' : '💨 Attack Failed'}</strong>
              <span>
                {submissionResult.userId === user?.id ? 'My submission' : `${participantById[String(submissionResult.userId)]?.username || 'Opponent'} submission`}
                {' · '}
                {submissionResult.timeMs != null ? `${submissionResult.timeMs}ms` : 'Time -'}
                {' · '}
                +{submissionResult.score || 0}
              </span>
              {submissionResult.detail && <p>{submissionResult.detail}</p>}
            </div>
          )}
          {latestSubmission ? (
            <div className={`ab-submit-card ${latestSubmission.isCorrect ? 'correct' : 'wrong'}`}>
              <strong>{latestSubmission.isCorrect ? '✅ Correct' : '❌ Wrong'}</strong>
              <span>{latestSubmission.language} · {latestSubmission.executionTimeMs != null ? `${latestSubmission.executionTimeMs}ms` : '-'} · +{latestSubmission.score}</span>
              {latestSubmission.detail && <p>{latestSubmission.detail}</p>}
            </div>
          ) : (
            <div className="ab-empty">No submissions yet.</div>
          )}

          {/* 전투 로그 */}
          <div className="ab-section-title">Battle Log</div>
          <div className="ab-combat-log">
            {combatEvents.length === 0
              ? <div className="ab-log-empty">No activity yet.</div>
              : [...combatEvents].reverse().map((event) => {
                const fmt = formatCombatEvent(event, user?.id, participantById);
                if (!fmt) return null;
                return (
                  <div key={event.id} className="ab-log-entry" style={{ borderLeft: `2px solid ${fmt.color}` }}>
                    <span className="ab-log-emoji">{fmt.emoji}</span>
                    <div>
                      <strong>{fmt.label}</strong>
                      {fmt.detail && <span>{fmt.detail}</span>}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* 채팅 + 이모트 */}
          <div className="ab-section-title">Chat / Join Alerts</div>
          <div className="ab-social">
            <div className="ab-chat-feed" ref={chatFeedRef}>
              {socialEvents.length === 0 && spectatorMessages.length === 0
                ? <div className="ab-log-empty">No messages yet.</div>
                : [...socialEvents].slice(-40).map((event) => {
                  const fmt = formatSocialEvent(event, user?.id, participantById);
                  if (!fmt) return null;
                  return (
                    <div key={event.id} className={`ab-chat-line ${fmt.kind}`}>
                      {fmt.author && <b>{fmt.author}</b>}
                      <span>{fmt.text}</span>
                    </div>
                  );
                })}
              {spectatorMessages.map((msg) => (
                <div key={msg.id} className="ab-chat-line chat" style={{ opacity: 0.75 }}>
                  <b>{msg.username} <span style={{ fontSize: 10, color: 'var(--text3)' }}>(spectating)</span></b>
                  <span>{msg.text}</span>
                </div>
              ))}
            </div>
            <div className="ab-emotes">
              {(config?.availableEmotes || Object.keys(EMOTE_EMOJI)).map((emote) => (
                <button
                  type="button"
                  key={emote}
                  onClick={() => sendEmote(emote)}
                  disabled={isSpectating}
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
                placeholder={isSpectating ? 'Spectator chat (gg, nice, wp...)' : 'Chat (gg, nice, wp...)'}
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
              <strong>{isTerritoryMode && didWin ? '🏆 Territory Victory!' : resultTitle}</strong>
              <span>
                {isSpectatorResult
                  ? resultSummary
                  : !hasOpponent
                  ? 'No opponent — result not counted.'
                  : isTerritoryMode
                  ? `Claims ${myClaimCount}/${problems?.length || 5}`
                  : `Final score: ${me?.score || 0}`}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/battle')} style={{ marginTop: 8 }}>
                Lobby
              </button>
            </div>
          )}
        </aside>
      </div>

      {currentRoom?.status === 'finished' && (
        <div className={`ab-result-overlay ${resultTone}`}>
          <div className="ab-result-modal">
            <div className="ab-result-kicker">{config?.title || 'Algorithm Battle'} Result</div>
            <div className="ab-result-icon">{resultTone === 'win' ? '🏆' : resultTone === 'draw' ? '🤝' : resultTone === 'lose' ? '💥' : '⏱️'}</div>
            <h2>{isTerritoryMode && didWin ? 'Territory Victory!' : resultTitle}</h2>
            <p>
              {isSpectatorResult
                ? resultSummary
                : !hasOpponent
                ? 'No opponent — result not counted.'
                : `vs ${opponentLabel} · ${resultSummary}`}
            </p>
            <div className="ab-result-scoreboard">
              {sortedParticipants.map((player, index) => (
                <div key={player.userId} className={player.userId === user?.id ? 'me' : ''}>
                  <span>#{index + 1} {player.username}{player.userId === user?.id ? ' (me)' : ''}</span>
                  <strong>{isTerritoryMode ? `${Object.values(territoryClaims).filter((uid) => uid === player.userId).length} claims` : `${player.score} pts`}</strong>
                </div>
              ))}
            </div>
            <div className="ab-result-actions">
              <button className="btn btn-primary" onClick={createAgain}>Play Again</button>
              <button className="btn btn-ghost" onClick={() => navigate('/battle')}>Lobby</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
