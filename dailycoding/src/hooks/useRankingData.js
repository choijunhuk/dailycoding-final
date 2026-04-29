import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../api.js'

const listeners = new Set()

let store = {
  cache: {},
}

function emit() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getCacheKey(page, limit, tier, sort) {
  return `${page}:${limit}:${tier || 'all'}:${sort || 'rating'}`
}

function ensureEntry(key) {
  if (!store.cache[key]) {
    store.cache[key] = {
      data: null,
      loading: false,
      error: null,
      promise: null,
    }
  }
  return store.cache[key]
}

async function fetchRankingData({ page = 1, limit = 20, tier = 'all', sort = 'rating', force = false } = {}) {
  const key = getCacheKey(page, limit, tier, sort)
  const entry = ensureEntry(key)

  if (entry.data && !force) return entry.data
  if (entry.promise && !force) return entry.promise

  entry.loading = true
  entry.error = null
  emit()

  const request = api.get('/ranking', { params: { page, limit, ...(tier && tier !== 'all' ? { tier } : {}), sort } })
    .then(({ data }) => {
      entry.data = data
      return data
    })
    .catch((error) => {
      entry.error = error
      throw error
    })
    .finally(() => {
      entry.loading = false
      entry.promise = null
      emit()
    })

  entry.promise = request
  return request
}

export function invalidateRankingData() {
  store = { cache: {} }
  emit()
}

export function useRankingData({ page = 1, limit = 20, tier = 'all', sort = 'rating' } = {}) {
  const [version, setVersion] = useState(0)
  const key = useMemo(() => getCacheKey(page, limit, tier, sort), [page, limit, tier, sort])

  useEffect(() => subscribe(() => setVersion((current) => current + 1)), [])

  useEffect(() => {
    const entry = ensureEntry(key)
    if (!entry.data && !entry.promise) {
      fetchRankingData({ page, limit, tier, sort }).catch(() => {})
    }
  }, [key, page, limit, tier, sort, version])

  const refreshRankingData = useCallback(async () => {
    try {
      return await fetchRankingData({ page, limit, tier, sort, force: true })
    } catch {
      return null
    }
  }, [page, limit, tier, sort])

  const entry = ensureEntry(key)

  return {
    rankingData: entry.data?.items || [],
    pagination: entry.data || { page, limit, total: 0, totalPages: 1, myRank: null, items: [] },
    loading: entry.loading,
    error: entry.error,
    refreshRankingData,
    invalidateRankingData,
  }
}
