import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Eye, Plus, Save, Trash2 } from 'lucide-react';
import api from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { withVars } from '../utils/languageMode.js';
import './WorkshopPage.css';

const DEFAULT_CONFIG = {
  baseHp: 100,
  timeLimit: 1800,
  allowItems: false,
  startingItems: [],
  rules: [],
};

function createRule(index) {
  return {
    id: `rule_${Date.now()}_${index}`,
    event: 'ON_CORRECT_ANSWER',
    condition: { type: 'always' },
    action: { type: 'MODIFY_HP', target: 'self', value: 15 },
  };
}

function defaultCondition(type) {
  return type === 'always' ? { type } : { type, value: 30 };
}

function defaultAction(type) {
  if (type === 'MODIFY_HP') return { type, target: 'self', value: 15 };
  if (type === 'SET_HP') return { type, target: 'self', value: 100 };
  if (type === 'ADD_TIME') return { type, value: 30 };
  if (type === 'GRANT_ITEM') return { type, item: 'shield' };
  if (type === 'DOUBLE_DAMAGE') return { type, duration: 10 };
  if (type === 'FREEZE_OPPONENT') return { type, duration: 5 };
  return { type, text: '' };
}

function conditionSentence(condition, t, condLabels) {
  if (!condition || condition.type === 'always') return t('workshopAlwaysSentence');
  const label = condLabels[condition.type] || condition.type;
  const suffix = condition.type === 'time_remaining_below' ? t('workshopCondSecSuffix') : '';
  return `${label} ${condition.value}${suffix}`;
}

function actionSentence(action, t, tgtLabels, itemLabels) {
  if (!action) return '';
  if (action.type === 'MODIFY_HP') {
    const sign = Number(action.value) >= 0 ? '+' : '';
    return `${tgtLabels[action.target] || action.target} HP ${sign}${action.value}`;
  }
  if (action.type === 'SET_HP') {
    return withVars(t('workshopSetHpTo'), { target: tgtLabels[action.target] || action.target, value: action.value });
  }
  if (action.type === 'ADD_TIME') {
    const sign = Number(action.value) >= 0 ? '+' : '';
    return withVars(t('workshopAddTimeFmt'), { sign, value: action.value });
  }
  if (action.type === 'GRANT_ITEM') {
    return withVars(t('workshopGrantItemFmt'), { item: itemLabels[action.item] || action.item });
  }
  if (action.type === 'DOUBLE_DAMAGE') {
    return withVars(t('workshopDoubleDamageFmt'), { duration: action.duration });
  }
  if (action.type === 'FREEZE_OPPONENT') {
    return withVars(t('workshopFreezeFmt'), { duration: action.duration });
  }
  return withVars(t('workshopShowMsgFmt'), { text: action.text || '' });
}

export default function WorkshopPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { t, lang } = useLang();
  const template = !id ? location.state?.template : null;
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(template ? (lang === 'en' ? template.nameEn : template.nameKo) : '');
  const [description, setDescription] = useState(template ? (lang === 'en' ? template.descEn : template.descKo) : '');
  const [isPublic, setIsPublic] = useState(true);
  const [config, setConfig] = useState(template ? { ...DEFAULT_CONFIG, ...template.config } : DEFAULT_CONFIG);

  const rules = config.rules || [];

  const eventLabels = {
    ON_CORRECT_ANSWER: t('workshopEvt_ON_CORRECT_ANSWER'),
    ON_WRONG_ANSWER: t('workshopEvt_ON_WRONG_ANSWER'),
    ON_COMPILE_ERROR: t('workshopEvt_ON_COMPILE_ERROR'),
    ON_OPPONENT_CORRECT: t('workshopEvt_ON_OPPONENT_CORRECT'),
    ON_OPPONENT_WRONG: t('workshopEvt_ON_OPPONENT_WRONG'),
    ON_TIMER_HALF: t('workshopEvt_ON_TIMER_HALF'),
    ON_TIMER_LOW: t('workshopEvt_ON_TIMER_LOW'),
    ON_BATTLE_START: t('workshopEvt_ON_BATTLE_START'),
    ON_HP_BELOW_50: t('workshopEvt_ON_HP_BELOW_50'),
    ON_HP_BELOW_25: t('workshopEvt_ON_HP_BELOW_25'),
  };

  const condLabels = {
    always: t('workshopCond_always'),
    hp_below: t('workshopCond_hp_below'),
    hp_above: t('workshopCond_hp_above'),
    opponent_hp_below: t('workshopCond_opponent_hp_below'),
    time_remaining_below: t('workshopCond_time_remaining_below'),
    solved_count_above: t('workshopCond_solved_count_above'),
    wrong_streak_above: t('workshopCond_wrong_streak_above'),
  };

  const actionLabels = {
    MODIFY_HP: t('workshopAct_MODIFY_HP'),
    SET_HP: t('workshopAct_SET_HP'),
    ADD_TIME: t('workshopAct_ADD_TIME'),
    GRANT_ITEM: t('workshopAct_GRANT_ITEM'),
    DOUBLE_DAMAGE: t('workshopAct_DOUBLE_DAMAGE'),
    FREEZE_OPPONENT: t('workshopAct_FREEZE_OPPONENT'),
    SHOW_MESSAGE: t('workshopAct_SHOW_MESSAGE'),
  };

  const targetLabels = {
    self: t('workshopTgt_self'),
    opponent: t('workshopTgt_opponent'),
    both: t('workshopTgt_both'),
  };

  const itemLabels = {
    shield: t('workshopItem_shield'),
    bomb: t('workshopItem_bomb'),
    heal: t('workshopItem_heal'),
    freeze: t('workshopItem_freeze'),
  };

  useEffect(() => {
    if (!id) return;
    let ignore = false;
    setLoading(true);
    api.get(`/battle-modes/${id}`)
      .then(({ data }) => {
        if (ignore) return;
        const mode = data.mode;
        setName(mode.name || '');
        setDescription(mode.description || '');
        setIsPublic(Boolean(mode.isPublic));
        setConfig({ ...DEFAULT_CONFIG, ...(mode.config || {}) });
      })
      .catch((err) => {
        toast?.show(err.response?.data?.message || t('workshopLoadError'), 'error');
        navigate('/workshop-gallery', { replace: true });
      })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [id, navigate, toast, t]);

  const previewLines = useMemo(() => rules.map((rule) => (
    `${eventLabels[rule.event] || rule.event} → ${conditionSentence(rule.condition, t, condLabels)} → ${actionSentence(rule.action, t, targetLabels, itemLabels)}`
  )), [rules, t, eventLabels, condLabels, targetLabels, itemLabels]);

  const updateConfig = (patch) => setConfig((prev) => ({ ...prev, ...patch }));

  const updateRule = (ruleId, patch) => {
    updateConfig({
      rules: rules.map((rule) => rule.id === ruleId ? { ...rule, ...patch } : rule),
    });
  };

  const updateRuleCondition = (ruleId, patch) => {
    updateConfig({
      rules: rules.map((rule) => (
        rule.id === ruleId ? { ...rule, condition: { ...rule.condition, ...patch } } : rule
      )),
    });
  };

  const updateRuleAction = (ruleId, patch) => {
    updateConfig({
      rules: rules.map((rule) => (
        rule.id === ruleId ? { ...rule, action: { ...rule.action, ...patch } } : rule
      )),
    });
  };

  const addRule = () => {
    if (rules.length >= 20) {
      toast?.show(t('workshopMaxRules'), 'warning');
      return;
    }
    updateConfig({ rules: [...rules, createRule(rules.length + 1)] });
  };

  const removeRule = (ruleId) => {
    updateConfig({ rules: rules.filter((rule) => rule.id !== ruleId) });
  };

  const save = async () => {
    if (!name.trim()) {
      toast?.show(t('workshopNameRequired'), 'warning');
      return;
    }
    setSaving(true);
    try {
      const payload = { name: name.trim(), description, isPublic, config };
      const { data } = id
        ? await api.put(`/battle-modes/${id}`, payload)
        : await api.post('/battle-modes', payload);
      toast?.show(t('workshopSaveSuccess'), 'success');
      navigate(`/workshop/${data.mode.id}`, { replace: true });
    } catch (err) {
      toast?.show(err.response?.data?.message || t('workshopSaveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className="workshop-page"><div className="workshop-loading">{t('loading')}</div></main>;
  }

  return (
    <main className="workshop-page">
      <header className="workshop-header">
        <div>
          <p>{t('workshopHeaderLabel')}</p>
          <h1>{id ? t('workshopEditTitle') : t('workshopCreateTitle')}</h1>
        </div>
        <div className="workshop-header-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/workshop-gallery')}>
            {t('workshopGalleryBtn')}
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? <span className="spinner" /> : <Save size={16} />} {t('save')}
          </button>
        </div>
      </header>

      <div className="workshop-layout">
        <section className="workshop-panel workshop-meta">
          <div className="workshop-section-title">{t('workshopMetaInfo')}</div>
          <label>
            {t('workshopNameLabel')}
            <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder={t('workshopNamePlaceholder')} />
          </label>
          <label>
            {t('workshopDescLabel')}
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('workshopDescPlaceholder')} />
          </label>
          <div className="workshop-grid-2">
            <label>
              {t('workshopBaseHp')}
              <input type="number" min="1" max="999" value={config.baseHp} onChange={(e) => updateConfig({ baseHp: Number(e.target.value) })} />
            </label>
            <label>
              {t('workshopTimeLimit')}
              <input type="number" min="60" max="7200" value={config.timeLimit} onChange={(e) => updateConfig({ timeLimit: Number(e.target.value) })} />
            </label>
          </div>
          <label className="workshop-check">
            <input type="checkbox" checked={config.allowItems} onChange={(e) => updateConfig({ allowItems: e.target.checked })} />
            {t('workshopAllowItems')}
          </label>
          <label className="workshop-check">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            {t('workshopPublish')}
          </label>

          <div className="workshop-section-title preview-title"><Eye size={16} /> {t('workshopPreviewLabel')}</div>
          <div className="workshop-preview">
            {previewLines.length
              ? previewLines.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)
              : <span>{t('workshopNoRules')}</span>}
          </div>
        </section>

        <section className="workshop-panel workshop-rules">
          <div className="workshop-rules-head">
            <div>
              <div className="workshop-section-title">{t('workshopRulesBuilder')}</div>
              <p>{withVars(t('workshopRulesCount'), { n: rules.length })}</p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={addRule}>
              <Plus size={16} /> {t('workshopAddRule')}
            </button>
          </div>

          {rules.length === 0 && (
            <div className="workshop-empty">
              {t('workshopEmptyRules')}
            </div>
          )}

          <div className="workshop-rule-list">
            {rules.map((rule, index) => (
              <article className="workshop-rule-card" key={rule.id}>
                <div className="workshop-rule-title">
                  <strong>{withVars(t('workshopRuleNum'), { n: index + 1 })}</strong>
                  <button type="button" onClick={() => removeRule(rule.id)} aria-label={t('workshopDeleteRule')}>
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="workshop-form-row">
                  <label>
                    {t('workshopEventLabel')}
                    <select value={rule.event} onChange={(e) => updateRule(rule.id, { event: e.target.value })}>
                      {Object.entries(eventLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label>
                    {t('workshopConditionLabel')}
                    <select value={rule.condition?.type || 'always'} onChange={(e) => updateRule(rule.id, { condition: defaultCondition(e.target.value) })}>
                      {Object.entries(condLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  {rule.condition?.type !== 'always' && (
                    <label>
                      {t('workshopCondValueLabel')}
                      <input type="number" value={rule.condition?.value ?? 0} onChange={(e) => updateRuleCondition(rule.id, { value: Number(e.target.value) })} />
                    </label>
                  )}
                </div>

                <div className="workshop-form-row">
                  <label>
                    {t('workshopActionLabel')}
                    <select value={rule.action?.type || 'MODIFY_HP'} onChange={(e) => updateRule(rule.id, { action: defaultAction(e.target.value) })}>
                      {Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>

                  {['MODIFY_HP', 'SET_HP'].includes(rule.action?.type) && (
                    <>
                      <label>
                        {t('workshopTargetLabel')}
                        <select value={rule.action.target || 'self'} onChange={(e) => updateRuleAction(rule.id, { target: e.target.value })}>
                          {Object.entries(targetLabels)
                            .filter(([value]) => rule.action.type === 'MODIFY_HP' || value !== 'both')
                            .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>
                      <label>
                        {t('workshopHpValueLabel')}
                        <input type="number" value={rule.action.value ?? 0} onChange={(e) => updateRuleAction(rule.id, { value: Number(e.target.value) })} />
                      </label>
                    </>
                  )}

                  {rule.action?.type === 'ADD_TIME' && (
                    <label>
                      {t('workshopTimeSecLabel')}
                      <input type="number" value={rule.action.value ?? 0} onChange={(e) => updateRuleAction(rule.id, { value: Number(e.target.value) })} />
                    </label>
                  )}

                  {rule.action?.type === 'GRANT_ITEM' && (
                    <label>
                      {t('workshopItemLabel')}
                      <select value={rule.action.item || 'shield'} onChange={(e) => updateRuleAction(rule.id, { item: e.target.value })}>
                        {Object.entries(itemLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                  )}

                  {['DOUBLE_DAMAGE', 'FREEZE_OPPONENT'].includes(rule.action?.type) && (
                    <label>
                      {t('workshopDurationLabel')}
                      <input type="number" min="1" max="600" value={rule.action.duration ?? 1} onChange={(e) => updateRuleAction(rule.id, { duration: Number(e.target.value) })} />
                    </label>
                  )}

                  {rule.action?.type === 'SHOW_MESSAGE' && (
                    <label className="wide">
                      {t('workshopMessageLabel')}
                      <input value={rule.action.text || ''} maxLength={120} onChange={(e) => updateRuleAction(rule.id, { text: e.target.value })} />
                    </label>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
