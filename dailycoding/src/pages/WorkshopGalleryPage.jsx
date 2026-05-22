import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Play, Plus, Search, Wrench } from 'lucide-react';
import api from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import './WorkshopGalleryPage.css';

const SORT_TABS = [
  { key: 'like_count', label: '인기순' },
  { key: 'created_at', label: '최신순' },
  { key: 'play_count', label: '많이 플레이됨' },
];

function rulePreview(mode) {
  const count = mode?.config?.rules?.length || 0;
  if (count === 0) return '룰 없음';
  return `${count}개 룰`;
}

export default function WorkshopGalleryPage() {
  const navigate = useNavigate();
  const toast = useToast();
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
      toast?.show(err.response?.data?.message || '워크샵 갤러리를 불러오지 못했습니다.', 'error');
      setModes([]);
    } finally {
      setLoading(false);
    }
  }, [params, toast]);

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
      toast?.show(err.response?.data?.message || '좋아요를 반영하지 못했습니다.', 'error');
    }
  };

  return (
    <main className="workshop-gallery-page">
      <header className="wg-header">
        <div>
          <p>워크샵 갤러리</p>
          <h1>커스텀 배틀 모드</h1>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/workshop')}>
          <Plus size={16} /> 내 모드 만들기
        </button>
      </header>

      <section className="wg-toolbar">
        <div className="wg-tabs">
          {SORT_TABS.map((tab) => (
            <button
              type="button"
              key={tab.key}
              className={sort === tab.key ? 'active' : ''}
              onClick={() => setSort(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <label className="wg-search">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="모드 이름 검색" />
        </label>
      </section>

      {loading ? (
        <div className="wg-empty">불러오는 중...</div>
      ) : modes.length === 0 ? (
        <div className="wg-empty">표시할 워크샵 모드가 없습니다.</div>
      ) : (
        <section className="wg-grid">
          {modes.map((mode) => (
            <article className="wg-card" key={mode.id}>
              <div className="wg-card-icon"><Wrench size={20} /></div>
              <div className="wg-card-main">
                <h2>{mode.name}</h2>
                <p>{mode.description || '설명이 없습니다.'}</p>
              </div>
              <div className="wg-stats">
                <span>제작자 {mode.authorUsername || '알 수 없음'}</span>
                <span>플레이 {mode.playCount}</span>
                <span>좋아요 {mode.likeCount}</span>
                <span>{rulePreview(mode)}</span>
              </div>
              <div className="wg-actions">
                <button type="button" className="btn btn-primary" onClick={() => navigate(`/battle?workshopModeId=${mode.id}`)}>
                  <Play size={15} /> 플레이
                </button>
                <button type="button" className={`wg-like ${mode.liked ? 'active' : ''}`} onClick={() => toggleLike(mode.id)}>
                  <Heart size={15} /> {mode.likeCount}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => navigate(`/workshop/${mode.id}`)}>
                  보기
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
