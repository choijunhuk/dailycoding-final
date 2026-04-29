# Task Statement
Implement the requested DailyCoding hardening and improvement batch from the 2026-04-20 prompt, prioritizing critical security fixes first and carrying changes through backend, migrations, and frontend where required.

# Desired Outcome
- Close the listed security gaps or normalize already-partially-implemented versions to the requested shape.
- Centralize repeated product constants and route consumers to the shared values.
- Add the requested backend features and schema migrations with minimal, reviewable diffs.
- Update affected frontend screens to consume the new APIs/constants and expose the requested UX.
- Verify with backend checks/tests and frontend build before completion.

# Known Facts / Evidence
- `routes/subscription.js` already verifies Stripe webhook signatures with `constructEvent`, and `index.js` already mounts `express.raw()` before `express.json()`.
- `middleware/validate.js` already enforces password complexity, but the response shape and max-length coverage are inconsistent with the new request.
- `routes/community.js` already uses a helper for blocked-user clauses, but remaining SQL construction must be verified and normalized.
- `services/socketServer.js` verifies JWTs but stores decoded data on `socket.user` instead of `socket.data.userId`, and its error messages do not match the requested unauthorized shape.
- Ranking currently queries `users` directly inside `routes/ranking.js`; `User.getRanking()` does not yet exist.
- Tier/subscription/AI quota values are duplicated across backend and frontend files.
- `SubmissionsPage.jsx` already contains Monaco diff compare support; `JudgePage.jsx` already binds Monaco theme to `isDark`.

# Constraints
- ESM only.
- Use DB helpers from `src/config/mysql.js`; do not call `pool.query()` directly in app code.
- Preserve sanitize skip keys for code fields.
- Use DB-backed admin validation via existing middleware.
- Use `redis.clearPrefix()` for cache invalidation, not `keys()`.
- Return user objects through `User.safe()` where applicable.
- Avoid adding new dependencies unless clearly necessary.

# Unknowns / Open Questions
- Whether battle-only problem seed data should live in migrations, runtime seeding, or both for fallback mode.
- Whether the current public profile/submission APIs already expose enough data for activity feed and rewards showcase without model changes.
- How much of the requested error-response standardization can be completed safely in one pass without destabilizing frontend assumptions.

# Likely Codebase Touchpoints
- `dailycoding-server/src/index.js`
- `dailycoding-server/src/routes/{auth,community,subscription,problems,submissions,admin,ranking,ai}.js`
- `dailycoding-server/src/services/{socketServer,scheduler}.js`
- `dailycoding-server/src/models/{User,Battle}.js`
- `dailycoding-server/src/middleware/{validate,rateLimit,errorHandler}.js`
- `dailycoding-server/src/config/{logger,mysql,redis}.js`
- `dailycoding-server/src/migrations/*.sql`
- `dailycoding/src/{data,context,pages,hooks}`
