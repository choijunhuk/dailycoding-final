# Test Spec: Deep-Interview Skill Improvements

## Objective
Verify that the revised `deep-interview` skill contract is internally consistent, profile-aware, compatible with `plan` / `ralplan`, and still limited to requirements-mode behavior.

## Test Areas

### 1. Tool-resolution contract
- Check the skill states one ordered fallback path for:
  - asking interview questions
  - persistence / resume safety
- Expected result: unavailable structured tooling degrades gracefully instead of blocking.

### 2. Readiness-gate enforcement
- Check that `Non-goals`, `Decision Boundaries`, and pressure-pass completion remain mandatory even if weighted ambiguity is below threshold.
- Expected result: no wording allows numeric score alone to trigger crystallization.

### 3. State schema completeness
- Check the initialization schema covers:
  - dimension scores
  - gate status
  - challenge-mode history
  - evidence/inference notes
  - exit reason
- Expected result: every later-referenced field exists in the documented schema.

### 4. Context taxonomy coverage
- Check that task typing is explicit as `greenfield | brownfield | meta`.
- Expected result: skill/doc/process review cases are representable without awkward brownfield/greenfield stretching.

### 5. Profile-specific artifact policy
- Check that `--quick` has lighter outputs than `--standard` / `--deep`.
- Expected result: quick mode still preserves minimum handoff data and residual-risk notes.

### 6. Challenge-mode adaptivity
- Check that challenge modes are triggered primarily by conversational signals or stalls, with rounds as guardrails only.
- Expected result: the skill no longer relies mainly on hard-coded round numbers.

### 7. Downstream compatibility
- Compare deep-interview execution-bridge wording against:
  - `/Users/choi/.codex/skills/plan/SKILL.md`
  - `/Users/choi/.codex/skills/ralplan/SKILL.md`
- Expected result: compatible handoff semantics or an explicit documented follow-up trigger for semantic mismatch.

### 8. Requirements-mode boundary
- Check that the skill still says deep-interview must not implement directly.
- Expected result: all execution paths remain handoff-only.

## Verification Method
- Primary: manual contract review of the revised markdown.
- Secondary: grep/line-check confirmation that each acceptance criterion is represented.
- Completion condition: all eight test areas pass with zero unresolved blocker findings.
