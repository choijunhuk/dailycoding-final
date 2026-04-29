import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api.js'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext.jsx'
import { useLang } from '../context/LangContext.jsx'

const TIER_COLORS = {
  unranked: 'var(--text3)',
  bronze: 'var(--yellow)',
  silver: 'var(--text2)',
  gold: 'var(--yellow)',
  platinum: 'var(--green)',
  diamond: 'var(--blue)',
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

function Avatar({ profile, size = 92 }) {
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt={profile.username} style={{ width: size, height: size, borderRadius: 28, objectFit: 'cover', border: '1px solid var(--border)' }} />
  }
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: 28,
      background: `linear-gradient(135deg, ${profile?.avatar_color || 'var(--blue)'}, var(--bg3))`,
      color: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: profile?.avatar_emoji ? Math.round(size * 0.42) : Math.round(size * 0.3),
      fontWeight: 900,
      border: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      {profile?.avatar_emoji || (profile?.username || '?').slice(0, 2).toUpperCase()}
    </div>
  )
}

function DonutChart({ counts, centerLabel }) {
  const entries = Object.entries(counts || {}).filter(([, value]) => Number(value) > 0)
  const total = entries.reduce((sum, [, value]) => sum + Number(value), 0)
  let cursor = -90
  const radius = 72
  const innerRadius = 44
  const center = 90
  const segments = entries.map(([tier, value]) => {
    const portion = total > 0 ? (Number(value) / total) * 360 : 0
    const start = cursor
    const end = cursor + portion
    cursor = end
    const largeArc = portion > 180 ? 1 : 0
    const toPoint = (angle, r) => ({ x: center + r * Math.cos((angle * Math.PI) / 180), y: center + r * Math.sin((angle * Math.PI) / 180) })
    const outerStart = toPoint(start, radius)
    const outerEnd = toPoint(end, radius)
    const innerEnd = toPoint(end, innerRadius)
    const innerStart = toPoint(start, innerRadius)
    return {
      tier,
      value,
      color: TIER_COLORS[tier] || 'var(--text3)',
      d: `M ${outerStart.x} ${outerStart.y} A ${radius} ${radius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y} Z`,
    }
  })

  return (
    <div style={{ display: 'grid', gap: 16, justifyItems: 'center' }}>
      <svg viewBox="0 0 180 180" width="180" height="180">
        {segments.length === 0 ? <circle cx="90" cy="90" r="72" fill="none" stroke="var(--bg3)" strokeWidth="28" /> : null}
        {segments.map((segment) => <path key={segment.tier} d={segment.d} fill={segment.color} opacity="0.85" />)}
        <text x="90" y="84" textAnchor="middle" fill="var(--text)" fontSize="26" fontWeight="900">{total}</text>
        <text x="90" y="108" textAnchor="middle" fill="var(--text3)" fontSize="11">{centerLabel}</text>
      </svg>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {(entries.length ? entries : [['unranked', 0]]).map(([tier, value]) => (
          <div key={tier} style={{ fontSize: 11, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: TIER_COLORS[tier] || 'var(--text3)', display: 'inline-block' }} />
            <span>{tier}</span>
            <span style={{ color: 'var(--text3)' }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Heatmap({ cells, caption }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, minmax(0, 1fr))', gap: 6 }}>
        {cells.map((cell) => (
          <div key={cell.date} title={`${cell.date} · level ${cell.level}`} style={{ aspectRatio: '1 / 1', borderRadius: 8, background: cell.level === 0 ? 'var(--bg3)' : cell.level === 1 ? 'rgba(88,166,255,.25)' : cell.level === 2 ? 'rgba(88,166,255,.45)' : cell.level === 3 ? 'rgba(46,160,67,.55)' : 'rgba(46,160,67,.85)', border: '1px solid var(--border)' }} />
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{caption}</div>
    </div>
  )
}

export default function PublicProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()
  const { t, lang } = useLang()
  const [loading, setLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [profile, setProfile] = useState(null)
  const [grass, setGrass] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [activity, setActivity] = useState([])

  useEffect(() => {
    let cancelled = false
    async function loadProfile() {
      setLoading(true)
      try {
        const [profileRes, grassRes, submissionsRes, activityRes] = await Promise.all([
          api.get(`/auth/profile/${id}`),
          api.get(`/auth/grass/${id}`),
          api.get('/submissions', { params: { scope: 'all', userId: id, limit: 20 } }).catch(() => ({ data: [] })),
          api.get(`/users/${id}/activity`, { params: { limit: 20 } }).catch(() => ({ data: { items: [] } })),
        ])
        if (cancelled) return
        const today = new Date()
        const rawGrass = Array.isArray(grassRes.data) ? grassRes.data : []
        const grassMap = rawGrass.reduce((acc, item) => {
          acc[item.date] = Math.min(4, item.level || 1)
          return acc
        }, {})
        const last30 = []
        for (let offset = 29; offset >= 0; offset -= 1) {
          const date = new Date(today)
          date.setDate(date.getDate() - offset)
          const key = date.toISOString().slice(0, 10)
          last30.push({ date: key, level: grassMap[key] || 0 })
        }
        setProfile(profileRes.data)
        setGrass(last30)
        setSubmissions((submissionsRes.data || []).filter((item) => Number(item.userId) === Number(id)).slice(0, 12))
        setActivity(activityRes.data?.items || [])
      } catch (error) {
        if (!cancelled) {
          setProfile(null)
          setGrass([])
          setSubmissions([])
          setActivity([])
          toast?.show(error.response?.data?.message || t('publicProfileLoadFailed'), 'error')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadProfile()
    return () => { cancelled = true }
  }, [id, toast])

  const tierCounts = useMemo(() => profile?.solvedTierCounts || {}, [profile?.solvedTierCounts])
  const isSelf = Number(user?.id) === Number(id)

  const toggleFollow = async () => {
    if (!profile || isSelf) return
    setFollowLoading(true)
    try {
      if (profile.isFollowing) {
        await api.delete(`/follows/${id}`)
        setProfile((current) => current ? ({ ...current, isFollowing: false, followers: Math.max(0, (current.followers || 0) - 1) }) : current)
      } else {
        await api.post(`/follows/${id}`)
        setProfile((current) => current ? ({ ...current, isFollowing: true, followers: (current.followers || 0) + 1 }) : current)
      }
    } catch (error) {
      toast?.show(error.response?.data?.message || t('publicProfileFollowFailed'), 'error')
    } finally {
      setFollowLoading(false)
    }
  }

  if (loading) {
    return <div style={{ maxWidth: 1120, margin: '0 auto', padding: '36px 20px', color: 'var(--text3)' }}>{t('publicProfileLoading')}</div>
  }

  if (!profile) {
    return <div style={{ maxWidth: 1120, margin: '0 auto', padding: '36px 20px', color: 'var(--text3)' }}>{t('publicProfileNotFound')}</div>
  }

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 20px 40px', display: 'grid', gap: 24 }}>
      <div style={{ background: 'linear-gradient(135deg, var(--bg2), var(--bg3))', border: '1px solid var(--border)', borderRadius: 24, padding: '24px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            <Avatar profile={profile} />
            <div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text)' }}>{profile.displayName || profile.nickname || profile.username}</div>
                <span style={{ fontSize: 12, fontWeight: 800, color: TIER_COLORS[profile.tier] || 'var(--text3)', border: '1px solid var(--border)', borderRadius: 999, padding: '6px 10px', background: 'var(--bg)' }}>
                  {profile.tier?.toUpperCase() || 'UNRANKED'}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 8 }}>@{profile.username}</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 10, lineHeight: 1.7, maxWidth: 680 }}>{profile.bio || t('publicProfileNoBio')}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                {profile.techStack?.slice(0, 8).map((item) => (
                  <span key={item} style={{ fontSize: 11, color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 999, padding: '5px 8px', background: 'var(--bg)' }}>{item}</span>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
            {!isSelf ? (
              <button onClick={toggleFollow} disabled={followLoading} style={{ border: 'none', background: profile.isFollowing ? 'var(--bg3)' : 'var(--blue)', color: profile.isFollowing ? 'var(--text)' : 'var(--bg)', borderRadius: 12, padding: '11px 16px', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, cursor: followLoading ? 'default' : 'pointer', opacity: followLoading ? 0.5 : 1 }}>
                {followLoading ? t('processing') : profile.isFollowing ? t('unfollow') : t('follow')}
              </button>
            ) : (
              <button onClick={() => navigate('/profile')} style={{ border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', borderRadius: 12, padding: '11px 16px', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                {t('publicProfileGoMine')}
              </button>
            )}
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, padding: 14, minWidth: 250 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                {[
                  { label: t('rating'), value: Number(profile.rating || 0).toLocaleString(), color: 'var(--yellow)' },
                  { label: t('streak'), value: t('publicProfileStreakDays').replace('{n}', String(profile.streak || 0)), color: 'var(--green)' },
                  { label: t('followers'), value: profile.followers || 0, color: 'var(--blue)' },
                  { label: t('following'), value: profile.following || 0, color: 'var(--purple)' },
                ].map((item) => (
                  <div key={item.label} style={{ background: 'var(--bg3)', borderRadius: 12, padding: '12px 10px' }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: item.color }}>{item.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 22, padding: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{t('publicProfileDistributionTitle')}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 18 }}>{t('publicProfileDistributionDesc')}</div>
          <DonutChart counts={tierCounts} centerLabel={t('publicProfileSolvedProblems')} />
        </div>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 22, padding: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{t('publicProfileThirtyDayActivityTitle')}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 18 }}>{t('publicProfileThirtyDayActivityDesc')}</div>
          <Heatmap cells={grass} caption={t('publicProfileRecentThirtyDays')} />
        </div>
      </div>

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 22, padding: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{t('publicProfileRewardsTitle')}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 18 }}>{t('publicProfileRewardsDesc')}</div>
        {!profile.rewards?.length ? (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>{t('publicProfileNoRewards')}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 12 }}>
            {profile.rewards.slice(0, 9).map((reward) => (
              <div key={reward.code} style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--bg3)', padding: '14px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{reward.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{reward.name}</div>
              </div>
            ))}
            {profile.rewards.length > 9 ? (
              <div style={{ border: '1px dashed var(--border)', borderRadius: 16, background: 'var(--bg3)', padding: '14px 10px', textAlign: 'center', display: 'grid', placeItems: 'center', color: 'var(--text2)', fontWeight: 800 }}>
                {t('publicProfileMoreRewards').replace('{n}', String(profile.rewards.length - 9))}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, alignItems: 'start' }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 22, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{t('publicProfilePublicSubmissionsTitle')}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{profile.submissionsPublic === false && !isSelf ? t('publicProfileSubmissionsPrivate') : t('publicProfileRecentSubmissions')}</div>
            </div>
          </div>
          {profile.submissionsPublic === false && !isSelf ? (
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: '18px 0' }}>{t('publicProfileSubmissionListHidden')}</div>
          ) : submissions.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: '18px 0' }}>{t('publicProfileNoSubmissions')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {submissions.map((submission) => (
                <div key={submission.id} style={{ border: '1px solid var(--border)', background: 'var(--bg3)', borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{submission.problemTitle || t('publicProfileProblemFallback').replace('{id}', String(submission.problemId))}</div>
                    <div style={{ fontSize: 12, color: submission.result === 'correct' ? 'var(--green)' : 'var(--red)', fontWeight: 800 }}>{submission.result}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--text3)' }}>
                    <span>{submission.lang}</span>
                    <span>{submission.time}</span>
                    <span>{submission.mem}</span>
                    <span>{submission.date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: 24 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 22, padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{t('publicProfileCommunityTitle')}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>{t('publicProfileCommunityDesc')}</div>
            {profile.posts?.length ? (
              <div style={{ display: 'grid', gap: 12 }}>
                {profile.posts.slice(0, 6).map((post) => (
                  <button key={post.id} onClick={() => navigate(`/community/${post.board_type}/${post.id}`)} style={{ border: '1px solid var(--border)', background: 'var(--bg3)', borderRadius: 14, padding: 14, textAlign: 'left', cursor: 'pointer', color: 'inherit', fontFamily: 'inherit' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{post.title}</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--text3)' }}>
                      <span>{post.board_type}</span>
                      <span>❤️ {post.like_count || 0}</span>
                      <span>💬 {post.answer_count || 0}</span>
                      <span>{formatDate(post.created_at, locale)}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>{t('publicProfileNoPosts')}</div>
            )}
          </div>

          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 22, padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{t('publicProfileSummaryTitle')}</div>
            <div style={{ display: 'grid', gap: 10, fontSize: 13, color: 'var(--text2)' }}>
              <div>{t('publicProfileJoinedDate')}: <span style={{ color: 'var(--text)' }}>{profile.joinDate || '-'}</span></div>
              <div>{t('publicProfileSolvedCount')}: <span style={{ color: 'var(--text)' }}>{profile.solvedCount || 0}</span></div>
              <div>{t('publicProfileTotalLikes')}: <span style={{ color: 'var(--text)' }}>{profile.totalLikes || 0}</span></div>
              <div>{t('publicProfileReplyCount')}: <span style={{ color: 'var(--text)' }}>{profile.replyCount || 0}</span></div>
              <div>{t('publicProfileAcceptedAnswers')}: <span style={{ color: 'var(--text)' }}>{profile.acceptedAnswers || 0}</span></div>
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 22, padding: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{t('publicProfileActivityTitle')}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 18 }}>{t('publicProfileActivityDesc')}</div>
          {activity.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>{t('publicProfileNoActivity')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {activity.map((item, index) => (
                <div key={`${item.type}-${item.created_at}-${index}`} style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--bg3)', padding: '12px 14px' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: item.type === 'solve' ? 'var(--green)' : item.type === 'post' ? 'var(--blue)' : 'var(--yellow)', marginBottom: 6 }}>
                    {item.type === 'solve' ? t('publicProfileActivitySolve') : item.type === 'post' ? t('publicProfileActivityPost') : t('battle')}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
                    {item.type === 'solve' ? `${item.problem_title} · ${item.lang}` : item.type === 'post' ? `[${item.board}] ${item.title}` : `${t('battle')} ${item.result}`}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>{formatDate(item.created_at, locale)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
  const locale = lang === 'ko' ? 'ko-KR' : 'en-US'
