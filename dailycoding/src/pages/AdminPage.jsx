import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import api from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { MIN_HIDDEN_TESTCASES } from '../data/problems';
import { JUDGE_LANGUAGE_OPTIONS } from '../data/judgeLanguages.js';
import { getDateLocale, pickLangText } from '../utils/languageMode.js';
import { getProblemTypeLabel, getStatusLabel, getTagLabel, getTierLabel } from '../utils/labelMaps.js';
import { TechIcon } from '../components/icons/BrandIcon.jsx';
import './AdminPage.css';

const TIER_OPTIONS = ['bronze','silver','gold','platinum','diamond'];
const PROBLEM_TYPE_OPTIONS = [
  { value: 'coding', ko: '일반 풀이', label: 'Coding' },
  { value: 'fill-blank', ko: '빈칸 채우기', label: 'Fill in the Blank' },
  { value: 'bug-fix', ko: '틀린부분 찾기', label: 'Bug Fix' },
  { value: 'troubleshooting', ko: '트러블슈팅', label: 'Troubleshooting' },
  { value: 'performance-fix', ko: '성능 개선', label: 'Performance Fix' },
  { value: 'refactor-fix', ko: '리팩터링', label: 'Refactoring' },
];
const TAG_OPTIONS  = ['수학','다이나믹 프로그래밍','그래프 이론','문자열','구현','소수','BFS','DFS','입출력','탐욕','정렬','이분 탐색','트리','스택/큐'];
const TIER_COLORS  = { bronze:'#cd7f32', silver:'#c0c0c0', gold:'#ffd700', platinum:'#00e5cc', diamond:'#b9f2ff' };
const TROUBLESHOOTING_TYPES = new Set(['troubleshooting', 'performance-fix', 'refactor-fix']);
const makeEmptyCases = (count = 10) => Array.from({ length: count }, () => ({ input:'', output:'' }));
const createEmptySpecialConfig = () => ({
  codeTemplate: '',
  blanksText: '',
  buggyCode: '',
  keywordsText: '',
  explanation: '',
  scenarioTitle: '',
  scenarioDescription: '',
  initialFiles: [
    { path: 'server.js', content: 'console.log("slow")\n', editable: true },
    { path: 'test.js', content: 'require("./server")\n', editable: false },
  ],
  visibleTests: [
    { name: 'visible test', commandText: 'node test.js', expectedOutput: '' },
  ],
  hiddenTests: [],
  performanceLimitMs: '1000',
  memoryLimitMb: '256',
  targetResponseTimeMs: '500',
  baselineTimeMs: '3000',
  allowedFilesText: 'server.js',
  forbiddenPatternsText: 'eval\\(',
  scoringRulesText: '{\n  "correctness": 50,\n  "performance": 30,\n  "readability": 20\n}',
  evaluationMode: 'command',
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
  const { lang } = useLang();
  const txt = (ko, en) => pickLangText(lang, ko, en);
  const dateLocale = getDateLocale(lang);
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
  const [aiForm,       setAiForm]       = useState({ tier:'silver', tags:[], difficulty:'4', topic:'', problemType:'coding' });
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
  const [communitySubmissions, setCommunitySubmissions] = useState([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityFilter, setCommunityFilter] = useState('pending');
  const [communityDetail, setCommunityDetail] = useState(null);
  const [communityRejectNote, setCommunityRejectNote] = useState('');
  const [flaggedSubmissions, setFlaggedSubmissions] = useState([]);
  const [flaggedLoading, setFlaggedLoading] = useState(false);

  useEffect(() => { api.get('/problems').then(r=>setProblems(r.data)).catch(()=>{}); }, []);
  useEffect(() => {
    if (activeTab==='users') api.get('/auth/users').then(r=>setUsers(Array.isArray(r.data?.users) ? r.data.users : [])).catch(()=>{});
    if (activeTab==='contests') api.get('/contests').then(r=>setContests(r.data)).catch(()=>{});
    if (activeTab==='battle') api.get('/admin/battle-settings').then(r=>setBattleSettings(r.data)).catch(()=>{});
    if (activeTab==='flagged') {
      setFlaggedLoading(true);
      api.get('/admin/flagged-submissions')
        .then(r => setFlaggedSubmissions(r.data?.rows || []))
        .catch(() => setFlaggedSubmissions([]))
        .finally(() => setFlaggedLoading(false));
    }
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

  useEffect(() => {
    if (activeTab !== 'community') return;
    setCommunityLoading(true);
    api.get(`/community-problems/admin?status=${communityFilter}`)
      .then(r => setCommunitySubmissions(r.data.rows || []))
      .catch(() => {})
      .finally(() => setCommunityLoading(false));
  }, [activeTab, communityFilter]);

  const handleCommunityApprove = async (id) => {
    if (!window.confirm('이 문제를 승인하고 공식 문제로 등록하시겠습니까?')) return;
    try {
      await api.post(`/community-problems/admin/${id}/approve`);
      toast?.show('✅ 문제가 등록되었습니다.', 'success');
      setCommunitySubmissions(s => s.filter(x => x.id !== id));
      setCommunityDetail(null);
    } catch (err) {
      toast?.show(err.response?.data?.message || '승인 실패', 'error');
    }
  };

  const handleCommunityReject = async (id) => {
    try {
      await api.post(`/community-problems/admin/${id}/reject`, { note: communityRejectNote });
      toast?.show('거절되었습니다.', 'success');
      setCommunitySubmissions(s => s.filter(x => x.id !== id));
      setCommunityDetail(null);
      setCommunityRejectNote('');
    } catch (err) {
      toast?.show(err.response?.data?.message || '거절 실패', 'error');
    }
  };

  const handleFlaggedReviewed = async (id) => {
    try {
      await api.patch(`/admin/flagged-submissions/${id}/review`);
      setFlaggedSubmissions(rows => rows.map(row => row.id === id ? { ...row, reviewed: 1 } : row));
      toast?.show('Marked as reviewed.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || 'Failed to mark as reviewed', 'error');
    }
  };

  if (!isAdmin) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'calc(100vh - 54px)',flexDirection:'column',gap:12}}>
      <div style={{fontSize:48}}>🚫</div>
      <p style={{color:'var(--text2)'}}>Admin access only.</p>
      <button className="btn btn-primary" onClick={()=>navigate('/')}>Go Back</button>
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

  const isTroubleshootingForm = TROUBLESHOOTING_TYPES.has(form.problemType);
  const updateTroubleshootingFile = (index, patch) => {
    setForm((prev) => {
      const files = [...(prev.specialConfig.initialFiles || [])];
      files[index] = { ...files[index], ...patch };
      return { ...prev, specialConfig: { ...prev.specialConfig, initialFiles: files } };
    });
  };
  const addTroubleshootingFile = () => setForm((prev) => ({
    ...prev,
    specialConfig: {
      ...prev.specialConfig,
      initialFiles: [...(prev.specialConfig.initialFiles || []), { path: 'new-file.js', content: '', editable: true }],
    },
  }));
  const removeTroubleshootingFile = (index) => setForm((prev) => ({
    ...prev,
    specialConfig: {
      ...prev.specialConfig,
      initialFiles: (prev.specialConfig.initialFiles || []).filter((_, i) => i !== index),
    },
  }));
  const updateTroubleshootingTest = (field, index, patch) => {
    setForm((prev) => {
      const tests = [...(prev.specialConfig[field] || [])];
      tests[index] = { ...tests[index], ...patch };
      return { ...prev, specialConfig: { ...prev.specialConfig, [field]: tests } };
    });
  };
  const addTroubleshootingTest = (field) => setForm((prev) => ({
    ...prev,
    specialConfig: {
      ...prev.specialConfig,
      [field]: [...(prev.specialConfig[field] || []), { name: 'test', commandText: 'node test.js', expectedOutput: '' }],
    },
  }));
  const removeTroubleshootingTest = (field, index) => setForm((prev) => ({
    ...prev,
    specialConfig: {
      ...prev.specialConfig,
      [field]: (prev.specialConfig[field] || []).filter((_, i) => i !== index),
    },
  }));
  const buildTroubleshootingPayload = () => {
    let scoringRules = null;
    try {
      scoringRules = JSON.parse(form.specialConfig.scoringRulesText || '{}');
    } catch {
      scoringRules = { correctness: 50, performance: 30, readability: 20 };
    }
    const normalizeTests = (tests = []) => tests
      .filter((test) => test.name || test.commandText || test.expectedOutput)
      .map((test) => ({
        name: test.name || 'test',
        command: String(test.commandText || '').trim().split(/\s+/).filter(Boolean),
        expectedOutput: test.expectedOutput || '',
        timeoutMs: test.timeoutMs ? Number(test.timeoutMs) : undefined,
      }));
    return {
      scenarioTitle: form.specialConfig.scenarioTitle || form.title,
      scenarioDescription: form.specialConfig.scenarioDescription || form.desc,
      initialFiles: (form.specialConfig.initialFiles || []).filter((file) => file.path).map((file) => ({
        path: file.path,
        content: file.content || '',
        editable: file.editable !== false,
      })),
      visibleTests: normalizeTests(form.specialConfig.visibleTests),
      hiddenTests: normalizeTests(form.specialConfig.hiddenTests),
      performanceLimitMs: form.specialConfig.performanceLimitMs ? Number(form.specialConfig.performanceLimitMs) : null,
      memoryLimitMb: form.specialConfig.memoryLimitMb ? Number(form.specialConfig.memoryLimitMb) : null,
      targetResponseTimeMs: form.specialConfig.targetResponseTimeMs ? Number(form.specialConfig.targetResponseTimeMs) : null,
      baselineTimeMs: form.specialConfig.baselineTimeMs ? Number(form.specialConfig.baselineTimeMs) : null,
      allowedFiles: parseCsv(form.specialConfig.allowedFilesText),
      forbiddenPatterns: parseCsv(form.specialConfig.forbiddenPatternsText),
      scoringRules,
      evaluationMode: form.specialConfig.evaluationMode || 'command',
    };
  };

  const handleAiGenerate = async () => {
    setAiGenerating(true); setAiPreview(null);
    try {
      const res = await api.post('/ai/generate-problem', { tier:aiForm.tier, tags:aiForm.tags, difficulty:aiForm.difficulty, topic:aiForm.topic, problemType:aiForm.problemType });
      const d = res.data;
      setAiPreview(d);
      const pt = aiForm.problemType;
      const isTrouble = TROUBLESHOOTING_TYPES.has(pt);
      let specialConfig = createEmptySpecialConfig();
      if (pt === 'fill-blank') {
        specialConfig = { ...specialConfig, codeTemplate: d.codeTemplate || '', blanksText: Array.isArray(d.blanks) ? d.blanks.join('\n') : '', hint: d.hint || '' };
      } else if (pt === 'bug-fix') {
        specialConfig = { ...specialConfig, buggyCode: d.buggyCode || '', keywordsText: Array.isArray(d.keywords) ? d.keywords.join('\n') : '', explanation: d.explanation || '', hint: d.hint || '' };
      } else if (isTrouble) {
        specialConfig = {
          ...specialConfig,
          scenarioTitle: d.scenarioTitle || '',
          scenarioDescription: d.scenarioDescription || '',
          initialFiles: Array.isArray(d.initialFiles) ? d.initialFiles : [{ path: 'main.py', content: '', editable: true }],
          visibleTests: Array.isArray(d.visibleTests) ? d.visibleTests : [],
          baselineTimeMs: d.baselineTimeMs || '',
          targetResponseTimeMs: d.targetResponseTimeMs || '',
        };
      }
      setForm({
        title:d.title||'', tier:aiForm.tier, problemType:pt, preferredLanguage:'python', tags:aiForm.tags,
        timeLimit:String(d.timeLimit||2), memLimit:String(d.memLimit||256), difficulty:aiForm.difficulty,
        desc:d.desc||'', inputDesc:d.inputDesc||'', outputDesc:d.outputDesc||'',
        examples:d.examples?.length?d.examples:[{input:'',output:''}], testcases:makeEmptyCases(),
        hint:d.hint||'', solution:d.solution||'', specialConfig,
      });
    } catch { addNotification('❌ AI generation failed. Please try again.'); toast?.show('❌ AI generation failed', 'error'); }
    setAiGenerating(false);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.desc.trim()) return;
    const specialConfig = buildSpecialConfigPayload();
    if (form.problemType === 'fill-blank') {
      if (!specialConfig?.codeTemplate?.trim()) {
        toast?.show('Fill in the Blank problems require a code template.', 'warning');
        return;
      }
      if (!Array.isArray(specialConfig?.blanks) || specialConfig.blanks.length === 0) {
        toast?.show('Enter at least one blank answer separated by commas or newlines.', 'warning');
        return;
      }
    }
    if (form.problemType === 'bug-fix') {
      if (!specialConfig?.buggyCode?.trim()) {
        toast?.show('Bug Fix problems require buggy code.', 'warning');
        return;
      }
      if (!Array.isArray(specialConfig?.keywords) || specialConfig.keywords.length === 0) {
        toast?.show('Enter at least one answer keyword separated by commas or newlines.', 'warning');
        return;
      }
    }
    if (isTroubleshootingForm) {
      const scenario = buildTroubleshootingPayload();
      if (!scenario.scenarioTitle.trim()) {
        toast?.show('Please enter a scenario title.', 'warning');
        return;
      }
      if (!scenario.initialFiles.length) {
        toast?.show('Add at least one troubleshooting file.', 'warning');
        return;
      }
      if (!scenario.visibleTests.length && !scenario.hiddenTests.length) {
        toast?.show('Add at least one visible or hidden test.', 'warning');
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
      let savedProblem;
      if (editTarget !== null) {
        const res = await api.put(`/problems/${editTarget}`, payload);
        savedProblem = res.data;
        setProblems(p=>p.map(pr=>pr.id===editTarget?res.data:pr));
        toast?.show(`✏️ "${form.title}" updated.`, 'info');
        loadProblems();
      } else {
        const res = await api.post('/problems', payload);
        savedProblem = res.data;
        setProblems(p=>[res.data,...p]);
        toast?.show(`🆕 "${form.title}" 문제 등록 완료!`, 'success');
        loadProblems();
      }
      if (isTroubleshootingForm && savedProblem?.id) {
        await api.post(`/admin/problems/${savedProblem.id}/troubleshooting`, buildTroubleshootingPayload());
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
          ...createEmptySpecialConfig(),
          codeTemplate: d.specialConfig?.codeTemplate || '',
          blanksText: Array.isArray(d.specialConfig?.blanks) ? d.specialConfig.blanks.join(', ') : '',
          buggyCode: d.specialConfig?.buggyCode || '',
          keywordsText: Array.isArray(d.specialConfig?.keywords) ? d.specialConfig.keywords.join(', ') : '',
          explanation: d.specialConfig?.explanation || '',
        },
      });
      setEditTarget(d.id); setView('create'); setAiPanel(false); setAiPreview(null);
      if (TROUBLESHOOTING_TYPES.has(d.problemType || '')) {
        api.get(`/problems/${d.id}/troubleshooting`).then((troubleRes) => {
          const cfg = troubleRes.data || {};
          setForm((prev) => ({
            ...prev,
            specialConfig: {
              ...prev.specialConfig,
              scenarioTitle: cfg.scenarioTitle || '',
              scenarioDescription: cfg.scenarioDescription || '',
              initialFiles: Array.isArray(cfg.initialFiles) && cfg.initialFiles.length ? cfg.initialFiles : createEmptySpecialConfig().initialFiles,
              visibleTests: Array.isArray(cfg.visibleTests) ? cfg.visibleTests.map((test) => ({
                name: test.name || '',
                commandText: Array.isArray(test.command) ? test.command.join(' ') : test.command || '',
                expectedOutput: test.expectedOutput || '',
                timeoutMs: test.timeoutMs || '',
              })) : [],
              hiddenTests: Array.isArray(cfg.hiddenTests) ? cfg.hiddenTests.map((test) => ({
                name: test.name || '',
                commandText: Array.isArray(test.command) ? test.command.join(' ') : test.command || '',
                expectedOutput: test.expectedOutput || '',
                timeoutMs: test.timeoutMs || '',
              })) : [],
              performanceLimitMs: cfg.performanceLimitMs || '',
              memoryLimitMb: cfg.memoryLimitMb || '',
              targetResponseTimeMs: cfg.targetResponseTimeMs || '',
              baselineTimeMs: cfg.baselineTimeMs || '',
              allowedFilesText: Array.isArray(cfg.allowedFiles) ? cfg.allowedFiles.join(', ') : '',
              forbiddenPatternsText: Array.isArray(cfg.forbiddenPatterns) ? cfg.forbiddenPatterns.join(', ') : '',
              scoringRulesText: JSON.stringify(cfg.scoringRules || { correctness: 50, performance: 30, readability: 20 }, null, 2),
              evaluationMode: cfg.evaluationMode || 'command',
            },
          }));
        }).catch(() => {});
      }
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
      toast?.show('⚔️ 배틀 설정이 즉시 적용되었습니다.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || '배틀 설정 저장 실패', 'error');
    } finally {
      setBattleSettingsSaving(false);
    }
  };

  const handleDelete = (id, title) => setConfirmModal({ msg:`문제 "${title}"을 삭제하시겠습니까?`, onConfirm: async () => { try { await api.delete(`/problems/${id}`); setProblems(p=>p.filter(pr=>pr.id!==id)); loadProblems(); toast?.show('🗑 문제 삭제됨', 'info'); } catch(err) { toast?.show('❌ 삭제 실패: '+(err.response?.data?.message||err.message), 'error'); } } });
  const handleDeleteContest = (id, name) => setConfirmModal({ msg:`대회 "${name}"을 삭제하시겠습니까?`, onConfirm: async () => { try { await api.delete(`/contests/${id}`); setContests(p=>p.filter(c=>c.id!==id)); loadContests(); toast?.show('🗑 대회 삭제됨', 'info'); } catch(err) { toast?.show('❌ 삭제 실패: '+(err.response?.data?.message||err.message), 'error'); } } });
  const handleContestStart = async (id) => {
    try {
      await api.patch(`/contests/${id}/start`);
      setContests(p=>p.map(c=>c.id===id?{...c,status:'live'}:c));
      toast?.show('🔴 Contest started!', 'success');
    } catch {
      toast?.show('대회 시작 실패', 'error');
    }
  };
  const handleContestEnd = async (id) => {
    try {
      await api.patch(`/contests/${id}/end`);
      setContests(p=>p.map(c=>c.id===id?{...c,status:'ended'}:c));
      toast?.show('🏁 Contest ended', 'info');
    } catch {
      toast?.show('대회 종료 실패', 'error');
    }
  };
  const handleRoleChange = async (uid, role) => {
    try {
      await api.patch(`/auth/users/${uid}/role`,{role});
      setUsers(p=>p.map(u=>u.id===uid?{...u,role}:u));
    } catch {
      toast?.show('역할 변경 실패', 'error');
    }
  };
  const handleDeleteUser = (uid, name) => setConfirmModal({ msg:`사용자 "${name}"을 삭제하시겠습니까?`, onConfirm: async () => {
    try {
      await api.delete(`/auth/users/${uid}`);
      setUsers(p=>p.filter(u=>u.id!==uid));
    } catch {
      toast?.show('Failed to delete user', 'error');
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
      toast?.show(`🔒 ${pwModal.name} 비밀번호 초기화 완료`, 'success');
      setPwModal(null);
    } catch (err) {
      toast?.show('❌ ' + (err.response?.data?.message || 'Failed'), 'error');
    }
  };

  const handleClearCache = async (target) => {
    setClearing(target);
    try {
      const labelMap = { all: txt('전체','All'), leaderboards: txt('랭킹','Rankings'), heatmaps: txt('활동','Activity'), problems: txt('문제','Problems') };
      await api.post('/admin/cache/clear', { target });
      toast?.show(`✅ ${labelMap[target] || target} ${txt('캐시가 초기화되었습니다.','cache cleared.')}`, 'success');
    } catch (err) {
      toast?.show('❌ 캐시 초기화 실패', 'error');
    } finally {
      setClearing(null);
    }
  };

  const handleSaveWeeklyChallenge = async () => {
    if (!weeklyForm.problemId) {
      toast?.show('Please enter a problem ID.', 'warning');
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
      toast?.show(txt('🏆 이번 주 챌린지가 설정되었습니다.','🏆 Weekly challenge set.'), 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || txt('주간 챌린지 설정 실패','Failed to set weekly challenge'), 'error');
    } finally {
      setWeeklySaving(false);
    }
  };

  // ── 예제/테스트케이스 공통 렌더러
  const renderCaseEditor = (label, icon, items, fieldKey, color) => (
    <div className="form-group">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <label>{icon} {label}</label>
        <button type="button" className="btn btn-ghost btn-sm" onClick={()=>f(fieldKey,[...items,{input:'',output:''}])}>+ Add</button>
      </div>
      {items.map((ex,i)=>(
        <div key={i} style={{background:'var(--bg3)',border:`1px solid ${color}30`,borderRadius:8,padding:12,marginBottom:8}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <span style={{fontSize:12,fontWeight:700,color}}>{label} {i+1}</span>
            <button type="button" onClick={()=>f(fieldKey,items.filter((_,j)=>j!==i))} style={{background:'none',border:'none',color:'var(--red)',cursor:'pointer',fontSize:13}}>✕ Delete</button>
          </div>
          <div className="cf-row" style={{margin:0,gap:8}}>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--text2)',marginBottom:4,textTransform:'uppercase',letterSpacing:.5}}>Input</div>
              <textarea rows={3} className="mono" placeholder={txt('입력값','Input value')} value={ex.input}
                onChange={e=>{ const arr=[...items]; arr[i]={...arr[i],input:e.target.value}; f(fieldKey,arr); }}
                style={{resize:'vertical',color:'var(--green)',width:'100%'}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--text2)',marginBottom:4,textTransform:'uppercase',letterSpacing:.5}}>Output</div>
              <textarea rows={3} className="mono" placeholder={txt('출력값','Output value')} value={ex.output}
                onChange={e=>{ const arr=[...items]; arr[i]={...arr[i],output:e.target.value}; f(fieldKey,arr); }}
                style={{resize:'vertical',color:'var(--green)',width:'100%'}}/>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const STATUS_LABELS = { live:getStatusLabel('live', lang), upcoming:getStatusLabel('upcoming', lang), waiting:getStatusLabel('waiting', lang), ended:getStatusLabel('ended', lang), running:getStatusLabel('running', lang) };
  const STATUS_COLORS = { live:'var(--red)', upcoming:'var(--yellow)', waiting:'var(--yellow)', ended:'var(--text3)' };

  // ── 목록 뷰
  if (view==='list') return (
    <div className="admin-page">
      <div className="admin-header fade-up">
        <div><h1>{txt('관리자 패널', 'Admin Panel')}</h1><p>{txt('문제, 대회, 사용자를 관리합니다.', 'Manage problems, contests, and users.')}</p></div>
        {activeTab==='problems' && <button className="btn btn-primary" onClick={()=>{setForm(createEmptyForm());setEditTarget(null);setAiPreview(null);setView('create');}}>+ {txt('문제 추가', 'Add Problem')}</button>}
      </div>
      <div className="admin-tabs fade-up">
        {[
          ['problems', txt('문제', 'Problems')],
          ['contests', txt('대회', 'Contests')],
          ['users', txt('사용자', 'Users')],
          ['battle', txt('배틀', 'Battle')],
          ['stats', txt('통계', 'Stats')],
          ['flagged', txt('신고됨', 'Flagged')],
          ['system', txt('시스템', 'System')],
          ['community', txt('제출', 'Submissions')],
        ].map(([k,l])=>(
          <button key={k} className={`at-btn ${activeTab===k?'active':''}`} onClick={()=>setActiveTab(k)}>{l}</button>
        ))}
      </div>

      {/* ── 문제 탭 */}
      {activeTab==='problems' && (
        <div className="card fade-up" style={{overflow:'hidden'}}>
          {problems.length===0 ? (
            <div className="admin-empty">
              <div style={{fontSize:40}}>📝</div>
              <p>{txt('문제가 없습니다. 직접 만들거나 AI로 생성하세요!', 'No problems yet. Create manually or use AI generation!')}</p>
              <button className="btn btn-primary btn-sm" onClick={()=>setView('create')}>{txt('문제 만들기', 'Create Problem')}</button>
            </div>
          ) : (
            <table className="admin-table">
              <thead><tr><th style={{width:60}}>#</th><th>{txt('제목','Title')}</th><th style={{width:90}}>{txt('유형','Type')}</th><th style={{width:90}}>{txt('티어','Tier')}</th><th style={{width:70}}>{txt('난이도','Diff')}</th><th style={{width:80}}>{txt('공개','Vis')}</th><th style={{width:90}}>{txt('숨김','Hidden')}</th><th style={{width:90}}>{txt('제출','Submit')}</th><th style={{width:120}}>{txt('관리','Manage')}</th></tr></thead>
              <tbody>
                {problems.map(p=>(
                  <tr key={p.id} className="at-row">
                    <td className="mono" style={{fontSize:11,color:'var(--text3)'}}>#{p.id}</td>
                    <td style={{fontWeight:600}}>{p.title}</td>
                    <td><span className="tag" style={{fontSize:10,background:'var(--bg3)',color:'var(--text2)'}}>{getProblemTypeLabel(p.problemType || 'coding', lang)}</span></td>
                    <td><span style={{fontSize:11,fontWeight:700,fontFamily:'Space Mono,monospace',color:TIER_COLORS[p.tier]}}>● {getTierLabel(p.tier, lang)}</span></td>
                    <td className="mono" style={{fontSize:12}}>{p.difficulty}/10</td>
                    <td><span className="tag" style={{background:p.visibility==='contest'?'var(--purple)':'var(--bg3)',color:p.visibility==='contest'?'#fff':'var(--text2)',fontSize:10}}>{p.visibility==='contest'?txt('대회', 'Contest'):txt('전체', 'All')}</span></td>
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
              <p>{txt('등록된 대회 없음', 'No contests registered')}</p>
            </div>
          ) : (
            <table className="admin-table">
              <thead><tr><th style={{width:40}}>ID</th><th>{txt('이름','Name')}</th><th style={{width:90}}>{txt('상태','Status')}</th><th style={{width:70}}>{txt('참가자','Players')}</th><th style={{width:80}}>{txt('시간','Time')}</th><th style={{width:180}}>{txt('관리','Manage')}</th></tr></thead>
              <tbody>
                {contests.map(c=>(
                  <tr key={c.id} className="at-row">
                    <td className="mono" style={{fontSize:11,color:'var(--text3)'}}>#{c.id}</td>
                    <td style={{fontWeight:600}}>{c.name}</td>
                    <td><span style={{fontSize:11,fontWeight:700,color:STATUS_COLORS[c.status]||'var(--text3)'}}>{STATUS_LABELS[c.status]||c.status}</span></td>
                    <td className="mono" style={{fontSize:12}}>{c.participants||0}/{c.max||20}</td>
                    <td className="mono" style={{fontSize:12,color:'var(--text2)'}}>{c.duration||60}min</td>
                    <td><div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                      {(c.status==='upcoming'||c.status==='waiting')&&<button className="btn btn-sm" style={{background:'rgba(86,211,100,.1)',color:'var(--green)',border:'1px solid rgba(86,211,100,.3)',fontSize:11}} onClick={()=>handleContestStart(c.id)}>{txt('시작', 'Start')}</button>}
                      {(c.status==='live'||c.status==='running')&&<button className="btn btn-sm" style={{background:'rgba(227,179,65,.1)',color:'var(--yellow)',border:'1px solid rgba(227,179,65,.3)',fontSize:11}} onClick={()=>handleContestEnd(c.id)}>{txt('종료', 'End')}</button>}
                      <button className="btn btn-sm" style={{background:'rgba(248,81,73,.1)',color:'var(--red)',border:'1px solid rgba(248,81,73,.3)',fontSize:11}} onClick={()=>handleDeleteContest(c.id,c.name)}>{txt('삭제', 'Delete')}</button>
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
              placeholder={txt('🔍 유저명 또는 이메일 검색...', '🔍 Search username or email...')}
              value={userSearch}
              onChange={e=>setUserSearch(e.target.value)}
              style={{width:'100%',padding:'8px 12px',fontSize:13,borderRadius:8,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)'}}
            />
          </div>
          {users.length===0 ? <div className="admin-empty"><p>{txt('사용자 없음', 'No users')}</p></div> : (
            <table className="admin-table">
              <thead><tr><th style={{width:40}}>ID</th><th>{txt('닉네임','Username')}</th><th>{txt('이메일','Email')}</th><th style={{width:80}}>{txt('티어','Tier')}</th><th style={{width:80}}>{txt('레이팅','Rating')}</th><th style={{width:80}}>{txt('역할','Role')}</th><th style={{width:110}}>{txt('관리','Manage')}</th></tr></thead>
              <tbody>
                {users.filter(u=>!userSearch||u.username?.toLowerCase().includes(userSearch.toLowerCase())||u.email?.toLowerCase().includes(userSearch.toLowerCase())).map(u=>(
                  <tr key={u.id} className="at-row">
                    <td className="mono" style={{fontSize:11,color:'var(--text3)'}}>#{u.id}</td>
                    <td style={{fontWeight:600}}>{u.username}{u.role==='admin'&&<span style={{marginLeft:6,fontSize:9,color:'var(--yellow)',fontWeight:700}}>ADMIN</span>}</td>
                    <td style={{fontSize:12,color:'var(--text2)'}}>{u.email}</td>
                    <td><span style={{fontSize:11,fontWeight:700,fontFamily:'Space Mono,monospace',color:TIER_COLORS[u.tier]}}>● {u.tier}</span></td>
                    <td className="mono" style={{fontSize:12,color:'var(--blue)'}}>{u.rating}</td>
                    <td><select value={u.role} onChange={e=>handleRoleChange(u.id,e.target.value)} style={{padding:'3px 6px',fontSize:12,width:'auto'}}><option value="user">User</option><option value="admin">Admin</option></select></td>
                    <td style={{display:'flex',gap:4}}>
                      <button className="btn btn-sm" style={{background:'rgba(227,179,65,.1)',color:'var(--yellow)',border:'1px solid rgba(227,179,65,.3)',fontSize:11}} onClick={()=>handleResetPw(u.id,u.username)}>PW</button>
                      <button className="btn btn-sm" style={{background:'rgba(248,81,73,.1)',color:'var(--red)',border:'1px solid rgba(248,81,73,.3)'}} onClick={()=>handleDeleteUser(u.id,u.username)}>{txt('삭제','Delete')}</button>
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
            <h3 style={{marginBottom:8}}>⚔️ Battle Problem Settings</h3>
            <p style={{fontSize:13,color:'var(--text2)',marginBottom:16}}>
              Changes apply to newly created battle rooms immediately after saving.
            </p>
            <div className="cf-row">
              <div className="form-group" style={{flex:1}}>
                <label>{txt('코딩 문제', 'Coding Problems')}</label>
                <input type="number" min="1" max="8" value={battleSettings.codingCount}
                  onChange={e=>setBattleSettings(p=>({...p,codingCount:e.target.value}))} />
              </div>
              <div className="form-group" style={{flex:1}}>
                <label>{txt('빈칸 채우기 문제', 'Fill-Blank Problems')}</label>
                <input type="number" min="0" max="6" value={battleSettings.fillBlankCount}
                  onChange={e=>setBattleSettings(p=>({...p,fillBlankCount:e.target.value}))} />
              </div>
              <div className="form-group" style={{flex:1}}>
                <label>{txt('버그 수정 문제', 'Bug-Fix Problems')}</label>
                <input type="number" min="0" max="6" value={battleSettings.bugFixCount}
                  onChange={e=>setBattleSettings(p=>({...p,bugFixCount:e.target.value}))} />
              </div>
            </div>
            <div className="cf-row" style={{alignItems:'end'}}>
              <div className="form-group" style={{flex:1}}>
                <label>{txt('최대 문제 수', 'Max Problems')}</label>
                <input type="number" min="3" max="20" value={battleSettings.maxTotalProblems}
                  onChange={e=>setBattleSettings(p=>({...p,maxTotalProblems:e.target.value}))} />
              </div>
              <div style={{fontSize:12,color:'var(--text2)',marginBottom:10,flex:2}}>
                {txt('현재 합계', 'Total')}: {Number(battleSettings.codingCount||0) + Number(battleSettings.fillBlankCount||0) + Number(battleSettings.bugFixCount||0)} {txt('문제', 'problems')}
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleSaveBattleSettings} disabled={battleSettingsSaving}>
              {battleSettingsSaving ? <><span className="spinner"/> {txt('저장 중...', 'Saving...')}</> : txt('설정 저장', 'Save Settings')}
            </button>
          </div>
        </div>
      )}

      {/* ── 통계 탭 */}
      {activeTab==='stats' && (
        <div className="admin-stats-grid fade-up">
          {[
            {label:txt('전체 사용자','Total Users'), value:adminStats?.userStats?.total ?? '—', color:'var(--blue)', sub: adminStats ? `+${adminStats.userStats.newThisWeek} ${txt('이번 주','this week')}` : ''},
            {label:txt('오늘 제출','Today Submissions'), value:adminStats?.submissionStats?.totalToday ?? '—', color:'var(--green)', sub: adminStats ? `${adminStats.submissionStats.correctRate}% ${txt('정답','correct')}` : ''},
            {label:txt('오늘 활성','Active Today'), value:adminStats?.userStats?.activeToday ?? '—', color:'var(--yellow)'},
            {label:txt('문제 수','Problems'), value:problems.length, color:'var(--purple)'},
          ].map(s=>(
            <div key={s.label} className="card admin-stat-card">
              <div className="asc-value mono" style={{color:s.color}}>{s.value}</div>
              <div className="asc-label">{s.label}</div>
              {s.sub ? <div style={{fontSize:11,color:'var(--text3)',marginTop:6}}>{s.sub}</div> : null}
            </div>
          ))}
          <div className="card admin-stat-card" style={{gridColumn:'span 2'}}>
            <div className="asc-label" style={{marginBottom:12}}>User Tier Distribution</div>
            <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
              {Object.entries({ unranked:'#666', ...TIER_COLORS }).map(([tier,color])=>{
                const cnt = adminStats?.tierDistribution?.[tier] ?? 0;
                return <div key={tier} style={{textAlign:'center'}}><div style={{fontFamily:'Space Mono,monospace',fontSize:24,fontWeight:700,color}}>{cnt}</div><div style={{fontSize:11,color:'var(--text2)',marginTop:2}}>{tier}</div></div>;
              })}
            </div>
          </div>
          <div className="card admin-stat-card" style={{gridColumn:'span 2', textAlign:'left'}}>
            <div className="asc-label" style={{marginBottom:12}}>Popular Problems TOP 5</div>
            {adminStatsLoading && <div style={{fontSize:12,color:'var(--text3)'}}>Loading stats...</div>}
            {!adminStatsLoading && (adminStats?.popularProblems || []).map((problem, index, arr) => {
              const max = Math.max(...arr.map((item) => item.solveCount || 0), 1);
              return (
                <div key={problem.id} style={{marginBottom:index < arr.length - 1 ? 12 : 0}}>
                  <div style={{display:'flex',justifyContent:'space-between',gap:10,fontSize:12,marginBottom:6}}>
                    <span>{problem.title}</span>
                    <span style={{color:'var(--text3)'}}>{problem.solveCount} solved</span>
                  </div>
                  <div style={{height:8,background:'var(--bg3)',borderRadius:4,overflow:'hidden'}}>
                    <div style={{width:`${(problem.solveCount / max) * 100}%`,height:'100%',background:'var(--blue)',borderRadius:4}} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="card admin-stat-card" style={{gridColumn:'span 2', textAlign:'left'}}>
            <div className="asc-label" style={{marginBottom:12}}>Problems by Type</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10}}>
              {Object.entries(adminStats?.problemTypeCounts || {}).map(([type, count]) => (
                <div key={type} style={{padding:'10px 12px',borderRadius:12,background:'var(--bg3)',border:'1px solid var(--border)'}}>
                  <div style={{fontSize:11,color:'var(--text3)',marginBottom:5}}>{type === 'coding' ? 'algorithm' : type}</div>
                  <div className="mono" style={{fontSize:22,fontWeight:800,color:'var(--blue)'}}>{count}</div>
                </div>
              ))}
              {Object.keys(adminStats?.problemTypeCounts || {}).length === 0 && <div style={{fontSize:12,color:'var(--text3)'}}>No problem type data.</div>}
            </div>
          </div>
          <div className="card admin-stat-card" style={{textAlign:'left'}}>
            <div className="asc-label" style={{marginBottom:12}}>{txt('배틀 현황','Battle Status')}</div>
            {[
              ['waiting', txt('대기 중','Waiting')],
              ['playing', txt('진행 중','Playing')],
              ['finished', txt('완료','Finished')],
            ].map(([key, label]) => (
              <div key={key} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                <span style={{fontSize:12,color:'var(--text2)'}}>{label}</span>
                <strong className="mono">{adminStats?.battleStatus?.[key] || 0}</strong>
              </div>
            ))}
            <div style={{fontSize:12,color:'var(--text3)',marginTop:10}}>
              Total {adminStats?.battleStatus?.total || 0} rooms
            </div>
          </div>
          <div className="card admin-stat-card" style={{textAlign:'left'}}>
            <div className="asc-label" style={{marginBottom:12}}>Avg. Solve Time (performance-fix)</div>
            <div className="asc-value mono" style={{color:'var(--orange)'}}>
              {adminStats?.performanceFixAverageSolveTimeMs ? `${adminStats.performanceFixAverageSolveTimeMs}ms` : '—'}
            </div>
            <div style={{fontSize:12,color:'var(--text3)',marginTop:8}}>
              Average execution time of correct performance-fix submissions.
            </div>
          </div>
          <div className="card admin-stat-card" style={{gridColumn:'span 2', textAlign:'left'}}>
            <div className="asc-label" style={{marginBottom:12}}>Recent Submissions</div>
            {(adminStats?.recentSubmissions || []).slice(0, 6).map((item) => (
              <div key={item.id} style={{display:'flex',justifyContent:'space-between',gap:10,padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:12}}>
                <span>{item.username} · {item.problemTitle}</span>
                <span style={{color:item.result === 'correct' ? 'var(--green)' : 'var(--text3)'}}>{item.result}</span>
              </div>
            ))}
            {(adminStats?.recentSubmissions || []).length === 0 && <div style={{fontSize:12,color:'var(--text3)'}}>No recent submissions.</div>}
          </div>
          <div className="card admin-stat-card" style={{gridColumn:'span 2', textAlign:'left'}}>
            <div className="asc-label" style={{marginBottom:12}}>Recent Reviews</div>
            {(adminStats?.recentReviews || []).slice(0, 6).map((item) => (
              <div key={item.id} style={{display:'flex',justifyContent:'space-between',gap:10,padding:'8px 0',borderBottom:'1px solid var(--border)',fontSize:12}}>
                <span>{item.reviewerUsername} → {item.authorUsername} · {item.problemTitle}</span>
                <span style={{color:item.status === 'approved' || item.status === 'merged' ? 'var(--green)' : 'var(--text3)'}}>{item.status}</span>
              </div>
            ))}
            {(adminStats?.recentReviews || []).length === 0 && <div style={{fontSize:12,color:'var(--text3)'}}>{txt('최근 리뷰 없음.','No recent reviews.')}</div>}
          </div>
          <div className="card admin-stat-card" style={{gridColumn:'span 2', textAlign:'left'}}>
            <div className="asc-label" style={{marginBottom:12}}>{txt('AI 상태','AI Status')}</div>
            {!aiStatus && <div style={{fontSize:12,color:'var(--text3)'}}>{txt('AI 상태 로드 실패.','Failed to load AI status.')}</div>}
            {aiStatus && (
              <div style={{display:'grid', gap:12}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))',gap:10}}>
                  {[
                    { label:txt('API 설정','API Config'), value: aiStatus.configured ? 'OK' : txt('키 없음','No key'), color: aiStatus.configured ? 'var(--green)' : 'var(--red)' },
                    { label:txt('모델','Model'), value: aiStatus.primaryModel || txt('없음','None'), color:'var(--blue)' },
                    { label:txt('쿨다운','Cooldown'), value: aiStatus.providerCooldown ? `${aiStatus.providerCooldownSec}s` : txt('없음','None'), color: aiStatus.providerCooldown ? 'var(--yellow)' : 'var(--green)' },
                    { label:txt('폴백 비율','Fallback Rate'), value: `${aiStatus.metricsToday?.fallbackRate || 0}%`, color: Number(aiStatus.metricsToday?.fallbackRate || 0) > 30 ? 'var(--orange)' : 'var(--green)' },
                  ].map(item => (
                    <div key={item.label} style={{padding:'10px 12px',borderRadius:12,background:'var(--bg3)',border:'1px solid var(--border)',minWidth:0}}>
                      <div style={{fontSize:11,color:'var(--text3)',marginBottom:4}}>{item.label}</div>
                      <div style={{fontWeight:800,color:item.color,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.8}}>
                  Today: {aiStatus.metricsToday?.success || 0} success · {aiStatus.metricsToday?.fallback || 0} fallback · {aiStatus.metricsToday?.providerCalls || 0} provider calls
                  {aiStatus.fallbackModels?.length ? <><br/>Fallback models: {aiStatus.fallbackModels.slice(0, 4).join(', ')}</> : null}
                  {aiStatus.lastEvent?.at ? <><br/>{txt('마지막 이벤트', 'Last event')}: {aiStatus.lastEvent.source}{aiStatus.lastEvent.reason ? ` (${aiStatus.lastEvent.reason})` : ''} · {new Date(aiStatus.lastEvent.at).toLocaleString(dateLocale)}</> : null}
                </div>
              </div>
            )}
          </div>
          <div className="card admin-stat-card" style={{gridColumn:'span 2', textAlign:'left'}}>
            <div className="asc-label" style={{marginBottom:12}}>{txt('Stripe 상태','Stripe Status')}</div>
            {!stripeOps && <div style={{fontSize:12,color:'var(--text3)'}}>{txt('Stripe 상태 로드 실패.','Failed to load Stripe status.')}</div>}
            {stripeOps && (
              <div style={{display:'grid', gap:12}}>
                <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                  {[
                    { label:txt('모드','Mode'), value: stripeOps.mode, color:'var(--blue)' },
                    { label:txt('설정','Config'), value: stripeOps.configured ? 'OK' : txt('미완료','Incomplete'), color: stripeOps.configured ? 'var(--green)' : 'var(--red)' },
                    { label:'Webhook', value: stripeOps.webhookConfigured ? txt('활성','Active') : txt('없음','None'), color: stripeOps.webhookConfigured ? 'var(--green)' : 'var(--yellow)' },
                    { label:'Secret Key', value: stripeOps.secretKeyConfigured ? txt('설정됨','Set') : txt('없음','None'), color: stripeOps.secretKeyConfigured ? 'var(--green)' : 'var(--yellow)' },
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
                      <div style={{fontWeight:800,marginBottom:8}}>{planKey === 'pro' ? 'Pro' : 'Team'}</div>
                      <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.7}}>
                        {txt('월간 Price ID','Monthly Price ID')}: {planValue.monthlyPriceId ? txt('설정됨','Set') : txt('없음','None')}<br />
                        {txt('연간 Price ID','Annual Price ID')}: {planValue.annualPriceId ? txt('설정됨','Set') : txt('없음','None')}<br />
                        {txt('월간 결제 링크','Monthly Payment Link')}: {planValue.monthlyPaymentLink ? txt('설정됨','Set') : txt('없음','None')}<br />
                        {txt('연간 결제 링크','Annual Payment Link')}: {planValue.annualPaymentLink ? txt('설정됨','Set') : txt('없음','None')}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:12,color:'var(--text2)'}}>
                  {txt('마지막 이벤트','Last Event')}: {stripeOps.lastEvent?.eventType || txt('없음','None')}
                  {stripeOps.lastEvent?.recordedAt ? ` · ${new Date(stripeOps.lastEvent.recordedAt).toLocaleString(dateLocale)}` : ''}
                </div>
                {stripeOps.lastError && (
                  <div style={{fontSize:12,color:'var(--red)'}}>
                    Last error: {stripeOps.lastError.message}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="card admin-stat-card" style={{gridColumn:'span 2', textAlign:'left'}}>
            <div className="asc-label" style={{marginBottom:12}}>Weekly Challenge Settings</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:10,alignItems:'end'}}>
              <div className="form-group">
                <label>Problem ID</label>
                <input
                  type="number"
                  value={weeklyForm.problemId}
                  onChange={(e) => setWeeklyForm((prev) => ({ ...prev, problemId: e.target.value }))}
                  placeholder="예) 12"
                />
              </div>
              <div className="form-group">
                <label>Reward Code</label>
                <input
                  value={weeklyForm.rewardCode}
                  onChange={(e) => setWeeklyForm((prev) => ({ ...prev, rewardCode: e.target.value }))}
                  placeholder="weekly_solver"
                />
              </div>
              <button className="btn btn-primary" onClick={handleSaveWeeklyChallenge} disabled={weeklySaving}>
                {weeklySaving ? <span className="spinner"/> : 'Set'}
              </button>
            </div>
            <div style={{marginTop:14,padding:14,borderRadius:12,background:'var(--bg3)',border:'1px solid var(--border)',fontSize:13}}>
              {weeklyChallenge ? (
                <>
                  <div style={{fontWeight:700,marginBottom:4}}>Current Weekly Challenge</div>
                  <div>{weeklyChallenge.problemTitle} · {weeklyChallenge.tier} · Reward: {weeklyChallenge.rewardCode}</div>
                  <div style={{fontSize:11,color:'var(--text3)',marginTop:6}}>
                    {weeklyChallenge.weekStart} ~ {weeklyChallenge.weekEnd}
                  </div>
                </>
              ) : (
                <div style={{color:'var(--text3)'}}>No challenge set for this week.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 의심 제출 탭 */}
      {activeTab==='flagged' && (
        <div className="fade-up">
          <div className="card" style={{padding:24}}>
            <h3 style={{marginBottom:8}}>🛡️ Flagged Submissions</h3>
            <p style={{fontSize:13,color:'var(--text2)',marginBottom:18}}>
              List of correct submissions with high similarity to shared solutions, flagged for admin review.
            </p>
            {flaggedLoading ? (
              <div style={{color:'var(--text3)',fontSize:13}}>Loading...</div>
            ) : flaggedSubmissions.length === 0 ? (
              <div style={{padding:24,textAlign:'center',color:'var(--text3)',background:'var(--bg3)',borderRadius:12}}>
                No flagged submissions to review.
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {flaggedSubmissions.map((row) => (
                  <div key={row.id} style={{
                    display:'grid',
                    gridTemplateColumns:'1.5fr 1fr 120px auto',
                    gap:12,
                    alignItems:'center',
                    padding:'14px 16px',
                    background: row.reviewed ? 'var(--bg2)' : 'var(--bg3)',
                    border:'1px solid var(--border)',
                    borderRadius:12,
                    opacity: row.reviewed ? 0.7 : 1,
                  }}>
                    <div>
                      <div style={{fontWeight:800}}>{row.problemTitle || `Problem #${row.problemId}`}</div>
                      <div style={{fontSize:12,color:'var(--text3)',marginTop:4}}>
                        {row.username} · {row.lang} · {new Date(row.createdAt).toLocaleString(dateLocale)}
                      </div>
                    </div>
                    <div style={{fontSize:12,color:'var(--text2)'}}>{row.reason}</div>
                    <div className="mono" style={{fontWeight:800,color:Number(row.similarity) >= 0.9 ? 'var(--red)' : 'var(--orange)'}}>
                      {(Number(row.similarity || 0) * 100).toFixed(1)}%
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={()=>handleFlaggedReviewed(row.id)} disabled={Boolean(row.reviewed)}>
                      {row.reviewed ? '검토 완료' : '검토 표시'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 시스템 탭 */}
      {activeTab==='system' && (
        <div className="fade-up" style={{maxWidth:640}}>
          <div className="card" style={{padding:24}}>
            <h3 style={{marginBottom:12}}>{txt('시스템 유지관리', 'System Maintenance')}</h3>
            <p style={{fontSize:13,color:'var(--text2)',marginBottom:24,lineHeight:1.6}}>
              {txt('랭킹, 활동 히트맵 등 실시간 데이터는 성능을 위해 Redis 캐시를 사용합니다.', 'Real-time data (rankings, activity heatmaps, etc.) uses Redis cache for performance.')}<br/>
              {txt('오래되었거나 일관성이 깨진 캐시를 지워야 할 때 아래 버튼을 사용하세요.', 'Use the buttons below if you need to clear stale or inconsistent cached data.')}
            </p>

            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {[
                {id:'leaderboards', label:txt('랭킹 & 리더보드 캐시', 'Ranking & leaderboard cache'), desc:txt('대회 랭킹 및 전체 리더보드 데이터를 초기화합니다.', 'Clear contest rankings and global leaderboard data.')},
                {id:'heatmaps',     label:txt('사용자 활동 히트맵 캐시', 'User activity heatmap cache'), desc:txt('프로필에 사용되는 일별 풀이 기록 캐시를 초기화합니다.', 'Clear daily solve-history cache used on profiles.')},
                {id:'problems',     label:txt('문제 정보 캐시', 'Problem info cache'), desc:txt('문제 상세 및 목록 캐시를 초기화합니다.', 'Clear problem detail and list cache.')},
                {id:'all',          label:txt('전체 캐시 초기화', 'Clear all cache'), desc:txt('시스템 전체의 캐시 데이터를 삭제합니다.', 'Clear all cached system data.'), danger:true},
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
                    {clearing === item.id ? <span className="spinner"/> : 'Clear'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 커뮤니티 제출 검토 탭 */}
      {activeTab==='community' && (
        <div className="fade-up">
          {/* 필터 + 상세 패널 */}
          {communityDetail ? (
            <div className="card" style={{padding:24}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
                <button className="btn btn-ghost btn-sm" onClick={()=>{setCommunityDetail(null);setCommunityRejectNote('');}}>← 목록으로</button>
                <h3 style={{margin:0}}>문제 상세 검토</h3>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16,fontSize:13}}>
                <div><span style={{color:'var(--text3)'}}>제출자</span><br/><strong>{communityDetail.username}</strong></div>
                <div><span style={{color:'var(--text3)'}}>유형</span><br/><strong>{communityDetail.problem_type}</strong></div>
                <div><span style={{color:'var(--text3)'}}>티어</span><br/><strong>{communityDetail.tier}</strong></div>
                <div><span style={{color:'var(--text3)'}}>난이도</span><br/><strong>{communityDetail.difficulty}/10</strong></div>
              </div>
              <div style={{marginBottom:14}}>
                <div style={{fontSize:12,color:'var(--text3)',marginBottom:4}}>제목</div>
                <div style={{fontWeight:700,fontSize:16}}>{communityDetail.title}</div>
              </div>
              <div style={{marginBottom:14}}>
                <div style={{fontSize:12,color:'var(--text3)',marginBottom:4}}>설명</div>
                <pre style={{background:'var(--bg3)',padding:14,borderRadius:8,fontSize:13,whiteSpace:'pre-wrap',margin:0}}>{communityDetail.description}</pre>
              </div>
              {communityDetail.hint && (
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:12,color:'var(--text3)',marginBottom:4}}>{txt('힌트', 'Hint')}</div>
                  <div style={{fontSize:13,color:'var(--text2)'}}>{communityDetail.hint}</div>
                </div>
              )}
              {(communityDetail.examples||[]).length > 0 && (
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:12,color:'var(--text3)',marginBottom:6}}>Sample I/O</div>
                  {communityDetail.examples.map((ex,i) => (
                    <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:6}}>
                      <pre className="io-box mono" style={{margin:0,fontSize:12}}>{ex.input||'(none)'}</pre>
                      <pre className="io-box mono" style={{margin:0,fontSize:12}}>{ex.output||'(none)'}</pre>
                    </div>
                  ))}
                </div>
              )}
              {communityDetail.status === 'pending' && (
                <div style={{marginTop:20,borderTop:'1px solid var(--border)',paddingTop:18}}>
                  <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-start'}}>
                    <button className="btn btn-success" onClick={()=>handleCommunityApprove(communityDetail.id)}>✅ {txt('승인 및 문제 등록', 'Approve & Register Problem')}</button>
                    <div style={{display:'flex',flexDirection:'column',gap:6,flex:1,minWidth:200}}>
                      <input className="input" placeholder="거절 사유 (선택)" value={communityRejectNote}
                        onChange={e=>setCommunityRejectNote(e.target.value)} />
                      <button className="btn btn-danger btn-sm" onClick={()=>handleCommunityReject(communityDetail.id)}>❌ Reject</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{overflow:'hidden'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 18px',borderBottom:'1px solid var(--border)'}}>
                <h3 style={{margin:0}}>💡 User Problem Submissions</h3>
                <div style={{display:'flex',gap:6}}>
                  {['pending','approved','rejected'].map(s=>(
                    <button key={s} className={`btn btn-sm ${communityFilter===s?'btn-primary':'btn-ghost'}`}
                      onClick={()=>setCommunityFilter(s)}>
                      {s==='pending'?'⏳ 대기':s==='approved'?'✅ 승인':'❌ 거절'}
                    </button>
                  ))}
                </div>
              </div>
              {communityLoading ? (
                <div style={{padding:24,textAlign:'center',color:'var(--text3)'}}>Loading...</div>
              ) : communitySubmissions.length === 0 ? (
                <div style={{padding:24,textAlign:'center',color:'var(--text3)'}}>No submissions found.</div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr><th style={{width:40}}>ID</th><th>제목</th><th style={{width:90}}>제출자</th><th style={{width:70}}>유형</th><th style={{width:60}}>티어</th><th style={{width:70}}>난이도</th><th style={{width:100}}>날짜</th><th style={{width:80}}>관리</th></tr>
                  </thead>
                  <tbody>
                    {communitySubmissions.map(s=>(
                      <tr key={s.id} className="at-row">
                        <td className="mono" style={{fontSize:11,color:'var(--text3)'}}>#{s.id}</td>
                        <td style={{fontWeight:600,maxWidth:240,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.title}</td>
                        <td style={{fontSize:12,color:'var(--text2)'}}>{s.username}</td>
                        <td><span className="tag" style={{fontSize:10,background:'var(--bg3)',color:'var(--text2)'}}>{s.problem_type}</span></td>
                        <td style={{fontSize:12}}>{s.tier}</td>
                        <td className="mono" style={{fontSize:12}}>{s.difficulty}/10</td>
                        <td style={{fontSize:11,color:'var(--text3)'}}>{new Date(s.created_at).toLocaleDateString('en-US')}</td>
                        <td>
                          <button className="btn btn-ghost btn-sm" onClick={()=>api.get(`/community-problems/admin/${s.id}`).then(r=>setCommunityDetail(r.data)).catch(()=>{})}>
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 비밀번호 리셋 모달 (prompt() 대체) */}
      {confirmModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setConfirmModal(null)}>
          <div className="modal-box card fade-up" style={{maxWidth:380}}>
            <h3 style={{marginBottom:8}}>⚠️ Confirm Delete</h3>
            <p style={{fontSize:13,color:'var(--text2)',marginBottom:20}}>{confirmModal.msg}</p>
            <div className="modal-actions" style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button className="btn btn-ghost" onClick={()=>setConfirmModal(null)}>{txt('취소', 'Cancel')}</button>
              <button className="btn btn-primary" style={{background:'var(--red)',borderColor:'var(--red)'}}
                onClick={async()=>{ await confirmModal.onConfirm(); setConfirmModal(null); }}>삭제</button>
            </div>
          </div>
        </div>
      )}
      {pwModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setPwModal(null)}>
          <div className="modal-box card fade-up" style={{maxWidth:400}}>
            <h3 style={{marginBottom:4}}>🔒 Reset Password</h3>
            <p style={{fontSize:13,color:'var(--text2)',marginBottom:16}}>Enter a new password for "{pwModal.name}".</p>
            <div className="form-group">
              <label style={{fontSize:12,fontWeight:600}}>New Password (min 8 characters)</label>
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
              <button className="btn btn-ghost" onClick={()=>setPwModal(null)}>{txt('취소', 'Cancel')}</button>
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
        <div><h1>{editTarget!==null?'✏️ Edit Problem':'➕ Create Problem'}</h1><p>Write manually or use AI auto-generation.</p></div>
        <div style={{display:'flex',gap:10}}>
          {editTarget===null&&<button className={`btn ${aiPanel?'btn-primary':'btn-ghost'}`} onClick={()=>setAiPanel(p=>!p)}>🤖 AI Generate</button>}
          <button className="btn btn-ghost" onClick={()=>{setView('list');setEditTarget(null);setForm(createEmptyForm());setAiPreview(null);setAiPanel(false);}}>← List</button>
        </div>
      </div>

      {aiPanel && (
        <div className="card ai-gen-panel fade-up">
          <div className="ai-gen-title"><TechIcon name="Gemini AI" size={18} decorative={false} /> {txt('Gemini AI로 자동 생성', 'Auto-generate with Gemini AI')}</div>
          <div className="cf-row">
            <div className="form-group" style={{flex:1}}><label>{txt('문제 유형', 'Problem Type')}</label><select value={aiForm.problemType} onChange={e=>setAiForm(p=>({...p,problemType:e.target.value}))}>{PROBLEM_TYPE_OPTIONS.map(o=><option key={o.value} value={o.value}>{txt(o.ko, o.label)}</option>)}</select></div>
            <div className="form-group" style={{flex:1}}><label>{txt('티어','Tier')}</label><select value={aiForm.tier} onChange={e=>setAiForm(p=>({...p,tier:e.target.value}))}>{TIER_OPTIONS.map(t=><option key={t} value={t}>{getTierLabel(t, lang)}</option>)}</select></div>
            <div className="form-group" style={{flex:1}}><label>{txt('난이도','Difficulty')}</label><input type="number" min="1" max="10" value={aiForm.difficulty} onChange={e=>setAiForm(p=>({...p,difficulty:e.target.value}))} /></div>
            <div className="form-group" style={{flex:2}}><label>{txt('주제/키워드','Topic/Keywords')}</label><input placeholder={txt('예: fibonacci, NameError, 중복 제거...','e.g. fibonacci, NameError, deduplication...')} value={aiForm.topic} onChange={e=>setAiForm(p=>({...p,topic:e.target.value}))} /></div>
          </div>
          <div className="form-group">
            <label>{txt('알고리즘 태그','Algorithm Tags')}</label>
            <div className="tag-picker">{TAG_OPTIONS.map(t=><button key={t} type="button" className={`tag-pick-btn ${aiForm.tags.includes(t)?'selected':''}`} onClick={()=>toggleAiTag(t)}>{getTagLabel(t, lang)}</button>)}</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <button className="btn btn-primary" onClick={handleAiGenerate} disabled={aiGenerating} style={{padding:'10px 24px'}}>
              {aiGenerating?<><span className="spinner"/> {txt('Gemini 생성 중...','Generating...')}</>:'✨ '+txt('문제 자동 생성','Auto-generate Problem')}
            </button>
            {aiPreview&&<span style={{fontSize:13,color:'var(--green)'}}>✓ {txt('생성 완료! 아래 내용 확인 후 등록하세요.','Generated! Review below and save.')}</span>}
          </div>
        </div>
      )}

      <div className="create-form fade-up" style={{animationDelay:'.05s'}}>
        <div className="card cf-section">
          <div className="cf-section-title">{txt('기본 정보', 'Basic Info')}</div>
          <div className="cf-row">
            <div className="form-group" style={{flex:3}}><label>{txt('문제 제목 *','Problem Title *')}</label><input placeholder={txt('문제 제목','Problem title')} value={form.title} onChange={e=>f('title',e.target.value)} /></div>
            <div className="form-group" style={{flex:1}}>
              <label>{txt('유형','Type')}</label>
              <select value={form.problemType} onChange={e=>f('problemType',e.target.value)}>
                {PROBLEM_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{txt(option.ko, option.label)}</option>)}
              </select>
            </div>
            <div className="form-group" style={{flex:1}}>
              <label>{txt('선호 언어','Preferred Language')}</label>
              <select value={form.preferredLanguage} onChange={e=>f('preferredLanguage',e.target.value)}>
                {JUDGE_LANGUAGE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{flex:1}}><label>{txt('티어','Tier')}</label><select value={form.tier} onChange={e=>f('tier',e.target.value)}>{TIER_OPTIONS.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
            <div className="form-group" style={{flex:1}}><label>{txt('난이도','Difficulty')}</label><input type="number" min="1" max="10" value={form.difficulty} onChange={e=>f('difficulty',e.target.value)} /></div>
          </div>
          <div className="cf-row">
            <div className="form-group" style={{flex:1}}><label>{txt('시간 제한 (초)','Time Limit (s)')}</label><input type="number" min="1" value={form.timeLimit} onChange={e=>f('timeLimit',e.target.value)} /></div>
            <div className="form-group" style={{flex:1}}><label>{txt('메모리 제한 (MB)','Memory Limit (MB)')}</label><input type="number" min="32" value={form.memLimit} onChange={e=>f('memLimit',e.target.value)} /></div>
          </div>
          <div className="form-group"><label>{txt('태그','Tags')}</label><div className="tag-picker">{TAG_OPTIONS.map(t=><button key={t} type="button" className={`tag-pick-btn ${form.tags.includes(t)?'selected':''}`} onClick={()=>toggleTag(t)}>{t}</button>)}</div></div>
        </div>

        <div className="card cf-section">
          <div className="cf-section-title">{txt('문제 내용', 'Problem Content')}</div>
          <div className="form-group"><label>{txt('설명', 'Description')} *</label><textarea rows={4} placeholder={txt('문제를 설명하세요...', 'Describe the problem...')} value={form.desc} onChange={e=>f('desc',e.target.value)} style={{resize:'vertical'}} /></div>
          {form.problemType === 'coding' && (
            <>
              <div className="cf-row">
                <div className="form-group" style={{flex:1}}><label>{txt('입력 설명', 'Input Description')}</label><textarea rows={3} placeholder={txt('입력 형식...', 'Input format...')} value={form.inputDesc} onChange={e=>f('inputDesc',e.target.value)} style={{resize:'vertical'}} /></div>
                <div className="form-group" style={{flex:1}}><label>{txt('출력 설명', 'Output Description')}</label><textarea rows={3} placeholder={txt('출력 형식...', 'Output format...')} value={form.outputDesc} onChange={e=>f('outputDesc',e.target.value)} style={{resize:'vertical'}} /></div>
              </div>
            </>
          )}

          {form.problemType === 'fill-blank' && (
            <>
              <div className="form-group">
                <label>Code Template with Blanks</label>
                <textarea rows={6} className="mono" placeholder={'e.g. if n <= ___1___:'} value={form.specialConfig.codeTemplate} onChange={e=>sf('codeTemplate',e.target.value)} style={{resize:'vertical'}} />
              </div>
              <div className="form-group">
                <label>Answer List (comma-separated)</label>
                <input placeholder="예) 1, 1, 2" value={form.specialConfig.blanksText} onChange={e=>sf('blanksText',e.target.value)} />
              </div>
            </>
          )}

          {form.problemType === 'bug-fix' && (
            <>
              <div className="form-group">
                <label>Buggy Code</label>
                <textarea rows={6} className="mono" placeholder={txt('버그가 있는 코드','Code with bugs')} value={form.specialConfig.buggyCode} onChange={e=>sf('buggyCode',e.target.value)} style={{resize:'vertical'}} />
              </div>
              <div className="form-group">
                <label>Answer Keywords (comma-separated)</label>
                <input placeholder="예) n - i - 1, arr[0]" value={form.specialConfig.keywordsText} onChange={e=>sf('keywordsText',e.target.value)} />
              </div>
              <div className="form-group">
                <label>Explanation</label>
                <textarea rows={3} placeholder={txt('무엇이 잘못되었는지 설명','Explain what is wrong')} value={form.specialConfig.explanation} onChange={e=>sf('explanation',e.target.value)} style={{resize:'vertical'}} />
              </div>
            </>
          )}

          {isTroubleshootingForm && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div className="cf-row">
                <div className="form-group" style={{ flex:1 }}>
                  <label>Scenario Title</label>
                  <input value={form.specialConfig.scenarioTitle} onChange={e=>sf('scenarioTitle', e.target.value)} placeholder={txt('예) API 응답 속도 저하','e.g. API response too slow')} />
                </div>
                <div className="form-group" style={{ flex:1 }}>
                  <label>Evaluation Mode</label>
                  <select value={form.specialConfig.evaluationMode} onChange={e=>sf('evaluationMode', e.target.value)}>
                    <option value="command">command</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Scenario Description</label>
                <textarea rows={4} value={form.specialConfig.scenarioDescription} onChange={e=>sf('scenarioDescription', e.target.value)} placeholder={txt('문제 상황, 목표, 제약 조건을 설명하세요.','Describe the scenario, goals, and constraints.')} style={{ resize:'vertical' }} />
              </div>

              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <div className="cf-section-title" style={{ margin:0 }}>Files</div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={addTroubleshootingFile}>Add File</button>
                </div>
                {(form.specialConfig.initialFiles || []).map((file, index) => (
                  <div key={`${file.path}-${index}`} style={{ border:'1px solid var(--border)', borderRadius:10, padding:12, marginBottom:10, background:'var(--bg3)' }}>
                    <div className="cf-row">
                      <div className="form-group" style={{ flex:2 }}>
                        <label>Path</label>
                        <input value={file.path} onChange={e=>updateTroubleshootingFile(index, { path:e.target.value })} placeholder="server.js" />
                      </div>
                      <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--text2)', marginTop:22 }}>
                        <input type="checkbox" checked={file.editable !== false} onChange={e=>updateTroubleshootingFile(index, { editable:e.target.checked })} />
                        {txt('사용자 편집 가능','User editable')}
                      </label>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={()=>removeTroubleshootingFile(index)} style={{ alignSelf:'flex-end' }}>{txt('삭제','Delete')}</button>
                    </div>
                    <textarea className="mono" rows={8} value={file.content} onChange={e=>updateTroubleshootingFile(index, { content:e.target.value })} placeholder={txt('파일 내용','File content')} style={{ resize:'vertical' }} />
                  </div>
                ))}
              </div>

              {[
                ['visibleTests', 'Visible Tests'],
                ['hiddenTests', 'Hidden Tests'],
              ].map(([field, label]) => (
                <div key={field}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <div className="cf-section-title" style={{ margin:0 }}>{label}</div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={()=>addTroubleshootingTest(field)}>Add Test</button>
                  </div>
                  {(form.specialConfig[field] || []).map((test, index) => (
                    <div key={`${field}-${index}`} className="cf-row" style={{ alignItems:'flex-end', marginBottom:8 }}>
                      <div className="form-group" style={{ flex:1 }}>
                        <label>Name</label>
                        <input value={test.name || ''} onChange={e=>updateTroubleshootingTest(field, index, { name:e.target.value })} />
                      </div>
                      <div className="form-group" style={{ flex:2 }}>
                        <label>Command</label>
                        <input className="mono" value={test.commandText || ''} onChange={e=>updateTroubleshootingTest(field, index, { commandText:e.target.value })} placeholder="node test.js" />
                      </div>
                      <div className="form-group" style={{ flex:2 }}>
                        <label>Expected Output</label>
                        <input className="mono" value={test.expectedOutput || ''} onChange={e=>updateTroubleshootingTest(field, index, { expectedOutput:e.target.value })} />
                      </div>
                      <div className="form-group" style={{ flex:1 }}>
                        <label>timeout ms</label>
                        <input type="number" value={test.timeoutMs || ''} onChange={e=>updateTroubleshootingTest(field, index, { timeoutMs:e.target.value })} />
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={()=>removeTroubleshootingTest(field, index)}>Delete</button>
                    </div>
                  ))}
                </div>
              ))}

              <div className="cf-row">
                <div className="form-group" style={{ flex:1 }}><label>baselineTimeMs</label><input type="number" value={form.specialConfig.baselineTimeMs} onChange={e=>sf('baselineTimeMs', e.target.value)} /></div>
                <div className="form-group" style={{ flex:1 }}><label>targetResponseTimeMs</label><input type="number" value={form.specialConfig.targetResponseTimeMs} onChange={e=>sf('targetResponseTimeMs', e.target.value)} /></div>
                <div className="form-group" style={{ flex:1 }}><label>performanceLimitMs</label><input type="number" value={form.specialConfig.performanceLimitMs} onChange={e=>sf('performanceLimitMs', e.target.value)} /></div>
                <div className="form-group" style={{ flex:1 }}><label>memoryLimitMb</label><input type="number" value={form.specialConfig.memoryLimitMb} onChange={e=>sf('memoryLimitMb', e.target.value)} /></div>
              </div>
              <div className="cf-row">
                <div className="form-group" style={{ flex:1 }}><label>Allowed Files</label><textarea rows={2} value={form.specialConfig.allowedFilesText} onChange={e=>sf('allowedFilesText', e.target.value)} placeholder="server.js, db.js" style={{ resize:'vertical' }} /></div>
                <div className="form-group" style={{ flex:1 }}><label>Forbidden Patterns</label><textarea rows={2} value={form.specialConfig.forbiddenPatternsText} onChange={e=>sf('forbiddenPatternsText', e.target.value)} placeholder="eval\\(, child_process" style={{ resize:'vertical' }} /></div>
              </div>
              <div className="form-group">
                <label>scoring_rules JSON</label>
                <textarea className="mono" rows={5} value={form.specialConfig.scoringRulesText} onChange={e=>sf('scoringRulesText', e.target.value)} style={{ resize:'vertical' }} />
              </div>
            </div>
          )}

          {/* ★ 예제 테스트케이스 (유저에게 보임) */}
          {!isTroubleshootingForm && renderCaseEditor(txt('예제 테스트케이스', 'Sample Testcases'), '📋', form.examples, 'examples', 'var(--blue)')}

          {/* ★ 히든 테스트케이스 (채점용 + 공개 표시) */}
          {form.problemType === 'coding' && <div style={{borderTop:'2px dashed var(--border)',paddingTop:16,marginTop:8}}>
            <div style={{fontSize:12,color:'var(--orange)',fontWeight:700,marginBottom:4}}>🔒 {txt(`일반 코딩 문제는 히든 테스트케이스가 최소 ${MIN_HIDDEN_TESTCASES}개 필요합니다.`, `Coding problems require at least ${MIN_HIDDEN_TESTCASES} hidden testcases.`)}</div>
            {renderCaseEditor(txt('히든 테스트케이스 (채점용)', 'Hidden Testcases (for grading)'), '🔒', form.testcases, 'testcases', 'var(--orange)')}
          </div>}
          {form.problemType !== 'coding' && !isTroubleshootingForm && (
            <div style={{marginTop:12,padding:'12px 14px',borderRadius:10,background:'var(--bg3)',border:'1px solid var(--border)',fontSize:12,color:'var(--text2)',lineHeight:1.6}}>
              {form.problemType === 'fill-blank'
                ? txt('빈칸 채우기 문제는 코드 템플릿 + 정답 목록으로 채점합니다. 히든 테스트케이스는 저장하지 않습니다.', 'Fill-blank problems are graded using the code template + answer list. Hidden testcases are not saved.')
                : txt('틀린부분 찾기 문제는 버그 코드 + 정답 키워드로 채점합니다. 히든 테스트케이스는 저장하지 않습니다.', 'Bug-fix problems are graded using the buggy code + answer keywords. Hidden testcases are not saved.')}
            </div>
          )}

          <div className="form-group"><label>{txt('힌트', 'Hint')}</label><textarea rows={2} placeholder={txt('풀이 힌트...', 'Solving hint...')} value={form.hint} onChange={e=>f('hint',e.target.value)} style={{resize:'vertical'}} /></div>
          <div className="form-group"><label>{txt('모범 답안 (관리자만 표시)', 'Model Solution (admin only)')}</label><textarea rows={4} className="mono" placeholder={txt('# 모범 답안 코드...', '# Model solution code...')} value={form.solution} onChange={e=>f('solution',e.target.value)} style={{resize:'vertical',color:'var(--green)'}} /></div>
        </div>

        <div className="cf-actions">
          <button className="btn btn-ghost" onClick={()=>{setView('list');setEditTarget(null);setForm(createEmptyForm());setAiPreview(null);setAiPanel(false);}}>{txt('취소', 'Cancel')}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving||!form.title.trim()||!form.desc.trim()}>
            {saving?<span className="spinner"/>:editTarget!==null?txt('수정 저장', 'Save Changes'):txt('문제 등록 →', 'Register Problem →')}
          </button>
        </div>
      </div>
    </div>
  );
}
