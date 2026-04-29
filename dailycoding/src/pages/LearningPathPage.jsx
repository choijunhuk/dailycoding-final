import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api.js';
import { useLang } from '../context/LangContext.jsx';

export default function LearningPathPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t } = useLang();
  const [paths, setPaths] = useState([]);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let ignore = false;
    if (!id) {
      api.get('/learning-paths')
        .then(({ data }) => {
          if (!ignore) setPaths(Array.isArray(data) ? data : []);
        })
        .catch(() => {
          if (!ignore) setPaths([]);
        });
      return () => { ignore = true; };
    }
    api.get(`/learning-paths/${id}`)
      .then(({ data }) => {
        if (!ignore) setDetail(data);
      })
      .catch(() => {
        if (!ignore) setDetail(null);
      });
    return () => { ignore = true; };
  }, [id]);

  if (id) {
    if (!detail) return <div style={{ padding:40 }}>{t('learningPathLoading')}</div>;
    return (
      <div style={{ padding:'28px 24px 48px', maxWidth:980, margin:'0 auto' }}>
        <h1 style={{ fontSize:28, fontWeight:800, marginBottom:8 }}>{detail.title}</h1>
        <p style={{ color:'var(--text2)', marginBottom:20 }}>{detail.description}</p>
        <div style={{ display:'grid', gap:12 }}>
          {(detail.problems || []).map((problem, index) => (
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

  return (
    <div style={{ padding:'28px 24px 48px', maxWidth:980, margin:'0 auto' }}>
      <h1 style={{ fontSize:28, fontWeight:800, marginBottom:20 }}>{t('learning')}</h1>
      {paths.map((path, index) => (
        <div key={path.id} style={{ display:'flex', gap:16, alignItems:'flex-start', marginBottom:20 }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
            <div style={{
              width:40, height:40, borderRadius:'50%', background:'var(--bg2)',
              border:'2px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
            }}>
              {path.icon}
            </div>
            {index < paths.length - 1 && <div style={{ width:2, flex:1, minHeight:20, background:'var(--border)', marginTop:4 }} />}
          </div>
          <div style={{ flex:1, paddingBottom:16 }}>
            <div style={{ fontWeight:700 }}>Step {path.order_index}. {path.title}</div>
            <div style={{ color:'var(--text2)', fontSize:13 }}>{path.description}</div>
            <button className="btn btn-ghost" style={{ marginTop:8, fontSize:13 }} onClick={() => navigate(`/learning/${path.id}`)}>
              {t('learningPathStart')}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
