import { useState, useEffect, useRef, useMemo, lazy, Suspense, forwardRef, useImperativeHandle } from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
const Editor = lazy(() => import('@monaco-editor/react'));
import confetti from 'canvas-confetti';
import { PROBLEMS, TIERS } from '../data/problems';
import { JUDGE_LANGUAGE_OPTIONS, getEffectiveJudgeLanguage, getJudgeLanguageOption, getJudgeLanguageOptionsForSupported } from '../data/judgeLanguages.js';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { Bookmark, Copy, FileCode2, Play, RotateCcw, Send, Share2, Trash2 } from 'lucide-react';
import {
  DEFAULT_CODE,
  getDraftStorageKey,
  getLegacyDraftStorageKey,
  getSnippetStorageKey,
  parseSpecialConfig,
  RESULT_INFO_COLORS,
  TEMPLATES,
} from './judgePageUtils.js';
import './JudgePage.css';

const fmtTimer = (s) => {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${ss.toString().padStart(2, '0')}`;
};

const JudgeTimer = forwardRef(({ onReset }, ref) => {
  const [timerOn, setTimerOn] = useState(false);
  const [timerSec, setTimerSec] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerOn) {
      timerRef.current = setInterval(() => setTimerSec(s => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerOn]);

  useImperativeHandle(ref, () => ({
    getSec: () => timerSec,
    reset: () => { setTimerOn(false); setTimerSec(0); }
  }));

  return (
    <div style={{display:'flex',alignItems:'center',gap:6,marginLeft:8,padding:'3px 10px',borderRadius:6,background:timerOn?'rgba(121,192,255,.08)':'var(--bg3)',border:'1px solid var(--border)'}}>
      <span className="mono" style={{fontSize:13,fontWeight:700,color:timerOn?'var(--blue)':'var(--text3)',minWidth:42}}>{fmtTimer(timerSec)}</span>
      <button onClick={()=>setTimerOn(p=>!p)} style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:timerOn?'var(--red)':'var(--green)',fontWeight:700}}>
        {timerOn?'⏸':'▶'}
      </button>
      <button onClick={()=>{setTimerOn(false);setTimerSec(0); if(onReset) onReset();}} style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:'var(--text3)'}}>↺</button>
    </div>
  );
});

async function copyText(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

export default function JudgePage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { isDark } = useTheme();
  const { t } = useLang();
  const RESULT_INFO = {
    correct: { label: t('accepted'),           color: RESULT_INFO_COLORS.correct },
    success: { label: '실행 완료',              color: RESULT_INFO_COLORS.success },
    wrong:   { label: t('wrongAnswer'),         color: RESULT_INFO_COLORS.wrong   },
    timeout: { label: t('timeLimitExceeded'),   color: RESULT_INFO_COLORS.timeout },
    error:   { label: t('runtimeError'),        color: RESULT_INFO_COLORS.error   },
    compile: { label: t('compileError'),        color: RESULT_INFO_COLORS.compile },
    judging: { label: '채점 중...',             color: RESULT_INFO_COLORS.judging },
  };
  const { solved, submissions, addSubmission, problems: appProblems, bookmarks, toggleBookmark } = useApp();
  const toast = useToast();
  const allProblems    = appProblems.length > 0 ? appProblems : PROBLEMS;
  const initProblem    = location.state?.problem || allProblems.find(p => String(p.id) === id) || null;
  const [problem,     setProblem]     = useState(initProblem);
  const [problemError,setProblemError]= useState('');
  const [leftTab,     setLeftTab]     = useState('problem');
  const [bottomTab,   setBottomTab]   = useState('custom');
  const [lang,        setLang]        = useState(user?.defaultLanguage || 'python');
  const [code, setCode] = useState(() => {
    const saved = localStorage.getItem(getDraftStorageKey(id || 'default', 'python'))
      || localStorage.getItem(getLegacyDraftStorageKey(id || 'default', 'python'));
    return saved || DEFAULT_CODE.python;
  });
  const [result,      setResult]      = useState(null);
  const [testResults, setTestResults] = useState([]);
  const [isJudging,   setIsJudging]   = useState(false);
  const [similar,     setSimilar]     = useState([]);
  const [customInput, setCustomInput] = useState('');
  const [aiReview,    setAiReview]    = useState(null);
  const [reviewLoading,setReviewLoading]=useState(false);
  const [comments,    setComments]    = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentLoading,setCommentLoading]=useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [aiQuotaNotice, setAiQuotaNotice] = useState('');
  const [solutions,    setSolutions]    = useState([]);
  const [solLoading,   setSolLoading]   = useState(false);
  const [diffVote,     setDiffVote]     = useState(null);
  const [myVote,       setMyVote]       = useState(0);
  const [voteSubmitted,setVoteSubmitted]= useState(false);
  // ★ 풀이 타이머
  const timerComponentRef = useRef(null);
  // ★ 풀이 노트
  const [problemNote, setProblemNote] = useState('');
  const [showEditorial, setShowEditorial] = useState(false);
  // ★ 코드 템플릿
  const [showTpl,     setShowTpl]     = useState(false);
  // ★ 힌트
  const [showHint,    setShowHint]    = useState(false);
  const [judgeStatus,  setJudgeStatus]  = useState(null);
  const [judgeStatusError, setJudgeStatusError] = useState('');
  const [fillBlankAnswers, setFillBlankAnswers] = useState([])
  const [bugFixAnswer, setBugFixAnswer] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [wrongNote, setWrongNote] = useState('');
  const [editorial, setEditorial] = useState(null)
  const [timerOn, setTimerOn] = useState(false); // eslint-disable-line no-unused-vars
  const availableLangOptions = getJudgeLanguageOptionsForSupported(judgeStatus?.supportedLanguages);
  const editorSettings = user?.settings?.editor || {};

  const loadNote = async (probId) => {
    try {
      const res = await api.get('/notes/' + probId);
      setProblemNote(res.data.content || '');
    } catch (err) { console.error('Note load failed'); }
  };

  const saveNote = async () => {
    if (!problem?.id) return;
    setIsSavingNote(true);
    try {
      await api.post('/notes/' + problem.id, { content: problemNote });
      toast?.show('🗒️ 노트가 저장되었습니다.', 'success');
    } catch (err) {
      toast?.show('노트 저장 실패', 'error');
    } finally {
      setIsSavingNote(false);
    }
  };

  // isSpecialProblem must be declared BEFORE any useEffect that references it
  const problemType = problem?.problemType || 'coding'
  const isBuildProblem = problemType === 'build'
  const isSpecialProblem = problemType !== 'coding' && !isBuildProblem
  const specialConfig = useMemo(() => parseSpecialConfig(problem?.specialConfig), [problem?.specialConfig])

  const loadProblem = async (probId) => {
    if (!probId) return;
    setProblemError('');
    try {
      const res = await api.get('/problems/' + probId);
      setProblem(res.data);
    } catch (err) {
      setProblem(null);
      setProblemError(err.response?.status === 404 ? '문제를 찾을 수 없습니다.' : '문제를 불러오지 못했습니다.');
    }
  };

  // 문제 없거나 예제 없으면 API에서 가져옴 (직접 URL 접속 포함)
  useEffect(() => {
    const probId = problem?.id || id;
    if (probId && (!problem || !problem.examples || problem.examples.length === 0)) {
      loadProblem(probId);
    }
  }, [id, problem?.id]);

  useEffect(() => {
    const draftKey = getDraftStorageKey(problem?.id || 'default', lang);
    const legacyKey = getLegacyDraftStorageKey(problem?.id || 'default', lang);
    const snippetKey = getSnippetStorageKey(problem?.id || 'default', lang);
    const saved = localStorage.getItem(draftKey) || localStorage.getItem(legacyKey);
    const snippet = localStorage.getItem(snippetKey);
    setCode(saved || snippet || DEFAULT_CODE[lang]);
  }, [lang, problem?.id]);

  useEffect(() => {
    if (problem?.id) {
      api.get('/problems/'+problem.id+'/similar').then(r => setSimilar(r.data || [])).catch(() => {});
      api.get('/problems/'+problem.id+'/comments').then(r => setComments(r.data)).catch(() => {});
    }
  }, [problem?.id]);

  useEffect(() => {
    if (!problem?.id) {
      setEditorial(null)
      setShowEditorial(false)
      return
    }
    api.get(`/problems/${problem.id}/editorial`).then((res) => {
      setEditorial(res.data)
      setShowEditorial(true)
    }).catch(() => {
      setEditorial(null)
      setShowEditorial(false)
    })
  }, [problem?.id, solved[problem?.id], isAdmin])

  // 코드 자동저장
  useEffect(() => {
    if (code && problem?.id) {
      const key = getDraftStorageKey(problem.id, lang);
      const legacyKey = getLegacyDraftStorageKey(problem.id, lang);
      const t = setTimeout(() => {
        localStorage.setItem(key, code);
        localStorage.setItem(legacyKey, code);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [code, problem?.id, lang]);

  // 문제 변경 시 타이머 리셋 + 노트 로드
  useEffect(() => {
    timerComponentRef.current?.reset(); setShowEditorial(false); setShowHint(false);
    setResult(null); setTestResults([]); setAiReview(null);
    setVoteSubmitted(false); setMyVote(0); setDiffVote(null);
    setSolutions([]); setWrongNote('');
    setFillBlankAnswers([])
    setBugFixAnswer('')
    // 오답노트 로드
    const savedNote = localStorage.getItem(`dc_note_${problem?.id}`);
    if (savedNote) setWrongNote(savedNote);
    // 풀이 노트 로드
    if (problem?.id) loadNote(problem.id);
  }, [problem?.id]);

  useEffect(() => {
    if (!isSpecialProblem) return
    if (problemType === 'fill-blank') {
      const blanks = Array.isArray(specialConfig?.blanks) ? specialConfig.blanks : []
      setFillBlankAnswers((prev) => Array.from({ length: blanks.length }, (_, index) => prev[index] || ''))
    }
  }, [isSpecialProblem, problemType, specialConfig?.blanks])

  // Docker 채점 가용성 체크
  useEffect(() => {
    api.get('/submissions/judge-status').then(r => {
      setJudgeStatus(r.data);
      setJudgeStatusError('');
    }).catch((err) => {
      setJudgeStatus({
        dockerAvailable: false,
        mode: 'unavailable',
        supportedLanguages: [],
      });
      setJudgeStatusError(err.response?.data?.message || '채점 환경 정보를 확인하지 못했습니다.');
    });
  }, []);

  useEffect(() => {
    if (availableLangOptions.length > 0 && !availableLangOptions.some(o => o.value === lang)) {
      setLang(availableLangOptions[0]?.value || 'python');
    }
  }, [availableLangOptions, lang]);

  const isProblemLoading = !problem && !problemError;
  const isBookmarked = Boolean(bookmarks[problem?.id])

  const fmtTimer = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  const saveWrongNote = () => {
    if (wrongNote.trim()) {
      localStorage.setItem(`dc_note_${problem.id}`, wrongNote);
      toast?.show('📝 오답노트가 저장됐습니다.', 'success');
    }
  };

  const saveSnippet = () => {
    if (!problem?.id || !lang) return
    localStorage.setItem(getSnippetStorageKey(problem.id, lang), code || '')
    toast?.show('📌 스니펫이 저장되었습니다.', 'success')
  }

  const clearSnippet = () => {
    if (!problem?.id || !lang) return
    localStorage.removeItem(getSnippetStorageKey(problem.id, lang))
    toast?.show('🗑 저장된 스니펫을 삭제했습니다.', 'info')
  }

  const getReview = async () => {
    if (isSpecialProblem) return;
    if (!code.trim()) return;
    setReviewLoading(true);
    setAiQuotaNotice('');
    try {
      const res = await api.post('/ai/review', { problemId: problem.id, code, lang: getJudgeLanguageOption(lang)?.label || lang });
      setAiReview(res.data);
      setBottomTab('review');
    } catch (err) {
      if (err.response?.data?.code === 'QUOTA_EXCEEDED') {
        setAiQuotaNotice('오늘 AI 힌트를 모두 사용했습니다.');
        setBottomTab('review');
      } else {
        toast?.show('AI 리뷰를 불러올 수 없습니다.', 'error');
      }
    }
    setReviewLoading(false);
  };

  const postComment = async () => {
    if (!commentText.trim()) return;
    setCommentLoading(true);
    try {
      const res = await api.post('/problems/' + problem.id + '/comments', {
        content: commentText.trim(),
        parentId: replyTo?.id || null,
      });
      setComments(p => [...p, res.data]);
      setCommentText('');
      setReplyTo(null);
    } catch (err) {
      toast?.show(err.response?.data?.message || '댓글 작성에 실패했습니다.', 'error');
    }
    setCommentLoading(false);
  };

  const deleteComment = async (cid) => {
    try {
      await api.delete('/problems/' + problem.id + '/comments/' + cid);
      setComments(p => p.filter(c => c.id !== cid && c.parentId !== cid));
    } catch (err) {
      toast?.show(err.response?.data?.message || '댓글 삭제에 실패했습니다.', 'error');
    }
  };

  const toggleCommentLike = async (cid) => {
    try {
      const { data } = await api.post(`/problems/${problem.id}/comments/${cid}/like`);
      setComments((prev) => prev.map((comment) => comment.id === cid ? {
        ...comment,
        isLiked: data.liked,
        likeCount: data.likeCount,
      } : comment));
    } catch (err) {
      toast?.show(err.response?.data?.message || '좋아요 처리에 실패했습니다.', 'error');
    }
  };

  const loadSolutions = async () => {
    setSolLoading(true);
    try { const res = await api.get('/problems/' + problem.id + '/solutions'); setSolutions(res.data); }
    catch (err) { if (err.response?.status === 403) setSolutions('locked'); }
    setSolLoading(false);
  };

  const submitDiffVote = async (vote) => {
    setMyVote(vote);
    try {
      const res = await api.post('/problems/' + problem.id + '/difficulty-vote', { vote });
      setDiffVote(res.data);
      setMyVote(res.data?.myVote || vote);
      setVoteSubmitted(true);
      toast?.show('체감 난이도 투표가 저장됐습니다.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || '난이도 투표에 실패했습니다.', 'error');
    }
  };

  useEffect(() => {
    if (!problem?.id) return;
    let cancelled = false;

    api.get('/problems/' + problem.id + '/difficulty-vote')
      .then((res) => {
        if (cancelled) return;
        setDiffVote(res.data);
        setMyVote(res.data?.myVote || 0);
        setVoteSubmitted(Boolean(res.data?.myVote));
      })
      .catch(() => {
        if (cancelled) return;
        setDiffVote({
          avgVote: problem?.avgDifficulty ?? null,
          voteCount: problem?.voteCount ?? 0,
          myVote: problem?.myDifficultyVote ?? 0,
          avgDifficulty: problem?.avgDifficulty ?? null,
          totalVotes: problem?.voteCount ?? 0,
        });
        setMyVote(problem?.myDifficultyVote || 0);
        setVoteSubmitted(Boolean(problem?.myDifficultyVote));
      });

    return () => { cancelled = true; };
  }, [problem?.id, problem?.avgDifficulty, problem?.voteCount, problem?.myDifficultyVote]);

  const handleBookmarkClick = async () => {
    if (!problem?.id) return
    try {
      const data = await toggleBookmark(problem.id)
      toast?.show(data?.bookmarked ? '북마크에 추가했습니다.' : '북마크를 해제했습니다.', 'info')
    } catch (err) {
      toast?.show(err?.response?.data?.message || '북마크 처리에 실패했습니다.', 'error')
    }
  }

  const handleShareSubmission = async () => {
    const latestSubmission = [...mySubmissions].find((item) => item.result === 'correct') || mySubmissions[0]
    if (!latestSubmission?.id) {
      toast?.show('공유할 제출 기록이 없습니다. 먼저 제출을 완료해주세요.', 'info')
      return
    }

    try {
      const { data } = await api.post(`/submissions/${latestSubmission.id}/share`)
      const shareUrl = `${window.location.origin}/share/${data.slug}`
      if (navigator.share && window.matchMedia?.('(max-width: 768px)')?.matches) {
        await navigator.share({ title: `${problem.title} 제출 공유`, text: `${problem.title} 제출 결과`, url: shareUrl })
      } else {
        await copyText(shareUrl)
      }
      toast?.show('공유 링크를 준비했습니다.', 'success')
    } catch (err) {
      if (err?.name === 'AbortError') return
      toast?.show(err?.response?.data?.message || '공유 링크 생성에 실패했습니다.', 'error')
    }
  }

  const applyDetectedLanguage = (submitLang, actionLabel) => {
    if (submitLang === lang) return
    if (code && problem?.id) {
      localStorage.setItem(getDraftStorageKey(problem.id, submitLang), code)
      localStorage.setItem(getLegacyDraftStorageKey(problem.id, submitLang), code)
    }
    setLang(submitLang)
    toast?.show(`코드 패턴을 보고 ${getJudgeLanguageOption(submitLang)?.label || submitLang}로 ${actionLabel}합니다.`, 'info')
  }

  const runCode = async ({ input } = {}) => {
    if (isSpecialProblem) {
      toast?.show('특수 문제 유형은 실행 기능을 지원하지 않습니다. 바로 제출해 주세요.', 'info')
      return
    }
    if (!problem?.id) return;
    if (availableLangOptions.length === 0) {
      toast?.show('현재 실행 가능한 언어가 없습니다.', 'error');
      return;
    }
    if (!code.trim()) {
      toast?.show('코드를 입력해주세요.', 'warning');
      return;
    }

    const runMode = input === undefined ? 'examples' : 'custom';
    const codeLength = new TextEncoder().encode(code).length;
    const submitLang = getEffectiveJudgeLanguage(code, lang, judgeStatus?.supportedLanguages);
    applyDetectedLanguage(submitLang, '실행');

    setIsJudging(true);
    setTestResults([]);
    setTimerOn(false);
    setLeftTab('submissions');
    setResult({
      status: 'judging',
      mode: runMode,
      source: 'run',
      codeLength,
    });

    try {
      const payload = {
        problemId: problem.id,
        lang: submitLang,
        code,
      };
      if (input !== undefined) payload.input = input;

      const res = await api.post('/submissions/run', payload);
      const runResult = {
        status: res.data.result || 'success',
        mode: res.data.mode || runMode,
        source: 'run',
        lang: res.data.lang || getJudgeLanguageOption(submitLang)?.label || submitLang,
        normalizedLang: res.data.normalizedLang || submitLang,
        time: res.data.time,
        mem: res.data.mem,
        detail: res.data.detail,
        output: res.data.output,
        codeLength,
      };
      setResult(runResult);

      if (runResult.status === 'correct' || runResult.status === 'success') {
        toast?.show(runMode === 'custom' ? '▶ 커스텀 실행 완료' : '▶ 예제 실행 완료', 'success');
      } else if (runResult.status === 'wrong') {
        toast?.show('❌ 예제 실행 결과가 정답과 다릅니다.', 'error');
      } else if (runResult.status === 'timeout') {
        toast?.show('⏱ 실행 시간이 초과되었습니다.', 'warning');
      } else {
        toast?.show('⚡ 실행 중 오류가 발생했습니다.', 'warning');
      }
    } catch (err) {
      const msg = err.response?.data?.message || '실행 요청 실패';
      setResult({
        status: 'error',
        mode: runMode,
        source: 'run',
        detail: msg,
        codeLength,
      });
      toast?.show(msg, 'error');
    }

    setIsJudging(false);
  };

  const submitCode = async () => {
    if (isSpecialProblem) {
      const solveTimeSec = timerComponentRef.current?.getSec?.() || null
      setIsJudging(true); setTestResults([]); setResult({ status: 'judging' });
      timerComponentRef.current?.reset();
      try {
        const answerPayload = problemType === 'fill-blank'
          ? { answer: fillBlankAnswers, blankAnswers: fillBlankAnswers }
          : { answer: bugFixAnswer };
      const sub = await addSubmission({
          problemId: problem.id,
          problemTitle: problem.title,
          solveTimeSec,
          ...answerPayload,
        });
        setResult({ status: sub.result, time: sub.time, mem: sub.mem, detail: sub.detail, codeLength: sub.codeLength || 0 });
        setLeftTab(sub.result === 'correct' ? 'discuss' : 'submissions');
        if (sub.result === 'correct') {
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
          toast?.show('🎉 정답입니다!', 'success');
        }
        else toast?.show('❌ 틀렸습니다', 'error');
      } catch (err) {
        const msg = err.response?.data?.message || '제출 요청 실패';
        setResult({ status: 'error', detail: msg });
        setLeftTab('submissions');
        toast?.show(msg, 'error');
      }
      setIsJudging(false);
      return;
    }

    if (availableLangOptions.length === 0) {
      toast?.show('현재 제출 가능한 언어가 없습니다.', 'error');
      return;
    }
    const solveTimeSec = timerComponentRef.current?.getSec?.() || null
    const submitLang = getEffectiveJudgeLanguage(code, lang, judgeStatus?.supportedLanguages);
    applyDetectedLanguage(submitLang, '제출');
    setIsJudging(true); setTestResults([]); setResult({ status: 'judging' });
    setTimerOn(false);
    try {
      const sub = await addSubmission({
        problemId: problem.id, problemTitle: problem.title,
        lang: submitLang, code, solveTimeSec,
      });
      setResult({ status: sub.result, time: sub.time, mem: sub.mem, detail: sub.detail, codeLength: sub.codeLength || new TextEncoder().encode(code).length });
      setLeftTab(sub.result === 'correct' ? 'discuss' : 'submissions');
      if (sub.result === 'correct') {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
        toast?.show('🎉 정답입니다!', 'success');
      }
      else if (sub.result === 'wrong') toast?.show('❌ 틀렸습니다', 'error');
      else if (sub.result === 'timeout') toast?.show('⏱ 시간 초과', 'warning');
      else toast?.show('⚡ 에러 발생', 'warning');
    } catch (err) {
      const msg = err.response?.data?.message || '채점 요청 실패';
      setResult({ status: 'error', detail: msg });
      setLeftTab('submissions');
      toast?.show(msg, 'error');
    }
    setIsJudging(false);
  };
  const submitCodeRef = useRef(submitCode);
  submitCodeRef.current = submitCode;

  // Ctrl/Cmd+Enter: 제출
  useEffect(() => {
    const handler = (e) => {
      if (isSpecialProblem) return
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        submitCodeRef.current?.()
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isSpecialProblem]);

  const mySubmissions = problem?.id ? submissions.filter(s => s.problemId === problem.id) : [];
  const commentsByParent = useMemo(() => {
    const groups = new Map();
    comments.forEach((comment) => {
      const key = comment.parentId || 0;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(comment);
    });
    return groups;
  }, [comments]);
  const tierInfo = TIERS[problem?.tier] || {};

  if (isProblemLoading) {
    return (
      <div className="judge-layout">
        <div className="judge-left">
          <div className="judge-body" style={{ padding: 24 }}>
            <div className="skeleton-line" style={{ width: '40%', height: 28, marginBottom: 18 }} />
            <div className="skeleton-line" style={{ width: '100%', height: 120, marginBottom: 12 }} />
            <div className="skeleton-line" style={{ width: '100%', height: 80, marginBottom: 12 }} />
            <div className="skeleton-line" style={{ width: '100%', height: 80 }} />
          </div>
        </div>
        <div className="judge-right">
          <div className="editor-wrap">
            <div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:'#1e1e1e',color:'#888',fontSize:13}}>
              {t('loading')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (problemError && !problem) {
    return (
      <div className="judge-layout">
        <div className="judge-left">
          <div className="judge-body" style={{ padding: 24 }}>
            <div style={{
              background:'var(--bg2)',
              border:'1px solid rgba(248,81,73,.2)',
              borderRadius:14,
              padding:'24px 22px',
              maxWidth:520,
            }}>
              <div style={{ fontSize: 30, marginBottom: 10 }}>⚠️</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>문제를 열 수 없습니다</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 16 }}>
                {problemError}
              </div>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                <button className="btn btn-primary btn-sm" onClick={() => loadProblem(id)}>
                  {t('tryAgain')}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/problems')}>
                  문제 목록으로
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="judge-right">
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', background:'var(--bg)' }}>
            문제 데이터를 불러오지 못했습니다.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="judge-layout">
      {/* ── LEFT: 문제 정보 ── */}
      <div className="judge-left">
        {/* 창 헤더: 문제 외 패널일 때만 표시 */}
        {leftTab !== 'problem' && (
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 14px',borderBottom:'1px solid var(--border)',background:'var(--bg2)',flexShrink:0}}>
            <button onClick={() => setLeftTab('problem')} style={{
              display:'flex',alignItems:'center',gap:5,background:'none',border:'none',
              color:'var(--text2)',cursor:'pointer',fontSize:13,fontWeight:600,padding:'4px 8px',
              borderRadius:6,transition:'background .15s',
            }}
              onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
              onMouseLeave={e=>e.currentTarget.style.background='none'}
            >← 문제</button>
            <span style={{width:1,height:16,background:'var(--border)'}}/>
            <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>
              {leftTab==='solutions'?'💡 풀이':leftTab==='discuss'?'💬 토론':leftTab==='editorial'?'📘 Editorial':'📝 제출'}
            </span>
            <div style={{flex:1}}/>
            <span style={{fontSize:12,color:solved[problem.id]?'var(--green)':'var(--text3)'}}>
              {solved[problem.id]?'✅ 해결':'⬜ 미해결'}
            </span>
          </div>
        )}

        <div className="judge-body">
          {/* ── 문제 탭 ── */}
          {leftTab === 'problem' && (
            <div className="prob-content fade-in">
              <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start', flexWrap:'wrap' }}>
                <h2 style={{ margin:0 }}>{problem.title}</h2>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <button className="btn btn-ghost btn-sm" onClick={handleBookmarkClick}>
                    <Bookmark size={14} fill={isBookmarked ? 'currentColor' : 'none'} /> {isBookmarked ? '북마크됨' : '북마크'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={handleShareSubmission}>
                    <Share2 size={14} /> 공유
                  </button>
                </div>
              </div>
              <div className="prob-meta-row">
                <span className="tag" style={{ background: tierInfo.bg, color: tierInfo.color }}>{tierInfo.label}</span>
                <span className="tag" style={{ background: 'var(--bg3)', color: tierInfo.color, border: `1px solid ${tierInfo.color}40` }}>● {problem.tier?.toUpperCase?.() || problem.tier}</span>
                <span className="pmeta">⏱ {problem.timeLimit}초</span>
                <span className="pmeta">💾 {problem.memLimit}MB</span>
                <span className="pmeta mono">#{problem.id}</span>
              </div>
              <div className="prob-tag-row">
                {(problem.tags||[]).map(t => (
                  <span key={t} className="tag" style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>{t}</span>
                ))}
              </div>

              <section><h4>문제</h4><p style={{ whiteSpace: 'pre-line' }}>{problem.desc}</p></section>
              {!isSpecialProblem && !isBuildProblem && (
                <>
                  <section><h4>입력</h4><p style={{ whiteSpace: 'pre-line' }}>{problem.inputDesc}</p></section>
                  <section><h4>출력</h4><p style={{ whiteSpace: 'pre-line' }}>{problem.outputDesc}</p></section>

                  {(problem.examples||[]).map((ex, i) => (
                    <div key={i} className="ex-grid">
                      <div><h4>예제 입력 {i + 1}</h4><pre className="io-box mono">{ex.input}</pre></div>
                      <div><h4>예제 출력 {i + 1}</h4><pre className="io-box mono">{ex.output}</pre></div>
                    </div>
                  ))}
                </>
              )}

              {isBuildProblem && (
                <section>
                  <h4>구현형 문제</h4>
                  <p style={{ whiteSpace: 'pre-line', color:'var(--text2)', marginBottom:10 }}>
                    제공된 뼈대 코드에 필요한 핵심 로직만 작성해 제출하세요.
                  </p>
                  {problem.starterCode && <pre className="io-box mono">{problem.starterCode}</pre>}
                  {problem.setupCode && (
                    <>
                      <h4>테이블 구조</h4>
                      <pre className="io-box mono">{problem.setupCode}</pre>
                    </>
                  )}
                </section>
              )}

              {isSpecialProblem && problemType === 'fill-blank' && (
                <section>
                  <h4>코드 템플릿</h4>
                  <pre className="io-box mono">{specialConfig?.codeTemplate || '템플릿 정보가 없습니다.'}</pre>
                  {specialConfig?.hint && <p style={{ marginTop: 8, color: 'var(--text2)' }}>💡 힌트: {specialConfig.hint}</p>}
                </section>
              )}

              {isSpecialProblem && problemType === 'bug-fix' && (
                <section>
                  <h4>버그 코드 {problem?.preferredLanguage && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text2)', marginLeft: 6 }}>({problem.preferredLanguage})</span>}</h4>
                  <pre className="io-box mono">{specialConfig?.buggyCode || '버그 코드 정보가 없습니다.'}</pre>
                  {specialConfig?.hint && <p style={{ marginTop: 8, color: 'var(--text2)' }}>💡 힌트: {specialConfig.hint}</p>}
                </section>
              )}

              {/* 통계 */}
              <div style={{marginTop:20}}>
                <h4>📈 문제 통계</h4>
                <div className="stat-rows">
                  {[
                    ['제출 수', (problem.submissions||0).toLocaleString()],
                    ['정답 수', (problem.solved||0).toLocaleString()],
                    ['정답률', problem.submissions>0?`${((problem.solved/problem.submissions)*100).toFixed(1)}%`:'0%'],
                    ['난이도',  `${problem.difficulty} / 10`],
                  ].map(([k,v])=>(
                    <div key={k} className="stat-row"><span>{k}</span><span className="mono" style={{color:'var(--blue)'}}>{v}</span></div>
                  ))}
                </div>
              </div>

              {/* 난이도 투표 (풀었을 때만) */}
              {solved[problem.id] && (
                <div style={{marginTop:16,padding:'16px 18px',background:'var(--bg3)',borderRadius:10,border:'1px solid var(--border)'}}>
                  <h4 style={{marginBottom:10}}>📊 체감 난이도 투표</h4>
                  <div>
                    <p style={{fontSize:12,color:'var(--text2)',marginBottom:10}}>
                      이 문제의 실제 체감 난이도는? {user?.emailVerified ? '별점을 눌러 투표하세요.' : '이메일 인증 후 투표할 수 있습니다.'}
                    </p>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      {[1,2,3,4,5].map(v => {
                        const active = v <= myVote
                        return (
                          <button key={v} onClick={() => submitDiffVote(v)} disabled={!user?.emailVerified} style={{
                            width:36,height:36,borderRadius:999,border:'1px solid var(--border)',
                            background:'var(--bg2)',
                            color: active ? 'var(--yellow)' : 'var(--text3)',
                            cursor: user?.emailVerified ? 'pointer' : 'not-allowed',
                            opacity: user?.emailVerified ? 1 : 0.5,
                            fontSize:20,lineHeight:1,
                          }}>{active ? '★' : '☆'}</button>
                        )
                      })}
                    </div>
                    <div style={{fontSize:13,color: voteSubmitted ? 'var(--green)' : 'var(--text2)', marginTop:10}}>
                      {voteSubmitted ? '✅ 투표 완료! ' : ''}
                      평균: <strong>{diffVote?.avgVote ?? diffVote?.avgDifficulty ?? '-'}</strong> / 5 ({diffVote?.voteCount ?? diffVote?.totalVotes ?? 0}명)
                    </div>
                  </div>
                </div>
              )}

              {/* 패널 열기 버튼 */}
              <div style={{display:'flex',gap:8,marginTop:20,paddingTop:16,borderTop:'1px solid var(--border)'}}>
                {[
                  ...(showEditorial ? [{ id:'editorial', icon:'📘', label:'Editorial' }] : []),
                  { id:'solutions',   icon:'💡', label:'풀이' },
                  { id:'discuss',     icon:'💬', label:`토론` },
                  { id:'notes',       icon:'🗒️', label:`노트` },
                  { id:'submissions', icon:'📝', label:`제출${mySubmissions.length ? ` (${mySubmissions.length})` : ''}` },
                ].map(p => (
                  <button key={p.id} onClick={() => setLeftTab(p.id)} style={{
                    flex:1, padding:'8px 0', borderRadius:8, border:'1px solid var(--border)',
                    background:'var(--bg3)', color:'var(--text2)', cursor:'pointer',
                    fontSize:12, fontWeight:600, display:'flex', alignItems:'center',
                    justifyContent:'center', gap:5, transition:'all .15s',
                  }}
                    onMouseEnter={e=>{e.currentTarget.style.background='var(--bg4)';e.currentTarget.style.color='var(--text)';}}
                    onMouseLeave={e=>{e.currentTarget.style.background='var(--bg3)';e.currentTarget.style.color='var(--text2)';}}
                  >{p.icon} {p.label}</button>
                ))}
              </div>
            </div>
          )}

          {/* ── 풀이 공유 탭 ── */}
          {leftTab === 'editorial' && (
            <div className="prob-content fade-in">
              <h4>📘 Editorial</h4>
              {!editorial ? (
                <p style={{ color:'var(--text3)', fontSize:13 }}>아직 공개된 해설이 없습니다.</p>
              ) : (
                <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10, padding:'16px 18px' }}>
                  <div style={{ fontSize:11, color:'var(--text3)', marginBottom:10 }}>
                    작성자 {editorial.author_username || editorial.author_id} · {editorial.updated_at ? new Date(editorial.updated_at).toLocaleString('ko-KR') : ''}
                  </div>
                  <div style={{ whiteSpace:'pre-line', lineHeight:1.7, color:'var(--text)' }}>{editorial.content}</div>
                </div>
              )}
            </div>
          )}

          {/* ── 풀이 공유 탭 ── */}
          {leftTab === 'solutions' && (
            <div className="prob-content fade-in">
              <h4>💡 다른 사람의 풀이</h4>
              <p style={{fontSize:12,color:'var(--text3)',marginBottom:12}}>문제를 먼저 풀어야 다른 풀이를 볼 수 있습니다.</p>
              {!solutions || solutions === 'locked' ? (
                solutions === 'locked' ? (
                  <div style={{padding:'24px',textAlign:'center',background:'var(--bg3)',borderRadius:10,border:'1px solid var(--border)'}}>
                    <div style={{fontSize:32,marginBottom:8}}>🔒</div>
                    <p style={{fontSize:13,color:'var(--text2)'}}>이 문제를 먼저 풀어야<br/>다른 풀이를 볼 수 있어요!</p>
                  </div>
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={loadSolutions} disabled={solLoading}>
                    {solLoading ? <><span className="spinner"/> 로딩 중...</> : '풀이 보기'}
                  </button>
                )
              ) : solutions.length === 0 ? (
                <p style={{color:'var(--text3)',fontSize:13}}>아직 풀이가 없어요.</p>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  {solutions.map((s,i) => (
                    <div key={s.id||i} style={{background:'var(--bg3)',borderRadius:8,border:'1px solid var(--border)',overflow:'hidden'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',borderBottom:'1px solid var(--border)'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontSize:12,fontWeight:700,color:'var(--blue)'}}>{s.username}</span>
                          <span style={{fontSize:10,color:'var(--text3)',fontFamily:'Space Mono,monospace'}}>{s.tier}</span>
                        </div>
                        <div style={{display:'flex',gap:8,fontSize:11,color:'var(--text3)'}}>
                          <span>{s.lang}</span>
                          {s.time && s.time !== '-' && <span>⏱ {s.time}</span>}
                        </div>
                      </div>
                      <pre style={{padding:'12px 14px',margin:0,fontSize:11,color:'var(--green)',fontFamily:'Space Mono,monospace',background:'var(--bg)',overflow:'auto',maxHeight:200,whiteSpace:'pre-wrap'}}>{s.code}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── 토론 탭 ── */}
          {leftTab === 'discuss' && (
            <div className="prob-content fade-in">
              <h4>💬 토론 ({comments.length})</h4>
              <div style={{marginTop:12}}>
                {!user?.emailVerified && (
                  <div style={{marginBottom:10,padding:'10px 12px',borderRadius:8,background:'var(--bg3)',border:'1px solid var(--border)',fontSize:12,color:'var(--text2)'}}>
                    이메일 인증 후 댓글을 작성할 수 있습니다.
                  </div>
                )}
                {replyTo && (
                  <div style={{marginBottom:8,fontSize:12,color:'var(--text2)'}}>
                    <strong>{replyTo.username}</strong>님에게 답글 작성 중
                    <button onClick={() => setReplyTo(null)} style={{marginLeft:8,background:'none',border:'none',color:'var(--blue)',cursor:'pointer',fontSize:12}}>취소</button>
                  </div>
                )}
                <textarea rows={3} value={commentText} onChange={e=>setCommentText(e.target.value)}
                  placeholder="질문이나 풀이 방법을 공유해보세요..." style={{resize:'vertical',marginBottom:8}} disabled={!user?.emailVerified} />
                <button className="btn btn-primary btn-sm" onClick={postComment} disabled={commentLoading||!commentText.trim()||!user?.emailVerified}>
                  {commentLoading?<span className="spinner"/>:'댓글 작성'}
                </button>
              </div>
              <div style={{marginTop:16,display:'flex',flexDirection:'column',gap:10}}>
                {comments.length===0&&<p style={{color:'var(--text3)',fontSize:13}}>아직 댓글이 없어요.</p>}
                {(commentsByParent.get(0) || []).map(comment => (
                  <div key={comment.id} style={{background:'var(--bg3)',borderRadius:8,padding:'12px 14px',border:'1px solid var(--border)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:6,gap:10}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                        <span style={{fontSize:20}}>{comment.avatarEmoji || '🙂'}</span>
                        <span style={{fontSize:12,fontWeight:700,color:'var(--blue)'}}>{comment.nickname || comment.username}</span>
                        <span style={{fontSize:10,color:'var(--text3)',fontFamily:'Space Mono,monospace'}}>{comment.tier}</span>
                      </div>
                      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',justifyContent:'flex-end'}}>
                        <span style={{fontSize:11,color:'var(--text3)'}}>{new Date(comment.createdAt).toLocaleString('ko-KR')}</span>
                        {comment.canDelete && (
                          <button onClick={()=>deleteComment(comment.id)} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:12}}>✕</button>
                        )}
                      </div>
                    </div>
                    <p style={{fontSize:13,color:'var(--text2)',lineHeight:1.6,whiteSpace:'pre-wrap'}}>{comment.content || comment.text}</p>
                    <div style={{display:'flex',gap:12,marginTop:8}}>
                      <button onClick={() => toggleCommentLike(comment.id)} style={{background:'none',border:'none',padding:0,color:comment.isLiked ? 'var(--yellow)' : 'var(--text3)',cursor:'pointer',fontSize:12}}>
                        {comment.isLiked ? '★' : '☆'} 좋아요 {comment.likeCount || 0}
                      </button>
                      <button onClick={() => { setReplyTo(comment); setCommentText(`@${comment.username} `); }} style={{background:'none',border:'none',padding:0,color:'var(--blue)',cursor:'pointer',fontSize:12}}>
                        답글
                      </button>
                    </div>

                    {(commentsByParent.get(comment.id) || []).map(reply => (
                      <div key={reply.id} style={{marginTop:10,marginLeft:14,padding:'10px 12px',background:'var(--bg)',borderRadius:8,border:'1px solid var(--border)'}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:6,gap:10}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                            <span style={{fontSize:18}}>{reply.avatarEmoji || '🙂'}</span>
                            <span style={{fontSize:12,fontWeight:700,color:'var(--blue)'}}>{reply.nickname || reply.username}</span>
                            <span style={{fontSize:10,color:'var(--text3)',fontFamily:'Space Mono,monospace'}}>{reply.tier}</span>
                          </div>
                          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',justifyContent:'flex-end'}}>
                            <span style={{fontSize:11,color:'var(--text3)'}}>{new Date(reply.createdAt).toLocaleString('ko-KR')}</span>
                            {reply.canDelete && (
                              <button onClick={()=>deleteComment(reply.id)} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:12}}>✕</button>
                            )}
                          </div>
                        </div>
                        <p style={{fontSize:13,color:'var(--text2)',lineHeight:1.6,whiteSpace:'pre-wrap'}}>{reply.content || reply.text}</p>
                        <div style={{display:'flex',gap:12,marginTop:8}}>
                          <button onClick={() => toggleCommentLike(reply.id)} style={{background:'none',border:'none',padding:0,color:reply.isLiked ? 'var(--yellow)' : 'var(--text3)',cursor:'pointer',fontSize:12}}>
                            {reply.isLiked ? '★' : '☆'} 좋아요 {reply.likeCount || 0}
                          </button>
                          <button onClick={() => { setReplyTo(comment); setCommentText(`@${reply.username} `); }} style={{background:'none',border:'none',padding:0,color:'var(--blue)',cursor:'pointer',fontSize:12}}>
                            답글
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 개인 노트 탭 ── */}
          {leftTab === 'notes' && (
            <div className="prob-content fade-in">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <h4 style={{margin:0}}>🗒️ 나만의 풀이 노트</h4>
                <button className="btn btn-primary btn-sm" onClick={saveNote} disabled={isSavingNote}>
                  {isSavingNote ? <span className="spinner"/> : '저장하기'}
                </button>
              </div>
              <p style={{fontSize:12,color:'var(--text3)',marginBottom:12}}>이 노트는 오직 본인에게만 보입니다. 문제 접근 방식이나 배운 점을 기록해보세요.</p>
              <textarea 
                value={problemNote} 
                onChange={e=>setProblemNote(e.target.value)}
                placeholder="여기에 자유롭게 메모하세요..."
                style={{
                  width:'100%', minHeight:'400px', padding:'16px', borderRadius:10,
                  background:'var(--bg3)', border:'1px solid var(--border)',
                  fontSize:14, lineHeight:1.6, color:'var(--text)',
                  resize:'vertical', outline:'none'
                }}
              />
            </div>
          )}

          {/* ── 제출 현황 탭 ── */}
          {leftTab === 'submissions' && (
            <div className="prob-content fade-in">
              {/* 채점 결과 */}
              {(result || testResults.length > 0) && (
                <div style={{ marginBottom: 20 }}>
                  <h4>채점 결과</h4>
                  {result && (
                    <div className="submit-result fade-in" style={{ borderColor: RESULT_INFO[result.status]?.color }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 15, color: RESULT_INFO[result.status]?.color }}>{RESULT_INFO[result.status]?.label}</span>
                          {result.mode && (
                            <span className="tag" style={{ background:'var(--bg3)', color:'var(--text2)' }}>
                              {result.mode === 'custom' ? '커스텀 실행' : '예제 실행'}
                            </span>
                          )}
                        </div>
                        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                          {result.codeLength > 0 && <span className="mono" style={{ fontSize:11, color:'var(--text3)' }}>📝 {result.codeLength}B</span>}
                          {result.time && result.time !== '-' && (
                            <span className="mono" style={{ fontSize:12, color:'var(--text2)' }}>실행 {result.time}</span>
                          )}
                          {result.mem && result.mem !== '-' && (
                            <span className="mono" style={{ fontSize:12, color:'var(--text2)' }}>메모리 {result.mem}</span>
                          )}
                        </div>
                      </div>
                      {result.output && (
                        <pre style={{ marginTop:8, padding:'8px 10px', background:'var(--bg3)', borderRadius:6,
                          fontSize:11, color:'var(--text)', fontFamily:'Space Mono, monospace',
                          whiteSpace:'pre-wrap', maxHeight:120, overflow:'auto' }}>{result.output}</pre>
                      )}
                      {result.detail && (
                        <pre style={{ marginTop:8, padding:'8px 10px', background:'var(--bg3)', borderRadius:6,
                          fontSize:11, color: result.status === 'correct' ? 'var(--green)' : 'var(--text2)',
                          fontFamily:'Space Mono, monospace', whiteSpace:'pre-wrap', maxHeight:100, overflow:'auto' }}>{result.detail}</pre>
                      )}
                      {result.status && result.status !== 'correct' && result.status !== 'judging' && (
                        <div style={{ marginTop:10, padding:'10px 12px', background:'rgba(248,81,73,.04)', border:'1px solid rgba(248,81,73,.15)', borderRadius:8 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'var(--red)', marginBottom:6 }}>📝 오답노트</div>
                          <textarea rows={2} value={wrongNote} onChange={e=>setWrongNote(e.target.value)}
                            placeholder="왜 틀렸는지 메모해두세요..."
                            style={{ resize:'vertical', fontSize:12, marginBottom:6 }} />
                          <button className="btn btn-ghost btn-sm" onClick={saveWrongNote} style={{ fontSize:11 }}>💾 저장</button>
                        </div>
                      )}
                    </div>
                  )}
                  {testResults.length > 0 && (
                    <div className="test-list" style={{ marginTop:8 }}>
                      {testResults.map((r, i) => (
                        <div key={i} className={`test-item ${r.status}`}>
                          <span className="ti-label">예제 {i + 1}</span>
                          {r.status === 'running' && <span style={{ color:'var(--blue)' }}>실행 중...</span>}
                          {r.status === 'pass'    && <span style={{ color:'var(--green)', fontWeight:700 }}>✓ 통과</span>}
                          {r.status === 'fail'    && <span style={{ color:'var(--red)', fontWeight:700 }}>✗ 실패 ({r.output})</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 제출 기록 */}
              <h4>내 제출 기록</h4>
              {mySubmissions.length === 0
                ? <p style={{ color:'var(--text3)', marginTop:12, fontSize:13 }}>아직 제출한 기록이 없어요.</p>
                : mySubmissions.map(s => (
                  <div key={s.id} className="sub-row-item">
                    <span className="sri-result" style={{ color: RESULT_INFO[s.result]?.color }}>{RESULT_INFO[s.result]?.label}</span>
                    <span className="sri-lang">{s.lang}</span>
                    <span className="mono" style={{ fontSize:11, color:'var(--text2)' }}>{s.time}</span>
                    <span className="mono" style={{ fontSize:11, color:'var(--text2)' }}>{s.mem}</span>
                    <span style={{ fontSize:11, color:'var(--text3)' }}>{s.date}</span>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: 코드 에디터 ── */}
      <div className="judge-right">
        <div className="editor-toolbar">
          {!isSpecialProblem && (
            <select className="lang-select mono" value={lang} onChange={e => setLang(e.target.value)}>
              {availableLangOptions.length === 0 && <option value={lang}>채점 불가</option>}
              {availableLangOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          {isSpecialProblem && (
            <span className="lang-select mono" style={{ display:'inline-flex', alignItems:'center' }}>
              {problemType === 'fill-blank' ? '빈칸 채우기 모드' : '틀린부분 찾기 모드'}
            </span>
          )}
          {isBuildProblem && (
            <span className="lang-select mono" style={{ display:'inline-flex', alignItems:'center' }}>
              구현형 모드
            </span>
          )}
          {/* ★ 풀이 타이머 */}
          <JudgeTimer ref={timerComponentRef} />
          <div style={{ flex: 1 }} />
          {/* ★ 코드 도구 */}
          <div style={{ display:'flex', gap:4, marginRight:8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => {
              navigator.clipboard.writeText(code);
              toast?.show('📋 코드가 클립보드에 복사되었습니다.', 'info');
            }} title="코드 복사"><Copy size={14} /> 복사</button>
            {!isSpecialProblem && <button className="btn btn-ghost btn-sm" onClick={saveSnippet} title="현재 코드를 스니펫으로 저장"><FileCode2 size={14} /> Save Snippet</button>}
            {!isSpecialProblem && <button className="btn btn-ghost btn-sm" onClick={clearSnippet} title="저장된 스니펫 삭제"><Trash2 size={14} /> 삭제</button>}
            <button className="btn btn-ghost btn-sm" onClick={() => {
              if (window.confirm('현재 코드를 초기화하시겠습니까?')) {
                setCode(DEFAULT_CODE[lang] || '');
                toast?.show('↺ 코드가 초기화되었습니다.', 'info');
              }
            }} title="코드 초기화"><RotateCcw size={14} /> 초기화</button>
          </div>
          {/* ★ 코드 템플릿 */}
          {!isSpecialProblem && (
          <div style={{position:'relative'}}>
            <button className="btn btn-ghost btn-sm" onClick={()=>setShowTpl(p=>!p)} title="코드 템플릿"><FileCode2 size={14} /> 템플릿</button>
            {showTpl && (
              <div style={{position:'absolute',top:'100%',right:0,marginTop:4,width:200,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,boxShadow:'0 8px 24px rgba(0,0,0,.4)',zIndex:50,overflow:'hidden'}}>
                <div style={{padding:'8px 12px',fontSize:11,fontWeight:700,color:'var(--text3)',borderBottom:'1px solid var(--border)'}}>
                  {availableLangOptions.find(o=>o.value===lang)?.label || getJudgeLanguageOption(lang)?.label} 템플릿
                </div>
                {(TEMPLATES[lang]||[]).map((t,i)=>(
                  <button key={i} onClick={()=>{setCode(t.code);setShowTpl(false);toast?.show(`📄 "${t.name}" 삽입됨`,'info');}} style={{
                    width:'100%',padding:'8px 12px',border:'none',background:'transparent',color:'var(--text)',
                    cursor:'pointer',fontSize:12,textAlign:'left',fontFamily:'inherit',transition:'background .1s',
                  }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                  >{t.name}</button>
                ))}
                {!(TEMPLATES[lang]||[]).length && <div style={{padding:'12px',fontSize:12,color:'var(--text3)'}}>템플릿 없음</div>}
              </div>
            )}
          </div>
          )}
          {!isSpecialProblem && <button className="btn btn-ghost btn-sm" onClick={() => runCode()} disabled={isJudging} title="예제 실행"><Play size={14} /> 예제 실행</button>}
          {!isSpecialProblem && <button className="btn btn-ghost btn-sm" onClick={getReview} disabled={reviewLoading || !code.trim()} title="AI 코드 리뷰">
            {reviewLoading ? <span className="spinner"/> : '🔍 리뷰'}
          </button>}
          <button className="btn btn-success btn-sm" onClick={submitCode} disabled={isJudging} title="제출 (Ctrl+Enter)">
            {isJudging ? <><span className="spinner" /> 채점 중</> : <><Send size={14} /> 제출하기</>}
          </button>
          {!isSpecialProblem && <span style={{fontSize:10,color:'var(--text3)',marginLeft:4}}>Ctrl+Enter</span>}
        </div>

        {judgeStatus?.mode === 'native-subprocess' && (
          <div style={{
            padding:'10px 14px',
            borderBottom:'1px solid var(--border)',
            background:'rgba(121,192,255,.08)',
            color:'var(--text2)',
            fontSize:12,
          }}>
            ⚙️ 현재 채점 환경: <strong>native subprocess</strong> 모드 — 지원 언어: <strong>{judgeStatus.supportedLanguages?.join(', ')}</strong>
          </div>
        )}
        {judgeStatusError && (
          <div style={{
            padding:'10px 14px',
            borderBottom:'1px solid var(--border)',
            background:'rgba(248,81,73,.08)',
            color:'var(--text2)',
            fontSize:12,
          }}>
            ⚠️ {judgeStatusError}
          </div>
        )}

        {/* ★ 채점 진행 바 */}
        {isJudging && <div className="judge-progress" />}


        <div className="editor-wrap">
          {isSpecialProblem ? (
            <div style={{ height:'100%', padding:16, overflowY:'auto', background:'var(--bg2)' }}>
              {problemType === 'fill-blank' && (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {(Array.isArray(specialConfig?.blanks) ? specialConfig.blanks : []).map((_, index) => (
                    <label key={index} style={{ display:'flex', flexDirection:'column', gap:6, fontSize:12, color:'var(--text2)' }}>
                      빈칸 {index + 1}
                      <input
                        value={fillBlankAnswers[index] || ''}
                        onChange={(e) => setFillBlankAnswers((prev) => {
                          const next = [...prev]
                          next[index] = e.target.value
                          return next
                        })}
                        placeholder={`빈칸 ${index + 1} 답안`}
                      />
                    </label>
                  ))}
                </div>
              )}
              {problemType === 'bug-fix' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <label style={{ fontSize:12, color:'var(--text2)' }}>수정 코드/핵심 라인</label>
                  <textarea
                    className="custom-input mono"
                    style={{ minHeight: 240 }}
                    value={bugFixAnswer}
                    onChange={(e) => setBugFixAnswer(e.target.value)}
                    placeholder="버그를 수정한 코드 또는 핵심 수정 라인을 입력하세요."
                  />
                </div>
              )}
            </div>
          ) : (
            <Suspense fallback={<div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:isDark?'#1e1e1e':'#fff',color:'#888',fontSize:13}}>에디터 로딩 중...</div>}>
              <div style={{ display:'grid', gridTemplateRows:isBuildProblem ? '140px 1fr' : '1fr', height:'100%' }}>
                {isBuildProblem && (
                  <div style={{ height:'100%', padding:16, overflowY:'auto', background:'var(--bg2)', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ color:'var(--text3)', fontSize:12, marginBottom:4 }}>뼈대 코드 (수정 불가 영역)</div>
                    <pre className="io-box mono" style={{ margin:0 }}>{problem.starterCode || '// YOUR CODE HERE'}</pre>
                  </div>
                )}
                <Editor
                  height="100%" language={availableLangOptions.find(o => o.value === lang)?.monaco || getJudgeLanguageOption(lang)?.monaco || 'python'}
                  theme={isDark ? "vs-dark" : "vs"} value={code} onChange={v => setCode(v || '')}
                  options={{ 
                    fontSize: editorSettings.font_size || 14,
                    minimap: { enabled: !!editorSettings.minimap },
                    scrollBeyondLastLine: false, 
                    tabSize: editorSettings.tab_size || 2,
                    fontFamily: editorSettings.font_family || "'Space Mono', 'Fira Code', Consolas, monospace",
                    lineNumbers: editorSettings.line_numbers !== false ? 'on' : 'off',
                    wordWrap: editorSettings.word_wrap === true ? 'on' : 'off'
                  }}
                />
              </div>
            </Suspense>
          )}
        </div>

        {/* Bottom panel */}
        {!isSpecialProblem && <div className={`result-panel ${bottomTab === 'review' ? 'expanded' : ''}`}>
          <div className="result-tabs">
            <button className={`rtab ${bottomTab === 'custom' ? 'active' : ''}`} onClick={() => setBottomTab('custom')}>커스텀 입력</button>
            <button className={`rtab ${bottomTab === 'review' ? 'active' : ''}`} onClick={() => setBottomTab('review')}>🔍 AI 코드 리뷰</button>
          </div>

          {bottomTab === 'custom' && (
            <div className="custom-body">
              <textarea className="custom-input mono" placeholder="직접 입력값을 넣어보세요..." value={customInput} onChange={e => setCustomInput(e.target.value)} />
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 8, alignSelf: 'flex-start' }}
                onClick={() => runCode({ input: customInput })}>▶ 실행</button>
            </div>
          )}

          {bottomTab === 'review' && (
            <div className="result-body">
              {aiQuotaNotice && (
                <div style={{
                  marginBottom:12,
                  padding:'12px 14px',
                  borderRadius:10,
                  background:'rgba(227,179,65,.08)',
                  border:'1px solid rgba(227,179,65,.2)',
                  fontSize:13,
                  lineHeight:1.7,
                }}>
                  {aiQuotaNotice}{' '}
                  <Link to="/pricing" style={{ color:'var(--blue)', fontWeight:700, textDecoration:'none' }}>
                    Pro로 업그레이드
                  </Link>
                  하면 무제한 사용 가능합니다.
                </div>
              )}
              {!aiReview ? (
                <div className={`fade-in ${reviewLoading ? 'analyzing-pulse' : ''}`} style={{
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                  gap:16, padding:'24px 0', minHeight:120
                }}>
                  <div style={{ fontSize: 36, filter: 'drop-shadow(0 0 10px rgba(121,192,255,0.3))' }}>
                    {reviewLoading ? '⚡' : '🔍'}
                  </div>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:4 }}>
                      {reviewLoading ? 'AI가 코드를 분석 중입니다...' : 'AI 코드 리뷰 준비 완료'}
                    </div>
                    <div style={{ fontSize:12, color:'var(--text3)', maxWidth: 280, lineHeight: 1.5 }}>
                      정확성, 효율성 및 잠재적 개선 사항에 대한 즉각적인 피드백을 받아보세요.
                    </div>
                  </div>
                  {!reviewLoading && (
                    <button className="btn btn-primary btn-sm" onClick={getReview} disabled={!code.trim()}>
                      내 코드 분석하기
                    </button>
                  )}
                </div>
              ) : (
                <div className="fade-in review-content-wrapper">
                  {/* Score & Summary */}
                  <div className="review-summary-card">
                    {/* SVG Score Gauge */}
                    <div className="score-gauge-container">
                      <svg viewBox="0 0 36 36" className="score-gauge">
                        <defs>
                          <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor={aiReview.score >= 80 ? 'var(--green)' : aiReview.score >= 60 ? 'var(--yellow)' : 'var(--red)'} />
                            <stop offset="100%" stopColor={aiReview.score >= 80 ? 'var(--green)' : aiReview.score >= 60 ? 'var(--yellow)' : 'var(--red)'} stopOpacity={0.6} />
                          </linearGradient>
                        </defs>
                        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--bg4)" strokeWidth="3" />
                        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="url(#scoreGradient)" strokeWidth="3"
                          strokeDasharray={`${aiReview.score}, 100`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease-out' }} />
                      </svg>
                      <div className="score-value" style={{
                        color: aiReview.score >= 80 ? 'var(--green)' : aiReview.score >= 60 ? 'var(--yellow)' : 'var(--red)'
                      }}>
                        {aiReview.score}
                      </div>
                    </div>

                    <div className="summary-text">
                      <div className="summary-title">{aiReview.summary}</div>
                      <div className="summary-subtitle">AI 성능 점수</div>
                    </div>

                    <button className="btn btn-ghost btn-sm re-analyze-btn" onClick={getReview} disabled={reviewLoading} title="다시 분석하기">
                      {reviewLoading ? <span className="spinner" /> : '↻'}
                    </button>
                  </div>

                  {/* Analysis Cards */}
                  <div className="analysis-grid">
                    {[
                      { label: '정확성', val: aiReview.correctness, color: 'var(--blue)', bg: 'rgba(56,139,253,0.1)', border: 'rgba(56,139,253,0.15)', icon: '✓' },
                      { label: '시간 복잡도', val: aiReview.timeComplexity, color: 'var(--purple)', bg: 'rgba(163,113,247,0.1)', border: 'rgba(163,113,247,0.15)', icon: '⏱' },
                      { label: '공간 복잡도', val: aiReview.spaceComplexity, color: 'var(--orange)', bg: 'rgba(255,166,87,0.1)', border: 'rgba(255,166,87,0.15)', icon: '💾' },
                    ].map(c => (
                      <div key={c.label} className="ai-review-card" style={{
                        background: c.bg, border: `1px solid ${c.border}`
                      }}>
                        <div className="card-label">{c.label}</div>
                        <div className="card-value" style={{ color: c.color }}>{c.val || '—'}</div>
                      </div>
                    ))}
                  </div>

                  {/* Improvements */}
                  {(aiReview.improvements || []).length > 0 && (
                    <div className="improvements-card">
                      <div className="card-header">
                        <span>🚀</span> 주요 개선 사항
                      </div>
                      <div className="improvements-list">
                        {aiReview.improvements.map((imp, i) => (
                          <div key={i} className="improvement-item">
                            <span className="bullet">•</span>
                            <span>{imp}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Suggested Code */}
                  {aiReview.betterCode && aiReview.betterCode !== code && (
                    <div className="optimized-code-card">
                      <div className="card-header">
                        <div className="header-left">
                          <span className="icon">💡</span>
                          <span className="title">AI 최적화 코드</span>
                        </div>
                        <button className="btn btn-primary btn-sm apply-btn" onClick={() => {
                          setCode(aiReview.betterCode);
                          toast?.show('💡 최적화된 코드가 적용되었습니다.', 'success');
                        }}>
                          변경 사항 적용
                        </button>
                      </div>
                      <div className="code-container">
                        <pre className="mono">{aiReview.betterCode}</pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>}
      </div>
    </div>
  );
}
