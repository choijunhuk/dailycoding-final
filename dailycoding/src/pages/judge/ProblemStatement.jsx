import { Bookmark, Share2 } from 'lucide-react';
import { formatTimer } from './JudgeTimer.jsx';

export default function ProblemStatement({
  problem,
  handleBookmarkClick,
  isBookmarked,
  handleShareSubmission,
  tierInfo,
  gameMode,
  ghostChallenge,
  dungeonRoom,
  navigate,
  isSpecialProblem,
  isBuildProblem,
  isTroubleshootingProblem,
  problemType,
  specialConfig,
  troubleshootingError,
  troubleshootingConfig,
  problemAcceptanceText,
  problemSubmitCount,
  problemSolvedCount,
  loadWalkthrough,
  walkthroughLoading,
  solved,
  isFreePlan,
  walkthrough,
  user,
  myVote,
  submitDiffVote,
  diffVote,
  voteSubmitted,
  showEditorial,
  mySubmissions,
  setLeftTab,
}) {
  if (!problem) return null;

  return (
    <>
  <div className="prob-content fade-in">
    <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start', flexWrap:'wrap' }}>
      <h2 style={{ margin:0 }}>{problem.title}</h2>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={handleBookmarkClick}>
          <Bookmark size={14} fill={isBookmarked ? 'currentColor' : 'none'} /> {isBookmarked ? 'Bookmarked' : 'Bookmark'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={handleShareSubmission}>
          <Share2 size={14} /> Share
        </button>
      </div>
    </div>
    <div className="prob-meta-row">
      <span className="tag" style={{ background: tierInfo.bg, color: tierInfo.color }}>{tierInfo.label}</span>
      <span className="tag" style={{ background: 'var(--bg3)', color: tierInfo.color, border: `1px solid ${tierInfo.color}40` }}>● {problem.tier?.toUpperCase?.() || problem.tier}</span>
      <span className="pmeta">⏱ {problem.timeLimit}s</span>
      <span className="pmeta">💾 {problem.memLimit}MB</span>
      <span className="pmeta mono">#{problem.id}</span>
    </div>
    <div className="prob-tag-row">
      {(problem.tags||[]).map(t => (
        <span key={t} className="tag" style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>{t}</span>
      ))}
    </div>

    {gameMode && (
      <div className="judge-game-banner">
        <div>
          <strong>{gameMode === 'ghost' ? '👻 Ghost Battle' : gameMode === 'dungeon' ? '🐉 Today\'s Dungeon' : '🎮 Game Mode'}</strong>
          <small>
            {gameMode === 'ghost'
              ? `${ghostChallenge?.ghost?.username || 'Ghost'} target: ${ghostChallenge?.ghost?.targetTimeSec ? formatTimer(ghostChallenge.ghost.targetTimeSec) : '-'}`
              : dungeonRoom?.damage
                ? `Deals ${dungeonRoom.damage} damage to boss on correct answer`
                : 'Submit correct answer to update Game Hub progress.'}
          </small>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/game')}>Game Hub</button>
      </div>
    )}

    <section><h4>Problem</h4><p style={{ whiteSpace: 'pre-line' }}>{problem.desc}</p></section>
    {!isSpecialProblem && !isBuildProblem && !isTroubleshootingProblem && (
      <>
        <section><h4>Input</h4><p style={{ whiteSpace: 'pre-line' }}>{problem.inputDesc}</p></section>
        <section><h4>Output</h4><p style={{ whiteSpace: 'pre-line' }}>{problem.outputDesc}</p></section>

        {(problem.examples||[]).map((ex, i) => (
          <section key={i} style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', marginBottom:8 }}>
            <div style={{ padding:'6px 12px', background:'var(--bg3)', borderBottom:'1px solid var(--border)', fontSize:12, fontWeight:700, color:'var(--text3)' }}>
              Sample {i + 1}
            </div>
            <div className="ex-grid" style={{ padding:'10px 12px', gap:12 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', marginBottom:4 }}>Input</div>
                <pre className="io-box mono" style={{ margin:0 }}>{ex.input}</pre>
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', marginBottom:4 }}>Output</div>
                <pre className="io-box mono" style={{ margin:0 }}>{ex.output}</pre>
              </div>
            </div>
          </section>
        ))}
      </>
    )}

    {isBuildProblem && (
      <section>
        <h4>Build Problem</h4>
        <p style={{ whiteSpace: 'pre-line', color:'var(--text2)', marginBottom:10 }}>
          Write only the core logic in the provided skeleton code and submit.
        </p>
        {problem.starterCode && <pre className="io-box mono">{problem.starterCode}</pre>}
        {problem.setupCode && (
          <>
            <h4>Table Structure</h4>
            <pre className="io-box mono">{problem.setupCode}</pre>
          </>
        )}
      </section>
    )}

    {isSpecialProblem && problemType === 'fill-blank' && (
      <section>
        <h4>Code Template {problem?.preferredLanguage && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text2)', marginLeft: 6 }}>({problem.preferredLanguage})</span>}</h4>
        <pre className="io-box mono">{specialConfig?.codeTemplate || 'No template available.'}</pre>
        {specialConfig?.hint && <p style={{ marginTop: 8, color: 'var(--text2)' }}>💡 Hint: {specialConfig.hint}</p>}
      </section>
    )}

    {isSpecialProblem && problemType === 'bug-fix' && (
      <section>
        <h4>Buggy Code {problem?.preferredLanguage && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text2)', marginLeft: 6 }}>({problem.preferredLanguage})</span>}</h4>
        <pre className="io-box mono">{specialConfig?.buggyCode || 'No buggy code available.'}</pre>
        {specialConfig?.hint && <p style={{ marginTop: 8, color: 'var(--text2)' }}>💡 Hint: {specialConfig.hint}</p>}
      </section>
    )}

    {isTroubleshootingProblem && (
      <section>
        <h4>Troubleshooting Scenario</h4>
        {troubleshootingError ? (
          <div className="hint-box" style={{ borderColor:'rgba(248,81,73,.25)', color:'var(--red)' }}>{troubleshootingError}</div>
        ) : (
          <>
            <div className="hint-box">
              <strong style={{ color:'var(--text)' }}>{troubleshootingConfig?.scenarioTitle || problem.title}</strong>
              <p style={{ marginTop:8, whiteSpace:'pre-line' }}>
                {troubleshootingConfig?.scenarioDescription || problem.desc}
              </p>
            </div>
            <div className="stat-rows" style={{ marginTop:12 }}>
              {[
                ['Target Response Time', troubleshootingConfig?.targetResponseTimeMs ? `${troubleshootingConfig.targetResponseTimeMs}ms` : '-'],
                ['Performance Limit', troubleshootingConfig?.performanceLimitMs ? `${troubleshootingConfig.performanceLimitMs}ms` : '-'],
                ['Memory Limit', troubleshootingConfig?.memoryLimitMb ? `${troubleshootingConfig.memoryLimitMb}MB` : '-'],
                ['Visible / Hidden Tests', `${troubleshootingConfig?.visibleTests?.length || 0} / ${troubleshootingConfig?.hiddenTestCount || 0}`],
              ].map(([k, v]) => (
                <div key={k} className="stat-row"><span>{k}</span><span className="mono" style={{ color:'var(--blue)' }}>{v}</span></div>
              ))}
            </div>
            {Array.isArray(troubleshootingConfig?.forbiddenPatterns) && troubleshootingConfig.forbiddenPatterns.length > 0 && (
              <div style={{ marginTop:12, fontSize:12, color:'var(--text3)' }}>
                Forbidden patterns: {troubleshootingConfig.forbiddenPatterns.join(', ')}
              </div>
            )}
          </>
        )}
      </section>
    )}

    {/* 통계 */}
    <div style={{marginTop:20}}>
      <h4>📈 Problem Stats</h4>
      <div className="stat-rows">
        {[
          ['Acceptance', problemAcceptanceText],
          ['Submissions', problemSubmitCount.toLocaleString()],
          ['Solved', problemSolvedCount.toLocaleString()],
          ['Difficulty',  `${problem.difficulty} / 10`],
        ].map(([k,v])=>(
          <div key={k} className="stat-row"><span>{k}</span><span className="mono" style={{color:'var(--blue)'}}>{v}</span></div>
        ))}
      </div>
    </div>

    {!isSpecialProblem && !isTroubleshootingProblem && (
      <div style={{ marginTop:16, padding:'16px 18px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12 }}>
        <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'center', flexWrap:'wrap' }}>
          <div>
            <h4 style={{ margin:'0 0 4px' }}>🧭 Solution Guide</h4>
            <p style={{ margin:0, fontSize:12, color:'var(--text3)' }}>
              Solve the problem or upgrade to Pro to access AI walkthrough with approach and complexity analysis.
            </p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={loadWalkthrough} disabled={walkthroughLoading || (!solved[problem.id] && isFreePlan)}>
            {walkthroughLoading ? <><span className="spinner"/> Generating</> : solved[problem.id] || !isFreePlan ? 'View Walkthrough' : '🔒 Solve First'}
          </button>
        </div>
        {walkthrough && (
          <div style={{
            marginTop:14,
            padding:'14px 16px',
            borderRadius:10,
            background:'var(--bg)',
            border:'1px solid var(--border)',
            whiteSpace:'pre-wrap',
            lineHeight:1.75,
            color:'var(--text2)',
            fontSize:13,
          }}>
            {walkthrough.replace(/^#+\s?/gm, '')}
          </div>
        )}
      </div>
    )}

    {/* 난이도 투표 (풀었을 때만) */}
    {solved[problem.id] && (
      <div style={{marginTop:16,padding:'16px 18px',background:'var(--bg3)',borderRadius:10,border:'1px solid var(--border)'}}>
        <h4 style={{marginBottom:10}}>📊 Difficulty Rating</h4>
        <div>
          <p style={{fontSize:12,color:'var(--text2)',marginBottom:10}}>
            How hard was this problem? {user?.emailVerified ? 'Click to rate.' : 'Verify your email to rate.'}
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
            {voteSubmitted ? '✅ Voted! ' : ''}
            Avg: <strong>{diffVote?.avgVote ?? diffVote?.avgDifficulty ?? '-'}</strong> / 5 ({diffVote?.voteCount ?? diffVote?.totalVotes ?? 0} users)
          </div>
        </div>
      </div>
    )}

    {/* 패널 열기 버튼 */}
    <div className="judge-panel-actions">
      {[
        ...(showEditorial ? [{ id:'editorial', icon:'📘', label:'Editorial' }] : []),
        { id:'solutions',   icon:'💡', label:'Solutions' },
        { id:'discuss',     icon:'💬', label:'Discussion' },
        { id:'notes',       icon:'🗒️', label:'Notes' },
        { id:'submissions', icon:'📝', label:`Submissions${mySubmissions.length ? ` (${mySubmissions.length})` : ''}` },
      ].map(p => (
        <button key={p.id} className="judge-panel-action" onClick={() => setLeftTab(p.id)}
          onMouseEnter={e=>{e.currentTarget.style.background='var(--bg4)';e.currentTarget.style.color='var(--text)';}}
          onMouseLeave={e=>{e.currentTarget.style.background='var(--bg3)';e.currentTarget.style.color='var(--text2)';}}
        >{p.icon} {p.label}</button>
      ))}
    </div>
  </div>
    </>
  );
}
