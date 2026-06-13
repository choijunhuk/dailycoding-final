import { useEffect, useMemo, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { useLang } from '../../context/LangContext.jsx'
import { BUG_HUNT_SNIPPETS } from './arcadeData.js'

const ROUND_COUNT = 5
const SECS_PER_ROUND = 25

function shuffle(arr) {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export default function BugHuntGame({ onComplete }) {
  const { lang } = useLang()
  const txt = (ko, en) => (lang === 'ko' ? ko : en)
  const round = useMemo(() => shuffle(BUG_HUNT_SNIPPETS).slice(0, ROUND_COUNT), [])
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [solved, setSolved] = useState(0)
  const [timeLeft, setTimeLeft] = useState(SECS_PER_ROUND)
  const [feedback, setFeedback] = useState(null)
  const startedAt = useRef(Date.now())
  const completedRef = useRef(false)

  useEffect(() => {
    if (feedback) return undefined
    if (timeLeft <= 0) {
      setFeedback({ chosen: -1, correct: round[idx].buggyLine, timeout: true })
      return undefined
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft, feedback, idx])

  const finalize = (finalScore, finalSolved) => {
    if (completedRef.current) return
    completedRef.current = true
    const elapsed = Math.round((Date.now() - startedAt.current) / 1000)
    onComplete(finalScore, { solved: finalSolved, total: round.length, elapsed })
  }

  const next = (newScore, newSolved) => {
    if (idx + 1 >= round.length) {
      finalize(newScore, newSolved)
    } else {
      setIdx(idx + 1)
      setTimeLeft(SECS_PER_ROUND)
      setFeedback(null)
    }
  }

  const pickLine = (lineIdx) => {
    if (feedback) return
    const right = lineIdx === round[idx].buggyLine
    const earned = right ? 150 + Math.max(0, timeLeft) * 10 : 0
    const newScore = score + earned
    const newSolved = solved + (right ? 1 : 0)
    setScore(newScore)
    setSolved(newSolved)
    setFeedback({ chosen: lineIdx, correct: round[idx].buggyLine, right })
    setTimeout(() => next(newScore, newSolved), 1500)
  }

  if (!round[idx]) return null
  const snippet = round[idx]

  return (
    <div className="bug-hunt-game">
      <div className="quiz-bar">
        <div className="quiz-progress">
          <span>{idx + 1} / {round.length}</span>
          <div className="quiz-progress-bar">
            <span style={{ width: `${(idx / round.length) * 100}%` }} />
          </div>
        </div>
        <div className="quiz-timer"><Clock size={14} /> {timeLeft}s</div>
        <div className="quiz-streak">⭐ {score}</div>
      </div>

      <div className="bug-hunt-title">
        <span className="lang-pill">{snippet.lang}</span>
        <strong>{snippet.title}</strong>
        <span className="bug-hunt-hint">{txt('버그가 있는 줄을 클릭하세요.', 'Click the buggy line.')}</span>
      </div>

      <pre className="bug-hunt-code">
        {snippet.lines.map((line, i) => {
          let cls = 'bug-line'
          if (feedback) {
            if (i === feedback.correct) cls += ' right'
            else if (i === feedback.chosen) cls += ' wrong'
          }
          return (
            <div
              key={i}
              className={cls}
              onClick={() => pickLine(i)}
              role="button"
            >
              <span className="bug-line-no">{i + 1}</span>
              <span className="bug-line-text">{line || ' '}</span>
            </div>
          )
        })}
      </pre>

      {feedback && (
        <div className={`bug-hunt-explain ${feedback.right ? 'good' : 'bad'}`}>
          {feedback.timeout ? txt('시간 초과!', 'Time up!') : feedback.right ? txt('정답!', 'Correct!') : txt('아쉽네요!', 'Not quite!')}
          {' '}{snippet.explain}
        </div>
      )}
    </div>
  )
}
