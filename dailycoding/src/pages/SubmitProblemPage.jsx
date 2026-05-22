import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { formatWithLang, pickLangText } from '../utils/languageMode.js';
import api from '../api.js';

const TIER_OPTIONS = ['unranked', 'bronze', 'silver', 'gold', 'platinum', 'diamond'];
const TYPE_OPTIONS = [
  { value: 'coding', ko: '일반 풀이', en: 'Standard' },
  { value: 'fill-blank', ko: '빈칸 채우기', en: 'Fill in the Blank' },
  { value: 'bug-fix', ko: '틀린부분 찾기', en: 'Bug Fix' },
];
const TAG_OPTIONS = [
  { value: 'math', ko: '수학', en: 'Math' },
  { value: 'dp', ko: '다이나믹 프로그래밍', en: 'Dynamic Programming' },
  { value: 'graph', ko: '그래프 이론', en: 'Graph Theory' },
  { value: 'string', ko: '문자열', en: 'String' },
  { value: 'implementation', ko: '구현', en: 'Implementation' },
  { value: 'greedy', ko: '탐욕', en: 'Greedy' },
  { value: 'sorting', ko: '정렬', en: 'Sorting' },
  { value: 'binary-search', ko: '이분 탐색', en: 'Binary Search' },
  { value: 'bfs', ko: 'BFS', en: 'BFS' },
  { value: 'dfs', ko: 'DFS', en: 'DFS' },
  { value: 'tree', ko: '트리', en: 'Tree' },
  { value: 'stack-queue', ko: '스택/큐', en: 'Stack/Queue' },
];

export default function SubmitProblemPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { lang } = useLang();
  const txt = (ko, en) => pickLangText(lang, ko, en);

  const [form, setForm] = useState({
    title: '',
    description: '',
    hint: '',
    inputDesc: '',
    outputDesc: '',
    tier: 'silver',
    problemType: 'coding',
    difficulty: 5,
    tags: [],
    examples: [{ input: '', output: '' }],
    testcases: [{ input: '', output: '', hidden: false }],
  });
  const [submitting, setSubmitting] = useState(false);
  const [mySubmissions, setMySubmissions] = useState(null);
  const [loadingMy, setLoadingMy] = useState(false);
  const [showMy, setShowMy] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const toggleTag = (tag) => {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }));
  };

  const setExample = (i, key, val) => {
    setForm(f => {
      const next = [...f.examples];
      next[i] = { ...next[i], [key]: val };
      return { ...f, examples: next };
    });
  };

  const setTestcase = (i, key, val) => {
    setForm(f => {
      const next = [...f.testcases];
      next[i] = { ...next[i], [key]: val };
      return { ...f, testcases: next };
    });
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return toast?.show(txt('제목을 입력해주세요.', 'Please enter a title.'), 'error');
    if (!form.description.trim()) return toast?.show(txt('문제 설명을 입력해주세요.', 'Please enter a problem description.'), 'error');
    setSubmitting(true);
    try {
      await api.post('/community-problems', form);
      toast?.show(txt('✅ 문제가 검토 요청되었습니다! 어드민 검토 후 등록됩니다.', '✅ Problem submitted for review! It will be published after admin approval.'), 'success');
      navigate('/problems');
    } catch (err) {
      toast?.show(err.response?.data?.message || txt('제출에 실패했습니다.', 'Submission failed.'), 'error');
    }
    setSubmitting(false);
  };

  const loadMySubmissions = async () => {
    setLoadingMy(true);
    try {
      const res = await api.get('/community-problems');
      setMySubmissions(res.data);
      setShowMy(true);
    } catch {
      toast?.show(txt('불러오기 실패', 'Failed to load.'), 'error');
    }
    setLoadingMy(false);
  };

  const STATUS_LABEL = {
    pending: txt('⏳ 검토 중', '⏳ Under Review'),
    approved: txt('✅ 승인됨', '✅ Approved'),
    rejected: txt('❌ 반려됨', '❌ Rejected'),
  };
  const STATUS_COLOR = { pending: 'var(--yellow)', approved: 'var(--green)', rejected: 'var(--red)' };

  const field = (label, children, required = false) => (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>
        {label}{required && <span style={{ color: 'var(--red)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>{txt('문제 제출하기', 'Submit a Problem')}</h1>
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          {txt('아이디어를 제출하면 어드민이 검토 후 공식 문제로 등록합니다.', 'Submit your idea and an admin will review it before publishing it as an official problem.')}
          {' '}
          {txt('정확한 설명과 예제를 제공할수록 승인 가능성이 높아집니다.', 'The more accurate your description and examples, the higher the chance of approval.')}
        </p>
      </div>

      {/* Submission history */}
      <div style={{ marginBottom: 28 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={showMy ? () => setShowMy(false) : loadMySubmissions}
          disabled={loadingMy}
        >
          {loadingMy ? txt('불러오는 중...', 'Loading...') : showMy ? txt('▲ 내 제출 기록 닫기', '▲ Hide My Submissions') : txt('▼ 내 제출 기록 보기', '▼ My Submission History')}
        </button>
        {showMy && mySubmissions && (
          <div style={{ marginTop: 12, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {mySubmissions.length === 0 ? (
              <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--text3)' }}>{txt('제출한 문제가 없습니다.', 'No submitted problems yet.')}</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text2)' }}>{txt('제목', 'Title')}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text2)' }}>{txt('상태', 'Status')}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text2)' }}>{txt('제출일', 'Submitted')}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text2)' }}>{txt('사유', 'Reason')}</th>
                  </tr>
                </thead>
                <tbody>
                  {mySubmissions.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{s.title}</td>
                      <td style={{ padding: '10px 14px', color: STATUS_COLOR[s.status], fontWeight: 700 }}>
                        {STATUS_LABEL[s.status] || s.status}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>
                        {formatWithLang(lang, s.created_at)}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text2)', fontSize: 12 }}>
                        {s.admin_note || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Submission form */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '28px 24px' }}>
        {field(txt('문제 제목', 'Problem Title'), (
          <input
            className="input"
            style={{ width: '100%' }}
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder={txt('예: 주어진 배열에서 최대 부분합 구하기', 'e.g. Find the maximum subarray sum from a given array')}
            maxLength={200}
          />
        ), true)}

        {field(txt('문제 설명', 'Problem Description'), (
          <textarea
            className="input"
            style={{ width: '100%', minHeight: 160, resize: 'vertical', fontFamily: 'inherit' }}
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder={txt('문제의 배경과 요구 사항을 자세히 적어주세요.', 'Describe the problem background and requirements in detail.')}
          />
        ), true)}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{txt('티어', 'Tier')}</label>
            <select className="input" style={{ width: '100%' }} value={form.tier} onChange={e => set('tier', e.target.value)}>
              {TIER_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{txt('문제 유형', 'Problem Type')}</label>
            <select className="input" style={{ width: '100%' }} value={form.problemType} onChange={e => set('problemType', e.target.value)}>
              {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{txt(o.ko, o.en)}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>
            {txt('난이도', 'Difficulty')}: <span style={{ color: 'var(--blue)' }}>{form.difficulty}</span> / 10
          </label>
          <input type="range" min={1} max={10} value={form.difficulty} onChange={e => set('difficulty', Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--blue)' }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>{txt('태그', 'Tags')}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {TAG_OPTIONS.map(tag => (
              <button
                key={tag.value}
                type="button"
                onClick={() => toggleTag(tag.ko)}
                style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                  background: form.tags.includes(tag.ko) ? 'var(--blue)' : 'var(--bg3)',
                  color: form.tags.includes(tag.ko) ? '#fff' : 'var(--text2)',
                  border: form.tags.includes(tag.ko) ? '1px solid var(--blue)' : '1px solid var(--border)',
                  transition: 'all .15s',
                }}
              >{txt(tag.ko, tag.en)}</button>
            ))}
          </div>
        </div>

        {field(txt('힌트 (선택)', 'Hint (optional)'), (
          <input className="input" style={{ width: '100%' }} value={form.hint}
            onChange={e => set('hint', e.target.value)} placeholder={txt('문제 풀이의 핵심 힌트 (선택)', 'Key hint for solving the problem (optional)')} />
        ))}

        {field(txt('입력 설명 (선택)', 'Input Description (optional)'), (
          <input className="input" style={{ width: '100%' }} value={form.inputDesc}
            onChange={e => set('inputDesc', e.target.value)} placeholder={txt('예: 첫 줄에 정수 N이 주어집니다.', 'e.g. The first line contains an integer N.')} />
        ))}

        {field(txt('출력 설명 (선택)', 'Output Description (optional)'), (
          <input className="input" style={{ width: '100%' }} value={form.outputDesc}
            onChange={e => set('outputDesc', e.target.value)} placeholder={txt('예: 최대 부분합을 출력합니다.', 'e.g. Print the maximum subarray sum.')} />
        ))}

        {/* Example I/O */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>{txt('예제 입출력', 'Example I/O')}</label>
            <button type="button" className="btn btn-ghost btn-sm"
              onClick={() => setForm(f => ({ ...f, examples: [...f.examples, { input: '', output: '' }] }))}>
              {txt('+ 예제 추가', '+ Add Example')}
            </button>
          </div>
          {form.examples.map((ex, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8 }}>
              <textarea className="input mono" style={{ resize: 'vertical', minHeight: 64, fontSize: 12 }}
                value={ex.input} onChange={e => setExample(i, 'input', e.target.value)} placeholder={txt(`입력 ${i + 1}`, `Input ${i + 1}`)} />
              <textarea className="input mono" style={{ resize: 'vertical', minHeight: 64, fontSize: 12 }}
                value={ex.output} onChange={e => setExample(i, 'output', e.target.value)} placeholder={txt(`출력 ${i + 1}`, `Output ${i + 1}`)} />
              {form.examples.length > 1 && (
                <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 16, alignSelf: 'center' }}
                  onClick={() => setForm(f => ({ ...f, examples: f.examples.filter((_, idx) => idx !== i) }))}>✕</button>
              )}
            </div>
          ))}
        </div>

        {/* Test cases */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>{txt('테스트케이스 (선택)', 'Test Cases (optional)')}</label>
            <button type="button" className="btn btn-ghost btn-sm"
              onClick={() => setForm(f => ({ ...f, testcases: [...f.testcases, { input: '', output: '', hidden: false }] }))}>
              {txt('+ 추가', '+ Add')}
            </button>
          </div>
          {form.testcases.map((tc, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 8, marginBottom: 8, alignItems: 'start' }}>
              <textarea className="input mono" style={{ resize: 'vertical', minHeight: 56, fontSize: 12 }}
                value={tc.input} onChange={e => setTestcase(i, 'input', e.target.value)} placeholder={txt(`입력 ${i + 1}`, `Input ${i + 1}`)} />
              <textarea className="input mono" style={{ resize: 'vertical', minHeight: 56, fontSize: 12 }}
                value={tc.output} onChange={e => setTestcase(i, 'output', e.target.value)} placeholder={txt(`출력 ${i + 1}`, `Output ${i + 1}`)} />
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, fontSize: 11, color: 'var(--text3)', paddingTop: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!tc.hidden} onChange={e => setTestcase(i, 'hidden', e.target.checked)} />
                {txt('히든', 'Hidden')}
              </label>
              {form.testcases.length > 1 && (
                <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 16, paddingTop: 6 }}
                  onClick={() => setForm(f => ({ ...f, testcases: f.testcases.filter((_, idx) => idx !== i) }))}>✕</button>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={() => navigate(-1)}>{txt('취소', 'Cancel')}</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? txt('제출 중...', 'Submitting...') : txt('✉ 어드민에게 제출하기', '✉ Submit to Admin')}
          </button>
        </div>
      </div>
    </div>
  );
}
