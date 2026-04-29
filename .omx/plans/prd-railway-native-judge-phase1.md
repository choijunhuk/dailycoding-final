# PRD: Railway-Compatible Native Judge Phase 1

## Requirements Summary
Produce a bounded phase-1 plan for DailyCoding's judge architecture so the backend can keep using Railway while replacing the current Docker-dependent judging path with a Railway-compatible native subprocess path. Phase 1 should target Python only, make the submit -> execute -> answer-compare flow reliable, and defer both free-platform comparison and new feature work.

## Grounded Context / File References
- Requirements source of truth: `.omx/specs/deep-interview-railway-native-judge-phase1.md`
- Current Docker judge and partial native judge coexist in `dailycoding-server/src/services/judge.js:1-316`
- Submission route already falls back from Docker to native judging: `dailycoding-server/src/routes/submissions.js:9-90`
- Submission route comments / judge-status response still describe fallback as `Piston API`, not native subprocess: `dailycoding-server/src/routes/submissions.js:18-21,73-76,150-155`
- Battle coding route remains Docker-only and returns 503 when Docker is unavailable: `dailycoding-server/src/routes/battles.js:180-231`
- Railway deployment currently builds from `dailycoding-server/Dockerfile`, which already installs `python3`, `gcc/g++`, and `openjdk21`: `dailycoding-server/Dockerfile:1-13`
- Railway deployment config exists: `dailycoding-server/railway.json:1-11`

## Acceptance Criteria
1. The plan clearly identifies the current split between Docker judging and partial native subprocess judging.
2. The plan keeps Railway as the default deployment target for phase 1 and does not require free-platform comparison.
3. The phase-1 MVP is Python-only.
4. The phase-1 success bar is explicit: a Python submission can be stored, executed, and correctness-checked reliably through the main submission flow on Railway.
5. The plan explicitly addresses operational mismatches in the current backend, including route behavior and wording drift around the judge mode.
6. The plan explicitly defers battle code-judge parity, broad platform comparison, and new feature work from phase 1.
7. The plan defines explicit phase-1 behavior for non-Python submissions while native/Railway mode is active.
8. The plan defines a deterministic way to force native mode during verification.
9. Verification steps are concrete enough to prove the Railway-compatible path works before broader rollout.

## Current Contract Gaps
- `dailycoding-server/src/routes/submissions.js` correctly selects native fallback when Docker is unavailable, but the route comments and judge-status output still describe the non-Docker mode as `Piston API`.
- `dailycoding-server/src/routes/battles.js` remains Docker-only for code judging and returns 503 when Docker is unavailable.
- `dailycoding-server/src/routes/battles.js` passes `testCases` and millisecond `timeLimit` values into `judgeCode()`, while the current judge contract is built around `examples` plus second-based `timeLimit`.
- `dailycoding-server/src/routes/battles.js` destructures `timeMs` / `memoryMb` from a judge result shape that currently returns `time` / `mem`, which indicates unresolved contract drift even before Railway-native parity is considered.

## RALPLAN-DR Summary
### Principles
1. Optimize for Railway compatibility first, not maximal sandbox sophistication.
2. Prefer completing the existing native subprocess path over inventing a new architecture from scratch.
3. Keep the phase-1 surface narrow: Python first, main submission path first.
4. Separate MVP correctness from later hardening/expansion work.
5. Make runtime behavior and operator messaging consistent with the actual backend mode.

### Decision Drivers
1. Docker-based judging is not practical for the intended Railway deployment path.
2. The repository already contains a partial native subprocess judge, lowering migration cost.
3. A one-language Railway-compatible MVP is acceptable and preferable to over-scoping phase 1.

### Viable Options
#### Option A — Complete the existing in-process native subprocess judge path (Recommended)
- Pros: Reuses existing code; smallest architectural jump; fits Railway-retention goal; fastest path to Python MVP.
- Cons: Weaker isolation than a true container sandbox; requires careful hardening and explicit limits.

#### Option B — Extract judging to a separate worker/service while keeping the app on Railway
- Pros: Centralizes judge-contract normalization, isolates execution from the request-serving API process, creates a cleaner boundary for concurrency control, and provides a stronger stepping stone toward later multi-language support or stronger isolation.
- Cons: Adds operational complexity, introduces inter-service communication and deployment coordination earlier, and exceeds the user’s preferred phase-1 scope unless the in-process native path proves materially unsafe or unstable.

#### Option C — Re-open platform selection now and move judging elsewhere
- Pros: Could improve isolation or runtime freedom if a clearly better free platform exists.
- Cons: Explicitly out of scope for phase 1 and reintroduces the broad comparison the user deferred.

**Recommended:** Option A.

## Implementation Steps
1. **Audit and normalize the current judge execution contract.**
   - Inspect `dailycoding-server/src/services/judge.js` to document the exact gaps between `judgeCode()` and `judgeCodeNative()` for Python-only production use.
   - Identify inconsistent API shapes (`time` vs `timeMs`, `examples`/`testCases` naming, result fields) that could cause route-level bugs or hidden incompatibility between Docker and native paths.
   - Record the current contract gaps explicitly:
     - `submissions` uses the native fallback but still labels the mode as `Piston API`.
     - `battles` sends `testCases` instead of the current `examples` contract.
     - `battles` multiplies `timeLimit` by `1000` even though `judgeCode()` expects seconds.
     - `battles` destructures `timeMs` / `memoryMb` from a judge response that currently returns `time` / `mem`.
2. **Make the main submission flow natively reliable for Python.**
   - Treat `dailycoding-server/src/routes/submissions.js` as the phase-1 primary path.
   - Ensure the non-Docker path has a consistent input contract, correct testcase sourcing, stable timeout behavior, and consistent response formatting.
   - Update user/operator-facing mode labeling so the code no longer claims `Piston API fallback` when it actually uses native subprocess execution.
   - Define the explicit phase-1 contract for non-Python languages in native/Railway mode: submissions remain Python-only for native execution; the backend rejects non-Python native submissions with a clear unsupported response, and the UI narrows the Railway-native judge surface to Python for this MVP.
   - Expected phase-1 file touchpoints for this contract:
     - `dailycoding-server/src/routes/submissions.js`
     - `dailycoding-server/src/services/judge.js`
     - `dailycoding/src/pages/JudgePage.jsx`
3. **Define Railway-specific runtime and safety requirements for the Python MVP.**
   - Verify that the current `dailycoding-server/Dockerfile` runtime dependencies are sufficient for Python-only native execution on Railway.
   - Specify minimum process/resource controls for phase 1 (timeouts, temp-dir cleanup, stdout/stderr handling, code size limit reuse, and basic subprocess limits already present via `ulimit`).
   - Explicitly note the temporary safety downgrade versus Docker: phase 1 accepts subprocess limits (`ulimit`, timeout, temp-dir cleanup, minimal env) even though it loses Docker-era controls such as disabled networking and container-level memory/pid isolation; stronger isolation is deferred.
   - Add a deterministic native-mode switch for verification and operations (for example `JUDGE_MODE=native|auto|docker` or an equivalent override around `isDockerAvailable()`), so Railway-path testing does not depend on the local host’s Docker state.
4. **Decide the battle-route posture for phase 1.**
   - Audit `dailycoding-server/src/routes/battles.js` and explicitly defer battle code-judge parity in phase 1 unless scope is intentionally widened by a later approved plan.
   - Document battle code-judge as unsupported for the Railway/Python MVP until the shared judge contract is normalized and the main submissions flow is proven stable.
   - Treat the existing battle-route contract mismatches as **known deferred gaps**, not as phase-1 repair work.
5. **Sequence post-MVP expansion work separately.**
   - After Python MVP validation, define later phases for JavaScript and other languages, stronger isolation, improved memory measurement, and optional platform comparison if Railway proves materially limiting.

## Risks and Mitigations
- **Risk:** Native subprocess execution reduces isolation compared with Docker.
  - **Mitigation:** Keep phase 1 Python-only, preserve strict time/process limits, cleanup temp dirs, and document security hardening as a separate follow-up lane.
- **Risk:** In-process native execution may create latency, concurrency, or safety pressure on the main API process.
  - **Mitigation:** Treat an extracted judge worker/service as the defined escalation path if the in-process MVP proves materially unsafe or unstable.
- **Risk:** Route-level behavior diverges because Docker and native judge outputs are not fully normalized.
  - **Mitigation:** Make response-shape parity and testcase-contract parity explicit in phase 1.
- **Risk:** Scope expands into battle-mode parity or multi-language support too early.
  - **Mitigation:** Keep the MVP centered on the main submissions route and explicitly defer battle parity and multi-language work to later phases.
- **Risk:** Railway process constraints or runtime packaging gaps break the native path in production.
  - **Mitigation:** Include Railway-specific smoke verification and deployment-environment checks before declaring phase 1 complete.

## Verification Steps
1. Confirm the plan maps the current judge architecture with concrete file references.
2. Confirm the phase-1 implementation target is Python-only on Railway.
3. Confirm the plan explicitly repairs the known contract gaps:
   - `submissions` mode wording drift
   - deterministic native-mode Python-only behavior on the submissions path
   - explicit UI/backend alignment for non-Python handling in native mode
4. Confirm operator/user-visible mode labels reflect native subprocess execution rather than Piston.
5. Confirm the plan explicitly defers battle code-judge parity in phase 1.
6. Confirm the phase-1 verification matrix for the **submissions route under native mode** includes:
   - correct Python solution
   - wrong answer
   - runtime error
   - timeout
   - non-Python submission receives the intended explicit phase-1 unsupported behavior
   - submission persistence / API response formatting remains correct after native execution
   - native subprocess wording in judge-status / operator output
7. Confirm the plan defines a deterministic native-mode verification mechanism, such as an explicit `JUDGE_MODE=native` switch or equivalent override for `isDockerAvailable()`, and uses it for `/api/submissions`, `/api/submissions/:id/code`, and `/api/judge/status` checks.
8. Confirm later phases for multi-language expansion, stronger isolation, and optional extracted-worker escalation are separated from the MVP.

## ADR
- **Decision:** Complete the existing native subprocess path for Python as the Railway-compatible phase-1 judging solution.
- **Drivers:** Railway retention, bounded scope, existing code investment, fast path to usable judging.
- **Alternatives considered:** Separate judge service; immediate platform comparison.
- **Why chosen:** The repository already points toward native judging, and the user explicitly prefers a Railway-first, one-language MVP over a broad architecture reset.
- **Consequences:** Phase 1 reaches usability faster, but strong isolation, battle parity, multi-language parity, and possible platform re-evaluation move into later phases. If in-process native execution causes unacceptable latency/concurrency/security exposure, the next escalation step is an extracted judge worker/service before multi-language expansion.
- **Follow-ups:** After Python MVP validation, plan language expansion and revisit deployment/platform options only if Railway-native judging proves materially limiting.

## Available-Agent-Types Roster
- `executor` — implementation lane for backend judge-path changes
- `architect` — design/tradeoff verification lane
- `test-engineer` — verification and regression design lane
- `verifier` — completion evidence lane
- `writer` — operator/dev-doc wording cleanup lane

## Follow-up Staffing Guidance
### For `$ralph`
- 1 `executor` (high) for judge-service and route alignment
- 1 `test-engineer` (medium) for phase-1 verification scaffolding
- 1 `verifier` (high) for final Railway-path proof and regression summary
- Best when implementation remains mostly in the backend judge path

### For `$team`
- 1 `executor` (high) for `judge.js` + submission flow updates
- 1 `test-engineer` (medium) for verification harness / smoke-test coverage
- 1 `architect` (high) for safety boundary review and battle-route defer/keep decision
- 1 `writer` (medium) for README / mode-label / operator messaging alignment if needed
- Best when the work splits into code, validation, and docs in parallel

## Launch Hints
- Ralph path: `$ralph .omx/plans/prd-railway-native-judge-phase1.md`
- Team path: `omx team 4 ".omx/plans/prd-railway-native-judge-phase1.md"` or `$team 4 ".omx/plans/prd-railway-native-judge-phase1.md"`

## Team Verification Path
- Team proves the Python MVP judge path works through the main submissions route under Railway-compatible native execution assumptions.
- Team proves battle-route parity remains explicitly deferred and documented as a known non-phase-1 gap.
- A verifier/Ralph pass confirms the final backend behavior, wording, and deployment assumptions all match the approved phase-1 scope.
