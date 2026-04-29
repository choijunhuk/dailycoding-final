Task statement
- Implement the next security/deployment tranche plus pricing updates: move auth toward httpOnly-cookie-based usage, add deployment guidance, and localize/update pricing with supplied Stripe identifiers and checkout URLs.

Desired outcome
- Frontend no longer relies on persistent `localStorage` auth tokens.
- Backend accepts access tokens from cookies for HTTP and socket flows.
- Pricing UI is Korean-first and reflects the supplied USD plan amounts.
- Stripe configuration supports both real checkout-session creation via Price IDs and fallback direct payment links for test verification.

Known facts / evidence
- Current frontend stores `dc_token` in `localStorage` across `api.js`, `AuthContext.jsx`, `main.jsx`, `AppContext.jsx`, and `BattlePage.jsx`.
- Backend auth currently requires Bearer headers only and sets only a refresh cookie.
- OAuth callbacks currently redirect with `#oauth_token=...`, causing the frontend to persist the token.
- Pricing page is partly Korean but still uses English plan text and KRW amounts.
- User supplied exact Stripe test Price IDs and direct checkout URLs for monthly/annual Pro/Team.

Constraints
- Keep API contracts broadly compatible where feasible.
- No new dependencies.
- Do not weaken current auth; cookie auth should be additive/primary while avoiding localStorage persistence.

Likely touchpoints
- `dailycoding/src/api.js`
- `dailycoding/src/context/AuthContext.jsx`
- `dailycoding/src/context/AppContext.jsx`
- `dailycoding/src/main.jsx`
- `dailycoding/src/pages/BattlePage.jsx`
- `dailycoding/src/pages/PricingPage.jsx`
- `dailycoding/src/pages/LandingPage.jsx`
- `dailycoding/src/data/constants.js`
- `dailycoding-server/src/middleware/auth.js`
- `dailycoding-server/src/routes/auth/helpers.js`
- `dailycoding-server/src/routes/auth/local.js`
- `dailycoding-server/src/routes/auth/oauth.js`
- `dailycoding-server/src/routes/subscription.js`
- `dailycoding-server/.env.example`
- `dailycoding-server/README.md`
