import assert from 'node:assert/strict'
import { test } from 'vitest'
import { normalizeSearchResults } from './topNavSearchUtils.js'

test('normalizeSearchResults keeps nav search renderable when payload is null', () => {
  const results = normalizeSearchResults(null)

  assert.deepEqual(results, { problems: [], posts: [] })
})

test('normalizeSearchResults filters malformed result buckets', () => {
  const results = normalizeSearchResults({
    problems: null,
    posts: [{ id: 1, title: '공지' }],
    total: 4,
  })

  assert.deepEqual(results, {
    problems: [],
    posts: [{ id: 1, title: '공지' }],
  })
})
