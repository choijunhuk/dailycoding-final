import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import api from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { MIN_HIDDEN_TESTCASES } from '../data/problems';
import { JUDGE_LANGUAGE_OPTIONS } from '../data/judgeLanguages.js';
import './AdminPage.css';

const TIER_OPTIONS = ['bronze','silver','gold','platinum','diamond'];
const PROBLEM_TYPE_OPTIONS = [
  { value: 'coding', label: '일반 풀이' },
  { value: 'fill-blank', label: '빈칸 채우기' },
  { value: 'bug-fix', label: '틀린부분 찾기' },
];
const TAG_OPTIONS  = ['수학','다이나믹 프로그래밍','그래프 이론','문자열','구현','소수','BFS','DFS','입출력','탐욕','정렬','이분 탐색','트리','스택/큐'];
const TIER_COLORS  = { bronze:'#cd7f32', silver:'#c0c0c0', gold:'#ffd700', platinum:'#00e5cc', diamond:'#b9f2ff' };
const makeEmptyCases = (count = 10) => Array.from({ length: count }, () => ({ input:'', output:'' }));
const createEmptySpecialConfig = () => ({
  codeTemplate: '',
  blanksText: '',
  buggyCode: '',
  keywordsText: '',
  explanation: '',
});
const createEmptyForm = () => ({
  title:'', tier:'silver', problemType:'coding', preferredLanguage:'python', tags:[],
  timeLimit:'2', memLimit:'256', difficulty:'4', desc:'', inputDesc:'', outputDesc:'',
  examples:[{input:'',output:''}], testcases:makeEmptyCases(), hint:'', solution:'',
  specialConfig: createEmptySpecialConfig(),
});

export default function AdminPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { addNotification, problems: ctxProblems, loadProblems, contests: ctxContests, loadContests } = useApp();
  const toast = useToast();
  const [activeTab,    setActiveTab]    = useState('problems');
  const [problems,     setProblems]     = useState([]);
  const [contests,     setContests]     = useState([]);
  useEffect(() => { if (ctxProblems.length > 0) setProblems(ctxProblems); }, [ctxProblems]);
  useEffect(() => { if (ctxContests.length > 0) setContests(ctxContests); }, [ctxContests]);
  const [view,         setView]         = useState('list');
  const [editTarget,   setEditTarget]   = useState(null);
  const [form,         setForm]         = useState(createEmptyForm);
  const [saving,       setSaving]       = useState(false);
  const [users,        setUsers]        = useState([]);
  const [userSearch,   setUserSearch]   = useState('');
  const [aiPanel,      setAiPanel]      = useState(false);
  const [aiForm,       setAiForm]       = useState({ tier:'silver', tags:[], difficulty:'4', topic:'' });
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPreview,    setAiPreview]    = useState(null);
  const [pwModal,      setPwModal]      = useState(null); // { uid, name }
  const [pwInput,      setPwInput]      = useState('');
  const [confirmModal, setConfirmModal] = useState(null); // { msg, onConfirm }
  const [clearing,     setClearing]     = useState(null);
  const [battleSettings, setBattleSettings] = useState({ codingCount: 2, fillBlankCount: 1, bugFixCount: 1, maxTotalProblems: 8 });
  const [battleSettingsSaving, setBattleSettingsSaving] = useState(false);
  const [adminStats, setAdminStats] = useState(null);
  const [adminStatsLoading, setAdminStatsLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const [stripeOps, setStripeOps] = useState(null);
  const [weeklyChallenge, setWeeklyChallenge] = useState(null);
  const [weeklyForm, setWeeklyForm] = useState({ problemId: '', rewardCode: 'weekly_solver' });
  const [weeklySaving, setWeeklySaving] = useState(false);

  useEffect(() => { api.get('/problems').then(r=>setProblems(r.data)).catch(()=>{}); }, []);
  useEffect(() => {
    if (activeTab==='users') api.get('/auth/users').then(r=>setUsers(Array.isArray(r.data?.users) ? r.data.users : [])).catch(()=>{});
    if (activeTab==='contests') api.get('/contests').then(r=>setContests(r.data)).catch(()=>{});
    if (activeTab==='battle') api.get('/admin/battle-settings').then(r=>setBattleSettings(r.data)).catch(()=>{});
    if (activeTab==='stats') {
      setAdminStatsLoading(true);
      Promise.all([
        api.get('/admin/stats').then(r => r.data).catch(() => null),
        api.get('/admin/ai-status').then(r => r.data).catch(() => null),
        api.get('/weekly').then(r => r.data).catch(() => null),
        api.get('/subscription/ops').then(r => r.data).catch(() => null),
      ]).then(([stats, ai, weekly, stripe]) => {
        setAdminStats(stats);
        setAiStatus(ai);
        setWeeklyChallenge(weekly);
        setStripeOps(stripe);
        if (weekly) {
          setWeeklyForm({
            problemId: String(weekly.problemId || ''),
            rewardCode: weekly.rewardCode || 'weekly_solver',
          });
        }
      }).finally(() => setAdminStatsLoading(false));
    }
  }, [activeTab]);

  if (!isAdmin) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'calc(100vh - 54px)',flexDirection:'column',gap:12}}>
      <div style={{fontSize:48}}>🚫</div>
      <p style={{color:'var(--text2)'}}>관리자만 접근할 수 있습니다.</p>
      <button className="btn btn-primary" onClick={()=>navigate('/')}>돌아가기</button>
    </div>
  );

  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const sf = (k,v) => setForm(p=>({...p,specialConfig:{...p.specialConfig,[k]:v}}));
  const toggleTag    = t => setForm(p=>({...p,tags:p.tags.includes(t)?p.tags.filter(x=>x!==t):[...p.tags,t]}));
  const toggleAiTag  = t => setAiForm(p=>({...p,tags:p.tags.includes(t)?p.tags.filter(x=>x!==t):[...p.tags,t]}));
  const parseCsv = (value) => String(value || '')
    .split(/[\n,]/)
    .map(item => item.trim())
    .filter(Boolean);

  const buildSpecialConfigPayload = () => {
    if (form.problemType === 'fill-blank') {
      return {
        codeTemplate: form.specialConfig.codeTemplate || '',
        blanks: parseCsv(form.specialConfig.blanksText),
        hint: form.hint || '',
      };
    }
    if (form.problemType === 'bug-fix') {
      return {
        buggyCode: form.specialConfig.buggyCode || '',
        keywords: parseCsv(form.specialConfig.keywordsText),
        hint: form.hint || '',
        explanation: form.specialConfig.explanation || '',
      };
    }
    return null;
  };

  const handleAiGenerate = async () => {
    setAiGenerating(true); setAiPreview(null);
    try {
      const res = await api.post('/ai/generate-problem', { tier:aiForm.tier, tags:aiForm.tags, difficulty:aiForm.difficulty, topic:aiForm.topic });
      setAiPreview(res.data);
      setForm({
        title:res.data.title||'', tier:aiForm.tier, problemType:'coding', preferredLanguage:'python', tags:aiForm.tags,
        timeLimit:String(res.data.timeLimit||2), memLimit:String(res.data.memLimit||256), difficulty:aiForm.difficulty,
        desc:res.data.desc||'', inputDesc:res.data.inputDesc||'', outputDesc:res.data.outputDesc||'',
        examples:res.data.examples?.length?res.data.examples:[{input:'',output:''}], testcases:makeEmptyCases(),
        hint:res.data.hint||'', solution:res.data.solution||'', specialConfig: createEmptySpecialConfig(),
      });
    } catch { addNotification('❌ AI 생성 실패. 다시 시도해주세요.'); toast?.show('❌ AI 생성 실패', 'error'); }
    setAiGenerating(false);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.desc.trim()) return;
    const specialConfig = buildSpecialConfigPayload();
    if (form.problemType === 'fill-blank') {
      if (!specialConfig?.codeTemplate?.trim()) {
        toast?.show('빈칸 채우기 문제에는 코드 템플릿이 필요합니다.', 'warning');
        return;
      }
      if (!Array.isArray(specialConfig?.blanks) || specialConfig.blanks.length === 0) {
        toast?.show('빈칸 정답을 쉼표 또는 줄바꿈으로 하나 이상 입력해주세요.', 'warning');
        return;
      }
    }
    if (form.problemType === 'bug-fix') {
      if (!specialConfig?.buggyCode?.trim()) {
        toast?.show('틀린부분 찾기 문제에는 버그 코드가 필요합니다.', 'warning');
        return;
      }
      if (!Array.isArray(specialConfig?.keywords) || specialConfig.keywords.length === 0) {
        toast?.show('정답 키워드를 쉼표 또는 줄바꿈으로 하나 이상 입력해주세요.', 'warning');
        return;
      }
    }
    setSaving(true);
    const payload = {
      title:form.title, tier:form.tier, problemType: form.problemType, preferredLanguage: form.preferredLanguage || null, tags:form.tags,
      timeLimit:Number(form.timeLimit), memLimit:Number(form.memLimit),
      difficulty:Number(form.difficulty), desc:form.desc,
      inputDesc:form.inputDesc, outputDesc:form.outputDesc,
      examples:form.examples.filter(e=>e.input||e.output),
      testcases: form.problemType === 'coding' ? form.testcases.filter(e=>e.input||e.output) : [],
      hint:form.hint, solution:form.solution,
      specialConfig,
    };
    try {
      if (editTarget !== null) {
        const res = await api.put(`/problems/${editTarget}`, payload);
        setProblems(p=>p.map(pr=>pr.id===editTarget?res.data:pr));
        toast?.show(`✏️ "${form.title}" 수정됐습니다.`, 'info');
        loadProblems();
      } else {
        const res = await api.post('/problems', payload);
        setProblems(p=>[res.data,...p]);
        toast?.show(`🆕 "${form.title}" 문제가 등록됐습니다!`, 'success');
        loadProblems();
      }
      setView('list'); setEditTarget(null); setForm(createEmptyForm()); setAiPreview(null); setAiPanel(false);
    } catch (err) { toast?.show('❌ 저장 실패: '+(err.response?.data?.message||''), 'error'); }
    setSaving(false);
  };

  const handleEdit = (prob) => {
    // 상세 정보 로드 (testcases 포함)
    api.get(`/problems/${prob.id}`).then(r => {
      const d = r.data;
      setForm({
        title:d.title, tier:d.tier, problemType:d.problemType || 'coding', preferredLanguage:d.preferredLanguage || 'python', tags:d.tags||[],
        timeLimit:String(d.timeLimit||2), memLimit:String(d.memLimit||256),
        difficulty:String(d.difficulty||5), desc:d.desc||'',
        inputDesc:d.inputDesc||'', outputDesc:d.outputDesc||'',
        examples:d.examples?.length?d.examples:[{input:'',output:''}],
        testcases:d.testcases?.length?d.testcases:makeEmptyCases(),
        hint:d.hint||'', solution:d.solution||'',
        specialConfig: {
          codeTemplate: d.specialConfig?.codeTemplate || '',
          blanksText: Array.isArray(d.specialConfig?.blanks) ? d.specialConfig.blanks.join(', ') : '',
          buggyCode: d.specialConfig?.buggyCode || '',
          keywordsText: Array.isArray(d.specialConfig?.keywords) ? d.specialConfig.keywords.join(', ') : '',
          explanation: d.specialConfig?.explanation || '',
        },
      });
      setEditTarget(d.id); setView('create'); setAiPanel(false); setAiPreview(null);
    }).catch(() => {
      // fallback
      setForm({
        title:prob.title, tier:prob.tier, problemType: prob.problemType || 'coding', preferredLanguage: prob.preferredLanguage || 'python', tags:prob.tags||[],
        timeLimit:String(prob.timeLimit||2), memLimit:String(prob.memLimit||256), difficulty:String(prob.difficulty||5),
        desc:prob.desc||'', inputDesc:prob.inputDesc||'', outputDesc:prob.outputDesc||'',
        examples:prob.examples?.length?prob.examples:[{input:'',output:''}], testcases:prob.testcases?.length?prob.testcases:makeEmptyCases(),
        hint:prob.hint||'', solution:prob.solution||'', specialConfig: createEmptySpecialConfig(),
      });
      setEditTarget(prob.id); setView('create');
    });
  };

  const handleSaveBattleSettings = async () => {
    setBattleSettingsSaving(true);
    try {
      const { data } = await api.put('/admin/battle-settings', battleSettings);
      setBattleSettings(data);
      toast?.show('⚔️ 배틀 설정이 즉시 반영되었습니다.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || '배틀 설정 저장 실패', 'error');
    } finally {
      setBattleSettingsSaving(false);
    }
  };

  const handleDelete = (id, title) => setConfirmModal({ msg:`"${title}" 문제를 삭제하시겠습니까?`, onConfirm: async () => { try { await api.delete(`/problems/${id}`); setProblems(p=>p.filter(pr=>pr.id!==id)); loadProblems(); toast?.show('🗑 문제 삭제됨', 'info'); } catch(err) { toast?.show('❌ 삭제 실패: '+(err.response?.data?.message||err.message), 'error'); } } });
  const handleDeleteContest = (id, name) => setConfirmModal({ msg:`"${name}" 대회를 삭제하시겠습니까?`, onConfirm: async () => { try { await api.delete(`/contests/${id}`); setContests(p=>p.filter(c=>c.id!==id)); loadContests(); toast?.show('🗑 대회 삭제됨', 'info'); } catch(err) { toast?.show('❌ 삭제 실패: '+(err.response?.data?.message||err.message), 'error'); } } });
  const handleContestStart = async (id) => {
    try {
      await api.patch(`/contests/${id}/start`);
      setContests(p=>p.map(c=>c.id===id?{...c,status:'live'}:c));
      toast?.show('🔴 대회 시작!', 'success');
    } catch {
      toast?.show('대회 시작 처리 실패', 'error');
    }
  };
  const handleContestEnd = async (id) => {
    try {
      await api.patch(`/contests/${id}/end`);
      setContests(p=>p.map(c=>c.id===id?{...c,status:'ended'}:c));
      toast?.show('🏁 대회 종료', 'info');
    } catch {
      toast?.show('대회 종료 처리 실패', 'error');
    }
  };
  const handleRoleChange = async (uid, role) => {
    try {
      await api.patch(`/auth/users/${uid}/role`,{role});
      setUsers(p=>p.map(u=>u.id===uid?{...u,role}:u));
    } catch {
      toast?.show('권한 변경 실패', 'error');
    }
  };
  const handleDeleteUser = (uid, name) => setConfirmModal({ msg:`"${name}" 유저를 삭제하시겠습니까?`, onConfirm: async () => {
    try {
      await api.delete(`/auth/users/${uid}`);
      setUsers(p=>p.filter(u=>u.id!==uid));
    } catch {
      toast?.show('유저 삭제 실패', 'error');
    }
  } });
  const handleResetPw = (uid, name) => {
    setPwInput('');
    setPwModal({ uid, name });
  };

  const confirmResetPw = async () => {
    if (!pwInput || pwInput.length < 8) return;
    try {
      await api.patch(`/auth/users/${pwModal.uid}/reset-password`, { newPassword: pwInput });
      toast?.show(`🔒 ${pwModal.name} 비밀번호 리셋됨`, 'success');
      setPwModal(null);
    } catch (err) {
      toast?.show('❌ ' + (err.response?.data?.message || '실패'), 'error');
    }
  };

  const handleClearCache = async (target) => {
    setClearing(target);
    try {
      const labelMap = { all: '전체', leaderboards: '랭킹', heatmaps: '잔디', problems: '문제' };
      await api.post('/admin/cache/clear', { target });
      toast?.show(`✅ ${labelMap[target] || target} 캐시가 초기화되었습니다.`, 'success');
    } catch (err) {
      toast?.show('❌ 캐시 초기화 실패', 'error');
    } finally {
      setClearing(null);
    }
  };

  const handleSaveWeeklyChallenge = async () => {
    if (!weeklyForm.problemId) {
      toast?.show('문제 ID를 입력해주세요.', 'warning');
      return;
    }
    setWeeklySaving(true);
    try {
      await api.post('/weekly', {
        problemId: Number(weeklyForm.problemId),
        rewardCode: weeklyForm.rewardCode || 'weekly_solver',
      });
      const { data } = await api.get('/weekly');
      setWeeklyChallenge(data);
      toast?.show('🏆 이번 주 챌린지가 설정되었습니다.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || '주간 챌린지 설정 실패', 'error');
    } finally {
      setWeeklySaving(false);
    }
  };

  // ── 예제/테스트케이스 공통 렌더러
  const renderCaseEditor = (label, icon, items, fieldKey, color) => (
    <div className="form-group">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <label>{icon} {label}</label>
        <button type="button" className="btn btn-ghost btn-sm" onClick={()=>f(fieldKey,[...items,{input:'',output:''}])}>+ 추가</button>
      </div>
      {items.map((ex,i)=>(
        <div key={i} style={{background:'var(--bg3)',border:`1px solid ${color}30`,borderRadius:8,padding:12,marginBottom:8}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <span style={{fontSize:12,fontWeight:700,color}}>{label} {i+1}</span>
            <button type="button" onClick={()=>f(fieldKey,items.filter((_,j)=>j!==i))} style={{background:'none',border:'none',color:'var(--red)',cursor:'pointer',fontSize:13}}>✕ 삭제</button>
          </div>
          <div className="cf-row" style={{margin:0,gap:8}}>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--text2)',marginBottom:4,textTransform:'uppercase',letterSpacing:.5}}>입력</div>
              <textarea rows={3} className="mono" placeholder="입력값" value={ex.input}
                onChange={e=>{ const arr=[...items]; arr[i]={...arr[i],input:e.target.value}; f(fieldKey,arr); }}
                style={{resize:'vertical',color:'var(--green)',width:'100%'}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--text2)',marginBottom:4,textTransform:'uppercase',letterSpacing:.5}}>출력</div>
              <textarea rows={3} className="mono" placeholder="출력값" value={ex.output}
                onChange={e=>{ const arr=[...items]; arr[i]={...arr[i],output:e.target.value}; f(fieldKey,arr); }}
                style={{resize:'vertical',color:'var(--green)',width:'100%'}}/>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const STATUS_LABELS = { live:'🔴 진행중', upcoming:'📅 대기', waiting:'📅 대기', ended:'🏁 종료' };
  const STATUS_COLORS = { live:'var(--red)', upcoming:'var(--yellow)', waiting:'var(--yellow)', ended:'var(--text3)' };

  // ── 목록 뷰
  if (view==='list') return (
    <div className="admin-page">
      <div className="admin-header fade-up">
        <div><h1>👑 관리자 패널</h1><p>문제·대회·유저를 관리합니다.</p></div>
        {activeTab==='problems' && <button className="btn btn-primary" onClick={()=>{setForm(createEmptyForm());setEditTarget(null);setAiPreview(null);setView('create');}}>+ 문제 만들기</button>}
      </div>
      <div className="admin-tabs fade-up">
        {[['problems','📝 문제'],['contests','🏆 대회'],['users','👥 유저'],['battle','⚔️ 배틀'],['stats','📊 통계'],['system','⚙️ 시스템']].map(([k,l])=>(
          <button key={k} className={`at-btn ${activeTab===k?'active':''}`} onClick={()=>setActiveTab(k)}>{l}</button>
        ))}
      </div>

      {/* ── 문제 탭 */}
      {activeTab==='problems' && (
        <div className="card fade-up" style={{overflow:'hidden'}}>
          {problems.length===0 ? (
            <div className="admin-empty">
              <div style={{fontSize:40}}>📝</div>
              <p>아직 문제가 없어요. 직접 만들거나 AI로 생성해보세요!</p>
              <button className="btn btn-primary btn-sm" onClick={()=>setView('create')}>문제 만들기</button>
            </div>
          ) : (
            <table className="admin-table">
              <thead><tr><th style={{width:60}}>번호</th><th>제목</th><th style={{width:90}}>유형</th><th style={{width:90}}>티어</th><th style={{width:70}}>난이도</th><th style={{width:80}}>공개 범위</th><th style={{width:90}}>히든</th><th style={{width:90}}>제출</th><th style={{width:120}}>액션</th></tr></thead>
              <tbody>
                {problems.map(p=>(
                  <tr key={p.id} className="at-row">
                    <td className="mono" style={{fontSize:11,color:'var(--text3)'}}>#{p.id}</td>
                    <td style={{fontWeight:600}}>{p.title}</td>
                    <td><span className="tag" style={{fontSize:10,background:'var(--bg3)',color:'var(--text2)'}}>{p.problemType || 'coding'}</span></td>
                    <td><span style={{fontSize:11,fontWeight:700,fontFamily:'Space Mono,monospace',color:TIER_COLORS[p.tier]}}>● {p.tier}</span></td>
                    <td className="mono" style={{fontSize:12}}>{p.difficulty}/10</td>
                    <td><span className="tag" style={{background:p.visibility==='contest'?'var(--purple)':'var(--bg3)',color:p.visibility==='contest'?'#fff':'var(--text2)',fontSize:10}}>{p.visibility==='contest'?'🏆 대회용':'🌍 전체'}</span></td>
                    <td className="mono" style={{fontSize:12,color:(p.hiddenCount||0) >= MIN_HIDDEN_TESTCASES ? 'var(--green)' : 'var(--orange)'}}>{p.hiddenCount || 0}</td>
                    <td className="mono" style={{fontSize:12,color:'var(--text2)'}}>{p.submissions||0}</td>
                    <td><div style={{display:'flex',gap:5}}>
                      <button className="btn btn-ghost btn-sm" onClick={()=>handleEdit(p)}>✏️</button>
                      <button className="btn btn-sm" style={{background:'rgba(248,81,73,.1)',color:'var(--red)',border:'1px solid rgba(248,81,73,.3)'}} onClick={()=>handleDelete(p.id,p.title)}>🗑</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── 대회 탭 */}
      {activeTab==='contests' && (
        <div className="card fade-up" style={{overflow:'hidden'}}>
          {contests.length===0 ? (
            <div className="admin-empty">
              <div style={{fontSize:40}}>🏆</div>
              <p>등록된 대회가 없습니다.</p>
            </div>
          ) : (
            <table className="admin-table">
              <thead><tr><th style={{width:40}}>ID</th><th>대회명</th><th style={{width:90}}>상태</th><th style={{width:70}}>참가자</th><th style={{width:80}}>시간</th><th style={{width:180}}>액션</th></tr></thead>
              <tbody>
                {contests.map(c=>(
                  <tr key={c.id} className="at-row">
                    <td className="mono" style={{fontSize:11,color:'var(--text3)'}}>#{c.id}</td>
                    <td style={{fontWeight:600}}>{c.name}</td>
                    <td><span style={{fontSize:11,fontWeight:700,color:STATUS_COLORS[c.status]||'var(--text3)'}}>{STATUS_LABELS[c.status]||c.status}</span></td>
                    <td className="mono" style={{fontSize:12}}>{c.participants||0}/{c.max||20}</td>
                    <td className="mono" style={{fontSize:12,color:'var(--text2)'}}>{c.duration||60}분</td>
                    <td><div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                      {(c.status==='upcoming'||c.status==='waiting')&&<button className="btn btn-sm" style={{background:'rgba(86,211,100,.1)',color:'var(--green)',border:'1px solid rgba(86,211,100,.3)',fontSize:11}} onClick={()=>handleContestStart(c.id)}>▶ 시작</button>}
                      {(c.status==='live'||c.status==='running')&&<button className="btn btn-sm" style={{background:'rgba(227,179,65,.1)',color:'var(--yellow)',border:'1px solid rgba(227,179,65,.3)',fontSize:11}} onClick={()=>handleContestEnd(c.id)}>⏹ 종료</button>}
                      <button className="btn btn-sm" style={{background:'rgba(248,81,73,.1)',color:'var(--red)',border:'1px solid rgba(248,81,73,.3)',fontSize:11}} onClick={()=>handleDeleteContest(c.id,c.name)}>🗑 삭제</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── 유저 탭 */}
      {activeTab==='users' && (
        <div className="card fade-up" style={{overflow:'hidden'}}>
          <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)'}}>
            <input
              placeholder="🔍 닉네임 또는 이메일 검색..."
              value={userSearch}
              onChange={e=>setUserSearch(e.target.value)}
              style={{width:'100%',padding:'8px 12px',fontSize:13,borderRadius:8,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)'}}
            />
          </div>
          {users.length===0 ? <div className="admin-empty"><p>유저 없음</p></div> : (
            <table className="admin-table">
              <thead><tr><th style={{width:40}}>ID</th><th>닉네임</th><th>이메일</th><th style={{width:80}}>티어</th><th style={{width:80}}>레이팅</th><th style={{width:80}}>권한</th><th style={{width:110}}>액션</th></tr></thead>
              <tbody>
                {users.filter(u=>!userSearch||u.username?.toLowerCase().includes(userSearch.toLowerCase())||u.email?.toLowerCase().includes(userSearch.toLowerCase())).map(u=>(
                  <tr key={u.id} className="at-row">
                    <td className="mono" style={{fontSize:11,color:'var(--text3)'}}>#{u.id}</td>
                    <td style={{fontWeight:600}}>{u.username}{u.role==='admin'&&<span style={{marginLeft:6,fontSize:9,color:'var(--yellow)',fontWeight:700}}>ADMIN</span>}</td>
                    <td style={{fontSize:12,color:'var(--text2)'}}>{u.email}</td>
                    <td><span style={{fontSize:11,fontWeight:700,fontFamily:'Space Mono,monospace',color:TIER_COLORS[u.tier]}}>● {u.tier}</span></td>
                    <td className="mono" style={{fontSize:12,color:'var(--blue)'}}>{u.rating}</td>
                    <td><select value={u.role} onChange={e=>handleRoleChange(u.id,e.target.value)} style={{padding:'3px 6px',fontSize:12,width:'auto'}}><option value="user">일반</option><option value="admin">관리자</option></select></td>
                    <td style={{display:'flex',gap:4}}>
                      <button className="btn btn-sm" style={{background:'rgba(227,179,65,.1)',color:'var(--yellow)',border:'1px solid rgba(227,179,65,.3)',fontSize:11}} onClick={()=>handleResetPw(u.id,u.username)}>PW</button>
                      <button className="btn btn-sm" style={{background:'rgba(248,81,73,.1)',color:'var(--red)',border:'1px solid rgba(248,81,73,.3)'}} onClick={()=>handleDeleteUser(u.id,u.username)}>삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── 통계 탭 */}
      {activeTab==='battle' && (
        <div className="fade-up" style={{maxWidth:720}}>
          <div className="card" style={{padding:20}}>
            <h3 style={{marginBottom:8}}>⚔️ 배틀 문제 출제 설정</h3>
            <p style={{fontSize:13,color:'var(--text2)',marginBottom:16}}>
              저장 즉시 새로 생성되는 배틀 방부터 반영됩니다.
            </p>
            <div className="cf-row">
              <div className="form-group" style={{flex:1}}>
                <label>코딩 문제 수</label>
                <input type="number" min="1" max="8" value={battleSettings.codingCount}
                  onChange={e=>setBattleSettings(p=>({...p,codingCount:e.target.value}))} />
              </div>
              <div className="form-group" style={{flex:1}}>
                <label>빈칸 채우기 수</label>
                <input type="number" min="0" max="6" value={battleSettings.fillBlankCount}
                  onChange={e=>setBattleSettings(p=>({...p,fillBlankCount:e.target.value}))} />
              </div>
              <div className="form-group" style={{flex:1}}>
                <label>틀린부분 찾기 수</label>
                <input type="number" min="0" max="6" value={battleSettings.bugFixCount}
                  onChange={e=>setBattleSettings(p=>({...p,bugFixCount:e.target.value}))} />
              </div>
            </div>
            <div className="cf-row" style={{alignItems:'end'}}>
              <div className="form-group" style={{flex:1}}>
                <label>최대 문제 수</label>
                <input type="number" min="3" max="20" value={battleSettings.maxTotalProblems}
                  onChange={e=>setBattleSettings(p=>({...p,maxTotalProblems:e.target.value}))} />
              </div>
              <div style={{fontSize:12,color:'var(--text2)',marginBottom:10,flex:2}}>
                현재 합계: {Number(battleSettings.codingCount||0) + Number(battleSettings.fillBlankCount||0) + Number(battleSettings.bugFixCount||0)}문제
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleSaveBattleSettings} disabled={battleSettingsSaving}>
              {battleSettingsSaving ? <><span className="spinner"/> 저장 중...</> : '설정 저장'}
            </button>
          </div>
        </div>
      )}

      {/* ── 통계 탭 */}
      {activeTab==='stats' && (
        <div className="admin-stats-grid fade-up">
          {[
            {label:'총 유저', value:adminStats?.userStats?.total ?? '—', color:'var(--blue)', sub: adminStats ? `이번 주 +${adminStats.userStats.newThisWeek}` : ''},
            {label:'오늘 제출', value:adminStats?.submissionStats?.totalToday ?? '—', color:'var(--green)', sub: adminStats ? `정답률 ${adminStats.submissionStats.correctRate}%` : ''},
            {label:'오늘 활성 유저', value:adminStats?.userStats?.activeToday ?? '—', color:'var(--yellow)'},
            {label:'등록 문제', value:problems.length, color:'var(--purple)'},
          ].map(s=>(
            <div key={s.label} className="card admin-stat-card">
              <div className="asc-value mono" style={{color:s.color}}>{s.value}</div>
              <div className="asc-label">{s.label}</div>
              {s.sub ? <div style={{fontSize:11,color:'var(--text3)',marginTop:6}}>{s.sub}</div> : null}
            </div>
          ))}
          <div className="card admin-stat-card" style={{gridColumn:'span 2'}}>
            <div className="asc-label" style={{marginBottom:12}}>유저 티어 분포</div>
            <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
              {Object.entries({ unranked:'#666', ...TIER_COLORS }).map(([tier,color])=>{
                const cnt = adminStats?.tierDistribution?.[tier] ?? 0;
                return <div key={tier} style={{textAlign:'center'}}><div style={{fontFamily:'Space Mono,monospace',fontSize:24,fontWeight:700,color}}>{cnt}</div><div style={{fontSize:11,color:'var(--text2)',marginTop:2}}>{tier}</div></div>;
              })}
            </div>
          </div>
          <div className="card admin-stat-card" style={{gridColumn:'span 2', textAlign:'left'}}>
            <div className="asc-label" style={{marginBottom:12}}>인기 문제 TOP 5</div>
            {adminStatsLoading && <div style={{fontSize:12,color:'var(--text3)'}}>통계를 불러오는 중입니다.</div>}
            {!adminStatsLoading && (adminStats?.popularProblems || []).map((problem, index, arr) => {
              const max = Math.max(...arr.map((item) => item.solveCount || 0), 1);
              return (
                <div key={problem.id} style={{marginBottom:index < arr.length - 1 ? 12 : 0}}>
                  <div style={{display:'flex',justifyContent:'space-between',gap:10,fontSize:12,marginBottom:6}}>
                    <span>{problem.title}</span>
                    <span style={{color:'var(--text3)'}}>{problem.solveCount}명 풀이</span>
                  </div>
                  <div style={{height:8,background:'var(--bg3)',borderRadius:4,overflow:'hidden'}}>
                    <div style={{width:`${(problem.solveCount / max) * 100}%`,height:'100%',background:'var(--blue)',borderRadius:4}} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="card admin-stat-card" style={{gridColumn:'span 2', textAlign:'left'}}>
            <div className="asc-label" style={{marginBottom:12}}>AI 운영 상태</div>
            {!aiStatus && <div style={{fontSize:12,color:'var(--text3)'}}>AI 상태를 불러오지 못했습니다.</div>}
            {aiStatus && (
              <div style={{display:'grid', gap:12}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))',gap:10}}>
                  {[
                    { label:'API 설정', value: aiStatus.configured ? '정상' : '키 없음', color: aiStatus.configured ? 'var(--green)' : 'var(--red)' },
                    { label:'현재 모델', value: aiStatus.primaryModel || '없음', color:'var(--blue)' },
                    { label:'쿨다운', value: aiStatus.providerCooldown ? `${aiStatus.providerCooldownSec}s` : '없음', color: aiStatus.providerCooldown ? 'var(--yellow)' : 'var(--green)' },
                    { label:'Fallback률', value: `${aiStatus.metricsToday?.fallbackRate || 0}%`, color: Number(aiStatus.metricsToday?.fallbackRate || 0) > 30 ? 'var(--orange)' : 'var(--green)' },
                  ].map(item => (
                    <div key={item.label} style={{padding:'10px 12px',borderRadius:12,background:'var(--bg3)',border:'1px solid var(--border)',minWidth:0}}>
                      <div style={{fontSize:11,color:'var(--text3)',marginBottom:4}}>{item.label}</div>
                      <div style={{fontWeight:800,color:item.color,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.8}}>
                  오늘 성공 {aiStatus.metricsToday?.success || 0}회 · fallback {aiStatus.metricsToday?.fallback || 0}회 · provider 호출 {aiStatus.metricsToday?.providerCalls || 0}회
                  {aiStatus.fallbackModels?.length ? <><br/>Fallback 모델: {aiStatus.fallbackModels.slice(0, 4).join(', ')}</> : null}
                  {aiStatus.lastEvent?.at ? <><br/>최근 이벤트: {aiStatus.lastEvent.source}{aiStatus.lastEvent.reason ? ` (${aiStatus.lastEvent.reason})` : ''} · {new Date(aiStatus.lastEvent.at).toLocaleString('ko-KR')}</> : null}
                </div>
              </div>
            )}
          </div>
          <div className="card admin-stat-card" style={{gridColumn:'span 2', textAlign:'left'}}>
            <div className="asc-label" style={{marginBottom:12}}>Stripe 운영 상태</div>
            {!stripeOps && <div style={{fontSize:12,color:'var(--text3)'}}>Stripe 상태를 불러오지 못했습니다.</div>}
            {stripeOps && (
              <div style={{display:'grid', gap:12}}>
                <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                  {[
                    { label:'모드', value: stripeOps.mode, color:'var(--blue)' },
                    { label:'설정', value: stripeOps.configured ? '정상' : '미완료', color: stripeOps.configured ? 'var(--green)' : 'var(--red)' },
                    { label:'Webhook', value: stripeOps.webhookConfigured ? '활성' : '없음', color: stripeOps.webhookConfigured ? 'var(--green)' : 'var(--yellow)' },
                    { label:'Secret Key', value: stripeOps.secretKeyConfigured ? '설정됨' : '없음', color: stripeOps.secretKeyConfigured ? 'var(--green)' : 'var(--yellow)' },
                  ].map((item) => (
                    <div key={item.label} style={{minWidth:110,padding:'10px 12px',borderRadius:12,background:'var(--bg3)',border:'1px solid var(--border)'}}>
                      <div style={{fontSize:11,color:'var(--text3)',marginBottom:4}}>{item.label}</div>
                      <div style={{fontWeight:800,color:item.color}}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))',gap:10}}>
                  {Object.entries(stripeOps.plans || {}).map(([planKey, planValue]) => (
                    <div key={planKey} style={{padding:'12px 14px',borderRadius:12,background:'var(--bg3)',border:'1px solid var(--border)'}}>
                      <div style={{fontWeight:800,marginBottom:8}}>{planKey === 'pro' ? '프로' : '팀'}</div>
                      <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.7}}>
                        월 Price ID: {planValue.monthlyPriceId ? '있음' : '없음'}<br />
                        연 Price ID: {planValue.annualPriceId ? '있음' : '없음'}<br />
                        월 결제링크: {planValue.monthlyPaymentLink ? '있음' : '없음'}<br />
                        연 결제링크: {planValue.annualPaymentLink ? '있음' : '없음'}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:12,color:'var(--text2)'}}>
                  최근 이벤트: {stripeOps.lastEvent?.eventType || '없음'}
                  {stripeOps.lastEvent?.recordedAt ? ` · ${new Date(stripeOps.lastEvent.recordedAt).toLocaleString('ko-KR')}` : ''}
                </div>
                {stripeOps.lastError && (
                  <div style={{fontSize:12,color:'var(--red)'}}>
                    최근 에러: {stripeOps.lastError.message}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="card admin-stat-card" style={{gridColumn:'span 2', textAlign:'left'}}>
            <div className="asc-label" style={{marginBottom:12}}>주간 챌린지 설정</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:10,alignItems:'end'}}>
              <div className="form-group">
                <label>문제 ID</label>
                <input
                  type="number"
                  value={weeklyForm.problemId}
                  onChange={(e) => setWeeklyForm((prev) => ({ ...prev, problemId: e.target.value }))}
                  placeholder="예: 12"
                />
              </div>
              <div className="form-group">
                <label>보상 코드</label>
                <input
                  value={weeklyForm.rewardCode}
                  onChange={(e) => setWeeklyForm((prev) => ({ ...prev, rewardCode: e.target.value }))}
                  placeholder="weekly_solver"
                />
              </div>
              <button className="btn btn-primary" onClick={handleSaveWeeklyChallenge} disabled={weeklySaving}>
                {weeklySaving ? <span className="spinner"/> : '설정'}
              </button>
            </div>
            <div style={{marginTop:14,padding:14,borderRadius:12,background:'var(--bg3)',border:'1px solid var(--border)',fontSize:13}}>
              {weeklyChallenge ? (
                <>
                  <div style={{fontWeight:700,marginBottom:4}}>현재 이번 주 챌린지</div>
                  <div>{weeklyChallenge.problemTitle} · {weeklyChallenge.tier} · 보상 {weeklyChallenge.rewardCode}</div>
                  <div style={{fontSize:11,color:'var(--text3)',marginTop:6}}>
                    {weeklyChallenge.weekStart} ~ {weeklyChallenge.weekEnd}
                  </div>
                </>
              ) : (
                <div style={{color:'var(--text3)'}}>이번 주에 지정된 챌린지가 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 시스템 탭 */}
      {activeTab==='system' && (
        <div className="fade-up" style={{maxWidth:640}}>
          <div className="card" style={{padding:24}}>
            <h3 style={{marginBottom:12}}>⚙️ 시스템 관리 (Maintenance)</h3>
            <p style={{fontSize:13,color:'var(--text2)',marginBottom:24,lineHeight:1.6}}>
              플랫폼의 실시간 데이터(랭킹, 잔디 등)는 성능 최적화를 위해 Redis 캐시를 사용합니다.<br/>
              데이터 불일치나 초기화가 필요한 경우 아래 버튼을 사용하세요.
            </p>

            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {[
                {id:'leaderboards', label:'🏆 랭킹 & 리더보드 캐시', desc:'대회 순위 및 전체 랭킹 데이터를 초기화합니다.'},
                {id:'heatmaps',     label:'🌱 유저 활동 잔디 캐시', desc:'프로필의 일일 풀이 내역 캐시를 초기화합니다.'},
                {id:'problems',     label:'📝 문제 정보 캐시',     desc:'문제 상세 및 목록 캐시를 초기화합니다.'},
                {id:'all',          label:'🔥 전체 캐시 초기화',   desc:'시스템의 모든 캐시 데이터를 삭제합니다.', danger:true},
              ].map(item => (
                <div key={item.id} style={{
                  display:'flex',alignItems:'center',gap:16,padding:16,
                  background:'var(--bg3)',borderRadius:12,border:'1px solid var(--border)'
                }}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14,color:item.danger?'var(--red)':'var(--text)'}}>{item.label}</div>
                    <div style={{fontSize:12,color:'var(--text3)',marginTop:4}}>{item.desc}</div>
                  </div>
                  <button 
                    className={`btn ${item.danger?'btn-danger':'btn-ghost'} btn-sm`}
                    onClick={() => handleClearCache(item.id)}
                    disabled={clearing === item.id}
                    style={{minWidth:80}}
                  >
                    {clearing === item.id ? <span className="spinner"/> : '초기화'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 비밀번호 리셋 모달 (prompt() 대체) */}
      {confirmModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setConfirmModal(null)}>
          <div className="modal-box card fade-up" style={{maxWidth:380}}>
            <h3 style={{marginBottom:8}}>⚠️ 삭제 확인</h3>
            <p style={{fontSize:13,color:'var(--text2)',marginBottom:20}}>{confirmModal.msg}</p>
            <div className="modal-actions" style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button className="btn btn-ghost" onClick={()=>setConfirmModal(null)}>취소</button>
              <button className="btn btn-primary" style={{background:'var(--red)',borderColor:'var(--red)'}}
                onClick={async()=>{ await confirmModal.onConfirm(); setConfirmModal(null); }}>삭제</button>
            </div>
          </div>
        </div>
      )}
      {pwModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setPwModal(null)}>
          <div className="modal-box card fade-up" style={{maxWidth:400}}>
            <h3 style={{marginBottom:4}}>🔒 비밀번호 리셋</h3>
            <p style={{fontSize:13,color:'var(--text2)',marginBottom:16}}>"{pwModal.name}"의 새 비밀번호를 입력하세요.</p>
            <div className="form-group">
              <label style={{fontSize:12,fontWeight:600}}>새 비밀번호 (8자 이상)</label>
              <input
                type="password"
                value={pwInput}
                onChange={e=>setPwInput(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&confirmResetPw()}
                placeholder="새 비밀번호 입력"
                autoFocus
                style={{width:'100%',marginTop:6}}
              />
            </div>
            <div className="modal-actions" style={{marginTop:16,display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button className="btn btn-ghost" onClick={()=>setPwModal(null)}>취소</button>
              <button className="btn btn-primary" onClick={confirmResetPw} disabled={!pwInput||pwInput.length<8}>확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── 생성/수정 폼
  return (
    <div className="admin-page">
      <div className="admin-header fade-up">
        <div><h1>{editTarget!==null?'✏️ 문제 수정':'➕ 문제 만들기'}</h1><p>직접 작성하거나 AI 자동 생성을 이용하세요.</p></div>
        <div style={{display:'flex',gap:10}}>
          {editTarget===null&&<button className={`btn ${aiPanel?'btn-primary':'btn-ghost'}`} onClick={()=>setAiPanel(p=>!p)}>🤖 AI 자동 생성</button>}
          <button className="btn btn-ghost" onClick={()=>{setView('list');setEditTarget(null);setForm(createEmptyForm());setAiPreview(null);setAiPanel(false);}}>← 목록</button>
        </div>
      </div>

      {aiPanel && (
        <div className="card ai-gen-panel fade-up">
          <div className="ai-gen-title">🤖 Gemini AI로 문제 자동 생성</div>
          <div className="cf-row">
            <div className="form-group" style={{flex:1}}><label>티어</label><select value={aiForm.tier} onChange={e=>setAiForm(p=>({...p,tier:e.target.value}))}>{TIER_OPTIONS.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
            <div className="form-group" style={{flex:1}}><label>난이도</label><input type="number" min="1" max="10" value={aiForm.difficulty} onChange={e=>setAiForm(p=>({...p,difficulty:e.target.value}))} /></div>
            <div className="form-group" style={{flex:2}}><label>주제/키워드</label><input placeholder="예: 피보나치, 소수, 최단경로..." value={aiForm.topic} onChange={e=>setAiForm(p=>({...p,topic:e.target.value}))} /></div>
          </div>
          <div className="form-group">
            <label>알고리즘 태그</label>
            <div className="tag-picker">{TAG_OPTIONS.map(t=><button key={t} type="button" className={`tag-pick-btn ${aiForm.tags.includes(t)?'selected':''}`} onClick={()=>toggleAiTag(t)}>{t}</button>)}</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <button className="btn btn-primary" onClick={handleAiGenerate} disabled={aiGenerating} style={{padding:'10px 24px'}}>
              {aiGenerating?<><span className="spinner"/> 생성 중 (Gemini)...</>:'✨ 문제 자동 생성'}
            </button>
            {aiPreview&&<span style={{fontSize:13,color:'var(--green)'}}>✓ 생성 완료! 아래 내용 확인 후 등록하세요.</span>}
          </div>
        </div>
      )}

      <div className="create-form fade-up" style={{animationDelay:'.05s'}}>
        <div className="card cf-section">
          <div className="cf-section-title">기본 정보</div>
          <div className="cf-row">
            <div className="form-group" style={{flex:3}}><label>문제 제목 *</label><input placeholder="문제 제목" value={form.title} onChange={e=>f('title',e.target.value)} /></div>
            <div className="form-group" style={{flex:1}}>
              <label>유형</label>
              <select value={form.problemType} onChange={e=>f('problemType',e.target.value)}>
                {PROBLEM_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{flex:1}}>
              <label>권장 언어</label>
              <select value={form.preferredLanguage} onChange={e=>f('preferredLanguage',e.target.value)}>
                {JUDGE_LANGUAGE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{flex:1}}><label>티어</label><select value={form.tier} onChange={e=>f('tier',e.target.value)}>{TIER_OPTIONS.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
            <div className="form-group" style={{flex:1}}><label>난이도</label><input type="number" min="1" max="10" value={form.difficulty} onChange={e=>f('difficulty',e.target.value)} /></div>
          </div>
          <div className="cf-row">
            <div className="form-group" style={{flex:1}}><label>시간 제한 (초)</label><input type="number" min="1" value={form.timeLimit} onChange={e=>f('timeLimit',e.target.value)} /></div>
            <div className="form-group" style={{flex:1}}><label>메모리 제한 (MB)</label><input type="number" min="32" value={form.memLimit} onChange={e=>f('memLimit',e.target.value)} /></div>
          </div>
          <div className="form-group"><label>태그</label><div className="tag-picker">{TAG_OPTIONS.map(t=><button key={t} type="button" className={`tag-pick-btn ${form.tags.includes(t)?'selected':''}`} onClick={()=>toggleTag(t)}>{t}</button>)}</div></div>
        </div>

        <div className="card cf-section">
          <div className="cf-section-title">문제 내용</div>
          <div className="form-group"><label>문제 설명 *</label><textarea rows={4} placeholder="문제를 설명하세요..." value={form.desc} onChange={e=>f('desc',e.target.value)} style={{resize:'vertical'}} /></div>
          {form.problemType === 'coding' && (
            <>
              <div className="cf-row">
                <div className="form-group" style={{flex:1}}><label>입력 설명</label><textarea rows={3} placeholder="입력 형식..." value={form.inputDesc} onChange={e=>f('inputDesc',e.target.value)} style={{resize:'vertical'}} /></div>
                <div className="form-group" style={{flex:1}}><label>출력 설명</label><textarea rows={3} placeholder="출력 형식..." value={form.outputDesc} onChange={e=>f('outputDesc',e.target.value)} style={{resize:'vertical'}} /></div>
              </div>
            </>
          )}

          {form.problemType === 'fill-blank' && (
            <>
              <div className="form-group">
                <label>빈칸 코드 템플릿</label>
                <textarea rows={6} className="mono" placeholder={'예: if n <= ___1___:'} value={form.specialConfig.codeTemplate} onChange={e=>sf('codeTemplate',e.target.value)} style={{resize:'vertical'}} />
              </div>
              <div className="form-group">
                <label>정답 빈칸 목록 (쉼표 구분)</label>
                <input placeholder="예: 1, 1, 2" value={form.specialConfig.blanksText} onChange={e=>sf('blanksText',e.target.value)} />
              </div>
            </>
          )}

          {form.problemType === 'bug-fix' && (
            <>
              <div className="form-group">
                <label>버그 코드</label>
                <textarea rows={6} className="mono" placeholder="버그가 있는 코드" value={form.specialConfig.buggyCode} onChange={e=>sf('buggyCode',e.target.value)} style={{resize:'vertical'}} />
              </div>
              <div className="form-group">
                <label>정답 키워드 (쉼표 구분)</label>
                <input placeholder="예: n - i - 1, arr[0]" value={form.specialConfig.keywordsText} onChange={e=>sf('keywordsText',e.target.value)} />
              </div>
              <div className="form-group">
                <label>해설</label>
                <textarea rows={3} placeholder="왜 틀렸는지 설명" value={form.specialConfig.explanation} onChange={e=>sf('explanation',e.target.value)} style={{resize:'vertical'}} />
              </div>
            </>
          )}

          {/* ★ 예제 테스트케이스 (유저에게 보임) */}
          {renderCaseEditor('예제 테스트케이스', '📋', form.examples, 'examples', 'var(--blue)')}

          {/* ★ 히든 테스트케이스 (채점용 + 공개 표시) */}
          {form.problemType === 'coding' && <div style={{borderTop:'2px dashed var(--border)',paddingTop:16,marginTop:8}}>
            <div style={{fontSize:12,color:'var(--orange)',fontWeight:700,marginBottom:4}}>🔒 일반 코딩 문제는 히든 테스트케이스가 최소 {MIN_HIDDEN_TESTCASES}개 필요합니다.</div>
            {renderCaseEditor('히든 테스트케이스 (채점용)', '🔒', form.testcases, 'testcases', 'var(--orange)')}
          </div>}
          {form.problemType !== 'coding' && (
            <div style={{marginTop:12,padding:'12px 14px',borderRadius:10,background:'var(--bg3)',border:'1px solid var(--border)',fontSize:12,color:'var(--text2)',lineHeight:1.6}}>
              {form.problemType === 'fill-blank'
                ? '빈칸 채우기 문제는 코드 템플릿 + 정답 목록으로 채점합니다. 히든 테스트케이스는 저장하지 않습니다.'
                : '틀린부분 찾기 문제는 버그 코드 + 정답 키워드로 채점합니다. 히든 테스트케이스는 저장하지 않습니다.'}
            </div>
          )}

          <div className="form-group"><label>힌트</label><textarea rows={2} placeholder="풀이 힌트..." value={form.hint} onChange={e=>f('hint',e.target.value)} style={{resize:'vertical'}} /></div>
          <div className="form-group"><label>모범 답안 (관리자만 표시)</label><textarea rows={4} className="mono" placeholder="# 모범 답안 코드..." value={form.solution} onChange={e=>f('solution',e.target.value)} style={{resize:'vertical',color:'var(--green)'}} /></div>
        </div>

        <div className="cf-actions">
          <button className="btn btn-ghost" onClick={()=>{setView('list');setEditTarget(null);setForm(createEmptyForm());setAiPreview(null);setAiPanel(false);}}>취소</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving||!form.title.trim()||!form.desc.trim()}>
            {saving?<span className="spinner"/>:editTarget!==null?'수정 저장':'문제 등록 →'}
          </button>
        </div>
      </div>
    </div>
  );
}
