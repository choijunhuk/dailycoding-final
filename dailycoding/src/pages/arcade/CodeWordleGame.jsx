import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../context/LangContext.jsx'

const WORDS = [
  'ARRAY', 'CACHE', 'CLASS', 'CONST', 'FETCH', 'INDEX', 'INPUT', 'MERGE', 'NULLS',
  'PARSE', 'QUEUE', 'STACK', 'TUPLE', 'TYPES', 'YIELD', 'BUILD', 'PIXEL', 'BYTES',
  'LOGIC', 'TOKEN', 'BLOCK', 'PROXY', 'SCOPE', 'FRAME', 'MODEL', 'ROUTE', 'AGENT',
  'FLAGS', 'STATE', 'POPUP', 'CLOCK', 'COUNT', 'REDIS', 'GROUP', 'GRAPH', 'NODES',
]

const MAX_GUESSES = 6

function pickWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)]
}

// Returns per-letter status: 'correct' | 'present' | 'absent'
function scoreGuess(guess, target) {
  const result = Array(5).fill('absent')
  const counts = {}
  for (const ch of target) counts[ch] = (counts[ch] || 0) + 1
  for (let i = 0; i < 5; i++) {
    if (guess[i] === target[i]) {
      result[i] = 'correct'
      counts[guess[i]]--
    }
  }
  for (let i = 0; i < 5; i++) {
    if (result[i] === 'correct') continue
    if (counts[guess[i]] > 0) {
      result[i] = 'present'
      counts[guess[i]]--
    }
  }
  return result
}

const KEYS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']

export default function CodeWordleGame({ onComplete }) {
  const { lang } = useLang()
  const txt = (ko, en) => (lang === 'ko' ? ko : en)
  const [target] = useState(pickWord)
  const [guesses, setGuesses] = useState([]) // array of {word, result}
  const [current, setCurrent] = useState('')
  const [done, setDone] = useState(false)
  const [won, setWon] = useState(false)
  const [shake, setShake] = useState(false)
  const completedRef = useRef(false)
  const wordSet = useRef(new Set(WORDS))

  useEffect(() => {
    if (!done || completedRef.current) return
    completedRef.current = true
    const remainingGuesses = MAX_GUESSES - guesses.length
    const score = won ? 500 + remainingGuesses * 200 : 0
    onComplete(score, { target, guesses: guesses.length, won })
  }, [done])

  const submit = (word) => {
    if (done) return
    if (word.length !== 5) {
      setShake(true)
      setTimeout(() => setShake(false), 400)
      return
    }
    if (!wordSet.current.has(word)) {
      setShake(true)
      setTimeout(() => setShake(false), 400)
      return
    }
    const result = scoreGuess(word, target)
    const nextGuesses = [...guesses, { word, result }]
    setGuesses(nextGuesses)
    setCurrent('')
    if (word === target) {
      setWon(true)
      setDone(true)
    } else if (nextGuesses.length >= MAX_GUESSES) {
      setDone(true)
    }
  }

  const press = (key) => {
    if (done) return
    if (key === 'ENTER') {
      submit(current)
    } else if (key === 'BACK') {
      setCurrent((c) => c.slice(0, -1))
    } else if (/^[A-Z]$/.test(key) && current.length < 5) {
      setCurrent((c) => c + key)
    }
  }

  useEffect(() => {
    const onKey = (e) => {
      if (done) return
      if (e.key === 'Enter') { e.preventDefault(); press('ENTER') }
      else if (e.key === 'Backspace') { e.preventDefault(); press('BACK') }
      else if (/^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); press(e.key.toUpperCase()) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, done])

  // Compute per-key best status across all guesses for keyboard tint.
  const keyStatus = {}
  guesses.forEach(({ word, result }) => {
    for (let i = 0; i < 5; i++) {
      const ch = word[i]
      const prev = keyStatus[ch]
      const next = result[i]
      const rank = { absent: 0, present: 1, correct: 2 }
      if (!prev || rank[next] > rank[prev]) keyStatus[ch] = next
    }
  })

  const rows = []
  for (let r = 0; r < MAX_GUESSES; r++) {
    if (r < guesses.length) {
      rows.push({ word: guesses[r].word, result: guesses[r].result, kind: 'past' })
    } else if (r === guesses.length && !done) {
      rows.push({ word: current.padEnd(5, ' '), result: null, kind: 'current' })
    } else {
      rows.push({ word: '     ', result: null, kind: 'empty' })
    }
  }

  return (
    <div className="wordle-game">
      <div className={`wordle-grid${shake ? ' shake' : ''}`}>
        {rows.map((row, ri) => (
          <div key={ri} className="wordle-row">
            {row.word.split('').map((ch, ci) => {
              let cls = 'wordle-tile'
              if (row.kind === 'past' && row.result) cls += ` ${row.result[ci]}`
              else if (row.kind === 'current' && ch !== ' ') cls += ' filled'
              return <div key={ci} className={cls}>{ch !== ' ' ? ch : ''}</div>
            })}
          </div>
        ))}
      </div>
      {done && (
        <div className={`wordle-status ${won ? 'win' : 'lose'}`}>
          {won
            ? txt(`정답! 단어는 ${target}`, `Solved! Word was ${target}`)
            : txt(`정답: ${target}`, `Answer: ${target}`)}
        </div>
      )}
      <div className="wordle-keyboard">
        {KEYS.map((row, ri) => (
          <div key={ri} className="wordle-keyrow">
            {ri === 2 && <button className="wordle-key wide" onClick={() => press('ENTER')}>Enter</button>}
            {row.split('').map((k) => (
              <button
                key={k}
                className={`wordle-key${keyStatus[k] ? ` ${keyStatus[k]}` : ''}`}
                onClick={() => press(k)}
              >{k}</button>
            ))}
            {ri === 2 && <button className="wordle-key wide" onClick={() => press('BACK')}>⌫</button>}
          </div>
        ))}
      </div>
      <div className="memory-hint">{txt('5글자 코딩 용어를 6번 안에 맞추세요. 초록=정답 위치, 노랑=다른 위치.', 'Guess the 5-letter coding word in 6 tries. Green = correct spot, yellow = wrong spot.')}</div>
    </div>
  )
}
