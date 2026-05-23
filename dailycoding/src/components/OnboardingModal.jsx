import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LangContext.jsx';

function getSteps(txt) {
  return [
    {
      title: txt('티어 시스템', 'Tier System'),
      badge: '01',
      body: txt(
        '아이언부터 챌린저까지 11개의 티어가 있습니다. 문제를 풀어 실력을 키우고 승급전으로 다음 티어에 도전하세요.',
        'DailyCoding features 11 tiers from iron to challenger. Solve problems to improve your skills and challenge the next tier through promotion matches.',
      ),
      visual: 'iron → bronze → silver → gold → diamond → challenger',
    },
    {
      title: txt('배틀 모드', 'Battle Mode'),
      badge: '02',
      body: txt(
        '실시간 1v1 알고리즘 배틀에서 HP·아이템·문제 효과를 활용해 상대보다 빠르게 정답을 제출하세요.',
        'In real-time 1v1 algorithm battles, use HP, items, and problem effects to submit correct answers faster than your opponent.',
      ),
      visual: txt('라이브 매칭 · 코드 제출 · 즉시 판정', 'Live Matching · Code Submission · Instant Verdict'),
    },
    {
      title: txt('시작하기', 'Get Started'),
      badge: '03',
      body: txt(
        '첫 문제를 풀면 DailyCoding이 대시보드 추천·오답 복습·태그 숙련도 추적으로 나만의 학습 루틴을 자동으로 만들어 드립니다.',
        'Solve your first problem and let DailyCoding automatically build a personalized learning routine with dashboard recommendations, wrong-answer reviews, and tag proficiency tracking.',
      ),
      visual: txt('추천 문제에서 바로 시작', 'Start directly from recommended problems'),
    },
  ];
}

export default function OnboardingModal({ open, onComplete, onSkip }) {
  const [step, setStep] = useState(0);
  const { lang } = useLang();
  const txt = (ko, en) => lang === 'ko' ? ko : en;

  if (!open) return null;

  const STEPS = getSteps(txt);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return createPortal(
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(0,0,0,.68)',
      display: 'grid',
      placeItems: 'center',
      padding: 20,
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="onboarding-title" style={{
        width: 'min(640px, 100%)',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 22,
        boxShadow: '0 30px 90px rgba(0,0,0,.48)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '26px 28px', borderBottom: '1px solid var(--border)', background: 'var(--glass-bg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <span style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              display: 'grid',
              placeItems: 'center',
              background: 'rgba(88,166,255,.12)',
              color: 'var(--blue)',
              border: '1px solid rgba(88,166,255,.28)',
              fontWeight: 900,
            }}>
              {current.badge}
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onSkip}>{txt('건너뛰기', 'Skip')}</button>
          </div>
          <h2 id="onboarding-title" style={{ fontSize: 28, fontWeight: 900, margin: '18px 0 8px' }}>{current.title}</h2>
          <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.75, margin: 0 }}>{current.body}</p>
        </div>

        <div style={{ padding: '24px 28px 28px' }}>
          <div style={{
            padding: '18px 20px',
            borderRadius: 16,
            background: 'var(--glass-bg)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            fontWeight: 800,
            marginBottom: 20,
          }}>
            {current.visual}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
            {STEPS.map((item, index) => (
              <span key={item.title} style={{
                height: 5,
                flex: 1,
                borderRadius: 999,
                background: index <= step ? 'var(--blue)' : 'var(--bg3)',
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost" disabled={step === 0} onClick={() => setStep((prev) => Math.max(0, prev - 1))}>
              {txt('이전', 'Back')}
            </button>
            {isLast ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <Link to="/problems" className="btn btn-ghost" style={{ textDecoration: 'none' }} onClick={onComplete}>{txt('문제 목록 보기', 'View Problems')}</Link>
                <Link to="/judge" className="btn btn-primary" style={{ textDecoration: 'none' }} onClick={onComplete}>{txt('시작하기', 'Get Started')}</Link>
              </div>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => setStep((prev) => Math.min(STEPS.length - 1, prev + 1))}>
                {txt('다음', 'Next')}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}
