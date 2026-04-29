# Task Context Snapshot

## Task statement
Implement the requested DailyCoding bug fixes, selected feature improvements, and VPS deployment transition artifacts for a single Ubuntu 22.04 host running frontend, backend, MySQL, Redis, Docker judge, Nginx, PM2, and Certbot.

## Desired outcome
- Critical bugs are fixed or hardened.
- Medium-priority missing improvements are implemented where still absent.
- VPS deployment scripts/config/docs exist and align with current repo structure.
- Build/syntax verification passes.

## Known facts / evidence
- `dailycoding-server/src/config/mysql.js` currently imports `../shared/problemCatalog.js` and defaults DB port to 3306.
- `dailycoding-server/src/shared/problemCatalog.js` exists and exports `PROBLEMS` plus related constants.
- `dailycoding/src/pages/LandingPage.jsx` still shows outdated tier ranges.
- `dailycoding/src/App.jsx` footer still hardcodes `© 2025`.
- `dailycoding/src/App.jsx` has `/community` and `/community/:board`, but not `/community/:board/:id`.
- `dailycoding-server/src/routes/community.js` still interpolates `userId` into SQL filter snippets through `blockFilter` and `replyBlockFilter`.
- `dailycoding/src/pages/ProblemsPage.jsx` already uses `useSearchParams` and syncs filters with URL.
- `dailycoding/src/context/AppContext.jsx` already has realtime notification socket subscription; `TopNav.jsx` loads notifications when panel opens.
- `dailycoding-server/src/routes/ai.js` already has free-tier quota checks, but it uses `subscription_tier` read from DB and not all endpoints are cleanly aligned to the requested policy language.
- Root `docker-compose.yml` is still multi-service/local-monitoring oriented and not the requested VPS-only MySQL+Redis shape.
- `scripts/` deployment artifacts requested by the prompt do not yet exist.

## Constraints
- ES modules only except the requested PM2 ecosystem file uses CommonJS by design.
- Use existing DB helper wrappers (`query`, `queryOne`, `insert`, `run`) rather than raw pool access in routes/models.
- Frontend must use the shared axios instance from `src/api.js`.
- Preserve prior protected fixes from earlier DailyCoding task context.
- Avoid new npm dependencies.

## Unknowns / open questions
- Which requested feature items already have hidden partial implementations deeper in the repo beyond the initial surface scan.
- Whether the desired VPS compose file should fully replace the current local/dev compose file or become a dedicated deployment variant.
- How far to push non-critical features in one pass if verification reveals regressions.

## Likely codebase touchpoints
- `dailycoding-server/src/config/mysql.js`
- `dailycoding-server/src/shared/problemCatalog.js`
- `dailycoding-server/src/routes/community.js`
- `dailycoding-server/src/routes/ai.js`
- `dailycoding-server/src/routes/problems.js`
- `dailycoding/src/pages/LandingPage.jsx`
- `dailycoding/src/App.jsx`
- `dailycoding/src/pages/BattlePage.jsx`
- `dailycoding/src/pages/JudgePage.jsx`
- `dailycoding/src/pages/SubmissionsPage.jsx`
- `docker-compose.yml`
- `dailycoding-server/.env.example` or env docs if present
- `scripts/vps-setup.sh`
- `scripts/nginx-dailycoding.conf`
- `scripts/deploy.sh`
- `scripts/DEPLOY_GUIDE.md`
- `dailycoding-server/ecosystem.config.cjs`
