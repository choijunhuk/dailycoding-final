import { lazy, Suspense } from 'react';
import { Copy, FileCode2, Play, RotateCcw, Send, Trash2 } from 'lucide-react';
import { DEFAULT_CODE, TEMPLATES } from '../judgePageUtils.js';
import { getJudgeLanguageOption } from '../../data/judgeLanguages.js';
import JudgeTimer from './JudgeTimer.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { pickLangText } from '../../utils/languageMode.js';
import { copyText } from '../../utils/clipboard.js';

const Editor = lazy(() => import('@monaco-editor/react'));

function inferMonacoLanguage(filePath = '') {
  if (filePath.endsWith('.js') || filePath.endsWith('.mjs') || filePath.endsWith('.cjs')) return 'javascript';
  if (filePath.endsWith('.ts')) return 'typescript';
  if (filePath.endsWith('.py')) return 'python';
  if (filePath.endsWith('.json')) return 'json';
  if (filePath.endsWith('.md')) return 'markdown';
  if (filePath.endsWith('.css')) return 'css';
  if (filePath.endsWith('.html')) return 'html';
  return 'plaintext';
}

export default function CodeEditor({
  problem,
  problemType,
  isSpecialProblem,
  isBuildProblem,
  isTroubleshootingProblem,
  lang,
  setLang,
  code,
  setCode,
  availableLangOptions,
  timerComponentRef,
  activeTroubleshootingFile,
  toast,
  saveSnippet,
  clearSnippet,
  resetTroubleshootingFiles,
  showTpl,
  setShowTpl,
  runCode,
  getReview,
  reviewLoading,
  submitCode,
  isJudging,
  judgeStatus,
  judgeStatusError,
  troubleshootingConfig,
  troubleshootingFiles,
  activeTroubleshootingPath,
  setActiveTroubleshootingPath,
  isDark,
  updateTroubleshootingFile,
  editorSettings,
  troubleshootingResult,
  specialConfig,
  fillBlankAnswers,
  setFillBlankAnswers,
  bugFixAnswer,
  setBugFixAnswer,
  isMobileEditor,
}) {
  const { lang: uiLang } = useLang();
  const txt = (ko, en) => pickLangText(uiLang, ko, en);
  const editorTheme = editorSettings.theme || (isDark ? 'vs-dark' : 'vs');

  return (
    <>
  <div className="editor-toolbar">
    {!isSpecialProblem && !isTroubleshootingProblem && (
      <select className="lang-select mono" value={lang} onChange={e => setLang(e.target.value)}>
        {availableLangOptions.length === 0 && <option value={lang}>{txt('채점 불가', 'Judging Unavailable')}</option>}
        {availableLangOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )}
    {isTroubleshootingProblem && (
      <span className="lang-select mono" style={{ display:'inline-flex', alignItems:'center' }}>
        {txt('트러블슈팅 모드', 'Troubleshooting Mode')}
      </span>
    )}
    {isSpecialProblem && (
      <span className="lang-select mono" style={{ display:'inline-flex', alignItems:'center' }}>
        {problemType === 'fill-blank' ? txt('빈칸 채우기 모드', 'Fill-in-the-Blank Mode') : txt('버그 수정 모드', 'Bug Fix Mode')}
      </span>
    )}
    {isBuildProblem && (
      <span className="lang-select mono" style={{ display:'inline-flex', alignItems:'center' }}>
        {txt('구현 모드', 'Implementation Mode')}
      </span>
    )}
    {/* ★ 풀이 타이머 */}
    <JudgeTimer ref={timerComponentRef} />
    <div style={{ flex: 1 }} />
    {/* ★ 코드 도구 */}
    <div className="editor-tool-group">
      <button className="btn btn-ghost btn-sm" onClick={async () => {
        const copied = await copyText(isTroubleshootingProblem ? (activeTroubleshootingFile?.content || '') : code);
        toast?.show(
          copied
            ? txt('📋 코드가 클립보드에 복사되었습니다.', '📋 Code copied to clipboard.')
            : txt('코드 복사에 실패했습니다. 브라우저 권한을 확인해주세요.', 'Failed to copy code. Check browser permissions.'),
          copied ? 'info' : 'error',
        );
      }} title={txt('코드 복사', 'Copy Code')}><Copy size={14} /> {txt('복사', 'Copy')}</button>
      {!isSpecialProblem && !isTroubleshootingProblem && <button className="btn btn-ghost btn-sm" onClick={saveSnippet} title={txt('현재 코드를 스니펫으로 저장', 'Save current code as snippet')}><FileCode2 size={14} /> {txt('스니펫 저장', 'Save Snippet')}</button>}
      {!isSpecialProblem && !isTroubleshootingProblem && <button className="btn btn-ghost btn-sm" onClick={clearSnippet} title={txt('저장된 스니펫 삭제', 'Delete saved snippet')}><Trash2 size={14} /> {txt('삭제', 'Delete')}</button>}
      <button className="btn btn-ghost btn-sm" onClick={() => {
        if (window.confirm(txt('현재 코드를 초기화할까요?', 'Reset the current code?'))) {
          if (isTroubleshootingProblem) resetTroubleshootingFiles();
          else setCode(DEFAULT_CODE[lang] || '');
          toast?.show(txt('↺ 코드가 초기화되었습니다.', '↺ Code has been reset.'), 'info');
        }
      }} title={txt('코드 초기화', 'Reset Code')}><RotateCcw size={14} /> {txt('초기화', 'Reset')}</button>
    </div>
    {/* ★ 코드 템플릿 */}
    {!isSpecialProblem && !isTroubleshootingProblem && (
    <div style={{position:'relative'}}>
      <button className="btn btn-ghost btn-sm" onClick={()=>setShowTpl(p=>!p)} title={txt('코드 템플릿', 'Code Templates')}><FileCode2 size={14} /> {txt('템플릿', 'Templates')}</button>
      {showTpl && (
        <div style={{position:'absolute',top:'100%',right:0,marginTop:4,width:200,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,boxShadow:'0 8px 24px rgba(0,0,0,.4)',zIndex:50,overflow:'hidden'}}>
          <div style={{padding:'8px 12px',fontSize:11,fontWeight:700,color:'var(--text3)',borderBottom:'1px solid var(--border)'}}>
            {availableLangOptions.find(o=>o.value===lang)?.label || getJudgeLanguageOption(lang)?.label} {txt('템플릿', 'Templates')}
          </div>
          {(TEMPLATES[lang]||[]).map((t,i)=>(
            <button key={i} onClick={()=>{setCode(t.code);setShowTpl(false);toast?.show(`📄 "${t.name}" inserted`,'info');}} style={{
              width:'100%',padding:'8px 12px',border:'none',background:'transparent',color:'var(--text)',
              cursor:'pointer',fontSize:12,textAlign:'left',fontFamily:'inherit',transition:'background .1s',
            }}
              onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}
            >{t.name}</button>
          ))}
          {!(TEMPLATES[lang]||[]).length && <div style={{padding:'12px',fontSize:12,color:'var(--text3)'}}>{txt('템플릿이 없습니다', 'No templates')}</div>}
        </div>
      )}
    </div>
    )}
    {!isSpecialProblem && <button className="btn btn-ghost btn-sm" onClick={() => runCode()} disabled={isJudging || (isTroubleshootingProblem && !troubleshootingConfig)} title={isTroubleshootingProblem ? txt('공개 테스트 실행', 'Run Visible Tests') : txt('예제 실행', 'Run Examples')}><Play size={14} /> {isTroubleshootingProblem ? txt('테스트 실행', 'Run Tests') : txt('예제 실행', 'Run Examples')}</button>}
    {!isSpecialProblem && !isTroubleshootingProblem && <button className="btn btn-ghost btn-sm" onClick={getReview} disabled={reviewLoading || !code.trim()} title={txt('AI 코드 리뷰', 'AI Code Review')}>
      {reviewLoading ? <span className="spinner"/> : txt('🔍 리뷰', '🔍 Review')}
    </button>}
    <button className="btn btn-success btn-sm" onClick={submitCode} disabled={isJudging} title={txt('제출 (Ctrl+Enter)', 'Submit (Ctrl+Enter)')}>
      {isJudging ? <><span className="spinner" /> {txt('채점 중', 'Grading')}</> : <><Send size={14} /> {txt('제출', 'Submit')}</>}
    </button>
    {!isSpecialProblem && <span className="editor-key-hint">Ctrl+Enter</span>}
  </div>

  {judgeStatus?.mode === 'native-subprocess' && (
    <div style={{
      padding:'10px 14px',
      borderBottom:'1px solid var(--border)',
      background:'rgba(121,192,255,.08)',
      color:'var(--text2)',
      fontSize:12,
    }}>
      ⚙️ {txt('현재 채점 환경:', 'Current judge environment:')} <strong>native subprocess</strong> {txt('모드', 'mode')} — {txt('지원 언어:', 'Supported languages:')} <strong>{judgeStatus.supportedLanguages?.join(', ')}</strong>
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
    {isTroubleshootingProblem ? (
      <div className="troubleshooting-workspace">
        <aside className="troubleshooting-files">
          <div className="troubleshooting-panel-title">{txt('파일', 'FILES')}</div>
          {troubleshootingFiles.length === 0 ? (
            <div className="troubleshooting-empty">{txt('파일이 없습니다.', 'No files.')}</div>
          ) : troubleshootingFiles.map((file) => (
            <button
              key={file.path}
              className={`troubleshooting-file-btn ${file.path === activeTroubleshootingPath ? 'active' : ''}`}
              onClick={() => setActiveTroubleshootingPath(file.path)}
            >
              <span className="mono">{file.path}</span>
              {file.editable === false && <span className="readonly-badge">{txt('읽기 전용', 'read only')}</span>}
            </button>
          ))}
        </aside>
        <div className="troubleshooting-editor">
          {activeTroubleshootingFile ? (
            <Suspense fallback={<div className="troubleshooting-empty">{txt('에디터 로딩 중...', 'Loading editor...')}</div>}>
              <Editor
                height="100%"
                language={inferMonacoLanguage(activeTroubleshootingFile.path)}
                theme={editorTheme}
                value={activeTroubleshootingFile.content}
                onChange={(v) => updateTroubleshootingFile(activeTroubleshootingFile.path, v || '')}
                options={{
                  readOnly: activeTroubleshootingFile.editable === false,
                  fontSize: editorSettings.font_size || 14,
                  minimap: { enabled: !!editorSettings.minimap },
                  scrollBeyondLastLine: false,
                  tabSize: editorSettings.tab_size || 2,
                  fontFamily: editorSettings.font_family || "'Space Mono', 'Fira Code', Consolas, monospace",
                  lineNumbers: editorSettings.line_numbers !== false ? 'on' : 'off',
                  wordWrap: editorSettings.word_wrap === true ? 'on' : 'off'
                }}
              />
            </Suspense>
          ) : (
            <div className="troubleshooting-empty">{txt('선택된 파일이 없습니다.', 'No file selected.')}</div>
          )}
        </div>
        <aside className="troubleshooting-side">
          <div className="troubleshooting-panel-title">{txt('시나리오', 'SCENARIO')}</div>
          <h3>{troubleshootingConfig?.scenarioTitle || problem.title}</h3>
          <p>{troubleshootingConfig?.scenarioDescription || problem.desc}</p>
          <div className="troubleshooting-metrics">
            <div><span>{txt('목표', 'Target')}</span><strong>{troubleshootingConfig?.targetResponseTimeMs ? `${troubleshootingConfig.targetResponseTimeMs}ms` : '-'}</strong></div>
            <div><span>{txt('제한', 'Limit')}</span><strong>{troubleshootingConfig?.performanceLimitMs ? `${troubleshootingConfig.performanceLimitMs}ms` : '-'}</strong></div>
            <div><span>{txt('테스트', 'Tests')}</span><strong>{troubleshootingConfig ? `${troubleshootingConfig.visibleTests?.length || 0}+${troubleshootingConfig.hiddenTestCount || 0}` : '-'}</strong></div>
          </div>
          {troubleshootingResult && (
            <div className="troubleshooting-score-card">
              <div className="score-total">{troubleshootingResult.totalScore ?? 0}</div>
              <div className="score-lines">
                <span>{txt('정확성', 'Correctness')} {troubleshootingResult.correctnessScore ?? 0}/50</span>
                <span>{txt('성능', 'Performance')} {troubleshootingResult.performanceScore ?? 0}/30</span>
                <span>{txt('가독성', 'Readability')} {troubleshootingResult.readabilityScore ?? 0}/20</span>
              </div>
            </div>
          )}
        </aside>
      </div>
    ) : isSpecialProblem ? (
      <div style={{ height:'100%', padding:16, overflowY:'auto', background:'var(--bg2)' }}>
        {problemType === 'fill-blank' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {(Array.isArray(specialConfig?.blanks) ? specialConfig.blanks : []).map((_, index) => (
              <label key={index} style={{ display:'flex', flexDirection:'column', gap:6, fontSize:12, color:'var(--text2)' }}>
                {txt(`${index + 1}번 빈칸`, `Blank ${index + 1}`)}
                <input
                  value={fillBlankAnswers[index] || ''}
                  onChange={(e) => setFillBlankAnswers((prev) => {
                    const next = [...prev]
                    next[index] = e.target.value
                    return next
                  })}
                  placeholder={txt(`${index + 1}번 빈칸 답`, `Blank ${index + 1} answer`)}
                />
              </label>
            ))}
          </div>
        )}
        {problemType === 'bug-fix' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <label style={{ fontSize:12, color:'var(--text2)' }}>{txt('수정된 코드 / 핵심 줄', 'Fixed Code / Key Lines')}</label>
            <textarea
              className="custom-input mono"
              style={{ minHeight: 240 }}
              value={bugFixAnswer}
              onChange={(e) => setBugFixAnswer(e.target.value)}
              placeholder={txt('수정된 코드 또는 핵심 수정 줄을 입력하세요.', 'Enter the fixed code or key changed lines.')}
            />
          </div>
        )}
      </div>
    ) : (
      <Suspense fallback={<div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:isDark?'#1e1e1e':'#fff',color:'#888',fontSize:13}}>{txt('에디터 로딩 중...', 'Loading editor...')}</div>}>
        <div style={{ display:'grid', gridTemplateRows:isBuildProblem ? '140px 1fr' : '1fr', height:'100%' }}>
          {isBuildProblem && (
            <div style={{ height:'100%', padding:16, overflowY:'auto', background:'var(--bg2)', borderBottom:'1px solid var(--border)' }}>
              <div style={{ color:'var(--text3)', fontSize:12, marginBottom:4 }}>{txt('스켈레톤 코드 (읽기 전용)', 'Skeleton code (read-only)')}</div>
              <pre className="io-box mono" style={{ margin:0 }}>{problem.starterCode || '// YOUR CODE HERE'}</pre>
            </div>
          )}
          {isMobileEditor ? (
            <textarea
              className="mobile-code-textarea mono"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              aria-label={txt('모바일 코드 에디터', 'Mobile code editor')}
            />
          ) : (
            <Editor
              height="100%" language={availableLangOptions.find(o => o.value === lang)?.monaco || getJudgeLanguageOption(lang)?.monaco || 'python'}
              theme={editorTheme} value={code} onChange={v => setCode(v || '')}
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
          )}
        </div>
      </Suspense>
    )}
  </div>
    </>
  );
}
