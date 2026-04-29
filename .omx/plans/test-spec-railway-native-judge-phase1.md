# Test Spec: Railway-Compatible Native Judge Phase 1

## Objective
Verify that the phase-1 Railway-native judging plan is concrete, bounded, and testable for a Python-only MVP through the main submissions flow.

## Test Areas

### 1. Architecture grounding
- Confirm the plan identifies the current Docker judge and partial native judge in `dailycoding-server/src/services/judge.js`.
- Confirm the plan identifies that `submissions` already falls back to native and that `battles` remains Docker-only.
- Expected result: the plan is anchored to actual repo behavior, not assumptions.

### 2. Phase-1 boundary
- Confirm the plan keeps Railway as the default deployment target.
- Confirm the plan excludes free-platform comparison, new feature work, and battle code-judge parity from phase 1.
- Expected result: phase 1 remains narrow and execution-safe.

### 3. Python-only native contract
- Confirm the plan states that native/Railway mode is Python-only.
- Confirm the plan names the exact touchpoints for non-Python handling:
  - `dailycoding-server/src/routes/submissions.js`
  - `dailycoding-server/src/services/judge.js`
  - `dailycoding/src/pages/JudgePage.jsx`
- Expected result: executors do not have to infer phase-1 non-Python behavior.

### 4. Deterministic native-mode verification
- Confirm the plan requires a deterministic native-mode switch or override (for example `JUDGE_MODE=native`).
- Confirm the verification path names the relevant API checks:
  - `/api/submissions`
  - `/api/submissions/:id/code`
  - `/api/judge/status`
- Expected result: Railway-native proof does not depend on incidental Docker availability.

### 5. Submissions-route execution matrix
- Confirm the verification matrix covers native-mode Python behavior for:
  - correct answer
  - wrong answer
  - runtime error
  - timeout
  - persistence/response correctness
  - explicit unsupported behavior for non-Python
  - native subprocess wording in judge status
- Expected result: the MVP success bar is operational, not vague.

### 6. Deferred battle scope
- Confirm battle-route contract drift is documented as a known deferred gap, not accidental scope.
- Expected result: battle parity is not implicitly pulled into phase 1.

### 7. Phase-2 escalation clarity
- Confirm the ADR states that an extracted worker/service is the next escalation path if in-process native execution proves materially unsafe or unstable.
- Expected result: the plan preserves a credible next step without widening phase 1.

## Verification Method
- Manual line-check of the final PRD against the requirements spec and repo evidence.
- Confirm each acceptance criterion has a matching verification area.
- Completion condition: all test areas pass, with zero unresolved blocker gaps in phase-1 scope or verification.