export function BattleAdSlot({ slot }) {
  if (!slot) return null;
  const isVideo = slot.type === 'video';

  return (
    <aside className="bp-ad-slot" data-ad-slot-id={slot.id}>
      <div className="bp-ad-header">
        <strong>{slot.title}</strong>
        <span className="bp-ad-badge">FREE PLAN AD</span>
      </div>
      <p className="bp-ad-desc">{slot.description}</p>

      {!isVideo && (
        <div className="bp-ad-media bp-ad-media-image">
          {slot.imageUrl ? (
            <img src={slot.imageUrl} alt={slot.title} />
          ) : (
            <div className="bp-ad-placeholder">
              <span>광고 이미지 예시 영역</span>
              <small>`imageUrl` 값을 넣으면 실제 배너로 교체됩니다.</small>
            </div>
          )}
        </div>
      )}

      {isVideo && (
        <div className="bp-ad-media bp-ad-media-video">
          {slot.videoUrl ? (
            <video controls playsInline muted poster={slot.posterUrl || undefined} preload="metadata">
              <source src={slot.videoUrl} />
              브라우저가 동영상 태그를 지원하지 않습니다.
            </video>
          ) : (
            <div className="bp-ad-placeholder">
              <span>광고 영상 예시 영역</span>
              <small>`videoUrl` 값을 넣으면 실제 영상 광고로 교체됩니다.</small>
            </div>
          )}
        </div>
      )}

      <a className="bp-ad-cta" href={slot.ctaUrl || '#'} onClick={(event) => slot.ctaUrl === '#' && event.preventDefault()}>
        {slot.ctaText || '광고 자세히 보기'}
      </a>
    </aside>
  );
}

export function FillBlankProblem({ problem, answer, onChange, locked, correct }) {
  const parts = problem.codeTemplate.split(/___\d+___/);
  const blanks = problem.blanks;
  return (
    <div className="bp-problem-body">
      <p className="bp-problem-desc">{problem.desc}</p>
      {problem.hint && <div className="bp-hint">💡 힌트: {problem.hint}</div>}
      <div className="bp-code-fill">
        {parts.map((part, index) => (
          <span key={index}>
            <span className="bp-code-text">{part}</span>
            {index < blanks.length && (
              <input
                className={`bp-blank-input ${correct === true ? 'correct' : correct === false ? 'wrong' : ''}`}
                value={Array.isArray(answer) ? (answer[index] || '') : ''}
                onChange={(event) => {
                  const next = Array.isArray(answer) ? [...answer] : Array(blanks.length).fill('');
                  next[index] = event.target.value;
                  onChange(next);
                }}
                disabled={locked || correct === true}
                placeholder={`빈칸 ${index + 1}`}
                style={{ width: `${Math.max(80, (blanks[index]?.length || 4) * 12)}px` }}
              />
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BugFixProblem({ problem, answer, onChange, locked, correct }) {
  return (
    <div className="bp-problem-body">
      <p className="bp-problem-desc">{problem.desc}</p>
      {problem.hint && <div className="bp-hint">💡 힌트: {problem.hint}</div>}
      <pre className="bp-buggy-code">{problem.buggyCode}</pre>
      <div className="bp-bugfix-input-wrap">
        <label>수정된 줄 입력:</label>
        <input
          className={`bp-bugfix-input ${correct === true ? 'correct' : correct === false ? 'wrong' : ''}`}
          value={answer || ''}
          onChange={(event) => onChange(event.target.value)}
          disabled={locked || correct === true}
          placeholder="버그가 있는 줄을 올바르게 수정해 입력하세요"
        />
      </div>
    </div>
  );
}

export function CodingProblem({ problem, code, lang, lockedLanguageLabel, onCodeChange, locked, result }) {
  return (
    <div className="bp-problem-body">
      <p className="bp-problem-desc">{problem.desc}</p>
      {problem.examples?.length > 0 && (
        <div className="bp-examples">
          {problem.examples.slice(0, 2).map((example, index) => (
            <div key={index} className="bp-example">
              <div className="bp-example-label">예제 {index + 1}</div>
              <div className="bp-example-row">
                <div><div className="bp-example-head">입력</div><pre>{example.input}</pre></div>
                <div><div className="bp-example-head">출력</div><pre>{example.output}</pre></div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="bp-code-header">
        <span className="bp-lang-select" style={{ display: 'inline-flex', alignItems: 'center' }}>
          {lockedLanguageLabel || lang || '언어 미지정'}
        </span>
        {result && (
          <span className={`bp-result-badge ${result}`}>
            {result === 'correct' ? '✅ 정답' : result === 'locked' ? '🔒 선점됨' : '❌ 오답'}
          </span>
        )}
      </div>
      <textarea
        className="bp-code-editor"
        value={code || ''}
        onChange={(event) => onCodeChange(event.target.value)}
        disabled={locked || result === 'correct'}
        placeholder="코드를 입력하세요..."
        spellCheck={false}
      />
    </div>
  );
}
