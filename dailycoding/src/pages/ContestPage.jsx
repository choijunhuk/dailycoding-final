import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import api from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { MIN_HIDDEN_TESTCASES } from '../data/problems';
import EmailVerifyGate from '../components/EmailVerifyGate.jsx';
import { useLang } from '../context/LangContext.jsx';
import './ContestPage.css';

const CONTEST_TIER_OPTIONS = ['bronze','silver','gold','platinum','diamond'];
const CONTEST_TAG_OPTIONS = ['수학','다이나믹 프로그래밍','그래프 이론','문자열','구현','소수','BFS','DFS','입출력','탐욕','정렬','이분 탐색','트리','스택/큐'];
const makeContestCases = (count = 10) => Array.from({ length: count }, () => ({ input:'', output:'' }));
const DEFAULT_CONTEST_REWARD_RULES = [
  { rankFrom: 1, rankTo: 1, rewardCode: 'badge_contest1' },
  { rankFrom: 1, rankTo: 1, rewardCode: 'title_champion' },
  { rankFrom: 2, rankTo: 2, rewardCode: 'badge_contest2' },
  { rankFrom: 3, rankTo: 3, rewardCode: 'badge_contest3' },
];
const createContestForm = () => ({
  name:'', desc:'', duration:'60', privacy:'비공개', joinType:'direct', securityCode:'', max:'20',
  rewardRules: DEFAULT_CONTEST_REWARD_RULES.map((rule) => ({ ...rule })),
});
const createContestProblemForm = () => ({
  title:'', tier:'silver', difficulty:'4', timeLimit:'2', memLimit:'256',
  desc:'', inputDesc:'', outputDesc:'', tags:[], examples:[{ input:'', output:'' }],
  testcases:makeContestCases(), hint:'', solution:'',
});

function getRewardCodesForRank(rules = [], rankPosition) {
  if (!Array.isArray(rules)) return [];
  return rules
    .filter((rule) => Number(rule.rankFrom) <= rankPosition && Number(rule.rankTo) >= rankPosition)
    .map((rule) => rule.rewardCode)
    .filter(Boolean);
}

export default function ContestPage() {
  const { isAdmin, user } = useAuth();
  const { addNotification, problems: allProblems } = useApp();
  const toast = useToast();
  const { t } = useLang();

  const [contests,   setContests]   = useState([]);
  const [filter,     setFilter]     = useState('all');
  const [searchQuery,setSearchQuery]= useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [joined,     setJoined]     = useState({}); // contestId -> { status: 'joined' | 'pending' | 'rejected' }
  const [liveContest,setLiveContest]= useState(null);
  const [form,       setForm]       = useState(createContestForm);
  const [creating,   setCreating]   = useState(false);
  const [busy,       setBusy]       = useState({});
  const [mgmtContest,setMgmtContest]= useState(null);   // 문제 관리 중인 대회
  const [mgmtProblems,setMgmtProblems]= useState([]);   // 해당 대회 문제 목록
  const [mgmtAddId,  setMgmtAddId] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customSaving, setCustomSaving] = useState(false);
  const [customForm, setCustomForm] = useState(createContestProblemForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [resultsContest, setResultsContest] = useState(null);
  const [resultsBoard,   setResultsBoard]   = useState([]);
  const [resultsRewards, setResultsRewards] = useState([]);
  const [rewardCatalog, setRewardCatalog] = useState([]);
  
  // 신청 관리
  const [reqContest, setReqContest] = useState(null);
  const [requests, setRequests] = useState([]);
  const [reqBusy, setReqBusy] = useState({});

  // 보안 코드 입력
  const [pinContest, setPinContest] = useState(null);
  const [pinValue, setPinValue] = useState('');

  // ★ 서버는 'running' 반환, 클라이언트는 'live' 사용 → 매핑
  const mapStatus = (c) => ({ ...c, status: c.status === 'running' ? 'live' : c.status });

  const fetchContests = async () => {
    try {
      const res = await api.get('/contests');
      const data = (res.data||[]).map(mapStatus);
      setContests(data);
      // 참가 상태 초기화
      const joinMap = {};
      data.forEach(c => {
        if (c.myStatus) joinMap[c.id] = { status: c.myStatus };
      });
      setJoined(joinMap);
    } catch { setContests([]); }
  };

  useEffect(() => { fetchContests(); }, []);

  useEffect(() => {
    api.get('/rewards/all')
      .then((res) => setRewardCatalog(Array.isArray(res.data) ? res.data : []))
      .catch(() => setRewardCatalog([]));
  }, []);

  // Filtering Logic
  let filtered = contests;
  // 1. Status / "My" filter
  if (filter === 'mine') {
    filtered = filtered.filter(c => joined[c.id]?.status === 'joined' || joined[c.id]?.status === 'pending');
  } else if (filter !== 'all') {
    filtered = filtered.filter(c => c.status === filter);
  }
  // 2. Search query (client-side)
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(c => 
      c.name.toLowerCase().includes(q) || 
      (c.desc && c.desc.toLowerCase().includes(q))
    );
  }

  const handleJoin = async (c, code = '') => {
    if (c.status === 'live' && joined[c.id]?.status === 'joined') { setLiveContest(c); return; }
    if (joined[c.id]?.status === 'joined' || joined[c.id]?.status === 'pending' || busy[c.id]) return;
    
    // 비공개 대회 보안코드 필요
    if (c.privacy === '비공개' && !code && c.securityCode) {
      setPinContest(c);
      setPinValue('');
      return;
    }

    setBusy(p => ({ ...p, [c.id]: true }));
    try {
      const res = await api.post(`/contests/${c.id}/join`, { securityCode: code });
      setJoined(p => ({ ...p, [c.id]: { status: res.data.status } }));
      
      if (res.data.status === 'joined') {
        setContests(p => p.map(x => x.id===c.id ? {...x, participants: (x.participants||0)+1} : x));
        addNotification(t('contestJoinSuccess').replace('{name}', c.name), 'contest');
        toast?.show(t('contestJoinSuccess').replace('{name}', c.name), 'success');
      } else {
        addNotification(t('contestJoinPending').replace('{name}', c.name), 'contest');
        toast?.show(t('contestJoinPendingDesc'), 'info');
      }
      setPinContest(null);
    } catch (err) {
      toast?.show(err.response?.data?.message || t('contestJoinFailed'), 'error');
    }
    setBusy(p => ({ ...p, [c.id]: false }));
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const res = await api.post('/contests', {
        name: form.name.trim(), desc: form.desc.trim(),
        duration: Number(form.duration), privacy: form.privacy, 
        joinType: form.joinType, securityCode: form.securityCode,
        max: Number(form.max),
        rewardRules: (form.rewardRules || []).map((rule) => ({
          rankFrom: Number(rule.rankFrom) || 1,
          rankTo: Number(rule.rankTo) || Number(rule.rankFrom) || 1,
          rewardCode: String(rule.rewardCode || '').trim(),
        })).filter((rule) => rule.rewardCode),
      });
      setContests(p => [res.data, ...p]);
      addNotification(t('contestCreateSuccess').replace('{name}', res.data.name), 'contest');
      toast?.show(t('contestCreateSuccess').replace('{name}', res.data.name), 'success');
      setShowCreate(false);
      setForm(createContestForm());
    } catch (err) { toast?.show(err.response?.data?.message || t('contestCreateFailed'), 'error'); }
    setCreating(false);
  };

  const openRequests = async (c) => {
    setReqContest(c);
    try {
      const res = await api.get(`/contests/${c.id}/requests`);
      setRequests(res.data || []);
    } catch { setRequests([]); }
  };

  const handleUpdateRequest = async (reqId, status) => {
    setReqBusy(p => ({ ...p, [reqId]: true }));
    try {
      await api.patch(`/contests/${reqContest.id}/requests/${reqId}`, { status });
      setRequests(p => p.filter(r => r.id !== reqId));
      if (status === 'approved') {
        setContests(p => p.map(c => c.id === reqContest.id ? { ...c, participants: (c.participants || 0) + 1 } : c));
        toast?.show(t('contestApproved'), 'success');
      } else {
        toast?.show(t('contestRejected'), 'info');
      }
    } catch { toast?.show(t('contestProcessFailed'), 'error'); }
    setReqBusy(p => ({ ...p, [reqId]: false }));
  };

  const handleStart = async (id) => {
    try {
      const res = await api.patch(`/contests/${id}/start`);
      setContests(p => p.map(c => c.id===id ? mapStatus(res.data) : c));
    } catch {
      // Status changes are best-effort; the list stays unchanged on failure.
    }
  };

  const handleEnd = async (id) => {
    try {
      const res = await api.patch(`/contests/${id}/end`);
      setContests(p => p.map(c => c.id===id ? mapStatus(res.data) : c));
    } catch {
      // Status changes are best-effort; the list stays unchanged on failure.
    }
  };

  const handleDelete = (id) => setDeleteConfirmId(id);

  const openResults = async (c) => {
    setResultsContest(c);
    try {
      const [boardRes, rewardRes] = await Promise.all([
        api.get(`/contests/${c.id}/leaderboard`),
        api.get(`/contests/${c.id}/rewards`),
      ]);
      setResultsBoard(boardRes.data || []);
      setResultsRewards(rewardRes.data?.rewardRules || []);
    } catch { setResultsBoard([]); }
  };

  const confirmDelete = async () => {
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    try {
      await api.delete(`/contests/${id}`);
      setContests(p => p.filter(c => c.id !== id));
      toast?.show(t('contestDeleted'), 'info');
    } catch { toast?.show(t('contestDeleteFailed'), 'error'); }
  };

  const openMgmt = async (c) => {
    setMgmtContest(c);
    try {
      const res = await api.get(`/contests/${c.id}/problems`);
      setMgmtProblems(res.data || []);
    } catch { setMgmtProblems([]); }
    setMgmtAddId('');
    setShowCustomForm(false);
    setCustomForm(createContestProblemForm());
  };

  const handleAddProblem = async () => {
    if (!mgmtAddId || !mgmtContest) return;
    try {
      await api.post(`/contests/${mgmtContest.id}/problems`, { problemId: Number(mgmtAddId) });
      const res = await api.get(`/contests/${mgmtContest.id}/problems`);
      setMgmtProblems(res.data || []);
      setMgmtAddId('');
      toast?.show(t('contestProblemAdded'), 'success');
    } catch (err) { toast?.show(err.response?.data?.message || t('contestProblemAddFailed'), 'error'); }
  };

  const handleRemoveProblem = async (pid) => {
    if (!mgmtContest) return;
    try {
      await api.delete(`/contests/${mgmtContest.id}/problems/${pid}`);
      setMgmtProblems(p => p.filter(x => x.id !== pid));
      toast?.show(t('contestProblemRemoved'), 'info');
    } catch { toast?.show(t('contestProblemRemoveFailed'), 'error'); }
  };

  const setCustomField = (key, value) => setCustomForm((prev) => ({ ...prev, [key]: value }));
  const toggleCustomTag = (tag) => setCustomForm((prev) => ({
    ...prev,
    tags: prev.tags.includes(tag) ? prev.tags.filter((item) => item !== tag) : [...prev.tags, tag],
  }));

  const renderContestCaseEditor = (label, items, keyName, color) => (
    <div style={{marginTop:12}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <div style={{fontSize:12,fontWeight:700,color}}>{label}</div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCustomForm((prev) => ({ ...prev, [keyName]: [...prev[keyName], { input:'', output:'' }] }))}>+ 추가</button>
      </div>
      {items.map((item, index) => (
        <div key={`${keyName}-${index}`} style={{background:'var(--bg3)',border:`1px solid ${color}30`,borderRadius:8,padding:10,marginBottom:8}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <span style={{fontSize:11,color}}>{label} {index + 1}</span>
            <button type="button" onClick={() => setCustomForm((prev) => ({ ...prev, [keyName]: prev[keyName].filter((_, idx) => idx !== index) }))} style={{background:'none',border:'none',color:'var(--red)',cursor:'pointer'}}>✕</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <textarea rows={3} value={item.input} placeholder="입력" onChange={(e) => setCustomForm((prev) => ({ ...prev, [keyName]: prev[keyName].map((entry, idx) => idx === index ? { ...entry, input:e.target.value } : entry) }))} style={{width:'100%',resize:'vertical'}} />
            <textarea rows={3} value={item.output} placeholder="출력" onChange={(e) => setCustomForm((prev) => ({ ...prev, [keyName]: prev[keyName].map((entry, idx) => idx === index ? { ...entry, output:e.target.value } : entry) }))} style={{width:'100%',resize:'vertical'}} />
          </div>
        </div>
      ))}
    </div>
  );

  const handleCreateCustomProblem = async () => {
    if (!mgmtContest || !customForm.title.trim() || !customForm.desc.trim()) return;
    setCustomSaving(true);
    try {
      await api.post(`/contests/${mgmtContest.id}/problems/custom`, {
        ...customForm,
        difficulty: Number(customForm.difficulty),
        timeLimit: Number(customForm.timeLimit),
        memLimit: Number(customForm.memLimit),
        examples: customForm.examples.filter((item) => item.input || item.output),
        testcases: customForm.testcases.filter((item) => item.input || item.output),
      });
      const res = await api.get(`/contests/${mgmtContest.id}/problems`);
      setMgmtProblems(res.data || []);
      setCustomForm(createContestProblemForm());
      setShowCustomForm(false);
      toast?.show(t('contestCustomProblemAdded'), 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || t('contestCustomProblemFailed'), 'error');
    }
    setCustomSaving(false);
  };

  if (liveContest) return <LiveContestView contest={liveContest} onExit={()=>setLiveContest(null)} isAdmin={isAdmin} />;

  return (
    <EmailVerifyGate feature={t('contestFeatureLabel')}>
    <div className="contest-page">
      <div className="contest-top fade-up">
        <div>
          <h1>{t('contestMode')}</h1>
          <p>{isAdmin ? t('contestAdminDesc') : t('contestUserDesc')}</p>
        </div>
        {isAdmin && <button className="btn btn-danger" onClick={() => setShowCreate(true)}>{t('createContestBtn')}</button>}
      </div>

      <div className="contest-filter fade-up" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {[
            ['all',t('allContests')],
            ['live',t('ongoing')],
            ['upcoming',t('upcoming')],
            ['ended',t('ended')],
            ['mine', t('myContests')]
          ].map(([k,l]) => (
            <button key={k} className={`cf-btn ${filter===k?'active':''}`} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        
        <div className="search-box-container" style={{flex:1,maxWidth:320,minWidth:240}}>
          <div style={{position:'relative',display:'flex',alignItems:'center'}}>
            <span style={{position:'absolute',left:12,color:'var(--text3)',fontSize:14}}>🔍</span>
            <input 
              type="text" 
              placeholder={t('contestSearchPlaceholder')} 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width:'100%',
                padding:'8px 12px 8px 36px',
                borderRadius:8,
                background:'var(--bg2)',
                border:'1px solid var(--border)',
                color:'var(--text)',
                fontSize:13,
                outline:'none'
              }}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                style={{
                  position:'absolute',
                  right:8,
                  background:'none',
                  border:'none',
                  color:'var(--text3)',
                  cursor:'pointer',
                  padding:4,
                  fontSize:12
                }}
              >✕</button>
            )}
          </div>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="contest-empty fade-up">
          <div style={{fontSize:48}}>{searchQuery ? '🔍' : '🏆'}</div>
          <p>
            {searchQuery ? t('contestSearchEmpty').replace('{query}', searchQuery) :
             filter === 'mine' ? t('contestMineEmpty') :
             filter === 'ended' ? t('contestEndedEmpty') :
             filter === 'upcoming' ? t('contestUpcomingEmpty') :
             filter === 'live' ? t('contestLiveEmpty') :
             isAdmin ? t('createFirstContest') : t('noContestsCurrent')}
          </p>
          {searchQuery && <button className="btn btn-ghost btn-sm" onClick={() => setSearchQuery('')}>{t('contestClearSearch')}</button>}
        </div>
      )}

      <div className="contest-grid fade-up">
        {filtered.map(c => {
          const isLive = c.status==='live', isUpcoming=c.status==='upcoming', isEnded=c.status==='ended';
          const myStatus = joined[c.id]?.status; // undefined | 'joined' | 'pending' | 'rejected'
          
          return (
            <div key={c.id} className="contest-card card">
              <div className="cc-top">
                <h3>{c.name}</h3>
                {isLive     && <span className="badge-live"><span className="live-dot"/>LIVE</span>}
                {isUpcoming && <span className="badge-upcoming">{t('upcoming')}</span>}
                {isEnded    && <span className="badge-ended">{t('ended')}</span>}
              </div>
              <p className="cc-desc">{c.desc}</p>
              <div className="cc-meta">
                <span>⏱ {t('contestDurationMinutes').replace('{n}', String(c.duration))}</span>
                <span>{c.privacy==='비공개'?'🔒':'🌐'} {c.privacy==='비공개' ? t('visPrivate') : t('visPublic')}</span>
                <span>👥 {t('contestParticipants').replace('{current}', String(c.participants||0)).replace('{max}', String(c.max||20))}</span>
              </div>
              <div className="cc-host" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span>{t('contestHost').replace('{host}', c.host)}</span>
                {c.joinType === 'approval' && <span style={{fontSize:10,background:'var(--bg3)',padding:'2px 6px',borderRadius:4,color:'var(--orange)'}}>{t('contestApprovalRequired')}</span>}
              </div>
              <div style={{marginTop:8,display:'flex',gap:6,flexWrap:'wrap'}}>
                {(c.rewardRules?.length ? c.rewardRules : DEFAULT_CONTEST_REWARD_RULES).slice(0, 4).map((rule, idx) => (
                  <span key={`${rule.rewardCode}-${idx}`} style={{fontSize:11,padding:'3px 7px',borderRadius:999,background:'rgba(121,192,255,.12)',color:'var(--blue)',border:'1px solid rgba(121,192,255,.25)'}}>
                    {rule.rankFrom === rule.rankTo ? `${rule.rankFrom}위` : `${rule.rankFrom}-${rule.rankTo}위`} · {rule.rewardCode}
                  </span>
                ))}
              </div>
              {isAdmin && (
                <div className="admin-cc-btns">
                  {isUpcoming && <button className="btn btn-danger btn-sm" onClick={() => handleStart(c.id)}>🔴 시작</button>}
                  {isLive     && <button className="btn btn-ghost btn-sm"  onClick={() => handleEnd(c.id)}>⏹ 종료</button>}
                  <button className="btn btn-ghost btn-sm" onClick={() => openMgmt(c)}>📋 문제</button>
                  {c.joinType === 'approval' && <button className="btn btn-ghost btn-sm" onClick={() => openRequests(c)}>👥 신청</button>}
                  {!isEnded && <button className="btn btn-sm" style={{background:'rgba(248,81,73,.1)',color:'var(--red)',border:'1px solid rgba(248,81,73,.3)'}} onClick={() => handleDelete(c.id)}>🗑</button>}
                </div>
              )}
              {!isAdmin && !isEnded && (
                <button
                  className={`btn cc-action-btn ${myStatus==='joined'?'btn-ghost':myStatus==='pending'?'btn-ghost':isLive?'btn-danger':'btn-primary'}`}
                  onClick={() => handleJoin(c)}
                  disabled={busy[c.id] || (myStatus==='joined' && !isLive) || myStatus==='pending'}
                >
                  {busy[c.id] ? <span className="spinner"/> : 
                   myStatus==='joined' ? (isLive ? t('enterNow') : t('joinDone')) : 
                   myStatus==='pending' ? t('approvalPending') : 
                   isLive ? t('enterNow') : t('joinContestBtn')}
                </button>
              )}
              {isEnded && <button className="btn btn-ghost cc-action-btn" onClick={() => openResults(c)}>{t('seeResults')}</button>}
            </div>
          );
        })}
      </div>

      {showCreate && isAdmin && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget&&setShowCreate(false)}>
          <div className="modal-box card fade-up">
            <h2>🎯 대회 만들기</h2>
            <div className="modal-form">
              <div className="form-group">
                <label>대회 이름 *</label>
                <input placeholder="대회 이름" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} />
              </div>
              <div className="form-group">
                <label>설명</label>
                <textarea rows={2} placeholder="대회 설명..." value={form.desc} onChange={e=>setForm(p=>({...p,desc:e.target.value}))} style={{resize:'vertical'}} />
              </div>
              <div className="modal-row">
                <div className="form-group">
                  <label>제한 시간</label>
                  <select value={form.duration} onChange={e=>setForm(p=>({...p,duration:e.target.value}))}>
                    {['30','60','90','120','180'].map(v=><option key={v} value={v}>{v}분</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>공개 여부</label>
                  <select value={form.privacy} onChange={e=>setForm(p=>({...p,privacy:e.target.value}))}>
                    <option>비공개</option><option>공개</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>참가 방식</label>
                  <select value={form.joinType} onChange={e=>setForm(p=>({...p,joinType:e.target.value}))}>
                    <option value="direct">즉시 참가</option>
                    <option value="approval">승인 후 참가</option>
                  </select>
                </div>
              </div>
              <div className="modal-row">
                <div className="form-group">
                  <label>최대 인원</label>
                  <input type="number" min="2" max="200" value={form.max} onChange={e=>setForm(p=>({...p,max:e.target.value}))} />
                </div>
                {form.privacy === '비공개' && (
                  <div className="form-group" style={{flex:2}}>
                    <label>보안 코드 (비밀번호)</label>
                    <input placeholder="숫자 또는 영문" value={form.securityCode} onChange={e=>setForm(p=>({...p,securityCode:e.target.value}))} />
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>대회 보상 규칙 (순위별)</label>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {(form.rewardRules || []).map((rule, idx) => (
                    <div key={`reward-rule-${idx}`} style={{display:'grid',gridTemplateColumns:'80px 80px 1fr auto',gap:8,alignItems:'center'}}>
                      <input
                        type="number"
                        min="1"
                        value={rule.rankFrom}
                        onChange={(e) => setForm((prev) => ({
                          ...prev,
                          rewardRules: prev.rewardRules.map((entry, ridx) => ridx === idx ? { ...entry, rankFrom: e.target.value } : entry),
                        }))}
                        placeholder="시작"
                      />
                      <input
                        type="number"
                        min="1"
                        value={rule.rankTo}
                        onChange={(e) => setForm((prev) => ({
                          ...prev,
                          rewardRules: prev.rewardRules.map((entry, ridx) => ridx === idx ? { ...entry, rankTo: e.target.value } : entry),
                        }))}
                        placeholder="끝"
                      />
                      <select
                        value={rule.rewardCode}
                        onChange={(e) => setForm((prev) => ({
                          ...prev,
                          rewardRules: prev.rewardRules.map((entry, ridx) => ridx === idx ? { ...entry, rewardCode: e.target.value } : entry),
                        }))}
                      >
                        <option value="">보상 선택</option>
                        {rewardCatalog.map((item) => (
                          <option key={item.code} value={item.code}>{item.icon} {item.name} ({item.code})</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setForm((prev) => ({ ...prev, rewardRules: prev.rewardRules.filter((_, ridx) => ridx !== idx) }))}
                        disabled={(form.rewardRules || []).length <= 1}
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                  <div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setForm((prev) => ({
                        ...prev,
                        rewardRules: [...(prev.rewardRules || []), { rankFrom: 1, rankTo: 1, rewardCode: '' }],
                      }))}
                    >
                      + 보상 규칙 추가
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=>setShowCreate(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={creating||!form.name.trim()}>
                {creating?<span className="spinner"/>:'대회 생성 →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 문제 관리 모달 ── */}
      {mgmtContest && isAdmin && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setMgmtContest(null)}>
          <div className="modal-box card fade-up" style={{maxWidth:540,width:'95vw'}}>
            <h2>📋 문제 관리 — {mgmtContest.name}</h2>

            {/* 현재 문제 목록 */}
            <div style={{margin:'14px 0',maxHeight:240,overflowY:'auto'}}>
              {mgmtProblems.length === 0
                ? <div style={{color:'var(--text3)',fontSize:13,padding:'8px 0'}}>등록된 문제가 없습니다.</div>
                : mgmtProblems.map((p,i) => (
                  <div key={p.id} style={{
                    display:'flex',alignItems:'center',gap:10,
                    padding:'8px 12px',borderRadius:8,marginBottom:4,
                    background:'var(--bg3)',border:'1px solid var(--border)',
                  }}>
                    <span style={{fontSize:11,color:'var(--text3)',fontFamily:'monospace',width:20}}>P{i+1}</span>
                    <span style={{flex:1,fontSize:13,fontWeight:600}}>#{p.id} {p.title}</span>
                    <span style={{fontSize:10,color:'var(--text3)'}}>{p.tier}</span>
                    <span style={{fontSize:10,fontWeight:700,color:p.visibility === 'contest' ? 'var(--yellow)' : 'var(--blue)'}}>
                      {p.visibility === 'contest' ? '대회전용' : '전역'}
                    </span>
                    <button onClick={()=>handleRemoveProblem(p.id)} style={{
                      background:'none',border:'none',cursor:'pointer',
                      color:'var(--red)',fontSize:14,padding:'2px 4px',
                    }}>✕</button>
                  </div>
                ))
              }
            </div>

            {/* 문제 추가 */}
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <select value={mgmtAddId} onChange={e=>setMgmtAddId(e.target.value)} style={{
                flex:1,background:'var(--bg2)',border:'1px solid var(--border)',
                borderRadius:8,color:'var(--text)',padding:'8px 12px',
                fontSize:13,fontFamily:'inherit',outline:'none',
              }}>
                <option value=''>문제 선택...</option>
                {allProblems
                  .filter(p => !mgmtProblems.some(mp=>mp.id===p.id))
                  .map(p=>(
                    <option key={p.id} value={p.id}>#{p.id} {p.title} ({p.tier})</option>
                  ))
                }
              </select>
              <button className="btn btn-primary btn-sm" onClick={handleAddProblem} disabled={!mgmtAddId}>
                + 추가
              </button>
            </div>

            <div style={{marginTop:16,paddingTop:16,borderTop:'1px solid var(--border)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:10}}>
                <div>
                  <div style={{fontWeight:700,fontSize:13}}>대회 전용 문제 만들기</div>
                  <div style={{fontSize:12,color:'var(--text3)'}}>일반 문제 목록에는 노출되지 않고 현재 대회에만 추가됩니다.</div>
                </div>
                <button className={`btn btn-sm ${showCustomForm ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setShowCustomForm((prev) => !prev)}>
                  {showCustomForm ? '접기' : '새 문제'}
                </button>
              </div>

              {showCustomForm && (
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:10}}>
                    <input placeholder="문제 제목" value={customForm.title} onChange={(e) => setCustomField('title', e.target.value)} />
                    <select value={customForm.tier} onChange={(e) => setCustomField('tier', e.target.value)}>
                      {CONTEST_TIER_OPTIONS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
                    </select>
                    <input type="number" min="1" max="10" value={customForm.difficulty} onChange={(e) => setCustomField('difficulty', e.target.value)} />
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <input type="number" min="1" placeholder="시간 제한" value={customForm.timeLimit} onChange={(e) => setCustomField('timeLimit', e.target.value)} />
                    <input type="number" min="32" placeholder="메모리 제한" value={customForm.memLimit} onChange={(e) => setCustomField('memLimit', e.target.value)} />
                  </div>
                  <textarea rows={3} placeholder="문제 설명" value={customForm.desc} onChange={(e) => setCustomField('desc', e.target.value)} style={{resize:'vertical'}} />
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <textarea rows={2} placeholder="입력 설명" value={customForm.inputDesc} onChange={(e) => setCustomField('inputDesc', e.target.value)} style={{resize:'vertical'}} />
                    <textarea rows={2} placeholder="출력 설명" value={customForm.outputDesc} onChange={(e) => setCustomField('outputDesc', e.target.value)} style={{resize:'vertical'}} />
                  </div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                    {CONTEST_TAG_OPTIONS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleCustomTag(tag)}
                        style={{
                          padding:'6px 10px',
                          borderRadius:999,
                          border:`1px solid ${customForm.tags.includes(tag) ? 'var(--blue)' : 'var(--border)'}`,
                          background:customForm.tags.includes(tag) ? 'rgba(121,192,255,.14)' : 'var(--bg3)',
                          color:customForm.tags.includes(tag) ? 'var(--blue)' : 'var(--text2)',
                          cursor:'pointer',
                          fontSize:12,
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  {renderContestCaseEditor('예제', customForm.examples, 'examples', 'var(--blue)')}
                  <div style={{fontSize:12,color:'var(--orange)',fontWeight:700}}>히든 테스트케이스 개수 제한은 없고, 문제 상세 화면에서 입력/출력이 공개됩니다.</div>
                  {renderContestCaseEditor('히든 테스트케이스', customForm.testcases, 'testcases', 'var(--orange)')}
                  <textarea rows={2} placeholder="힌트" value={customForm.hint} onChange={(e) => setCustomField('hint', e.target.value)} style={{resize:'vertical'}} />
                  <textarea rows={4} placeholder="모범 답안" value={customForm.solution} onChange={(e) => setCustomField('solution', e.target.value)} style={{resize:'vertical'}} />
                  <div style={{display:'flex',justifyContent:'flex-end'}}>
                    <button className="btn btn-primary btn-sm" onClick={handleCreateCustomProblem} disabled={customSaving || !customForm.title.trim() || !customForm.desc.trim()}>
                      {customSaving ? <span className="spinner"/> : '대회 전용 문제 추가'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions" style={{marginTop:16}}>
              <button className="btn btn-ghost" onClick={()=>setMgmtContest(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}
          onClick={e=>e.target===e.currentTarget&&setDeleteConfirmId(null)}>
          <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:28,minWidth:320}}>
            <h3 style={{marginBottom:8}}>⚠️ 대회 삭제</h3>
            <p style={{fontSize:13,color:'var(--text2)',marginBottom:20}}>이 대회를 삭제하시겠습니까? 되돌릴 수 없습니다.</p>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button className="btn btn-ghost" onClick={()=>setDeleteConfirmId(null)}>취소</button>
              <button className="btn btn-primary" style={{background:'var(--red)',borderColor:'var(--red)'}} onClick={confirmDelete}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {resultsContest && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setResultsContest(null)}>
          <div className="modal-box card fade-up" style={{maxWidth:480,width:'95vw'}}>
            <h2>🏆 {resultsContest.name} — 최종 결과</h2>
            <div style={{margin:'14px 0',maxHeight:320,overflowY:'auto'}}>
              {resultsBoard.length === 0
                ? <div style={{color:'var(--text3)',fontSize:13,padding:'8px 0'}}>참가자가 없습니다.</div>
                : resultsBoard.map((p,i) => (
                  <div key={p.username} style={{
                    display:'flex',alignItems:'center',gap:12,
                    padding:'10px 14px',borderRadius:8,marginBottom:4,
                    background: i < 3 ? 'rgba(227,179,65,.08)' : 'var(--bg3)',
                    border:`1px solid ${i < 3 ? 'rgba(227,179,65,.2)' : 'var(--border)'}`,
                  }}>
                    <span style={{fontSize:16,width:24,textAlign:'center'}}>
                      {i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`}
                    </span>
                    <span style={{flex:1}}>
                      <span style={{display:'block',fontWeight:600}}>{p.username}</span>
                      <span style={{display:'block',fontSize:11,color:'var(--text3)'}}>
                        {(getRewardCodesForRank(resultsRewards, i + 1).length ? getRewardCodesForRank(resultsRewards, i + 1) : getRewardCodesForRank(DEFAULT_CONTEST_REWARD_RULES, i + 1)).join(', ') || '보상 없음'}
                      </span>
                    </span>
                    <span className="mono" style={{color:'var(--blue)',fontWeight:700}}>{p.score}문제</span>
                  </div>
                ))
              }
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=>setResultsContest(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 참가 신청 관리 모달 ── */}
      {reqContest && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setReqContest(null)}>
          <div className="modal-box card fade-up" style={{maxWidth:440,width:'95vw'}}>
            <h2>👥 참가 신청 관리</h2>
            <div style={{fontSize:13,color:'var(--text2)',marginBottom:12}}>{reqContest.name} 신청 현황</div>
            <div style={{margin:'14px 0',maxHeight:320,overflowY:'auto'}}>
              {requests.length === 0
                ? <div style={{color:'var(--text3)',fontSize:13,padding:'8px 0',textAlign:'center'}}>대기 중인 신청이 없습니다.</div>
                : requests.map((r) => (
                  <div key={r.id} style={{
                    display:'flex',alignItems:'center',gap:12,
                    padding:'10px 14px',borderRadius:8,marginBottom:8,
                    background:'var(--bg3)',
                    border:'1px solid var(--border)',
                  }}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600}}>{r.username}</div>
                      <div style={{fontSize:10,color:'var(--text3)'}}>{new Date(r.created_at).toLocaleString()}</div>
                    </div>
                    <div style={{display:'flex',gap:6}}>
                      <button className="btn btn-sm btn-primary" 
                        onClick={() => handleUpdateRequest(r.id, 'approved')}
                        disabled={reqBusy[r.id]}
                      >승인</button>
                      <button className="btn btn-sm btn-ghost" 
                        onClick={() => handleUpdateRequest(r.id, 'rejected')}
                        disabled={reqBusy[r.id]}
                        style={{color:'var(--red)'}}
                      >거절</button>
                    </div>
                  </div>
                ))
              }
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=>setReqContest(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 보안 코드 입력 모달 ── */}
      {pinContest && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setPinContest(null)}>
          <div className="modal-box card fade-up" style={{maxWidth:320,width:'90vw'}}>
            <h2>🔒 보안 코드 입력</h2>
            <p style={{fontSize:13,color:'var(--text2)',marginBottom:16}}>이 대회는 비공개 대회입니다. 보안 코드를 입력해주세요.</p>
            <div className="form-group">
              <input 
                type="password" 
                placeholder="보안 코드" 
                autoFocus
                value={pinValue} 
                onChange={e=>setPinValue(e.target.value)} 
                onKeyDown={e=>e.key==='Enter' && handleJoin(pinContest, pinValue)}
              />
            </div>
            <div className="modal-actions" style={{marginTop:20}}>
              <button className="btn btn-ghost" onClick={()=>setPinContest(null)}>취소</button>
              <button className="btn btn-primary" onClick={() => handleJoin(pinContest, pinValue)} disabled={!pinValue || busy[pinContest.id]}>
                {busy[pinContest.id] ? <span className="spinner"/> : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </EmailVerifyGate>
  );
}

function LiveContestView({ contest, onExit, isAdmin }) {
  const { solved } = useApp();
  const [elapsed,  setElapsed]  = useState(0);

  // 실제 카운트다운 타이머
  useEffect(() => {
    const t = setInterval(() => {
      setElapsed(p => {
        if (p >= contest.duration * 60) { clearInterval(t); return p; }
        return p + 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [contest.duration]);

  const remaining = Math.max(0, contest.duration * 60 - elapsed);
  const mm        = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss        = String(remaining % 60).padStart(2, '0');
  const isUrgent  = remaining <= 300 && remaining > 0;
  const isDone    = remaining === 0;

  const [probs, setProbs] = useState([]);
  const [board, setBoard] = useState([]);

  // Derive from AppContext so it updates in real-time when the user submits correctly
  const mySolved = Object.fromEntries(probs.filter(p => solved[p.id]).map(p => [p.id, true]));

  useEffect(() => {
    api.get('/contests/' + contest.id + '/problems')
      .then(r => { if (Array.isArray(r.data)) setProbs(r.data); })
      .catch(() => {});
    api.get('/contests/' + contest.id + '/leaderboard')
      .then(r => { if (Array.isArray(r.data)) setBoard(r.data); })
      .catch(() => {});
    const t = setInterval(() => {
      api.get('/contests/' + contest.id + '/leaderboard')
        .then(r => { if (Array.isArray(r.data)) setBoard(r.data); })
        .catch(() => {});
    }, 10000);
    return () => clearInterval(t);
  }, [contest.id]);
  return (
    <div className="live-view fade-in">
      <div className="lv-header">
        <div className="lv-title"><span className="live-dot" style={{width:10,height:10}}/>{contest.name}</div>
        <div className="lv-timer mono" style={{color:isDone?'var(--text3)':isUrgent?'var(--red)':'var(--yellow)'}}>
          {isDone ? '⏱ 시간 종료' : `⏱ 남은 시간 ${mm}:${ss}`}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onExit}>← 나가기</button>
      </div>
      <div className="lv-body">
        <div className="lv-problems card">
          <div className="lv-panel-title">📋 문제 목록</div>
          {probs.length === 0 && <div style={{padding:'12px 16px',fontSize:13,color:'var(--text3)'}}>문제가 없습니다.</div>}
          {probs.map((p,i)=>(
            <div key={p.id} className={`lp-row ${mySolved[p.id]?'solved':''}`}>
              <span className="mono" style={{fontSize:11,color:'var(--text3)'}}>P{i+1}</span>
              <span style={{flex:1,fontWeight:600}}>{p.title}</span>
              {mySolved[p.id]&&<span style={{color:'var(--green)'}}>✓</span>}
            </div>
          ))}
        </div>
        <div className="lv-ranking card">
          <div className="lv-panel-title">🏆 실시간 순위</div>
          {[...board.map(p=>({...p, name: p.username||p.name})),
            {name:isAdmin?'(관리자)':'나',score:Object.keys(mySolved).length,isMe:!isAdmin}]
            .sort((a,b)=>b.score-a.score).map((p,i)=>(
            <div key={p.name} className={`lr-row ${p.isMe?'me':''}`}>
              <span className="mono" style={{width:20,color:'var(--text2)',fontWeight:700}}>{i+1}</span>
              <span style={{flex:1,fontWeight:600}}>{p.name}</span>
              <span className="mono" style={{color:'var(--blue)',fontWeight:700}}>{p.score}문제</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
