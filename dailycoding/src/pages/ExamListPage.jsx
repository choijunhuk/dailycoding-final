import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus.js';
import api from '../api.js';
import { useLang } from '../context/LangContext.jsx';

const COMPANIES = ['all', 'kakao', 'naver', 'line', 'toss'];

export default function ExamListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tier: userTier } = useSubscriptionStatus(user?.id);
  const { t } = useLang();
  const [company, setCompany] = useState('all');
  const [items, setItems] = useState([]);

  useEffect(() => {
    let ignore = false;
    api.get('/exams', { params: company === 'all' ? {} : { company } })
      .then(({ data }) => {
        if (!ignore) setItems(data.items || []);
      })
      .catch(() => {
        if (!ignore) setItems([]);
      });
    return () => { ignore = true; };
  }, [company]);

  return (
    <div style={{ padding: '28px 24px 48px', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{t('exams')}</h1>
      <p style={{ color: 'var(--text2)', marginBottom: 20 }}>{t('examListDesc')}</p>

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
            <button className="btn btn-primary" style={{ width:'100%', marginTop:16 }} onClick={() => navigate(`/exams/${item.id}`)}>
              {item.locked ? t('examLockedPro') : t('startExam')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
