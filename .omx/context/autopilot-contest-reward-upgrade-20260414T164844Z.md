# Task Snapshot: autopilot-contest-reward-upgrade

- Timestamp (UTC): 2026-04-14T16:48:44Z
- Task statement: Add extensible contest reward functionality and raise project quality with practical feature improvements.
- Desired outcome: Contest rewards can be configured per contest, safely granted, and visible in UI with verification evidence.

## Known facts / evidence
- Contest end currently grants hardcoded top-3 rewards in `dailycoding-server/src/routes/contests.js`.
- Reward catalog and user-owned rewards already exist (`reward_items`, `user_rewards`, `Reward` model).
- Contest page already has admin create modal and result modal; no configurable reward UX yet.
- DB migrations exist through `005_contest_improvements.sql`.

## Constraints
- Keep changes backward compatible with existing contests.
- No new dependencies.
- Keep diffs reviewable and verify with build/tests/checks.

## Unknowns / open questions
- Existing DB may or may not have reward rule/grant tables yet.
- In-memory fallback behavior for new reward tables must remain safe.

## Likely touchpoints
- Backend: `dailycoding-server/src/models/Contest.js`, `dailycoding-server/src/routes/contests.js`, `dailycoding-server/src/index.js`, new migration
- Frontend: `dailycoding/src/pages/ContestPage.jsx` and styles
