import { lazy, Suspense } from 'react';
import { getJudgeLanguageOption } from '../data/judgeLanguages.js';
import { useLang } from '../context/LangContext.jsx';
import { pickLangText } from '../utils/languageMode.js';

const Editor = lazy(() => import('@monaco-editor/react'));

const BATTLE_EDITOR_OPTIONS = Object.freeze({
  fontSize: 14,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  tabSize: 2,
  insertSpaces: true,
  detectIndentation: false,
  tabFocusMode: false,
  autoClosingBrackets: 'always',
  autoClosingQuotes: 'always',
  autoSurround: 'languageDefined',
  autoIndent: 'advanced',
  formatOnType: true,
  fontFamily: "'Space Mono', 'Fira Code', Consolas, monospace",
  lineNumbers: 'on',
  wordWrap: 'on',
});

export function BattleAdSlot({ slot }) {
  const { lang: adLang } = useLang();
  const adTxt = (ko, en) => adLang === 'ko' ? ko : en;
  if (!slot) return null;
  const isVideo = slot.type === 'video';

  return (
    <aside className="bp-ad-slot" data-ad-slot-id={slot.id}>
      <div className="bp-ad-header">
        <strong>{slot.title}</strong>
        <span className="bp-ad-badge">{adTxt('무료 광고', 'FREE PLAN AD')}</span>
      </div>
      <p className="bp-ad-desc">{slot.description}</p>

      {!isVideo && (
        <div className="bp-ad-media bp-ad-media-image">
          {slot.imageUrl ? (
            <img src={slot.imageUrl} alt={slot.title} />
          ) : (
            <div className="bp-ad-placeholder">
              <span>{adTxt('이미지 광고 미리보기', 'Ad image preview')}</span>
              <small>{adTxt('imageUrl을 설정하면 실제 배너로 교체됩니다.', 'Set `imageUrl` to replace this with an actual banner.')}</small>
            </div>
          )}
        </div>
      )}

      {isVideo && (
        <div className="bp-ad-media bp-ad-media-video">
          {slot.videoUrl ? (
            <video controls playsInline muted poster={slot.posterUrl || undefined} preload="metadata">
              <source src={slot.videoUrl} />
              Your browser does not support the video tag.
            </video>
          ) : (
            <div className="bp-ad-placeholder">
              <span>{adTxt('동영상 광고 미리보기', 'Ad video preview')}</span>
              <small>{adTxt('videoUrl을 설정하면 실제 동영상 광고로 교체됩니다.', 'Set `videoUrl` to replace this with an actual video ad.')}</small>
            </div>
          )}
        </div>
      )}

      <a className="bp-ad-cta" href={slot.ctaUrl || '#'} onClick={(event) => slot.ctaUrl === '#' && event.preventDefault()}>
        {slot.ctaText || adTxt('자세히 보기', 'Learn more')}
      </a>
    </aside>
  );
}

export function FillBlankProblem({ problem, answer, onChange, locked, correct }) {
  const { lang } = useLang();
  const txt = (ko, en) => pickLangText(lang, ko, en);
  const parts = problem.codeTemplate.split(/___\d+___/);
  const blanks = problem.blanks;
  return (
    <div className="bp-problem-body">
      <p className="bp-problem-desc">{problem.desc}</p>
      {problem.hint && <div className="bp-hint">💡 {txt('힌트', 'Hint')}: {problem.hint}</div>}
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
                placeholder={txt(`${index + 1}번 빈칸`, `Blank ${index + 1}`)}
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
  const { lang } = useLang();
  const txt = (ko, en) => pickLangText(lang, ko, en);
  return (
    <div className="bp-problem-body">
      <p className="bp-problem-desc">{problem.desc}</p>
      {problem.hint && <div className="bp-hint">💡 {txt('힌트', 'Hint')}: {problem.hint}</div>}
      <pre className="bp-buggy-code">{problem.buggyCode}</pre>
      <div className="bp-bugfix-input-wrap">
        <label>{txt('수정된 줄 입력:', 'Enter fixed line:')}</label>
        <input
          className={`bp-bugfix-input ${correct === true ? 'correct' : correct === false ? 'wrong' : ''}`}
          value={answer || ''}
          onChange={(event) => onChange(event.target.value)}
          disabled={locked || correct === true}
          placeholder={txt('수정된 줄을 입력하세요', 'Enter the fixed line')}
        />
      </div>
    </div>
  );
}

function buildProblemComment(problem) {
  const lines = [
    problem?.title ? `Problem: ${problem.title}` : '',
    problem?.inputDesc ? `Input: ${problem.inputDesc}` : '',
    problem?.outputDesc ? `Output: ${problem.outputDesc}` : '',
  ].filter(Boolean);
  return lines.length ? lines.join('\n') : 'Read from standard input and write your answer to standard output.';
}

export function getBattleStarterCode(problem, lang) {
  const comment = buildProblemComment(problem);
  if (lang === 'javascript') {
    return `const fs = require('fs');\nconst input = fs.readFileSync(0, 'utf8').trim();\n\n// ${comment.replace(/\n/g, '\n// ')}\nfunction solve(input) {\n  // TODO: implement your solution here.\n  return '';\n}\n\nconst answer = solve(input);\nif (answer !== undefined) console.log(answer);`;
  }
  if (lang === 'cpp') {
    return `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  ios::sync_with_stdio(false);\n  cin.tie(nullptr);\n\n  // ${comment.replace(/\n/g, '\n  // ')}\n  // TODO: implement your solution here.\n  return 0;\n}`;
  }
  if (lang === 'c') {
    return `#include <stdio.h>\n\nint main(void) {\n  // ${comment.replace(/\n/g, '\n  // ')}\n  // TODO: implement your solution here.\n  return 0;\n}`;
  }
  if (lang === 'java') {
    return `import java.io.*;\nimport java.util.*;\n\npublic class Main {\n  public static void main(String[] args) throws Exception {\n    BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n    // ${comment.replace(/\n/g, '\n    // ')}\n    // TODO: implement your solution here.\n  }\n}`;
  }
  return `import sys\n\n# ${comment.replace(/\n/g, '\n# ')}\ndef solve():\n    data = sys.stdin.read().strip().split()\n    # TODO: implement your solution here.\n\nif __name__ == "__main__":\n    solve()`;
}

const RESULT_LABEL = {
  ko: {
    correct: '정답',
    locked: '점령됨',
    wrong: '오답',
    compile: '컴파일 오류',
    timeout: '시간 초과',
    error: '런타임 오류',
  },
  en: {
    correct: 'Correct',
    locked: 'Claimed',
    wrong: 'Wrong',
    compile: 'Compile Error',
    timeout: 'Timeout',
    error: 'Runtime Error',
  },
};

export function CodingProblem({ problem, code, lang, lockedLanguageLabel, onCodeChange, onInsertStarter, locked, result, judgeDetail }) {
  const { lang: uiLang } = useLang();
  const txt = (ko, en) => pickLangText(uiLang, ko, en);
  const resultLabel = (RESULT_LABEL[uiLang] || RESULT_LABEL.en)[result] || result;
  const starterCode = getBattleStarterCode(problem, lang);
  const hasCode = Boolean(String(code || '').trim());
  const monacoLanguage = getJudgeLanguageOption(lang)?.monaco || 'python';
  const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') !== 'light';

  return (
    <div className="bp-problem-body">
      <p className="bp-problem-desc">{problem.desc}</p>
      {(problem.inputDesc || problem.outputDesc) && (
        <div className="bp-io-grid">
          <div className="bp-io-card">
            <div className="bp-io-title">{txt('입력', 'Input')}</div>
            <p>{problem.inputDesc || txt('표준 입력 사용.', 'Uses standard input.')}</p>
          </div>
          <div className="bp-io-card">
            <div className="bp-io-title">{txt('출력', 'Output')}</div>
            <p>{problem.outputDesc || txt('표준 출력으로 답을 출력하세요.', 'Output your answer to standard output.')}</p>
          </div>
        </div>
      )}
      {problem.examples?.length > 0 && (
        <div className="bp-examples">
          {problem.examples.slice(0, 2).map((example, index) => (
            <div key={index} className="bp-example">
              <div className="bp-example-label">{txt('샘플', 'Sample')} {index + 1}</div>
              <div className="bp-example-row">
                <div><div className="bp-example-head">{txt('입력', 'Input')}</div><pre>{example.input}</pre></div>
                <div><div className="bp-example-head">{txt('출력', 'Output')}</div><pre>{example.output}</pre></div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="bp-code-header">
        <span className="bp-lang-select" style={{ display: 'inline-flex', alignItems: 'center' }}>
          {lockedLanguageLabel || lang || 'No language'}
        </span>
        <button
          type="button"
          className="bp-btn-small"
          onClick={() => onInsertStarter?.(starterCode)}
          disabled={locked || result === 'correct' || hasCode}
          title={hasCode ? txt('이미 코드가 있어 템플릿으로 덮어쓰지 않습니다.', 'Code already exists, template will not overwrite.') : txt('언어 기본 템플릿 삽입', 'Insert default template for language')}
        >
          {txt('템플릿', 'Template')}
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
          <strong>{txt('채점 상세', 'Judge Detail')}</strong>
          <span>{judgeDetail.detail}</span>
          {Number.isFinite(judgeDetail.timeMs) ? <small>{txt('실행 시간', 'Runtime')} {judgeDetail.timeMs}ms</small> : null}
        </div>
      )}
      <div className="bp-code-editor-shell">
        <Suspense fallback={<div className="bp-code-editor-loading">{txt('에디터 로딩 중...', 'Loading editor...')}</div>}>
          <Editor
            height="100%"
            language={monacoLanguage}
            theme={isDark ? 'vs-dark' : 'vs'}
            value={code || ''}
            onChange={(value) => onCodeChange(value || '')}
            options={{
              ...BATTLE_EDITOR_OPTIONS,
              readOnly: locked || result === 'correct',
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}
