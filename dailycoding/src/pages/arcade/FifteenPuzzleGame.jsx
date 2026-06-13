import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { useLang } from '../../context/LangContext.jsx'

const SIZE = 4

function solvedBoard() {
  const out = []
  for (let i = 1; i < SIZE * SIZE; i++) out.push(i)
  out.push(0)
  return out
}

function findEmpty(board) {
  return board.indexOf(0)
}

function neighbors(idx) {
  const r = Math.floor(idx / SIZE)
  const c = idx % SIZE
  const out = []
  if (r > 0) out.push(idx - SIZE)
  if (r < SIZE - 1) out.push(idx + SIZE)
  if (c > 0) out.push(idx - 1)
  if (c < SIZE - 1) out.push(idx + 1)
  return out
}

function shuffleBoard() {
  // 200 random swaps from solved state to guarantee solvability.
  const board = solvedBoard()
  let empty = findEmpty(board)
  for (let i = 0; i < 200; i++) {
    const choices = neighbors(empty)
    const pick = choices[Math.floor(Math.random() * choices.length)]
    ;[board[empty], board[pick]] = [board[pick], board[empty]]
    empty = pick
  }
  return board
}

function isSolved(board) {
  for (let i = 0; i < SIZE * SIZE - 1; i++) {
    if (board[i] !== i + 1) return false
  }
  return true
}

export default function FifteenPuzzleGame({ onComplete }) {
  const { lang } = useLang()
  const txt = (ko, en) => (lang === 'ko' ? ko : en)
  const [board, setBoard] = useState(shuffleBoard)
  const [moves, setMoves] = useState(0)
  const [secs, setSecs] = useState(0)
  const [done, setDone] = useState(false)
  const completedRef = useRef(false)

  useEffect(() => {
    if (done) return undefined
    const t = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [done])

  useEffect(() => {
    if (!done && isSolved(board)) setDone(true)
  }, [board, done])

  useEffect(() => {
    if (!done || completedRef.current) return
    completedRef.current = true
    // Score = faster + fewer moves = higher.
    const score = Math.max(0, 8000 - moves * 25 - secs * 10)
    onComplete(score, { moves, seconds: secs })
  }, [done])

  const tryMove = (idx) => {
    if (done) return
    const empty = findEmpty(board)
    if (!neighbors(empty).includes(idx)) return
    const next = board.slice()
    ;[next[empty], next[idx]] = [next[idx], next[empty]]
    setBoard(next)
    setMoves((m) => m + 1)
  }

  useEffect(() => {
    const onKey = (e) => {
      const empty = findEmpty(board)
      const r = Math.floor(empty / SIZE)
      const c = empty % SIZE
      let target = -1
      // Arrow direction = the direction the tile slides into the empty slot.
      if (e.key === 'ArrowUp' && r < SIZE - 1) target = empty + SIZE
      else if (e.key === 'ArrowDown' && r > 0) target = empty - SIZE
      else if (e.key === 'ArrowLeft' && c < SIZE - 1) target = empty + 1
      else if (e.key === 'ArrowRight' && c > 0) target = empty - 1
      if (target >= 0) {
        e.preventDefault()
        tryMove(target)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [board])

  return (
    <div className="fifteen-game">
      <div className="quiz-bar">
        <div className="quiz-progress">
          <span>{txt('남은 타일', 'Tiles left')}: {board.filter((v, i) => v !== 0 && v !== i + 1).length}</span>
          <div className="quiz-progress-bar">
            <span style={{ width: `${((SIZE * SIZE - 1 - board.filter((v, i) => v !== 0 && v !== i + 1).length) / (SIZE * SIZE - 1)) * 100}%` }} />
          </div>
        </div>
        <div className="quiz-timer"><Clock size={14} /> {secs}s</div>
        <div className="quiz-streak">{txt('이동', 'Moves')}: {moves}</div>
      </div>
      <div className="fifteen-board">
        {board.map((v, i) => (
          <button
            key={i}
            className={`fifteen-tile${v === 0 ? ' empty' : ''}${v !== 0 && v === i + 1 ? ' settled' : ''}`}
            onClick={() => tryMove(i)}
            disabled={v === 0}
          >{v || ''}</button>
        ))}
      </div>
      <div className="memory-hint">{txt('숫자를 1~15 순서로 정렬하세요. 빈 칸 옆 타일만 움직입니다. 화살표 키로 슬라이드.', 'Sort 1-15 in order. Only tiles next to the gap can move. Arrow keys slide.')}</div>
    </div>
  )
}
