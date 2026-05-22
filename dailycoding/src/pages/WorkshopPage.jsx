import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, Plus, Save, Trash2 } from 'lucide-react';
import api from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import './WorkshopPage.css';

const EVENT_LABELS = {
  ON_CORRECT_ANSWER: '정답 제출 시',
  ON_WRONG_ANSWER: '오답 제출 시',
  ON_COMPILE_ERROR: '컴파일 오류 시',
  ON_OPPONENT_CORRECT: '상대방 정답 시',
  ON_OPPONENT_WRONG: '상대방 오답 시',
  ON_TIMER_HALF: '시간 절반 경과 시',
  ON_TIMER_LOW: '시간 60초 미만 시',
  ON_BATTLE_START: '배틀 시작 시',
  ON_HP_BELOW_50: '내 HP 50 미만 시',
  ON_HP_BELOW_25: '내 HP 25 미만 시',
};

const CONDITION_LABELS = {
  always: '항상',
  hp_below: '내 HP 미만',
  hp_above: '내 HP 초과',
  opponent_hp_below: '상대 HP 미만',
  time_remaining_below: '남은 시간 미만',
  solved_count_above: '해결 수 초과',
  wrong_streak_above: '연속 오답 초과',
};

const ACTION_LABELS = {
  MODIFY_HP: 'HP 변경',
  SET_HP: 'HP 설정',
  ADD_TIME: '시간 추가/감소',
  GRANT_ITEM: '아이템 지급',
  DOUBLE_DAMAGE: '데미지 2배',
  FREEZE_OPPONENT: '상대방 타이머 정지',
  SHOW_MESSAGE: '메시지 표시',
};

const TARGET_LABELS = {
  self: '자신',
  opponent: '상대방',
  both: '양쪽',
};

const ITEM_LABELS = {
  shield: '방어막',
  bomb: '폭탄',
  heal: '회복',
  freeze: '정지',
};

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
  return { type, text: '워크샵 효과 발동!' };
}

function conditionSentence(condition) {
  if (!condition || condition.type === 'always') return '항상';
  const label = CONDITION_LABELS[condition.type] || condition.type;
  const suffix = condition.type === 'time_remaining_below' ? '초' : '';
  return `${label} ${condition.value}${suffix}`;
}

function actionSentence(action) {
  if (!action) return '';
  if (action.type === 'MODIFY_HP') {
    const sign = Number(action.value) >= 0 ? '+' : '';
    return `${TARGET_LABELS[action.target] || action.target} HP ${sign}${action.value}`;
  }
  if (action.type === 'SET_HP') return `${TARGET_LABELS[action.target] || action.target} HP를 ${action.value}로 설정`;
  if (action.type === 'ADD_TIME') {
    const sign = Number(action.value) >= 0 ? '+' : '';
    return `남은 시간 ${sign}${action.value}초`;
  }
  if (action.type === 'GRANT_ITEM') return `${ITEM_LABELS[action.item] || action.item} 아이템 지급`;
  if (action.type === 'DOUBLE_DAMAGE') return `${action.duration}초 동안 데미지 2배`;
  if (action.type === 'FREEZE_OPPONENT') return `${action.duration}초 동안 상대 타이머 정지`;
  return `"${action.text || ''}" 메시지 표시`;
}

export default function WorkshopPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  const rules = config.rules || [];

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
        toast?.show(err.response?.data?.message || '워크샵 모드를 불러오지 못했습니다.', 'error');
        navigate('/workshop-gallery', { replace: true });
      })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [id, navigate, toast]);

  const previewLines = useMemo(() => rules.map((rule) => (
    `${EVENT_LABELS[rule.event] || rule.event} → ${conditionSentence(rule.condition)} → ${actionSentence(rule.action)}`
  )), [rules]);

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
      toast?.show('룰은 최대 20개까지 만들 수 있습니다.', 'warning');
      return;
    }
    updateConfig({ rules: [...rules, createRule(rules.length + 1)] });
  };

  const removeRule = (ruleId) => {
    updateConfig({ rules: rules.filter((rule) => rule.id !== ruleId) });
  };

  const save = async () => {
    if (!name.trim()) {
      toast?.show('모드 이름을 입력해 주세요.', 'warning');
      return;
    }
    setSaving(true);
    try {
      const payload = { name: name.trim(), description, isPublic, config };
      const { data } = id
        ? await api.put(`/battle-modes/${id}`, payload)
        : await api.post('/battle-modes', payload);
      toast?.show('워크샵 모드를 저장했습니다.', 'success');
      navigate(`/workshop/${data.mode.id}`, { replace: true });
    } catch (err) {
      toast?.show(err.response?.data?.message || '워크샵 모드를 저장하지 못했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className="workshop-page"><div className="workshop-loading">불러오는 중...</div></main>;
  }

  return (
    <main className="workshop-page">
      <header className="workshop-header">
        <div>
          <p>배틀 워크샵</p>
          <h1>{id ? '워크샵 모드 수정' : '워크샵 모드 만들기'}</h1>
        </div>
        <div className="workshop-header-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/workshop-gallery')}>
            갤러리
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? <span className="spinner" /> : <Save size={16} />} 저장
          </button>
        </div>
      </header>

      <div className="workshop-layout">
        <section className="workshop-panel workshop-meta">
          <div className="workshop-section-title">모드 정보</div>
          <label>
            이름
            <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="체력 회복 모드" />
          </label>
          <label>
            설명
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="정답 시 체력 회복, 오답 시 체력 감소" />
          </label>
          <div className="workshop-grid-2">
            <label>
              기본 HP
              <input type="number" min="1" max="999" value={config.baseHp} onChange={(e) => updateConfig({ baseHp: Number(e.target.value) })} />
            </label>
            <label>
              제한 시간(초)
              <input type="number" min="60" max="7200" value={config.timeLimit} onChange={(e) => updateConfig({ timeLimit: Number(e.target.value) })} />
            </label>
          </div>
          <label className="workshop-check">
            <input type="checkbox" checked={config.allowItems} onChange={(e) => updateConfig({ allowItems: e.target.checked })} />
            아이템 사용 허용
          </label>
          <label className="workshop-check">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            공개 갤러리에 게시
          </label>

          <div className="workshop-section-title preview-title"><Eye size={16} /> 미리보기</div>
          <div className="workshop-preview">
            {previewLines.length
              ? previewLines.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)
              : <span>아직 룰이 없습니다.</span>}
          </div>
        </section>

        <section className="workshop-panel workshop-rules">
          <div className="workshop-rules-head">
            <div>
              <div className="workshop-section-title">룰 빌더</div>
              <p>{rules.length}/20개 룰</p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={addRule}>
              <Plus size={16} /> 룰 추가
            </button>
          </div>

          {rules.length === 0 && (
            <div className="workshop-empty">
              이벤트, 조건, 액션을 조합해 첫 룰을 만들어 보세요.
            </div>
          )}

          <div className="workshop-rule-list">
            {rules.map((rule, index) => (
              <article className="workshop-rule-card" key={rule.id}>
                <div className="workshop-rule-title">
                  <strong>룰 {index + 1}</strong>
                  <button type="button" onClick={() => removeRule(rule.id)} aria-label="룰 삭제">
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="workshop-form-row">
                  <label>
                    이벤트
                    <select value={rule.event} onChange={(e) => updateRule(rule.id, { event: e.target.value })}>
                      {Object.entries(EVENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label>
                    조건
                    <select value={rule.condition?.type || 'always'} onChange={(e) => updateRule(rule.id, { condition: defaultCondition(e.target.value) })}>
                      {Object.entries(CONDITION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  {rule.condition?.type !== 'always' && (
                    <label>
                      조건 값
                      <input type="number" value={rule.condition?.value ?? 0} onChange={(e) => updateRuleCondition(rule.id, { value: Number(e.target.value) })} />
                    </label>
                  )}
                </div>

                <div className="workshop-form-row">
                  <label>
                    액션
                    <select value={rule.action?.type || 'MODIFY_HP'} onChange={(e) => updateRule(rule.id, { action: defaultAction(e.target.value) })}>
                      {Object.entries(ACTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>

                  {['MODIFY_HP', 'SET_HP'].includes(rule.action?.type) && (
                    <>
                      <label>
                        대상
                        <select value={rule.action.target || 'self'} onChange={(e) => updateRuleAction(rule.id, { target: e.target.value })}>
                          {Object.entries(TARGET_LABELS)
                            .filter(([value]) => rule.action.type === 'MODIFY_HP' || value !== 'both')
                            .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>
                      <label>
                        HP 값
                        <input type="number" value={rule.action.value ?? 0} onChange={(e) => updateRuleAction(rule.id, { value: Number(e.target.value) })} />
                      </label>
                    </>
                  )}

                  {rule.action?.type === 'ADD_TIME' && (
                    <label>
                      시간(초)
                      <input type="number" value={rule.action.value ?? 0} onChange={(e) => updateRuleAction(rule.id, { value: Number(e.target.value) })} />
                    </label>
                  )}

                  {rule.action?.type === 'GRANT_ITEM' && (
                    <label>
                      아이템
                      <select value={rule.action.item || 'shield'} onChange={(e) => updateRuleAction(rule.id, { item: e.target.value })}>
                        {Object.entries(ITEM_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                  )}

                  {['DOUBLE_DAMAGE', 'FREEZE_OPPONENT'].includes(rule.action?.type) && (
                    <label>
                      지속 시간(초)
                      <input type="number" min="1" max="600" value={rule.action.duration ?? 1} onChange={(e) => updateRuleAction(rule.id, { duration: Number(e.target.value) })} />
                    </label>
                  )}

                  {rule.action?.type === 'SHOW_MESSAGE' && (
                    <label className="wide">
                      메시지
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
