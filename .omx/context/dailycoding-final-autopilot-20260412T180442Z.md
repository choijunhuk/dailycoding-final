## Task Statement
Complete and harden the DailyCoding project under `Desktop/dailycoding-final`, focusing on judge UX reliability, feature completion, optimization, security fixes, and design polish.

## Desired Outcome
- Judge flow is reliable on desktop/mobile, with explicit error and retry states.
- Pricing and subscription management are discoverable and usable for guests and signed-in users.
- Ranking and related shared-data screens fail gracefully and avoid misleading empty states.
- Subscription backend rejects unsafe fallback behavior and is safer under misconfiguration.
- Frontend build and backend tests/checks pass after changes.

## Known Facts / Evidence
- Frontend production build currently passes.
- Backend judge tests and submission-flow tests currently pass.
- Judge run and submit are already separated via `/api/submissions/run` and `/api/submissions`.
- Guest routing does not expose `/pricing`, and authenticated nav does not include pricing.
- Judge page fetch failures are swallowed and leave the page in a perpetual loading state.
- Ranking hook tracks errors, but ranking UI does not render them.
- Subscription webhook logic falls back unknown Stripe price IDs to `pro`, and checkout/webhook rely on permissive env fallback behavior.

## Constraints
- No new dependencies.
- Keep diffs reviewable and reversible.
- Preserve existing behavior unless replacing a broken or misleading contract.
- Verify with build/tests/checks after changes.

## Unknowns / Open Questions
- Whether any additional subscription management surface beyond cancel-at-period-end is needed immediately.
- Whether JudgePage should fully re-architect mobile layout or use a lighter responsive stack for now.

## Likely Touchpoints
- `dailycoding/src/App.jsx`
- `dailycoding/src/components/TopNav.jsx`
- `dailycoding/src/pages/LandingPage.jsx`
- `dailycoding/src/pages/PricingPage.jsx`
- `dailycoding/src/pages/ProfilePage.jsx`
- `dailycoding/src/pages/RankingPage.jsx`
- `dailycoding/src/pages/JudgePage.jsx`
- `dailycoding/src/pages/JudgePage.css`
- `dailycoding-server/src/routes/subscription.js`
