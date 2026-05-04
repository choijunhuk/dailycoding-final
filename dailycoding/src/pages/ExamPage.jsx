import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api.js';
import { useLang } from '../context/LangContext.jsx';

const Editor = lazy(() => import('@monaco-editor/react'));

const LANG_OPTIONS = [
  { value: 'python', label: 'Python', monaco: 'python' },
  { value: 'javascript', label: 'JavaScript', monaco: 'javascript' },
  { value: 'c', label: 'C', monaco: 'c' },
  { value: 'cpp', label: 'C++', monaco: 'cpp' },
  { value: 'java', label: 'Java', monaco: 'java' },
];

const TYPE_LABEL = { coding: '코딩', 'fill-blank': '빈칸', 'bug-fix': '버그수정' };
const TYPE_COLOR = { coding: 'var(--blue)', 'fill-blank': 'var(--green)', 'bug-fix': 'var(--orange)' };

function parseConfig(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

function formatDuration(sec) {
  const total = Math.max(0, Number(sec) || 0);
  const min = Math.floor(total / 60);
  const rest = total % 60;
  return min > 0 ? `${min}분 ${rest}초` : `${rest}초`;
}

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
        if (current <= 1) { clearInterval(timer); return 0; }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const activeProblem = exam?.problems?.[activeIndex];
  const problemType = activeProblem?.problemType || 'coding';
  const specialConfig = useMemo(() => parseConfig(activeProblem?.specialConfig), [activeProblem]);
  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const seconds = String(timeLeft % 60).padStart(2, '0');
  const currentAnswer = answers[activeProblem?.id] || {};
  const currentLang = currentAnswer.lang || 'python';
  const monacoLang = LANG_OPTIONS.find(o => o.value === currentLang)?.monaco || 'python';

  const setLang = (lang) => setAnswers(prev => ({
    ...prev,
    [activeProblem.id]: { ...(prev[activeProblem.id] || {}), lang },
  }));

  const setCode = (code) => setAnswers(prev => ({
    ...prev,
    [activeProblem.id]: { ...(prev[activeProblem.id] || {}), code: code || '', lang: currentLang },
  }));

  const setBlankAnswer = (index, value) => {
    const blanks = [...(currentAnswer.blankAnswers || [])];
    blanks[index] = value;
    setAnswers(prev => ({
      ...prev,
      [activeProblem.id]: { blankAnswers: blanks, lang: 'fill-blank' },
    }));
  };

  const setBugAnswer = (value) => setAnswers(prev => ({
    ...prev,
    [activeProblem.id]: { answer: value, lang: 'bug-fix' },
  }));

  const submitAll = async () => {
    if (!attemptId) return;
    const { data } = await api.post(`/exams/${id}/submit`, { attemptId, answers });
    setResult(data);
  };

  if (!exam) return <div style={{ padding: 40 }}>{t('examLoading')}</div>;

  return (
    <div style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>{exam.title}</h1>
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>
            {t('examSummary').replace('{minutes}', String(exam.durationMin)).replace('{count}', String(exam.problems.length))}
          </div>
        </div>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 24, fontWeight: 800, color: timeLeft < 600 ? 'var(--red)' : 'var(--blue)' }}>
          {minutes}:{seconds}
        </div>
      </div>

      {result ? (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>{t('examResultTitle')}</h2>
          <div style={{ marginBottom: 12 }}>
            {t('examScoreSummary').replace('{score}', String(result.score)).replace('{total}', String(result.totalProblems))}
          </div>
          {result.report && (
            <div style={{ display:'grid', gap:14, marginBottom:16 }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))', gap:10 }}>
                {[
                  { label:'정답률', value:`${result.report.accuracy}%`, color:'var(--green)' },
                  { label:'소요 시간', value:formatDuration(result.report.timeUsedSec), color:'var(--blue)' },
                  { label:'시간 사용률', value:`${result.report.paceRate}%`, color:'var(--yellow)' },
                  { label:'미풀이', value:`${result.report.emptyCount}문제`, color:'var(--text3)' },
                ].map((item) => (
                  <div key={item.label} style={{ padding:'12px 14px', border:'1px solid var(--border)', borderRadius:10, background:'var(--bg3)' }}>
                    <div style={{ fontSize:11, color:'var(--text3)', marginBottom:5 }}>{item.label}</div>
                    <div style={{ fontSize:18, fontWeight:800, color:item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding:'14px 16px', border:'1px solid var(--border)', borderRadius:10, background:'var(--bg3)', fontSize:13, lineHeight:1.7 }}>
                <div style={{ fontWeight:800, color:'var(--text)', marginBottom:4 }}>모의코테 리포트</div>
                <div style={{ color:'var(--text2)' }}>{result.report.summary}</div>
                <div style={{ color:'var(--blue)', marginTop:6 }}>{result.report.nextPractice}</div>
              </div>
              {(result.report.weakTags?.length > 0 || result.report.weakTypes?.length > 0) && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:10 }}>
                  <div style={{ padding:'12px 14px', border:'1px solid var(--border)', borderRadius:10, background:'var(--bg3)' }}>
                    <div style={{ fontSize:12, fontWeight:800, marginBottom:8 }}>취약 태그</div>
                    {(result.report.weakTags || []).length === 0
                      ? <div style={{ fontSize:12, color:'var(--text3)' }}>뚜렷한 취약 태그가 없습니다.</div>
                      : result.report.weakTags.map((tag) => (
                        <div key={tag.label} style={{ display:'flex', justifyContent:'space-between', gap:10, fontSize:12, color:'var(--text2)', marginBottom:6 }}>
                          <span>{tag.label}</span>
                          <span>{tag.misses}/{tag.total} miss</span>
                        </div>
                      ))}
                  </div>
                  <div style={{ padding:'12px 14px', border:'1px solid var(--border)', borderRadius:10, background:'var(--bg3)' }}>
                    <div style={{ fontSize:12, fontWeight:800, marginBottom:8 }}>문제 유형별 실수</div>
                    {(result.report.weakTypes || []).length === 0
                      ? <div style={{ fontSize:12, color:'var(--text3)' }}>유형별 실수가 없습니다.</div>
                      : result.report.weakTypes.map((type) => (
                        <div key={type.label} style={{ display:'flex', justifyContent:'space-between', gap:10, fontSize:12, color:'var(--text2)', marginBottom:6 }}>
                          <span>{TYPE_LABEL[type.label] || type.label}</span>
                          <span>{type.missRate}%</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'grid', gap: 10 }}>
            {result.breakdown.map((item) => (
              <div key={item.problemId} style={{
                padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8,
                borderLeft: `3px solid ${item.result === 'correct' ? 'var(--green)' : item.result === 'empty' ? 'var(--text3)' : 'var(--red)'}`,
              }}>
                {(item.problemTitle || t('examProblemResult').replace('{id}', String(item.problemId)).replace('{result}', String(item.result)))}
                <span style={{ color:'var(--text3)', marginLeft:8, fontSize:12 }}>#{item.problemId} · {item.result}</span>
                {item.timeMs != null ? ` · ${item.timeMs}ms` : ''}
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/exams')}>
            {t('backToExamList')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0,1fr)', gap: 16, flex: 1, minHeight: 0 }}>
          {/* 문제 목록 사이드바 */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, overflowY: 'auto' }}>
            {exam.problems.map((problem, index) => {
              const pType = problem.problemType || 'coding';
              const hasAnswer = answers[problem.id] && (
                pType === 'coding' ? answers[problem.id].code :
                pType === 'fill-blank' ? answers[problem.id].blankAnswers?.some(Boolean) :
                answers[problem.id].answer
              );
              return (
                <button key={problem.id} onClick={() => setActiveIndex(index)} style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: `1px solid ${activeIndex === index ? 'rgba(88,166,255,.4)' : 'var(--border)'}`,
                  background: activeIndex === index ? 'rgba(88,166,255,.12)' : 'transparent',
                  color: 'var(--text)', textAlign: 'left', cursor: 'pointer', marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
                    {hasAnswer && <span style={{ color: 'var(--green)', fontSize: 11 }}>✓</span>}
                    {t('examProblemTitle').replace('{n}', String(index + 1))}. {problem.title}
                  </div>
                  <div style={{ fontSize: 11, color: TYPE_COLOR[pType], marginTop: 3 }}>
                    {TYPE_LABEL[pType] || pType}
                    {problem.preferredLanguage ? ` · ${problem.preferredLanguage}` : ''}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 문제 + 답안 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(360px, 1fr)', gap: 16, minHeight: 0 }}>
            {/* 문제 설명 패널 */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, overflowY: 'auto' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--bg3)', color: TYPE_COLOR[problemType], fontWeight: 700 }}>
                  {TYPE_LABEL[problemType] || problemType}
                </span>
                {activeProblem?.preferredLanguage && (
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(88,166,255,.1)', color: 'var(--blue)', fontWeight: 700 }}>
                    {activeProblem.preferredLanguage}
                  </span>
                )}
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{activeProblem?.title}</h2>
              <div style={{ color: 'var(--text3)', fontSize: 12, marginBottom: 14 }}>
                {t('examTierLabel').replace('{tier}', String(activeProblem?.tier || '-'))}
              </div>
              {activeProblem?.description && (
                <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>{activeProblem.description}</p>
              )}
              {!activeProblem?.description && (
                <p style={{ color: 'var(--text2)', fontSize: 13 }}>{t('examSimulatorDesc')}</p>
              )}
              {problemType === 'fill-blank' && specialConfig?.codeTemplate && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 6 }}>코드 템플릿</div>
                  <pre style={{
                    background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8,
                    padding: 12, fontSize: 12, overflowX: 'auto', fontFamily: 'Space Mono, monospace',
                    whiteSpace: 'pre-wrap', lineHeight: 1.6,
                  }}>{specialConfig.codeTemplate}</pre>
                </div>
              )}
              {problemType === 'bug-fix' && specialConfig?.buggyCode && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 6 }}>
                    버그 코드
                    {activeProblem?.preferredLanguage && (
                      <span style={{ fontWeight: 400, marginLeft: 6, color: 'var(--text2)' }}>
                        ({activeProblem.preferredLanguage})
                      </span>
                    )}
                  </div>
                  <pre style={{
                    background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8,
                    padding: 12, fontSize: 12, overflowX: 'auto', fontFamily: 'Space Mono, monospace',
                    whiteSpace: 'pre-wrap', lineHeight: 1.6,
                  }}>{specialConfig.buggyCode}</pre>
                  {specialConfig?.hint && (
                    <p style={{ marginTop: 8, color: 'var(--text2)', fontSize: 13 }}>💡 힌트: {specialConfig.hint}</p>
                  )}
                </div>
              )}
            </div>

            {/* 답안 입력 패널 */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {problemType === 'coding' && (
                <>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                    {LANG_OPTIONS.map(opt => (
                      <button key={opt.value} onClick={() => setLang(opt.value)} style={{
                        padding: '4px 10px', borderRadius: 6,
                        border: `1px solid ${currentLang === opt.value ? 'var(--blue)' : 'var(--border)'}`,
                        background: currentLang === opt.value ? 'var(--blue)' : 'var(--bg3)',
                        color: currentLang === opt.value ? '#0d1117' : 'var(--text2)',
                        fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      }}>{opt.label}</button>
                    ))}
                  </div>
                  <Suspense fallback={<div>{t('editorLoading')}</div>}>
                    <Editor
                      height="55vh"
                      language={monacoLang}
                      value={currentAnswer.code || ''}
                      onChange={setCode}
                      options={{ minimap: { enabled: false } }}
                    />
                  </Suspense>
                </>
              )}

              {problemType === 'fill-blank' && (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--text2)' }}>빈칸 답안 입력</div>
                  {(Array.isArray(specialConfig?.blanks) ? specialConfig.blanks : []).map((_, index) => (
                    <div key={index} style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>빈칸 {index + 1}</label>
                      <input
                        value={currentAnswer.blankAnswers?.[index] || ''}
                        onChange={e => setBlankAnswer(index, e.target.value)}
                        placeholder={`빈칸 ${index + 1} 값 입력`}
                        style={{
                          width: '100%', padding: '8px 12px', borderRadius: 8,
                          border: '1px solid var(--border)', background: 'var(--bg3)',
                          color: 'var(--text)', fontSize: 13, fontFamily: 'Space Mono, monospace',
                          boxSizing: 'border-box', outline: 'none',
                        }}
                      />
                    </div>
                  ))}
                  {(!specialConfig?.blanks || specialConfig.blanks.length === 0) && (
                    <div style={{ color: 'var(--text3)', fontSize: 13 }}>빈칸 정보를 불러올 수 없습니다.</div>
                  )}
                </div>
              )}

              {problemType === 'bug-fix' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text2)' }}>수정된 코드 입력</div>
                  <textarea
                    value={currentAnswer.answer || ''}
                    onChange={e => setBugAnswer(e.target.value)}
                    placeholder="버그를 수정한 코드를 입력하세요..."
                    style={{
                      flex: 1, minHeight: 280, padding: 12, borderRadius: 8,
                      border: '1px solid var(--border)', background: 'var(--bg3)',
                      color: 'var(--text)', fontSize: 13, fontFamily: 'Space Mono, monospace',
                      resize: 'vertical', boxSizing: 'border-box', outline: 'none', lineHeight: 1.6,
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="btn btn-ghost" onClick={submitAll}>{t('submitAll')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
