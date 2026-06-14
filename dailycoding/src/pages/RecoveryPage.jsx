import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Bot, CheckCircle2, RotateCcw, Target } from 'lucide-react'
import api from '../api.js'
import { useLang } from '../context/LangContext.jsx'
import { getTierLabel } from '../utils/labelMaps.js'
import { getTagLabelLang } from './problemsPageUtils.js'
import { buildRecoveryGroups, pickPrimaryRecoveryAction } from './recoveryPageUtils.js'
import './RecoveryPage.css'

export default function RecoveryPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { lang } = useLang()
  const txt = (ko, en) => lang === 'ko' ? ko : en
  const [queue, setQueue] = useState({ count: 0, items: [], summary: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const highlightId = Number(location.state?.highlightId || 0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    api.get('/submissions/recovery', { params: { limit: 12 } })
      .then(({ data }) => {
        if (!cancelled) setQueue(data || { count: 0, items: [], summary: '' })
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || txt('오답 복구 큐를 불러오지 못했습니다.', 'Failed to load recovery queue.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [lang])

  const items = queue.items || []
  const groups = useMemo(() => buildRecoveryGroups(items, lang), [items, lang])
  const primaryAction = useMemo(() => pickPrimaryRecoveryAction(items, lang), [items, lang])

  const openCoach = (item) => {
    navigate('/submissions', {
      state: {
        scope: 'me',
        result: item.result,
        highlightId: item.submissionId,
        autoCoach: true,
      },
    })
  }

  return (
    <main className="recovery-page">
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        <ArrowLeft size={15} /> {txt('뒤로', 'Back')}
      </button>

      <section className="recovery-hero">
        <div>
          <div className="recovery-kicker">{txt('오답 복구 센터', 'WRONG ANSWER RECOVERY')}</div>
          <h1 className="recovery-title">{txt('틀린 기록을 다음 실력으로 바꾸기', 'Turn failed attempts into the next skill jump')}</h1>
          <p className="recovery-subtitle">
            {queue.summary || txt('최근 실패한 문제를 원인별로 묶어 다시 풀 순서를 정리합니다.', 'Group recent failed attempts by cause and turn them into a retry order.')}
          </p>
        </div>

        <aside className="recovery-action-card">
          <div className="recovery-action-label">{primaryAction.label}</div>
          <div className="recovery-action-reason">{primaryAction.reason}</div>
          {primaryAction.problemId ? (
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/problems/${primaryAction.problemId}`)}>
              <RotateCcw size={15} /> {txt('바로 다시 풀기', 'Retry now')}
            </button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/battle')}>
              <Target size={15} /> {txt('새 도전 시작', 'Start challenge')}
            </button>
          )}
        </aside>
      </section>

      {loading ? (
        <div className="recovery-empty">{txt('복구 큐를 불러오는 중입니다...', 'Loading recovery queue...')}</div>
      ) : error ? (
        <div className="recovery-error">{error}</div>
      ) : (
        <section className="recovery-grid">
          <aside className="recovery-panel">
            <h2>{txt('실패 원인 요약', 'Failure Cause Summary')}</h2>
            {groups.length > 0 ? (
              <div className="recovery-group-list">
                {groups.map((group) => (
                  <div className="recovery-group" key={group.cause}>
                    <div className="recovery-group-head">
                      <span>{group.cause}</span>
                      <span>{group.count}</span>
                    </div>
                    {group.topTags.length > 0 && (
                      <div className="recovery-tags">
                        {group.topTags.map((tag) => (
                          <span className="recovery-tag" key={tag}>{getTagLabelLang(tag, lang)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="recovery-empty">{txt('원인별로 묶을 오답이 없습니다.', 'No wrong answers to group yet.')}</div>
            )}
          </aside>

          <section className="recovery-panel">
            <h2>{txt('다시 풀 문제', 'Retry Queue')}</h2>
            {items.length > 0 ? (
              <div className="recovery-item-list">
                {items.map((item) => (
                  <article
                    className={`recovery-item ${Number(item.submissionId) === highlightId ? 'is-highlighted' : ''}`}
                    key={item.submissionId}
                  >
                    <div className="recovery-item-top">
                      <div>
                        <h3 className="recovery-item-title">{item.problemTitle}</h3>
                        <div className="recovery-meta">
                          {item.cause} · {getTierLabel(item.tier, lang)} · {item.lang}
                        </div>
                      </div>
                      <span className="recovery-priority">
                        {item.priority === 'high' ? txt('우선 복구', 'Priority') : txt('복습 권장', 'Review')}
                      </span>
                    </div>
                    <div className="recovery-action-copy">{item.action}</div>
                    {item.tags?.length > 0 && (
                      <div className="recovery-tags">
                        {item.tags.map((tag) => (
                          <span className="recovery-tag" key={tag}>{getTagLabelLang(tag, lang)}</span>
                        ))}
                      </div>
                    )}
                    <div className="recovery-buttons">
                      <button className="btn btn-primary btn-sm" onClick={() => navigate(`/problems/${item.problemId}`)}>
                        <RotateCcw size={15} /> {txt('다시 풀기', 'Retry')}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openCoach(item)}>
                        <Bot size={15} /> {txt('AI 코치 보기', 'View AI Coach')}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="recovery-empty">
                <CheckCircle2 size={22} />
                <div>{txt('현재 미해결 오답이 없습니다. 추천 문제나 배틀로 다음 목표를 만들어 보세요.', 'No unresolved wrong answers. Use recommendations or battles to create your next target.')}</div>
              </div>
            )}
          </section>
        </section>
      )}
    </main>
  )
}
