import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useLang } from '../context/LangContext.jsx';

const CATEGORIES = [
  ['all', 'sheetCategoryAll'],
  ['contest', 'sheetCategoryContest'],
  ['company', 'sheetCategoryCompany'],
  ['learning', 'sheetCategoryLearning'],
  ['custom', 'sheetCategoryCustom'],
];

export default function SheetsPage() {
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const [category, setCategory] = useState('all');
  const [sheets, setSheets] = useState([]);

  useEffect(() => {
    let ignore = false;
    api.get('/sheets', { params: category === 'all' ? {} : { category } })
      .then(({ data }) => {
        if (!ignore) setSheets(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!ignore) setSheets([]);
      });
    return () => { ignore = true; };
  }, [category]);

  return (
    <div style={{ padding:'28px 24px 48px', maxWidth:1100, margin:'0 auto' }}>
      <h1 style={{ fontSize:28, fontWeight:800, marginBottom:8 }}>{t('sheets')}</h1>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
        {CATEGORIES.map(([value, labelKey]) => (
          <button key={value} className="btn btn-ghost btn-sm" onClick={() => setCategory(value)} style={{ opacity: category === value ? 1 : 0.6 }}>
            {t(labelKey)}
          </button>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:16 }}>
        {sheets.map((sheet) => (
          <div key={sheet.id} style={{ borderRadius:12, overflow:'hidden', border:'1px solid var(--border)', background:'var(--bg2)' }}>
            <div style={{ height:8, background:sheet.thumbnail_color || '#79c0ff' }} />
            <div style={{ padding:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:15 }}>{sheet.title}</div>
                  {sheet.contest_year && (
                    <div style={{ color:'var(--text3)', fontSize:12, marginTop:2 }}>
                      {sheet.contest_name} {sheet.contest_year}{lang === 'ko' ? t('yearSuffix') : ''}
                    </div>
                  )}
                </div>
                <span style={{ fontSize:11, padding:'2px 8px', borderRadius:4, background:'var(--bg3)', color:'var(--text3)' }}>
                  {sheet.category}
                </span>
              </div>
              <div style={{ color:'var(--text2)', fontSize:13, marginTop:8 }}>{sheet.description}</div>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:12, fontSize:12 }}>
                <span style={{ color:'var(--text3)' }}>{t('sheetProblemCount').replace('{n}', String(sheet.problemCount))}</span>
                <span style={{ color:'var(--text3)' }}>{t('sheetAttemptCount').replace('{n}', String(sheet.play_count || 0))}</span>
              </div>
              <button className="btn btn-primary" style={{ width:'100%', marginTop:12 }} onClick={() => navigate(`/sheets/${sheet.id}`)}>
                {t('startExam')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
