import React from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, test, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LangProvider } from '../context/LangContext.jsx'
import ArcadeGamePage from './ArcadeGamePage.jsx'

const postMock = vi.fn(async () => ({
  data: {
    id: 1,
    score: 92699,
    best: 92699,
    approxRank: 1,
    isNewBest: true,
  },
}))

vi.mock('../api.js', () => ({
  default: {
    post: (...args) => postMock(...args),
    get: vi.fn(async () => ({ data: { leaderboard: [] } })),
  },
}))

vi.mock('./arcade/TetrisGame.jsx', () => ({
  default: function MockTetrisGame({ onComplete }) {
    return (
      <button
        type="button"
        onClick={() => onComplete(92699, { mode: 'sprint', elapsed: 73, lines: 40, finished: true })}
      >
        finish sprint
      </button>
    )
  },
}))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function installLocalStorageStub() {
  const store = new Map()
  const stub = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  }
  Object.defineProperty(globalThis, 'localStorage', { value: stub, configurable: true })
  Object.defineProperty(window, 'localStorage', { value: stub, configurable: true })
}

beforeEach(() => {
  installLocalStorageStub()
})

afterEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  document.body.innerHTML = ''
})

test('Tetris sprint result shows elapsed time instead of score', async () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <LangProvider>
        <MemoryRouter initialEntries={['/arcade/tetris']}>
          <Routes>
            <Route path="/arcade/:key" element={<ArcadeGamePage />} />
          </Routes>
        </MemoryRouter>
      </LangProvider>
    )
  })

  const finishButton = Array.from(container.querySelectorAll('button'))
    .find((button) => button.textContent === 'finish sprint')
  assert.ok(finishButton)

  await act(async () => {
    finishButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })

  assert.match(container.textContent, /이번 시간/)
  assert.match(container.textContent, /1m 13s/)
  assert.match(container.textContent, /다음 목표/)
  assert.match(container.textContent, /1m 10s/)
  assert.doesNotMatch(container.textContent, /이번 점수/)
  assert.doesNotMatch(container.textContent, /92699/)
})
