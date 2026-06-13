// Floating bottom-right friends widget. Two responsibilities:
//   1) Heartbeat: pings /api/auth/me/heartbeat every 60s with the current
//      page-derived activity label so others see what I'm doing.
//   2) Friends panel: list followed users + online status + activity, with a
//      one-click DM modal (polling-based chat).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Users, MessageCircle, X, Send, Circle } from 'lucide-react'
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
  arcade: '🕹️ 아케이드',
  battle: '⚔️ 배틀',
  judge: '🧪 문제풀이',
  community: '💬 커뮤니티',
  ai: '🤖 AI 멘토',
  ranking: '🏆 랭킹',
  dashboard: '📊 대시보드',
  profile: '👤 프로필',
  settings: '⚙️ 설정',
  learning: '📚 학습',
  idle: '💤 대기',
  unknown: '⚪ 알 수 없음',
}
const ACTIVITY_LABELS_EN = {
  arcade: '🕹️ Arcade',
  battle: '⚔️ Battle',
  judge: '🧪 Judge',
  community: '💬 Community',
  ai: '🤖 AI Mentor',
  ranking: '🏆 Ranking',
  dashboard: '📊 Dashboard',
  profile: '👤 Profile',
  settings: '⚙️ Settings',
  learning: '📚 Learning',
  idle: '💤 Idle',
  unknown: '⚪ Unknown',
}

function activityLabel(act, lang) {
  const map = lang === 'ko' ? ACTIVITY_LABELS_KO : ACTIVITY_LABELS_EN
  return map[act] || map.unknown
}

function DmModal({ partner, onClose, lang }) {
  const txt = (ko, en) => (lang === 'ko' ? ko : en)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const listRef = useRef(null)

  const fetchMessages = useCallback(async () => {
    try {
      const { data } = await api.get(`/dm/${partner.id}/messages`, { params: { limit: 50 } })
      setMessages(data?.messages || [])
      setErr('')
    } catch (e) {
      setErr(e?.response?.data?.message || txt('메시지를 불러올 수 없습니다.', 'Failed to load.'))
    }
  }, [partner.id])

  useEffect(() => {
    fetchMessages()
    const t = setInterval(fetchMessages, DM_POLL_MS)
    return () => clearInterval(t)
  }, [fetchMessages])

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  const send = async () => {
    const content = input.trim()
    if (!content || sending) return
    setSending(true)
    try {
      const { data } = await api.post(`/dm/${partner.id}/messages`, { content })
      setInput('')
      setMessages((m) => [...m, data])
    } catch (e) {
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
        <div ref={listRef} className="dm-modal-list">
          {messages.length === 0 && !err && (
            <div className="dm-modal-empty">{txt('첫 메시지를 보내보세요!', 'Send the first message!')}</div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`dm-msg${m.sentByMe ? ' me' : ''}`}>
              <div className="dm-msg-bubble">{m.content}</div>
              <div className="dm-msg-time">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
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
  const txt = (ko, en) => (lang === 'ko' ? ko : en)

  const [open, setOpen] = useState(false)
  const [data, setData] = useState({ online: [], offline: [] })
  const [unreadCount, setUnreadCount] = useState(0)
  const [dmPartner, setDmPartner] = useState(null)

  const activity = useMemo(() => pathToActivity(location.pathname), [location.pathname])

  // Heartbeat: every 60s + immediately when activity changes
  useEffect(() => {
    if (!user?.id) return undefined
    let cancelled = false
    const ping = () => {
      if (cancelled) return
      api.post('/auth/me/heartbeat', { activity }).catch(() => {})
    }
    ping()
    const t = setInterval(ping, HEARTBEAT_MS)
    return () => { cancelled = true; clearInterval(t) }
  }, [user?.id, activity])

  // Friends list polling
  useEffect(() => {
    if (!user?.id) return undefined
    let cancelled = false
    const fetchFriends = async () => {
      try {
        const { data: d } = await api.get('/follows/online')
        if (!cancelled) setData({ online: d?.online || [], offline: d?.offline || [] })
      } catch {
        if (!cancelled) setData({ online: [], offline: [] })
      }
    }
    fetchFriends()
    const t = setInterval(fetchFriends, ONLINE_REFRESH_MS)
    return () => { cancelled = true; clearInterval(t) }
  }, [user?.id])

  // Unread DM badge
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
    const t = setInterval(fetch, ONLINE_REFRESH_MS)
    return () => { cancelled = true; clearInterval(t) }
  }, [user?.id, dmPartner])

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
        <DmModal partner={dmPartner} onClose={() => setDmPartner(null)} lang={lang} />
      )}
    </>
  )
}
