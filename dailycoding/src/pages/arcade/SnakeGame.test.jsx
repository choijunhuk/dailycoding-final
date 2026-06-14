import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { test } from 'vitest'

const sourcePath = resolve(import.meta.dirname, 'SnakeGame.jsx')

test('snake food placement does not rely on an unbounded loop', () => {
  const source = readFileSync(sourcePath, 'utf8')

  assert.doesNotMatch(source, /while\s*\(\s*true\s*\)/)
  assert.match(source, /availableCells/)
})
