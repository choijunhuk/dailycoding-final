import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

function shuffleBag() {
  const bag = TYPES.slice()
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[bag[i], bag[j]] = [bag[j], bag[i]]
  }
  return bag
}

function pieceFromType(t) {
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

function findClearedRows(board) {
  const rows = []
  for (let y = 0; y < ROWS; y++) if (board[y].every((c) => c)) rows.push(y)
  return rows
}

function collapseRows(board, placedAt, clearedRows) {
  const keep = board.filter((_, i) => !clearedRows.includes(i))
  const keepPlaced = placedAt.filter((_, i) => !clearedRows.includes(i))
  while (keep.length < ROWS) {
    keep.unshift(Array(COLS).fill(null))
    keepPlaced.unshift(Array(COLS).fill(0))
  }
  return { board: keep, placedAt: keepPlaced }
}

function ghostPiece(board, piece) {
  let g = { ...piece, cells: piece.cells.map((c) => c.slice()) }
  while (!collides(board, { ...g, y: g.y + 1 })) g = { ...g, y: g.y + 1 }
  return g
}

function MiniPiece({ type, label, dim }) {
  if (!type) {
    return (
      <div className="tetris-mini" data-empty>
        {label && <span>{label}</span>}
        <div className="tetris-mini-box" />
      </div>
    )
  }
  const { color, cells } = PIECES[type]
  const minX = Math.min(...cells.map((c) => c[0]))
  const maxX = Math.max(...cells.map((c) => c[0]))
  const minY = Math.min(...cells.map((c) => c[1]))
  const maxY = Math.max(...cells.map((c) => c[1]))
  const w = maxX - minX + 1
  const h = maxY - minY + 1
  return (
    <div className="tetris-mini">
      {label && <span>{label}</span>}
      <div
        className={`tetris-mini-box${dim ? ' dim' : ''}`}
        style={{ background: color + '18', border: `1px solid ${color}55` }}
      >
        <div className="tetris-mini-grid" style={{ gridTemplateColumns: `repeat(${w}, 12px)`, gridTemplateRows: `repeat(${h}, 12px)` }}>
          {Array.from({ length: w * h }).map((_, i) => {
            const x = i % w + minX
            const y = Math.floor(i / w) + minY
            const filled = cells.some(([cx, cy]) => cx === x && cy === y)
            return <div key={i} className="tetris-mini-cell" style={filled ? { background: color, boxShadow: `0 0 6px ${color}88` } : null} />
          })}
        </div>
      </div>
    </div>
  )
}

function TetrisPlay({ mode, onComplete, onExit }) {
  const { lang } = useLang()
  const txt = (ko, en) => (lang === 'ko' ? ko : en)

  // 7-bag randomizer for fairer distribution
  const bagRef = useRef(shuffleBag())
  const pullPiece = useCallback(() => {
    if (bagRef.current.length === 0) bagRef.current = shuffleBag()
    return bagRef.current.shift()
  }, [])

  const [board, setBoard] = useState(makeBoard)
  const [piece, setPiece] = useState(() => pieceFromType(pullPiece()))
  const [queue, setQueue] = useState(() => [pullPiece(), pullPiece(), pullPiece()])
  const [held, setHeld] = useState(null)
  const canHoldRef = useRef(true)

  const [score, setScore] = useState(0)
  const [lines, setLines] = useState(0)
  const [level, setLevel] = useState(1)
  const [over, setOver] = useState(false)
  const [paused, setPaused] = useState(false)
  const [placedAt, setPlacedAt] = useState(() => Array.from({ length: ROWS }, () => Array(COLS).fill(0)))
  const [now, setNow] = useState(Date.now())
  const [secsLeft, setSecsLeft] = useState(mode === 'ultra' ? 120 : null)

  // Visual FX state
  const [flashRows, setFlashRows] = useState([])
  const [floats, setFloats] = useState([])
  const [combo, setCombo] = useState(0)
  const [shake, setShake] = useState(0)

  const startedAtRef = useRef(Date.now())
  const completedRef = useRef(false)
  const floatIdRef = useRef(0)
  const stateRef = useRef({ board, piece, score, lines, level, placedAt })
  useEffect(() => { stateRef.current = { board, piece, score, lines, level, placedAt } })

  const pushFloat = useCallback((text, color = '#79c0ff') => {
    const id = ++floatIdRef.current
    setFloats((f) => [...f, { id, text, color }])
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1100)
  }, [])

  // Ultra clock
  useEffect(() => {
    if (mode !== 'ultra' || over || paused) return undefined
    if (secsLeft <= 0) { setOver(true); return undefined }
    const t = setTimeout(() => setSecsLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [mode, secsLeft, over, paused])

  useEffect(() => {
    if (mode === 'sprint' && lines >= 40 && !over) setOver(true)
  }, [mode, lines, over])

  useEffect(() => {
    if (mode !== 'invisible' || over) return undefined
    const t = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(t)
  }, [mode, over])

  const lockAndAdvance = useCallback((board, piece, placedAt) => {
    const ts = Date.now()
    const merged = merge(board, piece)
    const nextPlaced = placedAt.map((row) => row.slice())
    piece.cells.forEach(([cx, cy]) => {
      const x = piece.x + cx, y = piece.y + cy
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) nextPlaced[y][x] = ts
    })
    const cleared = findClearedRows(merged)
    if (cleared.length > 0) {
      setFlashRows(cleared)
      setShake(cleared.length >= 4 ? 14 : 6)
      setTimeout(() => setShake(0), 240)
      const newCombo = combo + 1
      setCombo(newCombo)
      const base = [0, 100, 300, 500, 800][cleared.length] || 0
      const comboBonus = newCombo > 1 ? (newCombo - 1) * 50 : 0
      const gained = base + comboBonus
      if (cleared.length === 4) pushFloat(txt('테트리스!', 'TETRIS!'), '#d2a8ff')
      else if (cleared.length > 0) pushFloat(`+${gained}`, '#7ee787')
      if (newCombo >= 2) pushFloat(`${newCombo}× COMBO`, '#ffd166')

      // Delay collapse so flash is visible
      setTimeout(() => {
        const { board: collapsed, placedAt: collapsedPlaced } = collapseRows(merged, nextPlaced, cleared)
        setBoard(collapsed)
        setPlacedAt(collapsedPlaced)
        setFlashRows([])
      }, 220)

      setScore((s) => s + gained + 1)
      setLines((l) => {
        const nl = l + cleared.length
        if (mode === 'classic' && Math.floor(nl / 10) > Math.floor(l / 10)) {
          pushFloat(txt(`LEVEL ${1 + Math.floor(nl / 10)}!`, `LEVEL ${1 + Math.floor(nl / 10)}!`), '#79c0ff')
          setLevel(1 + Math.floor(nl / 10))
        }
        return nl
      })
    } else {
      setCombo(0)
      setBoard(merged)
      setPlacedAt(nextPlaced)
      setScore((s) => s + 1)
    }

    // Spawn next from queue
    setQueue((q) => {
      const nextType = q[0]
      const fresh = pieceFromType(nextType)
      const after = [...q.slice(1), pullPiece()]
      // Check spawn collision against latest board (post-collapse handled async)
      // For game-over check we test against current merged (not yet collapsed) — safe approximation
      if (collides(merged, fresh)) {
        setOver(true)
      } else {
        setPiece(fresh)
        canHoldRef.current = true
      }
      return after
    })
  }, [combo, mode, pullPiece, pushFloat, txt])

  const step = useCallback(() => {
    const { board: b, piece: p, placedAt: pa } = stateRef.current
    const moved = { ...p, y: p.y + 1 }
    if (collides(b, moved)) {
      lockAndAdvance(b, p, pa)
    } else {
      setPiece(moved)
    }
  }, [lockAndAdvance])

  useEffect(() => {
    if (over || paused || flashRows.length > 0) return undefined
    const baseSpeed = mode === 'sprint' ? 350 : mode === 'ultra' ? 400 : 600
    const speed = Math.max(80, baseSpeed - (level - 1) * 60)
    const t = setInterval(step, speed)
    return () => clearInterval(t)
  }, [step, level, over, paused, mode, flashRows])

  useEffect(() => {
    if (!over || completedRef.current) return
    completedRef.current = true
    const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000)
    if (mode === 'sprint') {
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
    const { board: b, piece: p, placedAt: pa } = stateRef.current
    let moved = p
    while (!collides(b, { ...moved, y: moved.y + 1 })) moved = { ...moved, y: moved.y + 1 }
    setScore((s) => s + (moved.y - p.y) * 2)
    setShake(4)
    setTimeout(() => setShake(0), 120)
    lockAndAdvance(b, moved, pa)
  }

  const doHold = () => {
    if (over || paused || !canHoldRef.current) return
    canHoldRef.current = false
    setPiece((p) => {
      if (!held) {
        setHeld(p.type)
        // Spawn next from queue
        setQueue((q) => {
          const fresh = pieceFromType(q[0])
          if (collides(board, fresh)) { setOver(true); return q }
          // Pull a new tail from bag
          setTimeout(() => setQueue((q2) => q2.length === q.length ? [...q2.slice(1), pullPiece()] : q2), 0)
          setPiece(fresh)
          return q
        })
        return p
      }
      const fresh = pieceFromType(held)
      setHeld(p.type)
      if (collides(board, fresh)) { setOver(true); return p }
      return fresh
    })
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') { e.preventDefault(); move(-1) }
      else if (e.key === 'ArrowRight' || e.key === 'd') { e.preventDefault(); move(1) }
      else if (e.key === 'ArrowDown' || e.key === 's') { e.preventDefault(); step() }
      else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'x') { e.preventDefault(); rotatePiece() }
      else if (e.key === ' ') { e.preventDefault(); hardDrop() }
      else if (e.key === 'p') { setPaused((pp) => !pp) }
      else if (e.key === 'c' || e.key === 'C' || e.key === 'Shift') { e.preventDefault(); doHold() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [board, step, held])

  // Build visible board: base + ghost + piece + flash overlay
  const ghost = useMemo(() => ghostPiece(board, piece), [board, piece])
  const ghostSet = useMemo(() => {
    const s = new Set()
    ghost.cells.forEach(([cx, cy]) => {
      const x = ghost.x + cx, y = ghost.y + cy
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS && !board[y][x]) s.add(`${x},${y}`)
    })
    return s
  }, [ghost, board])

  const view = board.map((row) => row.slice())
  piece.cells.forEach(([cx, cy]) => {
    const x = piece.x + cx, y = piece.y + cy
    if (y >= 0 && y < ROWS && x >= 0 && x < COLS) view[y][x] = piece.color
  })

  return (
    <div className="tetris-game">
      <div className="tetris-side tetris-side-left">
        <MiniPiece type={held} label={txt('보관 (C)', 'Hold (C)')} dim={!canHoldRef.current} />
        <div className="tetris-controls">
          <div><kbd>C</kbd> {txt('보관', 'Hold')}</div>
          <div><kbd>←</kbd><kbd>→</kbd> {txt('이동', 'Move')}</div>
          <div><kbd>↑</kbd> {txt('회전', 'Rotate')}</div>
          <div><kbd>↓</kbd> {txt('소프트 드롭', 'Soft drop')}</div>
          <div><kbd>Space</kbd> {txt('하드 드롭', 'Hard drop')}</div>
          <div><kbd>P</kbd> {txt('일시정지', 'Pause')}</div>
        </div>
      </div>

      <div className="tetris-board-wrap" style={shake ? { transform: `translate(${(Math.random() - 0.5) * shake}px, ${(Math.random() - 0.5) * shake}px)` } : null}>
        <div className="tetris-board" style={{ gridTemplateColumns: `repeat(${COLS}, 22px)` }}>
          {view.flatMap((row, y) => row.map((cell, x) => {
            let opacity = 1
            if (mode === 'invisible' && cell && placedAt[y][x] > 0) {
              const age = now - placedAt[y][x]
              opacity = age < 1500 ? 1 : Math.max(0.08, 1 - (age - 1500) / 800)
            }
            const isGhost = !cell && ghostSet.has(`${x},${y}`)
            const isFlash = flashRows.includes(y)
            const classes = ['t-cell']
            if (cell) classes.push('on')
            if (isGhost) classes.push('ghost')
            if (isFlash) classes.push('flash')
            return (
              <div
                key={`${x}-${y}`}
                className={classes.join(' ')}
                style={cell ? { background: cell, opacity, boxShadow: `inset 0 0 0 1px rgba(255,255,255,.2), 0 0 6px ${cell}66` } : isGhost ? { border: `1px dashed ${piece.color}99`, background: piece.color + '18' } : null}
              />
            )
          }))}
        </div>
        <div className="tetris-floats">
          {floats.map((f, idx) => (
            <div key={f.id} className="tetris-float" style={{ color: f.color, top: `${40 + idx * 28}px`, textShadow: `0 0 8px ${f.color}` }}>{f.text}</div>
          ))}
        </div>
        {paused && <div className="tetris-pause-overlay">{txt('일시정지', 'PAUSED')}</div>}
        {over && (
          <div className="tetris-pause-overlay over">{txt('게임 종료', 'GAME OVER')}</div>
        )}
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
        {combo > 1 && (
          <div className="tetris-stat combo-stat"><span>COMBO</span><strong>{combo}×</strong></div>
        )}

        <div className="tetris-queue">
          <span>{txt('다음', 'Next')}</span>
          <div className="tetris-queue-list">
            {queue.map((t, i) => (
              <MiniPiece key={i} type={t} />
            ))}
          </div>
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
