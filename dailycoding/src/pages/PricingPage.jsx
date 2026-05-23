import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus.js';
import { useSubscriptionCheckout } from '../hooks/useSubscriptionCheckout.js';
import { useToast } from '../context/ToastContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { formatPlanPrice, getPlanList, getPricingFaq } from '../data/pricingPlans.js';

export default function PricingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { t, lang, toggleLang } = useLang();
  const { tier: currentTier } = useSubscriptionStatus(user?.id);
  const { loadingPlan, startCheckout } = useSubscriptionCheckout();
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const [openFaq, setOpenFaq] = useState(null);
  const plans = useMemo(() => getPlanList(lang), [lang]);
  const pricingFaq = useMemo(() => getPricingFaq(lang), [lang]);

  const pricingSummary = useMemo(() => (
    plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      value: billingPeriod === 'monthly' ? plan.monthlyPrice : plan.annualPrice,
      suffix: billingPeriod === 'monthly' ? t('pricingSufMonth') : t('pricingSufYear'),
      accent: plan.accent,
    }))
  ), [billingPeriod, plans, t]);

  const handleUpgrade = async (planId) => {
    if (planId === 'free' || planId === currentTier) return;
    if (!user) {
      sessionStorage.setItem('postLoginRedirect', '/pricing');
      navigate('/login', { state: { mode: 'register' } });
      return;
    }
    const result = await startCheckout(planId, billingPeriod);
    if (!result.ok) {
      toast?.show(result.reason || t('pricingCheckoutError'), 'error');
    }
  };

  return (
    <div style={{ minHeight: '100%', overflowY: 'auto', background: 'radial-gradient(circle at top, rgba(121,192,255,.12), transparent 28%), var(--bg)' }}>
      <div style={{ maxWidth: 1260, margin: '0 auto', padding: '28px 24px 64px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text3)',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {t('pricingBack')}
          </button>
          <button className="btn btn-ghost" onClick={toggleLang} style={{ fontWeight: 700, fontSize: 12 }}>
            {lang === 'ko' ? 'EN' : 'KO'}
          </button>
        </div>

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
              {t('pricingOverviewLabel')}
            </div>
            <h1 style={{ fontSize: 'clamp(32px, 5vw, 54px)', lineHeight: 1.05, letterSpacing: '-0.04em', fontWeight: 900, marginBottom: 12 }}>
              {t('pricingTitle')}
              <br />
              <span className="gradient-text">{t('pricingSubtitleHighlight')}</span>
            </h1>
            <p style={{ color: 'var(--text2)', fontSize: 16, lineHeight: 1.75, maxWidth: 620, marginBottom: 18 }}>
              {t('pricingDesc')}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button className="btn btn-primary" onClick={() => handleUpgrade('pro')} disabled={loadingPlan === 'pro' || currentTier === 'pro'}>
                {t('pricingStartPro')}
              </button>
              <button className="btn btn-ghost" onClick={() => handleUpgrade('team')} disabled={loadingPlan === 'team' || currentTier === 'team'}>
                {t('pricingViewTeam')}
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
                <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{t('pricingBillingLabel')}</div>
                <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>{t('pricingBillingCycle')}</div>
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
                  {t('pricingMonthly')}
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
                  {t('pricingAnnual')}
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
                    {formatPlanPrice(item.value, lang)}
                    {item.value > 0 && <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 4 }}>{item.suffix}</span>}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: '12px 14px', borderRadius: 18, background: 'linear-gradient(135deg, rgba(63,185,80,.14), rgba(121,192,255,.12))', border: '1px solid rgba(63,185,80,.22)', color: 'var(--text2)', fontSize: 13, lineHeight: 1.7 }}>
              {t('pricingSavings')}
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
            const suffix = billingPeriod === 'monthly' ? t('pricingSufMonth') : t('pricingSufYear');
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
                    {t('pricingRecommended')}
                  </div>
                )}
                <div style={{ fontSize: 11, color: plan.accent, letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 900, marginBottom: 8 }}>
                  {plan.eyebrow}
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, marginBottom: 6 }}>{plan.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                  <span style={{ fontSize: 42, fontWeight: 900, lineHeight: 1 }}>
                    {formatPlanPrice(price, lang)}
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
                    ? t('pricingLoadingPlan')
                    : plan.id === currentTier
                      ? t('pricingCurrentPlan')
                      : plan.id === 'free'
                        ? t('pricingStartFree')
                        : user
                          ? (billingPeriod === 'annual' ? t('pricingSelectAnnual') : t('pricingSelectPlan'))
                          : t('pricingSignupFirst')}
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
            <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>{t('pricingFaqTitle')}</div>
            <div style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 20 }}>{t('pricingFaqDesc')}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {pricingFaq.map((item, index) => {
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
              <div style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>{t('pricingSecurityLabel')}</div>
              <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 10 }}>{t('pricingSecurityTitle')}</div>
              <div style={{ display: 'grid', gap: 10, color: 'var(--text2)', fontSize: 13, lineHeight: 1.7 }}>
                <div>{t('pricingSecurityInfo1')}</div>
                <div>{t('pricingSecurityInfo2')}</div>
                <div>{t('pricingSecurityInfo3')}</div>
              </div>
            </div>

            <div style={{ padding: '20px', borderRadius: 26, background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text3)', fontSize: 13, lineHeight: 1.8 }}>
              {t('pricingRefundNote')} <strong style={{ color: 'var(--text)' }}>{t('pricingRefundBold')}</strong> {t('pricingRefundEnd')}
              <br />
              {lang === 'ko' ? '문의' : 'Contact'}: <a href="mailto:choijunhuk2007@gmail.com" style={{ color: 'var(--blue)' }}>choijunhuk2007@gmail.com</a>
              {' · '}
              <button
                onClick={() => navigate('/terms')}
                style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: 0 }}
              >
                {t('pricingTerms')}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
