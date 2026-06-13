import { useEffect, useRef, useState } from 'react'
import { Clock, Flag } from 'lucide-react'
import { useLang } from '../../context/LangContext.jsx'

const SIZE = 9
const MINES = 10

function makeBoard() {
  const cells = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => ({
    mine: false, revealed: false, flagged: false, adj: 0,
  })))
  let placed = 0
  while (placed < MINES) {
    const r = Math.floor(Math.random() * SIZE)
    const c = Math.floor(Math.random() * SIZE)
    if (!cells[r][c].mine) {
      cells[r][c].mine = true
      placed++
    }
  }
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (cells[r][c].mine) continue
    let n = 0
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr, nc = c + dc
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && cells[nr][nc].mine) n++
    }
    cells[r][c].adj = n
  }
  return cells
}

function flood(board, r, c) {
  const next = board.map((row) => row.map((cell) => ({ ...cell })))
  const stack = [[r, c]]
  while (stack.length) {
    const [cr, cc] = stack.pop()
    if (cr < 0 || cr >= SIZE || cc < 0 || cc >= SIZE) continue
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

export default function MinesweeperGame({ onComplete }) {
  const { lang } = useLang()
  const txt = (ko, en) => (lang === 'ko' ? ko : en)
  const [board, setBoard] = useState(makeBoard)
  const [over, setOver] = useState(false)
  const [won, setWon] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const completedRef = useRef(false)
  const startedRef = useRef(Date.now())

  useEffect(() => {
    if (over) return undefined
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [over])

  useEffect(() => {
    if (!over || completedRef.current) return
    completedRef.current = true
    const revealed = board.flat().filter((c) => c.revealed).length
    const baseTime = Math.max(0, 600 - seconds)
    const score = won ? 1000 + baseTime * 5 + revealed * 5 : revealed * 5
    onComplete(score, { won, seconds, revealed })
  }, [over])

  const checkWin = (next) => {
    let safeLeft = 0
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
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
    const next = flood(board, r, c)
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

  return (
    <div className="mines-game">
      <div className="mines-bar">
        <div><Flag size={14} /> {flagged} / {MINES}</div>
        <div><Clock size={14} /> {seconds}s</div>
        {won && <div className="mines-win">🏆 {txt('승리!', 'You won!')}</div>}
      </div>
      <div className="mines-board" style={{ gridTemplateColumns: `repeat(${SIZE}, 28px)` }}>
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
              style={cell.revealed && cell.adj > 0 && !cell.mine ? { color: ADJ_COLORS[cell.adj] } : null}
            >{content}</div>
          )
        }))}
      </div>
      <div className="mines-hint">{txt('좌클릭으로 열고, 우클릭으로 깃발', 'Left-click to reveal, right-click to flag')}</div>
      {!over && (
        <button className="btn btn-ghost btn-sm" onClick={() => setOver(true)}>{txt('포기', 'Give up')}</button>
      )}
    </div>
  )
}
