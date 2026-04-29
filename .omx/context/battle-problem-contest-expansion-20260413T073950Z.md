## Task Statement
Expand DailyCoding so the existing 1v1 battle rules are present and reliable, the platform ships with at least 60 problems total, every problem has at least 10 hidden testcases, admins can inspect hidden testcases, and contests can include both existing global problems and contest-only custom problems that do not appear in the normal problem list.

## Desired Outcome
- Battle mode explicitly supports:
  - 30 minute limit
  - first-solver territory lock
  - opponent typing feedback
  - no rating or tier impact
- Problem inventory grows from roughly 10 to at least 60 seeded problems.
- Existing and newly created problems store at least 10 hidden testcases.
- Admins can view and edit hidden testcases for existing problems.
- Contest management supports:
  - attaching existing global problems
  - creating contest-only custom problems
  - keeping contest-only problems out of `/problems`

## Known Facts / Evidence
- Battle backend and battle page already include 30 minute duration, lock-on-solve, typing indication, and no rating update paths.
- Problem data is duplicated:
  - frontend fallback in `dailycoding/src/data/problems.js`
  - backend seed in `dailycoding-server/src/index.js`
  - in-memory fallback in `dailycoding-server/src/config/mysql.js`
- Current seeded catalog is still small enough that the user perceives it as “10 problems”.
- `GET /api/problems/:id` already returns hidden `testcases` for admins only.
- Admin problem edit flow already loads full problem detail, including `testcases`, when editing.
- Contest problem assignment currently only references global `problems.id` through `contest_problems`.

## Constraints
- No new dependencies.
- Keep existing battle behavior stable.
- Keep diffs small and reversible where possible.
- Run backend checks/tests and frontend build after changes.

## Unknowns / Open Questions
- Contest solving flow is currently lightweight; contest-only problems need to be manageable and visible in contest lists even if not surfaced in the global problem list.
- There is no existing dedicated contest-only problem schema.

## Likely Touchpoints
- `dailycoding-server/src/models/Problem.js`
- `dailycoding-server/src/models/Contest.js`
- `dailycoding-server/src/routes/problems.js`
- `dailycoding-server/src/routes/contests.js`
- `dailycoding-server/src/index.js`
- `dailycoding-server/src/config/mysql.js`
- `dailycoding-server/init.sql`
- `dailycoding/src/pages/AdminPage.jsx`
- `dailycoding/src/pages/ContestPage.jsx`
- `dailycoding/src/data/problems.js`
