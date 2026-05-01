import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useLang } from '../context/LangContext.jsx';
import { useApp } from '../context/AppContext';

const STEP_COLORS = [
  { bg: 'rgba(88,166,255,.08)', border: 'rgba(88,166,255,.3)', text: 'var(--blue)', pill: 'rgba(88,166,255,.15)' },
  { bg: 'rgba(86,211,100,.08)', border: 'rgba(86,211,100,.3)', text: 'var(--green)', pill: 'rgba(86,211,100,.15)' },
  { bg: 'rgba(210,153,255,.08)', border: 'rgba(210,153,255,.3)', text: 'var(--purple)', pill: 'rgba(210,153,255,.15)' },
  { bg: 'rgba(255,166,87,.08)', border: 'rgba(255,166,87,.3)', text: 'var(--orange)', pill: 'rgba(255,166,87,.15)' },
  { bg: 'rgba(255,122,143,.08)', border: 'rgba(255,122,143,.3)', text: 'var(--red)', pill: 'rgba(255,122,143,.15)' },
];

export default function LearningPathPage() {
  const navigate = useNavigate();
  const { t } = useLang();
  const { solved } = useApp();
  const [paths, setPaths] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [pathProblems, setPathProblems] = useState({});
  const [loadingId, setLoadingId] = useState(null);

  useEffect(() => {
    let ignore = false;
    api.get('/learning-paths')
      .then(({ data }) => { if (!ignore) setPaths(Array.isArray(data) ? data : []); })
      .catch(() => { if (!ignore) setPaths([]); });
    return () => { ignore = true; };
  }, []);

  const togglePath = async (pathId) => {
    if (expandedId === pathId) { setExpandedId(null); return; }
    setExpandedId(pathId);
    if (!pathProblems[pathId]) {
      setLoadingId(pathId);
      try {
        const { data } = await api.get(`/learning-paths/${pathId}`);
        setPathProblems(prev => ({ ...prev, [pathId]: data.problems || [] }));
      } catch {
        setPathProblems(prev => ({ ...prev, [pathId]: [] }));
      } finally {
        setLoadingId(null);
      }
    }
  };

  const totalPaths = paths.length;

  return (
    <div style={{ padding: '28px 24px 48px', maxWidth: 800, margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{t('learning')}</h1>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          총 {totalPaths}개 코스 · 단계별로 알고리즘을 학습하세요
        </div>
      </div>

      {/* 단계 목록 (accordion) */}
      <div style={{ display: 'grid', gap: 8 }}>
        {paths.map((path, index) => {
          const color = STEP_COLORS[index % STEP_COLORS.length];
          const isOpen = expandedId === path.id;
          const problems = pathProblems[path.id] || [];
          const isLoading = loadingId === path.id;
          const solvedCount = problems.filter(p => solved[p.id]).length;
          const totalCount = path.problemIds?.length || 0;
          const progress = totalCount > 0 && problems.length > 0
            ? Math.round((solvedCount / problems.length) * 100)
            : 0;

          return (
            <div key={path.id} style={{
              borderRadius: 12,
              border: `1px solid ${isOpen ? color.border : 'var(--border)'}`,
              background: isOpen ? color.bg : 'var(--bg2)',
              overflow: 'hidden',
              transition: 'all .2s',
            }}>
              {/* 헤더 행 - 클릭으로 토글 */}
              <button
                onClick={() => togglePath(path.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 18px', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: color.pill, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>{path.icon || '📚'}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                    <span style={{ color: color.text, marginRight: 6, fontSize: 12, fontWeight: 800 }}>
                      STEP {path.order_index || index + 1}
                    </span>
                    {path.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {path.description}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  {totalCount > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>{solvedCount}/{totalCount}</span>
                  )}
                  <span style={{ fontSize: 14, color: 'var(--text3)', transition: 'transform .2s', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
                </div>
              </button>

              {/* 진행률 바 (항상 표시) */}
              {totalCount > 0 && problems.length > 0 && (
                <div style={{ height: 3, background: 'var(--bg3)', marginTop: -1 }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: color.text, transition: 'width .4s ease' }} />
                </div>
              )}

              {/* 펼쳐진 문제 목록 */}
              {isOpen && (
                <div style={{ padding: '0 18px 14px', borderTop: `1px solid ${color.border}40` }}>
                  {isLoading ? (
                    <div style={{ padding: '16px 0', color: 'var(--text3)', fontSize: 13 }}>불러오는 중...</div>
                  ) : problems.length === 0 ? (
                    <div style={{ padding: '16px 0', color: 'var(--text3)', fontSize: 13 }}>문제가 없습니다.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
                      {problems.map((problem, pIndex) => {
                        const isSolved = Boolean(solved[problem.id]);
                        return (
                          <button
                            key={problem.id}
                            onClick={() => navigate(`/problems/${problem.id}`)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '9px 12px', borderRadius: 8,
                              border: `1px solid ${isSolved ? 'rgba(86,211,100,.25)' : 'var(--border)'}`,
                              background: isSolved ? 'rgba(86,211,100,.06)' : 'var(--bg3)',
                              color: 'var(--text)', textAlign: 'left', cursor: 'pointer',
                            }}
                          >
                            <span style={{
                              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                              background: isSolved ? 'var(--green)' : 'var(--bg2)',
                              border: `1px solid ${isSolved ? 'var(--green)' : 'var(--border)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10, fontWeight: 800,
                              color: isSolved ? '#0d1117' : 'var(--text3)',
                            }}>
                              {isSolved ? '✓' : pIndex + 1}
                            </span>
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{problem.title}</span>
                            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{problem.tier}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {paths.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text3)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>학습 경로가 없습니다</div>
        </div>
      )}
    </div>
  );
}
