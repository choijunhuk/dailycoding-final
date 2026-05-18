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

    {gameMode && (
      <div className="judge-game-banner">
        <div>
          <strong>{gameMode === 'ghost' ? '👻 고스트 배틀 도전 중' : gameMode === 'dungeon' ? '🐉 오늘의 던전 진행 중' : '🎮 게임 모드'}</strong>
          <small>
            {gameMode === 'ghost'
              ? `${ghostChallenge?.ghost?.username || '고스트'} 목표 기록 ${ghostChallenge?.ghost?.targetTimeSec ? formatTimer(ghostChallenge.ghost.targetTimeSec) : '-'}`
              : dungeonRoom?.damage
                ? `정답 시 보스에게 ${dungeonRoom.damage} 피해`
                : '정답을 제출하면 게임 허브 진행도에 반영됩니다.'}
          </small>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/game')}>게임 허브</button>
      </div>
    )}

    <section><h4>문제</h4><p style={{ whiteSpace: 'pre-line' }}>{problem.desc}</p></section>
    {!isSpecialProblem && !isBuildProblem && !isTroubleshootingProblem && (
      <>
        <section><h4>입력</h4><p style={{ whiteSpace: 'pre-line' }}>{problem.inputDesc}</p></section>
        <section><h4>출력</h4><p style={{ whiteSpace: 'pre-line' }}>{problem.outputDesc}</p></section>

        {(problem.examples||[]).map((ex, i) => (
          <section key={i} style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', marginBottom:8 }}>
            <div style={{ padding:'6px 12px', background:'var(--bg3)', borderBottom:'1px solid var(--border)', fontSize:12, fontWeight:700, color:'var(--text3)' }}>
              예제 {i + 1}
            </div>
            <div className="ex-grid" style={{ padding:'10px 12px', gap:12 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', marginBottom:4 }}>입력</div>
                <pre className="io-box mono" style={{ margin:0 }}>{ex.input}</pre>
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', marginBottom:4 }}>출력</div>
                <pre className="io-box mono" style={{ margin:0 }}>{ex.output}</pre>
              </div>
            </div>
          </section>
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
        <h4>코드 템플릿 {problem?.preferredLanguage && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text2)', marginLeft: 6 }}>({problem.preferredLanguage})</span>}</h4>
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

    {isTroubleshootingProblem && (
      <section>
        <h4>트러블슈팅 시나리오</h4>
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
                ['목표 응답 시간', troubleshootingConfig?.targetResponseTimeMs ? `${troubleshootingConfig.targetResponseTimeMs}ms` : '-'],
                ['성능 제한', troubleshootingConfig?.performanceLimitMs ? `${troubleshootingConfig.performanceLimitMs}ms` : '-'],
                ['메모리 제한', troubleshootingConfig?.memoryLimitMb ? `${troubleshootingConfig.memoryLimitMb}MB` : '-'],
                ['Visible / Hidden 테스트', `${troubleshootingConfig?.visibleTests?.length || 0} / ${troubleshootingConfig?.hiddenTestCount || 0}`],
              ].map(([k, v]) => (
                <div key={k} className="stat-row"><span>{k}</span><span className="mono" style={{ color:'var(--blue)' }}>{v}</span></div>
              ))}
            </div>
            {Array.isArray(troubleshootingConfig?.forbiddenPatterns) && troubleshootingConfig.forbiddenPatterns.length > 0 && (
              <div style={{ marginTop:12, fontSize:12, color:'var(--text3)' }}>
                금지 패턴: {troubleshootingConfig.forbiddenPatterns.join(', ')}
              </div>
            )}
          </>
        )}
      </section>
    )}

    {/* 통계 */}
    <div style={{marginTop:20}}>
      <h4>📈 문제 통계</h4>
      <div className="stat-rows">
        {[
          ['정답률', problemAcceptanceText],
          ['제출 수', problemSubmitCount.toLocaleString()],
          ['정답 수', problemSolvedCount.toLocaleString()],
          ['난이도',  `${problem.difficulty} / 10`],
        ].map(([k,v])=>(
          <div key={k} className="stat-row"><span>{k}</span><span className="mono" style={{color:'var(--blue)'}}>{v}</span></div>
        ))}
      </div>
    </div>

    {!isSpecialProblem && !isTroubleshootingProblem && (
      <div style={{ marginTop:16, padding:'16px 18px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12 }}>
        <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'center', flexWrap:'wrap' }}>
          <div>
            <h4 style={{ margin:'0 0 4px' }}>🧭 풀이 해설</h4>
            <p style={{ margin:0, fontSize:12, color:'var(--text3)' }}>
              정답 후 또는 Pro 이용자는 AI 해설로 접근법과 복잡도를 확인할 수 있습니다.
            </p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={loadWalkthrough} disabled={walkthroughLoading || (!solved[problem.id] && isFreePlan)}>
            {walkthroughLoading ? <><span className="spinner"/> 생성 중</> : solved[problem.id] || !isFreePlan ? '풀이 해설 보기' : '🔒 정답 후 공개'}
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
    </>
  );
}
