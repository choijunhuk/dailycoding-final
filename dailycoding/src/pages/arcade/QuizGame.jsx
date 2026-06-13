import { useEffect, useMemo, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { useLang } from '../../context/LangContext.jsx'

const TOTAL_SECS = 45
const QUESTIONS_PER_ROUND = 8

function shuffle(arr) {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export default function QuizGame({ questions, onComplete }) {
  const { lang } = useLang()
  const txt = (ko, en) => (lang === 'ko' ? ko : en)
  const round = useMemo(() => shuffle(questions).slice(0, QUESTIONS_PER_ROUND).map((q) => ({
    ...q,
    options: shuffle(q.options),
  })), [questions])
  const [idx, setIdx] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [timeLeft, setTimeLeft] = useState(TOTAL_SECS)
  const [feedback, setFeedback] = useState(null)
  const startedAt = useRef(Date.now())
  const completedRef = useRef(false)

  useEffect(() => {
    if (timeLeft <= 0) return undefined
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft])

  const finalize = (finalCorrect, finalStreak) => {
    if (completedRef.current) return
    completedRef.current = true
    const elapsed = Math.round((Date.now() - startedAt.current) / 1000)
    // Score = 100 per correct + streak bonus + leftover-time bonus.
    const score = finalCorrect * 100 + finalStreak * 25 + Math.max(0, timeLeft) * 5
    onComplete(score, {
      correct: finalCorrect,
      total: round.length,
      bestStreak: finalStreak,
      elapsed,
    })
  }

  useEffect(() => {
    if (timeLeft <= 0 && !completedRef.current) {
      finalize(correct, bestStreak)
    }
  }, [timeLeft])

  useEffect(() => {
    if (idx >= round.length && !completedRef.current) {
      finalize(correct, bestStreak)
    }
  }, [idx, round.length])

  const q = round[idx]
  if (!q) return null

  const pick = (opt) => {
    if (feedback) return
    const isRight = opt === q.answer
    setFeedback({ chosen: opt, correct: q.answer, right: isRight })
    let nextStreak = streak
    let nextCorrect = correct
    let nextBest = bestStreak
    if (isRight) {
      nextStreak = streak + 1
      nextCorrect = correct + 1
      nextBest = Math.max(bestStreak, nextStreak)
      setStreak(nextStreak)
      setCorrect(nextCorrect)
      setBestStreak(nextBest)
    } else {
      setStreak(0)
    }
    setTimeout(() => {
      setFeedback(null)
      if (idx + 1 >= round.length) {
        finalize(nextCorrect, nextBest)
      } else {
        setIdx(idx + 1)
      }
    }, 700)
  }

  return (
    <div className="quiz-game">
      <div className="quiz-bar">
        <div className="quiz-progress">
          <span>{idx + 1} / {round.length}</span>
          <div className="quiz-progress-bar">
            <span style={{ width: `${((idx + (feedback ? 1 : 0)) / round.length) * 100}%` }} />
          </div>
        </div>
        <div className="quiz-timer"><Clock size={14} /> {timeLeft}s</div>
        <div className="quiz-streak">🔥 {streak}</div>
      </div>

      <pre className="quiz-code">{q.code}</pre>
      <div className="quiz-prompt">
        {q.options.some((opt) => opt.includes('O('))
          ? txt('시간복잡도는?', 'What is the time complexity?')
          : txt('출력 결과는?', 'What is the output?')}
      </div>

      <div className="quiz-options">
        {q.options.map((opt) => {
          let cls = 'quiz-option'
          if (feedback) {
            if (opt === feedback.correct) cls += ' right'
            else if (opt === feedback.chosen) cls += ' wrong'
            else cls += ' dim'
          }
          return (
            <button key={opt} className={cls} onClick={() => pick(opt)} disabled={!!feedback}>
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}
