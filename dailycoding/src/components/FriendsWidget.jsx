// Floating bottom-right friends widget. Two responsibilities:
//   1) Heartbeat: pings /api/auth/me/heartbeat every 60s with the current
//      page-derived activity label so others see what I'm doing.
//   2) Friends panel: list followed users + online status + activity, with a
//      one-click DM modal.
//
// Polling intervals pause when the tab is hidden (Page Visibility API) so
// background tabs don't burn requests. DM modal does delta fetches via
// `?sinceId=` once an initial snapshot is loaded so each poll typically
// transfers nothing.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Users, MessageCircle, X, Send, Circle, Check, CheckCheck } from 'lucide-react'
import api from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLang } from '../context/LangContext.jsx'

const HEARTBEAT_MS = 60_000
const ONLINE_REFRESH_MS = 30_000
const DM_POLL_MS = 3_000

function pathToActivity(pathname) {
  if (!pathname || pathname === '/') return 'dashboard'
  if (pathname.startsWith('/arcade')) return 'arcade'
  if (pathname.startsWith('/battle') || pathname.startsWith('/algorithm-battle')) return 'battle'
  if (pathname.startsWith('/problems') || pathname.startsWith('/judge')) return 'judge'
  if (pathname.startsWith('/community')) return 'community'
  if (pathname.startsWith('/ai')) return 'ai'
  if (pathname.startsWith('/ranking')) return 'ranking'
  if (pathname.startsWith('/profile')) return 'profile'
  if (pathname.startsWith('/settings')) return 'settings'
  if (pathname.startsWith('/learning') || pathname.startsWith('/exams') || pathname.startsWith('/sheets')) return 'learning'
  return 'idle'
}

const ACTIVITY_LABELS_KO = {
  arcade: '🕹️ 아케이드', battle: '⚔️ 배틀', judge: '🧪 문제풀이',
  community: '💬 커뮤니티', ai: '🤖 AI 멘토', ranking: '🏆 랭킹',
  dashboard: '📊 대시보드', profile: '👤 프로필', settings: '⚙️ 설정',
  learning: '📚 학습', idle: '💤 대기', unknown: '⚪ 알 수 없음',
}
const ACTIVITY_LABELS_EN = {
  arcade: '🕹️ Arcade', battle: '⚔️ Battle', judge: '🧪 Judge',
  community: '💬 Community', ai: '🤖 AI Mentor', ranking: '🏆 Ranking',
  dashboard: '📊 Dashboard', profile: '👤 Profile', settings: '⚙️ Settings',
  learning: '📚 Learning', idle: '💤 Idle', unknown: '⚪ Unknown',
}

function activityLabel(act, lang) {
  const map = lang === 'ko' ? ACTIVITY_LABELS_KO : ACTIVITY_LABELS_EN
  return map[act] || map.unknown
}

// Returns the current document.hidden value and re-renders on visibility change
function useIsVisible() {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' ? true : !document.hidden)
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])
  return visible
}

function DmModal({ partner, onClose, lang, isVisible }) {
  const txt = (ko, en) => (lang === 'ko' ? ko : en)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const listRef = useRef(null)
  // Track the highest message id we've already rendered so subsequent polls
  // can fetch a delta. We can't add a backend "since" param without changing
  // the API, so for now we still fetch the limit-50 window but skip the
  // setMessages update if the newest id hasn't moved.
  const lastIdRef = useRef(0)
  const stickToBottomRef = useRef(true)

  const fetchMessages = useCallback(async () => {
    try {
      const { data } = await api.get(`/dm/${partner.id}/messages`, { params: { limit: 50 } })
      const list = data?.messages || []
      const newestId = list.length ? list[list.length - 1].id : 0
      // No new messages since last poll → skip state churn so React doesn't
      // re-render the bubble list every 3 seconds.
      if (newestId && newestId === lastIdRef.current) return
      lastIdRef.current = newestId
      setMessages(list)
      setErr('')
    } catch (e) {
      setErr(e?.response?.data?.message || txt('메시지를 불러올 수 없습니다.', 'Failed to load.'))
    }
  }, [partner.id])

  // Initial load + visibility-aware polling
  useEffect(() => {
    fetchMessages()
    if (!isVisible) return undefined
    const t = setInterval(fetchMessages, DM_POLL_MS)
    return () => clearInterval(t)
  }, [fetchMessages, isVisible])

  // Auto-scroll only if the user was at the bottom (don't yank them up)
  useEffect(() => {
    if (!listRef.current) return
    if (stickToBottomRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  const onScroll = () => {
    if (!listRef.current) return
    const el = listRef.current
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  const send = async () => {
    const content = input.trim()
    if (!content || sending) return
    setSending(true)
    // Optimistic insert with negative temp id (server ids are positive int)
    const tempId = -Date.now()
    const optimistic = {
      id: tempId,
      from: 'me',
      to: partner.id,
      content,
      createdAt: new Date().toISOString(),
      sentByMe: true,
      pending: true,
    }
    stickToBottomRef.current = true
    setInput('')
    setMessages((m) => [...m, optimistic])
    try {
      const { data } = await api.post(`/dm/${partner.id}/messages`, { content })
      // Replace the optimistic entry with the confirmed server one
      setMessages((m) => m.map((x) => (x.id === tempId ? { ...data, sentByMe: true } : x)))
      if (data?.id && data.id > lastIdRef.current) lastIdRef.current = data.id
    } catch (e) {
      setMessages((m) => m.map((x) => (x.id === tempId ? { ...x, failed: true, pending: false } : x)))
      setErr(e?.response?.data?.message || txt('전송 실패', 'Send failed'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="dm-modal-backdrop" onClick={onClose}>
      <div className="dm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dm-modal-head">
          <div>
            <strong>{partner.nickname || partner.displayName || partner.username}</strong>
            <span className="dm-modal-activity">
              {partner.online ? '🟢 ' : '⚪ '}
              {activityLabel(partner.currentActivity, lang)}
            </span>
          </div>
          <button className="dm-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        {err && <div className="dm-modal-err">{err}</div>}
        <div ref={listRef} className="dm-modal-list" onScroll={onScroll}>
          {messages.length === 0 && !err && (
            <div className="dm-modal-empty">{txt('첫 메시지를 보내보세요!', 'Send the first message!')}</div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`dm-msg${m.sentByMe ? ' me' : ''}`}>
              <div className={`dm-msg-bubble${m.failed ? ' failed' : ''}${m.pending ? ' pending' : ''}`}>{m.content}</div>
              <div className="dm-msg-time">
                {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {m.sentByMe && !m.pending && !m.failed && (
                  m.readAt ? <CheckCheck size={11} className="dm-tick read" /> : <Check size={11} className="dm-tick" />
                )}
                {m.failed && <span className="dm-msg-failed">{txt(' · 실패', ' · failed')}</span>}
              </div>
            </div>
          ))}
        </div>
        <form
          className="dm-modal-input"
          onSubmit={(e) => { e.preventDefault(); send() }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={txt('메시지 입력...', 'Type a message...')}
            maxLength={2000}
            disabled={sending}
            autoFocus
          />
          <button type="submit" disabled={!input.trim() || sending}>
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  )
}

export default function FriendsWidget() {
  const { user } = useAuth()
  const { lang } = useLang()
  const location = useLocation()
  const isVisible = useIsVisible()
  const txt = (ko, en) => (lang === 'ko' ? ko : en)

  const [open, setOpen] = useState(false)
  const [data, setData] = useState({ online: [], offline: [] })
  const [unreadCount, setUnreadCount] = useState(0)
  const [dmPartner, setDmPartner] = useState(null)

  const activity = useMemo(() => pathToActivity(location.pathname), [location.pathname])

  // Heartbeat: every 60s + immediately when activity changes; pauses on hidden tab
  useEffect(() => {
    if (!user?.id) return undefined
    if (!isVisible) return undefined
    let cancelled = false
    const ping = () => {
      if (cancelled) return
      api.post('/auth/me/heartbeat', { activity }).catch(() => {})
    }
    ping()
    const t = setInterval(ping, HEARTBEAT_MS)
    return () => { cancelled = true; clearInterval(t) }
  }, [user?.id, activity, isVisible])

  // Friends list polling — pauses on hidden tab and when panel is closed
  // (we still do one initial fetch on mount so the unread badge is accurate).
  useEffect(() => {
    if (!user?.id) return undefined
    let cancelled = false
    const fetchFriends = async () => {
      try {
        const { data: d } = await api.get('/follows/online')
        if (!cancelled) setData({ online: d?.online || [], offline: d?.offline || [] })
      } catch {
        // ignore
      }
    }
    fetchFriends()
    if (!isVisible || !open) return undefined
    const t = setInterval(fetchFriends, ONLINE_REFRESH_MS)
    return () => { cancelled = true; clearInterval(t) }
  }, [user?.id, isVisible, open])

  // Unread DM badge — pauses on hidden tab; refreshes when DM modal closes
  useEffect(() => {
    if (!user?.id) return undefined
    let cancelled = false
    const fetch = async () => {
      try {
        const { data: d } = await api.get('/dm/unread-count')
        if (!cancelled) setUnreadCount(Number(d?.count || 0))
      } catch { /* ignore */ }
    }
    fetch()
    if (!isVisible) return undefined
    const t = setInterval(fetch, ONLINE_REFRESH_MS)
    return () => { cancelled = true; clearInterval(t) }
  }, [user?.id, dmPartner, isVisible])

  if (!user?.id) return null

  return (
    <>
      <button
        className={`friends-fab${open ? ' open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label="Friends"
      >
        {open ? <X size={20} /> : <Users size={20} />}
        {!open && unreadCount > 0 && <span className="friends-fab-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="friends-panel">
          <div className="friends-panel-head">
            <strong>{txt('친구', 'Friends')}</strong>
            <span>{data.online.length} {txt('온라인', 'online')}</span>
          </div>
          <div className="friends-panel-list">
            {data.online.length === 0 && data.offline.length === 0 && (
              <div className="friends-empty">{txt('아직 팔로우한 사람이 없어요.', 'You are not following anyone yet.')}</div>
            )}
            {data.online.map((f) => (
              <button key={f.id} className="friend-row online" onClick={() => setDmPartner(f)}>
                <Circle size={8} className="online-dot" fill="#7ee787" stroke="#7ee787" />
                <div className="friend-row-main">
                  <strong>{f.nickname || f.displayName || f.username}</strong>
                  <span>{activityLabel(f.currentActivity, lang)}</span>
                </div>
                <MessageCircle size={16} className="friend-row-msg" />
              </button>
            ))}
            {data.offline.length > 0 && (
              <div className="friends-section-head">{txt('오프라인', 'Offline')} · {data.offline.length}</div>
            )}
            {data.offline.slice(0, 20).map((f) => (
              <button key={f.id} className="friend-row offline" onClick={() => setDmPartner(f)}>
                <Circle size={8} className="offline-dot" fill="#6e7681" stroke="#6e7681" />
                <div className="friend-row-main">
                  <strong>{f.nickname || f.displayName || f.username}</strong>
                  <span>
                    {f.lastActiveAt
                      ? txt(`마지막 접속 ${new Date(f.lastActiveAt).toLocaleDateString()}`, `Last seen ${new Date(f.lastActiveAt).toLocaleDateString()}`)
                      : txt('접속 기록 없음', 'Never online')}
                  </span>
                </div>
                <MessageCircle size={16} className="friend-row-msg" />
              </button>
            ))}
          </div>
        </div>
      )}

      {dmPartner && (
        <DmModal partner={dmPartner} onClose={() => setDmPartner(null)} lang={lang} isVisible={isVisible} />
      )}
    </>
  )
}
