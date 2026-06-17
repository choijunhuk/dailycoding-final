# DailyCoding Feature Surface Checklist

Use this checklist after broad UI/product changes. It is scoped to practical verification, not exhaustive end-to-end proof.

## Baseline

- Run `git status --short` before and after edits.
- Frontend changed: run `cd dailycoding && npm run build`.
- Helper logic changed: run the specific `npm test -- <file>` command for the touched helper.
- Backend changed: run targeted `node --test` files and `node --check` on edited backend files.
- Live deploy changed: run `cd dailycoding-server && npm run smoke:live -- https://dailycoding-final.com` after deployment.

## Public And Shell

- `/` renders the landing page and real brand identity.
- `/login`, `/pricing`, `/terms`, `/privacy` render without authenticated state.
- Unknown public routes fall back to auth or not-found behavior intentionally.
- Top navigation, global search, notification menu, user menu, theme toggle, and language toggle do not overlap on mobile.

## Learn And Solve

- `/problems` shows loading, API failure, empty, and populated states distinctly.
- Problem filters, search, recommended view, bookmarks, and pagination keep URL state.
- `/problems/:id` shows problem details, judge controls, run/submit states, and server errors honestly.
- `/submissions` shows personal submission history and can open AI coach context.
- `/recovery` shows grouped wrong-answer causes, retry actions, AI coach actions, and a positive empty state.
- `/learning` and `/learning/:id` open language tracks and route to real problems.

## Daily Dashboard

- User dashboard shows one primary daily action.
- Recovery is prioritized when unresolved wrong answers exist.
- Onboarding progress is prioritized when a user has active onboarding and no recovery queue.
- Recommended problem remains available when no higher-priority action exists.
- Secondary actions never look clickable unless they navigate.
- Optional API failures show local fallback or explicit load failure without pretending data is empty.

## Competition And Games

- `/compete` recommends exactly one primary mode among battle, tournament, and workshop.
- `/battle` can create or join a battle when authenticated local/dev data is available.
- `/battles/history`, `/battle/:roomId`, `/battle/:id/replay`, and public replay routes render route boundaries.
- `/tournaments` distinguishes empty, active, and completed tournament states.
- `/workshop` and `/workshop-gallery` expose custom battle mode creation/sharing.
- `/game`, `/arcade`, and `/arcade/:key` render without layout jumps; fixed-size game boards stay stable on mobile.

## Community And Social

- `/community`, `/community/:board`, and `/community/:board/:id` show board tabs, filters, detail, comments, and empty states.
- `/reviews` and `/reviews/:id` distinguish review queue, detail, and unavailable review states.
- `/ranking` shows loading and empty ranking states.
- `/profile`, `/user/:id`, `/badges`, and `/rewards` route to real profile/reward surfaces.
- Follow/follower affordances should either perform the action or clearly be static.

## Account, Team, And Admin

- `/settings` profile/detail buttons navigate through React Router without full-page reload.
- `/team` and `/join/team/:token` show team state, invalid token state, and join progress.
- `/admin` stays admin-gated and shows stats plus quality signals.
- Admin quality signals should be based only on `/admin/stats` fields already returned by the backend.

## Payments, AI, And External Services

- `/pricing` renders plan order and fallback copy without Stripe credentials.
- Checkout and webhook proof require configured Stripe env; otherwise verify form/route boundaries only.
- `/ai` internal links to settings/pricing should use in-app navigation.
- AI hint quota errors should show the upgrade action without implying the request succeeded.

## Known Caveats

- Backend full `npm test` and lint may have pre-existing failures unrelated to narrow frontend changes.
- Judge, Docker, Stripe, email, and production preflight checks depend on local services or secrets.
- Direct HTML fetches to production can be flaky in this environment; separate `/api/health`, asset checks, and local preview evidence before treating production as down.
