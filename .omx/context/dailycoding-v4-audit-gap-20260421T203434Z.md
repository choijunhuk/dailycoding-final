Task statement
- Implement the v4 DailyCoding audit-gap prompt, excluding items already completed in prior v2/v3 prompt work and current code.

Desired outcome
- Land the real remaining gaps from v4 across security, repository hygiene, dev tooling, backend structure, daily missions, battle rematch/history UX gaps, and season ranking.
- Preserve existing behavior and avoid duplicating already-implemented features such as weekly challenge and battle history.

Known facts / evidence
- Prior prompt artifacts exist at `.omc/prompts/codex-improvement-prompt-v2.md` and `.omc/autopilot/codex-prompts.md`.
- Existing code already includes:
  - `GET /api/weekly` and `POST /api/weekly` in `src/routes/weekly.js`
  - `GET /api/battles/history` and persistence in `src/models/Battle.js`
  - battle history tab in `dailycoding/src/pages/BattlePage.jsx`
- Remaining v4 gaps confirmed by inspection:
  - In-memory DB fallback still hashes `admin1234` in `src/config/mysql.js`
  - backend README still documents `admin1234`
  - root `.gitignore` is too narrow for the monorepo layout
  - both app package manifests still lack lint/test scripts
  - backend tests still hold open handles and one normalization test currently fails
  - `src/index.js` still mixes app bootstrap, middleware, routes, health checks, socket startup, DB init, and admin bootstrapping
  - `src/routes/auth.js` is still monolithic
  - daily mission system does not exist
  - season ranking does not exist
  - battle rematch flow does not exist, although history already does

Constraints
- ESM only, no `require()`
- DB access must use helper surfaces (`query`, `queryOne`, `insert`, `run`)
- Cache invalidation must use `redis.clearPrefix()`
- User responses must continue to use `User.safe()` when returning user records
- Admin role must be rechecked from DB, not trusted from JWT
- Do not remove tracked generated files with destructive git commands; only adjust ignore rules

Unknowns / open questions
- Whether ESLint installation will surface a large baseline of warnings/errors
- Which exact tests are leaving resources open after execution
- How much of auth route logic can be split without further helper extraction beyond a first pass

Likely codebase touchpoints
- Backend: `src/config/mysql.js`, `src/config/redis.js`, `src/index.js`, `src/app.js`, `src/middleware/setup.js`, `src/routes/registry.js`, `src/routes/auth*.js`, `src/routes/submissions.js`, `src/routes/ai.js`, `src/routes/battles.js`, `src/routes/ranking.js`, `src/routes/missions.js`, `src/services/missionService.js`, `src/models/Battle.js`
- Frontend: `dailycoding/src/pages/Dashboard.jsx`, `dailycoding/src/pages/BattlePage.jsx`, `dailycoding/src/pages/RankingPage.jsx`, `dailycoding/src/hooks/useRankingData.js`
- Repo hygiene/tooling: root `.gitignore`, app `.gitignore`s, package manifests, eslint config files, backend README, `.env.example`
