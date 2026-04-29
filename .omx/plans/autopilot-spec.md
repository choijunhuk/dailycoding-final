# Autopilot Spec: Auth Hardening + Pricing + Deployment

## Goal
Implement the next deployment-ready tranche for DailyCoding: safer cookie-based auth usage, production/deployment guidance, and localized pricing backed by the supplied Stripe plan configuration.

## Scope Strategy
1. Fix only the highest-signal issues already visible from code inspection.
2. Prefer explicit opt-in local bootstrap over implicit or production-visible shortcuts.
3. Keep operational changes documented so the operator can reproduce them locally without hunting through code.

## In-Scope Requirements
1. Remove persistent frontend dependence on `localStorage` auth tokens.
2. Accept access tokens from cookies on the backend and sockets.
3. Keep login/register/refresh/OAuth flows working after the cookie shift.
4. Localize pricing content to Korean and update the actual plan amounts:
   - Pro: $5 monthly / $50 yearly
   - Team: $10 monthly / $100 yearly
5. Wire the supplied Stripe Price IDs and checkout URLs into configuration/documentation.
6. Add deployment documentation for domain/VPS setup and required env values.

## Out of Scope
1. Full identity-system redesign beyond the current JWT/cookie model.
2. Broad subscription product redesign beyond the supplied plan/pricing inputs.
3. Unrelated UI cleanup or global i18n refactors.

## Non-Functional Requirements
1. No new dependencies.
2. Local bootstrap must be disabled in production.
3. Verification claims must come from fresh build/test output.
4. Existing auth and admin routes should keep their current contracts unless explicitly improved.
