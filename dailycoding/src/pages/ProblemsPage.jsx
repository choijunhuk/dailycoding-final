import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PROBLEMS as DEFAULT_PROBLEMS, TIERS } from '../data/problems'
import './ProblemsPage.css'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext.jsx'
import { useLang } from '../context/LangContext.jsx'
import api from '../api.js'
import { Filter, Grid, List, Search, Share2, Star, X } from 'lucide-react'
import {
  FALLBACK_TAGS,
  getProblemTypeMeta,
  getStoredView,
  parsePositiveInt,
  PROBLEM_TYPE_META,
  sortProblems,
  VALID_SORTS,
  VALID_STATUS,
  VALID_VIEWS,
  VIEW_PAGE_SIZE,
} from './problemsPageUtils.js'

export default function ProblemsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { solved, bookmarks, toggleBookmark, problems: appProblems } = useApp()
  const { isAdmin } = useAuth()
  const toast = useToast()
  const { t } = useLang()
  const PROBLEMS = appProblems.length > 0 ? appProblems : DEFAULT_PROBLEMS

  const getTypeLabel = (type) => {
    const map = { coding: t('typeLabelCoding'), 'fill-blank': t('typeLabelFillBlank'), 'bug-fix': t('typeLabelBugFix') }
    return map[type] || type
  }
  const getTypeShort = (type) => {
    const map = { coding: t('typeShortCoding'), 'fill-blank': t('typeShortFillBlank'), 'bug-fix': t('typeShortBugFix') }
    return map[type] || type
  }

  const search = (searchParams.get('search') || '').trim()
  const problemType = searchParams.get('problemType') || 'all'
  const tier = searchParams.get('tier') || 'all'
  const tag = searchParams.get('tag') || 'all'
  const status = VALID_STATUS.has(searchParams.get('status')) ? searchParams.get('status') : 'all'
  const sort = VALID_SORTS.has(searchParams.get('sort')) ? searchParams.get('sort') : 'id'
  const view = VALID_VIEWS.has(searchParams.get('view')) ? searchParams.get('view') : getStoredView()
  const recommended = searchParams.get('recommended') === 'true'
  const page = parsePositiveInt(searchParams.get('page'), 1)
  const perPage = VIEW_PAGE_SIZE[view] || VIEW_PAGE_SIZE.table

  const [preview, setPreview] = useState(null)
  const [suggest, setSuggest] = useState([])
  const [showSug, setShowSug] = useState(false)
  const [availableTags, setAvailableTags] = useState(FALLBACK_TAGS)
  const [tagLoading, setTagLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [requestError, setRequestError] = useState('')
  const [randomLoading, setRandomLoading] = useState(false)
  const [recommendedProblems, setRecommendedProblems] = useState([])
  const [serverList, setServerList] = useState({
    items: [],
    total: 0,
    page: 1,
    limit: perPage,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  })
  const requestErrorToastShownRef = useRef(false)

  const updateQuery = useCallback((updates, options = {}) => {
    const { replace = true } = options
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      Object.entries(updates).forEach(([key, value]) => {
        if (value == null || value === '' || value === 'all') next.delete(key)
        else next.set(key, String(value))
      })
      return next
    }, { replace })
  }, [setSearchParams])

  useEffect(() => {
    if (!searchParams.get('view')) {
      updateQuery({ view })
    }
  }, [searchParams, updateQuery, view])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('dc_problem_view', view)
  }, [view])

  useEffect(() => {
    let ignore = false
    setTagLoading(true)
    api.get('/problems/tags')
      .then(res => {
        if (ignore) return
        const tags = Array.isArray(res.data) && res.data.length > 0 ? res.data : FALLBACK_TAGS
        setAvailableTags(tags)
      })
      .catch(() => {
        if (!ignore) setAvailableTags(FALLBACK_TAGS)
      })
      .finally(() => {
        if (!ignore) setTagLoading(false)
      })
    return () => { ignore = true }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setRequestError('')

    api.get('/problems', {
      signal: controller.signal,
      params: {
        page,
        limit: perPage,
        sort,
        ...(problemType !== 'all' ? { problemType } : {}),
        ...(tier !== 'all' ? { tier } : {}),
        ...(tag !== 'all' ? { tag } : {}),
        ...(status !== 'all' ? { status } : {}),
        ...(search ? { search } : {}),
      },
    })
      .then(res => {
        requestErrorToastShownRef.current = false
        const payload = Array.isArray(res.data)
          ? { items: res.data, total: res.data.length, page: 1, limit: perPage, totalPages: 1, hasPrev: false, hasNext: false }
          : res.data

        setServerList({
          items: payload.items || [],
          total: payload.total || 0,
          page: payload.page || 1,
          limit: payload.limit || perPage,
          totalPages: payload.totalPages || 1,
          hasPrev: Boolean(payload.hasPrev),
          hasNext: Boolean(payload.hasNext),
        })

        if ((payload.page || 1) !== page) {
          updateQuery({ page: payload.page || 1 })
        }
      })
      .catch(err => {
        if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return
        const message = err?.response?.data?.message || t('loadFailed2')
        setRequestError(message)
        if (err?.response?.status !== 401 && !requestErrorToastShownRef.current) {
          requestErrorToastShownRef.current = true
          toast?.show(message, 'error')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [page, perPage, search, sort, status, tag, tier, problemType, updateQuery])

  useEffect(() => {
    if (!search) {
      setSuggest([])
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      api.get('/problems/search', {
        signal: controller.signal,
        params: { q: search },
      })
        .then(res => setSuggest(Array.isArray(res.data) ? res.data : []))
        .catch(err => {
          if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return
          setSuggest([])
        })
    }, 180)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [search])

  useEffect(() => {
    if (!recommended || search || problemType !== 'all' || tier !== 'all' || tag !== 'all' || status !== 'all') {
      setRecommendedProblems([])
      return
    }
    let ignore = false
    api.get('/problems/recommend')
      .then(res => {
        if (!ignore) setRecommendedProblems(Array.isArray(res.data) ? res.data : [])
      })
      .catch(() => {
        if (!ignore) setRecommendedProblems([])
      })
    return () => { ignore = true }
  }, [recommended, search, problemType, tier, tag, status])

  const fallbackList = useMemo(() => {
    let list = [...PROBLEMS]
    if (search) {
      const lowered = search.toLowerCase()
      list = list.filter(problem => (problem.title || '').toLowerCase().includes(lowered) || String(problem.id) === search)
    }
    if (problemType !== 'all') list = list.filter(problem => (problem.problemType || 'coding') === problemType)
    if (tier !== 'all') list = list.filter(problem => problem.tier === tier)
    if (tag !== 'all') list = list.filter(problem => problem.tags?.includes(tag))
    if (status === 'solved') list = list.filter(problem => solved[problem.id])
    if (status === 'unsolved') list = list.filter(problem => !solved[problem.id])
    if (status === 'bookmarked') list = list.filter(problem => bookmarks[problem.id])

    const sorted = sortProblems(list, sort)
    const total = sorted.length
    const totalPages = Math.max(1, Math.ceil(total / perPage))
    const safePage = Math.min(page, totalPages)
    const items = sorted.slice((safePage - 1) * perPage, safePage * perPage)

    return {
      items,
      total,
      page: safePage,
      limit: perPage,
      totalPages,
      hasPrev: safePage > 1,
      hasNext: safePage < totalPages,
    }
  }, [PROBLEMS, bookmarks, page, perPage, search, solved, sort, status, tag, tier, problemType])

  const effectiveList = requestError ? fallbackList : serverList

  const paginated = useMemo(() => {
    return (effectiveList.items || []).map(problem => ({
      ...problem,
      isSolved: solved[problem.id] ?? problem.isSolved ?? false,
      isBookmarked: bookmarks[problem.id] ?? problem.isBookmarked ?? false,
    }))
  }, [bookmarks, effectiveList.items, solved])

  const totalPages = Math.max(1, effectiveList.totalPages || 1)
  const safePage = Math.min(effectiveList.page || page, totalPages)
  const solvedCount = Object.keys(solved).length
  const unsolvedCount = Math.max(0, PROBLEMS.length - solvedCount)
  const activeFilterCount = [search, problemType !== 'all', tier !== 'all', tag !== 'all', status !== 'all', sort !== 'id'].filter(Boolean).length
  const activeChips = [
    search ? { key: 'search', label: `${t('chipSearch')}${search}` } : null,
    tier !== 'all' ? { key: 'tier', label: `${t('chipTier')}${TIERS[tier]?.label || tier}` } : null,
    problemType !== 'all' ? { key: 'problemType', label: `${t('chipType')}${getTypeLabel(problemType)}` } : null,
    tag !== 'all' ? { key: 'tag', label: `${t('chipTag')}${tag}` } : null,
    status !== 'all' ? { key: 'status', label: `${t('chipStatus')}${status}` } : null,
    sort !== 'id' ? { key: 'sort', label: `${t('chipSort')}${sort}` } : null,
  ].filter(Boolean)

  const go = useCallback((problem) => {
    navigate(`/problems/${problem.id}`, { state: { problem } })
  }, [navigate])

  const updateFilter = useCallback((key, value, options = {}) => {
    const { resetPage = true } = options
    updateQuery({
      [key]: value,
      ...(resetPage ? { page: 1 } : {}),
    })
  }, [updateQuery])

  const clearFilters = useCallback(() => {
    setSuggest([])
    setShowSug(false)
    updateQuery({
      search: null,
      tier: null,
      problemType: null,
      tag: null,
      status: null,
      sort: null,
      page: 1,
    })
    toast?.show(t('filterCleared'), 'info')
  }, [toast, updateQuery])

  const bm = useCallback(async (e, id) => {
    e.stopPropagation()
    try {
      const result = await toggleBookmark(id)
      toast?.show(result?.bookmarked ? t('bookmarkAdded') : t('bookmarkRemoved'), 'info')
    } catch (err) {
      toast?.show(err?.response?.data?.message || t('bookmarkFailed'), 'error')
    }
  }, [bookmarks, toggleBookmark, toast])

  const copyShareLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast?.show(t('filterLinkCopied'), 'success')
    } catch {
      toast?.show(t('filterLinkFailed'), 'error')
    }
  }, [toast])

  const handleRandomPick = useCallback(async () => {
    try {
      setRandomLoading(true)
      const { data } = await api.get('/problems/random/pick', {
        params: {
          ...(tier !== 'all' ? { tier } : {}),
          ...(tag !== 'all' ? { tag } : {}),
        },
      })

      if (!data?.id) {
        toast?.show(data?.message || t('randomNone'), 'info')
        return
      }

      toast?.show(t('randomPicked').replace('{title}', data.title), 'success')
      go(data)
    } catch (err) {
      toast?.show(err?.response?.data?.message || t('randomFailed'), 'error')
    } finally {
      setRandomLoading(false)
    }
  }, [go, tag, tier, problemType, toast])

  const changePage = useCallback((nextPage) => {
    updateQuery({ page: Math.min(Math.max(1, nextPage), totalPages) }, { replace: false })
  }, [totalPages, updateQuery])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        padding: '18px 24px 0',
        flexShrink: 0,
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
      }}>
        {recommendedProblems.length > 0 && (
          <div style={{
            marginBottom: 16,
            padding: '16px 18px',
            borderRadius: 12,
            border: '1px solid rgba(88,166,255,.25)',
            background: 'linear-gradient(135deg, rgba(88,166,255,.08), var(--bg2))',
          }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6, fontWeight: 700 }}>{t('onboardingRec')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {recommendedProblems.slice(0, 4).map(problem => (
                <button
                  key={problem.id}
                  onClick={() => go(problem)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 999,
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {problem.title}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{t('problemListTitle')}</h1>
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text2)', flexWrap: 'wrap' }}>
              <span>{t('totalLabel')} <strong style={{ color: 'var(--text)' }}>{PROBLEMS.length}</strong></span>
              <span style={{ color: 'var(--green)' }}>{t('solvedLabel')} <strong>{solvedCount}</strong></span>
              <span style={{ color: 'var(--orange)' }}>{t('unsolvedLabel')} <strong>{unsolvedCount}</strong></span>
              <span style={{ color: 'var(--blue)' }}>{t('currentResults')} <strong>{effectiveList.total || 0}</strong></span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {requestError && (
              <span style={{
                padding: '6px 10px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--orange)',
                background: 'rgba(255, 166, 87, 0.12)',
                border: '1px solid rgba(255, 166, 87, 0.25)',
              }}>{t('localFallback')}</span>
            )}
            {isAdmin && (
              <button onClick={() => navigate('/admin')} style={{
                padding: '7px 14px',
                borderRadius: 8,
                border: '1px solid rgba(227,179,65,.3)',
                background: 'rgba(227,179,65,.08)',
                color: 'var(--yellow)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'inherit',
                display:'inline-flex', alignItems:'center', gap:6,
              }}><Filter size={14} />{t('manageProblem')}</button>
            )}
            <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 8, padding: 2, border: '1px solid var(--border)' }}>
              {[['table', <List size={15} key="list" />], ['card', <Grid size={15} key="grid" />]].map(([nextView, icon]) => (
                <button
                  key={nextView}
                  onClick={() => updateQuery({ view: nextView, page: 1 })}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    background: view === nextView ? 'var(--bg2)' : 'transparent',
                    color: view === nextView ? 'var(--text)' : 'var(--text3)',
                    fontSize: 14,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >{icon}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="problems-filter-grid" style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'minmax(240px, 1.4fr) repeat(4, minmax(120px, .75fr))',
          paddingBottom: 12,
        }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '8px 12px',
            }}>
              <Search size={14} color="var(--text3)" />
              <input
                value={search}
                onFocus={() => setShowSug(true)}
                onBlur={() => window.setTimeout(() => setShowSug(false), 140)}
                onChange={e => {
                  setShowSug(true)
                  updateFilter('search', e.target.value)
                }}
                placeholder={t('searchPlaceholder')}
                style={{
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text)',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  width: '100%',
                }}
              />
              {search && (
                <button
                  onClick={() => {
                    setShowSug(false)
                    setSuggest([])
                    updateFilter('search', null)
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14 }}
                ><X size={14} /></button>
              )}
            </div>
            {showSug && suggest.length > 0 && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                zIndex: 100,
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,.4)',
              }}>
                {suggest.map(item => (
                  <button
                    key={item.id}
                    onMouseDown={() => {
                      setShowSug(false)
                      setSuggest([])
                      updateQuery({ search: item.title, page: 1 })
                    }}
                    style={{
                      width: '100%',
                      padding: '9px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      fontSize: 13,
                      border: 'none',
                      borderBottom: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--text)',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 10, fontFamily: 'Space Mono,monospace', color: TIERS[item.tier]?.color, width: 58 }}>● {item.tier}</span>
                    <span style={{ flex: 1, fontWeight: 500 }}>{item.title}</span>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>{t('difficultyShort')} {item.difficulty}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <select value={tier} onChange={e => updateFilter('tier', e.target.value)} style={{
            background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
            color: 'var(--text)', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none',
          }}>
            <option value="all">{t('allTiers')}</option>
            {Object.entries(TIERS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
          </select>

          <select value={problemType} onChange={e => updateFilter('problemType', e.target.value)} style={{
            background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
            color: 'var(--text)', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none',
          }}>
            <option value="all">{t('allTypes')}</option>
            {Object.entries(PROBLEM_TYPE_META).map(([key]) => <option key={key} value={key}>{getTypeLabel(key)}</option>)}
          </select>

          <select value={tag} onChange={e => updateFilter('tag', e.target.value)} style={{
            background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
            color: 'var(--text)', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none',
          }}>
            <option value="all">{tagLoading ? t('loadingTags') : t('allTags')}</option>
            {availableTags.map(item => <option key={item} value={item}>{item}</option>)}
          </select>

          <select value={sort} onChange={e => updateFilter('sort', e.target.value)} style={{
            background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
            color: 'var(--text)', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none',
          }}>
            <option value="id">{t('sortById')}</option>
            <option value="newest">{t('sortByNewest')}</option>
            <option value="difficulty">{t('sortByEasy')}</option>
            <option value="-difficulty">{t('sortByHard')}</option>
            <option value="solved">{t('sortBySolved')}</option>
          </select>

          <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
            {[['all', t('allStatus')], ['unsolved', t('unsolvedStatus')], ['solved', t('solvedStatus')], ['bookmarked', t('bookmarkStatus')]].map(([key, label]) => (
              <button
                key={key}
                onClick={() => updateFilter('status', key)}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  transition: 'all .15s',
                  background: status === key ? 'var(--blue)' : 'transparent',
                  color: status === key ? 'var(--bg)' : 'var(--text2)',
                }}
              >{label}</button>
            ))}
          </div>
        </div>

        {activeChips.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingBottom: 12 }}>
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                onClick={() => updateFilter(chip.key, null)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  borderRadius: 999,
                  border: '1px solid var(--border)',
                  background: 'var(--bg2)',
                  color: 'var(--text2)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {chip.label}
                <X size={12} />
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', paddingBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {activeFilterCount > 0 ? (
              <span style={{
                padding: '6px 10px',
                borderRadius: 999,
                background: 'rgba(88,166,255,.12)',
                color: 'var(--blue)',
                fontSize: 12,
                fontWeight: 700,
                border: '1px solid rgba(88,166,255,.2)',
              }}>{t('activeFilters').replace('{n}', activeFilterCount)}</span>
            ) : (
              <span style={{
                padding: '6px 10px',
                borderRadius: 999,
                background: 'var(--bg2)',
                color: 'var(--text3)',
                fontSize: 12,
                border: '1px solid var(--border)',
              }}>{t('viewingAll')}</span>
            )}
            <span style={{
              padding: '6px 10px',
              borderRadius: 999,
              background: 'var(--bg2)',
              color: 'var(--text2)',
              fontSize: 12,
              border: '1px solid var(--border)',
            }}>{t('pageInfo').replace('{page}', safePage).replace('{total}', totalPages)}</span>
            <span style={{
              padding: '6px 10px',
              borderRadius: 999,
              background: 'var(--bg2)',
              color: 'var(--text2)',
              fontSize: 12,
              border: '1px solid var(--border)',
            }}>{t('showingOf').replace('{total}', PROBLEMS.length).replace('{showing}', effectiveList.total || 0)}</span>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={handleRandomPick} disabled={randomLoading} style={{
              padding: '8px 12px',
              borderRadius: 9,
              border: '1px solid rgba(86,211,100,.22)',
              background: 'rgba(86,211,100,.12)',
              color: 'var(--green)',
              cursor: randomLoading ? 'wait' : 'pointer',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'inherit',
              opacity: randomLoading ? .7 : 1,
            }}>{randomLoading ? t('randomPicking') : t('randomPick')}</button>
            <button onClick={copyShareLink} style={{
              padding: '8px 12px',
              borderRadius: 9,
              border: '1px solid var(--border)',
              background: 'var(--bg2)',
              color: 'var(--text2)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'inherit',
              display:'inline-flex', alignItems:'center', gap:6,
            }}><Share2 size={14} />{t('copyFilterLink')}</button>
            <button onClick={clearFilters} style={{
              padding: '8px 12px',
              borderRadius: 9,
              border: '1px solid var(--border)',
              background: 'var(--bg2)',
              color: 'var(--text2)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'inherit',
              display:'inline-flex', alignItems:'center', gap:6,
            }}><X size={14} />{t('clearAll')}</button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {requestError && (
          <div style={{
            marginBottom: 14,
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid rgba(255,166,87,.2)',
            background: 'rgba(255,166,87,.1)',
            color: 'var(--orange)',
            fontSize: 12,
            lineHeight: 1.6,
          }}>{requestError}</div>
        )}

        {loading && !requestError && (
          <div style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '48px 18px',
            textAlign: 'center',
            color: 'var(--text3)',
          }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text2)' }}>{t('loadingProblems')}</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>{t('filterLoadingDesc')}</div>
          </div>
        )}

        {!loading && paginated.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{t('noResults')}</div>
            <div style={{ fontSize: 13 }}>{t('noResultsHint')}</div>
          </div>
        )}

        {view === 'table' && paginated.length > 0 && (
          <div className="problems-table-card" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div className="problems-table-head" style={{
              display: 'grid',
              gridTemplateColumns: '60px 1fr 100px 80px 90px 70px 60px 50px 82px',
              padding: '9px 18px',
              borderBottom: '1px solid var(--border)',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text3)',
              textTransform: 'uppercase',
              letterSpacing: .5,
            }}>
              <span>{t('tableNumCol')}</span><span>{t('tableTitleCol')}</span><span>{t('tableTierCol')}</span>
              <span style={{ textAlign: 'center' }}>{t('tableDiffCol')}</span>
              <span style={{ textAlign: 'right' }}>{t('tableSolversCol')}</span>
              <span style={{ textAlign: 'center' }}>{t('tableRateCol')}</span>
              <span style={{ textAlign: 'center' }}>{t('tableStatusCol')}</span>
              <span></span>
              <span style={{ textAlign: 'right' }}>{t('tableActionCol')}</span>
            </div>
            {paginated.map((problem, index) => {
              const tierMeta = TIERS[problem.tier] || TIERS.bronze
              const solvedState = Boolean(problem.isSolved)
              const bookmarkedState = Boolean(problem.isBookmarked)
              const solvedCountForProblem = problem.solved || problem.solved_count || 0
              const submitCount = problem.submissions || problem.submit_count || 0
              const rate = submitCount > 0 ? Math.round((solvedCountForProblem / submitCount) * 100) : 0
              const typeMeta = PROBLEM_TYPE_META[problem.problemType || 'coding'] || PROBLEM_TYPE_META.coding

              return (
                <div
                  key={problem.id}
                  className="problems-table-row"
                  onClick={() => setPreview(problem)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 1fr 100px 80px 90px 70px 60px 50px 82px',
                    padding: '12px 18px',
                    alignItems: 'center',
                    cursor: 'pointer',
                    borderBottom: index < paginated.length - 1 ? '1px solid var(--border)' : 'none',
                    borderLeft: `3px solid ${solvedState ? 'var(--green)' : 'transparent'}`,
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'Space Mono,monospace' }}>#{problem.id}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {problem.title}
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: typeMeta.bg, color: typeMeta.color }}>{getTypeShort(problem.problemType || 'coding')}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(problem.tags || []).slice(0, 3).map(item => (
                        <span key={item} style={{
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: 'var(--bg3)',
                          color: 'var(--text3)',
                          border: '1px solid var(--border)',
                        }}>{item}</span>
                      ))}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'Space Mono,monospace', color: tierMeta.color }}>● {tierMeta.label}</span>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: `rgba(${problem.difficulty > 7 ? '248,81,73' : problem.difficulty > 4 ? '255,166,87' : '86,211,100'},.12)`,
                      fontSize: 11,
                      fontWeight: 700,
                      color: problem.difficulty > 7 ? 'var(--red)' : problem.difficulty > 4 ? 'var(--orange)' : 'var(--green)',
                    }}>{problem.difficulty}</span>
                  </div>
                  <span style={{ textAlign: 'right', fontSize: 12, color: 'var(--text2)', fontFamily: 'Space Mono,monospace' }}>{solvedCountForProblem.toLocaleString()}</span>
                  <span style={{
                    textAlign: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                    color: rate >= 70 ? 'var(--green)' : rate >= 40 ? 'var(--yellow)' : 'var(--red)',
                    fontFamily: 'Space Mono,monospace',
                  }}>{rate}%</span>
                  <div style={{ textAlign: 'center', fontSize: 16 }}>{solvedState ? '✅' : '⬜'}</div>
                  <button onClick={e => bm(e, problem.id)} style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 14,
                    color: bookmarkedState ? 'var(--yellow)' : 'var(--text3)',
                    display: 'grid',
                    placeItems: 'center',
                  }}>{bookmarkedState ? <Star size={15} fill="currentColor" /> : <Star size={15} />}</button>
                  <div style={{ textAlign:'right' }}>
                    <button onClick={e => { e.stopPropagation(); go(problem) }} style={{
                      padding:'6px 10px', borderRadius:8, border:'1px solid var(--border)',
                      background:'var(--bg3)', color:'var(--text)', cursor:'pointer', fontSize:12, fontWeight:700,
                    }}>{t('solve')}</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {view === 'card' && paginated.length > 0 && (
          <div className="problem-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
            {paginated.map(problem => {
              const tierMeta = TIERS[problem.tier] || TIERS.bronze
              const solvedState = Boolean(problem.isSolved)
              const bookmarkedState = Boolean(problem.isBookmarked)
              const solvedCountForProblem = problem.solved || problem.solved_count || 0
              const typeMeta = PROBLEM_TYPE_META[problem.problemType || 'coding'] || PROBLEM_TYPE_META.coding

              return (
                <div key={problem.id} className="problem-card" onClick={() => setPreview(problem)} style={{
                  background: 'var(--bg2)',
                  border: `1px solid ${solvedState ? 'rgba(86,211,100,.25)' : 'var(--border)'}`,
                  borderRadius: 14,
                  padding: 18,
                  cursor: 'pointer',
                  transition: 'all .2s',
                  position: 'relative',
                  borderTop: `3px solid ${tierMeta.color}60`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontFamily: 'Space Mono,monospace', color: 'var(--text3)' }}>#{problem.id}</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {solvedState && <span style={{ fontSize: 13 }}>✅</span>}
                      <button onClick={e => bm(e, problem.id)} style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 14,
                        color: bookmarkedState ? 'var(--yellow)' : 'var(--text3)',
                        display:'grid',
                        placeItems:'center',
                      }}>{bookmarkedState ? <Star size={15} fill="currentColor" /> : <Star size={15} />}</button>
                    </div>
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, lineHeight: 1.3 }}>{problem.title}</h3>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: typeMeta.bg, color: typeMeta.color }}>
                      {getTypeShort(problem.problemType || 'coding')}
                    </span>
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: tierMeta.bg, color: tierMeta.color }}>
                      ● {tierMeta.label}
                    </span>
                    {(problem.tags || []).slice(0, 2).map(item => (
                      <span key={item} style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, background: 'var(--bg3)', color: 'var(--text3)', border: '1px solid var(--border)' }}>{item}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)' }}>
                    <span>{t('difficultyShort')} {problem.difficulty}/10</span>
                    <span>✅ {t('solversUnit').replace('{n}', solvedCountForProblem.toLocaleString())}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:14 }}>
                    <span style={{ fontSize:11, color:'var(--text3)' }}>{t('hoverSolve')}</span>
                    <button onClick={e => { e.stopPropagation(); go(problem) }} style={{
                      padding:'7px 12px', borderRadius:8, border:'1px solid var(--border)',
                      background:'var(--bg3)', color:'var(--text)', cursor:'pointer', fontSize:12, fontWeight:700,
                    }}>{t('solve')}</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {totalPages > 1 && paginated.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => changePage(safePage - 1)} disabled={safePage === 1} style={{
              padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)',
              background: 'var(--bg2)', color: 'var(--text2)', cursor: 'pointer', fontSize: 12,
              opacity: safePage === 1 ? .5 : 1,
            }}>{t('prevPage')}</button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, index) => {
              let pageNumber = index + 1
              if (totalPages > 7) {
                if (safePage <= 4) pageNumber = index + 1
                else if (safePage >= totalPages - 3) pageNumber = totalPages - 6 + index
                else pageNumber = safePage - 3 + index
              }
              return (
                <button key={pageNumber} onClick={() => changePage(pageNumber)} style={{
                  width: 32,
                  height: 32,
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  background: safePage === pageNumber ? 'var(--blue)' : 'var(--bg2)',
                  color: safePage === pageNumber ? 'var(--bg)' : 'var(--text2)',
                  fontSize: 12,
                  fontWeight: 600,
                  outline: `1px solid ${safePage === pageNumber ? 'var(--blue)' : 'var(--border)'}`,
                }}>{pageNumber}</button>
              )
            })}
            <button onClick={() => changePage(safePage + 1)} disabled={safePage === totalPages} style={{
              padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)',
              background: 'var(--bg2)', color: 'var(--text2)', cursor: 'pointer', fontSize: 12,
              opacity: safePage === totalPages ? .5 : 1,
            }}>{t('nextPage')}</button>
          </div>
        )}
      </div>

      {preview && (
        <div className="problem-preview-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 300, backdropFilter: 'blur(4px)',
        }} onClick={e => e.target === e.currentTarget && setPreview(null)}>
          <div className="problem-preview-modal" style={{
            width: 580, maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto',
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 16, padding: 28,
            borderTop: `4px solid ${TIERS[preview.tier]?.color || 'var(--border)'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: (PROBLEM_TYPE_META[preview.problemType || 'coding'] || PROBLEM_TYPE_META.coding).bg,
                    color: (PROBLEM_TYPE_META[preview.problemType || 'coding'] || PROBLEM_TYPE_META.coding).color,
                  }}>{getTypeLabel(preview.problemType || 'coding')}</span>
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: TIERS[preview.tier]?.bg, color: TIERS[preview.tier]?.color,
                  }}>● {TIERS[preview.tier]?.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'Space Mono,monospace' }}>#{preview.id}</span>
                  {(preview.isSolved || solved[preview.id]) && <span style={{ fontSize: 12, color: 'var(--green)' }}>{t('solvedBadge')}</span>}
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 800 }}>{preview.title}</h2>
              </div>
              <button onClick={() => setPreview(null)} style={{
                background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer',
                fontSize: 20, lineHeight: 1, padding: 4,
              }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 20, marginBottom: 18, fontSize: 12, color: 'var(--text2)', flexWrap: 'wrap' }}>
              <span>⏱ {preview.timeLimit || preview.time_limit || 2}{t('secUnit')}</span>
              <span>💾 {preview.memLimit || preview.mem_limit || 256}MB</span>
              <span>📊 {t('solversCount').replace('{n}', (preview.solved || preview.solved_count || 0).toLocaleString())}</span>
              <span>🎯 {t('difficultyShort')} {preview.difficulty}/10</span>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.8, marginBottom: 18, whiteSpace: 'pre-line' }}>
              {preview.desc || preview.description || t('problemNoDesc')}
            </p>

            {(preview.tags || []).length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
                {preview.tags.map(item => (
                  <span key={item} style={{
                    padding: '3px 9px', borderRadius: 6, fontSize: 11,
                    background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)',
                  }}>{item}</span>
                ))}
              </div>
            )}

            {preview.examples?.[0] && (
              <div className="problem-preview-examples" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                {[[t('exInput'), preview.examples[0].input], [t('exOutput'), preview.examples[0].output]].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: .5 }}>{label}</div>
                    <pre style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--green)', fontFamily: 'Space Mono,monospace', margin: 0, whiteSpace: 'pre-wrap' }}>{value}</pre>
                  </div>
                ))}
              </div>
            )}

            <div className="problem-preview-actions" style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { go(preview); setPreview(null) }} style={{
                flex: 1, padding: '12px', borderRadius: 9,
                background: 'var(--blue)', border: 'none', color: 'var(--bg)',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>{t('solveProblem')}</button>
              <button onClick={e => bm(e, preview.id)} style={{
                padding: '12px 16px', borderRadius: 9,
                background: (preview.isBookmarked || bookmarks[preview.id]) ? 'rgba(227,179,65,.15)' : 'var(--bg3)',
                border: `1px solid ${(preview.isBookmarked || bookmarks[preview.id]) ? 'rgba(227,179,65,.3)' : 'var(--border)'}`,
                color: (preview.isBookmarked || bookmarks[preview.id]) ? 'var(--yellow)' : 'var(--text2)',
                cursor: 'pointer', fontSize: 16,
              }}>{(preview.isBookmarked || bookmarks[preview.id]) ? '🔖' : '☆'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
