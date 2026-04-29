## Task Statement
Execute the DailyCoding server hardening backlog delivered through `$autopilot`, prioritizing critical security and data-integrity fixes, then adjacent community/auth/problems reliability work.

## Desired Outcome
- Community post + poll creation is atomic.
- Community block filters validate aliases and keep parameter binding clear.
- User list retrieval is paginated and column-limited to avoid OOM patterns.
- Community write endpoints require verified email and tighter rate limits.
- Community tag input is sanitized before persistence.
- Redis sorted-set in-memory fallback respects ranking cache TTL defaults.
- Auth/admin endpoints and problem broadcast paths avoid full-user table loads.
- Low-risk hygiene items are folded in when they touch the same files.

## Known Facts / Evidence
- `dailycoding-server/src/routes/community.js` currently inserts `posts`, `polls`, and `poll_options` outside a transaction.
- `buildBlockedUserClause` currently interpolates the alias directly and accepts any alias string.
- `User.findAll()` already has limit/offset but not the requested `fields` option and some callers still assume whole-table access.
- `auth.js GET /users` returns the whole user list without pagination metadata.
- `problems.js` broadcasts using `User.findAll()` and an existing `/bookmarks` route already exists in a lighter form.
- `redis.js` uses hardcoded `60` seconds for in-memory `zAdd` / `zAddMany`.
- `submissions.js` imports `redis`, but current visible slice shows no usage.

## Constraints
- ESM only.
- Keep existing `query`, `queryOne`, `insert`, and `run` helpers backward compatible.
- No new dependencies.
- Keep diffs reviewable and favor reuse of existing helpers/patterns.
- Verify with lint-equivalent syntax checks, targeted tests, and diagnostics after edits.

## Unknowns / Open Questions
- Whether any frontend bookmark/profile features from the backlog are already partially implemented and should be aligned later.
- Whether DB uniqueness for `post_likes` / `post_scraps` already exists if race-condition fixes are tackled in the next tranche.
- Whether auth route response normalization should be limited to touched admin/auth flows or the entire file this run.

## Likely Codebase Touchpoints
- `dailycoding-server/src/config/mysql.js`
- `dailycoding-server/src/config/redis.js`
- `dailycoding-server/src/routes/community.js`
- `dailycoding-server/src/routes/auth.js`
- `dailycoding-server/src/routes/problems.js`
- `dailycoding-server/src/models/User.js`
- `dailycoding-server/src/middleware/rateLimit.js`
- `dailycoding-server/src/routes/submissions.js`
- `dailycoding-server/src/shared/constants.js`
