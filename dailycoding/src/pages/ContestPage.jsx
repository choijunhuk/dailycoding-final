import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import api from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import EmailVerifyGate from '../components/EmailVerifyGate.jsx';
import { useLang } from '../context/LangContext.jsx';
import { JUDGE_LANGUAGE_OPTIONS } from '../data/judgeLanguages.js';
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
  name:'', desc:'', duration:'60', privacy:'private', joinType:'direct', securityCode:'', max:'20',
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
  const { isAdmin } = useAuth();
  const { addNotification, problems: allProblems } = useApp();
  const toast = useToast();
  const { t, lang } = useLang();
  const txt = (ko, en) => lang === 'ko' ? ko : en;

  const [contests,   setContests]   = useState([]);
  const [filter,     setFilter]     = useState('all');
  const [searchQuery,setSearchQuery]= useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [joined,     setJoined]     = useState({}); // contestId -> { status: 'joined' | 'pending' | 'rejected' }
  const [contestsLoading, setContestsLoading] = useState(true);
  const [contestsLoadError, setContestsLoadError] = useState('');
  const [liveContest,setLiveContest]= useState(null);
  const [virtualContest,setVirtualContest]= useState(null);
  const [form,       setForm]       = useState(createContestForm);
  const [creating,   setCreating]   = useState(false);
  const [busy,       setBusy]       = useState({});
  const [mgmtContest,setMgmtContest]= useState(null);   // 문제 관리 중인 대회
  const [mgmtProblems,setMgmtProblems]= useState([]);   // 해당 대회 문제 목록
  const [mgmtProblemsLoadError, setMgmtProblemsLoadError] = useState('');
  const [mgmtAddId,  setMgmtAddId] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customSaving, setCustomSaving] = useState(false);
  const [customForm, setCustomForm] = useState(createContestProblemForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [resultsContest, setResultsContest] = useState(null);
  const [resultsBoard,   setResultsBoard]   = useState([]);
  const [resultsLoadError, setResultsLoadError] = useState('');
  const [resultsRewards, setResultsRewards] = useState([]);
  const [rewardCatalog, setRewardCatalog] = useState([]);
  
  // 신청 관리
  const [reqContest, setReqContest] = useState(null);
  const [requests, setRequests] = useState([]);
  const [requestsLoadError, setRequestsLoadError] = useState('');
  const [reqBusy, setReqBusy] = useState({});

  // 보안 코드 입력
  const [pinContest, setPinContest] = useState(null);
  const [pinValue, setPinValue] = useState('');

  // 대회 개최 요청
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestForm, setRequestForm] = useState({ name: '', description: '', desiredDate: '', reason: '' });
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [showCreationRequests, setShowCreationRequests] = useState(false);
  const [creationRequests, setCreationRequests] = useState([]);
  const [creationRequestsLoadError, setCreationRequestsLoadError] = useState('');
  const [creationReqBusy, setCreationReqBusy] = useState({});

  // ★ 서버는 'running' 반환, 클라이언트는 'live' 사용 → 매핑
  const mapStatus = (c) => ({ ...c, status: c.status === 'running' ? 'live' : c.status });

  const fetchContests = async ({ background = false } = {}) => {
    if (!background) {
      setContestsLoading(true);
      setContestsLoadError('');
    }
    try {
      const res = await api.get('/contests');
      const data = (res.data||[]).map(mapStatus);
      setContests(data);
      setContestsLoadError('');
      // 참가 상태 초기화
      const joinMap = {};
      data.forEach(c => {
        if (c.myStatus) joinMap[c.id] = { status: c.myStatus };
      });
      setJoined(joinMap);
    } catch {
      if (background) return;
      setContests([]);
      setContestsLoadError(t('contestListLoadFailed'));
    } finally {
      if (!background) setContestsLoading(false);
    }
  };

  useEffect(() => {
    fetchContests();
    const interval = setInterval(() => fetchContests({ background: true }), 30000);
    return () => clearInterval(interval);
  }, []);

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
    if (c.privacy === 'private' && !code && c.securityCode) {
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
        addNotification(t('contestJoinSuccess').replace('{name}', c.name));
        toast?.show(t('contestJoinSuccess').replace('{name}', c.name), 'success');
      } else {
        addNotification(t('contestJoinPending').replace('{name}', c.name));
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
      addNotification(t('contestCreateSuccess').replace('{name}', res.data.name));
      toast?.show(t('contestCreateSuccess').replace('{name}', res.data.name), 'success');
      setShowCreate(false);
      setForm(createContestForm());
    } catch (err) { toast?.show(err.response?.data?.message || t('contestCreateFailed'), 'error'); }
    setCreating(false);
  };

  const openRequests = async (c) => {
    setReqContest(c);
    setRequests([]);
    setRequestsLoadError('');
    try {
      const res = await api.get(`/contests/${c.id}/requests`);
      setRequests(res.data || []);
    } catch {
      setRequests([]);
      setRequestsLoadError(txt('참가 신청을 불러오지 못했습니다.', 'Failed to load join requests.'));
    }
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

  const handleVirtualStart = async (c) => {
    setBusy(p => ({ ...p, [`virtual-${c.id}`]: true }));
    try {
      const res = await api.post(`/contests/${c.id}/virtual/start`);
      setVirtualContest(res.data);
      toast?.show(txt('가상 대회가 시작되었습니다.', 'Virtual contest started.'), 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || 'Failed to start virtual contest.', 'error');
    }
    setBusy(p => ({ ...p, [`virtual-${c.id}`]: false }));
  };

  const handleDelete = (id) => setDeleteConfirmId(id);

  const openResults = async (c) => {
    setResultsContest(c);
    setResultsBoard([]);
    setResultsRewards([]);
    setResultsLoadError('');
    try {
      const [boardRes, rewardRes] = await Promise.all([
        api.get(`/contests/${c.id}/leaderboard`),
        api.get(`/contests/${c.id}/rewards`),
      ]);
      setResultsBoard(boardRes.data || []);
      setResultsRewards(rewardRes.data?.rewardRules || []);
    } catch {
      setResultsBoard([]);
      setResultsRewards([]);
      setResultsLoadError(txt('대회 결과를 불러오지 못했습니다.', 'Failed to load contest results.'));
    }
  };

  const fetchCreationRequests = async () => {
    setCreationRequests([]);
    setCreationRequestsLoadError('');
    try {
      const res = await api.get('/contests/creation-requests');
      setCreationRequests(res.data || []);
    } catch {
      setCreationRequests([]);
      setCreationRequestsLoadError(txt('대회 개최 요청을 불러오지 못했습니다.', 'Failed to load contest creation requests.'));
    }
  };

  const handleSubmitCreationRequest = async () => {
    if (!requestForm.name.trim()) return;
    setSubmittingRequest(true);
    try {
      await api.post('/contests/creation-requests', requestForm);
      toast?.show(txt('대회 개최 요청이 제출되었습니다. 관리자가 검토 후 답변 드립니다.', 'Contest creation request submitted. An admin will review it shortly.'), 'success');
      setShowRequestForm(false);
      setRequestForm({ name: '', description: '', desiredDate: '', reason: '' });
    } catch (err) { toast?.show(err.response?.data?.message || 'Failed to submit request', 'error'); }
    setSubmittingRequest(false);
  };

  const handleCreationRequestAction = async (reqId, status) => {
    setCreationReqBusy(p => ({ ...p, [reqId]: true }));
    try {
      await api.patch(`/contests/creation-requests/${reqId}`, { status });
      setCreationRequests(p => p.map(r => r.id === reqId ? { ...r, status } : r));
      toast?.show(status === 'approved' ? txt('요청이 승인되었습니다.', 'Request approved.') : txt('요청이 거절되었습니다.', 'Request rejected.'), 'success');
    } catch { toast?.show(txt('처리에 실패했습니다.', 'Processing failed.'), 'error'); }
    setCreationReqBusy(p => ({ ...p, [reqId]: false }));
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
    setMgmtProblems([]);
    setMgmtProblemsLoadError('');
    try {
      const res = await api.get(`/contests/${c.id}/problems`);
      setMgmtProblems(res.data || []);
    } catch {
      setMgmtProblems([]);
      setMgmtProblemsLoadError(txt('대회 문제 목록을 불러오지 못했습니다.', 'Failed to load contest problems.'));
    }
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
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCustomForm((prev) => ({ ...prev, [keyName]: [...prev[keyName], { input:'', output:'' }] }))}>+ Add</button>
      </div>
      {items.map((item, index) => (
        <div key={`${keyName}-${index}`} style={{background:'var(--bg3)',border:`1px solid ${color}30`,borderRadius:8,padding:10,marginBottom:8}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <span style={{fontSize:11,color}}>{label} {index + 1}</span>
            <button type="button" onClick={() => setCustomForm((prev) => ({ ...prev, [keyName]: prev[keyName].filter((_, idx) => idx !== index) }))} style={{background:'none',border:'none',color:'var(--red)',cursor:'pointer'}}>✕</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <textarea rows={3} value={item.input} placeholder={t('contestInputPlaceholder')} onChange={(e) => setCustomForm((prev) => ({ ...prev, [keyName]: prev[keyName].map((entry, idx) => idx === index ? { ...entry, input:e.target.value } : entry) }))} style={{width:'100%',resize:'vertical'}} />
            <textarea rows={3} value={item.output} placeholder={t('contestOutputPlaceholder')} onChange={(e) => setCustomForm((prev) => ({ ...prev, [keyName]: prev[keyName].map((entry, idx) => idx === index ? { ...entry, output:e.target.value } : entry) }))} style={{width:'100%',resize:'vertical'}} />
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

  if (virtualContest) return <VirtualContestView payload={virtualContest} onExit={()=>setVirtualContest(null)} t={t} />;
  if (liveContest) return <LiveContestView contest={liveContest} onExit={()=>setLiveContest(null)} isAdmin={isAdmin} t={t} />;

  return (
    <EmailVerifyGate feature={t('contestFeatureLabel')}>
    <div className="contest-page">
      <div className="contest-top fade-up">
        <div>
          <h1>{t('contestMode')}</h1>
          <p>{isAdmin ? t('contestAdminDesc') : t('contestUserDesc')}</p>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {isAdmin && <button className="btn btn-ghost" onClick={() => { setShowCreationRequests(true); fetchCreationRequests(); }}>📋 {txt('개최 요청', 'Creation Requests')}</button>}
          {isAdmin && <button className="btn btn-danger" onClick={() => setShowCreate(true)}>{t('createContestBtn')}</button>}
          {!isAdmin && <button className="btn btn-ghost" onClick={() => setShowRequestForm(true)}>📋 {txt('대회 개최 요청', 'Request a Contest')}</button>}
        </div>
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

      {contestsLoading && (
        <div className="contest-empty fade-up">
          <div style={{fontSize:48}}>⏳</div>
          <p>{t('contestListLoading')}</p>
        </div>
      )}

      {!contestsLoading && contestsLoadError && (
        <div className="contest-empty contest-error fade-up">
          <div style={{fontSize:48}}>⚠️</div>
          <p>{contestsLoadError}</p>
          <button className="btn btn-ghost btn-sm" onClick={() => fetchContests()}>{t('refresh')}</button>
        </div>
      )}

      {!contestsLoading && !contestsLoadError && filtered.length === 0 && (
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

      {!contestsLoading && !contestsLoadError && (
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
                <span>{c.privacy==='private'?'🔒':'🌐'} {c.privacy==='private' ? t('visPrivate') : t('visPublic')}</span>
                <span>👥 {t('contestParticipants').replace('{current}', String(c.participants||0)).replace('{max}', String(c.max||20))}</span>
              </div>
              <div className="cc-host" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span>{t('contestHost').replace('{host}', c.host)}</span>
                {c.joinType === 'approval' && <span style={{fontSize:10,background:'var(--bg3)',padding:'2px 6px',borderRadius:4,color:'var(--orange)'}}>{t('contestApprovalRequired')}</span>}
              </div>
              <div style={{marginTop:8,display:'flex',gap:6,flexWrap:'wrap'}}>
                {(c.rewardRules?.length ? c.rewardRules : DEFAULT_CONTEST_REWARD_RULES).slice(0, 4).map((rule, idx) => (
                  <span key={`${rule.rewardCode}-${idx}`} style={{fontSize:11,padding:'3px 7px',borderRadius:999,background:'rgba(121,192,255,.12)',color:'var(--blue)',border:'1px solid rgba(121,192,255,.25)'}}>
                    {rule.rankFrom === rule.rankTo ? `${rule.rankFrom}` : `${rule.rankFrom}-${rule.rankTo}`} · {rule.rewardCode}
                  </span>
                ))}
              </div>
              {isAdmin && (
                <div className="admin-cc-btns">
                  {isUpcoming && <button className="btn btn-danger btn-sm" onClick={() => handleStart(c.id)}>🔴 {txt('시작', 'Start')}</button>}
                  {isLive     && <button className="btn btn-ghost btn-sm"  onClick={() => handleEnd(c.id)}>⏹ {txt('종료', 'End')}</button>}
                  {isLive     && <button className="btn btn-danger btn-sm" onClick={() => setLiveContest(c)}>▶ {txt('입장', 'Enter')}</button>}
                  <button className="btn btn-ghost btn-sm" onClick={() => openMgmt(c)}>📋 {txt('문제', 'Problems')}</button>
                  {c.joinType === 'approval' && <button className="btn btn-ghost btn-sm" onClick={() => openRequests(c)}>👥 {txt('신청', 'Requests')}</button>}
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
              {isEnded && (
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  <button className="btn btn-ghost cc-action-btn" onClick={() => openResults(c)}>{t('seeResults')}</button>
                  <button className="btn btn-primary cc-action-btn" onClick={() => handleVirtualStart(c)} disabled={busy[`virtual-${c.id}`]}>
                    {busy[`virtual-${c.id}`] ? <span className="spinner"/> : 'Virtual Join'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}

      {showCreate && isAdmin && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget&&setShowCreate(false)}>
          <div className="modal-box card fade-up">
            <h2>🎯 Create Contest</h2>
            <div className="modal-form">
              <div className="form-group">
                <label>{txt('콘테스트 이름 *', 'Contest Name *')}</label>
                <input placeholder={t('contestNamePlaceholder')} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} />
              </div>
              <div className="form-group">
                <label>{txt('설명', 'Description')}</label>
                <textarea rows={2} placeholder={t('contestDescPlaceholder')} value={form.desc} onChange={e=>setForm(p=>({...p,desc:e.target.value}))} style={{resize:'vertical'}} />
              </div>
              <div className="modal-row">
                <div className="form-group">
                  <label>{txt('제한 시간', 'Time Limit')}</label>
                  <select value={form.duration} onChange={e=>setForm(p=>({...p,duration:e.target.value}))}>
                    {['30','60','90','120','180'].map(v=><option key={v} value={v}>{v} {txt('분', 'min')}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>{txt('공개 설정', 'Visibility')}</label>
                  <select value={form.privacy} onChange={e=>setForm(p=>({...p,privacy:e.target.value}))}>
                    <option value="private">{txt('비공개', 'Private')}</option><option value="public">{txt('공개', 'Public')}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{txt('참가 방식', 'Join Method')}</label>
                  <select value={form.joinType} onChange={e=>setForm(p=>({...p,joinType:e.target.value}))}>
                    <option value="direct">{txt('바로 참가', 'Direct Join')}</option>
                    <option value="approval">{txt('승인 필요', 'Approval Required')}</option>
                  </select>
                </div>
              </div>
              <div className="modal-row">
                <div className="form-group">
                  <label>Max Participants</label>
                  <input type="number" min="2" max="200" value={form.max} onChange={e=>setForm(p=>({...p,max:e.target.value}))} />
                </div>
                {form.privacy === 'private' && (
                  <div className="form-group" style={{flex:2}}>
                    <label>Security Code (Password)</label>
                    <input placeholder={t('contestSecCodePlaceholder')} value={form.securityCode} onChange={e=>setForm(p=>({...p,securityCode:e.target.value}))} />
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Reward Rules (by Rank)</label>
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
                        placeholder={t('contestStartPlaceholder')}
                      />
                      <input
                        type="number"
                        min="1"
                        value={rule.rankTo}
                        onChange={(e) => setForm((prev) => ({
                          ...prev,
                          rewardRules: prev.rewardRules.map((entry, ridx) => ridx === idx ? { ...entry, rankTo: e.target.value } : entry),
                        }))}
                        placeholder={t('contestEndPlaceholder')}
                      />
                      <select
                        value={rule.rewardCode}
                        onChange={(e) => setForm((prev) => ({
                          ...prev,
                          rewardRules: prev.rewardRules.map((entry, ridx) => ridx === idx ? { ...entry, rewardCode: e.target.value } : entry),
                        }))}
                      >
                        <option value="">Select Reward</option>
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
                        Remove
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
                      + Add Reward Rule
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=>setShowCreate(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={creating||!form.name.trim()}>
                {creating?<span className="spinner"/>:'Create Contest →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 문제 관리 모달 ── */}
      {mgmtContest && isAdmin && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setMgmtContest(null)}>
          <div className="modal-box card fade-up" style={{maxWidth:540,width:'95vw'}}>
            <h2>📋 Problem Management — {mgmtContest.name}</h2>

            {/* Current problem list */}
            <div style={{margin:'14px 0',maxHeight:240,overflowY:'auto'}}>
              {mgmtProblemsLoadError
                ? <div style={{color:'var(--red)',fontSize:13,padding:'8px 0'}}>{mgmtProblemsLoadError}</div>
                : mgmtProblems.length === 0
                ? <div style={{color:'var(--text3)',fontSize:13,padding:'8px 0'}}>No problems added yet.</div>
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
                      {p.visibility === 'contest' ? 'Contest Only' : 'Global'}
                    </span>
                    <button onClick={()=>handleRemoveProblem(p.id)} style={{
                      background:'none',border:'none',cursor:'pointer',
                      color:'var(--red)',fontSize:14,padding:'2px 4px',
                    }}>✕</button>
                  </div>
                ))
              }
            </div>

            {/* Add problem */}
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <select value={mgmtAddId} onChange={e=>setMgmtAddId(e.target.value)} style={{
                flex:1,background:'var(--bg2)',border:'1px solid var(--border)',
                borderRadius:8,color:'var(--text)',padding:'8px 12px',
                fontSize:13,fontFamily:'inherit',outline:'none',
              }}>
                <option value=''>Select a problem...</option>
                {allProblems
                  .filter(p => !mgmtProblems.some(mp=>mp.id===p.id))
                  .map(p=>(
                    <option key={p.id} value={p.id}>#{p.id} {p.title} ({p.tier})</option>
                  ))
                }
              </select>
              <button className="btn btn-primary btn-sm" onClick={handleAddProblem} disabled={!mgmtAddId}>
                + Add
              </button>
            </div>

            <div style={{marginTop:16,paddingTop:16,borderTop:'1px solid var(--border)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:10}}>
                <div>
                  <div style={{fontWeight:700,fontSize:13}}>Create Contest-Only Problem</div>
                  <div style={{fontSize:12,color:'var(--text3)'}}>Not visible in the general problem list — added only to this contest.</div>
                </div>
                <button className={`btn btn-sm ${showCustomForm ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setShowCustomForm((prev) => !prev)}>
                  {showCustomForm ? 'Collapse' : 'New Problem'}
                </button>
              </div>

              {showCustomForm && (
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:10}}>
                    <input placeholder={t('contestProbTitlePlaceholder')} value={customForm.title} onChange={(e) => setCustomField('title', e.target.value)} />
                    <select value={customForm.tier} onChange={(e) => setCustomField('tier', e.target.value)}>
                      {CONTEST_TIER_OPTIONS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
                    </select>
                    <input type="number" min="1" max="10" value={customForm.difficulty} onChange={(e) => setCustomField('difficulty', e.target.value)} />
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <input type="number" min="1" placeholder={t('contestTimeLimitPlaceholder')} value={customForm.timeLimit} onChange={(e) => setCustomField('timeLimit', e.target.value)} />
                    <input type="number" min="32" placeholder={t('contestMemLimitPlaceholder')} value={customForm.memLimit} onChange={(e) => setCustomField('memLimit', e.target.value)} />
                  </div>
                  <textarea rows={3} placeholder={t('contestProbDescPlaceholder')} value={customForm.desc} onChange={(e) => setCustomField('desc', e.target.value)} style={{resize:'vertical'}} />
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <textarea rows={2} placeholder={t('contestInputDescPlaceholder')} value={customForm.inputDesc} onChange={(e) => setCustomField('inputDesc', e.target.value)} style={{resize:'vertical'}} />
                    <textarea rows={2} placeholder={t('contestOutputDescPlaceholder')} value={customForm.outputDesc} onChange={(e) => setCustomField('outputDesc', e.target.value)} style={{resize:'vertical'}} />
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
                  {renderContestCaseEditor('Example', customForm.examples, 'examples', 'var(--blue)')}
                  <div style={{fontSize:12,color:'var(--orange)',fontWeight:700}}>No limit on hidden test cases. Input/output will be visible on the problem detail page.</div>
                  {renderContestCaseEditor('Hidden Test Case', customForm.testcases, 'testcases', 'var(--orange)')}
                  <textarea rows={2} placeholder={txt('힌트', 'Hint')} value={customForm.hint} onChange={(e) => setCustomField('hint', e.target.value)} style={{resize:'vertical'}} />
                  <textarea rows={4} placeholder={t('contestSolutionPlaceholder')} value={customForm.solution} onChange={(e) => setCustomField('solution', e.target.value)} style={{resize:'vertical'}} />
                  <div style={{display:'flex',justifyContent:'flex-end'}}>
                    <button className="btn btn-primary btn-sm" onClick={handleCreateCustomProblem} disabled={customSaving || !customForm.title.trim() || !customForm.desc.trim()}>
                      {customSaving ? <span className="spinner"/> : 'Add Contest Problem'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions" style={{marginTop:16}}>
              <button className="btn btn-ghost" onClick={()=>setMgmtContest(null)}>{txt('닫기', 'Close')}</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}
          onClick={e=>e.target===e.currentTarget&&setDeleteConfirmId(null)}>
          <div className="card card-pad-lg" style={{minWidth:320}}>
            <h3 style={{marginBottom:8}}>{t('contestDeleteTitle')}</h3>
            <p style={{fontSize:13,color:'var(--text2)',marginBottom:20}}>{t('contestDeleteConfirm')}</p>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button className="btn btn-ghost" onClick={()=>setDeleteConfirmId(null)}>{t('cancel')}</button>
              <button className="btn btn-primary" style={{background:'var(--red)',borderColor:'var(--red)'}} onClick={confirmDelete}>{t('delete')}</button>
            </div>
          </div>
        </div>
      )}

      {resultsContest && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setResultsContest(null)}>
          <div className="modal-box card fade-up" style={{maxWidth:480,width:'95vw'}}>
            <h2>🏆 {resultsContest.name} — {txt('최종 결과', 'Final Results')}</h2>
            <div style={{margin:'14px 0',maxHeight:320,overflowY:'auto'}}>
              {resultsLoadError
                ? <div style={{color:'var(--red)',fontSize:13,padding:'8px 0'}}>{resultsLoadError}</div>
                : resultsBoard.length === 0
                ? <div style={{color:'var(--text3)',fontSize:13,padding:'8px 0'}}>{txt('참가자 없음.', 'No participants.')}</div>
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
                        {(getRewardCodesForRank(resultsRewards, i + 1).length ? getRewardCodesForRank(resultsRewards, i + 1) : getRewardCodesForRank(DEFAULT_CONTEST_REWARD_RULES, i + 1)).join(', ') || txt('보상 없음', 'No reward')}
                      </span>
                    </span>
                    <span className="mono" style={{color:'var(--blue)',fontWeight:700}}>{p.score} {txt('해결', 'solved')}</span>
                  </div>
                ))
              }
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=>setResultsContest(null)}>{txt('닫기', 'Close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 참가 신청 관리 모달 ── */}
      {reqContest && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setReqContest(null)}>
          <div className="modal-box card fade-up" style={{maxWidth:440,width:'95vw'}}>
            <h2>👥 {txt('참가 신청 관리', 'Join Request Management')}</h2>
            <div style={{fontSize:13,color:'var(--text2)',marginBottom:12}}>{reqContest.name} — {txt('대기 중인 신청', 'Pending Requests')}</div>
            <div style={{margin:'14px 0',maxHeight:320,overflowY:'auto'}}>
              {requestsLoadError
                ? <div style={{color:'var(--red)',fontSize:13,padding:'8px 0',textAlign:'center'}}>{requestsLoadError}</div>
                : requests.length === 0
                ? <div style={{color:'var(--text3)',fontSize:13,padding:'8px 0',textAlign:'center'}}>{txt('대기 중인 신청이 없습니다.', 'No pending requests.')}</div>
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
                      >{txt('승인', 'Approve')}</button>
                      <button className="btn btn-sm btn-ghost"
                        onClick={() => handleUpdateRequest(r.id, 'rejected')}
                        disabled={reqBusy[r.id]}
                        style={{color:'var(--red)'}}
                      >{txt('거절', 'Reject')}</button>
                    </div>
                  </div>
                ))
              }
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=>setReqContest(null)}>{txt('닫기', 'Close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 대회 개최 요청 모달 (유저) ── */}
      {showRequestForm && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowRequestForm(false)}>
          <div className="modal-box card fade-up" style={{maxWidth:480,width:'95vw'}}>
            <h2>📋 {txt('대회 개최 요청', 'Request a Contest')}</h2>
            <p style={{fontSize:13,color:'var(--text2)',marginBottom:16}}>{txt('관리자가 요청을 검토하고 대회를 개설합니다.', 'An admin will review your request and create the contest.')}</p>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div className="form-group">
                <label style={{fontSize:12,color:'var(--text3)',marginBottom:4,display:'block'}}>{txt('콘테스트 이름 *', 'Contest Name *')}</label>
                <input placeholder={t('contestNameExamplePlaceholder')} value={requestForm.name} onChange={e=>setRequestForm(p=>({...p,name:e.target.value}))} />
              </div>
              <div className="form-group">
                <label style={{fontSize:12,color:'var(--text3)',marginBottom:4,display:'block'}}>{txt('콘테스트 설명', 'Contest Description')}</label>
                <textarea rows={3} placeholder={txt('주제, 대상, 목적 등을 설명하세요.', 'Describe the topic, target audience, etc.')} value={requestForm.description} onChange={e=>setRequestForm(p=>({...p,description:e.target.value}))} style={{width:'100%',resize:'vertical',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)',padding:'8px 12px',fontSize:13,fontFamily:'inherit'}} />
              </div>
              <div className="form-group">
                <label style={{fontSize:12,color:'var(--text3)',marginBottom:4,display:'block'}}>{txt('희망 날짜', 'Preferred Date')}</label>
                <input type="date" value={requestForm.desiredDate} onChange={e=>setRequestForm(p=>({...p,desiredDate:e.target.value}))} />
              </div>
              <div className="form-group">
                <label style={{fontSize:12,color:'var(--text3)',marginBottom:4,display:'block'}}>{txt('요청 이유', 'Reason for Request')}</label>
                <textarea rows={2} placeholder={txt('이 콘테스트를 개최하려는 이유를 적어주세요.', 'Why do you want to host this contest?')} value={requestForm.reason} onChange={e=>setRequestForm(p=>({...p,reason:e.target.value}))} style={{width:'100%',resize:'vertical',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)',padding:'8px 12px',fontSize:13,fontFamily:'inherit'}} />
              </div>
            </div>
            <div className="modal-actions" style={{marginTop:20}}>
              <button className="btn btn-ghost" onClick={()=>setShowRequestForm(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={handleSubmitCreationRequest} disabled={!requestForm.name.trim()||submittingRequest}>
                {submittingRequest ? <span className="spinner"/> : t('contestSubmitRequest')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 개최 요청 목록 모달 (어드민) ── */}
      {showCreationRequests && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowCreationRequests(false)}>
          <div className="modal-box card fade-up" style={{maxWidth:560,width:'95vw'}}>
            <h2>📋 {txt('대회 개최 요청', 'Contest Creation Requests')}</h2>
            <div style={{maxHeight:420,overflowY:'auto',margin:'14px 0'}}>
              {creationRequestsLoadError
                ? <div style={{color:'var(--red)',fontSize:13,textAlign:'center',padding:'20px 0'}}>{creationRequestsLoadError}</div>
                : creationRequests.length === 0
                ? <div style={{color:'var(--text3)',fontSize:13,textAlign:'center',padding:'20px 0'}}>{txt('요청이 없습니다.', 'No requests found.')}</div>
                : creationRequests.map(r => (
                  <div key={r.id} style={{padding:'12px 14px',borderRadius:10,marginBottom:8,background:'var(--bg3)',border:`1px solid ${r.status==='pending'?'var(--border)':r.status==='approved'?'rgba(63,185,80,.3)':'rgba(248,81,73,.3)'}`}}>
                    <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:14}}>{r.name}</div>
                        <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>{txt('작성자', 'by')} {r.username} ({r.tier}) · {new Date(r.created_at).toLocaleDateString()}</div>
                        {r.description && <div style={{fontSize:12,color:'var(--text2)',marginTop:6}}>{r.description}</div>}
                        {r.desired_date && <div style={{fontSize:12,color:'var(--text3)',marginTop:4}}>{txt('희망 날짜', 'Preferred Date')}: {r.desired_date}</div>}
                        {r.reason && <div style={{fontSize:12,color:'var(--text2)',marginTop:4}}>{txt('사유', 'Reason')}: {r.reason}</div>}
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:6,alignItems:'flex-end'}}>
                        <span style={{fontSize:11,fontWeight:700,color:r.status==='pending'?'var(--yellow)':r.status==='approved'?'var(--green)':'var(--red)'}}>
                          {r.status==='pending'?txt('대기 중','Pending'):r.status==='approved'?txt('승인됨','Approved'):txt('거절됨','Rejected')}
                        </span>
                        {r.status === 'pending' && (
                          <div style={{display:'flex',gap:6}}>
                            <button className="btn btn-sm btn-primary" onClick={()=>handleCreationRequestAction(r.id,'approved')} disabled={creationReqBusy[r.id]}>{txt('승인', 'Approve')}</button>
                            <button className="btn btn-sm btn-ghost" onClick={()=>handleCreationRequestAction(r.id,'rejected')} disabled={creationReqBusy[r.id]} style={{color:'var(--red)'}}>{txt('거절', 'Reject')}</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=>setShowCreationRequests(false)}>{t('close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 보안 코드 입력 모달 ── */}
      {pinContest && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setPinContest(null)}>
          <div className="modal-box card fade-up" style={{maxWidth:320,width:'90vw'}}>
            <h2>🔒 {txt('보안 코드 입력', 'Enter Security Code')}</h2>
            <p style={{fontSize:13,color:'var(--text2)',marginBottom:16}}>{txt('비공개 콘테스트입니다. 참가하려면 보안 코드를 입력하세요.', 'This is a private contest. Please enter the security code to join.')}</p>
            <div className="form-group">
              <input 
                type="password" 
                placeholder={t('contestSecCodePlaceholder2')}
                autoFocus
                value={pinValue} 
                onChange={e=>setPinValue(e.target.value)} 
                onKeyDown={e=>e.key==='Enter' && handleJoin(pinContest, pinValue)}
              />
            </div>
            <div className="modal-actions" style={{marginTop:20}}>
              <button className="btn btn-ghost" onClick={()=>setPinContest(null)}>{txt('취소', 'Cancel')}</button>
              <button className="btn btn-primary" onClick={() => handleJoin(pinContest, pinValue)} disabled={!pinValue || busy[pinContest.id]}>
                {busy[pinContest.id] ? <span className="spinner"/> : txt('확인', 'Confirm')}
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
  const navigate = useNavigate();
  const { lang } = useLang();
  const txt = (ko, en) => lang === 'ko' ? ko : en;
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
          {isDone ? '⏱ Time Up' : `⏱ ${mm}:${ss} left`}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onExit}>← Exit</button>
      </div>
      <div className="lv-body">
        <div className="lv-problems card">
          <div className="lv-panel-title">📋 Problems</div>
          {probs.length === 0 && <div style={{padding:'12px 16px',fontSize:13,color:'var(--text3)'}}>No problems found.</div>}
          {probs.map((p,i)=>(
            <div
              key={p.id}
              className={`lp-row ${mySolved[p.id]?'solved':''}`}
              onClick={() => navigate('/problems/' + p.id)}
              style={{cursor:'pointer'}}
            >
              <span className="mono" style={{fontSize:11,color:'var(--text3)'}}>P{i+1}</span>
              <span style={{flex:1,fontWeight:600}}>{p.title}</span>
              {mySolved[p.id]&&<span style={{color:'var(--green)'}}>✓</span>}
            </div>
          ))}
        </div>
        <div className="lv-ranking card">
          <div className="lv-panel-title">🏆 {txt('실시간 순위', 'Live Rankings')}</div>
          {[...board.map(p=>({...p, name: p.username||p.name})),
            {name:isAdmin?'(Admin)':'Me',score:Object.keys(mySolved).length,isMe:!isAdmin}]
            .sort((a,b)=>b.score-a.score).map((p,i)=>(
            <div key={p.name} className={`lr-row ${p.isMe?'me':''}`}>
              <span className="mono" style={{width:20,color:'var(--text2)',fontWeight:700}}>{i+1}</span>
              <span style={{flex:1,fontWeight:600}}>{p.name}</span>
              <span className="mono" style={{color:'var(--blue)',fontWeight:700}}>{p.score} solved</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VirtualContestView({ payload, onExit }) {
  const contest = payload?.contest || {};
  const toast = useToast();
  const { t } = useLang();
  const [run, setRun] = useState(payload?.run || null);
  const [probs, setProbs] = useState(payload?.problems || []);
  const [remainingMs, setRemainingMs] = useState(payload?.run?.remainingMs || 0);
  const [problemId, setProblemId] = useState(payload?.problems?.[0]?.id || '');
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    let ignore = false;
    const refresh = () => {
      api.get(`/contests/${contest.id}/virtual/status`)
        .then((res) => {
          if (ignore) return;
          setRun(res.data?.run || null);
          const nextProblems = res.data?.problems || [];
          setProbs(nextProblems);
          if (!problemId && nextProblems[0]?.id) setProblemId(nextProblems[0].id);
          setRemainingMs(res.data?.run?.remainingMs || 0);
        })
        .catch(() => {});
    };
    refresh();
    const poll = setInterval(refresh, 10000);
    return () => { ignore = true; clearInterval(poll); };
  }, [contest.id, problemId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingMs((value) => Math.max(0, value - 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const solvedIds = new Set((run?.submissions || []).filter((item) => item.result === 'correct').map((item) => Number(item.problemId)));
  const remainingSec = Math.ceil(remainingMs / 1000);
  const mm = String(Math.floor(remainingSec / 60)).padStart(2, '0');
  const ss = String(remainingSec % 60).padStart(2, '0');

  const submitVirtual = async () => {
    if (!problemId || !code.trim() || submitting || remainingSec === 0) return;
    setSubmitting(true);
    setLastResult(null);
    try {
      const { data } = await api.post(`/contests/${contest.id}/virtual/submit`, {
        problemId,
        language,
        code,
      });
      setRun((prev) => ({ ...(prev || {}), submissions: data.submissions || prev?.submissions || [] }));
      setLastResult(data.execution || null);
      toast?.show(data.execution?.result === 'correct' ? 'Virtual — Correct!' : 'Check your result.', data.execution?.result === 'correct' ? 'success' : 'info');
    } catch (err) {
      toast?.show(err.response?.data?.message || 'Virtual submit failed', 'error');
    }
    setSubmitting(false);
  };

  return (
    <div className="live-view fade-in">
      <div className="lv-header">
        <div className="lv-title">⏪ Virtual · {contest.name}</div>
        <div className="lv-timer mono" style={{color:remainingSec === 0 ? 'var(--text3)' : remainingSec <= 300 ? 'var(--red)' : 'var(--yellow)'}}>
          {remainingSec === 0 ? '⏱ Time Up' : `⏱ ${mm}:${ss} left`}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onExit}>← Exit</button>
      </div>
      <div className="lv-body">
        <div className="lv-problems card">
          <div className="lv-panel-title">📋 Virtual Problems</div>
          {probs.length === 0 && <div style={{padding:'12px 16px',fontSize:13,color:'var(--text3)'}}>No problems found.</div>}
          {probs.map((p,i)=>(
            <div key={p.id} className={`lp-row ${solvedIds.has(Number(p.id))?'solved':''}`}>
              <span className="mono" style={{fontSize:11,color:'var(--text3)'}}>P{i+1}</span>
              <span style={{flex:1,fontWeight:600}}>#{p.id} {p.title}</span>
              {solvedIds.has(Number(p.id)) && <span style={{color:'var(--green)'}}>✓</span>}
            </div>
          ))}
        </div>
        <div className="lv-ranking card">
          <div className="lv-panel-title">🏆 {t('contestMyProgress')}</div>
          <div className="lr-row me">
            <span style={{flex:1,fontWeight:700}}>{t('contestSolvedProblems')}</span>
            <span className="mono" style={{color:'var(--blue)',fontWeight:700}}>{solvedIds.size}/{probs.length}</span>
          </div>
          <div style={{padding:'12px 16px',display:'grid',gap:10}}>
            <select value={problemId} onChange={(e) => setProblemId(e.target.value)} disabled={remainingSec === 0}>
              {probs.map((problem, index) => <option key={problem.id} value={problem.id}>P{index + 1} · {problem.title}</option>)}
            </select>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={remainingSec === 0}>
              {JUDGE_LANGUAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('contestSubmitNote')}
              rows={10}
              disabled={remainingSec === 0}
              style={{width:'100%',minHeight:180,fontFamily:'var(--font-mono)',fontSize:13,borderRadius:12,border:'1px solid var(--border)',background:'var(--bg)',color:'var(--text)',padding:12}}
            />
            <button className="btn btn-primary" onClick={submitVirtual} disabled={submitting || remainingSec === 0 || !code.trim() || !problemId}>
              {submitting ? <span className="spinner"/> : 'Submit (Virtual)'}
            </button>
            {lastResult && (
              <div className="lr-row me" style={{alignItems:'flex-start'}}>
                <span style={{flex:1,fontWeight:700}}>Last Result</span>
                <span className="mono" style={{color:lastResult.result === 'correct' ? 'var(--green)' : 'var(--red)',fontWeight:700}}>
                  {lastResult.result} · {lastResult.time || '-'} · {lastResult.mem || '-'}
                </span>
              </div>
            )}
            <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.7}}>
              Virtual submissions do not count toward global rating or the official leaderboard.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
