import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { useLang } from '../../context/LangContext.jsx'
import { TYPING_SNIPPETS } from './arcadeData.js'

const ROUND_SECS = 60

function pickSnippet() {
  return TYPING_SNIPPETS[Math.floor(Math.random() * TYPING_SNIPPETS.length)]
}

export default function CodeTypingGame({ onComplete }) {
  const { lang } = useLang()
  const txt = (ko, en) => (lang === 'ko' ? ko : en)
  const [target, setTarget] = useState(() => pickSnippet())
  const [typed, setTyped] = useState('')
  const [started, setStarted] = useState(false)
  const [timeLeft, setTimeLeft] = useState(ROUND_SECS)
  const [cumulativeCorrect, setCumulativeCorrect] = useState(0)
  const [errors, setErrors] = useState(0)
  const startedAtRef = useRef(0)
  const finalizedRef = useRef(false)
  const stateRef = useRef({ cumulativeCorrect: 0, currentCorrect: 0, errors: 0 })

  // Keep ref synced so the timeout finalize sees fresh values.
  useEffect(() => {
    const currentCorrect = computeMatching(target, typed)
    stateRef.current = { cumulativeCorrect, currentCorrect, errors }
  })

  const finalize = () => {
    if (finalizedRef.current) return
    finalizedRef.current = true
    const { cumulativeCorrect: cum, currentCorrect: cur, errors: err } = stateRef.current
    const totalCorrect = cum + cur
    const elapsed = Math.max(0.5, (Date.now() - startedAtRef.current) / 1000)
    const minutes = elapsed / 60
    const wpm = Math.round((totalCorrect / 5) / minutes)
    const charsTried = totalCorrect + err
    const accuracyPct = charsTried === 0 ? 100 : Math.round((totalCorrect / charsTried) * 100)
    const score = Math.max(0, Math.round(totalCorrect * (accuracyPct / 100)) - err * 2)
    onComplete(score, { wpm, accuracyPct, correctChars: totalCorrect, errors: err, elapsed: Math.round(elapsed) })
  }

  useEffect(() => {
    if (!started || finalizedRef.current) return undefined
    if (timeLeft <= 0) {
      finalize()
      return undefined
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [started, timeLeft])

  const computeMatching = (tgt, val) => {
    let i = 0
    while (i < val.length && i < tgt.length && val[i] === tgt[i]) i++
    return i
  }

  const handleInput = (e) => {
    if (finalizedRef.current) return
    const val = e.target.value
    if (!started) {
      setStarted(true)
      startedAtRef.current = Date.now()
    }
    const matching = computeMatching(target, val)
    // New error = first time the user pushes a wrong char (val length grows beyond matching).
    if (val.length > matching && val.length > typed.length) {
      setErrors((n) => n + 1)
    }
    setTyped(val)

    if (matching >= target.length) {
      // Completed this snippet — bank the chars, load the next one.
      setCumulativeCorrect((c) => c + matching)
      setTarget(pickSnippet())
      setTyped('')
    }
  }

  const currentCorrect = computeMatching(target, typed)
  const totalCorrect = cumulativeCorrect + currentCorrect
  const liveWpm = started
    ? Math.round((totalCorrect / 5) / Math.max(0.05, (Date.now() - startedAtRef.current) / 60000))
    : 0

  return (
    <div className="typing-game">
      <div className="quiz-bar">
        <div className="quiz-progress">
          <span>WPM: {liveWpm}</span>
          <div className="quiz-progress-bar">
            <span style={{ width: `${(typed.length / target.length) * 100}%` }} />
          </div>
        </div>
        <div className="quiz-timer"><Clock size={14} /> {timeLeft}s</div>
        <div className="quiz-streak">✓ {totalCorrect} ✗ {errors}</div>
      </div>

      <pre className="typing-target">
        {target.split('').map((ch, i) => {
          let cls = 'tch'
          if (i < typed.length) cls += typed[i] === ch ? ' ok' : ' bad'
          else if (i === typed.length) cls += ' cur'
          return <span key={i} className={cls}>{ch === '\n' ? '↵\n' : ch}</span>
        })}
      </pre>

      <textarea
        className="typing-input"
        value={typed}
        onChange={handleInput}
        placeholder={txt('여기에 입력하세요. 입력 시작과 동시에 타이머 시작.', 'Type here. Timer starts when you type.')}
        autoFocus
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
      />

      <div className="typing-hint">{txt('스니펫을 끝내면 다음 스니펫이 나옵니다. 60초 동안 가능한 많이!', 'Finish a snippet to get the next one. Type as much as you can in 60s!')}</div>
    </div>
  )
}
