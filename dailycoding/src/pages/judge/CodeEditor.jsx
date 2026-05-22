import { lazy, Suspense } from 'react';
import { Copy, FileCode2, Play, RotateCcw, Send, Trash2 } from 'lucide-react';
import { DEFAULT_CODE, TEMPLATES } from '../judgePageUtils.js';
import { getJudgeLanguageOption } from '../../data/judgeLanguages.js';
import JudgeTimer from './JudgeTimer.jsx';

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
  return (
    <>
  <div className="editor-toolbar">
    {!isSpecialProblem && !isTroubleshootingProblem && (
      <select className="lang-select mono" value={lang} onChange={e => setLang(e.target.value)}>
        {availableLangOptions.length === 0 && <option value={lang}>Judging Unavailable</option>}
        {availableLangOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )}
    {isTroubleshootingProblem && (
      <span className="lang-select mono" style={{ display:'inline-flex', alignItems:'center' }}>
        Troubleshooting Mode
      </span>
    )}
    {isSpecialProblem && (
      <span className="lang-select mono" style={{ display:'inline-flex', alignItems:'center' }}>
        {problemType === 'fill-blank' ? 'Fill-in-the-Blank Mode' : 'Bug Fix Mode'}
      </span>
    )}
    {isBuildProblem && (
      <span className="lang-select mono" style={{ display:'inline-flex', alignItems:'center' }}>
        Implementation Mode
      </span>
    )}
    {/* ★ 풀이 타이머 */}
    <JudgeTimer ref={timerComponentRef} />
    <div style={{ flex: 1 }} />
    {/* ★ 코드 도구 */}
    <div className="editor-tool-group">
      <button className="btn btn-ghost btn-sm" onClick={() => {
        navigator.clipboard.writeText(isTroubleshootingProblem ? (activeTroubleshootingFile?.content || '') : code);
        toast?.show('📋 Code copied to clipboard.', 'info');
      }} title="Copy Code"><Copy size={14} /> Copy</button>
      {!isSpecialProblem && !isTroubleshootingProblem && <button className="btn btn-ghost btn-sm" onClick={saveSnippet} title="Save current code as snippet"><FileCode2 size={14} /> Save Snippet</button>}
      {!isSpecialProblem && !isTroubleshootingProblem && <button className="btn btn-ghost btn-sm" onClick={clearSnippet} title="Delete saved snippet"><Trash2 size={14} /> Delete</button>}
      <button className="btn btn-ghost btn-sm" onClick={() => {
        if (window.confirm('Reset the current code?')) {
          if (isTroubleshootingProblem) resetTroubleshootingFiles();
          else setCode(DEFAULT_CODE[lang] || '');
          toast?.show('↺ Code has been reset.', 'info');
        }
      }} title="Reset Code"><RotateCcw size={14} /> Reset</button>
    </div>
    {/* ★ 코드 템플릿 */}
    {!isSpecialProblem && !isTroubleshootingProblem && (
    <div style={{position:'relative'}}>
      <button className="btn btn-ghost btn-sm" onClick={()=>setShowTpl(p=>!p)} title="Code Templates"><FileCode2 size={14} /> Templates</button>
      {showTpl && (
        <div style={{position:'absolute',top:'100%',right:0,marginTop:4,width:200,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,boxShadow:'0 8px 24px rgba(0,0,0,.4)',zIndex:50,overflow:'hidden'}}>
          <div style={{padding:'8px 12px',fontSize:11,fontWeight:700,color:'var(--text3)',borderBottom:'1px solid var(--border)'}}>
            {availableLangOptions.find(o=>o.value===lang)?.label || getJudgeLanguageOption(lang)?.label} Templates
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
          {!(TEMPLATES[lang]||[]).length && <div style={{padding:'12px',fontSize:12,color:'var(--text3)'}}>No templates</div>}
        </div>
      )}
    </div>
    )}
    {!isSpecialProblem && <button className="btn btn-ghost btn-sm" onClick={() => runCode()} disabled={isJudging || (isTroubleshootingProblem && !troubleshootingConfig)} title={isTroubleshootingProblem ? 'Run Visible Tests' : 'Run Examples'}><Play size={14} /> {isTroubleshootingProblem ? 'Run Tests' : 'Run Examples'}</button>}
    {!isSpecialProblem && !isTroubleshootingProblem && <button className="btn btn-ghost btn-sm" onClick={getReview} disabled={reviewLoading || !code.trim()} title="AI Code Review">
      {reviewLoading ? <span className="spinner"/> : '🔍 Review'}
    </button>}
    <button className="btn btn-success btn-sm" onClick={submitCode} disabled={isJudging} title="Submit (Ctrl+Enter)">
      {isJudging ? <><span className="spinner" /> Grading</> : <><Send size={14} /> Submit</>}
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
      ⚙️ Current judge environment: <strong>native subprocess</strong> mode — Supported languages: <strong>{judgeStatus.supportedLanguages?.join(', ')}</strong>
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
          <div className="troubleshooting-panel-title">FILES</div>
          {troubleshootingFiles.length === 0 ? (
            <div className="troubleshooting-empty">No files.</div>
          ) : troubleshootingFiles.map((file) => (
            <button
              key={file.path}
              className={`troubleshooting-file-btn ${file.path === activeTroubleshootingPath ? 'active' : ''}`}
              onClick={() => setActiveTroubleshootingPath(file.path)}
            >
              <span className="mono">{file.path}</span>
              {file.editable === false && <span className="readonly-badge">read only</span>}
            </button>
          ))}
        </aside>
        <div className="troubleshooting-editor">
          {activeTroubleshootingFile ? (
            <Suspense fallback={<div className="troubleshooting-empty">Loading editor...</div>}>
              <Editor
                height="100%"
                language={inferMonacoLanguage(activeTroubleshootingFile.path)}
                theme={isDark ? "vs-dark" : "vs"}
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
            <div className="troubleshooting-empty">No file selected.</div>
          )}
        </div>
        <aside className="troubleshooting-side">
          <div className="troubleshooting-panel-title">SCENARIO</div>
          <h3>{troubleshootingConfig?.scenarioTitle || problem.title}</h3>
          <p>{troubleshootingConfig?.scenarioDescription || problem.desc}</p>
          <div className="troubleshooting-metrics">
            <div><span>Target</span><strong>{troubleshootingConfig?.targetResponseTimeMs ? `${troubleshootingConfig.targetResponseTimeMs}ms` : '-'}</strong></div>
            <div><span>Limit</span><strong>{troubleshootingConfig?.performanceLimitMs ? `${troubleshootingConfig.performanceLimitMs}ms` : '-'}</strong></div>
            <div><span>Tests</span><strong>{troubleshootingConfig ? `${troubleshootingConfig.visibleTests?.length || 0}+${troubleshootingConfig.hiddenTestCount || 0}` : '-'}</strong></div>
          </div>
          {troubleshootingResult && (
            <div className="troubleshooting-score-card">
              <div className="score-total">{troubleshootingResult.totalScore ?? 0}</div>
              <div className="score-lines">
                <span>Correctness {troubleshootingResult.correctnessScore ?? 0}/50</span>
                <span>Performance {troubleshootingResult.performanceScore ?? 0}/30</span>
                <span>Readability {troubleshootingResult.readabilityScore ?? 0}/20</span>
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
                Blank {index + 1}
                <input
                  value={fillBlankAnswers[index] || ''}
                  onChange={(e) => setFillBlankAnswers((prev) => {
                    const next = [...prev]
                    next[index] = e.target.value
                    return next
                  })}
                  placeholder={`Blank ${index + 1} answer`}
                />
              </label>
            ))}
          </div>
        )}
        {problemType === 'bug-fix' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <label style={{ fontSize:12, color:'var(--text2)' }}>Fixed Code / Key Lines</label>
            <textarea
              className="custom-input mono"
              style={{ minHeight: 240 }}
              value={bugFixAnswer}
              onChange={(e) => setBugFixAnswer(e.target.value)}
              placeholder="수정된 코드 또는 핵심 수정 줄을 입력하세요."
            />
          </div>
        )}
      </div>
    ) : (
      <Suspense fallback={<div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:isDark?'#1e1e1e':'#fff',color:'#888',fontSize:13}}>Loading editor...</div>}>
        <div style={{ display:'grid', gridTemplateRows:isBuildProblem ? '140px 1fr' : '1fr', height:'100%' }}>
          {isBuildProblem && (
            <div style={{ height:'100%', padding:16, overflowY:'auto', background:'var(--bg2)', borderBottom:'1px solid var(--border)' }}>
              <div style={{ color:'var(--text3)', fontSize:12, marginBottom:4 }}>Skeleton code (read-only)</div>
              <pre className="io-box mono" style={{ margin:0 }}>{problem.starterCode || '// YOUR CODE HERE'}</pre>
            </div>
          )}
          {isMobileEditor ? (
            <textarea
              className="mobile-code-textarea mono"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              aria-label="Mobile code editor"
            />
          ) : (
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
          )}
        </div>
      </Suspense>
    )}
  </div>
    </>
  );
}
