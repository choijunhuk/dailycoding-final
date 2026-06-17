# Daily Routine 2.0 Design

## Goal

Make DailyCoding feel more coherent by turning the existing feature set into a clear daily workflow: decide what to do now, recover mistakes, continue onboarding, pick the right competition mode, and give admins better quality signals.

## Constraints

- Do not add dependencies.
- Keep Korean-first copy with English fallbacks where the surrounding file already supports both.
- Reuse existing APIs and data before adding storage.
- Keep changes reviewable and reversible.
- Preserve the current split: `dailycoding/` for frontend and `dailycoding-server/` for backend.
- Verify changed behavior with targeted tests, frontend build, backend syntax checks, and a feature-surface smoke checklist.

## Product Direction

DailyCoding already has many feature areas: problems, judge, recovery, submissions, AI coach, battle, tournaments, games, community, profiles, rewards, teams, and admin. The next improvement should not add another isolated feature. It should make the existing features tell the user what to do next.

The main dashboard becomes the command center. It should show one primary action based on the user's current state, then show supporting actions with reasons. This reduces the current sense of having many equal choices.

New and returning users should see different emphasis:

- New users get onboarding progress, today's onboarding problems, and a concrete next step.
- Returning users get wrong-answer recovery first when they have unresolved failures.
- Active users get battle or competition suggestions after practice.
- Admins get quality and activity signals that help them maintain the platform.

## Feature Areas To Improve

### Daily Routine

Create a pure decision helper for a dashboard "now" panel. It consumes the same data the dashboard already has: today problem, recovery queue, onboarding plan, battle summary, review queue, progression, solved count, and total problem count. It produces a primary action and secondary actions.

### Onboarding Continuity

The current onboarding plan is visible but separated from the rest of the dashboard. It should contribute to the daily routine decision model and show clearer completion state.

### Competition Guidance

The competition hub should help users choose between coding battle, tournament, and workshop based on current state. This is a frontend-only improvement using existing routes.

### Admin Quality Signals

The admin dashboard already receives recent submissions, recent reviews, battle status, and problem type counts. The UI should surface these as quality checks rather than only raw stats.

### Feature Verification

Create a feature checklist that covers the main product routes and API-backed flows. This is not a full E2E suite; it is a practical smoke map that can be used after broad product changes.

## Error Handling

All new UI should distinguish:

- loading state
- API load failure
- true empty state

Existing dashboard load failures should remain non-fatal. The app should still show local or fallback recommendations when optional widgets fail.

## Testing

Use pure helpers for decision logic so the highest-risk behavior can be tested without browser automation. Add targeted Vitest tests for frontend helper behavior and Node tests for backend helper behavior if backend logic changes. Run frontend build before claiming completion.

## Out Of Scope

- New payment, auth, or database schema work.
- Production deploy unless explicitly requested.
- New AI provider behavior.
- Rewriting the overall design system.
