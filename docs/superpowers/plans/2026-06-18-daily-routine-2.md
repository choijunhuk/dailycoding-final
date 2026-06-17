# Daily Routine 2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn DailyCoding's existing features into a clearer daily workflow and verify the main feature surfaces after the change.

**Architecture:** Add pure frontend helper modules for dashboard decision logic and feature-surface metadata, then wire them into existing pages. Reuse current APIs such as `/submissions/recovery`, `/onboarding-plan/today`, `/battles/summary`, `/admin/stats`, and the existing route config.

**Tech Stack:** React 18, Vite, Vitest, Express, Node built-in test runner.

## Global Constraints

- Do not add dependencies.
- Korean-first copy with English fallback where the surrounding file already uses `lang`.
- Reuse existing APIs and data before adding storage.
- Keep behavior honest: loading, failure, and empty states must be visually distinct.
- Preserve source values from APIs and databases; display changes belong in frontend helpers/components.
- Verify with targeted tests, frontend build, backend syntax checks where backend files change, and a feature-surface checklist.

---

### Task 1: Daily Routine Decision Helper

**Files:**
- Create: `dailycoding/src/pages/dailyRoutineUtils.js`
- Create: `dailycoding/src/pages/dailyRoutineUtils.test.js`
- Modify: `dailycoding/src/pages/Dashboard.jsx`
- Modify: `dailycoding/src/pages/Dashboard.css`

**Interfaces:**
- Consumes: `buildDailyRoutine({ todayProblem, recoveryQueue, onboardingPlan, battleSummary, reviewQueue, progression, solvedCount, totalProblems, lang })`
- Produces: `{ primary, secondary, checklist }` where action objects include `key`, `title`, `description`, `stat`, `reason`, `path`, optional `state`, `color`, and `icon`.

- [ ] Write failing tests for recovery-first, onboarding-first, battle-after-practice, and empty-state routines.
- [ ] Run `cd dailycoding && npm test -- src/pages/dailyRoutineUtils.test.js`; expected failure: module missing.
- [ ] Implement `buildDailyRoutine` with deterministic prioritization: recovery, onboarding, today problem, review queue, progression, battle.
- [ ] Render a dashboard routine panel above the existing stat cards, with one primary CTA and compact secondary actions.
- [ ] Keep the existing focus cards, but make them subordinate to the new routine panel.
- [ ] Re-run `cd dailycoding && npm test -- src/pages/dailyRoutineUtils.test.js`.

### Task 2: Onboarding Continuity Polish

**Files:**
- Modify: `dailycoding/src/pages/Dashboard.jsx`
- Modify: `dailycoding/src/pages/Dashboard.css`
- Test: `dailycoding/src/pages/dailyRoutineUtils.test.js`

**Interfaces:**
- Consumes: Task 1 `buildDailyRoutine`.
- Produces: clearer onboarding progress copy and completed/remaining counts in the dashboard.

- [ ] Add tests that an onboarding plan with solved items emits completed count and a problem CTA.
- [ ] Run the targeted routine test and confirm the new test fails before implementation.
- [ ] Add completed/remaining calculations in the helper rather than inside JSX.
- [ ] Update the dashboard onboarding banner to use the computed counts and route to the first unsolved onboarding problem.
- [ ] Re-run the targeted routine test.

### Task 3: Competition Hub Guidance

**Files:**
- Create: `dailycoding/src/pages/competePageUtils.js`
- Create: `dailycoding/src/pages/competePageUtils.test.js`
- Modify: `dailycoding/src/pages/CompetePage.jsx`

**Interfaces:**
- Produces: `buildCompeteGuidance({ battleSummary, solvedCount, lang })` returning mode cards with `recommended`, `reason`, and `nextLabel`.

- [ ] Write tests for beginner, active battler, and workshop-ready guidance.
- [ ] Run `cd dailycoding && npm test -- src/pages/competePageUtils.test.js`; expected failure: module missing.
- [ ] Implement the helper without API calls.
- [ ] Fetch `/battles/summary` opportunistically in `CompetePage.jsx`; show guidance even when fetch fails.
- [ ] Render recommendations on the existing competition cards without adding routes.
- [ ] Re-run the targeted compete helper test.

### Task 4: Admin Quality Signals

**Files:**
- Create: `dailycoding/src/pages/adminQualityUtils.js`
- Create: `dailycoding/src/pages/adminQualityUtils.test.js`
- Modify: `dailycoding/src/pages/Dashboard.jsx`

**Interfaces:**
- Produces: `buildAdminQualitySignals(adminStats, lang)` returning issue/signal cards from existing admin stats.

- [ ] Write tests for low activity, low correct rate, pending reviews, and battle-room status signals.
- [ ] Run `cd dailycoding && npm test -- src/pages/adminQualityUtils.test.js`; expected failure: module missing.
- [ ] Implement the helper using only fields already returned by `/admin/stats`.
- [ ] Add an admin dashboard quality panel below the top admin stats.
- [ ] Re-run the targeted admin quality helper test.

### Task 5: Feature Surface Checklist

**Files:**
- Create: `docs/FEATURE_SURFACE_CHECKLIST.md`
- Modify: `docs/superpowers/plans/2026-06-18-daily-routine-2.md`

**Interfaces:**
- Documents all major app surfaces from `appRouteConfig.jsx` and the core API-backed widgets.

- [ ] Map authenticated routes into feature groups: learn, solve, recover, compete, community, profile, team, admin, public share.
- [ ] Add check steps for each group with expected loading, empty, and failure behavior.
- [ ] Include local commands and known caveats for this repo.
- [ ] Update this plan with completion evidence.

**Completion evidence:** checklist added in `docs/FEATURE_SURFACE_CHECKLIST.md` with route groups, command guidance, and caveats for auth/AI/billing/judge/live smoke boundaries.

### Task 6: Verification And Review

**Files:**
- Verify all changed files.

- [ ] Run targeted frontend tests for new helpers.
- [ ] Run existing related tests: dashboard plan, recovery utils, route config, community page where relevant.
- [ ] Run `cd dailycoding && npm run build`.
- [ ] If backend files changed, run `node --check` on each modified backend file and targeted Node tests.
- [ ] Review `git diff --check` and `git diff --stat`.
- [ ] Report changed files, simplifications, verification evidence, and remaining risks.
