import { useCallback, useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { useLang } from '../../context/LangContext.jsx'
import api from '../../api.js'

const SIZE = 4

const MODES = {
  classic:       { name: 'Classic',        nameKo: '클래식',       limitSec: 0,   desc: '무제한. 최고 점수까지.', descEn: 'No timer. Reach the highest score.' },
  'time-attack': { name: 'Time Attack 3m', nameKo: '타임어택 3분', limitSec: 180, desc: '3분 안에 최대한 높은 점수.', descEn: 'Highest score in 3 minutes wins.' },
}

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

function Game2048Play({ mode, onComplete, onExit }) {
  const { lang } = useLang()
  const txt = (ko, en) => (lang === 'ko' ? ko : en)
  const cfg = MODES[mode]
  const [grid, setGrid] = useState(() => spawn(spawn(emptyGrid())))
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(false)
  const [reached2048, setReached2048] = useState(false)
  const [secsLeft, setSecsLeft] = useState(cfg.limitSec || null)
  const [undoSnap, setUndoSnap] = useState(null)
  const completedRef = useRef(false)
  const startedAtRef = useRef(Date.now())

  // Time-attack countdown.
  useEffect(() => {
    if (!cfg.limitSec || over) return undefined
    if (secsLeft <= 0) { setOver(true); return undefined }
    const t = setTimeout(() => setSecsLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [secsLeft, over, cfg.limitSec])

  useEffect(() => {
    if (!over || completedRef.current) return
    completedRef.current = true
    const maxTile = Math.max(...grid.flat())
    const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000)
    onComplete(score, { mode, maxTile, reached2048, elapsed })
  }, [over, grid, mode, onComplete, reached2048, score])

  const handleMove = useCallback((dir) => {
    if (over) return
    const { grid: next, gained, changed } = move(grid, dir)
    if (!changed) return
    const spawned = spawn(next)
    const maxTile = Math.max(...spawned.flat())
    setUndoSnap({ grid, score })
    setGrid(spawned)
    setScore((s) => s + gained)
    if (maxTile >= 2048 && !reached2048) setReached2048(true)
    if (isStuck(spawned)) setOver(true)
  }, [grid, over, reached2048, score])

  const handleUndo = useCallback(() => {
    if (!undoSnap || over) return
    setGrid(undoSnap.grid)
    setScore(undoSnap.score)
    setUndoSnap(null)
  }, [undoSnap, over])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'u' || e.key === 'U' || e.key === 'z' || e.key === 'Z') {
        e.preventDefault()
        handleUndo()
        return
      }
      const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', h: 'left', l: 'right', k: 'up', j: 'down' }
      const dir = map[e.key]
      if (!dir) return
      e.preventDefault()
      handleMove(dir)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleMove, handleUndo])

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
        <div className="tetris-stat">
          <span>{txt('모드', 'Mode')}</span>
          <strong style={{ fontSize: 13 }}>{txt(cfg.nameKo, cfg.name)}</strong>
        </div>
        {cfg.limitSec > 0 && (
          <div className="tetris-stat">
            <span><Clock size={12} /> {txt('남은 시간', 'Time left')}</span>
            <strong style={{ color: secsLeft <= 10 ? 'var(--red)' : undefined }}>{secsLeft}s</strong>
          </div>
        )}
        <div className="tetris-stat"><span>{txt('점수', 'Score')}</span><strong>{score}</strong></div>
        <div className="tetris-stat"><span>{txt('최대 타일', 'Max Tile')}</span><strong>{Math.max(...grid.flat())}</strong></div>
        <div className="tetris-controls">
          <div><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd></div>
          <div>{txt('또는', 'or')} <kbd>h</kbd><kbd>j</kbd><kbd>k</kbd><kbd>l</kbd></div>
          <div><kbd>U</kbd> {txt('한 수 되돌리기', 'Undo last move')}</div>
        </div>
        {reached2048 && <div className="g2048-victory">🏆 2048!</div>}
        {!over && (
          <>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleUndo}
              disabled={!undoSnap}
              style={{ opacity: undoSnap ? 1 : 0.4 }}
            >
              ↶ {txt('되돌리기', 'Undo')}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setOver(true)}>{txt('포기', 'Give up')}</button>
            <button className="btn btn-ghost btn-sm" onClick={onExit}>{txt('← 모드 변경', '← Change mode')}</button>
          </>
        )}
      </div>
    </div>
  )
}

export default function Game2048({ onComplete }) {
  const { lang } = useLang()
  const txt = (ko, en) => (lang === 'ko' ? ko : en)
  const [mode, setMode] = useState(null)
  const [perMode, setPerMode] = useState(null)

  useEffect(() => {
    if (mode) return undefined
    let cancelled = false
    api.get('/arcade/my-best')
      .then(({ data }) => { if (!cancelled) setPerMode(data?.bestByGameMode?.['2048'] || null) })
      .catch(() => { /* non-fatal */ })
    return () => { cancelled = true }
  }, [mode])

  if (!mode) {
    return (
      <div className="tetris-mode-select">
        <h2 style={{ margin: 0, fontSize: 18 }}>{txt('2048 모드 선택', 'Choose a 2048 mode')}</h2>
        <div className="tetris-mode-grid">
          {Object.entries(MODES).map(([key, info]) => {
            const best = perMode?.[key]?.best
            return (
              <button key={key} className="tetris-mode-card" onClick={() => setMode(key)}>
                <span>{txt(info.nameKo, info.name)}</span>
                <strong style={{ fontSize: 12 }}>{txt(info.desc, info.descEn)}</strong>
                {best > 0 && <span style={{ marginTop: 6, fontSize: 11, color: 'var(--accent)', fontFamily: 'Space Mono, monospace' }}>★ {txt('최고 점수', 'Best score')}: {best.toLocaleString()}</span>}
              </button>
            )
          })}
        </div>
      </div>
    )
  }
  return <Game2048Play mode={mode} onComplete={onComplete} onExit={() => setMode(null)} />
}
