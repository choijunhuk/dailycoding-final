# Growth Recovery Battle Ops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one coherent DailyCoding improvement bundle that strengthens the daily learning loop, wrong-answer recovery, battle recap, route organization, and live smoke verification.

**Architecture:** Reuse existing APIs and dashboard state instead of adding a broad new subsystem. Add pure helper modules for the testable decision logic, then connect them to focused UI surfaces and operational scripts.

**Tech Stack:** React 18, Vite, Vitest, Express, Node test runner, Node 18+ `fetch`.

---

### Task 1: Daily Focus Reason Labels

**Files:**
- Modify: `dailycoding/src/pages/dashboardPlanUtils.js`
- Modify: `dailycoding/src/pages/dashboardPlanUtils.test.js`
- Modify: `dailycoding/src/pages/Dashboard.jsx`
- Modify: `dailycoding/src/pages/Dashboard.css`

- [ ] Add failing Vitest coverage for focus-card `reason` text and recovery-center routing.
- [ ] Run `cd dailycoding && npm test -- src/pages/dashboardPlanUtils.test.js`; expect the new assertions to fail because `reason` is missing and recovery still opens a problem directly.
- [ ] Add `reason` metadata to each focus card and point the recovery card to `/recovery`.
- [ ] Render `reason` below the description with compact CSS that fits mobile cards.
- [ ] Re-run the targeted Vitest file and confirm it passes.

### Task 2: Wrong-Answer Recovery Center

**Files:**
- Create: `dailycoding/src/pages/recoveryPageUtils.js`
- Create: `dailycoding/src/pages/recoveryPageUtils.test.js`
- Create: `dailycoding/src/pages/RecoveryPage.jsx`
- Create: `dailycoding/src/pages/RecoveryPage.css`
- Modify: `dailycoding/src/App.jsx`
- Modify: `dailycoding/src/pages/Dashboard.jsx`

- [ ] Add failing Vitest coverage for grouping recovery items by cause and selecting the primary action.
- [ ] Run `cd dailycoding && npm test -- src/pages/recoveryPageUtils.test.js`; expect missing-module failure.
- [ ] Implement pure grouping helpers in `recoveryPageUtils.js`.
- [ ] Build `/recovery` as a Korean-first, mobile-friendly page using `/submissions/recovery?limit=12`.
- [ ] Add dashboard CTAs from the existing recovery card to the new center.
- [ ] Re-run recovery utility tests.

### Task 3: Battle Recap And Rematch Suggestion

**Files:**
- Create: `dailycoding-server/src/routes/battleSummaryUtils.js`
- Create: `dailycoding-server/src/routes/battleSummaryUtils.test.js`
- Modify: `dailycoding-server/src/routes/battles.js`
- Modify: `dailycoding/src/pages/Dashboard.jsx`

- [ ] Add failing Node tests for battle recap copy across empty, winning, losing, and rematch cases.
- [ ] Run `cd dailycoding-server && NODE_ENV=test node --test src/routes/battleSummaryUtils.test.js`; expect missing-module failure.
- [ ] Implement `buildBattleRecap` and wire it into `/api/battles/summary`.
- [ ] Surface recap text and suggested action in the dashboard battle card.
- [ ] Re-run the battle summary utility tests.

### Task 4: Route Organization

**Files:**
- Create: `dailycoding/src/routes/appRouteConfig.jsx`
- Create: `dailycoding/src/routes/appRouteConfig.test.jsx`
- Modify: `dailycoding/src/App.jsx`

- [ ] Add failing Vitest coverage for public/private route path lists and admin route gating metadata.
- [ ] Run `cd dailycoding && npm test -- src/routes/appRouteConfig.test.jsx`; expect missing-module failure.
- [ ] Move lazy route declarations and route metadata into `appRouteConfig.jsx`.
- [ ] Keep `App.jsx` responsible for providers, global effects, and rendering route lists.
- [ ] Re-run the route config tests.

### Task 5: Live Smoke Verification Script

**Files:**
- Create: `scripts/smokeLiveUtils.mjs`
- Create: `scripts/smokeLiveUtils.test.mjs`
- Create: `scripts/smoke-live.mjs`
- Modify: `dailycoding-server/package.json`
- Modify: `docs/SECURITY_OPERATIONS.md`

- [ ] Add failing Node tests for health validation and URL normalization.
- [ ] Run `node --test scripts/smokeLiveUtils.test.mjs`; expect missing-module failure.
- [ ] Implement reusable smoke validators.
- [ ] Add a no-dependency live smoke script for `https://dailycoding-final.com`.
- [ ] Add an npm script entry and document it under the existing security operations checklist.
- [ ] Re-run smoke utility tests.

### Task 6: Full Verification And Publish

**Files:**
- Verify all changed files.

- [ ] Run targeted frontend tests.
- [ ] Run targeted backend/script tests.
- [ ] Run frontend build.
- [ ] Run backend `node --check` on modified JS files.
- [ ] Run live smoke script against production.
- [ ] Review `git diff`.
- [ ] Commit with Lore trailers.
- [ ] Push `main` to `origin`.
