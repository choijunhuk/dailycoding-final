# Task Snapshot: dailycoding-platform-improvements-v3

## Task Statement
Execute the current DailyCoding v3 improvement batch under autopilot, reusing already-landed work and implementing only the remaining real gaps from the latest user brief.

## Desired Outcome
- Keep already-completed v2/platform work intact.
- Land the highest-priority remaining v3 items end to end across backend and frontend.
- Finish with fresh syntax/test/build evidence.

## Known Facts / Evidence
- `SharedSubmissionPage.jsx` still renders shared code in a plain `<pre>` with no syntax highlighting.
- `JudgePage.jsx` already uses Monaco lazily, so the same import pattern can be reused without adding packages.
- Difficulty voting already exists in `routes/problems.js` and `JudgePage.jsx`; it is not a current gap.
- Problem discussion already exists only as a simple `comments` table flow:
  - flat list
  - no replies
  - no verified-write gate
  - no like toggle table
  - no mention notifications
- `JudgePage.jsx` already has a `💬 토론` tab and submission success flow; the data model/API can be upgraded in place.
- `weekly_challenges` routes and schema are not present.
- `follows/feed` is not present.
- `admin/stats` is not present; the Admin stats tab currently uses local frontend counts only.
- `api.js` does not emit any special UX for HTTP 429.
- `ToastContext.jsx` does not listen for global `dc:toast` events yet.

## Constraints
- ESM only.
- Use existing DB helpers (`query`, `queryOne`, `insert`, `run`); no raw pool access in route/model logic.
- No new dependencies.
- Preserve existing frontend/backend patterns where features already exist in partial form.
- Keep diffs reviewable and reversible.

## Open Questions
- Whether the current DB schema already has a compatible generic `comments` table that must be preserved alongside `problem_comments`.
- Whether the weekly reward code always exists in `reward_items` in local/dev environments.
- Whether the mobile Judge layout already satisfies enough of the v3-06 request to defer it safely.

## Likely Touchpoints
- `dailycoding/src/pages/SharedSubmissionPage.jsx`
- `dailycoding/src/api.js`
- `dailycoding/src/context/ToastContext.jsx`
- `dailycoding/src/pages/Dashboard.jsx`
- `dailycoding/src/pages/AdminPage.jsx`
- `dailycoding/src/pages/JudgePage.jsx`
- `dailycoding-server/src/config/mysql.js`
- `dailycoding-server/src/index.js`
- `dailycoding-server/src/routes/problems.js`
- `dailycoding-server/src/routes/weekly.js`
- `dailycoding-server/src/routes/follows.js`
- `dailycoding-server/src/routes/admin.js`
- `dailycoding-server/src/services/submissionExecution.js`
