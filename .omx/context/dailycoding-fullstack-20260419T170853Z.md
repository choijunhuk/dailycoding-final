# Task Context Snapshot

## Task statement
Implement the requested DailyCoding full-stack improvements, prioritizing the missing frontend for Community and Public Profile, while preserving explicitly protected fixes and following repo constraints.

## Desired outcome
- Community page exists and is routed in the frontend.
- Public profile page exists and is routed in the frontend.
- Supporting low-risk improvements from the prompt are implemented where they materially fit the existing codebase.
- Frontend build and backend syntax checks pass.

## Known facts / evidence
- Existing `.omx/plans/autopilot-spec.md` and `autopilot-impl.md` are from an unrelated older contest rewards task.
- Backend community APIs are already implemented in `dailycoding-server/src/routes/community.js`.
- Backend public profile and follow APIs are already implemented in `dailycoding-server/src/routes/auth.js` and `dailycoding-server/src/routes/follows.js`.
- `dailycoding/src/App.jsx` currently lacks `/community`, `/community/:board`, and `/user/:id` routes.
- `dailycoding/src/components/TopNav.jsx` currently lacks a community nav entry and still polls notifications every 30 seconds.
- `dailycoding/src/components/VerificationBanner.jsx` already contains a resend verification button.
- `dailycoding-server/src/routes/auth.js` already contains `POST /resend-verification`.
- `dailycoding-server/src/services/socketServer.js` already authenticates sockets at connection time, but does not join `user:<id>` rooms for notification fanout.
- `dailycoding-server/src/models/Notification.js` does not emit socket notifications yet.
- `dailycoding-server/src/routes/ranking.js`, `dailycoding-server/src/routes/contests.js`, `dailycoding/src/pages/RankingPage.jsx`, and `dailycoding/src/pages/JudgePage.jsx` are relevant for secondary improvements.
- Protected fixes from the user prompt must remain untouched, especially `JudgePage.jsx` declaration ordering and `onSolve.bind(User)` usage in backend submission flows.

## Constraints
- ES modules only.
- No new dependencies.
- Frontend styling must stay inline and use existing CSS variables.
- Use `api` from `dailycoding/src/api.js` for client HTTP calls.
- Avoid hard-coded top-level const copies of imported values that can trigger TDZ issues.
- Preserve user changes and unrelated local state.

## Unknowns / open questions
- Exact community UX detail choices are open because only backend API contract exists.
- Public profile public submissions endpoint shape must be inferred from existing submissions route/model.
- Notification socket handshake path on the frontend must fit current auth/token flow.
- Some secondary features may reveal backend/frontend mismatches during verification.

## Likely codebase touchpoints
- `dailycoding/src/App.jsx`
- `dailycoding/src/components/TopNav.jsx`
- `dailycoding/src/context/AppContext.jsx`
- `dailycoding/src/pages/CommunityPage.jsx`
- `dailycoding/src/pages/PublicProfilePage.jsx`
- `dailycoding/src/pages/JudgePage.jsx`
- `dailycoding/src/pages/RankingPage.jsx`
- `dailycoding-server/src/models/Notification.js`
- `dailycoding-server/src/services/socketServer.js`
- `dailycoding-server/src/routes/ranking.js`
- `dailycoding-server/src/routes/contests.js`
- `dailycoding-server/src/index.js`
