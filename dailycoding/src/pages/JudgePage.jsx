import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { PROBLEMS, TIERS } from '../data/problems';
import { getEffectiveJudgeLanguage, getJudgeLanguageOption, getJudgeLanguageOptionsForSupported } from '../data/judgeLanguages.js';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import {
  DEFAULT_CODE,
  getDraftStorageKey,
  getLegacyDraftStorageKey,
  getSnippetStorageKey,
  parseSpecialConfig,
  RESULT_INFO_COLORS,
} from './judgePageUtils.js';
import { JUDGE_AD_SLOT } from './battlePageUtils.js';
import ProblemStatement from './judge/ProblemStatement.jsx';
import CodeEditor from './judge/CodeEditor.jsx';
import TestResultPanel from './judge/TestResultPanel.jsx';
import { BattleAdSlot } from './battleProblemViews.jsx';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus.js';
import './JudgePage.css';

const TROUBLESHOOTING_TYPES = new Set(['troubleshooting', 'performance-fix', 'refactor-fix']);

function isTroubleshootingType(problemType) {
  return TROUBLESHOOTING_TYPES.has(problemType || '');
}


function getProblemCount(problem, camelKey, snakeKey) {
  return Number(problem?.[camelKey] ?? problem?.[snakeKey] ?? 0);
}

function getProblemAcceptanceRate(problem) {
  const submitCount = getProblemCount(problem, 'submissions', 'submit_count');
  const solvedCount = getProblemCount(problem, 'solved', 'solved_count');
  if (submitCount > 0) return (solvedCount / submitCount) * 100;
  if (problem?.acceptanceRate != null) return Number(problem.acceptanceRate);
  return null;
}

function formatAcceptanceStat(problem) {
  const submitCount = getProblemCount(problem, 'submissions', 'submit_count');
  const rate = getProblemAcceptanceRate(problem);
  const rateText = rate == null ? '데이터 없음' : `${rate.toFixed(1)}%`;
  return `정답률 ${rateText} (${submitCount.toLocaleString()}명 제출)`;
}


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
  const { tier: subscriptionTier } = useSubscriptionStatus(user?.id);
  const isFreePlan = !subscriptionTier || subscriptionTier === 'free';
  const RESULT_INFO = {
    correct: { label: t('accepted'),           color: RESULT_INFO_COLORS.correct },
    success: { label: '실행 완료',              color: RESULT_INFO_COLORS.success },
    wrong:   { label: t('wrongAnswer'),         color: RESULT_INFO_COLORS.wrong   },
    timeout: { label: t('timeLimitExceeded'),   color: RESULT_INFO_COLORS.timeout },
    error:   { label: t('runtimeError'),        color: RESULT_INFO_COLORS.error   },
    compile: { label: t('compileError'),        color: RESULT_INFO_COLORS.compile },
    judging: { label: '채점 중...',             color: RESULT_INFO_COLORS.judging },
  };
  const { solved, submissions, addSubmission, problems: appProblems, bookmarks, toggleBookmark, loadProblems, loadSubmissions } = useApp();
  const toast = useToast();
  const allProblems    = appProblems.length > 0 ? appProblems : PROBLEMS;
  const initProblem    = location.state?.problem || allProblems.find(p => String(p.id) === id) || null;
  const gameMode       = location.state?.gameMode || null;
  const ghostChallenge = location.state?.ghostChallenge || null;
  const dungeonRoom    = location.state?.dungeonRoom || null;
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
  const [judgeStatus,  setJudgeStatus]  = useState(null);
  const [judgeStatusError, setJudgeStatusError] = useState('');
  const [fillBlankAnswers, setFillBlankAnswers] = useState([])
  const [bugFixAnswer, setBugFixAnswer] = useState('')
  const [troubleshootingConfig, setTroubleshootingConfig] = useState(null)
  const [troubleshootingFiles, setTroubleshootingFiles] = useState([])
  const [activeTroubleshootingPath, setActiveTroubleshootingPath] = useState('')
  const [troubleshootingError, setTroubleshootingError] = useState('')
  const [troubleshootingResult, setTroubleshootingResult] = useState(null)
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [wrongNote, setWrongNote] = useState('');
  const [editorial, setEditorial] = useState(null)
  const [walkthrough, setWalkthrough] = useState(null)
  const [walkthroughLoading, setWalkthroughLoading] = useState(false)
  const [isMobileEditor, setIsMobileEditor] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  const availableLangOptions = getJudgeLanguageOptionsForSupported(judgeStatus?.supportedLanguages);
  const editorSettings = user?.settings?.editor || {};

  useEffect(() => {
    const onResize = () => setIsMobileEditor(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const loadNote = async (probId) => {
    try {
      const res = await api.get('/notes/' + probId);
      setProblemNote(res.data.content || '');
    } catch (err) {
      if (err.response?.status !== 404) {
        toast?.show('풀이 노트를 불러오지 못했습니다.', 'error');
      }
    }
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
  const isTroubleshootingProblem = isTroubleshootingType(problemType)
  const isSpecialProblem = problemType !== 'coding' && !isBuildProblem && !isTroubleshootingProblem
  const specialConfig = useMemo(() => parseSpecialConfig(problem?.specialConfig), [problem?.specialConfig])
  const activeTroubleshootingFile = troubleshootingFiles.find((file) => file.path === activeTroubleshootingPath) || troubleshootingFiles[0] || null

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
      api.get('/problems/'+problem.id+'/comments').then(r => setComments(r.data)).catch(() => {
        toast?.show('댓글을 불러오지 못했습니다.', 'error');
      });
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

  useEffect(() => {
    if (!problem?.id || !isTroubleshootingProblem) {
      setTroubleshootingConfig(null)
      setTroubleshootingFiles([])
      setActiveTroubleshootingPath('')
      setTroubleshootingError('')
      setTroubleshootingResult(null)
      return
    }

    let cancelled = false
    setTroubleshootingError('')
    api.get(`/problems/${problem.id}/troubleshooting`)
      .then((res) => {
        if (cancelled) return
        const config = res.data || {}
        const files = Array.isArray(config.initialFiles) ? config.initialFiles : []
        setTroubleshootingConfig(config)
        setTroubleshootingFiles(files)
        setActiveTroubleshootingPath(files[0]?.path || '')
      })
      .catch((err) => {
        if (cancelled) return
        setTroubleshootingConfig(null)
        setTroubleshootingFiles([])
        setActiveTroubleshootingPath('')
        setTroubleshootingError(err.response?.data?.message || '트러블슈팅 설정을 불러오지 못했습니다.')
      })
    return () => { cancelled = true }
  }, [problem?.id, isTroubleshootingProblem])

  // 코드 자동저장
  useEffect(() => {
    if (code && problem?.id) {
      const key = getDraftStorageKey(problem.id, lang);
      const t = setTimeout(() => {
        localStorage.setItem(key, code);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [code, problem?.id, lang]);

  // 문제 변경 시 타이머 리셋 + 노트 로드
  useEffect(() => {
    timerComponentRef.current?.reset(); setShowEditorial(false);
    setResult(null); setTestResults([]); setAiReview(null);
    setVoteSubmitted(false); setMyVote(0); setDiffVote(null);
    setSolutions([]); setWrongNote(''); setWalkthrough(null);
    setFillBlankAnswers([])
    setBugFixAnswer('')
    setTroubleshootingResult(null)
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
      const fallback = availableLangOptions[0]?.value || 'python';
      setLang(fallback);
      toast?.show(`선택한 언어를 지원하지 않아 ${fallback}으로 변경되었습니다.`, 'warning');
    }
  }, [availableLangOptions, lang]);

  const isProblemLoading = !problem && !problemError;
  const isBookmarked = Boolean(bookmarks[problem?.id])


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
    if (isSpecialProblem || isTroubleshootingProblem) return;
    if (!code.trim()) return;
    setReviewLoading(true);
    setAiQuotaNotice('');
    try {
      const res = await api.post('/ai/review', { problemId: problem.id, code, lang: getJudgeLanguageOption(lang)?.label || lang });
      setAiReview(res.data);
      setBottomTab('review');
    } catch (err) {
      if (err.response?.data?.code === 'QUOTA_EXCEEDED') {
        setAiQuotaNotice('오늘 AI 사용 가능 횟수를 모두 소진했습니다.');
        setBottomTab('review');
      } else {
        toast?.show('AI 리뷰를 불러올 수 없습니다.', 'error');
      }
    }
    setReviewLoading(false);
  };

  const loadWalkthrough = async () => {
    if (!problem?.id) return;
    setWalkthroughLoading(true);
    try {
      const { data } = await api.get(`/ai/walkthrough/${problem.id}`);
      setWalkthrough(data.walkthrough || '');
    } catch (err) {
      if (err.response?.data?.requiresPro) {
        toast?.show('문제를 먼저 풀거나 Pro 구독이 필요합니다.', 'warning');
      } else {
        toast?.show(err.response?.data?.message || '풀이 해설을 불러오지 못했습니다.', 'error');
      }
    } finally {
      setWalkthroughLoading(false);
    }
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

  const updateTroubleshootingFile = (path, content) => {
    setTroubleshootingFiles((prev) => prev.map((file) => file.path === path ? { ...file, content } : file))
  }

  const resetTroubleshootingFiles = () => {
    const files = Array.isArray(troubleshootingConfig?.initialFiles) ? troubleshootingConfig.initialFiles : []
    setTroubleshootingFiles(files)
    setActiveTroubleshootingPath(files[0]?.path || '')
    setTroubleshootingResult(null)
    toast?.show('트러블슈팅 파일을 초기 상태로 되돌렸습니다.', 'info')
  }

  const runTroubleshooting = async ({ submit = false } = {}) => {
    if (!problem?.id || !troubleshootingConfig) return
    setIsJudging(true)
    setLeftTab('submissions')
    setTroubleshootingResult(null)
    setResult({ status: 'judging' })
    try {
      const endpoint = submit
        ? `/problems/${problem.id}/troubleshooting/submit`
        : `/problems/${problem.id}/troubleshooting/run`
      const { data } = await api.post(endpoint, {
        files: troubleshootingFiles.map((file) => ({ path: file.path, content: file.content })),
      })
      setTroubleshootingResult(data)
      setResult({
        status: data.result,
        time: data.executionTimeMs == null ? '-' : `${data.executionTimeMs}ms`,
        mem: data.memoryUsedMb == null ? '-' : `${data.memoryUsedMb}MB`,
        detail: data.feedback,
        codeLength: data.codeLength || new TextEncoder().encode(JSON.stringify(troubleshootingFiles)).length,
        totalScore: data.totalScore,
        correctnessScore: data.correctnessScore,
        performanceScore: data.performanceScore,
        readabilityScore: data.readabilityScore,
      })
      if (submit) {
        await Promise.allSettled([loadSubmissions?.(), loadProblems?.()])
      }
      if (data.result === 'correct') {
        if (submit) confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } })
        toast?.show(submit ? '트러블슈팅 제출 성공' : 'visible test 통과', 'success')
      } else {
        toast?.show(submit ? '트러블슈팅 조건을 아직 만족하지 못했습니다.' : 'visible test 실패', 'warning')
      }
    } catch (err) {
      const msg = err.response?.data?.message || (submit ? '트러블슈팅 제출 실패' : '트러블슈팅 실행 실패')
      setResult({ status: 'error', detail: msg })
      toast?.show(msg, 'error')
    } finally {
      setIsJudging(false)
    }
  }

  const runCode = async ({ input } = {}) => {
    if (isTroubleshootingProblem) {
      await runTroubleshooting({ submit: false })
      return
    }
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

  const showCorrectToast = (solveTimeSec) => {
    if (ghostChallenge?.ghost?.targetTimeSec && solveTimeSec && solveTimeSec <= ghostChallenge.ghost.targetTimeSec) {
      toast?.show('👻 고스트 기록을 이겼습니다!', 'success');
      return;
    }
    if (dungeonRoom?.damage) {
      toast?.show(`🐉 보스에게 ${dungeonRoom.damage} 피해를 입혔습니다!`, 'success');
      return;
    }
    toast?.show('🎉 정답입니다!', 'success');
  };

  const submitCode = async () => {
    if (isTroubleshootingProblem) {
      await runTroubleshooting({ submit: true })
      return
    }
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
          showCorrectToast(solveTimeSec);
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
    try {
      const sub = await addSubmission({
        problemId: problem.id, problemTitle: problem.title,
        lang: submitLang, code, solveTimeSec,
      });
      setResult({ status: sub.result, time: sub.time, mem: sub.mem, detail: sub.detail, codeLength: sub.codeLength || new TextEncoder().encode(code).length });
      setLeftTab(sub.result === 'correct' ? 'discuss' : 'submissions');
      if (sub.result === 'correct') {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
        showCorrectToast(solveTimeSec);
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
  const problemSubmitCount = getProblemCount(problem, 'submissions', 'submit_count');
  const problemSolvedCount = getProblemCount(problem, 'solved', 'solved_count');
  const problemAcceptanceText = formatAcceptanceStat(problem);

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
            <ProblemStatement
              problem={problem}
              handleBookmarkClick={handleBookmarkClick}
              isBookmarked={isBookmarked}
              handleShareSubmission={handleShareSubmission}
              tierInfo={tierInfo}
              gameMode={gameMode}
              ghostChallenge={ghostChallenge}
              dungeonRoom={dungeonRoom}
              navigate={navigate}
              isSpecialProblem={isSpecialProblem}
              isBuildProblem={isBuildProblem}
              isTroubleshootingProblem={isTroubleshootingProblem}
              problemType={problemType}
              specialConfig={specialConfig}
              troubleshootingError={troubleshootingError}
              troubleshootingConfig={troubleshootingConfig}
              problemAcceptanceText={problemAcceptanceText}
              problemSubmitCount={problemSubmitCount}
              problemSolvedCount={problemSolvedCount}
              loadWalkthrough={loadWalkthrough}
              walkthroughLoading={walkthroughLoading}
              solved={solved}
              isFreePlan={isFreePlan}
              walkthrough={walkthrough}
              user={user}
              myVote={myVote}
              submitDiffVote={submitDiffVote}
              diffVote={diffVote}
              voteSubmitted={voteSubmitted}
              showEditorial={showEditorial}
              mySubmissions={mySubmissions}
              setLeftTab={setLeftTab}
            />
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
              <TestResultPanel
                result={result}
                testResults={testResults}
                RESULT_INFO={RESULT_INFO}
                wrongNote={wrongNote}
                setWrongNote={setWrongNote}
                saveWrongNote={saveWrongNote}
              />

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
      <CodeEditor
        problem={problem}
        problemType={problemType}
        isSpecialProblem={isSpecialProblem}
        isBuildProblem={isBuildProblem}
        isTroubleshootingProblem={isTroubleshootingProblem}
        lang={lang}
        setLang={setLang}
        code={code}
        setCode={setCode}
        availableLangOptions={availableLangOptions}
        timerComponentRef={timerComponentRef}
        activeTroubleshootingFile={activeTroubleshootingFile}
        toast={toast}
        saveSnippet={saveSnippet}
        clearSnippet={clearSnippet}
        resetTroubleshootingFiles={resetTroubleshootingFiles}
        showTpl={showTpl}
        setShowTpl={setShowTpl}
        runCode={runCode}
        getReview={getReview}
        reviewLoading={reviewLoading}
        submitCode={submitCode}
        isJudging={isJudging}
        judgeStatus={judgeStatus}
        judgeStatusError={judgeStatusError}
        troubleshootingConfig={troubleshootingConfig}
        troubleshootingFiles={troubleshootingFiles}
        activeTroubleshootingPath={activeTroubleshootingPath}
        setActiveTroubleshootingPath={setActiveTroubleshootingPath}
        isDark={isDark}
        updateTroubleshootingFile={updateTroubleshootingFile}
        editorSettings={editorSettings}
        troubleshootingResult={troubleshootingResult}
        specialConfig={specialConfig}
        fillBlankAnswers={fillBlankAnswers}
        setFillBlankAnswers={setFillBlankAnswers}
        bugFixAnswer={bugFixAnswer}
        setBugFixAnswer={setBugFixAnswer}
        isMobileEditor={isMobileEditor}
      />

        {/* ★ 광고 슬롯 (무료 플랜) */}
        {isFreePlan && <BattleAdSlot slot={JUDGE_AD_SLOT} />}

        {/* Bottom panel */}
        {isTroubleshootingProblem && (
          <div className="result-panel troubleshooting-result-panel">
            <div className="result-tabs">
              <button className="rtab active">실행 결과</button>
            </div>
            <div className="result-body">
              {!troubleshootingResult ? (
                <div style={{ color:'var(--text3)', fontSize:12 }}>
                  Visible 테스트 실행 또는 제출 후 점수와 피드백이 표시됩니다.
                </div>
              ) : (
                <div className="troubleshooting-result-grid">
                  <div className="troubleshooting-result-summary">
                    <strong style={{ color: RESULT_INFO[troubleshootingResult.result]?.color || 'var(--text)' }}>
                      {RESULT_INFO[troubleshootingResult.result]?.label || troubleshootingResult.result}
                    </strong>
                    <span>총점 {troubleshootingResult.totalScore ?? 0}/100</span>
                    <span>{troubleshootingResult.testPassCount ?? 0}/{troubleshootingResult.totalTestCount ?? 0} tests</span>
                    <span>{troubleshootingResult.executionTimeMs ?? '-'}ms</span>
                  </div>
                  <pre className="troubleshooting-feedback">{troubleshootingResult.feedback || '피드백 없음'}</pre>
                  {Array.isArray(troubleshootingResult.tests) && troubleshootingResult.tests.length > 0 && (
                    <div className="troubleshooting-test-list">
                      {troubleshootingResult.tests.map((test, index) => (
                        <div key={`${test.name}-${index}`} className={`troubleshooting-test ${test.passed ? 'pass' : 'fail'}`}>
                          <span>{test.passed ? '✓' : '✗'} {test.name}</span>
                          <span>{test.executionTimeMs}ms</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {!isSpecialProblem && !isTroubleshootingProblem && <div className={`result-panel ${bottomTab === 'review' ? 'expanded' : ''}`}>
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
