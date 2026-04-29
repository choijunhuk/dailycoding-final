## Task Statement
Complete the current DailyCoding platform improvement batch under autopilot, reusing already-landed fixes and implementing only the remaining backend/frontend gaps from the latest user brief.

## Desired Outcome
- Keep existing completed hardening work intact.
- Add missing performance/caching/data APIs and feature wiring without duplicating already-implemented functionality.
- Finish with fresh syntax/test/build evidence.

## Known Facts / Evidence
- `community.js` block filter alias validation and parameter binding are already present.
- `redis.js` sorted-set fallback already defaults TTL to `RANKING_CACHE_TTL`.
- `User.findAll()` already supports `{ limit, offset, fields }` and orders by rating.
- Problem bookmarks already exist in DB/model/routes/UI, but response shape and verification requirements differ from the new brief.
- Difficulty voting, battle sharing, active battle list UI, and profile yearly heatmap already exist in some form.
- Missing or incomplete pieces appear to be:
  - `/api/ai/analyze` per-user/day caching and quota-safe cache hits
  - solve-time persistence and `GET /api/auth/me/stats`
  - `GET /api/auth/me/activity` plus dashboard 52-week activity view
  - submission share API/table and JudgePage share action using it
  - judge runtime cache dedup between `submissions.js` and `battles.js`
  - `battles.js` direct 500 JSON responses

## Constraints
- ESM only.
- Use `query`, `queryOne`, `insert`, `run` helpers; no raw pool access.
- Use `shared/constants.js` for shared constants when relevant.
- Preserve existing behavior where the requested feature is already implemented unless the spec requires a different response shape.
- Use CSS variables and avoid new dependencies except the explicitly allowed `nanoid` if needed for share slugs.

## Unknowns / Open Questions
- Whether the DB schema already includes `solve_time_sec`; code search suggests it does not.
- Whether `shared_submissions` table exists; code search suggests it does not.
- Whether `bookmark` endpoints should now require `requireVerified` or only stay behind `auth`.

## Likely Touchpoints
- `dailycoding-server/src/routes/ai.js`
- `dailycoding-server/src/routes/auth.js`
- `dailycoding-server/src/routes/problems.js`
- `dailycoding-server/src/routes/submissions.js`
- `dailycoding-server/src/routes/battles.js`
- `dailycoding-server/src/services/judgeRuntimeCache.js` (new)
- `dailycoding-server/src/models/Submission.js`
- `dailycoding-server/src/config/mysql.js`
- `dailycoding/src/context/AppContext.jsx`
- `dailycoding/src/pages/JudgePage.jsx`
- `dailycoding/src/pages/Dashboard.jsx`
- `dailycoding/src/pages/ProfilePage.jsx`
