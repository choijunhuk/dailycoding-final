import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useLang } from '../context/LangContext';
import { PROBLEMS, TIERS } from '../data/problems';
import api from '../api.js';
import EmailVerifyGate from '../components/EmailVerifyGate.jsx';
import './AiPage.css';

const QUICK_Qs = [
  'aiQuickQuestion1',
  'aiQuickQuestion2',
  'aiQuickQuestion3',
  'aiQuickQuestion4',
];

export default function AiPage() {
  const navigate = useNavigate();
  const { user }     = useAuth();
  const { problems: appProblems, solved } = useApp();
  const { t } = useLang();
  const [analyzing,  setAnalyzing]  = useState(false);
  const [analysis,   setAnalysis]   = useState(null);
  const [chat,       setChat]       = useState([]);
  const [input,      setInput]      = useState('');
  const [chatBusy,   setChatBusy]   = useState(false);
  const [quiz,       setQuiz]       = useState(null);
  const [quizLoading,setQuizLoading]= useState(false);
  const [quizAnswer, setQuizAnswer] = useState(null);
  // ★ 문제별 힌트
  const [hintProbId,  setHintProbId]  = useState('');
  const [aiHint,      setAiHint]      = useState(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [hintLevel,   setHintLevel]   = useState(0);
  const [quota, setQuota] = useState({ used: 0, limit: 5, tier: 'free' });
  const [quotaNotice, setQuotaNotice] = useState('');

  // ★ 맞춤 추천 문제
  const [recommend,        setRecommend]        = useState([]);
  const [recommendLoading, setRecommendLoading] = useState(true);

  // 문제 데이터: AppContext에서 가져오되 없으면 problems.js 기본값
  const allProblems = appProblems.length > 0 ? appProblems : PROBLEMS;

  const loadQuota = useCallback(() => {
    api.get('/ai/quota').then(r => setQuota(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    api.get('/problems/recommend').then(r => {
      setRecommend(r.data || []);
    }).catch(() => {}).finally(() => setRecommendLoading(false));
  }, []);

  useEffect(() => {
    loadQuota();
  }, [loadQuota]);

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setAnalysis(null);
    setQuotaNotice('');
    try {
      const res = await api.post('/ai/analyze');
      setAnalysis(res.data);
    } catch (err) {
      if (err.response?.data?.code === 'QUOTA_EXCEEDED') {
        setQuotaNotice(t('quotaExceeded'));
      } else {
      // 서버 없을 때 로컬 fallback
        setAnalysis({
          level: t('aiLocalLevel').replace('{username}', user?.username || '').replace('{tier}', user?.tier || ''),
          strengths:  [t('aiStrength1'), t('aiStrength2')],
          weaknesses: [t('aiWeakness1'), t('aiWeakness2')],
          recommend: [
            t('aiRecommend1'),
            'BFS',
            t('aiRecommend2'),
          ],
          motivationMsg: t('aiMotivation'),
          nextMilestone: t('aiNextMilestone').replace('{rating}', String((user?.rating||0)+200)),
        });
      }
    }
    loadQuota();
    setAnalyzing(false);
  }, [loadQuota, t, user?.rating, user?.tier, user?.username]);

  const sendChat = async () => {
    if (!input.trim() || chatBusy) return;
    const msg = input.trim();
    setInput('');
    const newHistory = [...chat, { role:'user', parts:[{text: msg}] }];
    setChat(newHistory);
    setChatBusy(true);
    setQuotaNotice('');
    try {
      const res = await api.post('/ai/chat', { messages: newHistory });
      setChat(p => [...p, { role:'model', parts:[{text: res.data.text}] }]);
    } catch (err) {
      if (err.response?.data?.code === 'QUOTA_EXCEEDED') {
        setQuotaNotice(t('quotaExceeded'));
      } else {
        setChat(p => [...p, { role:'model', parts:[{text: t('chatRetryMsg')}] }]);
      }
    }
    loadQuota();
    setChatBusy(false);
  };

  const goToJudge = (title) => {
    const p = allProblems.find(pr => pr.title === title);
    if (p) navigate('/problems/' + p.id, { state: { problem: p } });
  };

  // ★ 문제별 AI 힌트 요청
  const [hintLimitMsg, setHintLimitMsg] = useState(null);
  const [hintRemaining, setHintRemaining] = useState(null);
  const getHint = async () => {
    if (!hintProbId) return;
    setHintLoading(true); setAiHint(null); setHintLevel(0); setHintLimitMsg(null);
    setQuotaNotice('');
    try {
      const res = await api.post('/ai/hint', { problemId: Number(hintProbId) });
      setAiHint(res.data);
      if (typeof res.data?.remaining === 'number') setHintRemaining(res.data.remaining);
    } catch (err) {
      if (err.response?.data?.code === 'QUOTA_EXCEEDED') {
        setQuotaNotice(t('quotaExceeded'));
        setHintRemaining(0);
      } else if (err.response?.status === 429 && err.response.data?.upgrade) {
        setHintLimitMsg(err.response.data.message);
        setHintRemaining(0);
      } else {
        setAiHint({
          hint1: t('aiHintFallback1'),
          hint2: t('aiHintFallback2'),
          hint3: t('aiHintFallback3'),
          commonMistake: t('aiHintFallbackMistake'),
          relatedConcept: t('aiHintFallbackConcept'),
        });
      }
    }
    loadQuota();
    setHintLoading(false);
  };

  return (
    <EmailVerifyGate feature={t('aiFeatureLabel')}>
    <div className="ai-page">
      <div className="ai-left">
        <div className="ai-left-header fade-up">
          <h1>{t('aiPageTitle')}</h1>
          <p>{t('aiPageSubtitle')}</p>
          <div style={{fontSize:12,color:'var(--text3)',marginTop:8}}>
            {quota.limit === -1 ? t('quotaUnlimited') : t('quotaRemaining').replace('{n}', Math.max(0, quota.limit - quota.used))}
          </div>
          <div style={{display:'flex',gap:10,marginTop:14,flexWrap:'wrap'}}>
            <button className="btn btn-primary" style={{padding:'10px 22px'}} onClick={runAnalysis} disabled={analyzing}>
              {analyzing ? <><span className="spinner"/> {t('analyzingStatus')}</> : t('analyzingBtn')}
            </button>
            <button className="btn btn-ghost" style={{padding:'10px 18px'}} onClick={async()=>{
              setQuizLoading(true);
              setQuiz(null);
              setQuizAnswer(null);
              try {
                const r = await api.post('/ai/daily-quiz');
                setQuiz(r.data);
              } catch(e) {
                console.error('Quiz error:', e.message);
              }
              loadQuota();
              setQuizLoading(false);
            }} disabled={quizLoading}>
              {quizLoading?<><span className="spinner"/> {t('generatingQuiz')}</>:t('todayQuizBtn')}
            </button>
          </div>
          {quotaNotice && (
            <div style={{marginTop:14,padding:'12px 14px',borderRadius:10,background:'rgba(227,179,65,.08)',border:'1px solid rgba(227,179,65,.2)',fontSize:13,lineHeight:1.7}}>
              {quotaNotice}
            </div>
          )}
        </div>

        {/* ★ 맞춤 추천 문제 */}
        <div className="ai-card fade-up" style={{marginTop:16}}>
          <div className="ai-card-title">{t('recommendCardTitle')}</div>
          <p style={{fontSize:12,color:'var(--text2)',marginBottom:12}}>
            {t('recommendCardSubtitle')}
          </p>
          {recommendLoading && (
            <div style={{textAlign:'center',padding:'16px 0',color:'var(--text3)',fontSize:13}}>
              <span className="spinner"/> {t('loadingText')}
            </div>
          )}
          {!recommendLoading && recommend.length === 0 && (
            <div style={{textAlign:'center',padding:'16px 0',color:'var(--text3)',fontSize:13}}>
              {t('noRecommendation')}
            </div>
          )}
          {!recommendLoading && recommend.map(p => {
            const ti = TIERS[p.tier];
            return (
              <div key={p.id} onClick={() => navigate('/problems/' + p.id, { state: { problem: p } })}
                className="rec-item" style={{cursor:'pointer'}}>
                <div className="rec-item-left">
                  <span className="tag" style={{background:ti?.bg||'var(--bg3)',color:ti?.color||'var(--text2)'}}>
                    {ti?.label||p.tier}
                  </span>
                  <div>
                    <div style={{fontWeight:600,fontSize:13}}>{p.title}</div>
                    {p.tags?.length > 0 && (
                      <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>{p.tags.slice(0,3).join(' · ')}</div>
                    )}
                  </div>
                </div>
                <span style={{color:'var(--text3)'}}>→</span>
              </div>
            );
          })}
        </div>

        {!analysis && !analyzing && (
          <div className="ai-empty fade-up">
            <div style={{fontSize:48}}>🧠</div>
            <p>{t('aiEmptyPrompt')}<br/>{t('aiEmptyPrompt2')}</p>
            <div className="ai-preview">
              <span className="mono" style={{color:'var(--blue)'}}>{Object.keys(solved).length}</span> {t('previewProblems')} ·&nbsp;
              <span className="mono" style={{color:'var(--yellow)'}}>{user?.streak}</span> {t('previewStreak')} ·&nbsp;
              <span className="mono" style={{color:'var(--green)'}}>{user?.tier}</span> {t('previewTier')}
            </div>
          </div>
        )}

        {quiz && !analyzing && (
          <div className="ai-card fade-up" style={{background:'linear-gradient(135deg,#0d2137,#0d1117)',borderColor:'rgba(121,192,255,.2)'}}>
            <div className="ai-card-title">{t('quizCardTitle')}</div>
            <p style={{fontSize:14,fontWeight:600,marginBottom:14}}>{quiz.question}</p>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {(quiz.options||[]).map((opt,i)=>{
                const ans = Number(quiz.answer);
                return (
                <button key={i}
                  onClick={()=>setQuizAnswer(i)}
                  style={{
                    padding:'10px 14px',borderRadius:8,
                    background: quizAnswer===null ? 'var(--bg3)' :
                      i===ans ? 'rgba(86,211,100,.15)' :
                      i===quizAnswer  ? 'rgba(248,81,73,.12)' : 'var(--bg3)',
                    border: quizAnswer===null ? '1px solid var(--border)' :
                      i===ans ? '1px solid rgba(86,211,100,.4)' :
                      i===quizAnswer  ? '1px solid rgba(248,81,73,.3)'  : '1px solid var(--border)',
                    color: quizAnswer===null ? 'var(--text)' :
                      i===ans ? 'var(--green)' :
                      i===quizAnswer  ? 'var(--red)'   : 'var(--text2)',
                    textAlign:'left',cursor:quizAnswer!==null?'default':'pointer',
                    fontFamily:'inherit',fontSize:13,fontWeight:500,transition:'all .15s',
                  }}
                  disabled={quizAnswer!==null}
                >
                  {String.fromCharCode(65+i)}. {opt}
                  {quizAnswer!==null&&i===ans&&' ✓'}
                </button>
              );})}
            </div>
            {quizAnswer!==null&&(
              <div style={{marginTop:12,padding:'10px 12px',background:'var(--bg3)',borderRadius:8,fontSize:13,color:'var(--text2)',lineHeight:1.7}}>
                <strong style={{color:quizAnswer===Number(quiz.answer)?'var(--green)':'var(--red)'}}>
                  {quizAnswer===Number(quiz.answer)?t('quizCorrect'):t('quizWrong')}
                </strong> {quiz.explanation}
                <div style={{marginTop:4,fontSize:12,color:'var(--text3)'}}>{t('quizRelatedConcept')}{quiz.topic}</div>
              </div>
            )}
          </div>
        )}

        {/* ★ 문제별 AI 힌트 섹션 */}
        <div className="ai-card fade-up" style={{marginTop:16}}>
          <div className="ai-card-title">{t('hintCardTitle')}</div>
          <p style={{fontSize:12,color:'var(--text2)',marginBottom:12}}>{t('hintCardSubtitle')}</p>
          <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:12}}>
            <select value={hintProbId} onChange={e=>{ setHintProbId(e.target.value); setAiHint(null); setHintLevel(0); }}
              style={{flex:1,padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',fontSize:13,fontFamily:'inherit'}}>
              <option value="">{t('hintNoSelect')}</option>
              {allProblems.map(p=><option key={p.id} value={p.id}>#{p.id} {p.title} ({TIERS[p.tier]?.label||p.tier})</option>)}
            </select>
            <button className="btn btn-primary btn-sm" onClick={getHint} disabled={!hintProbId||hintLoading} style={{whiteSpace:'nowrap'}}>
              {hintLoading?<><span className="spinner"/> {t('hintAnalyzing')}</>:t('hintReceive')}
            </button>
          </div>
          {hintRemaining !== null && (
            <div style={{fontSize:12,color: hintRemaining===0?'var(--red)':'var(--text3)',marginTop:6}}>
              {hintRemaining === 0
                ? t('hintExceeded')
                : t('hintRemainingCount').replace('{n}', hintRemaining)
              }
            </div>
          )}
          {hintLimitMsg && !aiHint && (
            <div style={{marginTop:12,padding:'12px 14px',background:'rgba(248,81,73,.08)',border:'1px solid rgba(248,81,73,.25)',borderRadius:8,fontSize:13}}>
              <div style={{color:'var(--red)',fontWeight:600,marginBottom:6}}>{t('hintLimitTitle')}</div>
              <div style={{color:'var(--text2)',marginBottom:10}}>{hintLimitMsg}</div>
              <a href="/pricing" style={{
                display:'inline-block',padding:'6px 14px',borderRadius:7,
                background:'rgba(121,192,255,.15)',color:'var(--blue)',
                fontSize:12,fontWeight:700,textDecoration:'none',
              }}>{t('hintProPlanLink')}</a>
            </div>
          )}
          {aiHint && (
            <div>
              <div style={{display:'flex',gap:8,marginBottom:12}}>
                {[0,1,2].map(i=>(
                  <button key={i} className={`btn btn-sm ${hintLevel>=i?'btn-primary':'btn-ghost'}`}
                    onClick={()=>setHintLevel(Math.max(hintLevel,i))}>
                    {t('hintLevelBtn').replace('{n}', i+1)}
                  </button>
                ))}
              </div>
              {hintLevel>=0&&<div style={{padding:'10px 14px',background:'var(--bg3)',borderRadius:8,marginBottom:8,fontSize:13,color:'var(--text2)',border:'1px solid var(--border)',lineHeight:1.7}}>{aiHint.hint1}</div>}
              {hintLevel>=1&&<div style={{padding:'10px 14px',background:'var(--bg3)',borderRadius:8,marginBottom:8,fontSize:13,color:'var(--text2)',border:'1px solid rgba(121,192,255,.3)',lineHeight:1.7}}>{aiHint.hint2}</div>}
              {hintLevel>=2&&<div style={{padding:'10px 14px',background:'var(--bg3)',borderRadius:8,marginBottom:8,fontSize:13,color:'var(--text2)',border:'1px solid rgba(86,211,100,.3)',lineHeight:1.7}}>{aiHint.hint3}</div>}
              {hintLevel>=2&&aiHint.commonMistake&&(
                <div style={{marginTop:8,fontSize:12,color:'var(--orange)'}}>{t('hintCommonMistake')}{aiHint.commonMistake}</div>
              )}
              {aiHint.relatedConcept&&<div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>{t('hintRelatedConcept')}{aiHint.relatedConcept}</div>}
            </div>
          )}
        </div>

        {analyzing && (
          <div className="ai-loading fade-in">
            <div className="loading-dots"><span/><span/><span/></div>
            <p>{t('aiAnalyzingText')}</p>
          </div>
        )}

        {analysis && (
          <div className="ai-result fade-up">
            <div className="ai-card level-card">
              <div className="ai-card-title">{t('analysisCurrentLevel')}</div>
              <p className="level-text">{analysis.level}</p>
              <div className="motivation-msg">{analysis.motivationMsg}</div>
            </div>
            <div className="sw-row">
              <div className="ai-card" style={{flex:1}}>
                <div className="ai-card-title">{t('analysisStrengths')}</div>
                {analysis.strengths?.map((s,i)=><div key={i} className="sw-item" style={{color:'var(--green)'}}>✓ {s}</div>)}
              </div>
              <div className="ai-card" style={{flex:1}}>
                <div className="ai-card-title">{t('analysisWeaknesses')}</div>
                {analysis.weaknesses?.map((w,i)=><div key={i} className="sw-item" style={{color:'var(--orange)'}}>△ {w}</div>)}
              </div>
            </div>
            <div className="ai-card">
              <div className="ai-card-title">{t('analysisRecommended')}</div>
              {(analysis.recommended || analysis.recommend || []).map((r,i)=>{
                const title = typeof r === 'string' ? r : r.title;
                const reason = typeof r === 'string' ? '' : r.reason;
                const tierKey = typeof r === 'string' ? 'bronze' : (r.tier||'bronze');
                const ti = TIERS[tierKey];
                return (
                  <div key={i} className="rec-item" onClick={()=>goToJudge(title)}>
                    <div className="rec-item-left">
                      <span className="tag" style={{background:ti?.bg||'var(--bg3)',color:ti?.color||'var(--text2)'}}>
                        {ti?.label||tierKey}
                      </span>
                      <div>
                        <div style={{fontWeight:600,fontSize:13}}>{title}</div>
                        {reason && <div style={{fontSize:12,color:'var(--text2)',marginTop:2}}>{reason}</div>}
                      </div>
                    </div>
                    <span style={{color:'var(--text3)'}}>→</span>
                  </div>
                );
              })}
            </div>
            <div className="ai-card">
              <div className="ai-card-title">{t('analysisStudyPlan')}</div>
              <p style={{fontSize:13,color:'var(--text2)',lineHeight:1.7}}>{analysis.studyPlan || analysis.nextMilestone || t('defaultStudyPlan')}</p>
            </div>
          </div>
        )}
        <div className="ai-card fade-up" style={{marginTop:16,background:'linear-gradient(135deg,rgba(188,140,255,.08),rgba(13,17,23,.9))',borderColor:'rgba(188,140,255,.25)'}}>
          <div className="ai-card-title" style={{color:'var(--purple)'}}>🎙️ AI 면접 준비 가이드</div>
          <p style={{fontSize:13,color:'var(--text2)',lineHeight:1.7,marginBottom:12}}>
            AI 채팅창에 아래 질문들을 입력해 모의 면접을 진행해보세요.
          </p>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {[
              '내 풀이 스타일 기반으로 면접 예상 질문 3개 만들어줘',
              '시간복잡도 O(n log n)을 설명하는 면접 답변 예시 알려줘',
              '해시맵을 사용한 알고리즘 문제 면접 답변 전략 알려줘',
            ].map((q) => (
              <button key={q} onClick={() => setInput(q)} style={{
                padding:'8px 12px',borderRadius:8,border:'1px solid rgba(188,140,255,.25)',
                background:'var(--bg3)',color:'var(--text2)',fontSize:12,
                textAlign:'left',cursor:'pointer',fontFamily:'inherit',lineHeight:1.5,
              }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--purple)';e.currentTarget.style.color='var(--text)';}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(188,140,255,.25)';e.currentTarget.style.color='var(--text2)';}}
              >{q}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="ai-right">
        <div className="chat-header">
          <span style={{fontSize:26}}>🤖</span>
          <div>
            <div style={{fontWeight:700,fontSize:14}}>DailyCoding AI (Gemini)</div>
            <div style={{fontSize:12,color:'var(--green)'}}>{t('aiOnline')}</div>
          </div>
        </div>
        <div className="chat-messages">
          {chat.length===0 && (
            <div className="chat-welcome fade-in">
              <div style={{fontSize:36}}>👋</div>
              <p>{t('chatWelcomeLine1').replace('{username}', user?.username || '')}<br/>{t('chatWelcomeLine2')}</p>
              <div className="quick-qs">
                {QUICK_Qs.map(key => <button key={key} className="qq-btn" onClick={() => setInput(t(key))}>{t(key)}</button>)}
              </div>
            </div>
          )}
          {chat.map((m,i)=>(
            <div key={i} className={`chat-bubble ${m.role==='user'?'user':'assistant'} fade-up`}>
              {m.role!=='user'&&<span style={{fontSize:20}}>🤖</span>}
              <div className={`bubble-text ${m.role==='user'?'user':'assistant'}`}
                style={{lineHeight:1.7,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
                {(m.parts?.[0]?.text || '').split(/```([\s\S]*?)```/).map((part, i) =>
                  i % 2 === 1 ? (
                    <pre key={i} style={{
                      background:'var(--bg)',borderRadius:6,padding:'8px 12px',
                      fontSize:11,fontFamily:'Space Mono,monospace',
                      overflowX:'auto',margin:'6px 0',
                      border:'1px solid var(--border)',
                    }}>{part}</pre>
                  ) : <span key={i}>{part}</span>
                )}
              </div>
            </div>
          ))}
          {chatBusy&&(
            <div className="chat-bubble assistant fade-in">
              <span style={{fontSize:20}}>🤖</span>
              <div className="bubble-text assistant typing-dots"><span/><span/><span/></div>
            </div>
          )}
        </div>
        <div className="chat-input-row">
          <input
            value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&sendChat()}
            placeholder={t('chatPlaceholder')}
            disabled={chatBusy}
          />
          <button className="btn btn-primary" onClick={sendChat} disabled={chatBusy||!input.trim()}>{t('sendMessage')}</button>
        </div>
      </div>
    </div>
    </EmailVerifyGate>
  );
}
