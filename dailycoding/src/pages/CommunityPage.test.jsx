import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { test } from 'vitest'

const root = resolve(import.meta.dirname, '..', '..')

test('community page exposes COMS-inspired scan helpers', () => {
  const source = readFileSync(resolve(root, 'src/pages/CommunityPage.jsx'), 'utf8')

  assert.match(source, /function isEditedPost/, 'edited post helper should exist')
  assert.match(source, /community-insight-grid/, 'community should show a quick insight strip')
  assert.match(source, /community-topic-chips/, 'community should expose tag chips from current posts')
  assert.match(source, /txt\('미답변 Q&A'/, 'community should surface unanswered Q&A')
  assert.match(source, /txt\('수정됨'/, 'community should label edited posts')
})
