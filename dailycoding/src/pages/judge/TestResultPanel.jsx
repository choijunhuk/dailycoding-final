export default function TestResultPanel({
  result,
  testResults,
  RESULT_INFO,
  wrongNote,
  setWrongNote,
  saveWrongNote,
}) {
  if (!result && testResults.length === 0) return null;

  return (
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
          {result.totalScore != null && (
            <div className="troubleshooting-inline-score">
              <span>총점 <strong>{result.totalScore}</strong>/100</span>
              <span>테스트 {result.correctnessScore}/50</span>
              <span>성능 {result.performanceScore}/30</span>
              <span>가독성 {result.readabilityScore}/20</span>
            </div>
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
  );
}
