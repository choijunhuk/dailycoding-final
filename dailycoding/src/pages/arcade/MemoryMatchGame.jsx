import { useEffect, useMemo, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { useLang } from '../../context/LangContext.jsx'

const PAIRS = [
  { name: 'Binary Search',      symbol: 'O(log n)' },
  { name: 'Linear Scan',        symbol: 'O(n)' },
  { name: 'Nested Loop',        symbol: 'O(n²)' },
  { name: 'Merge Sort',         symbol: 'O(n log n)' },
  { name: 'Fibonacci (naive)',  symbol: 'O(2ⁿ)' },
  { name: 'Hashtable Lookup',   symbol: 'O(1)' },
  { name: 'Permutations',       symbol: 'O(n!)' },
  { name: 'Square Root Loop',   symbol: 'O(√n)' },
]

function shuffle(arr) {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export default function MemoryMatchGame({ onComplete }) {
  const { lang } = useLang()
  const txt = (ko, en) => (lang === 'ko' ? ko : en)
  const cards = useMemo(() => {
    const all = PAIRS.flatMap((p, i) => [
      { id: `n${i}`, pairId: i, label: p.name, kind: 'name' },
      { id: `s${i}`, pairId: i, label: p.symbol, kind: 'symbol' },
    ])
    return shuffle(all)
  }, [])
  const [flipped, setFlipped] = useState([]) // indices currently flipped face-up
  const [matched, setMatched] = useState(new Set())
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
    if (matched.size === cards.length && !done) {
      setDone(true)
    }
  }, [matched, cards.length, done])

  useEffect(() => {
    if (!done || completedRef.current) return
    completedRef.current = true
    // Lower moves & seconds → higher score.
    const score = Math.max(0, 5000 - secs * 30 - (moves - cards.length / 2) * 40)
    onComplete(score, { moves, seconds: secs, pairs: cards.length / 2 })
  }, [done])

  const handleFlip = (i) => {
    if (done) return
    if (flipped.includes(i) || matched.has(i)) return
    if (flipped.length === 2) return
    const next = [...flipped, i]
    setFlipped(next)
    if (next.length === 2) {
      setMoves((m) => m + 1)
      const [a, b] = next
      if (cards[a].pairId === cards[b].pairId && cards[a].kind !== cards[b].kind) {
        // Match
        setTimeout(() => {
          setMatched((m) => new Set([...m, a, b]))
          setFlipped([])
        }, 400)
      } else {
        setTimeout(() => setFlipped([]), 900)
      }
    }
  }

  return (
    <div className="memory-game">
      <div className="quiz-bar">
        <div className="quiz-progress">
          <span>{matched.size / 2} / {cards.length / 2} {txt('쌍 맞춤', 'pairs')}</span>
          <div className="quiz-progress-bar">
            <span style={{ width: `${(matched.size / cards.length) * 100}%` }} />
          </div>
        </div>
        <div className="quiz-timer"><Clock size={14} /> {secs}s</div>
        <div className="quiz-streak">{txt('이동', 'Moves')}: {moves}</div>
      </div>
      <div className="memory-board">
        {cards.map((card, i) => {
          const faceUp = flipped.includes(i) || matched.has(i)
          return (
            <button
              key={card.id}
              className={`memory-card${faceUp ? ' face-up' : ''}${matched.has(i) ? ' matched' : ''}`}
              onClick={() => handleFlip(i)}
            >
              <span className="memory-card-inner">
                {faceUp ? card.label : '?'}
              </span>
            </button>
          )
        })}
      </div>
      <div className="memory-hint">{txt('알고리즘 이름과 복잡도를 짝지으세요.', 'Match algorithm names with their complexities.')}</div>
    </div>
  )
}
