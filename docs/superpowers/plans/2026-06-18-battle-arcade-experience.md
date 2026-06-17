# Battle And Arcade Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve algorithm battle and arcade play surfaces with tested next-action guidance.

**Architecture:** Add pure frontend helper modules for battle and arcade decision logic, then wire compact recommendation panels into existing pages. Avoid backend changes and keep existing engines unchanged.

**Tech Stack:** React 18, Vite, Vitest.

## Global Constraints

- No new dependencies.
- No battle scoring, judge, socket, arcade game engine, API, or schema changes.
- Korean-first copy with English fallback.
- Decision logic belongs in tested helpers, not buried in JSX.
- UI must be responsive and must not create fake clickable affordances.

---

### Task 1: Battle Experience Helpers

**Files:**
- Create: `dailycoding/src/pages/battleExperienceUtils.js`
- Create: `dailycoding/src/pages/battleExperienceUtils.test.js`

**Interfaces:**
- `buildBattleLobbyCoach({ activeBattles, historyRows, selectedBattleMode, selectedDuration, lang })`
- `buildAlgorithmRoomCoach({ room, me, isSpectating, isDrafting, config, timeLeftSec, lang })`

- [ ] Write tests for active spectate, loss rematch, strong record, no-history invite, waiting room, playing room, spectator, and finished states.
- [ ] Run targeted tests and confirm missing-module failure.
- [ ] Implement helpers with deterministic copy and CTA metadata.
- [ ] Re-run targeted tests.

### Task 2: Arcade Experience Helpers

**Files:**
- Create: `dailycoding/src/pages/arcadeExperienceUtils.js`
- Create: `dailycoding/src/pages/arcadeExperienceUtils.test.js`

**Interfaces:**
- `buildArcadeRecommendations({ games, bestByGame, topByGame, lang })`
- `buildArcadeResultGoal({ gameKey, result, lang })`

- [ ] Write tests for continue-best, quick-game, leaderboard chase, score goal, time goal, and survival goal.
- [ ] Run targeted tests and confirm missing-module failure.
- [ ] Implement helpers without API calls.
- [ ] Re-run targeted tests.

### Task 3: Wire Battle UI

**Files:**
- Modify: `dailycoding/src/pages/BattlePage.jsx`
- Modify: `dailycoding/src/pages/BattlePage.css`
- Modify: `dailycoding/src/pages/AlgorithmBattlePage.jsx`
- Modify: `dailycoding/src/pages/AlgorithmBattlePage.css`

- [ ] Add lobby coach panel above invite/active history area.
- [ ] Add algorithm room coach strip under the room top bar.
- [ ] Ensure CTAs navigate or trigger existing state only.

### Task 4: Wire Arcade UI

**Files:**
- Modify: `dailycoding/src/pages/ArcadePage.jsx`
- Modify: `dailycoding/src/pages/ArcadePage.css`
- Modify: `dailycoding/src/pages/ArcadeGamePage.jsx`
- Modify: `dailycoding/src/pages/ArcadeGamePage.test.jsx`

- [ ] Add arcade recommendation strip below the hero.
- [ ] Add next-goal panel to the game result screen.
- [ ] Extend the existing Tetris result test to assert the goal copy.

### Task 5: Verification And Publish

**Files:**
- Verify all changed files.

- [ ] Run targeted helper tests.
- [ ] Run `cd dailycoding && npm run verify`.
- [ ] Browser smoke public arcade/competition routes where possible.
- [ ] Commit with Lore trailers.
- [ ] Push `main` to GitHub.
