import { useCallback, useEffect, useRef, useState } from 'react'
import { useLang } from '../../context/LangContext.jsx'

const SIZE = 4

function emptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0))
}

function spawn(grid) {
  const empty = []
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!grid[r][c]) empty.push([r, c])
  if (!empty.length) return grid
  const [r, c] = empty[Math.floor(Math.random() * empty.length)]
  const next = grid.map((row) => row.slice())
  next[r][c] = Math.random() < 0.9 ? 2 : 4
  return next
}

function rotateCW(grid) {
  const out = emptyGrid()
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) out[c][SIZE - 1 - r] = grid[r][c]
  return out
}

function slideLeft(grid) {
  let gained = 0
  let changed = false
  const out = grid.map((row) => {
    const filtered = row.filter((v) => v)
    const merged = []
    for (let i = 0; i < filtered.length; i++) {
      if (filtered[i] === filtered[i + 1]) {
        merged.push(filtered[i] * 2)
        gained += filtered[i] * 2
        i++
      } else {
        merged.push(filtered[i])
      }
    }
    while (merged.length < SIZE) merged.push(0)
    if (merged.some((v, i) => v !== row[i])) changed = true
    return merged
  })
  return { grid: out, gained, changed }
}

function move(grid, dir) {
  // Normalize all moves to "left" by rotating.
  let g = grid
  const rotations = { left: 0, up: 3, right: 2, down: 1 }[dir]
  for (let i = 0; i < rotations; i++) g = rotateCW(g)
  const { grid: slid, gained, changed } = slideLeft(g)
  let out = slid
  for (let i = 0; i < (4 - rotations) % 4; i++) out = rotateCW(out)
  return { grid: out, gained, changed }
}

function isStuck(grid) {
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (!grid[r][c]) return false
    if (c + 1 < SIZE && grid[r][c] === grid[r][c + 1]) return false
    if (r + 1 < SIZE && grid[r][c] === grid[r + 1][c]) return false
  }
  return true
}

const TILE_COLORS = {
  2: '#21262d', 4: '#30363d', 8: '#79c0ff', 16: '#56d4dd', 32: '#7ee787',
  64: '#ffd166', 128: '#ffa657', 256: '#ff7b72', 512: '#d2a8ff', 1024: '#bc8cff', 2048: '#ffd700',
}

export default function Game2048({ onComplete }) {
  const { lang } = useLang()
  const txt = (ko, en) => (lang === 'ko' ? ko : en)
  const [grid, setGrid] = useState(() => spawn(spawn(emptyGrid())))
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(false)
  const [reached2048, setReached2048] = useState(false)
  const completedRef = useRef(false)

  useEffect(() => {
    if (!over || completedRef.current) return
    completedRef.current = true
    const maxTile = Math.max(...grid.flat())
    onComplete(score, { maxTile, reached2048 })
  }, [over])

  const handleMove = useCallback((dir) => {
    if (over) return
    const { grid: next, gained, changed } = move(grid, dir)
    if (!changed) return
    const spawned = spawn(next)
    const maxTile = Math.max(...spawned.flat())
    setGrid(spawned)
    setScore((s) => s + gained)
    if (maxTile >= 2048 && !reached2048) setReached2048(true)
    if (isStuck(spawned)) setOver(true)
  }, [grid, over, reached2048])

  useEffect(() => {
    const onKey = (e) => {
      const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', h: 'left', l: 'right', k: 'up', j: 'down' }
      const dir = map[e.key]
      if (!dir) return
      e.preventDefault()
      handleMove(dir)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleMove])

  return (
    <div className="g2048-game">
      <div className="g2048-board">
        {grid.flatMap((row, r) => row.map((v, c) => (
          <div key={`${r}-${c}`} className="g2048-cell" style={v ? {
            background: TILE_COLORS[v] || '#ffd700',
            color: v <= 4 ? 'var(--text2)' : '#0d1117',
            fontSize: v >= 1024 ? 18 : v >= 128 ? 22 : 28,
          } : null}>{v || ''}</div>
        )))}
      </div>
      <div className="g2048-side">
        <div className="tetris-stat"><span>{txt('점수', 'Score')}</span><strong>{score}</strong></div>
        <div className="tetris-stat"><span>{txt('최대 타일', 'Max Tile')}</span><strong>{Math.max(...grid.flat())}</strong></div>
        <div className="tetris-controls">
          <div><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd></div>
          <div>{txt('또는', 'or')} <kbd>h</kbd><kbd>j</kbd><kbd>k</kbd><kbd>l</kbd></div>
          <div>{txt('같은 숫자 만나면 합쳐짐. 2048 만들면 보너스!', 'Merge equal tiles. Reach 2048 for a bonus!')}</div>
        </div>
        {reached2048 && <div className="g2048-victory">🏆 2048!</div>}
        {!over && (
          <button className="btn btn-ghost btn-sm" onClick={() => setOver(true)}>{txt('포기', 'Give up')}</button>
        )}
      </div>
    </div>
  )
}
