import { useEffect, useRef, useState } from 'react'
import { Clock, Flag } from 'lucide-react'
import { useLang } from '../../context/LangContext.jsx'
import api from '../../api.js'

function fmtElapsed(sec) {
  const s = Number(sec) || 0
  if (s <= 0) return null
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`
  const m = Math.floor(s / 60)
  const r = Math.round(s - m * 60)
  return `${m}m ${r.toString().padStart(2, '0')}s`
}

const MODES = {
  easy:   { cols: 9,  rows: 9,  mines: 10, name: 'Easy 9x9',     nameKo: '이지 9x9' },
  medium: { cols: 16, rows: 16, mines: 40, name: 'Medium 16x16', nameKo: '미디엄 16x16' },
  hard:   { cols: 30, rows: 16, mines: 99, name: 'Hard 30x16',   nameKo: '하드 30x16' },
}

function makeBoard(cfg) {
  const { cols, rows, mines } = cfg
  const cells = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({
    mine: false, revealed: false, flagged: false, adj: 0,
  })))
  let placed = 0
  while (placed < mines) {
    const r = Math.floor(Math.random() * rows)
    const c = Math.floor(Math.random() * cols)
    if (!cells[r][c].mine) {
      cells[r][c].mine = true
      placed++
    }
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (cells[r][c].mine) continue
    let n = 0
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr, nc = c + dc
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && cells[nr][nc].mine) n++
    }
    cells[r][c].adj = n
  }
  return cells
}

function flood(board, r, c, cfg) {
  const { rows, cols } = cfg
  const next = board.map((row) => row.map((cell) => ({ ...cell })))
  const stack = [[r, c]]
  while (stack.length) {
    const [cr, cc] = stack.pop()
    if (cr < 0 || cr >= rows || cc < 0 || cc >= cols) continue
    const cell = next[cr][cc]
    if (cell.revealed || cell.flagged || cell.mine) continue
    cell.revealed = true
    if (cell.adj === 0) {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dr || dc) stack.push([cr + dr, cc + dc])
      }
    }
  }
  return next
}

const ADJ_COLORS = ['', '#79c0ff', '#7ee787', '#ff7b72', '#d2a8ff', '#ffa657', '#56d4dd', '#ffd166', '#fff']

function MinesweeperPlay({ mode, onComplete, onExit }) {
  const { lang } = useLang()
  const txt = (ko, en) => (lang === 'ko' ? ko : en)
  const cfg = MODES[mode]
  const [board, setBoard] = useState(() => makeBoard(cfg))
  const [over, setOver] = useState(false)
  const [won, setWon] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const completedRef = useRef(false)
  const startedAtRef = useRef(Date.now())

  useEffect(() => {
    if (over) return undefined
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [over])

  useEffect(() => {
    if (!over || completedRef.current) return
    completedRef.current = true
    const revealed = board.flat().filter((c) => c.revealed).length
    const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000)
    // Score weighting per difficulty so harder modes pay more.
    const weight = mode === 'hard' ? 4 : mode === 'medium' ? 2 : 1
    const baseTime = Math.max(0, 600 - elapsed)
    const score = won
      ? Math.round((1000 + baseTime * 5 + revealed * 5) * weight)
      : Math.round(revealed * 5 * weight)
    onComplete(score, { mode, won, seconds: elapsed, elapsed, revealed })
  }, [over, board, mode, won, onComplete])

  const checkWin = (next) => {
    let safeLeft = 0
    for (let r = 0; r < cfg.rows; r++) for (let c = 0; c < cfg.cols; c++) {
      if (!next[r][c].mine && !next[r][c].revealed) safeLeft++
    }
    if (safeLeft === 0) {
      setWon(true)
      setOver(true)
    }
  }

  const reveal = (r, c) => {
    if (over) return
    const cell = board[r][c]
    if (cell.revealed || cell.flagged) return
    if (cell.mine) {
      const next = board.map((row) => row.map((c2) => ({ ...c2, revealed: c2.mine ? true : c2.revealed })))
      setBoard(next)
      setOver(true)
      return
    }
    const next = flood(board, r, c, cfg)
    setBoard(next)
    checkWin(next)
  }

  const flag = (r, c, e) => {
    e.preventDefault()
    if (over) return
    const next = board.map((row) => row.map((cell) => ({ ...cell })))
    if (next[r][c].revealed) return
    next[r][c].flagged = !next[r][c].flagged
    setBoard(next)
  }

  const flagged = board.flat().filter((c) => c.flagged).length
  const cellSize = mode === 'hard' ? 20 : mode === 'medium' ? 24 : 28

  return (
    <div className="mines-game">
      <div className="mines-bar">
        <div><Flag size={14} /> {flagged} / {cfg.mines}</div>
        <div><Clock size={14} /> {seconds}s</div>
        <div style={{ fontSize: 11, color: 'var(--text2)' }}>{txt(MODES[mode].nameKo, MODES[mode].name)}</div>
        {won && <div className="mines-win">🏆 {txt('승리!', 'You won!')}</div>}
      </div>
      <div className="mines-board" style={{ gridTemplateColumns: `repeat(${cfg.cols}, ${cellSize}px)` }}>
        {board.flatMap((row, r) => row.map((cell, c) => {
          let content = ''
          let cls = 'm-cell'
          if (cell.revealed) {
            cls += ' revealed'
            if (cell.mine) { cls += ' boom'; content = '💣' }
            else if (cell.adj > 0) content = String(cell.adj)
          } else if (cell.flagged) {
            cls += ' flagged'
            content = '🚩'
          }
          return (
            <div
              key={`${r}-${c}`}
              className={cls}
              onClick={() => reveal(r, c)}
              onContextMenu={(e) => flag(r, c, e)}
              style={{
                width: cellSize, height: cellSize, fontSize: Math.max(11, cellSize - 14),
                ...(cell.revealed && cell.adj > 0 && !cell.mine ? { color: ADJ_COLORS[cell.adj] } : null),
              }}
            >{content}</div>
          )
        }))}
      </div>
      <div className="mines-hint">{txt('좌클릭으로 열고, 우클릭으로 깃발', 'Left-click to reveal, right-click to flag')}</div>
      {!over && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setOver(true)}>{txt('포기', 'Give up')}</button>
          <button className="btn btn-ghost btn-sm" onClick={onExit}>{txt('← 모드 변경', '← Change mode')}</button>
        </div>
      )}
    </div>
  )
}

export default function MinesweeperGame({ onComplete }) {
  const { lang } = useLang()
  const txt = (ko, en) => (lang === 'ko' ? ko : en)
  const [mode, setMode] = useState(null)
  const [perMode, setPerMode] = useState(null)

  useEffect(() => {
    if (mode) return undefined
    let cancelled = false
    api.get('/arcade/my-best')
      .then(({ data }) => { if (!cancelled) setPerMode(data?.bestByGameMode?.minesweeper || null) })
      .catch(() => { /* non-fatal */ })
    return () => { cancelled = true }
  }, [mode])

  if (!mode) {
    return (
      <div className="tetris-mode-select">
        <h2 style={{ margin: 0, fontSize: 18 }}>{txt('지뢰찾기 난이도 선택', 'Choose Minesweeper difficulty')}</h2>
        <div className="tetris-mode-grid">
          {Object.entries(MODES).map(([key, info]) => {
            const pb = fmtElapsed(perMode?.[key]?.minElapsed)
            return (
              <button key={key} className="tetris-mode-card" onClick={() => setMode(key)}>
                <span>{txt(info.nameKo, info.name)}</span>
                <strong style={{ fontSize: 12 }}>
                  {info.cols}x{info.rows} · {txt('지뢰', 'Mines')} {info.mines}
                </strong>
                {pb && <span style={{ marginTop: 6, fontSize: 11, color: 'var(--accent)', fontFamily: 'Space Mono, monospace' }}>★ {txt('최단 클리어', 'Best')}: {pb}</span>}
              </button>
            )
          })}
        </div>
      </div>
    )
  }
  return <MinesweeperPlay mode={mode} onComplete={onComplete} onExit={() => setMode(null)} />
}
