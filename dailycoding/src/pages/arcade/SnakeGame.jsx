import { useCallback, useEffect, useRef, useState } from 'react'
import { useLang } from '../../context/LangContext.jsx'

const COLS = 20
const ROWS = 20

function randomFood(snake) {
  const occupied = new Set(snake.map((cell) => `${cell.x}:${cell.y}`))
  const availableCells = []
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!occupied.has(`${x}:${y}`)) availableCells.push({ x, y })
    }
  }
  if (availableCells.length === 0) return snake[0] || { x: 0, y: 0 }
  return availableCells[Math.floor(Math.random() * availableCells.length)]
}

const DIRS = {
  h: { dx: -1, dy: 0 }, // left
  l: { dx: 1, dy: 0 },  // right
  k: { dx: 0, dy: -1 }, // up
  j: { dx: 0, dy: 1 },  // down
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
}

export default function SnakeGame({ onComplete }) {
  const { lang } = useLang()
  const txt = (ko, en) => (lang === 'ko' ? ko : en)
  const initial = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]
  const [snake, setSnake] = useState(initial)
  const [dir, setDir] = useState({ dx: 1, dy: 0 })
  const [food, setFood] = useState(() => randomFood(initial))
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(false)
  const dirRef = useRef(dir)
  // Buffered direction queue — applied one per tick. Prevents fast L→D after R from
  // collapsing into a 180° kill (only the last input wins per tick today).
  const queueRef = useRef([])
  const completedRef = useRef(false)

  useEffect(() => { dirRef.current = dir }, [dir])

  const tick = useCallback(() => {
    // Apply the next buffered direction (already opposite-checked at enqueue)
    if (queueRef.current.length > 0) {
      const nextDir = queueRef.current.shift()
      dirRef.current = nextDir
      setDir(nextDir)
    }
    setSnake((s) => {
      const head = { x: s[0].x + dirRef.current.dx, y: s[0].y + dirRef.current.dy }
      if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
        setOver(true)
        return s
      }
      if (s.some((c, i) => i > 0 && c.x === head.x && c.y === head.y)) {
        setOver(true)
        return s
      }
      const ate = head.x === food.x && head.y === food.y
      const next = ate ? [head, ...s] : [head, ...s.slice(0, -1)]
      if (ate) {
        setScore((sc) => sc + 10)
        setFood(randomFood(next))
      }
      return next
    })
  }, [food])

  useEffect(() => {
    if (over) return undefined
    const speed = Math.max(70, 180 - Math.floor(score / 30) * 10)
    const t = setInterval(tick, speed)
    return () => clearInterval(t)
  }, [tick, over, score])

  useEffect(() => {
    if (!over || completedRef.current) return
    completedRef.current = true
    onComplete(score, { length: snake.length })
  }, [over])

  useEffect(() => {
    const onKey = (e) => {
      const d = DIRS[e.key]
      if (!d) return
      e.preventDefault()
      // Compare against the latest queued direction (or current if queue empty)
      // so the player can chain 2 quick perpendicular inputs without losing one.
      const last = queueRef.current.length > 0
        ? queueRef.current[queueRef.current.length - 1]
        : dirRef.current
      // Prevent reversing into self.
      if (last.dx === -d.dx && last.dy === -d.dy) return
      // Ignore duplicate same-direction repeats — they waste a queue slot.
      if (last.dx === d.dx && last.dy === d.dy) return
      // Buffer at most 2 inputs ahead; drop overflow to keep responsive feel.
      if (queueRef.current.length >= 2) return
      queueRef.current.push(d)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const cells = []
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      let cls = 's-cell'
      const isHead = snake[0].x === x && snake[0].y === y
      const isBody = !isHead && snake.some((c) => c.x === x && c.y === y)
      const isFood = food.x === x && food.y === y
      if (isHead) cls += ' head'
      else if (isBody) cls += ' body'
      else if (isFood) cls += ' food'
      cells.push(<div key={`${x}-${y}`} className={cls}>{isFood ? ';' : ''}</div>)
    }
  }

  return (
    <div className="snake-game">
      <div className="snake-board" style={{ gridTemplateColumns: `repeat(${COLS}, 18px)` }}>
        {cells}
      </div>
      <div className="snake-side">
        <div className="tetris-stat"><span>{txt('점수', 'Score')}</span><strong>{score}</strong></div>
        <div className="tetris-stat"><span>{txt('길이', 'Length')}</span><strong>{snake.length}</strong></div>
        <div className="tetris-controls">
          <div><kbd>h</kbd><kbd>j</kbd><kbd>k</kbd><kbd>l</kbd> {txt('또는 화살표', 'or arrows')}</div>
          <div>{txt('세미콜론 먹기. 벽과 자기 몸 피하기.', 'Eat the semicolon. Avoid walls and your tail.')}</div>
        </div>
        {!over && (
          <button className="btn btn-ghost btn-sm" onClick={() => setOver(true)}>{txt('포기', 'Give up')}</button>
        )}
      </div>
    </div>
  )
}
