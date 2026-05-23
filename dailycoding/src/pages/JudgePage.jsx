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
import { pickLangText } from '../utils/languageMode.js';
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

const TIER_SHORT_KO = { unranked: '비랭', iron: '아이언', bronze: '브론즈', silver: '실버', gold: '골드', platinum: '플래티넘', emerald: '에메랄드', diamond: '다이아몬드', master: '마스터', grandmaster: '그마', challenger: '챌린저' };

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

function formatAcceptanceStat(problem, t) {
  const submitCount = getProblemCount(problem, 'submissions', 'submit_count');
  const rate = getProblemAcceptanceRate(problem);
  const rateText = rate == null ? t('judgeNoData') : `${rate.toFixed(1)}%`;
  return t('judgeAccuracyFmt').replace('{rate}', rateText).replace('{count}', submitCount.toLocaleString());
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
  const { user, isAdmin, refreshUser } = useAuth();
  const { isDark } = useTheme();
  const { t, lang: uiLang } = useLang();
  const uiTxt = (ko, en) => pickLangText(uiLang, ko, en);
  const { tier: subscriptionTier } = useSubscriptionStatus(user?.id);
  const isFreePlan = !subscriptionTier || subscriptionTier === 'free';
  const RESULT_INFO = {
    correct: { label: t('accepted'),           color: RESULT_INFO_COLORS.correct },
    success: { label: uiTxt('실행 완료', 'Run Complete'),           color: RESULT_INFO_COLORS.success },
    wrong:   { label: t('wrongAnswer'),         color: RESULT_INFO_COLORS.wrong   },
    timeout: { label: t('timeLimitExceeded'),   color: RESULT_INFO_COLORS.timeout },
    error:   { label: t('runtimeError'),        color: RESULT_INFO_COLORS.error   },
    compile: { label: t('compileError'),        color: RESULT_INFO_COLORS.compile },
    judging: { label: uiTxt('채점 중...', 'Judging...'),             color: RESULT_INFO_COLORS.judging },
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
  // ★ Solve timer
  const timerComponentRef = useRef(null);
  // ★ Solution note
  const [problemNote, setProblemNote] = useState('');
  const [showEditorial, setShowEditorial] = useState(false);
  // ★ Code template
  const [showTpl,     setShowTpl]     = useState(false);
  // ★ Hint
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
  const [similarProblems, setSimilarProblems] = useState([])
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
        toast?.show(uiTxt('풀이 노트를 불러오지 못했습니다.', 'Failed to load solution note.'), 'error');
      }
    }
  };

  const saveNote = async () => {
    if (!problem?.id) return;
    setIsSavingNote(true);
    try {
      await api.post('/notes/' + problem.id, { content: problemNote });
      toast?.show(uiTxt('🗒️ 노트를 저장했습니다.', '🗒️ Note saved.'), 'success');
    } catch (err) {
      toast?.show(uiTxt('노트 저장에 실패했습니다.', 'Failed to save note.'), 'error');
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
      setProblemError(err.response?.status === 404 ? 'Problem not found.' : 'Failed to load problem.');
    }
  };

  // Fetch from API if problem or examples are missing (includes direct URL access)
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
        toast?.show(uiTxt('댓글을 불러오지 못했습니다.', 'Failed to load comments.'), 'error');
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
    if (!problem?.id) { setSimilarProblems([]); return }
    api.get(`/problems/${problem.id}/similar`).then((res) => {
      setSimilarProblems(Array.isArray(res.data) ? res.data.slice(0, 5) : [])
    }).catch(() => setSimilarProblems([]))
  }, [problem?.id])

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
        setTroubleshootingError(err.response?.data?.message || 'Failed to load troubleshooting config.')
      })
    return () => { cancelled = true }
  }, [problem?.id, isTroubleshootingProblem])

  // Auto-save code
  useEffect(() => {
    if (code && problem?.id) {
      const key = getDraftStorageKey(problem.id, lang);
      const t = setTimeout(() => {
        localStorage.setItem(key, code);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [code, problem?.id, lang]);

  // Reset timer + load note on problem change
  useEffect(() => {
    timerComponentRef.current?.reset(); setShowEditorial(false);
    setResult(null); setTestResults([]); setAiReview(null);
    setVoteSubmitted(false); setMyVote(0); setDiffVote(null);
    setSolutions([]); setWrongNote(''); setWalkthrough(null);
    setFillBlankAnswers([])
    setBugFixAnswer('')
    setTroubleshootingResult(null)
    // Load wrong-answer note
    const savedNote = localStorage.getItem(`dc_note_${problem?.id}`);
    if (savedNote) setWrongNote(savedNote);
    // Load solution note
    if (problem?.id) loadNote(problem.id);
  }, [problem?.id]);

  useEffect(() => {
    if (!isSpecialProblem) return
    if (problemType === 'fill-blank') {
      const blanks = Array.isArray(specialConfig?.blanks) ? specialConfig.blanks : []
      setFillBlankAnswers((prev) => Array.from({ length: blanks.length }, (_, index) => prev[index] || ''))
    }
  }, [isSpecialProblem, problemType, specialConfig?.blanks])

  // Check judge availability
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
      setJudgeStatusError(err.response?.data?.message || 'Failed to check judge environment.');
    });
  }, []);

  useEffect(() => {
    if (availableLangOptions.length > 0 && !availableLangOptions.some(o => o.value === lang)) {
      const fallback = availableLangOptions[0]?.value || 'python';
      setLang(fallback);
      toast?.show(uiTxt(`선택한 언어를 지원하지 않아 ${fallback}(으)로 변경했습니다.`, `Selected language not supported. Switched to ${fallback}.`), 'warning');
    }
  }, [availableLangOptions, lang]);

  const isProblemLoading = !problem && !problemError;
  const isBookmarked = Boolean(bookmarks[problem?.id])


  const saveWrongNote = () => {
    if (wrongNote.trim()) {
      localStorage.setItem(`dc_note_${problem.id}`, wrongNote);
      toast?.show(uiTxt('📝 오답 노트를 저장했습니다.', '📝 Wrong answer note saved.'), 'success');
    }
  };

  const saveSnippet = () => {
    if (!problem?.id || !lang) return
    localStorage.setItem(getSnippetStorageKey(problem.id, lang), code || '')
    toast?.show(uiTxt('📌 스니펫을 저장했습니다.', '📌 Snippet saved.'), 'success')
  }

  const clearSnippet = () => {
    if (!problem?.id || !lang) return
    localStorage.removeItem(getSnippetStorageKey(problem.id, lang))
    toast?.show(uiTxt('🗑 저장된 스니펫을 삭제했습니다.', '🗑 Saved snippet deleted.'), 'info')
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
        setAiQuotaNotice(uiTxt('오늘 사용할 수 있는 AI 호출을 모두 사용했습니다.', "You've used all AI calls for today."));
        setBottomTab('review');
      } else {
        toast?.show(uiTxt('AI 리뷰를 불러오지 못했습니다.', 'Failed to load AI review.'), 'error');
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
        toast?.show(uiTxt('먼저 문제를 풀거나 Pro로 업그레이드하세요.', 'Solve the problem first or upgrade to Pro.'), 'warning');
      } else {
        toast?.show(uiLang === 'ko' ? '풀이 가이드를 불러오지 못했습니다.' : (err.response?.data?.message || 'Failed to load solution walkthrough.'), 'error');
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
      toast?.show(uiLang === 'ko' ? '댓글 작성에 실패했습니다.' : (err.response?.data?.message || 'Failed to post comment.'), 'error');
    }
    setCommentLoading(false);
  };

  const deleteComment = async (cid) => {
    try {
      await api.delete('/problems/' + problem.id + '/comments/' + cid);
      setComments(p => p.filter(c => c.id !== cid && c.parentId !== cid));
    } catch (err) {
      toast?.show(uiLang === 'ko' ? t('commentDeleteFailed') : (err.response?.data?.message || t('commentDeleteFailed')), 'error');
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
      toast?.show(uiLang === 'ko' ? t('commentLikeFailed') : (err.response?.data?.message || t('commentLikeFailed')), 'error');
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
      toast?.show(t('difficultyVoteSaved'), 'success');
    } catch (err) {
      toast?.show(uiLang === 'ko' ? t('difficultyVoteFailed') : (err.response?.data?.message || t('difficultyVoteFailed')), 'error');
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
      toast?.show(data?.bookmarked ? t('bookmarkAdded') : t('bookmarkRemoved'), 'info')
    } catch (err) {
      toast?.show(err?.response?.data?.message || t('bookmarkFailed'), 'error')
    }
  }

  const handleShareSubmission = async () => {
    const latestSubmission = [...mySubmissions].find((item) => item.result === 'correct') || mySubmissions[0]
    if (!latestSubmission?.id) {
      toast?.show(uiTxt('공유할 제출이 없습니다. 먼저 제출해주세요.', 'No submission to share. Please submit first.'), 'info')
      return
    }

    try {
      const { data } = await api.post(`/submissions/${latestSubmission.id}/share`)
      const shareUrl = `${window.location.origin}/share/${data.slug}`
      if (navigator.share && window.matchMedia?.('(max-width: 768px)')?.matches) {
        await navigator.share({ title: `${problem.title} Submission Share`, text: `${problem.title} Submission Result`, url: shareUrl })
      } else {
        await copyText(shareUrl)
      }
      toast?.show(uiTxt('공유 링크를 복사했습니다.', 'Share link copied.'), 'success')
    } catch (err) {
      if (err?.name === 'AbortError') return
      toast?.show(uiLang === 'ko' ? '공유 링크 생성에 실패했습니다.' : (err?.response?.data?.message || 'Failed to create share link.'), 'error')
    }
  }

  const applyDetectedLanguage = (submitLang, actionLabel) => {
    if (submitLang === lang) return
    if (code && problem?.id) {
      localStorage.setItem(getDraftStorageKey(problem.id, submitLang), code)
      localStorage.setItem(getLegacyDraftStorageKey(problem.id, submitLang), code)
    }
    setLang(submitLang)
    toast?.show(uiTxt(`코드 패턴을 감지해 ${getJudgeLanguageOption(submitLang)?.label || submitLang}(으)로 전환합니다.`, `Detected code pattern. Switching to ${getJudgeLanguageOption(submitLang)?.label || submitLang} for ${actionLabel}.`), 'info')
  }

  const updateTroubleshootingFile = (path, content) => {
    setTroubleshootingFiles((prev) => prev.map((file) => file.path === path ? { ...file, content } : file))
  }

  const resetTroubleshootingFiles = () => {
    const files = Array.isArray(troubleshootingConfig?.initialFiles) ? troubleshootingConfig.initialFiles : []
    setTroubleshootingFiles(files)
    setActiveTroubleshootingPath(files[0]?.path || '')
    setTroubleshootingResult(null)
    toast?.show(uiTxt('트러블슈팅 파일을 초기 상태로 되돌렸습니다.', 'Troubleshooting files reset to initial state.'), 'info')
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
        await Promise.allSettled([loadSubmissions?.(), loadProblems?.(), refreshUser?.()])
      }
      if (data.result === 'correct') {
        if (submit) confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } })
        toast?.show(submit ? uiTxt('트러블슈팅 제출 완료.', 'Troubleshooting submitted successfully.') : uiTxt('공개 테스트 통과.', 'Visible test passed.'), 'success')
      } else {
        toast?.show(submit ? uiTxt('아직 트러블슈팅 조건을 만족하지 못했습니다.', 'Troubleshooting conditions not yet satisfied.') : uiTxt('공개 테스트 실패.', 'Visible test failed.'), 'warning')
      }
    } catch (err) {
      const msg = uiLang === 'ko' ? (submit ? '트러블슈팅 제출에 실패했습니다.' : '트러블슈팅 실행에 실패했습니다.') : (err.response?.data?.message || (submit ? 'Troubleshooting submission failed.' : 'Troubleshooting run failed.'))
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
      toast?.show(uiTxt('이 문제 유형은 실행을 지원하지 않습니다. 바로 제출해주세요.', 'Run is not supported for this problem type. Please submit directly.'), 'info')
      return
    }
    if (!problem?.id) return;
    if (availableLangOptions.length === 0) {
      toast?.show(uiTxt('실행 가능한 언어가 없습니다.', 'No executable language available.'), 'error');
      return;
    }
    if (!code.trim()) {
      toast?.show(uiTxt('코드를 입력해주세요.', 'Please enter your code.'), 'warning');
      return;
    }

    const runMode = input === undefined ? 'examples' : 'custom';
    const codeLength = new TextEncoder().encode(code).length;
    const submitLang = getEffectiveJudgeLanguage(code, lang, judgeStatus?.supportedLanguages);
    applyDetectedLanguage(submitLang, 'run');

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
        toast?.show(runMode === 'custom' ? uiTxt('▶ 사용자 입력 실행 완료.', '▶ Custom run complete.') : uiTxt('▶ 예제 실행 완료.', '▶ Example run complete.'), 'success');
      } else if (runResult.status === 'wrong') {
        toast?.show(uiTxt('❌ 출력이 정답과 일치하지 않습니다.', '❌ Output does not match expected answer.'), 'error');
      } else if (runResult.status === 'timeout') {
        toast?.show(uiTxt('⏱ 시간 초과.', '⏱ Time limit exceeded.'), 'warning');
      } else {
        toast?.show(uiTxt('⚡ 실행 중 오류가 발생했습니다.', '⚡ An error occurred during execution.'), 'warning');
      }
    } catch (err) {
      const msg = uiLang === 'ko' ? '실행 요청에 실패했습니다.' : (err.response?.data?.message || 'Run request failed.');
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
      toast?.show(uiTxt('👻 고스트 기록을 이겼습니다!', '👻 You beat the ghost record!'), 'success');
      return;
    }
    if (dungeonRoom?.damage) {
      toast?.show(uiTxt(`🐉 보스에게 ${dungeonRoom.damage} 데미지를 입혔습니다!`, `🐉 Dealt ${dungeonRoom.damage} damage to the boss!`), 'success');
      return;
    }
    toast?.show(uiTxt('🎉 정답입니다!', '🎉 Correct!'), 'success');
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
        else toast?.show(uiTxt('❌ 오답입니다.', '❌ Wrong answer.'), 'error');
      } catch (err) {
        const msg = uiLang === 'ko' ? '제출 요청에 실패했습니다.' : (err.response?.data?.message || 'Submission request failed.');
        setResult({ status: 'error', detail: msg });
        setLeftTab('submissions');
        toast?.show(msg, 'error');
      }
      setIsJudging(false);
      return;
    }

    if (availableLangOptions.length === 0) {
      toast?.show(uiTxt('제출 가능한 언어가 없습니다.', 'No submittable language available.'), 'error');
      return;
    }
    const solveTimeSec = timerComponentRef.current?.getSec?.() || null
    const submitLang = getEffectiveJudgeLanguage(code, lang, judgeStatus?.supportedLanguages);
    applyDetectedLanguage(submitLang, 'submit');
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
      else if (sub.result === 'wrong') toast?.show(uiTxt('❌ 오답입니다.', '❌ Wrong Answer.'), 'error');
      else if (sub.result === 'timeout') toast?.show(uiTxt('⏱ 시간 초과.', '⏱ Time Limit Exceeded.'), 'warning');
      else toast?.show(uiTxt('⚡ 오류가 발생했습니다.', '⚡ Error occurred.'), 'warning');
    } catch (err) {
      const msg = uiLang === 'ko' ? '채점 요청에 실패했습니다.' : (err.response?.data?.message || 'Judge request failed.');
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
  const problemAcceptanceText = formatAcceptanceStat(problem, t);

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
              <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{t('judgeProblemLoadFail')}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 16 }}>
                {problemError}
              </div>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                <button className="btn btn-primary btn-sm" onClick={() => loadProblem(id)}>
                  {t('tryAgain')}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/problems')}>
                  Problem List
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="judge-right">
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', background:'var(--bg)' }}>
            Failed to load problem data.
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
            >← Problem</button>
            <span style={{width:1,height:16,background:'var(--border)'}}/>
            <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>
              {leftTab==='solutions'?'💡 Solutions':leftTab==='discuss'?'💬 Discussion':leftTab==='editorial'?'📘 Editorial':'📝 Submissions'}
            </span>
            <div style={{flex:1}}/>
            <span style={{fontSize:12,color:solved[problem.id]?'var(--green)':'var(--text3)'}}>
              {solved[problem.id]?'✅ Solved':'⬜ Unsolved'}
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

          {leftTab === 'problem' && similarProblems.length > 0 && (
            <div className="prob-content fade-in" style={{ borderTop:'1px solid var(--border)', marginTop:0, paddingTop:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text2)', marginBottom:10 }}>{uiTxt('🔗 연관 문제', '🔗 Related Problems')}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {similarProblems.slice(0,4).map(p => {
                  const t = TIERS[p.tier] || {}
                  return (
                    <button
                      key={p.id}
                      onClick={() => navigate(`/problems/${p.id}`)}
                      style={{
                        display:'flex', alignItems:'center', gap:10,
                        background:'var(--bg3)', border:'1px solid var(--border)',
                        borderRadius:8, padding:'8px 12px', cursor:'pointer',
                        textAlign:'left', width:'100%', transition:'border-color .15s',
                      }}
                      onMouseEnter={e=>e.currentTarget.style.borderColor='var(--blue)'}
                      onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}
                    >
                      <span style={{ fontSize:10, fontWeight:700, color:t.color||'var(--text3)', minWidth:28 }}>
                        {uiLang === 'ko' ? (TIER_SHORT_KO[p.tier] || p.tier || '?') : (p.tier||'?').slice(0,3).toUpperCase()}
                      </span>
                      <span style={{ fontSize:13, color:solved[p.id]?'var(--green)':'var(--text)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {solved[p.id]&&'✓ '}{p.title}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── 풀이 공유 탭 ── */}
          {leftTab === 'editorial' && (
            <div className="prob-content fade-in">
              <h4>📘 Editorial</h4>
              {!editorial ? (
                <p style={{ color:'var(--text3)', fontSize:13 }}>No editorial available yet.</p>
              ) : (
                <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10, padding:'16px 18px' }}>
                  <div style={{ fontSize:11, color:'var(--text3)', marginBottom:10 }}>
                    Author: {editorial.author_username || editorial.author_id} · {editorial.updated_at ? new Date(editorial.updated_at).toLocaleString('ko-KR') : ''}
                  </div>
                  <div style={{ whiteSpace:'pre-line', lineHeight:1.7, color:'var(--text)' }}>{editorial.content}</div>
                </div>
              )}
            </div>
          )}

          {/* ── Solutions tab ── */}
          {leftTab === 'solutions' && (
            <div className="prob-content fade-in">
              <h4>💡 {t('otherSolutions')}</h4>
              <p style={{fontSize:12,color:'var(--text3)',marginBottom:12}}>{t('judgeSolveToPeek')}</p>
              {!solutions || solutions === 'locked' ? (
                solutions === 'locked' ? (
                  <div style={{padding:'24px',textAlign:'center',background:'var(--bg3)',borderRadius:10,border:'1px solid var(--border)'}}>
                    <div style={{fontSize:32,marginBottom:8}}>🔒</div>
                    <p style={{fontSize:13,color:'var(--text2)'}}>{t('judgeSolveToPeek')}</p>
                  </div>
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={loadSolutions} disabled={solLoading}>
                    {solLoading ? <><span className="spinner"/> Loading...</> : 'View Solutions'}
                  </button>
                )
              ) : solutions.length === 0 ? (
                <p style={{color:'var(--text3)',fontSize:13}}>No solutions yet.</p>
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

          {/* ── Discussion tab ── */}
          {leftTab === 'discuss' && (
            <div className="prob-content fade-in">
              <h4>💬 Discussion ({comments.length})</h4>
              <div style={{marginTop:12}}>
                {!user?.emailVerified && (
                  <div style={{marginBottom:10,padding:'10px 12px',borderRadius:8,background:'var(--bg3)',border:'1px solid var(--border)',fontSize:12,color:'var(--text2)'}}>
                    Please verify your email to post comments.
                  </div>
                )}
                {replyTo && (
                  <div style={{marginBottom:8,fontSize:12,color:'var(--text2)'}}>
                    <strong>{replyTo.username}</strong> {t('judgeReplyingTo')}
                    <button onClick={() => setReplyTo(null)} style={{marginLeft:8,background:'none',border:'none',color:'var(--blue)',cursor:'pointer',fontSize:12}}>{t('cancel')}</button>
                  </div>
                )}
                <textarea rows={3} value={commentText} onChange={e=>setCommentText(e.target.value)}
                  placeholder={t('judgeCommentPlaceholder')} style={{resize:'vertical',marginBottom:8}} disabled={!user?.emailVerified} />
                <button className="btn btn-primary btn-sm" onClick={postComment} disabled={commentLoading||!commentText.trim()||!user?.emailVerified}>
                  {commentLoading?<span className="spinner"/>:'Post Comment'}
                </button>
              </div>
              <div style={{marginTop:16,display:'flex',flexDirection:'column',gap:10}}>
                {comments.length===0&&<p style={{color:'var(--text3)',fontSize:13}}>No comments yet.</p>}
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
                        {comment.isLiked ? '★' : '☆'} Like {comment.likeCount || 0}
                      </button>
                      <button onClick={() => { setReplyTo(comment); setCommentText(`@${comment.username} `); }} style={{background:'none',border:'none',padding:0,color:'var(--blue)',cursor:'pointer',fontSize:12}}>
                        Reply
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
                            {reply.isLiked ? '★' : '☆'} Like {reply.likeCount || 0}
                          </button>
                          <button onClick={() => { setReplyTo(comment); setCommentText(`@${reply.username} `); }} style={{background:'none',border:'none',padding:0,color:'var(--blue)',cursor:'pointer',fontSize:12}}>
                            Reply
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Personal notes tab ── */}
          {leftTab === 'notes' && (
            <div className="prob-content fade-in">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <h4 style={{margin:0}}>🗒️ My Solution Notes</h4>
                <button className="btn btn-primary btn-sm" onClick={saveNote} disabled={isSavingNote}>
                  {isSavingNote ? <span className="spinner"/> : 'Save'}
                </button>
              </div>
              <p style={{fontSize:12,color:'var(--text3)',marginBottom:12}}>{uiTxt('이 메모는 나에게만 보입니다. 풀이 접근법이나 핵심 회고를 적어두세요.', 'This note is only visible to you. Write down your approach or key takeaways.')}</p>
              <textarea
                value={problemNote}
                onChange={e=>setProblemNote(e.target.value)}
                placeholder={uiTxt('여기에 메모를 자유롭게 적어보세요...', 'Write your notes here...')}
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

              {result?.status === 'correct' && similarProblems.length > 0 && (
                <div style={{
                  margin:'4px 0 16px', padding:'12px 14px',
                  background:'rgba(86,211,100,.06)', border:'1px solid rgba(86,211,100,.2)',
                  borderRadius:10, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
                }}>
                  <div style={{ flex:1, minWidth:120 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'var(--green)', marginBottom:2 }}>🎉 {uiTxt('정답! 다음 문제', 'Correct! Next Problem')}</div>
                    <div style={{ fontSize:12, color:'var(--text2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {similarProblems[0].title}
                    </div>
                  </div>
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => navigate(`/problems/${similarProblems[0].id}`)}
                  >
                    {uiTxt('지금 풀기', 'Solve Now')} →
                  </button>
                </div>
              )}

              {/* Submission history */}
              <h4>{uiTxt('내 제출', 'My Submissions')}</h4>
              {mySubmissions.length === 0
                ? <p style={{ color:'var(--text3)', marginTop:12, fontSize:13 }}>{uiTxt('아직 제출이 없습니다.', 'No submissions yet.')}</p>
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
              <button className="rtab active">{uiTxt('실행 결과', 'Run Result')}</button>
            </div>
            <div className="result-body">
              {!troubleshootingResult ? (
                <div style={{ color:'var(--text3)', fontSize:12 }}>
                  {uiTxt('테스트 실행 또는 제출 후 점수와 피드백이 표시됩니다.', 'Scores and feedback will appear after running a visible test or submitting.')}
                </div>
              ) : (
                <div className="troubleshooting-result-grid">
                  <div className="troubleshooting-result-summary">
                    <strong style={{ color: RESULT_INFO[troubleshootingResult.result]?.color || 'var(--text)' }}>
                      {RESULT_INFO[troubleshootingResult.result]?.label || troubleshootingResult.result}
                    </strong>
                    <span>{uiTxt('총점', 'Total Score')} {troubleshootingResult.totalScore ?? 0}/100</span>
                    <span>{troubleshootingResult.testPassCount ?? 0}/{troubleshootingResult.totalTestCount ?? 0} {uiTxt('테스트', 'tests')}</span>
                    <span>{troubleshootingResult.executionTimeMs ?? '-'}ms</span>
                  </div>
                  <pre className="troubleshooting-feedback">{troubleshootingResult.feedback || uiTxt('피드백 없음', 'No feedback')}</pre>
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
            <button className={`rtab ${bottomTab === 'custom' ? 'active' : ''}`} onClick={() => setBottomTab('custom')}>{uiTxt('커스텀 입력', 'Custom Input')}</button>
            <button className={`rtab ${bottomTab === 'review' ? 'active' : ''}`} onClick={() => setBottomTab('review')}>🔍 {uiTxt('AI 코드 리뷰', 'AI Code Review')}</button>
          </div>

          {bottomTab === 'custom' && (
            <div className="custom-body">
              <textarea className="custom-input mono" placeholder={t('judgeCustomInputPlaceholder')} value={customInput} onChange={e => setCustomInput(e.target.value)} />
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 8, alignSelf: 'flex-start' }}
                onClick={() => runCode({ input: customInput })}>{uiTxt('▶ 실행', '▶ Run')}</button>
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
                    {uiTxt('Pro로 업그레이드', 'Upgrade to Pro')}
                  </Link>
                  {' '}{uiTxt('무제한 이용 가능', 'for unlimited access.')}
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
                      {reviewLoading ? uiTxt('AI가 코드를 분석 중...', 'AI is analyzing your code...') : uiTxt('AI 코드 리뷰 준비됨', 'AI Code Review Ready')}
                    </div>
                    <div style={{ fontSize:12, color:'var(--text3)', maxWidth: 280, lineHeight: 1.5 }}>
                      {uiTxt('정확성, 효율성 및 개선 사항에 대한 즉각적인 피드백을 받으세요.', 'Get instant feedback on correctness, efficiency, and potential improvements.')}
                    </div>
                  </div>
                  {!reviewLoading && (
                    <button className="btn btn-primary btn-sm" onClick={getReview} disabled={!code.trim()}>
                      Analyze My Code
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
                      <div className="summary-subtitle">AI Performance Score</div>
                    </div>

                    <button className="btn btn-ghost btn-sm re-analyze-btn" onClick={getReview} disabled={reviewLoading} title="Re-analyze">
                      {reviewLoading ? <span className="spinner" /> : '↻'}
                    </button>
                  </div>

                  {/* Analysis Cards */}
                  <div className="analysis-grid">
                    {[
                      { label: t('judgeAccuracyLabel'), val: aiReview.correctness, color: 'var(--blue)', bg: 'rgba(56,139,253,0.1)', border: 'rgba(56,139,253,0.15)', icon: '✓' },
                      { label: t('judgeTimeComplexity'), val: aiReview.timeComplexity, color: 'var(--purple)', bg: 'rgba(163,113,247,0.1)', border: 'rgba(163,113,247,0.15)', icon: '⏱' },
                      { label: t('judgeSpaceComplexity'), val: aiReview.spaceComplexity, color: 'var(--orange)', bg: 'rgba(255,166,87,0.1)', border: 'rgba(255,166,87,0.15)', icon: '💾' },
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
                        <span>🚀</span> Key Improvements
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
                          <span className="title">AI Optimized Code</span>
                        </div>
                        <button className="btn btn-primary btn-sm apply-btn" onClick={() => {
                          setCode(aiReview.betterCode);
                          toast?.show(uiTxt('💡 최적화 코드를 적용했습니다.', '💡 Optimized code applied.'), 'success');
                        }}>
                          Apply Changes
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
