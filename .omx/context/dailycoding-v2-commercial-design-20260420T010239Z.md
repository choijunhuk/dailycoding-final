# Task Statement
Apply the DailyCoding v2 autopilot batch from 2026-04-20, focusing on commercial design upgrades, icon-system migration, mobile UX polish, and only the remaining backend gaps that are not already completed.

# Desired Outcome
- Preserve already-finished constants/ranking/theme work exactly as instructed.
- Upgrade the frontend to feel like a professional commercial coding platform.
- Replace UI emoji controls with Lucide icons where requested.
- Add landing, top-nav, dashboard, problems, judge, pricing, and global CSS polish.
- Keep backend security/caching/admin/search/status behavior aligned with the v2 request without regressing earlier fixes.
- Verify with a fresh frontend build and backend syntax/test checks.

# Known Facts / Evidence
- `dailycoding/src/data/constants.js` already exists and is in use by `LandingPage.jsx`, `PricingPage.jsx`, and ranking/theme updates.
- `services/socketServer.js` already enforces JWT auth and stores `socket.data.userId`.
- `routes/community.js` already uses parameterized blocked-user filtering via clause/params helper.
- `middleware/rateLimit.js` already exports `forgotPasswordLimiter`, and `routes/auth.js` already uses it.
- `models/User.js` already has `getRanking()`, and `routes/ranking.js` already uses cache + query optimization.
- `services/scheduler.js` and the strengthened `/api/health` endpoint already exist.
- Current frontend still uses emoji-based navigation/buttons in several core surfaces and does not yet use `lucide-react`.

# Constraints
- Do not touch the already-completed constants/theme/ranking items except where downstream integration absolutely requires it.
- ESM only.
- Use DB helpers, not raw pool access in app code.
- Preserve sanitize skip keys.
- Admin authority must remain middleware-backed.
- Use `redis.clearPrefix()` for invalidation.
- Keep diffs small and avoid unnecessary new files unless they materially help.
- New dependencies are acceptable only where explicitly requested by the user (`lucide-react`) or directly required for the requested UX (`canvas-confetti`).

# Unknowns / Open Questions
- Whether dependency installation will require escalation because network access is restricted.
- Whether mobile `JudgePage` should fully switch layout or only degrade gracefully under current Monaco setup.
- Whether current `TopNav.css` and page CSS files already contain media queries that should be reused rather than replaced.

# Likely Codebase Touchpoints
- `dailycoding/src/components/TopNav.jsx`
- `dailycoding/src/pages/{LandingPage,Dashboard,ProblemsPage,JudgePage,PricingPage,CommunityPage}.jsx`
- `dailycoding/src/index.css`
- `dailycoding/src/App.jsx`
- `dailycoding/src/package.json`
- `dailycoding-server/src/routes/{search,auth,community}.js`
- `dailycoding-server/src/middleware/errorHandler.js`
