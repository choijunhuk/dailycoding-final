import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import api from '../api.js'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext.jsx'
import { useLang } from '../context/LangContext.jsx'
import './CommunityPage.css'

const BOARD_META = {
  qna: { label: 'Q&A', tone: 'var(--blue)', desc: '질문과 답변을 정리하는 공간' },
  tech: { label: '기술토론', tone: 'var(--green)', desc: '구현 전략, 성능, 아키텍처를 토론하는 공간' },
  lounge: { label: '라운지', tone: 'var(--purple)', desc: '가벼운 이야기와 회고를 나누는 공간' },
}

function parseTags(raw) {
  if (Array.isArray(raw)) return raw.filter(Boolean)
  if (typeof raw !== 'string') return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch {
    return raw.split(',').map((tag) => tag.trim()).filter(Boolean)
  }
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function makeAvatar(label, color = 'var(--blue)', size = 38) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: `linear-gradient(135deg, ${color}, var(--bg3))`,
      color: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: Math.max(12, Math.round(size * 0.34)),
      fontWeight: 800,
      flexShrink: 0,
    }}>
      {(label || '?').slice(0, 1).toUpperCase()}
    </div>
  )
}

function SectionTitle({ title, desc, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{title}</div>
        {desc && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{desc}</div>}
      </div>
      {action}
    </div>
  )
}

function BoardTabs({ activeBoard, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {Object.entries(BOARD_META).map(([key, meta]) => {
        const active = key === activeBoard
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              border: '1px solid var(--border)',
              background: active ? meta.tone : 'var(--bg2)',
              color: active ? 'var(--bg)' : 'var(--text)',
              borderRadius: 999,
              padding: '10px 16px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: active ? `0 8px 24px ${meta.tone}22` : 'none',
            }}
          >
            <span>{meta.label}</span>
            <span style={{ fontSize: 11, opacity: active ? 0.9 : 0.7 }}>{meta.desc}</span>
          </button>
        )
      })}
    </div>
  )
}

function Modal({ open, onClose, title, children, wide = false }) {
  if (!open) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.55)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        zIndex: 400,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: wide ? 980 : 720,
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          boxShadow: '0 24px 60px rgba(0,0,0,.35)',
        }}
      >
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              border: '1px solid var(--border)',
              background: 'var(--bg3)',
              color: 'var(--text2)',
              width: 34,
              height: 34,
              borderRadius: 10,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 18,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}

export default function CommunityPage() {
  const params = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const toast = useToast()
  const { t } = useLang()
  const activeBoard = BOARD_META[params.board] ? params.board : 'qna'
  const postIdFromRoute = Number(params.id) || null
  const postIdFromQuery = Number(new URLSearchParams(location.search).get('post')) || null
  const selectedPostId = postIdFromRoute || postIdFromQuery

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState('')
  const [postsState, setPostsState] = useState({ posts: [], totalPages: 1, total: 0 })
  const [popularPosts, setPopularPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedPost, setSelectedPost] = useState(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [editorMode, setEditorMode] = useState('create')
  const [draft, setDraft] = useState({ title: '', content: '', tags: '', isAnonymous: false })
  const [savingPost, setSavingPost] = useState(false)
  const [replyDraft, setReplyDraft] = useState('')
  const [replyBusy, setReplyBusy] = useState(false)

  const normalizedPosts = useMemo(() => postsState.posts.map((post) => ({
    ...post,
    tags: parseTags(post.tags),
  })), [postsState.posts])

  const refreshPopular = useCallback(async () => {
    try {
      const { data } = await api.get('/community/popular')
      const filtered = (data.posts || []).filter((post) => post.board_type === activeBoard).slice(0, 5)
      setPopularPosts(filtered.map((post) => ({ ...post, tags: parseTags(post.tags) })))
    } catch {
      setPopularPosts([])
    }
  }, [activeBoard])

  const refreshPosts = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/community/${activeBoard}`, { params: { page, q: search || undefined, tag: tag || undefined } })
      setPostsState({
        posts: data.posts || [],
        totalPages: Math.max(1, data.totalPages || 1),
        total: data.total || 0,
      })
    } catch (error) {
      setPostsState({ posts: [], totalPages: 1, total: 0 })
      toast?.show(error.response?.data?.message || '커뮤니티 목록을 불러오지 못했습니다.', 'error')
    } finally {
      setLoading(false)
    }
  }, [activeBoard, page, search, tag, toast])

  const refreshDetail = useCallback(async (postId) => {
    if (!postId) return
    setDetailLoading(true)
    try {
      const { data } = await api.get(`/community/${activeBoard}/${postId}`)
      setSelectedPost({ ...data, tags: parseTags(data.tags) })
    } catch (error) {
      toast?.show(error.response?.data?.message || '게시글을 불러오지 못했습니다.', 'error')
      setSelectedPost(null)
      navigate(`/community/${activeBoard}`, { replace: true })
    } finally {
      setDetailLoading(false)
    }
  }, [activeBoard, navigate, toast])

  useEffect(() => {
    setPage(1)
    setSearch('')
    setTag('')
  }, [activeBoard])

  useEffect(() => {
    refreshPosts()
  }, [refreshPosts])

  useEffect(() => {
    refreshPopular()
  }, [refreshPopular])

  useEffect(() => {
    if (selectedPostId) {
      refreshDetail(selectedPostId)
    } else {
      setSelectedPost(null)
      setReplyDraft('')
    }
  }, [selectedPostId, refreshDetail])

  const openPost = (postId) => {
    navigate(`/community/${activeBoard}/${postId}`)
  }

  const closePost = () => {
    navigate(`/community/${activeBoard}`)
  }

  const openComposer = (mode = 'create', post = null) => {
    if (mode === 'create' && !user?.emailVerified) {
      toast?.show('이메일 인증 후 게시글 작성이 가능합니다. 받은 편지함을 확인하거나 인증 메일을 재전송해 주세요.', 'warning')
      navigate('/verify-email')
      return
    }
    setEditorMode(mode)
    setDraft(mode === 'edit' && post ? {
      title: post.title || '',
      content: post.content || '',
      tags: parseTags(post.tags).join(', '),
      isAnonymous: Boolean(post.is_anonymous),
    } : {
      title: '',
      content: '',
      tags: '',
      isAnonymous: false,
    })
    setComposerOpen(true)
  }

  const submitPost = async () => {
    const payload = {
      title: draft.title.trim(),
      content: draft.content.trim(),
      tags: draft.tags.split(',').map((value) => value.trim()).filter(Boolean),
      is_anonymous: draft.isAnonymous,
    }
    if (!payload.title || !payload.content) {
      toast?.show('제목과 내용을 입력하세요.', 'warning')
      return
    }
    setSavingPost(true)
    try {
      if (editorMode === 'edit' && selectedPost?.id) {
        await api.patch(`/community/${activeBoard}/${selectedPost.id}`, payload)
        toast?.show('게시글을 수정했습니다.', 'success')
        await refreshDetail(selectedPost.id)
      } else {
        const { data } = await api.post(`/community/${activeBoard}`, payload)
        toast?.show('게시글을 등록했습니다.', 'success')
        openPost(data.id)
      }
      setComposerOpen(false)
      await refreshPosts()
      await refreshPopular()
    } catch (error) {
      toast?.show(error.response?.data?.message || '게시글 저장에 실패했습니다.', 'error')
    } finally {
      setSavingPost(false)
    }
  }

  const deletePost = async () => {
    if (!selectedPost?.id) return
    try {
      await api.delete(`/community/${activeBoard}/${selectedPost.id}`)
      toast?.show('게시글을 삭제했습니다.', 'success')
      closePost()
      await refreshPosts()
      await refreshPopular()
    } catch (error) {
      toast?.show(error.response?.data?.message || '게시글 삭제에 실패했습니다.', 'error')
    }
  }

  const togglePostLike = async (postId) => {
    try {
      await api.post(`/community/${activeBoard}/${postId}/like`)
      await Promise.all([refreshPosts(), selectedPost?.id === postId ? refreshDetail(postId) : Promise.resolve()])
    } catch {
      toast?.show('좋아요 처리에 실패했습니다.', 'error')
    }
  }

  const toggleScrap = async (postId) => {
    try {
      await api.post(`/community/${activeBoard}/${postId}/scrap`)
      await Promise.all([refreshPosts(), selectedPost?.id === postId ? refreshDetail(postId) : Promise.resolve()])
    } catch {
      toast?.show('스크랩 처리에 실패했습니다.', 'error')
    }
  }

  const submitReply = async () => {
    if (!selectedPost?.id || !replyDraft.trim()) return
    setReplyBusy(true)
    try {
      await api.post(`/community/${activeBoard}/${selectedPost.id}/replies`, { content: replyDraft.trim() })
      setReplyDraft('')
      toast?.show('댓글을 등록했습니다.', 'success')
      await Promise.all([refreshDetail(selectedPost.id), refreshPosts()])
    } catch (error) {
      toast?.show(error.response?.data?.message || '댓글 등록에 실패했습니다.', 'error')
    } finally {
      setReplyBusy(false)
    }
  }

  const deleteReply = async (replyId) => {
    if (!selectedPost?.id) return
    try {
      await api.delete(`/community/${activeBoard}/${selectedPost.id}/replies/${replyId}`)
      toast?.show('댓글을 삭제했습니다.', 'success')
      await Promise.all([refreshDetail(selectedPost.id), refreshPosts()])
    } catch (error) {
      toast?.show(error.response?.data?.message || '댓글 삭제에 실패했습니다.', 'error')
    }
  }

  const acceptReply = async (replyId) => {
    if (!selectedPost?.id) return
    try {
      await api.post(`/community/qna/${selectedPost.id}/replies/${replyId}/accept`)
      toast?.show('답변을 채택했습니다.', 'success')
      await Promise.all([refreshDetail(selectedPost.id), refreshPosts()])
    } catch (error) {
      toast?.show(error.response?.data?.message || '답변 채택에 실패했습니다.', 'error')
    }
  }

  const likeReply = async (replyId) => {
    if (!selectedPost?.id) return
    try {
      await api.post(`/community/${activeBoard}/${selectedPost.id}/replies/${replyId}/like`)
      await refreshDetail(selectedPost.id)
    } catch {
      toast?.show('댓글 좋아요 처리에 실패했습니다.', 'error')
    }
  }

  const blockAuthor = async (targetId) => {
    if (!targetId) return
    try {
      await api.post(`/community/block/${targetId}`)
      toast?.show('해당 사용자를 차단 목록에 반영했습니다.', 'success')
      closePost()
      await refreshPosts()
      await refreshPopular()
    } catch (error) {
      toast?.show(error.response?.data?.message || '사용자 차단에 실패했습니다.', 'error')
    }
  }

  const isMyPost = selectedPost?.user_id === user?.id
  const postAuthorName = selectedPost?.nickname || selectedPost?.username || '익명'

  const composerModal = (
    <Modal open={composerOpen} onClose={() => setComposerOpen(false)} title={editorMode === 'edit' ? '게시글 수정' : '새 게시글 작성'}>
      <div style={{ display: 'grid', gap: 14 }}>
        <input
          value={draft.title}
          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
          placeholder="제목"
          style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 12, padding: '12px 14px', fontFamily: 'inherit', fontSize: 14, outline: 'none' }}
        />
        <textarea
          value={draft.content}
          onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
          placeholder="본문을 입력하세요. 사용자 멘션은 @username 형식으로 작성할 수 있습니다."
          rows={12}
          style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 14, padding: '14px 16px', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.7, resize: 'vertical', outline: 'none' }}
        />
        <input
          value={draft.tags}
          onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))}
          placeholder="태그를 쉼표로 구분해 입력하세요. 예: dp, graph, review"
          style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 12, padding: '12px 14px', fontFamily: 'inherit', fontSize: 13, outline: 'none' }}
        />
        {editorMode === 'create' ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text2)' }}>
            <input type="checkbox" checked={draft.isAnonymous} onChange={(event) => setDraft((current) => ({ ...current, isAnonymous: event.target.checked }))} />
            익명으로 작성하기
          </label>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setComposerOpen(false)} style={{ border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', borderRadius: 12, padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
            취소
          </button>
          <button onClick={submitPost} disabled={savingPost} style={{ border: 'none', background: BOARD_META[activeBoard].tone, color: 'var(--bg)', borderRadius: 12, padding: '10px 16px', cursor: savingPost ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 800, opacity: savingPost ? 0.5 : 1 }}>
            {savingPost ? '저장 중...' : editorMode === 'edit' ? '수정 저장' : '게시하기'}
          </button>
        </div>
      </div>
    </Modal>
  )

  if (selectedPostId) {
    return (
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '28px 20px 44px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <button onClick={closePost} style={{ border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', borderRadius: 12, padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800 }}>
            ← 목록으로
          </button>
          <button onClick={() => openComposer('create')} style={{ border: 'none', background: BOARD_META[activeBoard].tone, color: 'var(--bg)', padding: '10px 16px', borderRadius: 12, fontFamily: 'inherit', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
            새 글 작성
          </button>
        </div>

        <article style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 22, padding: 22, boxShadow: '0 18px 48px rgba(0,0,0,.18)' }}>
          {detailLoading || !selectedPost ? (
            <div style={{ padding: '56px 0', textAlign: 'center', color: 'var(--text3)' }}>게시글을 불러오는 중입니다.</div>
          ) : (
            <div style={{ display: 'grid', gap: 20 }}>
              <div>
                <div style={{ fontSize: 12, color: BOARD_META[activeBoard].tone, fontWeight: 900, marginBottom: 8 }}>{BOARD_META[activeBoard].label}</div>
                <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.25, color: 'var(--text)', letterSpacing: -0.5 }}>{selectedPost.title}</h1>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  {makeAvatar(postAuthorName, BOARD_META[activeBoard].tone, 46)}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{postAuthorName}</div>
                      {selectedPost.user_id ? (
                        <button onClick={() => navigate(`/user/${selectedPost.user_id}`)} style={{ border: 'none', background: 'transparent', color: 'var(--blue)', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}>
                          공개 프로필 보기
                        </button>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{formatDate(selectedPost.created_at)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => togglePostLike(selectedPost.id)} style={{ border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', borderRadius: 12, padding: '9px 12px', cursor: 'pointer', fontWeight: 700 }}>❤️ 좋아요 {selectedPost.like_count || 0}</button>
                  <button onClick={() => toggleScrap(selectedPost.id)} style={{ border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', borderRadius: 12, padding: '9px 12px', cursor: 'pointer', fontWeight: 700 }}>{selectedPost.isScrapped ? '스크랩 해제' : '스크랩'}</button>
                  {!isMyPost && selectedPost.user_id ? (
                    <button onClick={() => blockAuthor(selectedPost.user_id)} style={{ border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--red)', borderRadius: 12, padding: '9px 12px', cursor: 'pointer', fontWeight: 700 }}>차단</button>
                  ) : null}
                  {isMyPost ? (
                    <>
                      <button onClick={() => openComposer('edit', selectedPost)} style={{ border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', borderRadius: 12, padding: '9px 12px', cursor: 'pointer', fontWeight: 700 }}>수정</button>
                      <button onClick={deletePost} style={{ border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--red)', borderRadius: 12, padding: '9px 12px', cursor: 'pointer', fontWeight: 700 }}>삭제</button>
                    </>
                  ) : null}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {selectedPost.tags.map((item) => (
                  <span key={`detail-page-tag-${item}`} style={{ fontSize: 11, color: 'var(--blue)', background: 'rgba(88,166,255,.12)', border: '1px solid rgba(88,166,255,.2)', borderRadius: 999, padding: '4px 8px' }}>#{item}</span>
                ))}
              </div>

              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 18, padding: '22px 20px', color: 'var(--text)', lineHeight: 1.85, whiteSpace: 'pre-wrap', fontSize: 15 }}>
                {selectedPost.content}
              </div>

              {selectedPost.boj_refs?.length ? (
                <div style={{ background: 'var(--bg3)', borderRadius: 16, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>문제 참조</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {selectedPost.boj_refs.map((item) => (
                      <a key={item.problemNumber} href={item.url} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                        #{item.problemNumber}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              <section style={{ background: 'var(--bg3)', borderRadius: 18, padding: 18 }}>
                <SectionTitle title={`댓글 ${selectedPost.replies?.length || 0}`} desc={activeBoard === 'qna' ? '답글 버튼은 멘션 프리필로 대댓글 흐름을 보조합니다.' : '답글 버튼으로 작성자 멘션을 빠르게 시작할 수 있습니다.'} />
                <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                  {(selectedPost.replies || []).map((reply) => {
                    const canDelete = reply.user_id === user?.id || isMyPost
                    const canAccept = activeBoard === 'qna' && isMyPost && reply.user_id !== user?.id && !reply.is_accepted
                    return (
                      <div key={reply.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {makeAvatar(reply.nickname || reply.username || '?', 'var(--green)', 34)}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{reply.nickname || reply.username}</span>
                                {reply.is_accepted ? <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--green)' }}>채택됨</span> : null}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{formatDate(reply.created_at)}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button onClick={() => likeReply(reply.id)} style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 10, padding: '7px 10px', cursor: 'pointer', fontWeight: 700 }}>👍 {reply.like_count || 0}</button>
                            <button onClick={() => setReplyDraft(`@${reply.nickname || reply.username} `)} style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 10, padding: '7px 10px', cursor: 'pointer', fontWeight: 700 }}>답글</button>
                            {canAccept ? <button onClick={() => acceptReply(reply.id)} style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--green)', borderRadius: 10, padding: '7px 10px', cursor: 'pointer', fontWeight: 800 }}>채택</button> : null}
                            {canDelete ? <button onClick={() => deleteReply(reply.id)} style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--red)', borderRadius: 10, padding: '7px 10px', cursor: 'pointer', fontWeight: 700 }}>삭제</button> : null}
                          </div>
                        </div>
                        <div style={{ marginTop: 12, fontSize: 14, color: 'var(--text2)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{reply.content}</div>
                      </div>
                    )
                  })}
                  {!(selectedPost.replies || []).length ? (
                    <div style={{ padding: '18px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>첫 댓글을 남겨보세요.</div>
                  ) : null}
                </div>
                <div style={{ display: 'grid', gap: 10 }}>
                  <textarea
                    value={replyDraft}
                    onChange={(event) => setReplyDraft(event.target.value)}
                    rows={4}
                    placeholder="댓글을 입력하세요. @username 으로 멘션할 수 있습니다."
                    style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 14, padding: '12px 14px', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.7, resize: 'vertical', outline: 'none' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>멘션 알림, Q&A 채택, 좋아요/스크랩 흐름이 모두 연결되어 있습니다.</div>
                    <button onClick={submitReply} disabled={replyBusy} style={{ border: 'none', background: 'var(--green)', color: 'var(--bg)', borderRadius: 12, padding: '10px 14px', cursor: replyBusy ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 800, opacity: replyBusy ? 0.55 : 1 }}>{replyBusy ? '등록 중...' : '댓글 등록'}</button>
                  </div>
                </div>
              </section>
            </div>
          )}
        </article>
        {composerModal}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1220, margin: '0 auto', padding: '28px 20px 40px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 24 }}>
        <div style={{ background: 'linear-gradient(135deg, var(--bg2), var(--bg3))', border: '1px solid var(--border)', borderRadius: 24, padding: '24px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.6 }}>커뮤니티</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 8, maxWidth: 780, lineHeight: 1.6 }}>
                질문, 기술토론, 라운지를 한 화면에서 운영합니다. 태그로 좁히고, 멘션으로 사람을 불러오고, 익명 글쓰기까지 바로 처리할 수 있습니다.
              </div>
            </div>
            <button
              onClick={() => openComposer('create')}
              style={{
                border: 'none',
                background: BOARD_META[activeBoard].tone,
                color: 'var(--bg)',
                padding: '11px 18px',
                borderRadius: 12,
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              새 글 작성
            </button>
          </div>
          <div style={{ marginTop: 20 }}>
            <BoardTabs activeBoard={activeBoard} onChange={(board) => navigate(board === 'qna' ? '/community/qna' : `/community/${board}`)} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 24, alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: 18, marginBottom: 18 }}>
              <SectionTitle
                title={`${BOARD_META[activeBoard].label} 게시판`}
                desc={`${postsState.total.toLocaleString()}개의 글이 검색 조건과 일치합니다.`}
              />
              <div className="community-search-bar" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(140px,180px) auto', gap: 10, marginBottom: 12 }}>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="제목 또는 본문 검색"
                  style={{
                    width: '100%',
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    borderRadius: 12,
                    padding: '12px 14px',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
                <input
                  value={tag}
                  onChange={(event) => setTag(event.target.value)}
                  placeholder="태그 필터"
                  style={{
                    width: '100%',
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    borderRadius: 12,
                    padding: '12px 14px',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
                <button
                  onClick={() => setPage(1)}
                  style={{
                    border: '1px solid var(--border)',
                    background: 'var(--bg3)',
                    color: 'var(--text)',
                    borderRadius: 12,
                    padding: '0 16px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  적용
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                멘션은 본문에 `@username` 형태로 입력하면 됩니다. 대댓글은 답글 버튼으로 멘션 프리필을 제공합니다.
              </div>
            </div>

            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden' }}>
              {loading ? (
                <div style={{ padding: '46px 20px', textAlign: 'center', color: 'var(--text3)' }}>게시글을 불러오는 중입니다.</div>
              ) : normalizedPosts.length === 0 ? (
                <div style={{ padding: '52px 20px', textAlign: 'center', color: 'var(--text3)' }}>
                  현재 조건에 맞는 게시글이 없습니다.
                </div>
              ) : normalizedPosts.map((post) => {
                const authorName = post.nickname || post.username || '익명'
                return (
                  <button
                    key={post.id}
                    onClick={() => openPost(post.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      borderBottom: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'inherit',
                      padding: '18px 20px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                          {post.is_pinned ? <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--yellow)' }}>고정</span> : null}
                          {post.is_solved ? <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--green)' }}>해결됨</span> : null}
                          {post.is_anonymous ? <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--purple)' }}>익명</span> : null}
                        </div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', lineHeight: 1.4, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.title}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                          {post.tags.map((item) => (
                            <span key={`${post.id}-${item}`} style={{ fontSize: 11, color: 'var(--blue)', background: 'rgba(88,166,255,.12)', border: '1px solid rgba(88,166,255,.2)', borderRadius: 999, padding: '4px 8px' }}>
                              #{item}
                            </span>
                          ))}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                          <span>{authorName}</span>
                          <span>{formatDate(post.created_at)}</span>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(54px, 1fr))', gap: 8, textAlign: 'center', flexShrink: 0 }}>
                        {[
                          { label: '좋아요', value: post.like_count || 0, color: 'var(--red)' },
                          { label: '댓글', value: post.answer_count || 0, color: 'var(--green)' },
                          { label: '조회', value: post.view_count || 0, color: 'var(--yellow)' },
                        ].map((item) => (
                          <div key={`${post.id}-${item.label}`} style={{ background: 'var(--bg3)', borderRadius: 12, padding: '10px 8px' }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: item.color }}>{item.value}</div>
                            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{item.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </button>
                )
              })}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: 18 }}>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  페이지 {page} / {postsState.totalPages}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1}
                    style={{ border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', borderRadius: 10, padding: '9px 12px', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.45 : 1 }}
                  >
                    이전
                  </button>
                  <button
                    onClick={() => setPage((current) => Math.min(postsState.totalPages, current + 1))}
                    disabled={page >= postsState.totalPages}
                    style={{ border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', borderRadius: 10, padding: '9px 12px', cursor: page >= postsState.totalPages ? 'default' : 'pointer', opacity: page >= postsState.totalPages ? 0.45 : 1 }}
                  >
                    다음
                  </button>
                </div>
              </div>
            </div>
          </div>

          <aside style={{ display: 'grid', gap: 18 }}>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: 18 }}>
              <SectionTitle title="인기 게시물" desc="최근 24시간 기준 좋아요 상위 글" />
              <div style={{ display: 'grid', gap: 12 }}>
                {popularPosts.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>아직 이 게시판의 인기 글이 없습니다.</div>
                ) : popularPosts.map((post) => (
                  <button
                    key={`popular-${post.id}`}
                    onClick={() => openPost(post.id)}
                    style={{ border: '1px solid var(--border)', background: 'var(--bg3)', borderRadius: 14, padding: 14, textAlign: 'left', cursor: 'pointer', color: 'inherit', fontFamily: 'inherit' }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.45, marginBottom: 8 }}>{post.title}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      {post.tags.slice(0, 3).map((item) => (
                        <span key={`${post.id}-${item}`} style={{ fontSize: 10, color: 'var(--text2)' }}>#{item}</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>❤️ {post.like_count || 0} · 💬 {post.answer_count || 0}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: 18 }}>
              <SectionTitle title="운영 메모" desc="현재 구현 범위" />
              <div style={{ display: 'grid', gap: 10, fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                <div>• 익명 글은 작성자 본인을 제외하고 익명으로 표시됩니다.</div>
                <div>• 답글 버튼은 대댓글 대신 멘션 프리필 방식으로 동작합니다.</div>
                <div>• Q&A 게시판에서는 작성자가 댓글을 채택할 수 있습니다.</div>
                <div>• 차단은 게시글 상세 페이지에서 바로 처리할 수 있습니다.</div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {composerModal}
    </div>
  )
}
