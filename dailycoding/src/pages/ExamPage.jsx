import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api.js';
import { useLang } from '../context/LangContext.jsx';

const Editor = lazy(() => import('@monaco-editor/react'));

export default function ExamPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLang();
  const [exam, setExam] = useState(null);
  const [attemptId, setAttemptId] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const [{ data: detail }, { data: started }] = await Promise.all([
          api.get(`/exams/${id}`),
          api.post(`/exams/${id}/start`),
        ]);
        if (ignore) return;
        setExam({ ...detail, problems: started.problems });
        setAttemptId(started.attemptId);
        const startedAt = new Date(started.startedAt).getTime();
        const durationSec = (started.durationMin || 120) * 60;
        setTimeLeft(Math.max(0, durationSec - Math.floor((Date.now() - startedAt) / 1000)));
      } catch {
        if (!ignore) setExam(null);
      }
    })();
    return () => { ignore = true; };
  }, [id]);

  useEffect(() => {
    if (!timeLeft) return undefined;
    const timer = setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const activeProblem = exam?.problems?.[activeIndex];
  const editorValue = answers[activeProblem?.id]?.code || '';
  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const seconds = String(timeLeft % 60).padStart(2, '0');

  const submitAll = async () => {
    if (!attemptId) return;
    const { data } = await api.post(`/exams/${id}/submit`, { attemptId, answers });
    setResult(data);
  };

  if (!exam) {
    return <div style={{ padding:40 }}>{t('examLoading')}</div>;
  }

  return (
    <div style={{ padding:'24px', height:'100%', display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800 }}>{exam.title}</h1>
          <div style={{ color:'var(--text3)', fontSize:13 }}>{t('examSummary').replace('{minutes}', String(exam.durationMin)).replace('{count}', String(exam.problems.length))}</div>
        </div>
        <div style={{ fontFamily:'Space Mono, monospace', fontSize:24, fontWeight:800, color: timeLeft < 600 ? 'var(--red)' : 'var(--blue)' }}>
          {minutes}:{seconds}
        </div>
      </div>

      {result ? (
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:20 }}>
          <h2 style={{ fontSize:22, fontWeight:800, marginBottom:12 }}>{t('examResultTitle')}</h2>
          <div style={{ marginBottom:12 }}>{t('examScoreSummary').replace('{score}', String(result.score)).replace('{total}', String(result.totalProblems))}</div>
          <div style={{ display:'grid', gap:10 }}>
            {result.breakdown.map((item) => (
              <div key={item.problemId} style={{ padding:'10px 12px', border:'1px solid var(--border)', borderRadius:8 }}>
                {t('examProblemResult').replace('{id}', String(item.problemId)).replace('{result}', String(item.result))} {item.timeMs != null ? `· ${item.timeMs}ms` : ''}
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => navigate('/exams')}>{t('backToExamList')}</button>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'220px minmax(0,1fr)', gap:16, flex:1, minHeight:0 }}>
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:12, overflowY:'auto' }}>
            {exam.problems.map((problem, index) => (
              <button key={problem.id} onClick={() => setActiveIndex(index)} style={{
                width:'100%',
                padding:'10px 12px',
                borderRadius:8,
                border:'1px solid var(--border)',
                background: activeIndex === index ? 'rgba(88,166,255,.12)' : 'transparent',
                color:'var(--text)',
                textAlign:'left',
                cursor:'pointer',
                marginBottom:8,
              }}>
                {t('examProblemTitle').replace('{n}', String(index + 1))}. {problem.title}
              </button>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(360px, 1fr)', gap:16, minHeight:0 }}>
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:20, overflowY:'auto' }}>
              <h2 style={{ fontSize:18, fontWeight:700, marginBottom:10 }}>{activeProblem?.title}</h2>
              <div style={{ color:'var(--text3)', fontSize:13 }}>{t('examTierLabel').replace('{tier}', String(activeProblem?.tier || '-'))}</div>
              <p style={{ color:'var(--text2)', marginTop:12 }}>{t('examSimulatorDesc')}</p>
            </div>
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:12, minHeight:0 }}>
              <Suspense fallback={<div>{t('editorLoading')}</div>}>
                <Editor
                  height="60vh"
                  language="javascript"
                  value={editorValue}
                  onChange={(value) => setAnswers((prev) => ({
                    ...prev,
                    [activeProblem.id]: { ...(prev[activeProblem.id] || {}), code: value || '', lang: 'javascript' },
                  }))}
                  options={{ minimap: { enabled: false } }}
                />
              </Suspense>
              <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:12 }}>
                <button className="btn btn-ghost" onClick={submitAll}>{t('submitAll')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
