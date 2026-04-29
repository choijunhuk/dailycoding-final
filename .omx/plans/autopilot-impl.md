# Autopilot Implementation Plan: Cookie Auth + Pricing + Deployment

## Cleanup plan
1. Keep auth changes incremental: prefer cookie support plus frontend persistence removal, not an auth rewrite.
2. Preserve existing route contracts where possible so current pages keep working.
3. Update pricing copy and amounts in the fewest files that actually render them.
4. Document deployment/env requirements after implementation is verified.

## Phase 2A: Auth hardening
1. Backend:
   - set an httpOnly access-token cookie alongside refresh
   - allow `auth` middleware to read Bearer header or access-token cookie
   - clear both auth cookies on logout/password-reset paths
   - stop OAuth success redirects from exposing tokens in URL fragments
2. Frontend:
   - remove `localStorage` token persistence
   - rely on cookie-backed `/auth/me`
   - update socket connections to authenticate without localStorage token dependency

## Phase 2B: Pricing and checkout
1. Update shared price constants to the supplied USD amounts.
2. Convert Pricing page copy/buttons/features to Korean.
3. Add Stripe payment-link env fallbacks while preserving checkout-session flow with Price IDs.
4. Update landing page pricing summary.

## Phase 2C: Deployment docs
1. Extend README and `.env.example` with:
   - supplied Stripe Price IDs and checkout URLs
   - domain/VPS env expectations
   - reverse-proxy / cookie / CORS checklist

## Phase 3: QA loop
1. Add/update focused backend tests for auth/subscription helpers where practical.
2. Run targeted backend tests plus frontend build.
3. Run local login/health/checkout-config smoke checks where possible.

## Phase 4: Validation
1. Verify cookie-backed auth still supports login, refresh, OAuth redirect behavior, and socket prerequisites.
2. Verify pricing UI reflects Korean copy and the new amounts.
3. Report remaining production risks that still need later work.
