import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api.js';
import { useLang } from '../context/LangContext.jsx';
import { useApp } from '../context/AppContext.jsx';
import { getTierLabel } from '../utils/labelMaps.js';

export default function SheetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const { solved } = useApp();
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setLoadError('');
    api.get(`/sheets/${id}`)
      .then(({ data }) => {
        if (!ignore) setSheet(data);
      })
      .catch(() => {
        if (!ignore) {
          setSheet(null);
          setLoadError(t('sheetDetailLoadFailed'));
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => { ignore = true; };
  }, [id, t]);

  if (loading) return <div style={{ padding:40 }}>{t('sheetDetailLoading')}</div>;
  if (loadError) {
    return (
      <div style={{ padding:40 }}>
        <div style={{ color:'var(--red)', marginBottom:16 }}>{loadError}</div>
        <button className="btn btn-ghost" onClick={() => navigate('/sheets')}>{t('sheetBackToList')}</button>
      </div>
    );
  }
  if (!sheet) return <div style={{ padding:40 }}>{t('sheetDetailLoadFailed')}</div>;

  const problems = sheet.problems || [];
  const solvedCount = problems.filter(p => solved?.[p.id]).length;

  return (
    <div style={{ padding:'28px 24px 48px', maxWidth:980, margin:'0 auto' }}>
      <h1 style={{ fontSize:28, fontWeight:800, marginBottom:8 }}>{sheet.title}</h1>
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
        <p style={{ color:'var(--text2)', margin:0 }}>{sheet.description}</p>
        {problems.length > 0 && (
          <span style={{ whiteSpace:'nowrap', fontSize:13, fontWeight:700, color: solvedCount === problems.length ? 'var(--green)' : 'var(--text3)' }}>
            {solvedCount}/{problems.length} {t('sheetDetailSolved')}
          </span>
        )}
      </div>
      <div style={{ display:'grid', gap:12 }}>
        {problems.length === 0 && (
          <div style={{ color:'var(--text2)', padding:'12px 0' }}>{t('sheetDetailEmpty')}</div>
        )}
        {problems.map((problem, index) => {
          const isSolved = Boolean(solved?.[problem.id]);
          return (
            <button key={problem.id} onClick={() => navigate(`/problems/${problem.id}`)} style={{
              padding:'14px 16px',
              borderRadius:12,
              border:`1px solid ${isSolved ? 'rgba(86,211,100,.3)' : 'var(--border)'}`,
              background: isSolved ? 'rgba(86,211,100,.06)' : 'var(--bg2)',
              color:'var(--text)',
              textAlign:'left',
              cursor:'pointer',
              display:'flex',
              alignItems:'center',
              gap:10,
            }}>
              <span style={{color:isSolved?'var(--green)':'var(--text3)',fontSize:13,minWidth:20}}>{isSolved ? '✓' : `${index + 1}.`}</span>
              <span style={{flex:1}}>{problem.title}</span>
              <span style={{fontSize:12,color:'var(--text3)'}}>{getTierLabel(problem.tier, lang)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
