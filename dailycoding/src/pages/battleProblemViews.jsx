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

function buildProblemComment(problem) {
  const lines = [
    problem?.title ? `문제: ${problem.title}` : '',
    problem?.inputDesc ? `입력: ${problem.inputDesc}` : '',
    problem?.outputDesc ? `출력: ${problem.outputDesc}` : '',
  ].filter(Boolean);
  return lines.length ? lines.join('\n') : '표준 입력을 읽고 표준 출력으로 답을 출력하세요.';
}

export function getBattleStarterCode(problem, lang) {
  const comment = buildProblemComment(problem);
  if (lang === 'javascript') {
    return `const fs = require('fs');\nconst input = fs.readFileSync(0, 'utf8').trim();\n\n// ${comment.replace(/\n/g, '\n// ')}\nfunction solve(input) {\n  // TODO: 입력 형식에 맞춰 풀이를 작성하세요.\n  return '';\n}\n\nconst answer = solve(input);\nif (answer !== undefined) console.log(answer);`;
  }
  if (lang === 'cpp') {
    return `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  ios::sync_with_stdio(false);\n  cin.tie(nullptr);\n\n  // ${comment.replace(/\n/g, '\n  // ')}\n  // TODO: 입력 형식에 맞춰 풀이를 작성하세요.\n  return 0;\n}`;
  }
  if (lang === 'c') {
    return `#include <stdio.h>\n\nint main(void) {\n  // ${comment.replace(/\n/g, '\n  // ')}\n  // TODO: 입력 형식에 맞춰 풀이를 작성하세요.\n  return 0;\n}`;
  }
  if (lang === 'java') {
    return `import java.io.*;\nimport java.util.*;\n\npublic class Main {\n  public static void main(String[] args) throws Exception {\n    BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n    // ${comment.replace(/\n/g, '\n    // ')}\n    // TODO: 입력 형식에 맞춰 풀이를 작성하세요.\n  }\n}`;
  }
  return `import sys\n\n# ${comment.replace(/\n/g, '\n# ')}\ndef solve():\n    data = sys.stdin.read().strip().split()\n    # TODO: 입력 형식에 맞춰 풀이를 작성하세요.\n\nif __name__ == "__main__":\n    solve()`;
}

const RESULT_LABEL = {
  correct: '정답',
  locked: '선점됨',
  wrong: '오답',
  compile: '컴파일 오류',
  timeout: '시간 초과',
  error: '실행 오류',
};

export function CodingProblem({ problem, code, lang, lockedLanguageLabel, onCodeChange, onInsertStarter, locked, result, judgeDetail }) {
  const resultLabel = RESULT_LABEL[result] || result;
  const starterCode = getBattleStarterCode(problem, lang);
  const hasCode = Boolean(String(code || '').trim());

  return (
    <div className="bp-problem-body">
      <p className="bp-problem-desc">{problem.desc}</p>
      {(problem.inputDesc || problem.outputDesc) && (
        <div className="bp-io-grid">
          <div className="bp-io-card">
            <div className="bp-io-title">입력</div>
            <p>{problem.inputDesc || '표준 입력을 사용합니다.'}</p>
          </div>
          <div className="bp-io-card">
            <div className="bp-io-title">출력</div>
            <p>{problem.outputDesc || '정답을 표준 출력으로 출력합니다.'}</p>
          </div>
        </div>
      )}
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
        <button
          type="button"
          className="bp-btn-small"
          onClick={() => onInsertStarter?.(starterCode)}
          disabled={locked || result === 'correct' || hasCode}
          title={hasCode ? '이미 코드가 있어 템플릿을 덮어쓰지 않습니다.' : '언어별 기본 템플릿 삽입'}
        >
          템플릿
        </button>
        {result && (
          <span className={`bp-result-badge ${result}`}>
            {result === 'correct' ? '✅ ' : result === 'locked' ? '🔒 ' : '❌ '}
            {resultLabel}
          </span>
        )}
      </div>
      {judgeDetail?.detail && (
        <div className={`bp-judge-detail ${result === 'correct' ? 'correct' : 'wrong'}`}>
          <strong>채점 상세</strong>
          <span>{judgeDetail.detail}</span>
          {Number.isFinite(judgeDetail.timeMs) ? <small>실행 시간 {judgeDetail.timeMs}ms</small> : null}
        </div>
      )}
      <textarea
        className="bp-code-editor"
        value={code || ''}
        onChange={(event) => onCodeChange(event.target.value)}
        disabled={locked || result === 'correct'}
        placeholder={starterCode}
        spellCheck={false}
      />
    </div>
  );
}
