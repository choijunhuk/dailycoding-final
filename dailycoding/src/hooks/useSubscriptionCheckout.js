import { useCallback, useState } from 'react'
import api from '../api.js'

export function useSubscriptionCheckout() {
  const [loadingPlan, setLoadingPlan] = useState(null)

  const startCheckout = useCallback(async (tier, billingPeriod = 'monthly') => {
    if (!tier || tier === 'free') return { ok: false, reason: 'invalid-plan' }

    setLoadingPlan(tier)
    try {
      const { data } = await api.post('/subscription/checkout', { tier, billingPeriod })
      if (!data?.url) {
        return { ok: false, reason: 'missing-url' }
      }
      window.location.assign(data.url)
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        reason: error.response?.data?.message || error.message || 'checkout-failed',
      }
    } finally {
      setLoadingPlan(null)
    }
  }, [])

  return {
    loadingPlan,
    startCheckout,
  }
}
