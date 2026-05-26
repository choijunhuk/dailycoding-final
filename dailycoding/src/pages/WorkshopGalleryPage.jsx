import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Layers, Play, Plus, Search, Wrench } from 'lucide-react';
import api from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { withVars } from '../utils/languageMode.js';
import './WorkshopGalleryPage.css';

const PRESET_TEMPLATES = [
  {
    nameKo: '클래식 HP 배틀',
    nameEn: 'Classic HP Battle',
    descKo: '정답 시 내 HP +15, 오답 시 상대 HP +10. 표준 배틀 규칙.',
    descEn: 'Correct = my HP +15, wrong = opponent HP +10. Standard battle rules.',
    emoji: '⚔️',
    config: {
      baseHp: 100,
      timeLimit: 1800,
      allowItems: false,
      rules: [
        { id: 'tpl_1', event: 'ON_CORRECT_ANSWER', condition: { type: 'always' }, action: { type: 'MODIFY_HP', target: 'self', value: 15 } },
        { id: 'tpl_2', event: 'ON_WRONG_ANSWER', condition: { type: 'always' }, action: { type: 'MODIFY_HP', target: 'opponent', value: -10 } },
      ],
    },
  },
  {
    nameKo: '생존 모드',
    nameEn: 'Survival Mode',
    descKo: '오답 시 내 HP -20. 틀리면 위험. 정답 시 HP +5 회복.',
    descEn: 'Wrong answer costs you HP -20. Correct answer heals HP +5.',
    emoji: '🛡️',
    config: {
      baseHp: 150,
      timeLimit: 1800,
      allowItems: true,
      rules: [
        { id: 'tpl_1', event: 'ON_CORRECT_ANSWER', condition: { type: 'always' }, action: { type: 'MODIFY_HP', target: 'self', value: 5 } },
        { id: 'tpl_2', event: 'ON_WRONG_ANSWER', condition: { type: 'always' }, action: { type: 'MODIFY_HP', target: 'self', value: -20 } },
        { id: 'tpl_3', event: 'ON_COMPILE_ERROR', condition: { type: 'always' }, action: { type: 'MODIFY_HP', target: 'self', value: -10 } },
      ],
    },
  },
  {
    nameKo: '역전 드라마',
    nameEn: 'Comeback Mode',
    descKo: 'HP 25% 미만일 때 정답 맞히면 시간 +60초. 불리할수록 기회.',
    descEn: 'Correct answer below 25% HP grants +60s. The worse you do, the more opportunities.',
    emoji: '🔥',
    config: {
      baseHp: 100,
      timeLimit: 1800,
      allowItems: false,
      rules: [
        { id: 'tpl_1', event: 'ON_CORRECT_ANSWER', condition: { type: 'always' }, action: { type: 'MODIFY_HP', target: 'self', value: 10 } },
        { id: 'tpl_2', event: 'ON_CORRECT_ANSWER', condition: { type: 'hp_below', value: 25 }, action: { type: 'ADD_TIME', value: 60 } },
        { id: 'tpl_3', event: 'ON_WRONG_ANSWER', condition: { type: 'always' }, action: { type: 'MODIFY_HP', target: 'opponent', value: -15 } },
      ],
    },
  },
  {
    nameKo: '블리츠 배틀',
    nameEn: 'Blitz Battle',
    descKo: '5분 제한, HP 200. 오답 시 상대에게 더블 데미지 5초.',
    descEn: '5-minute limit, HP 200. Wrong answer triggers double damage for 5s.',
    emoji: '⚡',
    config: {
      baseHp: 200,
      timeLimit: 300,
      allowItems: true,
      rules: [
        { id: 'tpl_1', event: 'ON_CORRECT_ANSWER', condition: { type: 'always' }, action: { type: 'MODIFY_HP', target: 'self', value: 20 } },
        { id: 'tpl_2', event: 'ON_WRONG_ANSWER', condition: { type: 'always' }, action: { type: 'DOUBLE_DAMAGE', duration: 5 } },
        {
          id: 'tpl_3',
          event: 'ON_TIMER_LOW',
          condition: { type: 'always' },
          action: { type: 'SHOW_MESSAGE', textKo: '⚡ 시간이 얼마 남지 않았습니다!', textEn: '⚡ Time is almost up!' },
        },
      ],
    },
  },
];

function applyLangToTemplate(template, lang) {
  const rules = (template.config.rules || []).map((rule) => {
    if (rule.action?.type === 'SHOW_MESSAGE' && (rule.action.textKo || rule.action.textEn)) {
      const { textKo, textEn, ...rest } = rule.action;
      return { ...rule, action: { ...rest, text: lang === 'en' ? (textEn || textKo) : (textKo || textEn) } };
    }
    return rule;
  });
  return { ...template, config: { ...template.config, rules } };
}

const SORT_KEYS = [
  { key: 'like_count', tKey: 'wgSortLike' },
  { key: 'created_at', tKey: 'wgSortLatest' },
  { key: 'play_count', tKey: 'wgSortPlayed' },
];

export default function WorkshopGalleryPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [modes, setModes] = useState([]);
  const [sort, setSort] = useState('like_count');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('gallery');

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const params = useMemo(() => ({ sort, q: debouncedQuery, limit: 50 }), [debouncedQuery, sort]);

  const loadModes = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = view === 'mine' ? '/battle-modes/mine' : '/battle-modes';
      const { data } = await api.get(endpoint, { params: view === 'mine' ? { limit: 50 } : params });
      setModes(data.modes || []);
    } catch (err) {
      toast?.show(err.response?.data?.message || t('wgLoadError'), 'error');
      setModes([]);
    } finally {
      setLoading(false);
    }
  }, [view, params, toast, t]);

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

      <section className="wg-templates">
        <div className="wg-templates-head">
          <Layers size={16} />
          <span>{lang === 'en' ? 'Start from a Template' : '템플릿으로 빠르게 시작'}</span>
        </div>
        <div className="wg-templates-grid">
          {PRESET_TEMPLATES.map((tpl) => (
            <button
              key={tpl.nameKo}
              type="button"
              className="wg-template-card"
              onClick={() => navigate('/workshop', { state: { template: applyLangToTemplate(tpl, lang) } })}
            >
              <span className="wg-template-emoji">{tpl.emoji}</span>
              <strong>{lang === 'en' ? tpl.nameEn : tpl.nameKo}</strong>
              <small>{lang === 'en' ? tpl.descEn : tpl.descKo}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="wg-toolbar">
        <div className="wg-tabs">
          {view === 'gallery' && SORT_KEYS.map((tab) => (
            <button
              type="button"
              key={tab.key}
              className={sort === tab.key ? 'active' : ''}
              onClick={() => setSort(tab.key)}
            >
              {t(tab.tKey)}
            </button>
          ))}
          {user && (
            <button
              type="button"
              className={view === 'mine' ? 'active' : ''}
              onClick={() => setView((v) => v === 'mine' ? 'gallery' : 'mine')}
            >
              {t('wgMyModes')}
            </button>
          )}
        </div>
        {view === 'gallery' && (
          <label className="wg-search">
            <Search size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('wgSearchPlaceholder')} />
          </label>
        )}
      </section>

      {loading ? (
        <div className="wg-empty">{t('loading')}</div>
      ) : modes.length === 0 ? (
        <div className="wg-empty">{view === 'mine' ? t('wgMyModesEmpty') : t('wgEmpty')}</div>
      ) : (
        <section className="wg-grid">
          {modes.map((mode) => {
            const isOwner = user && Number(mode.authorId) === Number(user.id);
            return (
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
                  {view === 'mine' && !mode.isPublic && (
                    <span style={{ color: 'var(--text3)', fontSize: 11 }}>{lang === 'en' ? 'Private' : '비공개'}</span>
                  )}
                </div>
                <div className="wg-actions">
                  <button type="button" className="btn btn-primary" onClick={() => navigate(`/battle?workshopModeId=${mode.id}`)}>
                    <Play size={15} /> {t('wgPlayBtn')}
                  </button>
                  {view === 'gallery' && (
                    <button type="button" className={`wg-like ${mode.liked ? 'active' : ''}`} onClick={() => toggleLike(mode.id)}>
                      <Heart size={15} /> {mode.likeCount}
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost" onClick={() => navigate(`/workshop/${mode.id}`)}>
                    {isOwner || view === 'mine' ? t('wgEditBtn') : t('wgViewBtn')}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
