import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Play, Plus, Search, Wrench } from 'lucide-react';
import api from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { withVars } from '../utils/languageMode.js';
import './WorkshopGalleryPage.css';

const SORT_KEYS = [
  { key: 'like_count', tKey: 'wgSortLike' },
  { key: 'created_at', tKey: 'wgSortLatest' },
  { key: 'play_count', tKey: 'wgSortPlayed' },
];

export default function WorkshopGalleryPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useLang();
  const [modes, setModes] = useState([]);
  const [sort, setSort] = useState('like_count');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const params = useMemo(() => ({ sort, q: query.trim(), limit: 50 }), [query, sort]);

  const loadModes = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/battle-modes', { params });
      setModes(data.modes || []);
    } catch (err) {
      toast?.show(err.response?.data?.message || t('wgLoadError'), 'error');
      setModes([]);
    } finally {
      setLoading(false);
    }
  }, [params, toast, t]);

  useEffect(() => {
    loadModes();
  }, [loadModes]);

  const toggleLike = async (modeId) => {
    try {
      const { data } = await api.post(`/battle-modes/${modeId}/like`);
      setModes((prev) => prev.map((mode) => (
        mode.id === modeId ? { ...mode, liked: data.liked, likeCount: data.likeCount } : mode
      )));
    } catch (err) {
      toast?.show(err.response?.data?.message || t('wgLikeError'), 'error');
    }
  };

  const rulePreview = (mode) => {
    const count = mode?.config?.rules?.length || 0;
    if (count === 0) return t('wgRulesNone');
    return withVars(t('wgRulesCount'), { n: count });
  };

  return (
    <main className="workshop-gallery-page">
      <header className="wg-header">
        <div>
          <p>{t('wgTitle')}</p>
          <h1>{t('wgSubtitle')}</h1>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/workshop')}>
          <Plus size={16} /> {t('wgCreateBtn')}
        </button>
      </header>

      <section className="wg-toolbar">
        <div className="wg-tabs">
          {SORT_KEYS.map((tab) => (
            <button
              type="button"
              key={tab.key}
              className={sort === tab.key ? 'active' : ''}
              onClick={() => setSort(tab.key)}
            >
              {t(tab.tKey)}
            </button>
          ))}
        </div>
        <label className="wg-search">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('wgSearchPlaceholder')} />
        </label>
      </section>

      {loading ? (
        <div className="wg-empty">{t('loading')}</div>
      ) : modes.length === 0 ? (
        <div className="wg-empty">{t('wgEmpty')}</div>
      ) : (
        <section className="wg-grid">
          {modes.map((mode) => (
            <article className="wg-card" key={mode.id}>
              <div className="wg-card-icon"><Wrench size={20} /></div>
              <div className="wg-card-main">
                <h2>{mode.name}</h2>
                <p>{mode.description || t('wgNoDesc')}</p>
              </div>
              <div className="wg-stats">
                <span>{mode.authorUsername || t('wgUnknownAuthor')}</span>
                <span>▶ {mode.playCount}</span>
                <span>♥ {mode.likeCount}</span>
                <span>{rulePreview(mode)}</span>
              </div>
              <div className="wg-actions">
                <button type="button" className="btn btn-primary" onClick={() => navigate(`/battle?workshopModeId=${mode.id}`)}>
                  <Play size={15} /> {t('wgPlayBtn')}
                </button>
                <button type="button" className={`wg-like ${mode.liked ? 'active' : ''}`} onClick={() => toggleLike(mode.id)}>
                  <Heart size={15} /> {mode.likeCount}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => navigate(`/workshop/${mode.id}`)}>
                  {t('wgViewBtn')}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
