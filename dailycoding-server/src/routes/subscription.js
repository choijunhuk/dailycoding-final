import express, { Router } from 'express';
import Stripe from 'stripe';
import { adminOnly, auth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { queryOne } from '../config/mysql.js';
import logger from '../config/logger.js';
import { redis } from '../config/redis.js';
import { SUBSCRIPTION_PRICE, TEAM_SUBSCRIPTION_PRICE } from '../shared/constants.js';

const router = Router();
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const STRIPE_LAST_EVENT_KEY = 'stripe:last:event';
const STRIPE_LAST_ERROR_KEY = 'stripe:last:error';

// ★ 캐시 무효화 헬퍼
async function clearAuthStatus(userId) {
  if (userId) await redis.del(`auth:status:${userId}`);
}

const PRO_MONTHLY_ID = process.env.STRIPE_PRO_MONTHLY_ID?.trim() || '';
const PRO_ANNUAL_ID  = process.env.STRIPE_PRO_ANNUAL_ID?.trim() || '';
const TEAM_MONTHLY_ID = process.env.STRIPE_TEAM_MONTHLY_ID?.trim() || '';
const TEAM_ANNUAL_ID  = process.env.STRIPE_TEAM_ANNUAL_ID?.trim() || '';
const PRO_MONTHLY_URL = process.env.STRIPE_PRO_MONTHLY_URL?.trim() || '';
const PRO_ANNUAL_URL  = process.env.STRIPE_PRO_ANNUAL_URL?.trim() || '';
const TEAM_MONTHLY_URL = process.env.STRIPE_TEAM_MONTHLY_URL?.trim() || '';
const TEAM_ANNUAL_URL  = process.env.STRIPE_TEAM_ANNUAL_URL?.trim() || '';
const STRIPE_CURRENCY = 'usd';

const PLANS = {
  pro: {
    name: '프로',
    monthly: PRO_MONTHLY_ID,
    annual: PRO_ANNUAL_ID,
    monthlyUrl: PRO_MONTHLY_URL,
    annualUrl: PRO_ANNUAL_URL,
    tier: 'pro'
  },
  team: {
    name: '팀',
    monthly: TEAM_MONTHLY_ID,
    annual: TEAM_ANNUAL_ID,
    monthlyUrl: TEAM_MONTHLY_URL,
    annualUrl: TEAM_ANNUAL_URL,
    tier: 'team'
  }
};

// Price ID → tier 매핑 개선
export function tierFromPriceId(priceId) {
  if (priceId === PRO_MONTHLY_ID || priceId === PRO_ANNUAL_ID) return 'pro';
  if (priceId === TEAM_MONTHLY_ID || priceId === TEAM_ANNUAL_ID) return 'team';
  return null;
}

export function getStripeConfigError({ requireWebhook = false, env = process.env } = {}) {
  if (!env.STRIPE_SECRET_KEY) return '결제 시크릿 키가 설정되지 않았습니다.';
  if (!env.FRONTEND_URL) return 'FRONTEND_URL이 설정되지 않았습니다.';
  if (requireWebhook && !env.STRIPE_WEBHOOK_SECRET) return 'Stripe 웹훅 시크릿이 설정되지 않았습니다.';
  return null;
}

export function buildCheckoutLink(rawUrl, user = null) {
  if (!rawUrl) return '';
  try {
    const url = new URL(rawUrl);
    if (user?.email) url.searchParams.set('prefilled_email', user.email);
    if (user?.id) url.searchParams.set('client_reference_id', String(user.id));
    url.searchParams.set('locale', 'ko');
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function summarizeStripeConfig(env = process.env) {
  const plans = {
    pro: {
      monthlyPriceId: Boolean(env.STRIPE_PRO_MONTHLY_ID),
      annualPriceId: Boolean(env.STRIPE_PRO_ANNUAL_ID),
      monthlyPaymentLink: Boolean(env.STRIPE_PRO_MONTHLY_URL),
      annualPaymentLink: Boolean(env.STRIPE_PRO_ANNUAL_URL),
    },
    team: {
      monthlyPriceId: Boolean(env.STRIPE_TEAM_MONTHLY_ID),
      annualPriceId: Boolean(env.STRIPE_TEAM_ANNUAL_ID),
      monthlyPaymentLink: Boolean(env.STRIPE_TEAM_MONTHLY_URL),
      annualPaymentLink: Boolean(env.STRIPE_TEAM_ANNUAL_URL),
    },
  };
  const configError = getStripeConfigError({ env });
  const hasAnyPaymentLink = Object.values(plans).some((plan) =>
    Object.values(plan).some(Boolean)
  );

  return {
    mode: stripe && !configError ? 'stripe_session' : hasAnyPaymentLink ? 'payment_link' : 'unavailable',
    configured: !configError || hasAnyPaymentLink,
    configError,
    secretKeyConfigured: Boolean(env.STRIPE_SECRET_KEY),
    webhookConfigured: Boolean(env.STRIPE_WEBHOOK_SECRET),
    plans,
  };
}

export async function getStripeOpsStatus(env = process.env) {
  const summary = summarizeStripeConfig(env);
  const [lastEvent, lastError] = await Promise.all([
    redis.getJSON(STRIPE_LAST_EVENT_KEY),
    redis.getJSON(STRIPE_LAST_ERROR_KEY),
  ]);
  return { ...summary, lastEvent, lastError };
}

async function rememberStripeEvent(meta) {
  await redis.setJSON(STRIPE_LAST_EVENT_KEY, {
    ...meta,
    recordedAt: new Date().toISOString(),
  }, 7 * 24 * 60 * 60);
}

async function rememberStripeError(meta) {
  await redis.setJSON(STRIPE_LAST_ERROR_KEY, {
    ...meta,
    recordedAt: new Date().toISOString(),
  }, 7 * 24 * 60 * 60);
}

// GET /api/subscription/plans - public
router.get('/plans', (req, res) => {
  res.json({
    plans: [
      { id: 'free', name: '무료', priceMonthly: 0, priceAnnual: 0, features: ['전체 문제 풀이', 'AI 힌트 하루 5회', '기본 통계'] },
      { id: 'pro', name: '프로', priceMonthly: SUBSCRIPTION_PRICE.pro_monthly, priceAnnual: SUBSCRIPTION_PRICE.pro_yearly, features: ['무제한 AI 힌트', '광고 제거', '우선 매칭', '심화 분석'] },
      { id: 'team', name: '팀', priceMonthly: TEAM_SUBSCRIPTION_PRICE.monthly, priceAnnual: TEAM_SUBSCRIPTION_PRICE.yearly, features: ['프로 기능 전체', '팀 대시보드', '커스텀 대회', 'API 연동'] },
    ]
  });
});

router.get('/ops', auth, adminOnly, async (req, res) => {
  try {
    const status = await getStripeOpsStatus();
    res.json(status);
  } catch (error) {
    logger.error('Stripe ops status error', { error: error.message, userId: req.user.id });
    res.status(500).json({ message: 'Stripe 운영 상태를 불러오지 못했습니다.' });
  }
});

// POST /api/subscription/checkout - create Stripe checkout session
router.post('/checkout', auth, async (req, res) => {
  const { tier, billingPeriod = 'monthly' } = req.body;
  const plan = PLANS[tier];
  if (!plan) return res.status(400).json({ message: '유효하지 않은 플랜입니다.' });
  const user = await User.findById(req.user.id);
  const configError = getStripeConfigError();
  const directCheckoutUrl = buildCheckoutLink(
    billingPeriod === 'annual' ? plan.annualUrl : plan.monthlyUrl,
    user,
  );

  if ((!stripe || configError) && directCheckoutUrl) {
    return res.json({ url: directCheckoutUrl, mode: 'payment_link' });
  }
  if (!stripe || configError) return res.status(503).json({ message: configError || '결제 시스템이 준비되지 않았습니다.' });
  
  const priceId = billingPeriod === 'annual' ? plan.annual : plan.monthly;

  // price_data 인라인 폴백: Price ID가 없거나 Stripe Price ID 형식이 아닌 경우 사용
  const PLAN_AMOUNTS = {
    pro:  { monthly: SUBSCRIPTION_PRICE.pro_monthly, annual: SUBSCRIPTION_PRICE.pro_yearly },
    team: { monthly: TEAM_SUBSCRIPTION_PRICE.monthly, annual: TEAM_SUBSCRIPTION_PRICE.yearly },
  };
  const useInlinePrice = !priceId || !priceId.startsWith('price_');
  if (useInlinePrice) {
    logger.warn('Stripe Price ID 미설정 또는 잘못된 형식 — price_data 인라인 사용', { tier, billingPeriod, priceId });
  }

  const lineItem = useInlinePrice
    ? {
        price_data: {
          currency: STRIPE_CURRENCY,
          product_data: { name: `DailyCoding ${plan.name}`, metadata: { tier: plan.tier } },
          unit_amount: (PLAN_AMOUNTS[tier]?.[billingPeriod] ?? PLAN_AMOUNTS[tier]?.monthly ?? SUBSCRIPTION_PRICE.pro_monthly) * 100,
          recurring: { interval: billingPeriod === 'annual' ? 'year' : 'month' },
        },
        quantity: 1,
      }
    : { price: priceId, quantity: 1 };

  try {
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { userId: String(user.id) } });
      customerId = customer.id;
      await User.updateSubscription(user.id, { stripe_customer_id: customerId });
    }

    const sessionParams = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [lineItem],
      mode: 'subscription',
      subscription_data: { metadata: { tier: plan.tier, userId: String(user.id), billingPeriod } },
      success_url: `${process.env.FRONTEND_URL}/profile?payment=success`,
      cancel_url:  `${process.env.FRONTEND_URL}/profile?payment=cancelled`,
    };

    let session;
    try {
      session = await stripe.checkout.sessions.create(sessionParams);
    } catch (stripeErr) {
      // Price ID가 one-time 타입인 경우 inline price_data로 재시도
      if (!useInlinePrice && stripeErr.message?.includes('recurring price')) {
        logger.warn('Price ID가 one-time 타입 — inline price_data로 재시도', { tier, billingPeriod });
        const inlineItem = {
          price_data: {
            currency: STRIPE_CURRENCY,
            product_data: { name: `DailyCoding ${plan.name}`, metadata: { tier: plan.tier } },
            unit_amount: (PLAN_AMOUNTS[tier]?.[billingPeriod] ?? PLAN_AMOUNTS[tier]?.monthly ?? SUBSCRIPTION_PRICE.pro_monthly) * 100,
            recurring: { interval: billingPeriod === 'annual' ? 'year' : 'month' },
          },
          quantity: 1,
        };
        session = await stripe.checkout.sessions.create({ ...sessionParams, line_items: [inlineItem] });
      } else {
        throw stripeErr;
      }
    }

    res.json({ url: session.url });
  } catch (err) {
    logger.error('Stripe checkout error', { error: err.message, userId: req.user.id });
    res.status(500).json({ message: '결제 세션 생성 실패' });
  }
});

// POST /api/subscription/cancel - cancel subscription
router.post('/cancel', auth, async (req, res) => {
  if (!stripe) return res.status(503).json({ message: '결제 시스템이 준비되지 않았습니다.' });
  try {
    const user = await User.findById(req.user.id);
    if (!user.stripe_customer_id) return res.status(400).json({ message: '구독 정보가 없습니다.' });
    const subs = await stripe.subscriptions.list({ customer: user.stripe_customer_id, status: 'active' });
    if (!subs.data.length) return res.status(400).json({ message: '활성 구독이 없습니다.' });
    await stripe.subscriptions.update(subs.data[0].id, { cancel_at_period_end: true });
    res.json({ message: '구독이 기간 종료 시 해지됩니다.' });
  } catch (err) {
    logger.error('Stripe cancel error', { error: err.message });
    res.status(500).json({ message: '구독 해지 실패' });
  }
});

// GET /api/subscription/status - get current user subscription status
router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      tier: user.subscription_tier || 'free',
      expires: user.subscription_expires_at || null,
    });
  } catch (err) {
    logger.error('Subscription status error', { error: err.message, userId: req.user.id });
    res.status(500).json({ message: '구독 상태 조회 실패' });
  }
});

// POST /api/subscription/webhook - Stripe webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const configError = getStripeConfigError({ requireWebhook: true });
  if (!stripe || configError) return res.status(503).json({ message: configError || '결제 시스템이 준비되지 않았습니다.' });

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    logger.warn('Stripe webhook signature verification failed', { error: err.message });
    await rememberStripeError({ phase: 'signature', message: err.message });
    return res.status(400).json({ message: `Webhook Error: ${err.message}` });
  }

  // ★ 멱등성 체크 (Duplicate events 방지)
  const idempotencyKey = `stripe:event:${event.id}`;
  try {
    const processed = await redis.get(idempotencyKey);
    if (processed) {
      logger.info('Stripe webhook already processed', { eventId: event.id });
      return res.status(200).json({ received: true, duplicated: true });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;

        // userId 확인: client_reference_id (Payment Link) → metadata → customer metadata 순서로 폴백
        let userId = session.client_reference_id || session.metadata?.userId;
        if (!userId && session.customer) {
          const customer = await stripe.customers.retrieve(session.customer);
          userId = customer.metadata?.userId;
        }
        if (!userId) {
          logger.warn('checkout.session.completed: no userId found', { sessionId: session.id });
          break;
        }

        // Retrieve the subscription to get tier and current_period_end
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const priceId = subscription.items?.data?.[0]?.price?.id;
        // tier: subscription metadata → price ID 매핑
        const tier = subscription.metadata?.tier || tierFromPriceId(priceId);
        if (!tier) {
          logger.error('Unknown Stripe price id in webhook', { sessionId: session.id, priceId });
          break;
        }
        // expires = current_period_end + 3일 grace period
        const expiresTs = (subscription.current_period_end + 3 * 24 * 60 * 60) * 1000;
        const expires = new Date(expiresTs).toISOString().slice(0, 19).replace('T', ' ');

        await User.updateSubscription(userId, { subscription_tier: tier, subscription_expires_at: expires });
        await clearAuthStatus(userId);
        logger.info('Subscription activated', { userId, tier, expires, priceId });
        await rememberStripeEvent({ eventId: event.id, eventType: event.type, userId, tier, source: 'checkout.session.completed' });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        // Find user by stripe_customer_id and reset to free
        const user = await queryOne('SELECT id FROM users WHERE stripe_customer_id=?', [customerId]);
        if (user) {
          await User.updateSubscription(user.id, { subscription_tier: 'free', subscription_expires_at: null });
          await clearAuthStatus(user.id);
          logger.info('Subscription deleted, reset to free', { userId: user.id, customerId, subscriptionId: subscription.id });
          await rememberStripeEvent({ eventId: event.id, eventType: event.type, userId: user.id, tier: 'free', source: 'customer.subscription.deleted' });
        } else {
          logger.warn('customer.subscription.deleted: no user found for customer', { customerId });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const priceId = subscription.items?.data?.[0]?.price?.id;
        const tier = subscription.metadata?.tier || tierFromPriceId(priceId);

        if (!tier) {
          logger.warn('customer.subscription.updated: Unknown price id or no tier', { subscriptionId: subscription.id, priceId });
          break;
        }

        // expires = current_period_end + 3일 grace period
        const expiresTs = (subscription.current_period_end + 3 * 24 * 60 * 60) * 1000;
        const expires = new Date(expiresTs).toISOString().slice(0, 19).replace('T', ' ');

        const user = await queryOne('SELECT id FROM users WHERE stripe_customer_id=?', [customerId]);
        if (user) {
          await User.updateSubscription(user.id, { subscription_tier: tier, subscription_expires_at: expires });
          await clearAuthStatus(user.id);
          logger.info('Subscription updated', { userId: user.id, tier, expires, subscriptionId: subscription.id });
          await rememberStripeEvent({ eventId: event.id, eventType: event.type, userId: user.id, tier, source: 'customer.subscription.updated' });
        } else {
          logger.warn('customer.subscription.updated: no user found for customer', { customerId });
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
          const priceId = subscription.items?.data?.[0]?.price?.id;
          const tier = subscription.metadata?.tier || tierFromPriceId(priceId);
          const userId = subscription.metadata?.userId;
          if (tier && userId) {
            const expiresTs = (subscription.current_period_end + 3 * 24 * 60 * 60) * 1000;
            const expires = new Date(expiresTs).toISOString().slice(0, 19).replace('T', ' ');
            await User.updateSubscription(userId, { subscription_tier: tier, subscription_expires_at: expires });
            await clearAuthStatus(userId);
            logger.info('Invoice payment succeeded, tier confirmed', { userId, tier });
            await rememberStripeEvent({ eventId: event.id, eventType: event.type, userId, tier, source: 'invoice.payment_succeeded' });
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        logger.warn('Invoice payment failed', {
          customerId: invoice.customer,
          invoiceId: invoice.id,
          amountDue: invoice.amount_due,
        });
        break;
      }

      default:
        // Unhandled event — acknowledge receipt
        break;
    }

    // 성공적으로 처리된 경우 멱등성 키 저장 (24시간)
    await redis.set(idempotencyKey, '1', 86400);
    res.status(200).json({ received: true });
  } catch (err) {
    logger.error('Webhook handler error', { error: err.message, eventType: event.type, eventId: event.id });
    await rememberStripeError({ phase: 'handler', message: err.message, eventType: event.type, eventId: event.id });
    // 에러 발생 시 500을 반환하여 Stripe가 재시도하도록 유도
    res.status(500).json({ message: 'Webhook processing failed' });
  }
});

export default router;
