import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus.js';
import { useSubscriptionCheckout } from '../hooks/useSubscriptionCheckout.js';
import { useToast } from '../context/ToastContext.jsx';
import { formatPlanPrice, getPlanList, PRICING_FAQ } from '../data/pricingPlans.js';

export default function PricingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { tier: currentTier } = useSubscriptionStatus(user?.id);
  const { loadingPlan, startCheckout } = useSubscriptionCheckout();
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const [openFaq, setOpenFaq] = useState(null);
  const plans = useMemo(() => getPlanList(), []);

  const pricingSummary = useMemo(() => (
    plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      value: billingPeriod === 'monthly' ? plan.monthlyPrice : plan.annualPrice,
      suffix: billingPeriod === 'monthly' ? '/월' : '/년',
      accent: plan.accent,
    }))
  ), [billingPeriod, plans]);

  const handleUpgrade = async (planId) => {
    if (planId === 'free' || planId === currentTier) return;
    if (!user) {
      sessionStorage.setItem('postLoginRedirect', '/pricing');
      navigate('/login', { state: { mode: 'register' } });
      return;
    }
    const result = await startCheckout(planId, billingPeriod);
    if (!result.ok) {
      toast?.show(result.reason || '결제 페이지를 여는 데 실패했습니다.', 'error');
    }
  };

  return (
    <div style={{ minHeight: '100%', overflowY: 'auto', background: 'radial-gradient(circle at top, rgba(121,192,255,.12), transparent 28%), var(--bg)' }}>
      <div style={{ maxWidth: 1260, margin: '0 auto', padding: '28px 24px 64px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text3)',
            cursor: 'pointer',
            fontSize: 13,
            fontFamily: 'inherit',
            marginBottom: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          ← 돌아가기
        </button>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, .85fr)',
            gap: 20,
            alignItems: 'stretch',
            marginBottom: 22,
          }}
        >
          <div
            style={{
              padding: '28px 28px 24px',
              borderRadius: 28,
              background: 'linear-gradient(145deg, rgba(121,192,255,.12), rgba(13,17,23,.92))',
              border: '1px solid rgba(121,192,255,.16)',
              boxShadow: '0 24px 60px rgba(0,0,0,.22)',
            }}
          >
            <div style={{ display: 'inline-flex', padding: '7px 12px', borderRadius: 999, background: 'rgba(121,192,255,.12)', border: '1px solid rgba(121,192,255,.22)', color: 'var(--blue)', fontWeight: 800, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>
              Pricing Overview
            </div>
            <h1 style={{ fontSize: 'clamp(32px, 5vw, 54px)', lineHeight: 1.05, letterSpacing: '-0.04em', fontWeight: 900, marginBottom: 12 }}>
              요금제가
              <br />
              <span className="gradient-text">한눈에 보이게</span> 정리됐습니다
            </h1>
            <p style={{ color: 'var(--text2)', fontSize: 16, lineHeight: 1.75, maxWidth: 620, marginBottom: 18 }}>
              지금은 프로 월 $5 / 연 $50, 팀 월 $10 / 연 $100 기준입니다.
              카드 세 장이 첫 화면에 함께 보이도록 재구성했고, 결제는 Stripe 실설정 기준으로 연결됩니다.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button className="btn btn-primary" onClick={() => handleUpgrade('pro')} disabled={loadingPlan === 'pro' || currentTier === 'pro'}>
                프로 바로 선택
              </button>
              <button className="btn btn-ghost" onClick={() => handleUpgrade('team')} disabled={loadingPlan === 'team' || currentTier === 'team'}>
                팀 플랜 보기
              </button>
            </div>
          </div>

          <div
            style={{
              padding: '18px',
              borderRadius: 28,
              background: 'rgba(13,17,23,.9)',
              border: '1px solid var(--border)',
              display: 'grid',
              gap: 12,
              alignContent: 'start',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Billing</div>
                <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>결제 주기</div>
              </div>
              <div style={{ display: 'flex', padding: 4, borderRadius: 999, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                <button
                  onClick={() => setBillingPeriod('monthly')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 999,
                    border: 'none',
                    cursor: 'pointer',
                    background: billingPeriod === 'monthly' ? 'var(--bg3)' : 'transparent',
                    color: billingPeriod === 'monthly' ? 'var(--text)' : 'var(--text3)',
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  월간
                </button>
                <button
                  onClick={() => setBillingPeriod('annual')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 999,
                    border: 'none',
                    cursor: 'pointer',
                    background: billingPeriod === 'annual' ? 'var(--bg3)' : 'transparent',
                    color: billingPeriod === 'annual' ? 'var(--text)' : 'var(--text3)',
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  연간
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {pricingSummary.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '88px minmax(0, 1fr) auto',
                    gap: 12,
                    alignItems: 'center',
                    padding: '12px 14px',
                    borderRadius: 18,
                    background: 'var(--bg2)',
                    border: `1px solid ${item.accent}30`,
                  }}
                >
                  <div style={{ color: item.accent, fontSize: 12, fontWeight: 900, letterSpacing: '.08em' }}>{item.name}</div>
                  <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
                    <div style={{ width: item.value === 0 ? '18%' : item.id === 'team' ? '100%' : '62%', height: '100%', borderRadius: 999, background: item.accent }} />
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>
                    {formatPlanPrice(item.value)}
                    {item.value > 0 && <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 4 }}>{item.suffix}</span>}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: '12px 14px', borderRadius: 18, background: 'linear-gradient(135deg, rgba(63,185,80,.14), rgba(121,192,255,.12))', border: '1px solid rgba(63,185,80,.22)', color: 'var(--text2)', fontSize: 13, lineHeight: 1.7 }}>
              연간 결제 시 월간 대비 약 17% 절약됩니다.
              프로는 2개월 무료에 가까운 가격 구조이고, 팀은 운영 단가를 더 낮추는 방향입니다.
            </div>
          </div>
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 18,
            alignItems: 'stretch',
            marginBottom: 30,
          }}
        >
          {plans.map((plan) => {
            const price = billingPeriod === 'monthly' ? plan.monthlyPrice : plan.annualPrice;
            const suffix = billingPeriod === 'monthly' ? '/월' : '/년';
            return (
              <div
                key={plan.id}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 520,
                  padding: '24px 22px 22px',
                  borderRadius: 28,
                  background: plan.panel,
                  border: `1px solid ${plan.highlight ? `${plan.accent}60` : 'var(--border)'}`,
                  boxShadow: plan.highlight ? `0 18px 44px ${plan.accent}20` : '0 14px 32px rgba(0,0,0,.18)',
                }}
              >
                {plan.highlight && (
                  <div style={{ position: 'absolute', top: 14, right: 14, padding: '5px 10px', borderRadius: 999, background: plan.accent, color: '#0d1117', fontSize: 11, fontWeight: 900 }}>
                    추천
                  </div>
                )}
                <div style={{ fontSize: 11, color: plan.accent, letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 900, marginBottom: 8 }}>
                  {plan.eyebrow}
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, marginBottom: 6 }}>{plan.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                  <span style={{ fontSize: 42, fontWeight: 900, lineHeight: 1 }}>
                    {formatPlanPrice(price)}
                  </span>
                  {price > 0 && <span style={{ color: 'var(--text3)', fontSize: 14 }}>{suffix}</span>}
                </div>
                <div style={{ color: 'var(--text2)', lineHeight: 1.65, minHeight: 48, marginBottom: 14 }}>
                  {plan.desc}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                  {plan.summary.map((item) => (
                    <span key={item} style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(255,255,255,.06)', border: `1px solid ${plan.accent}30`, color: 'var(--text2)', fontSize: 12, fontWeight: 700 }}>
                      {item}
                    </span>
                  ))}
                </div>

                <div style={{ flex: 1, display: 'grid', gap: 10, marginBottom: 20 }}>
                  {plan.features.map((feature) => (
                    <div key={feature.label} style={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr)', gap: 10, alignItems: 'start', opacity: feature.included ? 1 : 0.46 }}>
                      <span style={{ color: feature.included ? plan.accent : 'var(--text3)', fontWeight: 900 }}>
                        {feature.included ? '✦' : '○'}
                      </span>
                      <span style={{ color: feature.included ? 'var(--text)' : 'var(--text3)', textDecoration: feature.included ? 'none' : 'line-through', lineHeight: 1.5 }}>
                        {feature.label}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={plan.id === currentTier || loadingPlan === plan.id}
                  style={{
                    width: '100%',
                    padding: '14px 0',
                    borderRadius: 16,
                    border: 'none',
                    cursor: plan.id === currentTier ? 'default' : 'pointer',
                    fontSize: 15,
                    fontWeight: 900,
                    fontFamily: 'inherit',
                    background: plan.id === currentTier ? 'var(--bg3)' : plan.highlight ? plan.accent : 'var(--bg3)',
                    color: plan.id === currentTier ? 'var(--text3)' : plan.highlight ? '#0d1117' : plan.accent,
                    boxShadow: plan.highlight ? `0 10px 24px ${plan.accent}35` : 'none',
                  }}
                >
                  {loadingPlan === plan.id
                    ? '이동 중...'
                    : plan.id === currentTier
                      ? '현재 이용 중'
                      : plan.id === 'free'
                        ? '무료로 시작'
                        : user
                          ? (billingPeriod === 'annual' ? '연간 플랜 시작' : '이 플랜 선택')
                          : '회원가입 후 시작'}
                </button>
              </div>
            );
          })}
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.05fr) minmax(300px, .95fr)',
            gap: 18,
            alignItems: 'start',
          }}
        >
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 26, padding: '24px 22px' }}>
            <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>자주 묻는 질문</div>
            <div style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 20 }}>결제 전에 많이 확인하는 항목만 짧게 정리했습니다.</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {PRICING_FAQ.map((item, index) => {
                const open = openFaq === index;
                return (
                  <div key={item.q} style={{ border: '1px solid var(--border)', borderRadius: 18, background: 'var(--bg3)', overflow: 'hidden' }}>
                    <button
                      onClick={() => setOpenFaq(open ? null : index)}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '16px 18px',
                        textAlign: 'left',
                        fontSize: 14,
                        fontWeight: 800,
                        color: 'var(--text)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 16,
                      }}
                    >
                      <span>{item.q}</span>
                      <span style={{ color: 'var(--text3)', fontSize: 18 }}>{open ? '−' : '+'}</span>
                    </button>
                    {open && (
                      <div style={{ padding: '0 18px 18px', color: 'var(--text2)', fontSize: 13, lineHeight: 1.7 }}>
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ padding: '22px 20px', borderRadius: 26, background: 'linear-gradient(145deg, rgba(121,192,255,.12), rgba(13,17,23,.96))', border: '1px solid rgba(121,192,255,.18)' }}>
              <div style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>Risk Control</div>
              <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 10 }}>결제 리스크도 같이 정리했습니다</div>
              <div style={{ display: 'grid', gap: 10, color: 'var(--text2)', fontSize: 13, lineHeight: 1.7 }}>
                <div>실제 Stripe 시크릿과 웹훅은 추적 파일이 아니라 로컬 `.env`에만 반영했습니다.</div>
                <div>Price ID와 결제 링크 fallback을 같이 유지해서 운영/테스트 경로를 분리했습니다.</div>
                <div>쿠키 기반 인증으로 바뀐 상태라 결제 후 프로필 복귀 흐름도 더 안정적입니다.</div>
              </div>
            </div>

            <div style={{ padding: '20px', borderRadius: 26, background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text3)', fontSize: 13, lineHeight: 1.8 }}>
              모든 유료 플랜은 <strong style={{ color: 'var(--text)' }}>결제 후 7일 이내 전액 환불</strong> 요청이 가능합니다.
              <br />
              문의: <a href="mailto:choijunhuk2007@gmail.com" style={{ color: 'var(--blue)' }}>choijunhuk2007@gmail.com</a>
              {' · '}
              <button
                onClick={() => navigate('/terms')}
                style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: 0 }}
              >
                이용약관
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
