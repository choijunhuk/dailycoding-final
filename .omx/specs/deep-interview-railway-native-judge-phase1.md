# Deep Interview Spec: Railway Native Judge Phase 1

## Metadata
- Profile: standard
- Rounds: 9
- Final ambiguity: 10%
- Threshold: 20%
- Context type: brownfield
- Exit reason: threshold-met-with-gates-satisfied
- Resume safety: full
- Context snapshot: `.omx/context/deep-interview-unspecified-task-20260411T184417Z.md`

## Clarity Breakdown
| Dimension | Score | Notes |
|---|---:|---|
| Intent | 0.90 | Top priority is Railway-compatible judge architecture change |
| Outcome | 0.90 | Phase 1 should make native judging practically usable |
| Scope | 0.92 | One-language MVP, Railway retained, broad comparison deferred |
| Constraints | 0.88 | Free-tier sensitivity and Railway compatibility matter |
| Success | 0.88 | Stable submit -> execute -> compare loop is required |
| Context | 0.90 | Existing Docker judge + partial native judge path already identified |

## Requirements Summary
Inspect the current DailyCoding project and produce a plan centered on replacing the unusable Railway-incompatible Docker judging path with a Railway-compatible native judging path for phase 1.

## Desired Outcome
A concrete implementation plan for making code submission, execution, and answer comparison work reliably on Railway using a native judging path, starting with Python only.

## In Scope
- Audit the current judge flow in `dailycoding-server/src/services/judge.js`
- Evaluate what is missing to make the native subprocess judging path usable on Railway
- Plan a phase-1 Python-only judging milestone
- Include likely performance, stability, and operational risks for that path
- Identify follow-up phases after Python MVP

## Out of Scope / Non-goals
- Comparing free alternative deployment platforms in phase 1
- Adding new product features in phase 1
- Full multi-language parity in phase 1
- Broad UI/design improvement work in phase 1 unless directly needed for judging flow clarity
- Full security redesign in phase 1 unless a judge-path blocker is discovered

## Decision Boundaries
- Prefer keeping Railway as the deployment platform.
- OMX may recommend a later platform comparison only if the audit shows Railway-compatible judging is materially worse than a clearly better free alternative.
- Phase 1 should optimize for a one-language MVP, not all-language completeness.
- Python is the chosen first language for the MVP.

## Constraints
- Current Docker-based judging is not a practical fit for the intended Railway path.
- Free-cost sensitivity matters if deployment architecture changes later.
- The first plan should stay tightly focused on judging architecture rather than broad product changes.

## Testable Acceptance Criteria
1. The plan identifies the current Docker-dependent judge flow and the existing partial native-judge path.
2. The plan proposes a phase-1 path that keeps Railway and targets Python first.
3. The phase-1 success definition is explicit: submit -> execute -> answer-compare works reliably.
4. The plan excludes free-platform comparison and new-feature work from phase 1.
5. The plan sequences later expansion work separately from the Python MVP.

## Assumptions Exposed + Resolutions
- Assumption: judge-architecture change might require immediate platform migration.
  - Resolution: no; Railway retention is preferred by default.
- Assumption: phase 1 might need multiple languages.
  - Resolution: no; one language is acceptable first.
- Assumption: any one language would do.
  - Resolution: Python is the chosen first language.

## Pressure-pass Findings
- Revisited the platform boundary after the initial Docker complaint.
- Clarified that the real need is Railway compatibility first, not platform migration first.

## Brownfield Evidence vs Inference Notes
### Evidence
- `dailycoding-server/src/services/judge.js` contains the current Docker sandbox judge.
- The same file already contains a partial native subprocess judge direction.
- Railway deployment config exists in `dailycoding-server/railway.json`.

### Inference
- The most likely best next step is planning around the existing native-judge direction rather than inventing a totally new judging architecture from scratch.

## Technical Context Findings
- Frontend: React/Vite app under `dailycoding`
- Backend: Node/Express app under `dailycoding-server`
- Judging logic currently centers in `dailycoding-server/src/services/judge.js`
- Deployment artifacts indicate Railway is an intended hosting target

## Residual Risks / Unresolved Warnings
- The exact Python runtime/isolation model and Railway process limits still need technical planning.
- Security hardening details for native subprocess execution are not yet specified.
- Performance ceilings for native execution on Railway still need evaluation.

## Next Recommended Lane
- Recommended: `$ralplan .omx/specs/deep-interview-railway-native-judge-phase1.md`

## Handoff Options
### `$ralplan` / `$plan --consensus` (Recommended)
Use this spec as the requirements source of truth and produce a bounded architecture/implementation plan for the Railway-compatible Python MVP judge path.

### `$autopilot`
Use this only if you want direct planning/execution without another consensus gate.

### `$ralph`
Use this only after a plan exists or if you intentionally want persistent execution pressure against this spec.

### `$team`
Use this only if the implementation plan becomes coordination-heavy.

### `refine further`
Re-enter the interview only if you want tighter criteria around isolation/security/performance before planning.
