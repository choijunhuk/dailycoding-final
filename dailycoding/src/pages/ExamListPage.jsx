import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus.js';
import api from '../api.js';
import { useLang } from '../context/LangContext.jsx';
import { pickLangText } from '../utils/languageMode.js';

const COMPANIES = ['all', 'kakao', 'naver', 'line', 'toss'];

export default function ExamListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tier: userTier } = useSubscriptionStatus(user?.id);
  const { t, lang } = useLang();
  const txt = (ko, en) => pickLangText(lang, ko, en);
  const [company, setCompany] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setLoadError('');
    api.get('/exams', { params: company === 'all' ? {} : { company } })
      .then(({ data }) => {
        if (!ignore) {
          setItems(data.items || []);
        }
      })
      .catch(() => {
        if (!ignore) {
          setItems([]);
          setLoadError(t('examListLoadFailed'));
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => { ignore = true; };
  }, [company, t]);

  return (
    <div style={{ padding: '28px 24px 48px', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{t('exams')}</h1>
      <p style={{ color: 'var(--text2)', marginBottom: 16 }}>{t('examListDesc')}</p>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:10, marginBottom:24 }}>
        {[
          { icon:'⏱️', title:txt('시간 관리', 'Time Management'), desc:txt('문제당 평균 시간을 미리 계산하고 풀이 순서를 계획하세요.', 'Pre-calculate average time per problem and plan your solving order.') },
          { icon:'📋', title:txt('코딩 전 설계', 'Design Before Coding'), desc:txt('코드를 작성하기 전에 샘플 입출력으로 로직을 검증하세요.', 'Verify your logic with sample I/O before writing code.') },
          { icon:'🔁', title:txt('엣지 케이스 확인', 'Check Edge Cases'), desc:txt('빈 배열, 최대값, 음수처럼 경계값을 항상 테스트하세요.', 'Always test boundary values: empty arrays, max values, negatives.') },
          { icon:'🏆', title:txt('실전 조건 연습', 'Practice Under Real Conditions'), desc:txt('타이머를 켜고 실제 시험 환경을 반복해서 시뮬레이션하세요.', 'Use a timer and simulate the actual exam environment repeatedly.') },
        ].map(tip => (
          <div key={tip.title} style={{ padding:'14px 16px', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10 }}>
            <div style={{ fontSize:22, marginBottom:6 }}>{tip.icon}</div>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:4 }}>{tip.title}</div>
            <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.6 }}>{tip.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
        {COMPANIES.map((item) => (
          <button
            key={item}
            onClick={() => setCompany(item)}
            className="btn btn-ghost btn-sm"
            style={{ opacity: company === item ? 1 : 0.6 }}
          >
            {item === 'all' ? t('allOption') : item}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ color:'var(--text2)', padding:'18px 0' }}>{t('examListLoading')}</div>
      )}
      {!loading && loadError && (
        <div style={{ color:'var(--red)', padding:'18px 0' }}>{loadError}</div>
      )}
      {!loading && !loadError && items.length === 0 && (
        <div style={{ color:'var(--text2)', padding:'18px 0' }}>{t('examListEmpty')}</div>
      )}

      {!loading && !loadError && (
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:16 }}>
        {items.map((item) => (
          <div key={item.id} style={{ border:'1px solid var(--border)', borderRadius:12, padding:20, background:'var(--bg2)' }}>
            {item.isPro && userTier === 'free' && (
              <span style={{ background:'var(--purple)', color:'#fff', fontSize:11, padding:'2px 8px', borderRadius:4 }}>PRO</span>
            )}
            <h3 style={{ margin:'12px 0 8px', fontWeight:700 }}>{item.title}</h3>
            <div style={{ color:'var(--text3)', fontSize:13 }}>
              {t('examMeta').replace('{minutes}', String(item.durationMin)).replace('{count}', String(item.problemCount)).replace('{difficulty}', String(item.difficultyAvg || '-'))}
            </div>
            <div style={{ marginTop:8, color:'var(--text3)', fontSize:12 }}>{t('examAttemptCount').replace('{n}', String(item.playCount))}</div>
            <button
              className="btn btn-primary"
              style={{ width:'100%', marginTop:16 }}
              onClick={() => navigate(item.locked ? '/pricing' : `/exams/${item.id}`)}
            >
              {item.locked ? t('examLockedPro') : t('startExam')}
            </button>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
