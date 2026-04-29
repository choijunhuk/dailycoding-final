import { useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../api.js';
import { useLang } from '../context/LangContext.jsx';

const GOALS = [
  { id: 'job_hunting', labelKey: 'goalJobHunting', emoji: '🎯', descKey: 'goalJobHuntingDesc' },
  { id: 'skill_up', labelKey: 'goalSkillUp', emoji: '📈', descKey: 'goalSkillUpDesc' },
  { id: 'interview_prep', labelKey: 'goalInterviewPrep', emoji: '💼', descKey: 'goalInterviewPrepDesc' },
  { id: 'fun', labelKey: 'goalFun', emoji: '🎮', descKey: 'goalFunDesc' },
];

const LEVELS = [
  { id: 'beginner', labelKey: 'onboardingBeginner', descKey: 'onboardingBeginnerDesc' },
  { id: 'intermediate', labelKey: 'onboardingIntermediate', descKey: 'onboardingIntermediateDesc' },
  { id: 'advanced', labelKey: 'onboardingAdvanced', descKey: 'onboardingAdvancedDesc' },
];

export default function OnboardingModal({ open, onComplete }) {
  const { t } = useLang();
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const saveStep = async (nextStep) => {
    setSaving(true);
    try {
      await api.patch('/onboarding', {
        step: nextStep,
        goal,
        targetCompany,
        experienceLevel,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await api.patch('/onboarding', {
        step: 'done',
        goal,
        targetCompany,
        experienceLevel,
      });
      onComplete?.();
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,.72)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        width: 'min(860px, 100%)',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        padding: '32px 28px',
        boxShadow: '0 30px 80px rgba(0,0,0,.45)',
      }}>
        {step === 1 && (
          <div style={{ textAlign: 'center', padding: '20px 10px' }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>{t('onboardingGoalTitle')}</h2>
            <p style={{ color: 'var(--text2)', marginBottom: 24 }}>{t('onboardingGoalDesc')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {GOALS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setGoal(item.id)}
                  style={{
                    padding: '20px',
                    borderRadius: 12,
                    border: `2px solid ${goal === item.id ? 'var(--blue)' : 'var(--border)'}`,
                    background: goal === item.id ? 'rgba(88,166,255,.08)' : 'var(--bg2)',
                    cursor: 'pointer',
                    color: 'var(--text)',
                  }}
                >
                  <div style={{ fontSize: 32 }}>{item.emoji}</div>
                  <div style={{ fontWeight: 700, marginTop: 8 }}>{t(item.labelKey)}</div>
                  <div style={{ color: 'var(--text3)', fontSize: 13 }}>{t(item.descKey)}</div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                className="btn btn-primary"
                disabled={!goal || saving}
                onClick={async () => {
                  await saveStep('select_level');
                  setStep(2);
                }}
              >
                {t('next')}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ textAlign: 'center', padding: '20px 10px' }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>{t('onboardingLevelTitle')}</h2>
            <p style={{ color: 'var(--text2)', marginBottom: 24 }}>{t('onboardingLevelDesc')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {LEVELS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setExperienceLevel(item.id)}
                  style={{
                    padding: '20px',
                    borderRadius: 12,
                    border: `2px solid ${experienceLevel === item.id ? 'var(--blue)' : 'var(--border)'}`,
                    background: experienceLevel === item.id ? 'rgba(88,166,255,.08)' : 'var(--bg2)',
                    cursor: 'pointer',
                    color: 'var(--text)',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{t(item.labelKey)}</div>
                  <div style={{ color: 'var(--text3)', fontSize: 13, lineHeight: 1.5 }}>{t(item.descKey)}</div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>{t('prev')}</button>
              <button
                className="btn btn-primary"
                disabled={!experienceLevel || saving}
                onClick={async () => {
                  await saveStep('select_company');
                  setStep(3);
                }}
              >
                {t('next')}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '20px 10px' }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>{t('onboardingCompanyTitle')}</h2>
            <p style={{ color: 'var(--text2)', marginBottom: 24 }}>{t('onboardingCompanyDesc')}</p>
            <input
              value={targetCompany}
              onChange={(event) => setTargetCompany(event.target.value)}
              placeholder={t('onboardingCompanyPlaceholder')}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--bg2)',
                color: 'var(--text)',
                fontSize: 14,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setStep(2)}>{t('prev')}</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" disabled={saving} onClick={handleFinish}>{t('skip')}</button>
                <button className="btn btn-primary" disabled={saving} onClick={handleFinish}>
                  {saving ? t('saving') : t('getStarted')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
