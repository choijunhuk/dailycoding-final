import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import api from '../api.js'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext.jsx'
import { useLang } from '../context/LangContext.jsx'
import { getDateLocale, pickLangText } from '../utils/languageMode.js'
import './CommunityPage.css'

const BOARD_META = {
  qna: { label: { ko: 'Q&A', en: 'Q&A' }, tone: 'var(--blue)', desc: { ko: '질문과 답변을 위한 공간', en: 'Questions and answers' } },
  tech: { label: { ko: '기술 토론', en: 'Tech Discussion' }, tone: 'var(--green)', desc: { ko: '구현 전략, 성능, 아키텍처를 토론하는 공간', en: 'Discuss implementation strategy, performance, and architecture' } },
  lounge: { label: { ko: '라운지', en: 'Lounge' }, tone: 'var(--purple)', desc: { ko: '자유로운 대화와 회고를 위한 공간', en: 'Casual discussion and retrospectives' } },
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

function formatDate(value, locale) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isEditedPost(post) {
  if (!post?.created_at || !post?.updated_at) return false
  const created = new Date(post.created_at).getTime()
  const updated = new Date(post.updated_at).getTime()
  return Number.isFinite(created) && Number.isFinite(updated) && updated - created > 1000
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

function BoardTabs({ activeBoard, onChange, boardMeta }) {
  return (
    <div className="community-board-tabs" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {Object.entries(boardMeta).map(([key, meta]) => {
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
            <span className="community-tab-desc" style={{ fontSize: 11, opacity: active ? 0.9 : 0.7 }}>{meta.desc}</span>
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
        className="card"
        style={{
          width: '100%',
          maxWidth: wide ? 980 : 720,
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
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
  const { user, isAdmin } = useAuth()
  const toast = useToast()
  const { lang } = useLang()
  const txt = useCallback((ko, en) => pickLangText(lang, ko, en), [lang])
  const dateLocale = getDateLocale(lang)
  const boardMeta = useMemo(() => Object.fromEntries(Object.entries(BOARD_META).map(([key, meta]) => [key, {
    ...meta,
    label: pickLangText(lang, meta.label.ko, meta.label.en),
    desc: pickLangText(lang, meta.desc.ko, meta.desc.en),
  }])), [lang])
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
  const [draft, setDraft] = useState({ title: '', content: '', tags: '', isAnonymous: false, imageUrl: '' })
  const [savingPost, setSavingPost] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [sort, setSort] = useState('new')
  const [replyDraft, setReplyDraft] = useState('')
  const [replyBusy, setReplyBusy] = useState(false)

  const normalizedPosts = useMemo(() => postsState.posts.map((post) => ({
    ...post,
    tags: parseTags(post.tags),
  })), [postsState.posts])

  const communityInsights = useMemo(() => ({
    unansweredQna: normalizedPosts.filter((post) => post.board_type === 'qna' && !post.is_solved && Number(post.answer_count || 0) === 0).length,
    conceptCount: normalizedPosts.filter((post) => post.is_concept || ((post.like_count || 0) - (post.dislike_count || 0)) >= 5).length,
    imageCount: normalizedPosts.filter((post) => Boolean(post.image_url)).length,
  }), [normalizedPosts])

  const topicChips = useMemo(() => {
    const counts = new Map()
    for (const post of normalizedPosts) {
      for (const item of post.tags) {
        counts.set(item, (counts.get(item) || 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }))
  }, [normalizedPosts])

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
      const { data } = await api.get(`/community/${activeBoard}`, { params: { page, q: search || undefined, tag: tag || undefined, sort } })
      setPostsState({
        posts: data.posts || [],
        totalPages: Math.max(1, data.totalPages || 1),
        total: data.total || 0,
      })
    } catch (error) {
      setPostsState({ posts: [], totalPages: 1, total: 0 })
      toast?.show(error.response?.data?.message || txt('커뮤니티 게시글을 불러오지 못했습니다.', 'Failed to load community posts.'), 'error')
    } finally {
      setLoading(false)
    }
  }, [activeBoard, page, search, tag, sort, toast, txt])

  const refreshDetail = useCallback(async (postId) => {
    if (!postId) return
    setDetailLoading(true)
    try {
      const { data } = await api.get(`/community/${activeBoard}/${postId}`)
      setSelectedPost({ ...data, tags: parseTags(data.tags) })
    } catch (error) {
      toast?.show(error.response?.data?.message || txt('게시글을 불러오지 못했습니다.', 'Failed to load post.'), 'error')
      setSelectedPost(null)
      navigate(`/community/${activeBoard}`, { replace: true })
    } finally {
      setDetailLoading(false)
    }
  }, [activeBoard, navigate, toast, txt])

  useEffect(() => {
    setPage(1)
    setSearch('')
    setTag('')
    setSort('new')
  }, [activeBoard])

  useEffect(() => {
    setPage(1)
  }, [sort])

  useEffect(() => {
    refreshPosts()
  }, [refreshPosts])

  useEffect(() => {
    refreshPopular()
  }, [refreshPopular])

  useEffect(() => {
    if (location.state?.openComposer) {
      navigate(location.pathname, { replace: true, state: {} })
      openComposer('create')
    }
  }, [location.state])

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
      toast?.show(txt('게시글을 작성하려면 이메일 인증이 필요합니다. 받은 편지함을 확인하거나 인증 메일을 다시 보내세요.', 'Email verification is required to write posts. Please check your inbox or resend the verification email.'), 'warning')
      navigate('/verify-email')
      return
    }
    setEditorMode(mode)
    setDraft(mode === 'edit' && post ? {
      title: post.title || '',
      content: post.content || '',
      tags: parseTags(post.tags).join(', '),
      isAnonymous: Boolean(post.is_anonymous),
      imageUrl: post.image_url || '',
    } : {
      title: '',
      content: '',
      tags: '',
      isAnonymous: false,
      imageUrl: '',
    })
    setComposerOpen(true)
  }

  const submitPost = async () => {
    const payload = {
      title: draft.title.trim(),
      content: draft.content.trim(),
      tags: draft.tags.split(',').map((value) => value.trim()).filter(Boolean),
      is_anonymous: draft.isAnonymous,
      image_url: draft.imageUrl || null,
    }
    if (!payload.title || !payload.content) {
      toast?.show(txt('제목과 본문을 입력하세요.', 'Please enter a title and content.'), 'warning')
      return
    }
    setSavingPost(true)
    try {
      if (editorMode === 'edit' && selectedPost?.id) {
        await api.patch(`/community/${activeBoard}/${selectedPost.id}`, payload)
        toast?.show(txt('게시글이 수정되었습니다.', 'Post updated successfully.'), 'success')
        await refreshDetail(selectedPost.id)
      } else {
        const { data } = await api.post(`/community/${activeBoard}`, payload)
        toast?.show(txt('게시글이 등록되었습니다.', 'Post published successfully.'), 'success')
        openPost(data.id)
      }
      setComposerOpen(false)
      await refreshPosts()
      await refreshPopular()
    } catch (error) {
      toast?.show(error.response?.data?.message || txt('게시글 저장에 실패했습니다.', 'Failed to save post.'), 'error')
    } finally {
      setSavingPost(false)
    }
  }

  const deletePost = async () => {
    if (!selectedPost?.id) return
    try {
      await api.delete(`/community/${activeBoard}/${selectedPost.id}`)
      toast?.show(txt('게시글이 삭제되었습니다.', 'Post deleted successfully.'), 'success')
      closePost()
      await refreshPosts()
      await refreshPopular()
    } catch (error) {
      toast?.show(error.response?.data?.message || txt('게시글 삭제에 실패했습니다.', 'Failed to delete post.'), 'error')
    }
  }

  const votePost = async (postId, vote) => {
    try {
      await api.post(`/community/${activeBoard}/${postId}/vote`, { vote })
      await Promise.all([refreshPosts(), selectedPost?.id === postId ? refreshDetail(postId) : Promise.resolve()])
    } catch (error) {
      toast?.show(error?.response?.data?.message || txt('투표 처리에 실패했습니다.', 'Failed to record vote.'), 'error')
    }
  }

  const uploadPostImage = async (file) => {
    if (!file) return
    if (file.size > 6 * 1024 * 1024) {
      toast?.show(txt('이미지 크기는 6MB 이하여야 합니다.', 'Image must be under 6MB.'), 'warning')
      return
    }
    setUploadingImage(true)
    try {
      const form = new FormData()
      form.append('image', file)
      const { data } = await api.post('/community/upload-image', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (data?.url) {
        setDraft((d) => ({ ...d, imageUrl: data.url }))
        toast?.show(txt('이미지가 업로드되었습니다.', 'Image uploaded.'), 'success')
      }
    } catch (error) {
      toast?.show(error?.response?.data?.message || txt('이미지 업로드에 실패했습니다.', 'Image upload failed.'), 'error')
    } finally {
      setUploadingImage(false)
    }
  }

  const toggleScrap = async (postId) => {
    try {
      await api.post(`/community/${activeBoard}/${postId}/scrap`)
      await Promise.all([refreshPosts(), selectedPost?.id === postId ? refreshDetail(postId) : Promise.resolve()])
    } catch {
      toast?.show(txt('북마크 처리에 실패했습니다.', 'Failed to process bookmark.'), 'error')
    }
  }

  const submitReply = async () => {
    if (!selectedPost?.id || !replyDraft.trim()) return
    setReplyBusy(true)
    try {
      await api.post(`/community/${activeBoard}/${selectedPost.id}/replies`, { content: replyDraft.trim() })
      setReplyDraft('')
      toast?.show(txt('댓글이 등록되었습니다.', 'Comment posted successfully.'), 'success')
      await Promise.all([refreshDetail(selectedPost.id), refreshPosts()])
    } catch (error) {
      toast?.show(error.response?.data?.message || txt('댓글 등록에 실패했습니다.', 'Failed to post comment.'), 'error')
    } finally {
      setReplyBusy(false)
    }
  }

  const deleteReply = async (replyId) => {
    if (!selectedPost?.id) return
    try {
      await api.delete(`/community/${activeBoard}/${selectedPost.id}/replies/${replyId}`)
      toast?.show(txt('댓글이 삭제되었습니다.', 'Comment deleted successfully.'), 'success')
      await Promise.all([refreshDetail(selectedPost.id), refreshPosts()])
    } catch (error) {
      toast?.show(error.response?.data?.message || txt('댓글 삭제에 실패했습니다.', 'Failed to delete comment.'), 'error')
    }
  }

  const acceptReply = async (replyId) => {
    if (!selectedPost?.id) return
    try {
      await api.post(`/community/qna/${selectedPost.id}/replies/${replyId}/accept`)
      toast?.show(txt('답변이 채택되었습니다.', 'Answer accepted successfully.'), 'success')
      await Promise.all([refreshDetail(selectedPost.id), refreshPosts()])
    } catch (error) {
      toast?.show(error.response?.data?.message || txt('답변 채택에 실패했습니다.', 'Failed to accept answer.'), 'error')
    }
  }

  const likeReply = async (replyId) => {
    if (!selectedPost?.id) return
    try {
      await api.post(`/community/${activeBoard}/${selectedPost.id}/replies/${replyId}/like`)
      await refreshDetail(selectedPost.id)
    } catch {
      toast?.show(txt('댓글 좋아요 처리에 실패했습니다.', 'Failed to like comment.'), 'error')
    }
  }

  const blockAuthor = async (targetId) => {
    if (!targetId) return
    try {
      await api.post(`/community/block/${targetId}`)
      toast?.show(txt('사용자를 차단했습니다.', 'User has been blocked.'), 'success')
      closePost()
      await refreshPosts()
      await refreshPopular()
    } catch (error) {
      toast?.show(error.response?.data?.message || txt('사용자 차단에 실패했습니다.', 'Failed to block user.'), 'error')
    }
  }

  const isMyPost = selectedPost?.user_id === user?.id
  const postAuthorName = selectedPost?.nickname || selectedPost?.username || txt('익명', 'Anonymous')

  const composerModal = (
    <Modal open={composerOpen} onClose={() => setComposerOpen(false)} title={editorMode === 'edit' ? txt('게시글 수정', 'Edit Post') : txt('새 게시글 작성', 'Write Post')}>
      <div style={{ display: 'grid', gap: 14 }}>
        <input
          value={draft.title}
          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
          placeholder={txt('제목', 'Title')}
          style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 12, padding: '12px 14px', fontFamily: 'inherit', fontSize: 14, outline: 'none' }}
        />
        <textarea
          value={draft.content}
          onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
          placeholder={txt('본문을 입력하세요. @username으로 유저를 멘션할 수 있습니다.', 'Write your post. Mention users with @username.')}
          rows={12}
          style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 14, padding: '14px 16px', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.7, resize: 'vertical', outline: 'none' }}
        />
        <input
          value={draft.tags}
          onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))}
          placeholder={txt('쉼표로 태그를 구분하여 입력하세요. 예: dp, 그래프, 리뷰', 'Separate tags with commas. Example: dp, graph, review')}
          style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 12, padding: '12px 14px', fontFamily: 'inherit', fontSize: 13, outline: 'none' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: 'var(--bg3)', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, cursor: uploadingImage ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700 }}>
              📷 {uploadingImage ? txt('업로드 중...', 'Uploading...') : txt('이미지 추가', 'Add Image')}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                disabled={uploadingImage}
                style={{ display: 'none' }}
                onChange={(e) => { uploadPostImage(e.target.files?.[0]); e.target.value = '' }}
              />
            </label>
            {draft.imageUrl && (
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, imageUrl: '' }))}
                style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--red)', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
              >{txt('이미지 제거', 'Remove')}</button>
            )}
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{txt('PNG·JPG·WEBP·GIF, 최대 6MB', 'PNG/JPG/WEBP/GIF, max 6MB')}</span>
          </div>
          {draft.imageUrl && (
            <img src={draft.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 10, border: '1px solid var(--border)', objectFit: 'contain', background: 'var(--bg)' }} />
          )}
        </div>
        {editorMode === 'create' ? (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)', cursor: 'pointer', width: 'fit-content' }}>
            <input type="checkbox" checked={draft.isAnonymous} onChange={(event) => setDraft((current) => ({ ...current, isAnonymous: event.target.checked }))} />
            {txt('익명으로 게시', 'Post anonymously')}
          </label>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setComposerOpen(false)} style={{ border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', borderRadius: 12, padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
            {txt('취소', 'Cancel')}
          </button>
          <button onClick={submitPost} disabled={savingPost} style={{ border: 'none', background: BOARD_META[activeBoard].tone, color: 'var(--bg)', borderRadius: 12, padding: '10px 16px', cursor: savingPost ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 800, opacity: savingPost ? 0.5 : 1 }}>
            {savingPost ? txt('저장 중...', 'Saving...') : editorMode === 'edit' ? txt('변경사항 저장', 'Save Changes') : txt('게시', 'Publish')}
          </button>
        </div>
      </div>
    </Modal>
  )

  if (selectedPostId) {
    return (
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '28px 20px 44px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <button onClick={closePost} className="btn btn-ghost">
            ← {txt('목록으로', 'Back to List')}
          </button>
          <button
            onClick={() => navigate(`/community/${activeBoard}`, { state: { openComposer: true } })}
            className="btn"
            style={{ background: BOARD_META[activeBoard].tone, color: 'var(--bg)', padding: '10px 20px', whiteSpace: 'nowrap' }}
          >
            {txt('글쓰기', 'Write Post')}
          </button>
        </div>

        <article className="card" style={{ padding: 22, boxShadow: '0 18px 48px rgba(0,0,0,.18)' }}>
          {detailLoading || !selectedPost ? (
            <div style={{ padding: '56px 0', textAlign: 'center', color: 'var(--text3)' }}>{txt('게시글을 불러오는 중...', 'Loading post...')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 20 }}>
              <div>
                <div style={{ fontSize: 12, color: BOARD_META[activeBoard].tone, fontWeight: 900, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{boardMeta[activeBoard].label}</span>
                  {((selectedPost.like_count || 0) - (selectedPost.dislike_count || 0)) >= 5 ? (
                    <span style={{ background: 'linear-gradient(135deg, #ffd166, #ffa657)', color: '#0d1117', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 900, letterSpacing: '.05em' }}>
                      💡 {txt('개념글', 'CONCEPT')}
                    </span>
                  ) : null}
                </div>
                <h1 className="community-detail-title" style={{ margin: 0, fontSize: 28, lineHeight: 1.25, color: 'var(--text)', letterSpacing: -0.5 }}>{selectedPost.title}</h1>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  {makeAvatar(postAuthorName, BOARD_META[activeBoard].tone, 46)}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{postAuthorName}</div>
                      {selectedPost.user_id ? (
                        <button onClick={() => navigate(`/user/${selectedPost.user_id}`)} style={{ border: 'none', background: 'transparent', color: 'var(--blue)', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}>
                          {txt('공개 프로필 보기', 'View Public Profile')}
                        </button>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span>{formatDate(selectedPost.created_at, dateLocale)}</span>
                      {isEditedPost(selectedPost) ? <span>{txt('수정됨', 'Edited')} {formatDate(selectedPost.updated_at, dateLocale)}</span> : null}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                    <button
                      onClick={() => votePost(selectedPost.id, 1)}
                      title={txt('추천', 'Upvote')}
                      style={{ border: 'none', background: 'var(--bg3)', color: 'var(--green)', padding: '9px 12px', cursor: 'pointer', fontWeight: 700 }}
                    >▲ {selectedPost.like_count || 0}</button>
                    <div style={{ padding: '9px 10px', background: 'var(--bg)', color: 'var(--text)', fontWeight: 800, fontFamily: 'Space Mono, monospace', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                      {((selectedPost.like_count || 0) - (selectedPost.dislike_count || 0))}
                    </div>
                    <button
                      onClick={() => votePost(selectedPost.id, -1)}
                      title={txt('비추천', 'Downvote')}
                      style={{ border: 'none', background: 'var(--bg3)', color: 'var(--red)', padding: '9px 12px', cursor: 'pointer', fontWeight: 700 }}
                    >▼ {selectedPost.dislike_count || 0}</button>
                  </div>
                  <button onClick={() => toggleScrap(selectedPost.id)} style={{ border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', borderRadius: 12, padding: '9px 12px', cursor: 'pointer', fontWeight: 700 }}>{selectedPost.isScrapped ? txt('북마크 해제', 'Unbookmark') : txt('북마크', 'Bookmark')}</button>
                  {!isMyPost && selectedPost.user_id ? (
                    <button onClick={() => blockAuthor(selectedPost.user_id)} style={{ border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--red)', borderRadius: 12, padding: '9px 12px', cursor: 'pointer', fontWeight: 700 }}>{txt('차단', 'Block')}</button>
                  ) : null}
                  {isMyPost ? (
                    <>
                      <button onClick={() => openComposer('edit', selectedPost)} style={{ border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', borderRadius: 12, padding: '9px 12px', cursor: 'pointer', fontWeight: 700 }}>{txt('수정', 'Edit')}</button>
                      <button onClick={deletePost} style={{ border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--red)', borderRadius: 12, padding: '9px 12px', cursor: 'pointer', fontWeight: 700 }}>{txt('삭제', 'Delete')}</button>
                    </>
                  ) : isAdmin ? (
                    <button onClick={deletePost} style={{ border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--red)', borderRadius: 12, padding: '9px 12px', cursor: 'pointer', fontWeight: 700 }}>🛡 {txt('삭제', 'Delete')}</button>
                  ) : null}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {selectedPost.tags.map((item) => (
                  <span key={`detail-page-tag-${item}`} style={{ fontSize: 11, color: 'var(--blue)', background: 'rgba(88,166,255,.12)', border: '1px solid rgba(88,166,255,.2)', borderRadius: 999, padding: '4px 8px' }}>#{item}</span>
                ))}
              </div>

              {selectedPost.image_url ? (
                <a href={selectedPost.image_url} target="_blank" rel="noreferrer" style={{ display: 'block', borderRadius: 18, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg)' }}>
                  <img src={selectedPost.image_url} alt="" style={{ width: '100%', maxHeight: 600, objectFit: 'contain', display: 'block' }} />
                </a>
              ) : null}

              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 18, padding: '22px 20px', color: 'var(--text)', lineHeight: 1.85, whiteSpace: 'pre-wrap', fontSize: 15 }}>
                {selectedPost.content}
              </div>

              {selectedPost.boj_refs?.length ? (
                <div style={{ background: 'var(--bg3)', borderRadius: 16, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>{txt('문제 참조', 'Problem References')}</div>
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
                <SectionTitle
                  title={txt(`댓글 ${selectedPost.replies?.length || 0}`, `Comments ${selectedPost.replies?.length || 0}`)}
                  desc={activeBoard === 'qna' ? txt('답글 버튼은 멘션을 자동 입력해 대화를 이어가도록 돕습니다.', 'The Reply button prefills a mention to help thread replies.') : txt('답글 버튼으로 작성자를 빠르게 멘션할 수 있습니다.', 'Use the Reply button to quickly mention the author.')}
                />
                <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                  {(selectedPost.replies || []).map((reply) => {
                    const canDelete = reply.user_id === user?.id || isMyPost || isAdmin
                    const canAccept = activeBoard === 'qna' && isMyPost && reply.user_id !== user?.id && !reply.is_accepted
                    return (
                      <div key={reply.id} className="card" style={{ padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {makeAvatar(reply.nickname || reply.username || '?', 'var(--green)', 34)}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{reply.nickname || reply.username}</span>
                                {reply.is_accepted ? <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--green)' }}>{txt('채택됨', 'Accepted')}</span> : null}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{formatDate(reply.created_at, dateLocale)}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button onClick={() => likeReply(reply.id)} style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 10, padding: '7px 10px', cursor: 'pointer', fontWeight: 700 }}>👍 {reply.like_count || 0}</button>
                            <button onClick={() => setReplyDraft(`@${reply.nickname || reply.username} `)} style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 10, padding: '7px 10px', cursor: 'pointer', fontWeight: 700 }}>{txt('답글', 'Reply')}</button>
                            {canAccept ? <button onClick={() => acceptReply(reply.id)} style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--green)', borderRadius: 10, padding: '7px 10px', cursor: 'pointer', fontWeight: 800 }}>{txt('채택', 'Accept')}</button> : null}
                            {canDelete ? <button onClick={() => deleteReply(reply.id)} style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--red)', borderRadius: 10, padding: '7px 10px', cursor: 'pointer', fontWeight: 700 }}>{txt('삭제', 'Delete')}</button> : null}
                          </div>
                        </div>
                        <div style={{ marginTop: 12, fontSize: 14, color: 'var(--text2)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{reply.content}</div>
                      </div>
                    )
                  })}
                  {!(selectedPost.replies || []).length ? (
                    <div style={{ padding: '18px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{txt('첫 댓글을 남겨보세요.', 'Be the first to comment.')}</div>
                  ) : null}
                </div>
                <div style={{ display: 'grid', gap: 10 }}>
                  <textarea
                    value={replyDraft}
                    onChange={(event) => setReplyDraft(event.target.value)}
                    rows={4}
                    placeholder={txt('댓글을 입력하세요. @username으로 유저를 멘션할 수 있습니다.', 'Write a comment. Mention users with @username.')}
                    style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 14, padding: '12px 14px', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.7, resize: 'vertical', outline: 'none' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{txt('멘션 알림, Q&A 채택, 좋아요/북마크가 모두 연결됩니다.', 'Mentions, Q&A acceptance, likes, and bookmarks are all connected.')}</div>
                    <button onClick={submitReply} disabled={replyBusy} style={{ border: 'none', background: 'var(--green)', color: 'var(--bg)', borderRadius: 12, padding: '10px 14px', cursor: replyBusy ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 800, opacity: replyBusy ? 0.55 : 1 }}>{replyBusy ? txt('게시 중...', 'Posting...') : txt('댓글 게시', 'Post Comment')}</button>
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
        <div className="card" style={{ background: 'linear-gradient(135deg, var(--bg2), var(--bg3))', padding: '24px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.6 }}>{txt('커뮤니티', 'Community')}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 8, maxWidth: 780, lineHeight: 1.6 }}>
                {txt('Q&A, 기술 토론, 라운지를 한곳에서 이용하세요. 태그 필터, 유저 멘션, 익명 게시를 지원합니다.', 'Q&A, Tech Discussion, and Lounge in one place. Filter by tags, mention users, and post anonymously.')}
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
              {txt('글쓰기', 'Write Post')}
            </button>
          </div>
          <div style={{ marginTop: 20 }}>
            <BoardTabs activeBoard={activeBoard} boardMeta={boardMeta} onChange={(board) => navigate(board === 'qna' ? '/community/qna' : `/community/${board}`)} />
          </div>
          <div className="community-insight-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 18 }}>
            {[
              { label: txt('미답변 Q&A', 'Unanswered Q&A'), value: communityInsights.unansweredQna, tone: 'var(--blue)' },
              { label: txt('개념글 후보', 'Concept Posts'), value: communityInsights.conceptCount, tone: 'var(--yellow)' },
              { label: txt('이미지 글', 'Posts with Images'), value: communityInsights.imageCount, tone: 'var(--green)' },
            ].map((item) => (
              <div key={item.label} style={{ border: '1px solid var(--border)', background: 'var(--bg)', borderRadius: 14, padding: '12px 14px' }}>
                <div style={{ color: item.tone, fontFamily: 'Space Mono, monospace', fontWeight: 800, fontSize: 18 }}>{item.value}</div>
                <div style={{ color: 'var(--text3)', fontSize: 11, fontWeight: 700, marginTop: 4 }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="community-main-layout" style={{ display: 'grid', gap: 24, alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
            <div className="card" style={{ padding: 18, marginBottom: 18 }}>
              <SectionTitle
                title={txt(`${boardMeta[activeBoard].label} 게시판`, `${boardMeta[activeBoard].label} Board`)}
                desc={txt(`${postsState.total.toLocaleString(dateLocale)}개의 게시글이 검색 조건과 일치합니다.`, `${postsState.total.toLocaleString(dateLocale)} post${postsState.total !== 1 ? 's' : ''} match your search.`)}
              />
              <div className="community-search-bar" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(140px,180px) auto', gap: 10, marginBottom: 12 }}>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={txt('제목 또는 본문 검색', 'Search title or body')}
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
                  placeholder={txt('태그 필터', 'Tag filter')}
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
                  {txt('적용', 'Apply')}
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                {txt('본문에 `@username`을 입력해 유저를 멘션할 수 있습니다. 답글 버튼은 멘션을 자동 입력합니다.', 'Mention users by typing `@username` in the body. Use the Reply button to prefill a mention for threaded replies.')}
              </div>
              {topicChips.length ? (
                <div className="community-topic-chips" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                  {topicChips.map((item) => {
                    const active = tag === item.name
                    return (
                      <button
                        key={item.name}
                        onClick={() => { setTag(active ? '' : item.name); setPage(1) }}
                        style={{
                          border: `1px solid ${active ? BOARD_META[activeBoard].tone : 'var(--border)'}`,
                          background: active ? BOARD_META[activeBoard].tone : 'var(--bg3)',
                          color: active ? 'var(--bg)' : 'var(--text2)',
                          borderRadius: 999,
                          padding: '6px 10px',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        #{item.name} <span style={{ opacity: 0.7 }}>{item.count}</span>
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 2px 12px' }}>
              {[
                { key: 'new',     label: txt('최신',   'New') },
                { key: 'hot',     label: txt('인기',   'Hot') },
                { key: 'top',     label: txt('Top',    'Top') },
                { key: 'concept', label: txt('💡 개념글', '💡 Concept') },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSort(opt.key)}
                  style={{
                    border: '1px solid var(--border)',
                    background: sort === opt.key ? BOARD_META[activeBoard].tone : 'var(--bg3)',
                    color: sort === opt.key ? 'var(--bg)' : 'var(--text2)',
                    borderRadius: 999,
                    padding: '6px 14px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >{opt.label}</button>
              ))}
            </div>

            <div className="card" style={{ overflow: 'hidden' }}>
              {loading ? (
                <div style={{ padding: '46px 20px', textAlign: 'center', color: 'var(--text3)' }}>{txt('게시글을 불러오는 중...', 'Loading posts...')}</div>
              ) : normalizedPosts.length === 0 ? (
                <div style={{ padding: '52px 20px', textAlign: 'center', color: 'var(--text3)', display: 'grid', gap: 14, justifyItems: 'center' }}>
                  <div>{txt('현재 필터와 일치하는 게시글이 없습니다.', 'No posts match the current filters.')}</div>
                  {(search || tag) ? (
                    <button
                      onClick={() => { setSearch(''); setTag(''); setPage(1) }}
                      style={{ border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', borderRadius: 999, padding: '8px 13px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 800 }}
                    >
                      {txt('필터 초기화', 'Clear Filters')}
                    </button>
                  ) : (
                    <button
                      onClick={() => openComposer('create')}
                      style={{ border: 'none', background: BOARD_META[activeBoard].tone, color: 'var(--bg)', borderRadius: 999, padding: '9px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 900 }}
                    >
                      {txt('첫 글 작성하기', 'Write the First Post')}
                    </button>
                  )}
                </div>
              ) : normalizedPosts.map((post) => {
                const authorName = post.nickname || post.username || txt('익명', 'Anonymous')
                return (
                  <button
                    key={post.id}
                    onClick={() => openPost(post.id)}
                    className="community-post-item"
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
                      <div style={{ minWidth: 0, display: 'flex', gap: 12, flex: 1 }}>
                        {post.image_url ? (
                          <img
                            src={post.image_url}
                            alt=""
                            loading="lazy"
                            style={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)', flexShrink: 0 }}
                          />
                        ) : null}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                            {post.is_pinned ? <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--yellow)' }}>{txt('고정됨', 'Pinned')}</span> : null}
                            {post.is_concept ? (
                              <span style={{ background: 'linear-gradient(135deg, #ffd166, #ffa657)', color: '#0d1117', padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 900, letterSpacing: '.05em' }}>
                                💡 {txt('개념글', 'CONCEPT')}
                              </span>
                            ) : null}
                            {post.is_solved ? <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--green)' }}>{txt('해결됨', 'Solved')}</span> : null}
                            {post.is_anonymous ? <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--purple)' }}>{txt('익명', 'Anonymous')}</span> : null}
                            {isEditedPost(post) ? <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)' }}>{txt('수정됨', 'Edited')}</span> : null}
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
                            <span>{formatDate(post.created_at, dateLocale)}</span>
                            {isEditedPost(post) ? <span>{txt('수정', 'Edited')} {formatDate(post.updated_at, dateLocale)}</span> : null}
                          </div>
                        </div>
                      </div>
                      <div className="community-post-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(54px, 1fr))', gap: 8, textAlign: 'center', flexShrink: 0 }}>
                        {[
                          { label: txt('점수', 'Score'), value: (post.like_count || 0) - (post.dislike_count || 0), color: (post.like_count || 0) - (post.dislike_count || 0) >= 5 ? 'var(--yellow)' : 'var(--green)' },
                          { label: txt('댓글', 'Replies'), value: post.answer_count || 0, color: 'var(--blue)' },
                          { label: txt('조회', 'Views'), value: post.view_count || 0, color: 'var(--text2)' },
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
                  {txt(`페이지 ${page} / ${postsState.totalPages}`, `Page ${page} / ${postsState.totalPages}`)}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1}
                    style={{ border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', borderRadius: 10, padding: '9px 12px', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.45 : 1 }}
                  >
                    {txt('이전', 'Previous')}
                  </button>
                  <button
                    onClick={() => setPage((current) => Math.min(postsState.totalPages, current + 1))}
                    disabled={page >= postsState.totalPages}
                    style={{ border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', borderRadius: 10, padding: '9px 12px', cursor: page >= postsState.totalPages ? 'default' : 'pointer', opacity: page >= postsState.totalPages ? 0.45 : 1 }}
                  >
                    {txt('다음', 'Next')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <aside style={{ display: 'grid', gap: 18 }}>
            <div className="card" style={{ padding: 18 }}>
              <SectionTitle title={txt('인기 게시글', 'Popular Posts')} desc={txt('최근 24시간 좋아요 상위 게시글', 'Top liked posts in the last 24 hours')} />
              <div style={{ display: 'grid', gap: 12 }}>
                {popularPosts.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{txt('아직 이 게시판에 인기 게시글이 없습니다.', 'No popular posts in this board yet.')}</div>
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

            <div className="card" style={{ padding: 18 }}>
              <SectionTitle title={txt('안내', 'Guide')} desc={txt('현재 기능 범위', 'Current Feature Scope')} />
              <div style={{ display: 'grid', gap: 10, fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                <div>{txt('• 익명 게시글은 작성자 본인 외에는 모두에게 익명으로 표시됩니다.', '• Anonymous posts appear anonymous to everyone except the author.')}</div>
                <div>{txt('• 답글 버튼은 중첩 대신 멘션을 자동 입력합니다.', '• Reply inserts a mention instead of creating nested threads.')}</div>
                <div>{txt('• Q&A 게시판에서 작성자는 댓글을 채택할 수 있습니다.', '• Authors can accept comments on the Q&A board.')}</div>
                <div>{txt('• 사용자 차단은 게시글 상세 페이지에서 바로 할 수 있습니다.', '• Users can be blocked directly from the post detail page.')}</div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {composerModal}
    </div>
  )
}
