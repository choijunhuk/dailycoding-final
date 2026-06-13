import { useCallback, useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { useLang } from '../../context/LangContext.jsx'

const COLS = 10
const ROWS = 20

const PIECES = {
  I: { color: '#79c0ff', cells: [[0,1],[1,1],[2,1],[3,1]] },
  O: { color: '#ffd166', cells: [[0,0],[1,0],[0,1],[1,1]] },
  T: { color: '#d2a8ff', cells: [[0,1],[1,1],[2,1],[1,0]] },
  S: { color: '#7ee787', cells: [[1,1],[2,1],[0,2],[1,2]] },
  Z: { color: '#ff7b72', cells: [[0,1],[1,1],[1,2],[2,2]] },
  J: { color: '#ffa657', cells: [[0,0],[0,1],[1,1],[2,1]] },
  L: { color: '#56d4dd', cells: [[2,0],[0,1],[1,1],[2,1]] },
}

const TYPES = Object.keys(PIECES)

const MODES = {
  classic:  { name: 'Classic',  nameKo: '클래식',     desc: 'Play until you top out.', descKo: '계속 떨어지는 무한 모드. 가능한 오래 버티세요.' },
  sprint:   { name: 'Sprint 40', nameKo: '스프린트 40', desc: 'Clear 40 lines as fast as possible.', descKo: '40줄 클리어 타임어택. 빠를수록 점수 ↑' },
  ultra:    { name: 'Ultra 2m', nameKo: '울트라 2분',  desc: 'High score in 2 minutes.', descKo: '2분 안에 최대한 많은 점수를 쌓으세요.' },
  invisible:{ name: 'Invisible', nameKo: '인비저블',   desc: 'Placed blocks fade after 1.5s.', descKo: '놓은 블록이 1.5초 후 흐려집니다. 기억력 테스트.' },
}

function randPiece() {
  const t = TYPES[Math.floor(Math.random() * TYPES.length)]
  return { type: t, cells: PIECES[t].cells.map(([x, y]) => [x, y]), color: PIECES[t].color, x: 3, y: 0 }
}

function rotate(piece) {
  if (piece.type === 'O') return piece
  const cx = 1.5, cy = 1.5
  const newCells = piece.cells.map(([x, y]) => {
    const dx = x - cx, dy = y - cy
    return [Math.round(cx - dy), Math.round(cy + dx)]
  })
  return { ...piece, cells: newCells }
}

function makeBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null))
}

function collides(board, piece) {
  return piece.cells.some(([cx, cy]) => {
    const x = piece.x + cx
    const y = piece.y + cy
    if (x < 0 || x >= COLS || y >= ROWS) return true
    if (y < 0) return false
    return !!board[y][x]
  })
}

function merge(board, piece) {
  const next = board.map((row) => row.slice())
  piece.cells.forEach(([cx, cy]) => {
    const x = piece.x + cx
    const y = piece.y + cy
    if (y >= 0 && y < ROWS && x >= 0 && x < COLS) next[y][x] = piece.color
  })
  return next
}

function clearLines(board) {
  const kept = board.filter((row) => row.some((c) => !c))
  const cleared = ROWS - kept.length
  while (kept.length < ROWS) kept.unshift(Array(COLS).fill(null))
  return { board: kept, cleared }
}

function TetrisPlay({ mode, onComplete, onExit }) {
  const { lang } = useLang()
  const txt = (ko, en) => (lang === 'ko' ? ko : en)
  const [board, setBoard] = useState(makeBoard)
  const [piece, setPiece] = useState(randPiece)
  const [next, setNext] = useState(randPiece)
  const [score, setScore] = useState(0)
  const [lines, setLines] = useState(0)
  const [level, setLevel] = useState(1)
  const [over, setOver] = useState(false)
  const [paused, setPaused] = useState(false)
  // Per-cell placed time for invisible mode.
  const [placedAt, setPlacedAt] = useState(() => Array.from({ length: ROWS }, () => Array(COLS).fill(0)))
  const [now, setNow] = useState(Date.now())
  const [secsLeft, setSecsLeft] = useState(mode === 'ultra' ? 120 : null)
  const startedAtRef = useRef(Date.now())
  const completedRef = useRef(false)
  const stateRef = useRef({ board, piece, score, lines, level, placedAt })

  useEffect(() => { stateRef.current = { board, piece, score, lines, level, placedAt } })

  // Ultra clock
  useEffect(() => {
    if (mode !== 'ultra' || over || paused) return undefined
    if (secsLeft <= 0) {
      setOver(true)
      return undefined
    }
    const t = setTimeout(() => setSecsLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [mode, secsLeft, over, paused])

  // Sprint check
  useEffect(() => {
    if (mode === 'sprint' && lines >= 40 && !over) setOver(true)
  }, [mode, lines, over])

  // Invisible mode redraw tick
  useEffect(() => {
    if (mode !== 'invisible' || over) return undefined
    const t = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(t)
  }, [mode, over])

  const step = useCallback(() => {
    const { board: b, piece: p, placedAt: pa } = stateRef.current
    const moved = { ...p, y: p.y + 1 }
    if (collides(b, moved)) {
      const merged = merge(b, p)
      const ts = Date.now()
      const nextPlaced = pa.map((row) => row.slice())
      p.cells.forEach(([cx, cy]) => {
        const x = p.x + cx, y = p.y + cy
        if (y >= 0 && y < ROWS && x >= 0 && x < COLS) nextPlaced[y][x] = ts
      })
      const { board: cleared, cleared: lineCount } = clearLines(merged)
      // Mirror line-clears on placedAt
      const clearedPlaced = nextPlaced.filter((_, i) => merged[i].some((c) => !c))
      const clearedPlacedFinal = clearedPlaced
      while (clearedPlacedFinal.length < ROWS) clearedPlacedFinal.unshift(Array(COLS).fill(0))
      const gained = [0, 100, 300, 500, 800][lineCount] || 0
      setBoard(cleared)
      setPlacedAt(clearedPlacedFinal)
      setScore((s) => s + gained + 1)
      setLines((l) => {
        const nl = l + lineCount
        if (mode === 'classic') setLevel(1 + Math.floor(nl / 10))
        return nl
      })
      const fresh = next
      const upcoming = randPiece()
      if (collides(cleared, fresh)) {
        setOver(true)
        return
      }
      setPiece(fresh)
      setNext(upcoming)
    } else {
      setPiece(moved)
    }
  }, [next, mode])

  useEffect(() => {
    if (over || paused) return undefined
    // Sprint mode runs at a fixed faster speed; ultra goes a bit faster too.
    const baseSpeed = mode === 'sprint' ? 350 : mode === 'ultra' ? 400 : 600
    const speed = Math.max(80, baseSpeed - (level - 1) * 60)
    const t = setInterval(step, speed)
    return () => clearInterval(t)
  }, [step, level, over, paused, mode])

  useEffect(() => {
    if (!over || completedRef.current) return
    completedRef.current = true
    const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000)
    if (mode === 'sprint') {
      // Sprint score: faster = higher. Cap at 99999 if didn't finish 40 lines.
      const sprintScore = lines >= 40 ? Math.max(0, 99999 - elapsed * 100) : lines * 50
      onComplete(sprintScore, { mode, elapsed, lines, finished: lines >= 40 })
    } else if (mode === 'ultra') {
      onComplete(score, { mode, elapsed, lines })
    } else {
      onComplete(score, { mode, lines, level, elapsed })
    }
  }, [over])

  const move = (dx) => {
    if (over || paused) return
    setPiece((p) => {
      const moved = { ...p, x: p.x + dx }
      return collides(board, moved) ? p : moved
    })
  }

  const rotatePiece = () => {
    if (over || paused) return
    setPiece((p) => {
      const r = rotate(p)
      if (!collides(board, r)) return r
      for (const dx of [-1, 1, -2, 2]) {
        const shifted = { ...r, x: r.x + dx }
        if (!collides(board, shifted)) return shifted
      }
      return p
    })
  }

  const hardDrop = () => {
    if (over || paused) return
    setPiece((p) => {
      let moved = p
      while (!collides(board, { ...moved, y: moved.y + 1 })) {
        moved = { ...moved, y: moved.y + 1 }
      }
      setScore((s) => s + (moved.y - p.y) * 2)
      return moved
    })
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') { e.preventDefault(); move(-1) }
      else if (e.key === 'ArrowRight' || e.key === 'd') { e.preventDefault(); move(1) }
      else if (e.key === 'ArrowDown' || e.key === 's') { e.preventDefault(); step() }
      else if (e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); rotatePiece() }
      else if (e.key === ' ') { e.preventDefault(); hardDrop() }
      else if (e.key === 'p') { setPaused((p) => !p) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [board, step])

  const view = board.map((row) => row.slice())
  piece.cells.forEach(([cx, cy]) => {
    const x = piece.x + cx, y = piece.y + cy
    if (y >= 0 && y < ROWS && x >= 0 && x < COLS) view[y][x] = piece.color
  })

  return (
    <div className="tetris-game">
      <div className="tetris-board" style={{ gridTemplateColumns: `repeat(${COLS}, 22px)` }}>
        {view.flatMap((row, y) => row.map((cell, x) => {
          let opacity = 1
          if (mode === 'invisible' && cell && placedAt[y][x] > 0) {
            const age = now - placedAt[y][x]
            opacity = age < 1500 ? 1 : Math.max(0.08, 1 - (age - 1500) / 800)
          }
          return (
            <div
              key={`${x}-${y}`}
              className={`t-cell${cell ? ' on' : ''}`}
              style={cell ? { background: cell, opacity } : null}
            />
          )
        }))}
      </div>
      <div className="tetris-side">
        <div className="tetris-stat">
          <span>{MODES[mode]?.[lang === 'ko' ? 'nameKo' : 'name']}</span>
          <strong style={{ fontSize: 13 }}>{txt(MODES[mode]?.descKo, MODES[mode]?.desc)}</strong>
        </div>
        {mode === 'ultra' && (
          <div className="tetris-stat"><span>{txt('남은 시간', 'Time Left')}</span><strong><Clock size={14} /> {secsLeft}s</strong></div>
        )}
        {mode === 'sprint' && (
          <div className="tetris-stat"><span>{txt('남은 줄', 'Lines Left')}</span><strong>{Math.max(0, 40 - lines)}</strong></div>
        )}
        <div className="tetris-stat"><span>{txt('점수', 'Score')}</span><strong>{score}</strong></div>
        <div className="tetris-stat"><span>{txt('줄', 'Lines')}</span><strong>{lines}</strong></div>
        {mode === 'classic' && (
          <div className="tetris-stat"><span>{txt('레벨', 'Level')}</span><strong>{level}</strong></div>
        )}
        <div className="tetris-next">
          <span>{txt('다음', 'Next')}</span>
          <div className="tetris-next-box" style={{ background: next.color + '20', border: `1px solid ${next.color}` }}>
            {next.type}
          </div>
        </div>
        <div className="tetris-controls">
          <div><kbd>←</kbd><kbd>→</kbd> {txt('이동', 'Move')}</div>
          <div><kbd>↑</kbd> {txt('회전', 'Rotate')}</div>
          <div><kbd>↓</kbd> {txt('소프트 드롭', 'Soft drop')}</div>
          <div><kbd>Space</kbd> {txt('하드 드롭', 'Hard drop')}</div>
          <div><kbd>P</kbd> {txt('일시정지', 'Pause')}</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setPaused((p) => !p)}>
          {paused ? txt('계속', 'Resume') : txt('일시정지', 'Pause')}
        </button>
        {!over && (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setOver(true)}>{txt('포기', 'Give up')}</button>
            <button className="btn btn-ghost btn-sm" onClick={onExit}>{txt('모드 바꾸기', 'Change Mode')}</button>
          </>
        )}
      </div>
    </div>
  )
}

export default function TetrisGame({ onComplete }) {
  const { lang } = useLang()
  const txt = (ko, en) => (lang === 'ko' ? ko : en)
  const [mode, setMode] = useState(null)

  if (!mode) {
    return (
      <div className="tetris-mode-select">
        <h2 style={{ margin: 0, fontSize: 18 }}>{txt('테트리스 모드 선택', 'Choose a Tetris mode')}</h2>
        <div className="tetris-mode-grid">
          {Object.entries(MODES).map(([key, info]) => (
            <button key={key} className="tetris-mode-card" onClick={() => setMode(key)}>
              <strong>{lang === 'ko' ? info.nameKo : info.name}</strong>
              <span>{lang === 'ko' ? info.descKo : info.desc}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return <TetrisPlay mode={mode} onComplete={onComplete} onExit={() => setMode(null)} />
}
