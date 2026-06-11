import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Copy, MessageCircle, Play, Plus, Shield, Sliders, Smile, Swords, Trophy, Zap, Lock, Unlock, Clock, Trash2, Wrench } from 'lucide-react';
import api from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { JUDGE_LANGUAGE_OPTIONS } from '../data/judgeLanguages.js';
import { pickLangText, withVars } from '../utils/languageMode.js';
import { getTierLabel } from '../utils/labelMaps.js';
import { getTagLabelLang } from './problemsPageUtils.js';
import { getSocketUrl } from '../utils/socket.js';
import { copyText } from '../utils/clipboard.js';
import './AlgorithmBattlePage.css';

const Editor = lazy(() => import('@monaco-editor/react'));

// ── 상수 ─────────────────────────────────────────────────────────────────────
const EMOTE_EMOJI = { gg: '🤝', nice: '👏', oops: '😅', focus: '🎯', taunt: '😏' };
const CHAT_SHORTCUTS = {
  gg: { ko: '🤝 좋은 게임!', en: '🤝 GG' },
  nice: { ko: '👏 나이스!', en: '👏 Nice!' },
  oops: { ko: '😅 앗!', en: '😅 Oops' },
  focus: { ko: '🎯 집중!', en: '🎯 Focus!' },
  wp: { ko: '✨ 잘했어요!', en: '✨ Well played!' },
  gl: { ko: '🍀 행운을 빌어요!', en: '🍀 Good luck!' },
  ez: { ko: '😏 쉽네요', en: '😏 EZ' },
  lol: { ko: '😂 웃겨요', en: '😂 LOL' },
};
const COMBAT_EVENT_TYPES = new Set([
  'player.attack', 'player.miss', 'problem.effect',
  'item.used', 'territory.claimed',
]);
const SOCIAL_EVENT_TYPES = new Set([
  'player.joined', 'player.left', 'player.ready', 'room.started',
  'room.problem_selected', 'draft.started', 'draft.selection', 'draft.completed',
  'player.chat', 'player.emote', 'player.forfeit',
]);
const DURATION_PRESETS = [
  { label: '⚡ Blitz 5m', labelKo: '⚡ 블리츠 5분', sec: 300 },
  { label: '⚔️ Standard 10m', labelKo: '⚔️ 스탠다드 10분', sec: 600 },
  { label: '🏔️ Marathon 20m', labelKo: '🏔️ 마라톤 20분', sec: 1200 },
];
const FALLBACK_MODES = [
  { key: 'sort-speed', title: '⚡ Speed Race', description: 'Pure speed — first to submit the correct answer wins instantly.', winCondition: 'first-correct', rules: ['First correct submission wins immediately', 'Tie broken by score if time runs out'], itemsEnabled: false, effectsEnabled: false, problemCount: 1 },
  { key: 'survival', title: '💀 Survival', description: 'Reduce your opponent\'s HP to 0! Attack power grows with each correct submission.', winCondition: 'hp-knockout', rules: ['Correct answer → opponent HP decreases', 'Opponent HP 0 = instant win'], itemsEnabled: false, effectsEnabled: false, problemCount: 1 },
  { key: 'duel-effects', title: '✨ Effects Duel', description: 'Tag-based buffs/debuffs trigger on correct submissions! HP combat with random effects for comebacks.', winCondition: 'hp-knockout', rules: ['Correct answer → opponent HP loss + problem effect', 'HP 0 = defeat'], itemsEnabled: false, effectsEnabled: true, problemCount: 1 },
  { key: 'chaos-items', title: '🎒 Item Chaos', description: 'Fast-cooldown items to destabilize your opponent! Item strategy decides the match.', winCondition: 'hp-knockout', rules: ['Item cooldown 12s (fast)', 'Correct answer → opponent HP loss', 'HP 0 = defeat'], itemsEnabled: true, effectsEnabled: true, problemCount: 1 },
  { key: 'territory', title: '🏴 Territory', description: '5 problems revealed at once! Solve first to claim territory. Most territory wins.', winCondition: 'territory', rules: ['5 problems revealed simultaneously', 'Correct answer → claim that problem', 'Player with most territory wins'], itemsEnabled: false, effectsEnabled: false, problemCount: 5 },
  { key: 'code-golf', title: '📏 Code Golf', description: 'Solve with the shortest code! Best code length wins.', winCondition: 'code-golf', rules: ['Shortest correct code wins', 'Each correct submission updates your best', 'Most efficient code when time ends wins'], itemsEnabled: false, effectsEnabled: false, problemCount: 1 },
  { key: 'draft-ban', title: '🚫 Draft Ban', description: 'Strategic 1v1 — both players ban/pick tiers and tags before the problem is locked in.', winCondition: 'hp-knockout', rules: ['No problem conditions at room creation', 'Draft starts after both players ready', 'Problem locked after draft', 'Correct answer → opponent HP loss + effect'], itemsEnabled: false, effectsEnabled: true, problemCount: 1, draftEnabled: true },
];

const BATTLE_MODE_KO = {
  'sort-speed': { title: '⚡ 스피드 레이스', description: '순수 속도 — 가장 먼저 정답을 제출한 플레이어가 즉시 승리합니다.', rules: ['가장 먼저 정답 제출 시 즉시 승리', '시간 종료 시 점수로 동점 처리'] },
  'survival': { title: '💀 서바이벌', description: '상대방 HP를 0으로 만드세요! 정답을 제출할수록 공격력이 강해집니다.', rules: ['정답 → 상대 HP 감소', '상대 HP 0 = 즉시 승리'] },
  'duel-effects': { title: '✨ 이펙트 듀얼', description: '정답 제출 시 태그 기반 버프/디버프 발동! 랜덤 이펙트로 역전 가능한 HP 전투.', rules: ['정답 → 상대 HP 손실 + 문제 이펙트', '아이템 쿨다운 20초', 'HP 0 = 패배'] },
  'chaos-items': { title: '🎒 아이템 카오스', description: '빠른 쿨다운 아이템으로 상대를 흔들어라! 아이템 전략이 승부를 결정합니다.', rules: ['아이템 쿨다운 12초(빠름)', '정답 → 상대 HP 손실', 'HP 0 = 패배'] },
  'territory': { title: '🏴 영토 정복', description: '5개 문제가 동시 공개! 먼저 풀어 영토를 차지하고, 가장 많은 영토를 가진 플레이어가 승리.', rules: ['5개 문제 동시 공개', '정답 → 해당 문제 영토 획득', '가장 많은 영토를 가진 플레이어 승리'] },
  'code-golf': { title: '📏 코드 골프', description: '가장 짧은 코드로 문제를 해결하세요! 더 짧은 코드가 높은 점수를 얻습니다.', rules: ['가장 짧은 정답 코드가 승리', '매 정답 제출마다 최고 기록 갱신', '시간 종료 시 가장 짧은 정답 코드를 가진 플레이어 승리'] },
  'draft-ban': { title: '🚫 드래프트 밴', description: '전략적 1v1 — 두 플레이어가 티어와 태그를 밴/픽한 후 문제가 확정됩니다.', rules: ['방 생성 시 문제 조건 없음', '두 플레이어 준비 후 드래프트 시작', '드래프트 후 문제 확정', '정답 → 상대 HP 손실 + 이펙트'] },
};


function createInlineRule() {
  return { id: `rule_${Date.now()}_${Math.random().toString(36).slice(2)}`, event: 'ON_CORRECT_ANSWER', condition: { type: 'always' }, action: { type: 'MODIFY_HP', target: 'self', value: 15 } };
}
function defaultInlineCond(type) {
  return type === 'always' ? { type } : { type, value: 30 };
}
function defaultInlineAction(type) {
  if (type === 'MODIFY_HP') return { type, target: 'self', value: 15 };
  if (type === 'SET_HP') return { type, target: 'self', value: 100 };
  if (type === 'ADD_TIME') return { type, value: 30 };
  if (type === 'GRANT_ITEM') return { type, item: 'shield' };
  if (type === 'DOUBLE_DAMAGE') return { type, duration: 10 };
  if (type === 'FREEZE_OPPONENT') return { type, duration: 5 };
  return { type, text: '' };
}

function getBattleModeTitle(modeKey, config, lang) {
  if (lang === 'ko') return BATTLE_MODE_KO[modeKey]?.title || config?.titleKo || config?.title || modeKey;
  return config?.title || modeKey;
}

function getBattleModeRules(modeKey, config, lang) {
  if (lang === 'ko') return BATTLE_MODE_KO[modeKey]?.rules || config?.rules || [];
  return config?.rules || [];
}

function normalizeItemKey(value = '') {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('lag') || raw.includes('지연')) return 'lag-spike';
  if (raw.includes('power') || raw.includes('attack') || raw.includes('강화')) return 'power-up';
  if (raw.includes('breakpoint') || raw.includes('약화')) return 'breakpoint';
  if (raw.includes('shield') || raw.includes('방어')) return 'shield';
  if (raw.includes('bomb') || raw.includes('폭탄')) return 'bomb';
  if (raw.includes('heal') || raw.includes('회복')) return 'heal';
  if (raw.includes('freeze') || raw.includes('정지')) return 'freeze';
  return raw.replace(/[^a-z0-9_-]/g, '');
}

function getBattleItemLabel(item, itemLabels = {}) {
  const key = normalizeItemKey(item?.key || item?.item || item?.itemType || item?.label);
  return itemLabels[key] || item?.label || item?.itemLabel || item?.item || key;
}

function getLocalizedActivity(activity, txt) {
  if (!activity) return null;
  const raw = String(activity.label || '').toLowerCase();
  const label = raw === 'chatting' ? txt('채팅 중', 'Chatting')
    : raw === 'emote used' ? txt('이모트 사용', 'Emote used')
    : raw === 'item used' ? txt('아이템 사용', 'Item used')
    : raw === 'problem effect triggered' ? txt('문제 효과 발동', 'Problem effect triggered')
    : raw === 'ready' ? txt('준비 완료', 'Ready')
    : raw === 'focusing' || raw === 'focused' ? txt('집중 중', 'Focusing')
    : activity.label;
  return { ...activity, label };
}

function getChatShortcutLabel(message, txt) {
  const shortcut = CHAT_SHORTCUTS[String(message || '').toLowerCase()];
  if (!shortcut) return null;
  return txt(shortcut.ko, shortcut.en);
}

function getBattleEffectLabel(payload = {}, txt) {
  const key = String(payload.effect || payload.effectKey || payload.key || payload.effectLabel || '').toLowerCase();
  if (key.includes('path') || key.includes('snare')) return txt('경로 차단', 'Path Block');
  if (key.includes('memo') || key.includes('shield')) return txt('메모이제이션 실드', 'Memoization Shield');
  if (key.includes('sort') || key.includes('haste')) return txt('정렬 가속', 'Sort Acceleration');
  if (key.includes('precision')) return txt('정밀 타격', 'Precision Strike');
  return payload.effectLabel || txt('문제 효과', 'Problem effect');
}

function getBattleEffectDescription(payload = {}, txt) {
  const text = String(payload.description || '').toLowerCase();
  if (text.includes('speed')) return txt('상대 속도를 낮춥니다.', payload.description);
  if (text.includes('restores')) return txt('HP를 회복합니다.', payload.description);
  if (text.includes('attack power')) return txt('속도와 공격력이 증가합니다.', payload.description);
  return payload.description || txt('효과 발동', 'Effect triggered');
}

const FALLBACK_BANNABLE_TAGS = [
  '구현', '수학', '문자열', '정렬', '자료 구조', '해시',
  '그리디', '이분 탐색', '투 포인터', '누적 합', '다이나믹 프로그래밍',
  '그래프 이론', 'BFS', 'DFS', '최단 경로', '트리', '백트래킹',
];
const FALLBACK_PROBLEM_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
const tierLblBattle = (tier, lang) => getTierLabel(tier, lang) || tier;
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

function getProblemFilterSummary(filters, t, lang = 'en') {
  const tl = (tier) => tierLblBattle(tier, lang);
  const parts = [];
  if (filters.tierMode === 'min') parts.push(`${tl(filters.minTier)}+`);
  if (filters.tierMode === 'max') parts.push(`≤${tl(filters.maxTier)}`);
  if (filters.tierMode === 'range') parts.push(`${tl(filters.minTier)}~${tl(filters.maxTier)}`);
  if (filters.tierMode === 'only' && filters.allowedTiers.length) {
    parts.push(filters.allowedTiers.map((tier) => tl(tier)).join(', '));
  }
  if (filters.bannedTiers.length) parts.push(withVars(t('abBannedTiers'), { tiers: filters.bannedTiers.map((tier) => tl(tier)).join(', ') }));
  if (filters.requiredTags.length) parts.push(withVars(t('abRequiredTags'), { tags: filters.requiredTags.map((tag) => getTagLabelLang(tag, lang)).join(', ') }));
  if (filters.bannedTags.length) parts.push(withVars(t('abBannedTags'), { tags: filters.bannedTags.map((tag) => getTagLabelLang(tag, lang)).join(', ') }));
  return parts.length ? parts.join(' · ') : t('abAutoRecommend');
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

function getBattleObjectiveText(config, isTerritoryMode, txt) {
  if (isTerritoryMode) return txt('🏴 정답 제출로 영토를 점령하세요', '🏴 Claim territory by submitting correct answers');
  if (config?.winCondition === 'code-golf') return txt('📏 가장 짧은 정답 코드가 승리', '📏 Shortest correct code wins');
  if (config?.winCondition === 'first-correct') return txt('⚡ 첫 번째 정답 제출이 승리', '⚡ First correct submission wins');
  if (config?.effectsEnabled) return txt('✨ 정답 → 공격 + 문제 효과', '✨ Correct answer → attack + problem effect');
  return txt('⚔️ 정답 → 공격', '⚔️ Correct answer → attack');
}

function formatCombatEvent(event, myId, participantById = {}, txt = (ko, en) => en, itemLabels = {}) {
  if (!event || !COMBAT_EVENT_TYPES.has(event.type)) return null;
  const payload = event.payload || {};
  const isMe = event.userId === myId;
  const actor = participantById[String(event.userId)]?.username || (isMe ? txt('나', 'me') : txt('상대', 'opponent'));

  switch (event.type) {
    case 'player.attack':
      return {
        emoji: isMe ? '⚔️' : '🩸',
        label: txt(`${actor} 공격`, `${actor} attack`),
        detail: `+${payload.score || 0}pts${payload.damage ? ` · dmg ${payload.damage}` : ''}`,
        color: isMe ? 'var(--blue)' : 'var(--red)',
      };
    case 'player.miss':
      return { emoji: '💨', label: txt(`${actor} 오답`, `${actor} wrong`), detail: payload.detail || '', color: 'var(--text3)' };
    case 'problem.effect':
      return { emoji: '✨', label: getBattleEffectLabel(payload, txt), detail: getBattleEffectDescription(payload, txt), color: 'var(--purple)' };
    case 'item.used': {
      const statStr = payload.stat
        ? Object.entries(payload.stat).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(' ')
        : '';
      return { emoji: '🎒', label: getBattleItemLabel(payload, itemLabels) || txt('아이템', 'Item'), detail: statStr || txt('사용됨', 'Used'), color: 'var(--yellow)' };
    }
    case 'territory.claimed':
      return { emoji: '🏴', label: txt(`${actor} 점령`, `${actor} claimed`), detail: payload.problemId ? `Problem #${payload.problemId}` : '', color: isMe ? 'var(--blue)' : 'var(--red)' };
    default:
      return null;
  }
}

function formatSocialEvent(event, myId, participantById = {}, txt = (ko, en) => en) {
  if (!event || !SOCIAL_EVENT_TYPES.has(event.type)) return null;
  const payload = event.payload || {};
  const isMe = event.userId === myId;
  const actor = participantById[String(event.userId)]?.username || (isMe ? txt('나', 'me') : txt('상대', 'opponent'));

  switch (event.type) {
    case 'player.joined':
      return { kind: 'system', text: txt(`${actor} 입장.`, `${actor} joined.`) };
    case 'player.left':
      return { kind: 'system', text: txt(`${actor} 퇴장.`, `${actor} left.`) };
    case 'player.ready':
      return { kind: 'system', text: txt(`${actor} 준비 완료.`, `${actor} is ready.`) };
    case 'room.problem_selected':
      return { kind: 'system', text: txt('배틀 문제 선택됨.', 'Battle problem selected.') };
    case 'draft.started':
      return { kind: 'system', text: txt('드래프트 시작. 양쪽이 조건을 선택하면 문제가 확정됩니다.', 'Draft started. Both players pick conditions and the problem will be finalized.') };
    case 'draft.selection':
      return { kind: 'system', text: txt(`${actor} 드래프트 제출.`, `${actor} submitted draft.`) };
    case 'draft.completed':
      return { kind: 'system', text: txt('드래프트 완료. 배틀 문제 확정.', 'Draft complete. Battle problem finalized.') };
    case 'room.started':
      return { kind: 'system', text: txt('모든 플레이어 준비 완료. 배틀 시작!', 'All players ready. Battle started.') };
    case 'player.chat': {
      const msg = payload.message || '';
      const shortcut = getChatShortcutLabel(msg, txt);
      return { kind: isMe ? 'me' : 'chat', author: actor, text: shortcut || msg };
    }
    case 'player.emote':
      return { kind: isMe ? 'me' : 'chat', author: actor, text: EMOTE_EMOJI[payload.emote] || payload.emote || '😊' };
    default:
      return null;
  }
}

function PlayerCard({ player, me, attacking, activity, showHp = true, isCodeGolf = false, txt = (ko, en) => en }) {
  const maxHp = Math.max(1, Number(player.maxHp || 100));
  const hpPct = Math.max(0, Math.min(100, ((player.characterHp || 0) / maxHp) * 100));
  const bestCodeLen = isCodeGolf && player.score > 0 ? 2000 - player.score : null;
  return (
    <div className={`ab-player-card ${me ? 'me' : ''} ${attacking ? 'attacking' : ''}`}>
      <div className="ab-player-head">
        <div><strong>{player.username}</strong>{me && <span> {txt('(나)', '(me)')}</span>}</div>
        {isCodeGolf
          ? <b style={{ color: bestCodeLen ? 'var(--green)' : 'var(--fg-muted)', fontSize: 13 }}>
              {bestCodeLen ? `${bestCodeLen}자` : '—'}
            </b>
          : <b>{player.score}</b>
        }
      </div>
      {isCodeGolf
        ? <div className="ab-hp" title={bestCodeLen ? `${bestCodeLen} chars` : 'No correct submission yet'}>
            <div style={{ width: bestCodeLen ? `${Math.max(5, 100 - Math.min(99, (bestCodeLen / 500) * 100))}%` : '0%', background: 'var(--green)' }} />
          </div>
        : showHp && <div className="ab-hp"><div style={{ width: `${hpPct}%` }} /></div>
      }
      <div className="ab-stats">
        {isCodeGolf
          ? <span>{bestCodeLen ? txt(`최적 ${bestCodeLen}자`, `Best ${bestCodeLen} chars`) : txt('아직 없음', 'None yet')}</span>
          : (() => {
              const atkBonus = Number(player.effectAttackBonus || 0);
              const spdBonus = Number(player.effectSpeedBonus || 0);
              const effAtk = Number(player.effectiveAttack ?? (player.attackPower + atkBonus));
              const effSpd = Number(player.effectiveSpeed ?? (player.speed + spdBonus));
              const bonusBadge = (delta) => delta === 0 ? null : (
                <span style={{
                  marginLeft: 4,
                  fontSize: 11,
                  color: delta > 0 ? 'var(--green)' : 'var(--red)',
                  fontWeight: 700,
                }}>
                  {delta > 0 ? `+${delta}` : delta}
                </span>
              );
              return (
                <>
                  {showHp && <span>HP {player.characterHp}</span>}
                  {showHp && <span>ATK {effAtk}{bonusBadge(atkBonus)}</span>}
                  <span>SPD {effSpd}{bonusBadge(spdBonus)}</span>
                </>
              );
            })()
        }
      </div>
      {activity && (
        <div className="ab-activity-pill">
          <Zap size={12} /> {getLocalizedActivity(activity, txt).label}{activity.message ? ` · ${activity.message}` : ''}
        </div>
      )}
      {player.isReady && <div className="ab-ready">{txt('준비 완료', 'READY')}</div>}
    </div>
  );
}

function getWorkshopHp(player, runtime, baseHp, hasWorkshop) {
  if (!player) return 0;
  const key = String(player.userId);
  if (runtime.hpByUserId[key] != null) return Number(runtime.hpByUserId[key]);
  return hasWorkshop ? Number(baseHp || 100) : Number(player.characterHp || 0);
}

function checkWorkshopCondition(condition, state) {
  const type = condition?.type || 'always';
  if (type === 'always') return true;
  const value = Number(condition?.value || 0);
  if (type === 'hp_below') return state.myHp < value;
  if (type === 'hp_above') return state.myHp > value;
  if (type === 'opponent_hp_below') return state.opponentHp < value;
  if (type === 'time_remaining_below') return state.timeRemaining < value;
  if (type === 'solved_count_above') return state.solvedCount > value;
  if (type === 'wrong_streak_above') return state.wrongStreak > value;
  return false;
}

function formatWorkshopMessage(action, actorName, t, itemLabels) {
  const delta = Number(action?.value) >= 0 ? '+' : '';
  if (action?.type === 'MODIFY_HP') return `${actorName}: HP ${delta}${action.value}`;
  if (action?.type === 'SET_HP') return withVars(t('abWsSetHp'), { actor: actorName, value: action.value });
  if (action?.type === 'ADD_TIME') return withVars(t('abWsAddTime'), { actor: actorName, delta, value: action.value });
  if (action?.type === 'GRANT_ITEM') return withVars(t('abWsGrantItem'), { actor: actorName, item: itemLabels[action.item] || action.item });
  if (action?.type === 'DOUBLE_DAMAGE') return withVars(t('abWsDoubleDmg'), { actor: actorName, duration: action.duration });
  if (action?.type === 'FREEZE_OPPONENT') return withVars(t('abWsFreeze'), { actor: actorName, duration: action.duration });
  return action?.text || t('abWsDefault');
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
  const { lang: draftLang } = useLang();
  const dtxt = (ko, en) => pickLangText(draftLang, ko, en);
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
          <strong>{dtxt('드래프트 단계', 'Draft Phase')}</strong>
          <span>{draft?.submittedCount || 0}/{draft?.requiredCount || 2} {dtxt('제출됨', 'submitted')}</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={onSubmit} disabled={!canSubmit}>
          {mySubmitted ? dtxt('제출 완료 ✓', 'Submitted ✓') : submitting ? <span className="spinner" /> : dtxt('드래프트 제출', 'Submit Draft')}
        </button>
      </div>

      <div className="ab-draft-progress">
        {participants.map((player) => (
          <div key={player.userId} className={submittedByUser.has(Number(player.userId)) ? 'done' : ''}>
            <span>{player.username}{player.userId === me?.userId ? ` ${dtxt('(나)', '(me)')}` : ''}</span>
            <strong>{submittedByUser.has(Number(player.userId)) ? dtxt('확정', 'LOCKED') : dtxt('선택 중', 'PICKING')}</strong>
          </div>
        ))}
      </div>

      <div className="ab-draft-grid">
        <div className="ab-draft-block">
          <label>{dtxt('티어 밴', 'Ban Tier')}</label>
          <div className="ab-chip-list">
            {problemTiers.map((tier) => (
              <button
                type="button"
                key={tier}
                className={bannedTier === tier ? 'active danger' : ''}
                onClick={() => canSubmit && setBannedTier((prev) => (prev === tier ? '' : tier))}
                disabled={!canSubmit}
              >
                {tierLblBattle(tier, draftLang)}
              </button>
            ))}
          </div>
        </div>

        <div className="ab-draft-block">
          <label>{dtxt('선호 태그 선택', 'Pick Preferred Tags')}</label>
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
                      {getTagLabelLang(tag, draftLang)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="ab-draft-block wide">
          <label>{dtxt('밴 태그 (최대 2개)', 'Ban Tags (max 2)')}</label>
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
                      {getTagLabelLang(tag, draftLang)}
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

function InviteUserPanel({ roomId, txt, toast }) {
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviting, setInviting] = useState(false);

  const sendInvite = async () => {
    const name = inviteUsername.trim();
    if (!name) return;
    setInviting(true);
    try {
      await api.post(`/battles/rooms/${roomId}/invite-user`, { username: name });
      toast?.show(txt(`${name}님에게 초대를 보냈습니다.`, `Invitation sent to ${name}.`), 'success');
      setInviteUsername('');
    } catch (err) {
      toast?.show(err.response?.data?.message || txt('초대에 실패했습니다.', 'Failed to send invite.'), 'error');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
      <input
        className="ab-input"
        type="text"
        placeholder={txt('유저명으로 초대', 'Invite by username')}
        value={inviteUsername}
        onChange={(e) => setInviteUsername(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && sendInvite()}
        style={{ flex: 1, fontSize: 12 }}
        maxLength={40}
      />
      <button className="btn btn-primary btn-sm" onClick={sendInvite} disabled={inviting || !inviteUsername.trim()}>
        {inviting ? '...' : txt('초대', 'Invite')}
      </button>
    </div>
  );
}

export default function AlgorithmBattlePage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();
  const { lang: uiLang, t } = useLang();
  const txt = useCallback((ko, en) => pickLangText(uiLang, ko, en), [uiLang]);
  const errTxt = useCallback((err, ko, en) => (uiLang === 'ko' ? ko : (err?.response?.data?.message || en)), [uiLang]);
  const editorSettings = user?.settings?.editor || {};
  const workshopEventLabels = useMemo(() => ({
    ON_CORRECT_ANSWER: t('abEvt_ON_CORRECT_ANSWER'),
    ON_WRONG_ANSWER: t('abEvt_ON_WRONG_ANSWER'),
    ON_COMPILE_ERROR: t('abEvt_ON_COMPILE_ERROR'),
    ON_OPPONENT_CORRECT: t('abEvt_ON_OPPONENT_CORRECT'),
    ON_OPPONENT_WRONG: t('abEvt_ON_OPPONENT_WRONG'),
    ON_TIMER_HALF: t('abEvt_ON_TIMER_HALF'),
    ON_TIMER_LOW: t('abEvt_ON_TIMER_LOW'),
    ON_BATTLE_START: t('abEvt_ON_BATTLE_START'),
    ON_HP_BELOW_50: t('abEvt_ON_HP_BELOW_50'),
    ON_HP_BELOW_25: t('abEvt_ON_HP_BELOW_25'),
  }), [t]);
  const workshopItemLabels = useMemo(() => ({
    shield: t('abItem_shield'),
    bomb: t('abItem_bomb'),
    heal: t('abItem_heal'),
    freeze: t('abItem_freeze'),
    'lag-spike': txt('지연 공격', 'Lag Spike'),
    'power-up': txt('공격 강화', 'Power Up'),
    breakpoint: txt('브레이크포인트', 'Breakpoint'),
  }), [t, txt]);
  const socketRef = useRef(null);

  // ── 로비 상태
  const [rooms, setRooms] = useState([]);
  const [battleModes, setBattleModes] = useState(FALLBACK_MODES);
  const [bannableTags, setBannableTags] = useState(FALLBACK_BANNABLE_TAGS);
  const [problemTiers, setProblemTiers] = useState(FALLBACK_PROBLEM_TIERS);
  const [workshopModes, setWorkshopModes] = useState([]);
  const [selectedMode, setSelectedMode] = useState('duel-effects');
  const [selectedWorkshopModeId, setSelectedWorkshopModeId] = useState(searchParams.get('workshopModeId') || '');
  const [showInlineWorkshop, setShowInlineWorkshop] = useState(false);
  const [inlineWorkshopConfig, setInlineWorkshopConfig] = useState({ rules: [], baseHp: 100, allowItems: false });
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
  const [roomTitle, setRoomTitle] = useState('');

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
  const [workshopRuntime, setWorkshopRuntime] = useState({
    hpByUserId: {},
    timeDeltaSec: 0,
    messages: [],
    grantedItems: [],
    effects: {},
  });

  const lastActivityRef = useRef(0);
  const lobbyExpiredRef = useRef(false);
  const finishedRef = useRef(false);
  const chatFeedRef = useRef(null);
  const autoLeaveRoomRef = useRef(null);
  const autoLeaveSpectatingRef = useRef(false);

  const [activeDebuffs, setActiveDebuffs] = useState({ typeLock: 0, submitBlock: 0, blind: 0 });
  const processedWorkshopSubmissionsRef = useRef(new Set());
  const workshopTimerFlagsRef = useRef({ half: false, low: false });
  const workshopHpFlagsRef = useRef({});
  const workshopWrongStreakRef = useRef({});

  // ── 파생 상태
  const currentRoom = state?.room || null;
  const config = state?.config || FALLBACK_MODES.find((m) => m.key === currentRoom?.mode) || FALLBACK_MODES[0];
  const workshopRules = config?.workshopRules || config?.workshopMode?.config?.rules || [];
  const hasWorkshopMode = workshopRules.length > 0 || Boolean(config?.workshopMode);
  const workshopBaseHp = Number(config?.baseHp || config?.workshopMode?.config?.baseHp || 100);
  const selectedWorkshopMode = useMemo(
    () => workshopModes.find((mode) => String(mode.id) === String(selectedWorkshopModeId)) || null,
    [selectedWorkshopModeId, workshopModes]
  );
  const participants = state?.participants || [];
  const events = state?.events || [];
  const activityByUserId = state?.activityByUserId || {};
  const isTerritoryMode = currentRoom?.mode === 'territory';
  const isCodeGolfMode = currentRoom?.mode === 'code-golf';
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
  const nowMs = Date.now();
  const isTypeLocked = !isSpectating && activeDebuffs.typeLock > nowMs;
  const isSubmitBlocked = !isSpectating && activeDebuffs.submitBlock > nowMs;
  const isBlinded = !isSpectating && activeDebuffs.blind > nowMs;
  const participantById = useMemo(
    () => Object.fromEntries(participants.map((player) => [String(player.userId), player])),
    [participants]
  );
  const displayedParticipants = useMemo(
    () => participants.map((player) => ({
      ...player,
      maxHp: hasWorkshopMode ? workshopBaseHp : 100,
      characterHp: getWorkshopHp(player, workshopRuntime, workshopBaseHp, hasWorkshopMode),
    })),
    [hasWorkshopMode, participants, workshopBaseHp, workshopRuntime]
  );
  const displayedParticipantById = useMemo(
    () => Object.fromEntries(displayedParticipants.map((player) => [String(player.userId), player])),
    [displayedParticipants]
  );
  const sortedParticipants = useMemo(
    () => [...displayedParticipants].sort((a, b) => b.score - a.score || b.characterHp - a.characterHp),
    [displayedParticipants]
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
    const tagGroupDefs = [
      { label: t('abTagCat_basic'), tags: ['입출력', '구현', '수학', '문자열', '정렬'] },
      { label: t('abTagCat_ds'), tags: ['자료 구조', '해시', '스택', '큐', '우선순위 큐'] },
      { label: t('abTagCat_algo'), tags: ['그리디', '이분 탐색', '투 포인터', '누적 합', '다이나믹 프로그래밍', 'DP'] },
      { label: t('abTagCat_graph'), tags: ['그래프 이론', '그래프', 'BFS', 'DFS', '최단 경로', '트리'] },
      { label: t('abTagCat_adv'), tags: ['백트래킹', '비트마스크', '분리 집합'] },
    ];
    const available = new Set(bannableTags);
    const groups = tagGroupDefs
      .map((group) => ({ ...group, tags: group.tags.filter((tag) => available.has(tag)) }))
      .filter((group) => group.tags.length > 0);
    const groupedTags = new Set(groups.flatMap((group) => group.tags));
    const extras = bannableTags.filter((tag) => !groupedTags.has(tag));
    return extras.length > 0 ? [...groups, { label: txt('기타', 'Other'), tags: extras }] : groups;
  }, [bannableTags, t]);
  const normalizedProblemFilters = useMemo(
    () => sanitizeProblemFilters(problemFilters, problemTiers),
    [problemFilters, problemTiers]
  );

  const runWorkshopEvent = useCallback((eventName, perspectiveUserId, actorUserId = perspectiveUserId) => {
    if (!workshopRules.length || !perspectiveUserId) return;
    const perspective = displayedParticipantById[String(perspectiveUserId)];
    if (!perspective) return;
    const opponent = displayedParticipants.find((player) => player.userId !== Number(perspectiveUserId));
    const actor = displayedParticipantById[String(actorUserId)] || perspective;
    const stateForRule = {
      myHp: Number(perspective.characterHp || 0),
      opponentHp: Number(opponent?.characterHp || 0),
      timeRemaining: Math.max(0, timeLeft(currentRoom) + Number(workshopRuntime.timeDeltaSec || 0)),
      solvedCount: (state?.submissions || []).filter((submission) => submission.userId === Number(perspectiveUserId) && submission.isCorrect).length,
      wrongStreak: Number(workshopWrongStreakRef.current[String(perspectiveUserId)] || 0),
    };

    const matchingRules = workshopRules.filter((rule) => rule.event === eventName && checkWorkshopCondition(rule.condition, stateForRule));
    if (matchingRules.length === 0) return;

    setWorkshopRuntime((prev) => {
      const next = {
        ...prev,
        hpByUserId: { ...prev.hpByUserId },
        messages: [...prev.messages],
        grantedItems: [...prev.grantedItems],
        effects: { ...prev.effects },
      };
      const resolveTargets = (target) => {
        if (target === 'both') return displayedParticipants.map((player) => player.userId);
        if (target === 'opponent') return displayedParticipants.filter((player) => player.userId !== Number(perspectiveUserId)).map((player) => player.userId);
        return [Number(perspectiveUserId)];
      };
      const currentHp = (targetId) => {
        const key = String(targetId);
        if (next.hpByUserId[key] != null) return Number(next.hpByUserId[key]);
        const target = displayedParticipantById[key];
        return hasWorkshopMode ? workshopBaseHp : Number(target?.characterHp || 0);
      };

      for (const rule of matchingRules) {
        const action = rule.action || {};
        if (action.type === 'MODIFY_HP') {
          for (const targetId of resolveTargets(action.target || 'self')) {
            const key = String(targetId);
            next.hpByUserId[key] = Math.max(0, Math.min(999, currentHp(targetId) + Number(action.value || 0)));
          }
        } else if (action.type === 'SET_HP') {
          for (const targetId of resolveTargets(action.target || 'self')) {
            const key = String(targetId);
            next.hpByUserId[key] = Math.max(0, Math.min(999, Number(action.value || 0)));
          }
        } else if (action.type === 'ADD_TIME') {
          next.timeDeltaSec = Math.max(-3600, Math.min(3600, Number(next.timeDeltaSec || 0) + Number(action.value || 0)));
        } else if (action.type === 'GRANT_ITEM') {
          next.grantedItems.push({ userId: Number(perspectiveUserId), item: action.item, at: Date.now() });
        } else if (action.type === 'DOUBLE_DAMAGE') {
          next.effects[`damage:${perspectiveUserId}`] = Date.now() + Number(action.duration || 0) * 1000;
        } else if (action.type === 'FREEZE_OPPONENT') {
          for (const targetId of resolveTargets('opponent')) {
            next.effects[`freeze:${targetId}`] = Date.now() + Number(action.duration || 0) * 1000;
          }
        } else if (action.type === 'HP_PERCENT') {
          const pct = Math.max(-100, Math.min(100, Number(action.value || 0)));
          for (const targetId of resolveTargets(action.target || 'self')) {
            const key = String(targetId);
            const delta = Math.round((Number(workshopBaseHp || 100) * pct) / 100);
            next.hpByUserId[key] = Math.max(0, Math.min(999, currentHp(targetId) + delta));
          }
        } else if (action.type === 'STEAL_HP') {
          const v = Math.max(1, Math.min(50, Number(action.value || 10)));
          const selfId = Number(perspectiveUserId);
          for (const oppId of resolveTargets('opponent')) {
            const oppKey = String(oppId);
            const stolen = Math.min(v, currentHp(oppId));
            next.hpByUserId[oppKey] = Math.max(0, currentHp(oppId) - stolen);
            next.hpByUserId[String(selfId)] = Math.max(0, Math.min(999, currentHp(selfId) + stolen));
          }
        } else if (action.type === 'SHIELD_NEXT') {
          next.effects[`shield:${perspectiveUserId}`] = Date.now() + Number(action.duration || 8) * 1000;
        }
        next.messages.push({
          id: `${Date.now()}_${rule.id}_${next.messages.length}`,
          eventName,
          text: action.type === 'SHOW_MESSAGE' ? action.text : formatWorkshopMessage(action, actor.username || t('abWsWorkshopActor'), t, workshopItemLabels),
        });
      }
      next.messages = next.messages.slice(-12);
      next.grantedItems = next.grantedItems.slice(-12);
      return next;
    });
  }, [
    currentRoom,
    displayedParticipantById,
    displayedParticipants,
    hasWorkshopMode,
    state?.submissions,
    workshopBaseHp,
    workshopRules,
    workshopRuntime.timeDeltaSec,
  ]);

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
    } catch { /* keep stale list on poll failure */ }
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

  const loadWorkshopModes = useCallback(async () => {
    try {
      const { data } = await api.get('/battle-modes', { params: { limit: 50, sort: 'like_count' } });
      setWorkshopModes(data.modes || []);
    } catch {
      setWorkshopModes([]);
      toast?.show(txt('워크샵 모드 목록을 불러오지 못했습니다.', 'Failed to load workshop modes.'), 'error');
    }
  }, [toast, txt]);

  const loadRoom = useCallback(async (id = roomId) => {
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/battles/rooms/${id}`);
      setState(data);
      // Apply room's preferred language to editor
      if (data?.room?.preferredLanguage) setLanguage(data.room.preferredLanguage);
    } catch (err) {
      toast?.show(errTxt(err, '배틀 방을 불러오지 못했습니다.', 'Failed to load battle room.'), 'error');
      navigate('/battle', { replace: true });
    } finally { setLoading(false); }
  }, [navigate, roomId, toast]);

    useEffect(() => {
      loadBattleModes();
      loadWorkshopModes();
      if (roomId) return;
      loadRooms();
      const t = setInterval(loadRooms, 4000);
      return () => clearInterval(t);
  }, [loadBattleModes, loadRooms, loadWorkshopModes, roomId]);

  useEffect(() => {
    const queryWorkshopModeId = searchParams.get('workshopModeId');
    if (queryWorkshopModeId) setSelectedWorkshopModeId(queryWorkshopModeId);
  }, [searchParams]);

  useEffect(() => {
    if (!roomId) { setState(null); return; }
    loadRoom(roomId);
    setActiveDebuffs({ typeLock: 0, submitBlock: 0, blind: 0 });
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
            toast?.show(uiLang === 'ko' ? '관전 모드로 전환합니다.' : (ack.message || 'Switching to spectator mode.'), 'info');
          }
        });
      }
    });
    socket.on('battle:room:update', (next) => { if (next?.room?.id === roomId) setState(next); });
    socket.on('battle:room:deleted', ({ roomId: deletedId }) => { if (deletedId === roomId) { toast?.show(txt('방이 삭제되었습니다.', 'Room deleted.'), 'info'); navigate('/battle'); } });
    socket.on('battle:countdown', ({ seconds }) => setCountdown(seconds || 3));
    socket.on('battle:started', (next) => { if (next?.room?.id === roomId) setState(next); setCountdown(null); });
    socket.on('battle:submission:result', (payload) => {
      setSubmissionResult({ ...payload, receivedAt: Date.now() });
      toast?.show(payload.result === 'correct' ? txt('⚔️ 공격 성공!', '⚔️ Attack success!') : txt('💨 공격 실패', '💨 Attack failed'), payload.result === 'correct' ? 'success' : 'warning');
    });
    socket.on('battle:player:attack', (event) => {
      setAttackUserId(event.userId);
      setTimeout(() => setAttackUserId(null), 700);
    });
    socket.on('battle:finished', (next) => {
      if (next?.room?.id !== roomId) return;
      const hasAnyOpponent = (next?.participants || []).some((p) => p.userId !== user?.id);
      if (!hasAnyOpponent) {
        toast?.show(txt('대기 시간이 만료되어 상대를 찾지 못했고 방이 닫혔습니다.', 'Wait time expired. No opponent found, room closed.'), 'warning');
        setTimeout(() => navigate('/battle', { replace: true }), 2500);
        return;
      }
      setState(next);
      const msg = next?.reason === 'forfeit'
        ? txt('상대방이 나가서 배틀이 종료되었습니다.', 'Opponent forfeited — battle over.')
        : txt('배틀이 종료되었습니다.', 'Battle ended.');
      toast?.show(msg, 'info');
    });
    socket.on('battle:effect', (event) => {
      const payload = event?.payload || {};
      const label = getBattleEffectLabel(payload, txt);
      const stat = payload.stat || {};
      const targetsMe = (payload.targetUserIds || []).map(Number).includes(Number(user?.id));
      const fmt = (val, suffix) => val == null || val === 0 ? '' : ` ${val > 0 ? '+' : ''}${val}${suffix}`;
      const deltaText = [
        fmt(stat.hpDelta, ' HP'),
        fmt(stat.attackDelta, ' ATK'),
        fmt(stat.speedDelta, ' SPD'),
      ].filter(Boolean).join(',');
      const sign = targetsMe && (stat.attackDelta < 0 || stat.speedDelta < 0)
        ? txt('내게 디버프', 'Debuff on me')
        : targetsMe
        ? txt('내게 버프', 'Buff on me')
        : txt('상대에게 영향', 'Effect on opponent');
      toast?.show(`✨ ${label}${deltaText ? ` (${deltaText.trim()})` : ''} — ${sign}`, targetsMe && (stat.attackDelta < 0 || stat.speedDelta < 0) ? 'error' : 'success');
    });
    socket.on('battle:item:used', (event) => {
      const payload = event?.payload || {};
      const itemType = payload.itemType;
      const targeted = (payload.targetUserIds || []).map(Number).includes(Number(user?.id));
      const durationMs = payload.durationMs;
      if (targeted && durationMs) {
        const expiry = Date.now() + durationMs;
        if (itemType === 'type-lock') {
          setActiveDebuffs((prev) => ({ ...prev, typeLock: expiry }));
          toast?.show(txt(`⌨️ 타이핑 잠금! ${Math.round(durationMs / 1000)}초간 에디터 비활성화`, `⌨️ Type Locked! Editor disabled for ${Math.round(durationMs / 1000)}s`), 'error', durationMs);
        } else if (itemType === 'submit-block') {
          setActiveDebuffs((prev) => ({ ...prev, submitBlock: expiry }));
          toast?.show(txt(`🚫 제출 차단! ${Math.round(durationMs / 1000)}초간 제출 불가`, `🚫 Submit Blocked! Cannot submit for ${Math.round(durationMs / 1000)}s`), 'error', durationMs);
        } else if (itemType === 'blind') {
          setActiveDebuffs((prev) => ({ ...prev, blind: expiry }));
          toast?.show(txt(`🌫️ 블라인드! ${Math.round(durationMs / 1000)}초간 화면 흐림`, `🌫️ Blinded! Screen blurred for ${Math.round(durationMs / 1000)}s`), 'error', durationMs);
        }
      } else {
        toast?.show(getBattleItemLabel(payload, workshopItemLabels) || txt('아이템 사용됨', 'Item used'), 'info');
      }
    });
    socket.on('battle:spectator_chat', (msg) => {
      setSpectatorMessages((prev) => [...prev.slice(-39), { ...msg, isSpectator: true }]);
    });
    socket.on('battle:room_invite', ({ roomId: inviteRoomId, inviterName, mode }) => {
      const modeTitle = FALLBACK_MODES.find(m => m.key === mode)?.title || mode;
      toast?.show(
        txt(`${inviterName}님이 ${modeTitle} 배틀에 초대했습니다!`,
            `${inviterName} invited you to a ${modeTitle} battle!`),
        'info',
        10000,
        inviteRoomId ? { label: txt('입장', 'Join'), onClick: () => navigate(`/battle/${inviteRoomId}`) } : null,
      );
    });
    return () => { socket.disconnect(); if (socketRef.current === socket) socketRef.current = null; };
  }, [navigate, roomId, searchParams, toast, user?.id, txt, workshopItemLabels]);

  // ── 자동 떠나기 ref 동기화 (대기 중인 방에서 나갔을 때 처리)
  useEffect(() => {
    autoLeaveRoomRef.current = currentRoom;
    autoLeaveSpectatingRef.current = isSpectating;
  });

  // ── 컴포넌트 언마운트 시 대기 중인 방 자동 퇴장 (SPA 이동)
  // 브라우저 탭 닫기는 소켓 disconnect 이벤트가 서버에서 처리
  useEffect(() => {
    return () => {
      const room = autoLeaveRoomRef.current;
      if (room?.status === 'waiting' && !autoLeaveSpectatingRef.current) {
        api.post(`/battles/rooms/${room.id}/leave`).catch(() => {});
      }
    };
  }, []);

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
    if (Math.max(0, timeLeft(currentRoom) + Number(workshopRuntime.timeDeltaSec || 0)) <= 0) {
      if (finishedRef.current) return;
      finishedRef.current = true;
      api.post(`/battles/rooms/${currentRoom.id}/finish`, { reason: 'timeout' }).catch(() => { /* best-effort timeout finish */ });
    }
  }, [clock, currentRoom, workshopRuntime.timeDeltaSec]);

  useEffect(() => {
    if (!hasWorkshopMode || currentRoom?.status !== 'playing') return;
    const hasStarted = events.some((event) => event.type === 'room.started');
    if (!hasStarted || workshopRuntime.messages.some((message) => message.eventName === 'ON_BATTLE_START')) return;
    for (const player of participants) runWorkshopEvent('ON_BATTLE_START', player.userId, player.userId);
  }, [currentRoom?.status, events, hasWorkshopMode, participants, runWorkshopEvent, workshopRuntime.messages]);

  useEffect(() => {
    if (!hasWorkshopMode || currentRoom?.status !== 'playing' || !latestSubmission?.id) return;
    if (processedWorkshopSubmissionsRef.current.has(latestSubmission.id)) return;
    processedWorkshopSubmissionsRef.current.add(latestSubmission.id);

    const actorId = Number(latestSubmission.userId);
    if (!actorId) return;
    const detail = String(latestSubmission.detail || '').toLowerCase();
    const compileFailed = !latestSubmission.isCorrect && (detail.includes('compile') || detail.includes('컴파일'));
    workshopWrongStreakRef.current[String(actorId)] = latestSubmission.isCorrect
      ? 0
      : Number(workshopWrongStreakRef.current[String(actorId)] || 0) + 1;

    const actorEvent = latestSubmission.isCorrect ? 'ON_CORRECT_ANSWER' : compileFailed ? 'ON_COMPILE_ERROR' : 'ON_WRONG_ANSWER';
    runWorkshopEvent(actorEvent, actorId, actorId);
    const opponentEvent = latestSubmission.isCorrect ? 'ON_OPPONENT_CORRECT' : 'ON_OPPONENT_WRONG';
    for (const player of participants) {
      if (player.userId !== actorId) runWorkshopEvent(opponentEvent, player.userId, actorId);
    }
  }, [currentRoom?.status, hasWorkshopMode, latestSubmission, participants, runWorkshopEvent]);

  useEffect(() => {
    if (!hasWorkshopMode || currentRoom?.status !== 'playing') return;
    const remaining = Math.max(0, timeLeft(currentRoom) + Number(workshopRuntime.timeDeltaSec || 0));
    if (!workshopTimerFlagsRef.current.half && remaining <= Number(currentRoom.durationSec || 0) / 2) {
      workshopTimerFlagsRef.current.half = true;
      for (const player of participants) runWorkshopEvent('ON_TIMER_HALF', player.userId, player.userId);
    }
    if (!workshopTimerFlagsRef.current.low && remaining < 60) {
      workshopTimerFlagsRef.current.low = true;
      for (const player of participants) runWorkshopEvent('ON_TIMER_LOW', player.userId, player.userId);
    }
  }, [clock, currentRoom, hasWorkshopMode, participants, runWorkshopEvent, workshopRuntime.timeDeltaSec]);

  useEffect(() => {
    if (!hasWorkshopMode || currentRoom?.status !== 'playing') return;
    for (const player of displayedParticipants) {
      const key = String(player.userId);
      const hp = Number(player.characterHp || 0);
      const flags = workshopHpFlagsRef.current[key] || {};
      if (!flags.hp50 && hp < 50) {
        flags.hp50 = true;
        runWorkshopEvent('ON_HP_BELOW_50', player.userId, player.userId);
      }
      if (!flags.hp25 && hp < 25) {
        flags.hp25 = true;
        runWorkshopEvent('ON_HP_BELOW_25', player.userId, player.userId);
      }
      workshopHpFlagsRef.current[key] = flags;
    }
  }, [currentRoom?.status, displayedParticipants, hasWorkshopMode, runWorkshopEvent]);

  // ── 로비 만료 체크 (대기 중 방) — 한 번만 실행
  useEffect(() => {
    lobbyExpiredRef.current = false;
    finishedRef.current = false;
    setSpectatorMessages([]);
    setDraftBannedTier('');
    setDraftBannedTags([]);
    setDraftPickedTags([]);
    setWorkshopRuntime({ hpByUserId: {}, timeDeltaSec: 0, messages: [], grantedItems: [], effects: {} });
    processedWorkshopSubmissionsRef.current = new Set();
    workshopTimerFlagsRef.current = { half: false, low: false };
    workshopHpFlagsRef.current = {};
    workshopWrongStreakRef.current = {};
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
      toast?.show(txt('대기 시간이 만료되었습니다.', 'Waiting time expired.'), 'warning');
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
  const updateInlineConfig = (patch) => setInlineWorkshopConfig((prev) => ({ ...prev, ...patch }));
  const addInlineRule = () => {
    if (inlineWorkshopConfig.rules.length >= 20) return;
    updateInlineConfig({ rules: [...inlineWorkshopConfig.rules, createInlineRule()] });
  };
  const removeInlineRule = (ruleId) => updateInlineConfig({ rules: inlineWorkshopConfig.rules.filter((r) => r.id !== ruleId) });
  const patchInlineRule = (ruleId, patch) => updateInlineConfig({ rules: inlineWorkshopConfig.rules.map((r) => r.id === ruleId ? { ...r, ...patch } : r) });
  const patchInlineRuleCond = (ruleId, patch) => updateInlineConfig({ rules: inlineWorkshopConfig.rules.map((r) => r.id === ruleId ? { ...r, condition: { ...r.condition, ...patch } } : r) });
  const patchInlineRuleAction = (ruleId, patch) => updateInlineConfig({ rules: inlineWorkshopConfig.rules.map((r) => r.id === ruleId ? { ...r, action: { ...r.action, ...patch } } : r) });

    const createRoom = async () => {
      setCreating(true);
      try {
        const modeConfig = battleModes.find((m) => m.key === selectedMode);
        const safeFilters = sanitizeProblemFilters(normalizedProblemFilters, problemTiers);
        const roomProblemFilters = selectedMode === 'draft-ban' ? DEFAULT_PROBLEM_FILTERS : safeFilters;
        const effectiveInlineConfig = (showInlineWorkshop && !selectedWorkshopModeId && inlineWorkshopConfig.rules.length > 0)
          ? inlineWorkshopConfig : null;
        const { data } = await api.post('/battles/rooms', {
          mode: selectedMode,
          maxPlayers: 2,
          durationSec: selectedWorkshopMode?.config?.timeLimit || (modeConfig?.key === 'territory' ? 600 : selectedDuration),
          isPrivate,
          preferredLanguage,
          workshopModeId: selectedWorkshopModeId || null,
          inlineConfig: effectiveInlineConfig,
          bannedTags: roomProblemFilters.bannedTags,
          problemFilters: roomProblemFilters,
          title: roomTitle.trim() || null,
        });
      if (data.room?.inviteCode) {
        const copied = await copyText(data.room.inviteCode);
        toast?.show(
          copied
            ? txt(`초대 코드 ${data.room.inviteCode} 복사 완료.`, `Invite code ${data.room.inviteCode} copied.`)
            : txt(`초대 코드: ${data.room.inviteCode}`, `Invite code: ${data.room.inviteCode}`),
          copied ? 'success' : 'info',
        );
      }
      navigate(`/battle/${data.room.id}`);
    } catch (err) {
      if (err.response?.status === 409) {
        const existingRoomId = err.response?.data?.roomId;
        toast?.show(
          errTxt(err, '이미 활성화된 방이 있습니다.', 'You already have an active room.'),
          'error',
          5000,
          existingRoomId ? { label: txt('이동', 'Go'), onClick: () => navigate(`/battle/${existingRoomId}`) } : null,
        );
      } else {
        toast?.show(errTxt(err, '방 생성에 실패했습니다.', 'Failed to create room'), 'error');
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
      toast?.show(errTxt(err, '초대 코드가 올바르지 않습니다.', 'Invalid invite code.'), 'error');
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
          toast?.show(txt('이미 시작된 방이라 관전자로 입장합니다.', 'Room already started, joining as spectator.'), 'info');
          navigate(`/battle/${id}?spectate=1`);
          return;
        }
      } catch {
        // 참가 실패 원인을 확인하지 못하면 원래 오류를 표시합니다.
      }
      toast?.show(errTxt(err, '방 입장에 실패했습니다.', 'Failed to join room'), 'error');
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
      } catch (err) { toast?.show(errTxt(err, '준비 처리에 실패했습니다.', 'Failed to ready'), 'error'); }
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
        toast?.show(data?.room?.status === 'playing' ? txt('드래프트 완료. 문제가 확정되었습니다.', 'Draft complete. Problem finalized.') : txt('드래프트를 제출했습니다.', 'Draft submitted.'), 'success');
      } catch (err) {
        toast?.show(errTxt(err, '드래프트 제출에 실패했습니다.', 'Failed to submit draft'), 'error');
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
      toast?.show(errTxt(err, '제출에 실패했습니다.', 'Submission failed'), 'error');
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
      toast?.show(errTxt(err, '채팅 전송에 실패했습니다.', 'Failed to send chat'), 'error');
      setChatInput(message);
    }
  };

  const sendEmote = async (emote) => {
    if (!currentRoom || isSpectating) return;
    try {
      const { data } = await api.post(`/battles/rooms/${currentRoom.id}/emote`, { emote });
      if (data.state) setState(data.state);
    } catch (err) { toast?.show(errTxt(err, '이모트 전송 실패', 'Failed to send emote'), 'error'); }
  };

  const useItem = async (itemType) => {
    if (!currentRoom || isSpectating || itemCooldownLeft > 0) return;
    try {
      const { data } = await api.post(`/battles/rooms/${currentRoom.id}/item`, { itemType });
      if (data.state) setState(data.state);
    } catch (err) { toast?.show(errTxt(err, '아이템 사용 실패', 'Failed to use item'), 'error'); }
  };

  const deleteRoom = async () => {
    if (!currentRoom) return;
    if (Number(currentRoom.createdBy) !== Number(user?.id)) {
      console.warn('[deleteRoom] createdBy mismatch', currentRoom.createdBy, user?.id);
      return;
    }
    try {
      await api.delete(`/battles/rooms/${currentRoom.id}`);
      toast?.show(txt('방이 삭제되었습니다.', 'Room deleted.'), 'success');
      navigate('/battle');
    } catch (err) {
      console.error('[deleteRoom] error', err.response?.status, err.response?.data);
      toast?.show(errTxt(err, '방 삭제에 실패했습니다.', 'Failed to delete room'), 'error');
    }
  };

  const leave = async () => {
    if (currentRoom && !isSpectating) {
      try { await api.post(`/battles/rooms/${currentRoom.id}/leave`); } catch { /* best-effort */ }
    }
    navigate('/battle');
  };

  const copyInviteCode = async () => {
    const code = currentRoom?.inviteCode;
    if (!code) return;
    const copied = await copyText(code);
    toast?.show(
      copied ? txt('초대 코드를 복사했습니다.', 'Invite code copied.') : txt(`초대 코드: ${code}`, `Invite code: ${code}`),
      copied ? 'success' : 'info',
    );
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
      toast?.show(errTxt(err, '새 배틀 생성에 실패했습니다.', 'Failed to create new battle.'), 'error');
      navigate('/battle');
    }
  };

  // ════════════════════════════════════════════════
  // RENDER: 로비 (방 없을 때)
  // ════════════════════════════════════════════════
  if (!roomId) {
    const isTerritorySelected = selectedMode === 'territory';
    const filterSummary = getProblemFilterSummary(normalizedProblemFilters, t, uiLang);
    return (
      <div className="ab-page">
        <div className="ab-header">
          <div>
            <h1>{txt('실시간 알고리즘 배틀', 'Real-Time Algorithm Battle')}</h1>
            <p>{txt('5가지 모드 — 스피드, HP 서바이벌, 이펙트, 아이템, 영토.', 'Compete across 5 modes — Speed, HP Survival, Effects, Items, Territory.')}</p>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/battles/history')}
            style={{ flexShrink:0 }}
          >
            {txt('내 배틀 기록', 'My Battle History')}
          </button>
        </div>

        {/* 방 만들기 카드 */}
        <section className="ab-create-card">
          <div className="ab-section-title">{txt('방 만들기', 'Create Room')}</div>

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
                  <strong>{uiLang === 'ko' ? (BATTLE_MODE_KO[mode.key]?.title || mode.title) : mode.title}</strong>
                  <span>{uiLang === 'ko' ? (BATTLE_MODE_KO[mode.key]?.description || mode.description) : mode.description}</span>
                </div>
              </button>
            ))}
          </div>

          {/* 선택된 모드 규칙 */}
          {battleModes.find(m => m.key === selectedMode)?.rules && (
            <div className="ab-rules-card">
              <div className="ab-rules-title">
                📋 {uiLang === 'ko' ? (BATTLE_MODE_KO[selectedMode]?.title || battleModes.find(m => m.key === selectedMode)?.title) : battleModes.find(m => m.key === selectedMode)?.title} {txt('규칙', 'Rules')}
              </div>
              <ul>
                {(uiLang === 'ko' ? (BATTLE_MODE_KO[selectedMode]?.rules || battleModes.find(m => m.key === selectedMode)?.rules || []) : (battleModes.find(m => m.key === selectedMode)?.rules || [])).map((rule, i) => (
                  <li key={i}>{rule}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 방 제목 입력 */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 4 }}>
              {txt('방 제목 (선택)', 'Room Title (optional)')}
            </div>
            <input
              className="ab-input"
              type="text"
              maxLength={60}
              placeholder={txt('배틀 방 제목을 입력하세요', 'Enter a room title...')}
              value={roomTitle}
              onChange={(e) => setRoomTitle(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          {/* 시간 + 언어 + 비밀방 설정 */}
          <div className="ab-create-options">
            {!isTerritorySelected && (
              <div className="ab-option-group">
                <label>{txt('게임 시간', 'Game Time')}</label>
                <div className="ab-duration-pills">
                  {DURATION_PRESETS.map((d) => (
                    <button
                      key={d.sec}
                      type="button"
                      className={selectedDuration === d.sec ? 'active' : ''}
                      onClick={() => setSelectedDuration(d.sec)}
                    >
                      {uiLang === 'ko' ? d.labelKo : d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="ab-option-group">
              <label>{txt('언어', 'Language')}</label>
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
              <label>{txt('워크샵 모드', 'Workshop Mode')}</label>
              <select
                value={selectedWorkshopModeId}
                onChange={(e) => { setSelectedWorkshopModeId(e.target.value); if (e.target.value) setShowInlineWorkshop(false); }}
                className="ab-lang-select"
              >
                <option value="">{txt('사용 안 함', 'None')}</option>
                {workshopModes.map((mode) => (
                  <option key={mode.id} value={mode.id}>{mode.name}</option>
                ))}
              </select>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/workshop-gallery')}>
                <Wrench size={13} /> {txt('갤러리', 'Gallery')}
              </button>
              {!selectedWorkshopModeId && (
                <button
                  type="button"
                  className={`btn btn-ghost btn-sm${showInlineWorkshop ? ' active' : ''}`}
                  onClick={() => setShowInlineWorkshop((v) => !v)}
                >
                  <Sliders size={13} /> {txt('직접 입력', 'Custom Rules')}
                </button>
              )}
            </div>

            <div className="ab-option-group">
              <label>{txt('비공개 방', 'Private Room')}</label>
              <button
                type="button"
                className={`ab-private-toggle ${isPrivate ? 'active' : ''}`}
                onClick={() => setIsPrivate((v) => !v)}
              >
                {isPrivate ? <><Lock size={14} /> {txt('비공개 ON', 'Private ON')}</> : <><Unlock size={14} /> {txt('공개', 'Public')}</>}
              </button>
              {isPrivate && <p className="ab-private-hint">{txt('방 생성 후 초대 코드를 공유하세요.', 'Share invite code after creating room.')}</p>}
            </div>
          </div>

          {showInlineWorkshop && !selectedWorkshopModeId && (() => {
            const evtLabels = { ON_CORRECT_ANSWER: t('workshopEvt_ON_CORRECT_ANSWER'), ON_WRONG_ANSWER: t('workshopEvt_ON_WRONG_ANSWER'), ON_COMPILE_ERROR: t('workshopEvt_ON_COMPILE_ERROR'), ON_OPPONENT_CORRECT: t('workshopEvt_ON_OPPONENT_CORRECT'), ON_OPPONENT_WRONG: t('workshopEvt_ON_OPPONENT_WRONG'), ON_TIMER_HALF: t('workshopEvt_ON_TIMER_HALF'), ON_TIMER_LOW: t('workshopEvt_ON_TIMER_LOW'), ON_BATTLE_START: t('workshopEvt_ON_BATTLE_START'), ON_HP_BELOW_50: t('workshopEvt_ON_HP_BELOW_50'), ON_HP_BELOW_25: t('workshopEvt_ON_HP_BELOW_25') };
            const condLabels = { always: t('workshopCond_always'), hp_below: t('workshopCond_hp_below'), hp_above: t('workshopCond_hp_above'), opponent_hp_below: t('workshopCond_opponent_hp_below'), time_remaining_below: t('workshopCond_time_remaining_below'), solved_count_above: t('workshopCond_solved_count_above'), wrong_streak_above: t('workshopCond_wrong_streak_above') };
            const actLabels = { MODIFY_HP: t('workshopAct_MODIFY_HP'), SET_HP: t('workshopAct_SET_HP'), ADD_TIME: t('workshopAct_ADD_TIME'), GRANT_ITEM: t('workshopAct_GRANT_ITEM'), DOUBLE_DAMAGE: t('workshopAct_DOUBLE_DAMAGE'), FREEZE_OPPONENT: t('workshopAct_FREEZE_OPPONENT'), SHOW_MESSAGE: t('workshopAct_SHOW_MESSAGE') };
            const tgtLabels = { self: t('workshopTgt_self'), opponent: t('workshopTgt_opponent'), both: t('workshopTgt_both') };
            const itemLabels = { shield: t('workshopItem_shield'), bomb: t('workshopItem_bomb'), heal: t('workshopItem_heal'), freeze: t('workshopItem_freeze') };
            return (
              <div className="ab-inline-workshop">
                <div className="ab-inline-ws-header">
                  <Sliders size={15} />
                  <strong>{txt('커스텀 룰 빌더', 'Custom Rule Builder')}</strong>
                  <span style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>{txt('저장 없이 이 방에만 적용됩니다', 'Applied only to this room, not saved')}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
                    <label style={{ fontSize: '0.8rem', display: 'flex', gap: 6, alignItems: 'center' }}>
                      {txt('기본 HP', 'Base HP')}
                      <input type="number" min={1} max={999} value={inlineWorkshopConfig.baseHp} onChange={(e) => updateInlineConfig({ baseHp: Number(e.target.value) })} style={{ width: 60 }} />
                    </label>
                    <label style={{ fontSize: '0.8rem', display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="checkbox" checked={inlineWorkshopConfig.allowItems} onChange={(e) => updateInlineConfig({ allowItems: e.target.checked })} />
                      {t('workshopAllowItems')}
                    </label>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={addInlineRule} disabled={inlineWorkshopConfig.rules.length >= 20}>
                    <Plus size={13} /> {t('workshopAddRule')}
                  </button>
                </div>
                {inlineWorkshopConfig.rules.length === 0 && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', padding: '8px 0' }}>{t('workshopEmptyRules')}</p>
                )}
                <div className="workshop-rule-list">
                  {inlineWorkshopConfig.rules.map((rule, idx) => (
                    <article className="workshop-rule-card" key={rule.id}>
                      <div className="workshop-rule-title">
                        <strong>{withVars(t('workshopRuleNum'), { n: idx + 1 })}</strong>
                        <button type="button" onClick={() => removeInlineRule(rule.id)}><Trash2 size={14} /></button>
                      </div>
                      <div className="workshop-form-row">
                        <label>{t('workshopEventLabel')}<select value={rule.event} onChange={(e) => patchInlineRule(rule.id, { event: e.target.value })}>{Object.entries(evtLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                        <label>{t('workshopConditionLabel')}<select value={rule.condition?.type || 'always'} onChange={(e) => patchInlineRule(rule.id, { condition: defaultInlineCond(e.target.value) })}>{Object.entries(condLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                        {rule.condition?.type !== 'always' && <label>{t('workshopCondValueLabel')}<input type="number" value={rule.condition?.value ?? 0} onChange={(e) => patchInlineRuleCond(rule.id, { value: Number(e.target.value) })} /></label>}
                      </div>
                      <div className="workshop-form-row">
                        <label>{t('workshopActionLabel')}<select value={rule.action?.type || 'MODIFY_HP'} onChange={(e) => patchInlineRule(rule.id, { action: defaultInlineAction(e.target.value) })}>{Object.entries(actLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                        {['MODIFY_HP', 'SET_HP'].includes(rule.action?.type) && (<>
                          <label>{t('workshopTargetLabel')}<select value={rule.action.target || 'self'} onChange={(e) => patchInlineRuleAction(rule.id, { target: e.target.value })}>{Object.entries(tgtLabels).filter(([v]) => rule.action.type === 'MODIFY_HP' || v !== 'both').map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                          <label>{t('workshopHpValueLabel')}<input type="number" value={rule.action.value ?? 0} onChange={(e) => patchInlineRuleAction(rule.id, { value: Number(e.target.value) })} /></label>
                        </>)}
                        {rule.action?.type === 'ADD_TIME' && <label>{t('workshopTimeSecLabel')}<input type="number" value={rule.action.value ?? 0} onChange={(e) => patchInlineRuleAction(rule.id, { value: Number(e.target.value) })} /></label>}
                        {rule.action?.type === 'GRANT_ITEM' && <label>{t('workshopItemLabel')}<select value={rule.action.item || 'shield'} onChange={(e) => patchInlineRuleAction(rule.id, { item: e.target.value })}>{Object.entries(itemLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>}
                        {['DOUBLE_DAMAGE', 'FREEZE_OPPONENT'].includes(rule.action?.type) && <label>{t('workshopDurationLabel')}<input type="number" min={1} max={600} value={rule.action.duration ?? 1} onChange={(e) => patchInlineRuleAction(rule.id, { duration: Number(e.target.value) })} /></label>}
                        {rule.action?.type === 'SHOW_MESSAGE' && <label className="wide">{t('workshopMessageLabel')}<input value={rule.action.text || ''} maxLength={120} onChange={(e) => patchInlineRuleAction(rule.id, { text: e.target.value })} /></label>}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            );
          })()}

          {selectedWorkshopMode && (
            <div className="ab-draft-lobby-note">
              <Wrench size={16} />
              <div>
                <strong>{selectedWorkshopMode.name}</strong>
                <span>
                  {txt(`기본 HP ${selectedWorkshopMode.config?.baseHp || 100} · 제한 시간 ${fmtSec(selectedWorkshopMode.config?.timeLimit || selectedDuration)} · 룰 ${(selectedWorkshopMode.config?.rules || []).length}개`, `Base HP ${selectedWorkshopMode.config?.baseHp || 100} · Time ${fmtSec(selectedWorkshopMode.config?.timeLimit || selectedDuration)} · Rules: ${(selectedWorkshopMode.config?.rules || []).length}`)}
                </span>
              </div>
            </div>
          )}

          {selectedMode === 'draft-ban' ? (
            <div className="ab-draft-lobby-note">
              <Shield size={16} />
              <div>
                <strong>{txt('드래프트는 방 입장 후 진행됩니다', 'Draft begins after entering the room')}</strong>
                <span>{txt('방 생성 시 문제 조건을 설정하지 않습니다. 양쪽 플레이어가 준비 후 조건을 선택하고 문제가 확정됩니다.', 'No problem conditions are set at room creation. Both players select conditions after readying up and the problem is confirmed.')}</span>
              </div>
            </div>
          ) : (
            <div className={`ab-filter-panel ${showProblemFilters ? 'open' : 'compact'}`}>
              <div className="ab-filter-head">
                <div>
                  <strong>{txt('문제 필터', 'Problem Filter')}</strong>
                  <span>{filterSummary}</span>
                </div>
                <div className="ab-filter-actions">
                  {showProblemFilters && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setProblemFilters(DEFAULT_PROBLEM_FILTERS)}
                    >
                      {txt('초기화', 'Reset')}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowProblemFilters((v) => !v)}
                  >
                    {showProblemFilters ? txt('접기', 'Collapse') : txt('필터', 'Filter')}
                  </button>
                </div>
              </div>

              {showProblemFilters && (
                <div className="ab-filter-grid">
                  <div className="ab-filter-block">
                    <label>{txt('티어 범위', 'Tier Range')}</label>
                    <div className="ab-segmented">
                      {[
                        ['auto', txt('자동', 'Auto')],
                        ['min', txt('이상', 'Min+')],
                        ['max', txt('이하', 'Max')],
                        ['range', txt('범위', 'Range')],
                        ['only', txt('선택', 'Select')],
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
                            {problemTiers.map((tier) => <option key={tier} value={tier}>{tierLblBattle(tier, uiLang)}+</option>)}
                          </select>
                        )}
                        {normalizedProblemFilters.tierMode === 'range' && <span>~</span>}
                        {['max', 'range'].includes(normalizedProblemFilters.tierMode) && (
                          <select value={normalizedProblemFilters.maxTier} onChange={(e) => updateProblemFilters({ maxTier: e.target.value })}>
                            {problemTiers.map((tier) => <option key={tier} value={tier}>≤{tierLblBattle(tier, uiLang)}</option>)}
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
                            {tierLblBattle(tier, uiLang)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="ab-filter-block">
                    <label>{txt('밴 티어', 'Banned Tiers')}</label>
                    <div className="ab-chip-list">
                      {problemTiers.map((tier) => (
                        <button
                          type="button"
                          key={tier}
                          className={normalizedProblemFilters.bannedTiers.includes(tier) ? 'active danger' : ''}
                          onClick={() => toggleFilterTier('bannedTiers', tier)}
                        >
                          {tierLblBattle(tier, uiLang)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="ab-filter-block wide">
                    <label>{txt('필수 태그', 'Required Tags')}</label>
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
                                {getTagLabelLang(tag, uiLang)}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="ab-filter-block wide">
                    <label>{txt('밴 태그', 'Banned Tags')}</label>
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
                                {getTagLabelLang(tag, uiLang)}
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
            {creating ? <span className="spinner" /> : <Plus size={16} />} {txt('방 만들기', 'Create Room')}
          </button>
        </section>

        {/* 코드로 입장 */}
        <section className="ab-join-code-section">
          <div className="ab-section-title">{txt('초대 코드로 입장', 'Join by Code')}</div>
          <div className="ab-join-code-row">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && joinByCode()}
              placeholder={txt('6자리 초대 코드 입력', 'Enter 6-digit invite code')}
              maxLength={8}
              className="mono"
            />
            <button className="btn btn-ghost" onClick={joinByCode} disabled={joiningByCode || !joinCode.trim()}>
              {joiningByCode ? <span className="spinner" /> : txt('입장', 'Join')}
            </button>
          </div>
        </section>

        {/* 공개 방 목록 */}
        <section className="ab-room-list">
          <div className="ab-section-title">{txt('공개 방 / 관전', 'Public Rooms / Spectate')}</div>
          {rooms.length === 0 ? (
            <div className="ab-empty ab-empty-cta">
              <strong>{txt('첫 번째 방을 만들어보세요', 'Create the first room')}</strong>
              <span>{txt('스피드부터 테리토리 모드까지 도전하세요.', 'Challenge yourself in speed to territory modes.')}</span>
              <button className="btn btn-primary btn-sm" onClick={createRoom} disabled={creating}>
                {creating ? <span className="spinner" /> : <Plus size={14} />} {txt('방 만들기', 'Create Room')}
              </button>
            </div>
          ) : rooms.map((item) => {
            const _rawMode = battleModes.find((m) => m.key === item.room.mode);
            const modeLabel = uiLang === 'ko' ? (BATTLE_MODE_KO[item.room.mode]?.title || _rawMode?.title || item.room.mode) : (_rawMode?.title || item.room.mode);
            const isPlaying = item.room.status === 'playing';
            const participantCount = item.participantCount ?? item.participants?.length ?? 0;
            const isFull = participantCount >= item.room.maxPlayers;
            return (
              <div key={item.room.id} className={`ab-room-row ${isPlaying ? 'playing' : 'waiting'}`}>
                <div>
                  <strong>
                    {item.room?.title || item.problem?.title || (isPlaying ? txt('진행 중', 'In Progress') : modeLabel)}
                  </strong>
                  <span>
                    {modeLabel} · {participantCount}/{item.room.maxPlayers} · {isPlaying ? `⏱ ${fmtSec(timeLeft(item.room))} ${txt('남음', 'left')}` : (() => { const ll = lobbyTimeLeft(item.room); return ll != null ? `⏳ ${fmtSec(ll)} ${txt('대기', 'wait')}` : txt('대기 중', 'Waiting'); })()}
                  </span>
                </div>
                <div className="ab-room-row-actions">
                  {isPlaying && (
                    <span className="ab-live-badge">{txt('진행 중', 'LIVE')}</span>
                  )}
                  {!isPlaying && Number(item.room.createdBy) === Number(user?.id) && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={async () => {
                        try {
                          await api.delete(`/battles/rooms/${item.room.id}`);
                          toast?.show(txt('방이 삭제되었습니다.', 'Room deleted.'), 'success');
                          loadRooms();
                        } catch (err) {
                          toast?.show(errTxt(err, '방 삭제에 실패했습니다.', 'Failed to delete room'), 'error');
                        }
                      }}
                    >{txt('삭제', 'Delete')}</button>
                  )}
                  {!isPlaying && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => spectateRoom(item.room.id)}
                    >{txt('관전', 'Spectate')}</button>
                  )}
                  <button
                    className={isPlaying ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                    onClick={() => (isPlaying ? spectateRoom(item.room.id) : joinRoom(item.room.id))}
                    disabled={!isPlaying && isFull}
                  >
                    {isPlaying ? txt('관전', 'Spectate') : isFull ? txt('만석', 'Full') : txt('입장', 'Join')}
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
    ? txt('관전 종료', 'Spectating Ended')
    : !hasOpponent
    ? txt('상대 없음', 'No match')
    : isDraw
      ? txt('무승부', 'Draw')
      : didWin
        ? txt('🏆 승리!', '🏆 Victory!')
        : txt('배틀 종료', 'Battle Over');
  const resultTone = isSpectatorResult || !hasOpponent ? 'neutral' : isDraw ? 'draw' : didWin ? 'win' : 'lose';
  const opponentLabel = opponents.map((player) => player.username).join(', ') || txt('상대 없음', 'No opponent');
  const winnerLabel = topScoreCount === 1 ? sortedParticipants[0]?.username : null;
  const displayedRoomTimeLeft = Math.max(0, timeLeft(currentRoom) + Number(workshopRuntime.timeDeltaSec || 0));
  const resultSummary = isSpectatorResult
    ? winnerLabel ? txt(`승자: ${winnerLabel} · 최종 ${topScore}점`, `Winner: ${winnerLabel} · Final ${topScore}pts`) : txt('무승부', 'Draw')
    : isTerritoryMode
    ? txt(`점령 ${myClaimCount}/${problems?.length || 5}`, `Claimed ${myClaimCount}/${problems?.length || 5}`)
    : txt(`최종 ${me?.score || 0}점`, `Final ${me?.score || 0}pts`);

  return (
      <div className="ab-room-page">
        {/* 상단 바 */}
        <div className="ab-room-top">
          <button className="btn btn-ghost btn-sm" onClick={leave}>← {txt('나가기', 'Leave')}</button>
          <div className="ab-room-title">
            <strong>{isDrafting ? txt('드래프트 진행 중', 'Draft in progress') : currentRoom?.title || activeProblem?.title || txt('배틀', 'Battle')}</strong>
            <span>
              {getBattleModeTitle(currentRoom?.mode, config, uiLang)} ·{' '}
              {currentRoom?.status === 'waiting'
                ? isDrafting ? `${txt('드래프트', 'Draft')} (${draftState?.submittedCount || 0}/${draftState?.requiredCount || 2})` : lobbyLeft != null ? `${txt('대기', 'Waiting')} (${fmtSec(lobbyLeft)} ${txt('남음', 'left')})` : txt('대기 중', 'Waiting')
                : currentRoom?.status === 'playing'
                  ? config?.winCondition === 'first-correct'
                  ? txt('⚡ 첫 정답 → 즉시 승리', '⚡ First correct → instant win')
                  : `⏱ ${fmtSec(displayedRoomTimeLeft)}`
                : txt('종료', 'Ended')}
          </span>
        </div>
        <div className="ab-room-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowRules(v => !v)} title={txt('모드 규칙 보기', 'View mode rules')}>
            📋 {txt('규칙', 'Rules')}
          </button>
          {currentRoom?.inviteCode && (
            <button className="btn btn-ghost btn-sm ab-invite-code" onClick={copyInviteCode} title={txt('초대 코드 복사', 'Copy invite code')}>
              <Copy size={13} /> {currentRoom.inviteCode}
            </button>
          )}
          {currentRoom?.status === 'waiting' && Number(currentRoom?.createdBy) === Number(user?.id) && (
            <InviteUserPanel roomId={currentRoom.id} txt={txt} toast={toast} />
          )}
          {currentRoom?.status === 'waiting' && Number(currentRoom?.createdBy) === Number(user?.id) && (
            <button className="btn btn-danger btn-sm" onClick={deleteRoom}>{txt('방 삭제', 'Delete Room')}</button>
          )}
            {currentRoom?.status === 'waiting' && !isDrafting && (
              <button className="btn btn-success btn-sm" onClick={ready} disabled={me?.isReady || isSpectating}>
                {me?.isReady ? txt('준비 완료 ✓', 'Ready ✓') : txt('준비', 'Ready')}
              </button>
            )}
            {isDrafting && (
              <button className="btn btn-success btn-sm" disabled>
                {txt('드래프트 진행 중', 'Draft in progress')}
              </button>
            )}
          {currentRoom?.status === 'playing' && (
            <button className="btn btn-primary btn-sm" onClick={submit} disabled={submitting || isSpectating || isSubmitBlocked}
              title={isSubmitBlocked ? txt('제출이 차단되었습니다!', 'Submit blocked!') : undefined}>
              {isSpectating ? txt('관전 중', 'Spectating') : isSubmitBlocked ? txt('🚫 제출 차단됨', '🚫 Blocked') : submitting ? <span className="spinner" /> : <><Play size={13} /> {txt('제출', 'Submit')}</>}
            </button>
          )}
        </div>
      </div>

      {countdown != null && <div className="ab-countdown">{countdown > 0 ? countdown : txt('🔥 시작!', '🔥 Start!')}</div>}
      {isSpectating && (
        <div className="ab-spectator-banner">
          👀 {txt('관전 모드. 제출 / 아이템 / 준비는 비활성화 — 라이브 배틀을 시청하세요.', 'Spectator mode. Submit / items / ready are disabled — watch the live battle.')}
        </div>
      )}

      {/* 모드 규칙 패널 */}
      {showRules && config?.rules && (
        <div style={{ margin:'0 16px', padding:'12px 16px', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, fontSize:13 }}>
          <div style={{ fontWeight:700, marginBottom:8 }}>📋 {getBattleModeTitle(currentRoom?.mode, config, uiLang)} {txt('규칙', 'Rules')}</div>
          <ul style={{ margin:0, paddingLeft:18, display:'flex', flexDirection:'column', gap:4 }}>
            {getBattleModeRules(currentRoom?.mode, config, uiLang).map((rule, i) => <li key={i} style={{ color:'var(--text2)' }}>{rule}</li>)}
            {workshopRules.map((rule, i) => (
              <li key={`workshop-${rule.id || i}`} style={{ color:'var(--purple)' }}>
                {workshopEventLabels[rule.event] || rule.event} → {rule.action?.type || t('abActionLabel')}
              </li>
            ))}
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
            ['problem', currentRoom?.status === 'playing' ? txt('문제/에디터', 'Problem/Editor') : isDrafting ? txt('드래프트', 'Draft') : txt('로비', 'Lobby')],
            ['players', txt('플레이어', 'Players')],
            ['log', txt('채팅/로그', 'Chat/Log')],
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
          <div className="ab-section-title">{txt('플레이어', 'Players')}</div>
          <div className="ab-player-list">
            {displayedParticipants.map((player) => (
              <PlayerCard
                key={player.userId}
                player={player}
                me={player.userId === user?.id}
                txt={txt}
                attacking={attackUserId === player.userId}
                activity={activityByUserId[String(player.userId)]}
                showHp={config?.winCondition === 'hp-knockout'}
                isCodeGolf={isCodeGolfMode}
              />
            ))}
          </div>

          {isTerritoryMode && (
            <>
              <div className="ab-section-title" style={{ marginTop: 12 }}>{txt('영토 현황', 'Territory Status')}</div>
              <div className="ab-territory-score">
                  {displayedParticipants.map((p) => {
                  const count = Object.values(territoryClaims).filter((uid) => uid === p.userId).length;
                  return (
                    <div key={p.userId} className="ab-territory-score-row">
                      <span>{p.username}{p.userId === user?.id ? ` ${txt('(나)', '(me)')}` : ''}</span>
                      <span className="ab-territory-count">{count} / {problems?.length || 5}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {!isTerritoryMode && (
            <>
              <div className="ab-section-title" style={{ marginTop: 12 }}>{txt('순위', 'Rankings')}</div>
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
                  <strong>{loading ? txt('로딩 중...', 'Loading...') : txt('대기 중', 'Waiting')}</strong>
                  <span>{txt('양쪽 플레이어가 준비되면', 'When both players are ready,')} {isDraftBanRoom ? txt('드래프트 단계가 시작됩니다.', 'the draft phase begins.') : txt('문제가 확정되고 게임이 시작됩니다.', 'the problem is confirmed and the game starts.')}</span>
                </div>
              )
            ) : (
              <>
                {activeProblem ? (
                  <div className="ab-problem" style={isBlinded ? { filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none' } : undefined}>
                    {isBlinded && (
                      <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontSize: 28 }}>🌫️</span>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{txt('블라인드 적용됨', 'Blinded')}</span>
                      </div>
                    )}
                    <h2>
                      {activeProblem.title}
                      <span className="ab-problem-tier" style={{ marginLeft: 8, fontSize: 12, opacity: 0.6 }}>
                        [{tierLblBattle(activeProblem.tier || 'unranked', uiLang)}]
                      </span>
                    </h2>
                    <p>{activeProblem.desc}</p>
                    {activeProblem.examples?.[0] && (
                      <div className="ab-example">
                        <pre><b>{txt('입력', 'Input')}</b>{'\n'}{activeProblem.examples[0].input}</pre>
                        <pre><b>{txt('출력', 'Output')}</b>{'\n'}{activeProblem.examples[0].output}</pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="ab-problem">
                    <p style={{ color: 'var(--text3)' }}>{loading ? txt('로딩 중...', 'Loading...') : txt('문제 확정 중...', 'Confirming problem...')}</p>
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
                    {getBattleObjectiveText(config, isTerritoryMode, txt)}
                  </span>
                </div>

                <div className="ab-editor" style={{ position: 'relative' }}>
                  {isTypeLocked && (
                    <div style={{
                      position: 'absolute', inset: 0, zIndex: 10,
                      background: 'rgba(220,38,38,0.18)', backdropFilter: 'blur(2px)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'column', gap: 8, pointerEvents: 'none',
                    }}>
                      <span style={{ fontSize: 32 }}>⌨️🔒</span>
                      <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, textShadow: '0 1px 4px #000' }}>
                        {txt('타이핑 잠금', 'Type Locked')}
                      </span>
                    </div>
                  )}
                  <Suspense fallback={<div className="ab-empty">{txt('에디터 로딩 중...', 'Loading editor...')}</div>}>
                    <Editor
                      height="100%"
                      language={JUDGE_LANGUAGE_OPTIONS.find((o) => o.value === language)?.monaco || 'python'}
                      theme={editorSettings.theme || 'vs-dark'}
                      value={code}
                      onChange={(v) => { if (!isTypeLocked) { setCode(v || ''); emitActivity('typing'); } }}
                      options={{
                        fontSize: editorSettings.font_size || editorSettings.fontSize || 14,
                        minimap: { enabled: !!editorSettings.minimap },
                        scrollBeyondLastLine: false,
                        tabSize: editorSettings.tab_size || editorSettings.tabSize || 2,
                        fontFamily: editorSettings.font_family || "'Space Mono', 'Fira Code', Consolas, monospace",
                        lineNumbers: editorSettings.line_numbers !== false ? 'on' : 'off',
                        autoClosingBrackets: editorSettings.auto_close_brackets === false ? 'never' : 'always',
                        readOnly: isTypeLocked,
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
              <div className="ab-section-title">{txt('아이템', 'Items')}</div>
              <div className="ab-tactics">
                <div className="ab-item-grid">
                  {(config.availableItems || []).map((item) => (
                    <button
                      type="button"
                      key={item.key}
                      onClick={() => useItem(item.key)}
                      disabled={currentRoom?.status !== 'playing' || isSpectating || itemCooldownLeft > 0}
                      title={item.description || (uiLang === 'ko' ? item.labelKo : item.label)}
                    >
                      <span>{uiLang === 'ko' ? (item.labelKo || item.label) : item.label}</span>
                    </button>
                  ))}
                </div>
                {itemCooldownLeft > 0 && (
                  <div className="ab-cooldown"><Clock size={12} /> {txt('쿨다운', 'Cooldown')} {itemCooldownLeft}s</div>
                )}
              </div>
            </>
          )}

          {hasWorkshopMode && (
            <>
              <div className="ab-section-title">{t('abWsEffectsSection')}</div>
              <div className="ab-submit-card">
                <strong>{config?.workshopMode?.name || t('abWsModeName')}</strong>
                <span>
                  {withVars(t('abWsStats'), { hp: workshopBaseHp, rules: workshopRules.length, delta: `${Number(workshopRuntime.timeDeltaSec || 0) >= 0 ? '+' : ''}${workshopRuntime.timeDeltaSec || 0}` })}
                </span>
                {workshopRuntime.grantedItems.length > 0 && (
                  <p>
                    {withVars(t('abWsGrantedItems'), { items: workshopRuntime.grantedItems.slice(-4).map((item) => workshopItemLabels[item.item] || item.item).join(', ') })}
                  </p>
                )}
              </div>
            </>
          )}

          {/* 제출 결과 */}
          <div className="ab-section-title">{txt('제출 결과', 'Submission Result')}</div>
          {submissionResult && (
            <div className={`ab-submit-card ab-submit-flash ${submissionResult.result === 'correct' ? 'correct' : 'wrong'}`}>
              <strong>{submissionResult.result === 'correct' ? txt('⚔️ 공격 성공', '⚔️ Attack Success') : txt('💨 공격 실패', '💨 Attack Failed')}</strong>
              <span>
                {submissionResult.userId === user?.id ? txt('내 제출', 'My submission') : txt(`${participantById[String(submissionResult.userId)]?.username || '상대'}님의 제출`, `${participantById[String(submissionResult.userId)]?.username || 'Opponent'} submission`)}
                {' · '}
                {submissionResult.timeMs != null ? `${submissionResult.timeMs}ms` : txt('시간 -', 'Time -')}
                {' · '}
                +{submissionResult.score || 0}
              </span>
              {submissionResult.detail && <p>{submissionResult.detail}</p>}
            </div>
          )}
          {latestSubmission ? (
            <div className={`ab-submit-card ${latestSubmission.isCorrect ? 'correct' : 'wrong'}`}>
              <strong>{latestSubmission.isCorrect ? txt('✅ 정답', '✅ Correct') : txt('❌ 오답', '❌ Wrong')}</strong>
              <span>{latestSubmission.language} · {latestSubmission.executionTimeMs != null ? `${latestSubmission.executionTimeMs}ms` : '-'} · +{latestSubmission.score}</span>
              {latestSubmission.detail && <p>{latestSubmission.detail}</p>}
            </div>
          ) : (
            <div className="ab-empty">{txt('아직 제출이 없습니다.', 'No submissions yet.')}</div>
          )}

          {/* 전투 로그 */}
          <div className="ab-section-title">{txt('전투 로그', 'Battle Log')}</div>
          <div className="ab-combat-log">
            {combatEvents.length === 0 && workshopRuntime.messages.length === 0
              ? <div className="ab-log-empty">{txt('아직 활동이 없습니다.', 'No activity yet.')}</div>
              : (
                <>
                  {[...workshopRuntime.messages].reverse().map((message) => (
                    <div key={message.id} className="ab-log-entry" style={{ borderLeft: '2px solid var(--purple)' }}>
                      <span className="ab-log-emoji">🛠️</span>
                      <div>
                        <strong>{workshopEventLabels[message.eventName] || t('abWsWorkshopActor')}</strong>
                        <span>{message.text}</span>
                      </div>
                    </div>
                  ))}
                  {[...combatEvents].reverse().map((event) => {
                const fmt = formatCombatEvent(event, user?.id, participantById, txt, workshopItemLabels);
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
                </>
              )}
          </div>

          {/* 채팅 + 이모트 */}
          <div className="ab-section-title">{txt('채팅 / 입장 알림', 'Chat / Join Alerts')}</div>
          <div className="ab-social">
            <div className="ab-chat-feed" ref={chatFeedRef}>
              {socialEvents.length === 0 && spectatorMessages.length === 0
                ? <div className="ab-log-empty">{txt('아직 메시지가 없습니다.', 'No messages yet.')}</div>
                : [...socialEvents].slice(-40).map((event) => {
                  const fmt = formatSocialEvent(event, user?.id, participantById, txt);
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
                  <b>{msg.username} <span style={{ fontSize: 10, color: 'var(--text3)' }}>{txt('관전 중', 'spectating')}</span></b>
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
                placeholder={isSpectating ? txt('관전 채팅 (gg=좋은 게임, nice=나이스, wp=잘했어요...)', 'Spectator chat (gg, nice, wp...)') : txt('채팅 (gg=좋은 게임, nice=나이스, wp=잘했어요...)', 'Chat (gg, nice, wp...)')}
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
              <strong>{isTerritoryMode && didWin ? txt('🏆 영토 점령 승리!', '🏆 Territory Victory!') : resultTitle}</strong>
              <span>
                {isSpectatorResult
                  ? resultSummary
                  : !hasOpponent
                  ? txt('상대 없음 — 결과가 반영되지 않습니다.', 'No opponent — result not counted.')
                  : isTerritoryMode
                  ? `Claims ${myClaimCount}/${problems?.length || 5}`
                  : `Final score: ${me?.score || 0}`}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/battle')} style={{ marginTop: 8 }}>
                {txt('로비', 'Lobby')}
              </button>
            </div>
          )}
        </aside>
      </div>

      {currentRoom?.status === 'finished' && (
        <div className={`ab-result-overlay ${resultTone}`}>
          <div className="ab-result-modal">
            <div className="ab-result-kicker">{getBattleModeTitle(currentRoom?.mode, config, uiLang) || txt('알고리즘 배틀', 'Algorithm Battle')} {txt('결과', 'Result')}</div>
            <div className="ab-result-icon">{resultTone === 'win' ? '🏆' : resultTone === 'draw' ? '🤝' : resultTone === 'lose' ? '💥' : '⏱️'}</div>
            <h2>{isTerritoryMode && didWin ? txt('영토 점령 승리!', 'Territory Conquest Win!') : resultTitle}</h2>
            <p>
              {isSpectatorResult
                ? resultSummary
                : !hasOpponent
                ? txt('상대방 없음 — 결과가 반영되지 않습니다.', 'No opponent — result will not be counted.')
                : `vs ${opponentLabel} · ${resultSummary}`}
            </p>
            <div className="ab-result-scoreboard">
              {sortedParticipants.map((player, index) => (
                <div key={player.userId} className={player.userId === user?.id ? 'me' : ''}>
                  <span>#{index + 1} {player.username}{player.userId === user?.id ? ` ${txt('(나)', '(me)')}` : ''}</span>
                  <strong>{isTerritoryMode ? txt(`${Object.values(territoryClaims).filter((uid) => uid === player.userId).length}개 점령`, `${Object.values(territoryClaims).filter((uid) => uid === player.userId).length} claims`) : txt(`${player.score}점`, `${player.score} pts`)}</strong>
                </div>
              ))}
            </div>
            <div className="ab-result-actions">
              <button className="btn btn-primary" onClick={createAgain}>{txt('다시 하기', 'Play Again')}</button>
              <button className="btn btn-ghost" onClick={() => navigate('/battle')}>{txt('로비', 'Lobby')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
