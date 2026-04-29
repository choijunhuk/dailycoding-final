# Deep Interview Transcript Summary: Railway Native Judge Phase 1

- Profile: standard
- Context type: brownfield
- Final ambiguity: 10%
- Threshold: 20%
- Exit reason: threshold-met-with-gates-satisfied
- Resume safety: full
- Context snapshot: `.omx/context/deep-interview-unspecified-task-20260411T184417Z.md`

## Key clarified points
- Highest priority is changing the judging architecture.
- Main reason: the current Docker-based judging path is not usable for the intended Railway deployment model.
- Phase 1 should keep Railway unless a later comparison proves a clearly better free alternative.
- Phase 1 should focus on making a Railway-compatible native judging path practically usable.
- Phase 1 excludes free alternative-platform comparison and excludes new feature work.
- Phase 1 success means stable submit -> execute -> answer-compare flow.
- Phase 1 may target only one language first.
- The first language should be Python.
- Broader multi-language support is a later expansion goal.

## Pressure-pass finding
- Earlier assumption tested: “judge architecture change” could have implied broad platform migration.
- Clarification outcome: platform migration is not the default path; Railway retention is preferred unless a later free alternative is clearly better.

## Evidence-backed brownfield facts
- Repo split: `dailycoding` frontend + `dailycoding-server` backend.
- Current backend contains Docker-based judging in `dailycoding-server/src/services/judge.js`.
- The same file already contains a partial native subprocess judging direction, which makes a Railway-compatible phase-1 path plausible.

## Condensed round log
1. User asked for a project inspection/plan covering multiple categories.
2. Priority order was clarified; judge architecture came first.
3. Root cause clarified: Docker judging does not fit the Railway path.
4. Boundary clarified: prefer keeping Railway; only consider moving later if a clearly better free option appears.
5. Outcome clarified: phase 1 should make Railway-compatible native judging usable.
6. Non-goals clarified: no free-platform comparison now; no new features now.
7. Success clarified: stable submission, execution, and answer comparison.
8. Scope tightened to a one-language MVP.
9. MVP language chosen: Python.
