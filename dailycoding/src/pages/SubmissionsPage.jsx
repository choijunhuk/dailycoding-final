import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext.jsx';
import { useLang } from '../context/LangContext.jsx';

const DiffEditor = lazy(async () => {
  const mod = await import('@monaco-editor/react');
  return { default: mod.DiffEditor };
});

export default function SubmissionsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const toast = useToast();
  const { t } = useLang();
  const R = {
    correct: { label:t('submissionsCorrect'), color:'#56d364', bg:'rgba(86,211,100,.1)',  icon:'✅' },
    wrong:   { label:t('submissionsWrong'), color:'#f85149', bg:'rgba(248,81,73,.1)',   icon:'❌' },
    timeout: { label:t('submissionsTimeout'), color:'#e3b341', bg:'rgba(227,179,65,.1)',  icon:'⏱' },
    error:   { label:t('runtimeError'), color:'#ffa657', bg:'rgba(255,166,87,.1)',  icon:'⚡' },
    compile: { label:t('compileError'), color:'#ffa657', bg:'rgba(255,166,87,.1)',  icon:'🔧' },
    judging: { label:t('submissionsJudging'), color:'#79c0ff', bg:'rgba(121,192,255,.1)', icon:'⏳' },
  };
  const RESULT_FILTERS = [['all',t('allOption')],['correct',t('submissionsCorrect')],['wrong',t('submissionsWrongShort')],['timeout',t('submissionsTimeoutShort')],['error',t('submissionsErrorShort')],['compile',t('submissionsCompileShort')]];
  const [scope, setScope] = useState(location.state?.scope || 'me');
  const [query, setQuery] = useState('');
  const [resultF, setResultF] = useState(location.state?.result || 'all');
  const [langF, setLangF] = useState('all');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exp, setExp] = useState(null);
  const [cache, setCache] = useState({});
  const [codeLoading, setCodeLoading] = useState({});
  const [coachById, setCoachById] = useState({});
  const [coachLoading, setCoachLoading] = useState({});
  const [compareIds, setCompareIds] = useState([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [handledHighlightId, setHandledHighlightId] = useState(null);
  const highlightId = location.state?.highlightId || null;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.get('/submissions', {
      params: {
        scope,
        q: query.trim() || undefined,
        result: resultF,
        lang: langF,
        limit: 100,
      },
    }).then((res) => {
      if (active) setRows(res.data || []);
    }).catch((err) => {
      if (active) {
        setRows([]);
        setError(err.response?.data?.message || t('submissionsLoadFailed'));
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [scope, query, resultF, langF]);

  const langs = useMemo(() => ['all', ...new Set(rows.map((row) => row.lang).filter(Boolean))], [rows]);
  const total = rows.length;
  const correct = rows.filter((row) => row.result === 'correct').length;
  const rate = total ? Math.round((correct / total) * 100) : 0;

  const ensureCodeLoaded = useCallback(async (row) => {
    if (!row?.isMine) return null;
    if (cache[row.id]) return cache[row.id];
    if (codeLoading[row.id]) return null;
    setCodeLoading((prev) => ({ ...prev, [row.id]: true }));
    try {
      const res = await api.get(`/submissions/${row.id}/code`);
      const code = res.data.code || t('submissionsNoCode');
      setCache((prev) => ({ ...prev, [row.id]: code }));
      return code;
    } catch {
      const fallback = t('submissionsCodeLoadFailed');
      setCache((prev) => ({ ...prev, [row.id]: fallback }));
      return fallback;
    }
    finally {
      setCodeLoading((prev) => ({ ...prev, [row.id]: false }));
    }
  }, [cache, codeLoading, t]);

  const expand = async (row) => {
    if (exp === row.id) {
      setExp(null);
      return;
    }
    setExp(row.id);
    await ensureCodeLoaded(row);
  };

  const toggleCompare = async (row) => {
    if (!row.isMine) {
      toast?.show(t('submissionsCompareMineOnly'), 'info');
      return;
    }
    if (compareIds.includes(row.id)) {
      setCompareIds((prev) => prev.filter((id) => id !== row.id));
      return;
    }
    if (compareIds.length > 0) {
      const first = rows.find((item) => item.id === compareIds[0]);
      if (first && first.problemId !== row.problemId) {
        toast?.show(t('submissionsCompareSameProblem'), 'warning');
        return;
      }
    }
    await ensureCodeLoaded(row);
    setCompareIds((prev) => prev.length >= 2 ? [prev[1], row.id] : [...prev, row.id]);
  };

  const loadCoach = useCallback(async (row) => {
    if (!row?.isMine) return;
    if (coachById[row.id] || coachLoading[row.id]) return;
    setCoachLoading((prev) => ({ ...prev, [row.id]: true }));
    try {
      const { data } = await api.post('/ai/submission-coach', { submissionId: row.id });
      setCoachById((prev) => ({ ...prev, [row.id]: data }));
    } catch (err) {
      toast?.show(err.response?.data?.message || 'AI 오답 코치를 불러오지 못했습니다.', 'error');
    } finally {
      setCoachLoading((prev) => ({ ...prev, [row.id]: false }));
    }
  }, [coachById, coachLoading, toast]);

  useEffect(() => {
    if (!highlightId || handledHighlightId === highlightId || rows.length === 0) return;
    const target = rows.find((row) => row.id === highlightId);
    if (!target) return;
    setExp(target.id);
    ensureCodeLoaded(target);
    if (location.state?.autoCoach && ['wrong', 'timeout', 'error', 'compile'].includes(target.result)) {
      loadCoach(target);
    }
    setHandledHighlightId(highlightId);
  }, [ensureCodeLoaded, handledHighlightId, highlightId, loadCoach, location.state?.autoCoach, rows]);

  const compareRows = compareIds.map((id) => rows.find((row) => row.id === id)).filter(Boolean);

  const openCompare = async () => {
    if (compareRows.length !== 2) return;
    await Promise.all(compareRows.map((row) => ensureCodeLoaded(row)));
    setCompareOpen(true);
  };

  return (
    <div style={{ padding:'24px 28px', overflowY:'auto', height:'100%', maxWidth:1080, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16, marginBottom:20, flexWrap:'wrap' }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:800, marginBottom:4 }}>📝 {t('submissions')}</h1>
          <div style={{ fontSize:13, color:'var(--text2)' }}>{t('submissionsSubtitle')}</div>
        </div>
        <div style={{ display:'flex', gap:12 }}>
          {[
            {v:total, l:t('submissionsShowing'), c:'var(--blue)'},
            {v:correct, l:t('submissionsCorrect'), c:'var(--green)'},
            {v:`${rate}%`, l:t('submissionsAccuracy'), c:'var(--yellow)'},
          ].map((s) => (
            <div key={s.l} style={{ textAlign:'center', padding:'10px 16px', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10 }}>
              <div style={{ fontFamily:'Space Mono,monospace', fontSize:18, fontWeight:700, color:s.c }}>{s.v}</div>
              <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 16px' }}>
        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:.5 }}>{t('submissionsScope')}</span>
          {[
            ['all', t('submissionsScopeAll')],
            ['me', t('submissionsScopeMine')],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setScope(key)} style={{
              padding:'5px 12px', borderRadius:7, border:'none', cursor:'pointer',
              fontSize:12, fontWeight:700, fontFamily:'inherit',
              background: scope === key ? 'var(--blue)' : 'var(--bg3)',
              color: scope === key ? '#fff' : 'var(--text2)',
            }}>{label}</button>
          ))}
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('submissionsSearchPlaceholder')}
          style={{
            minWidth:260, flex:1, padding:'8px 12px',
            background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8,
            color:'var(--text)', fontSize:13, fontFamily:'inherit',
          }}
        />

        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:.5 }}>{t('submissionsResult')}</span>
          {RESULT_FILTERS.map(([key, label]) => (
            <button key={key} onClick={() => setResultF(key)} style={{
              padding:'4px 10px', borderRadius:6, border:'1px solid var(--border)',
              cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit',
              background: resultF === key ? 'var(--bg4)' : 'var(--bg3)',
              color: resultF === key ? 'var(--text)' : 'var(--text2)',
            }}>{label}</button>
          ))}
        </div>

        <select value={langF} onChange={(e) => setLangF(e.target.value)} style={{
          padding:'8px 12px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8,
          color:'var(--text)', fontSize:13, fontFamily:'inherit',
        }}>
          {langs.map((lang) => <option key={lang} value={lang}>{lang === 'all' ? t('submissionsAllLang') : lang}</option>)}
        </select>

        {compareIds.length > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:'auto', flexWrap:'wrap' }}>
            <span style={{ fontSize:12, color:'var(--text3)' }}>{t('submissionsCompareCount').replace('{n}', String(compareIds.length))}</span>
            <button
              onClick={openCompare}
              disabled={compareRows.length !== 2}
              style={{
                padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)',
                background: compareRows.length === 2 ? 'var(--blue)' : 'var(--bg3)',
                color: compareRows.length === 2 ? '#fff' : 'var(--text3)',
                cursor: compareRows.length === 2 ? 'pointer' : 'default',
                fontSize:12, fontWeight:700, fontFamily:'inherit',
              }}
            >
              {t('submissionsViewDiff')}
            </button>
            <button
              onClick={() => setCompareIds([])}
              style={{
                padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)',
                background:'var(--bg3)', color:'var(--text2)', cursor:'pointer',
                fontSize:12, fontWeight:700, fontFamily:'inherit',
              }}
            >
              {t('submissionsClearSelection')}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'56px 0', color:'var(--text3)' }}>{t('loading')}</div>
      ) : error ? (
        <div style={{ textAlign:'center', padding:'56px 0', color:'var(--text3)' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>⚠️</div>
          <div style={{ fontSize:15, fontWeight:600, color:'var(--text)' }}>{t('submissionsLoadFailedTitle')}</div>
          <div style={{ fontSize:13, marginTop:6 }}>{error}</div>
        </div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:'var(--text3)' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📭</div>
          <div style={{ fontSize:15, fontWeight:600 }}>{t('submissionsEmpty')}</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {rows.map((row) => {
            const ri = R[row.result] || R.error;
            const isExp = exp === row.id;
            const highlighted = highlightId === row.id;
            const canCoach = row.isMine && ['wrong', 'timeout', 'error', 'compile'].includes(row.result);
            const coach = coachById[row.id];
            return (
              <div key={row.id} style={{
                background:'var(--bg2)',
                border:'1px solid var(--border)',
                borderLeft:`3px solid ${highlighted ? 'var(--blue)' : ri.color}`,
                borderRadius:10,
                overflow:'hidden',
                boxShadow: highlighted ? '0 0 0 1px rgba(121,192,255,.2)' : 'none',
              }}>
                <div onClick={() => expand(row)} style={{
                  padding:'13px 18px', cursor:'pointer', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
                }}>
                  <span style={{
                    padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                    background:ri.bg, color:ri.color, display:'flex', alignItems:'center', gap:4,
                  }}>{ri.icon} {ri.label}</span>

                  <button onClick={(e) => { e.stopPropagation(); if (row.problemId) navigate(`/problems/${row.problemId}`); }} style={{
                    background:'none', border:'none', color:'var(--blue)', cursor:'pointer',
                    fontSize:13, fontWeight:600, fontFamily:'inherit', padding:0, minWidth:120, textAlign:'left',
                  }}>
                    {row.problemTitle || t('submissionsProblemFallback').replace('{id}', String(row.problemId))}
                  </button>

                  <span style={{ fontSize:12, color:'var(--text2)' }}>
                    #{row.problemId}
                  </span>
                  <span style={{ fontSize:12, color: row.isMine ? 'var(--green)' : 'var(--text2)' }}>
                    {row.isMine ? `${user?.username || t('rankingMe')} (${t('rankingMe')})` : `${row.username} · ${t('submissionsUserLabel').replace('{id}', String(row.userId))}`}
                  </span>
                  <span style={{ fontSize:11, color:'var(--text2)', fontFamily:'Space Mono,monospace' }}>{row.lang}</span>
                  {row.time && row.time !== '-' && <span style={{ fontSize:11, color:'var(--text2)', fontFamily:'Space Mono,monospace' }}>⏱ {row.time}</span>}
                  <span style={{ fontSize:11, color:'var(--text3)', marginLeft:'auto' }}>{row.date}</span>
                  {row.isMine && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleCompare(row); }}
                      style={{
                        padding:'4px 10px', borderRadius:999, border:'1px solid var(--border)',
                        background: compareIds.includes(row.id) ? 'rgba(88,166,255,.15)' : 'var(--bg3)',
                        color: compareIds.includes(row.id) ? 'var(--blue)' : 'var(--text2)',
                        cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'inherit',
                      }}
                    >
                      {compareIds.includes(row.id) ? t('submissionsSelected') : t('submissionsCompareSelect')}
                    </button>
                  )}
                  {canCoach && (
                    <button
                      onClick={(e) => { e.stopPropagation(); loadCoach(row); setExp(row.id); }}
                      style={{
                        padding:'4px 10px', borderRadius:999, border:'1px solid rgba(121,192,255,.35)',
                        background: coach ? 'rgba(86,211,100,.12)' : 'rgba(121,192,255,.12)',
                        color: coach ? 'var(--green)' : 'var(--blue)',
                        cursor:'pointer', fontSize:11, fontWeight:800, fontFamily:'inherit',
                      }}
                      disabled={coachLoading[row.id]}
                    >
                      {coachLoading[row.id] ? '분석 중' : coach ? '코치 완료' : 'AI 오답 코치'}
                    </button>
                  )}
                </div>

                {isExp && (
                  <div style={{ borderTop:'1px solid var(--border)', background:'var(--bg3)' }}>
                    {row.isMine ? (
                      <>
                        <div style={{ padding:'9px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ fontSize:11, color:'var(--text2)', fontFamily:'Space Mono,monospace' }}>{t('submissionsMyCode')}</span>
                          <button onClick={() => navigator.clipboard?.writeText(cache[row.id] || '')} style={{
                            padding:'4px 10px', borderRadius:6, border:'1px solid var(--border)',
                            background:'var(--bg2)', color:'var(--text2)', cursor:'pointer',
                            fontSize:11, fontFamily:'inherit',
                          }}>📋 {t('copy')}</button>
                        </div>
                        {codeLoading[row.id]
                          ? <div style={{ padding:'18px', color:'var(--text3)', fontSize:13 }}>{t('submissionsCodeLoading')}</div>
                          : <pre style={{
                              margin:0, padding:'16px 20px', fontSize:12, fontFamily:'Space Mono,monospace',
                              color:'var(--green)', lineHeight:1.7, overflowX:'auto', maxHeight:320, background:'var(--bg)',
                            }}>{cache[row.id] || t('submissionsNoCode')}</pre>}
                      </>
                    ) : (
                      <div style={{ padding:'16px 18px', fontSize:13, color:'var(--text3)' }}>
                        {t('submissionsNoOtherCode')}
                      </div>
                    )}

                    {row.detail && (
                      <div style={{
                        padding:'10px 18px', fontSize:12, color:'var(--text2)',
                        borderTop:'1px solid var(--border)', background:'rgba(255,255,255,.02)',
                      }}>
                        💬 {row.detail}
                      </div>
                    )}
                    {canCoach && (
                      <div style={{ padding:'14px 18px', borderTop:'1px solid var(--border)', background:'rgba(121,192,255,.04)' }}>
                        {!coach && !coachLoading[row.id] && (
                          <button
                            onClick={() => loadCoach(row)}
                            style={{
                              padding:'8px 12px', borderRadius:8, border:'1px solid rgba(121,192,255,.35)',
                              background:'rgba(121,192,255,.12)', color:'var(--blue)', cursor:'pointer',
                              fontSize:12, fontWeight:800, fontFamily:'inherit',
                            }}
                          >
                            AI로 재도전 방향 보기
                          </button>
                        )}
                        {coachLoading[row.id] && <div style={{ fontSize:13, color:'var(--text3)' }}>AI가 오답 원인을 정리하는 중입니다.</div>}
                        {coach && (
                          <div style={{ display:'grid', gap:10 }}>
                            <div style={{ fontSize:13, fontWeight:800, color:'var(--text)' }}>{coach.summary}</div>
                            <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.7 }}>
                              <strong style={{ color:'var(--yellow)' }}>가능성 높은 원인:</strong> {coach.likelyCause}
                            </div>
                            <ol style={{ margin:'0 0 0 18px', padding:0, color:'var(--text2)', fontSize:12, lineHeight:1.8 }}>
                              {(coach.nextSteps || []).slice(0, 4).map((step, index) => <li key={index}>{step}</li>)}
                            </ol>
                            <div style={{ fontSize:12, color:'var(--text3)' }}>다음 테스트 포커스: {coach.testFocus}</div>
                            <button
                              onClick={() => navigate(`/problems/${coach.retryProblemId || row.problemId}`)}
                              style={{
                                justifySelf:'start', padding:'7px 12px', borderRadius:8, border:'1px solid var(--border)',
                                background:'var(--bg2)', color:'var(--blue)', cursor:'pointer', fontSize:12, fontWeight:800,
                                fontFamily:'inherit',
                              }}
                            >
                              같은 문제 다시 풀기
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {compareOpen && compareRows.length === 2 && (
        <div
          onClick={() => setCompareOpen(false)}
          style={{
            position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:400,
            display:'flex', alignItems:'center', justifyContent:'center', padding:20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width:'min(1200px, 100%)', height:'min(80vh, 860px)',
              background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:16,
              overflow:'hidden', display:'flex', flexDirection:'column',
            }}
          >
            <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
              <div>
                <div style={{ fontSize:16, fontWeight:800 }}>{t('submissionsDiffTitle')}</div>
                <div style={{ fontSize:12, color:'var(--text3)', marginTop:4 }}>
                  #{compareRows[0].problemId} {compareRows[0].problemTitle}
                </div>
              </div>
              <button
                onClick={() => setCompareOpen(false)}
                style={{
                  padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)',
                  background:'var(--bg3)', color:'var(--text2)', cursor:'pointer',
                  fontSize:12, fontWeight:700, fontFamily:'inherit',
                }}
              >
                {t('close')}
              </button>
            </div>
            <div style={{ padding:'10px 18px', fontSize:12, color:'var(--text3)', display:'flex', gap:16, flexWrap:'wrap' }}>
              <span>{t('submissionsDiffLeft').replace('{id}', String(compareRows[0].id)).replace('{date}', compareRows[0].date)}</span>
              <span>{t('submissionsDiffRight').replace('{id}', String(compareRows[1].id)).replace('{date}', compareRows[1].date)}</span>
            </div>
            <div style={{ flex:1 }}>
              <Suspense fallback={<div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)' }}>{t('submissionsDiffLoading')}</div>}>
                <DiffEditor
                  height="100%"
                  original={cache[compareRows[0].id] || ''}
                  modified={cache[compareRows[1].id] || ''}
                  language={compareRows[0].lang || 'javascript'}
                  theme="vs-dark"
                  options={{
                    readOnly: true,
                    renderSideBySide: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 13,
                    lineNumbers: 'on',
                  }}
                />
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
