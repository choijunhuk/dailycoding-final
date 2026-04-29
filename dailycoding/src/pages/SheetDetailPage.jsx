import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api.js';
import { useLang } from '../context/LangContext.jsx';

export default function SheetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLang();
  const [sheet, setSheet] = useState(null);

  useEffect(() => {
    let ignore = false;
    api.get(`/sheets/${id}`)
      .then(({ data }) => {
        if (!ignore) setSheet(data);
      })
      .catch(() => {
        if (!ignore) setSheet(null);
      });
    return () => { ignore = true; };
  }, [id]);

  if (!sheet) return <div style={{ padding:40 }}>{t('sheetDetailLoading')}</div>;

  return (
    <div style={{ padding:'28px 24px 48px', maxWidth:980, margin:'0 auto' }}>
      <h1 style={{ fontSize:28, fontWeight:800, marginBottom:8 }}>{sheet.title}</h1>
      <p style={{ color:'var(--text2)', marginBottom:20 }}>{sheet.description}</p>
      <div style={{ display:'grid', gap:12 }}>
        {(sheet.problems || []).map((problem, index) => (
          <button key={problem.id} onClick={() => navigate(`/problems/${problem.id}`)} style={{
            padding:'14px 16px',
            borderRadius:12,
            border:'1px solid var(--border)',
            background:'var(--bg2)',
            color:'var(--text)',
            textAlign:'left',
            cursor:'pointer',
          }}>
            {index + 1}. {problem.title} · {problem.tier}
          </button>
        ))}
      </div>
    </div>
  );
}
