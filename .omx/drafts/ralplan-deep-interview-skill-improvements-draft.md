# Draft Plan: Deep-Interview Skill Improvements

## Requirements Summary
Improve `/Users/choi/.codex/skills/deep-interview/SKILL.md` so the workflow remains intent-first and rigorous, but its execution contract becomes clearer, more internally consistent, and easier for runtime agents to follow. The plan should preserve the skill's core philosophy while tightening operational details that currently risk drift or dead ends.

## Evidence / File References
- Tool contract ambiguity appears across `Execution_Policy` and questioning steps: lines 42-59, 147-173, 297-303.
- State initialization underspecifies later-required tracking: lines 86-107 vs later use in 156-189.
- Mandatory readiness gates are separated from weighted ambiguity scoring: lines 156-167.
- Project type classification is binary (`greenfield|brownfield`) at lines 83-85 and 95.
- Artifact generation is globally required in Phase 4 / checklist regardless of profile: lines 193-216 and 313-325.
- Challenge mode activation is largely round-number driven: lines 181-189 and 306-310.
- Handoff naming and autoresearch sections have minor duplication / consistency issues: lines 220-240 and 246-289.

## Acceptance Criteria
1. The skill defines one explicit tool-resolution order for asking questions and for persistence, including a plain-text fallback when structured input tooling is unavailable and explicit behavior when persistence tooling is absent.
2. The skill's stop/crystallization rules cannot claim readiness while `Non-goals`, `Decision Boundaries`, or pressure-pass completion remain unresolved.
3. The documented state schema includes the fields needed to track dimension scores, gate status, challenge modes, and exit reason throughout the workflow.
4. Project/task context classification uses a concrete supported taxonomy (for example `greenfield | brownfield | meta`) rather than example-only wording.
5. Profile guidance clearly distinguishes lightweight `--quick` behavior from heavier `--standard` / `--deep` artifact expectations.
6. Challenge-mode triggers rely primarily on conversation signals and stall patterns, not only raw round numbers.
7. Terminology and handoff wording remain internally consistent across the deep-interview document; any necessary follow-up alignment for `plan` / `ralplan` is called out explicitly.
8. The deep-interview execution bridge remains compatible with the downstream planning/handoff contract already described in `/Users/choi/.codex/skills/plan/SKILL.md` and `/Users/choi/.codex/skills/ralplan/SKILL.md`, or the plan explicitly states the trigger for broadening scope to synchronize those documents.

## RALPLAN-DR Summary
### Principles
1. Preserve deep-interview's intent-first philosophy.
2. Prefer explicit runtime contracts over implied behavior.
3. Keep revisions small, reviewable, and reversible.
4. Separate readiness gating from cosmetic scoring.
5. Reduce operator burden in lighter profiles.

### Decision Drivers
1. Prevent runtime confusion caused by mixed tool contracts and underspecified state.
2. Make completion criteria mechanically consistent so agents do not exit too early.
3. Improve maintainability without rewriting the workflow into a different skill.

### Viable Options
#### Option A — Focused deep-interview contract cleanup
- Pros: Smallest diff; directly addresses the issues surfaced in review; lowest regression risk.
- Cons: Leaves cross-skill wording alignment as a follow-up instead of solving every related doc inconsistency now; needs explicit compatibility guards so deferral stays safe.

#### Option B — Cross-skill harmonization pass (`deep-interview` + `plan` + `ralplan`)
- Pros: Stronger documentation consistency across the planning pipeline.
- Cons: Larger write scope; more review overhead; higher chance of incidental wording churn.

**Recommended:** Option A, with explicit follow-up notes if plan/ralplan wording must later be harmonized.

## Implementation Steps
1. **Normalize runtime contract in `deep-interview/SKILL.md`.**
   - Update question/persistence tool guidance at lines 42-59, 147-173, and 297-303 so the document states one ordered fallback path.
   - Clarify that unavailable structured tooling must degrade to a single concise plain-text question rather than blocking.
   - Pin the persistence order explicitly: first `state_write/state_read` when available; otherwise continue with an in-turn summary plus artifact-file writes to `.omx/context/`, `.omx/interviews/`, and `.omx/specs/`, and mark resume safety as degraded rather than blocked.
2. **Repair readiness and state-model consistency.**
   - Expand the initialization schema around lines 86-107 to include dimension scores, gate status, challenge-mode history, evidence/inference tracking, and exit reason.
   - Rewrite scoring/readiness language around lines 156-167 so weighted ambiguity never overrides unresolved mandatory gates.
3. **Right-size workflow branching and artifact policy.**
   - Replace the binary type wording near lines 83-85 and 95 with the explicit supported taxonomy `greenfield | brownfield | meta`, where `meta` covers skill/doc/process review tasks.
   - Refine Phase 4 and checklist language at lines 193-216 and 313-325 to distinguish quick-mode lightweight outputs from standard/deep artifact expectations.
   - Define a minimum `--quick` handoff schema so even lighter exits still preserve: requirements summary, unresolved risks, non-goals, decision boundaries, and next recommended lane.
4. **Tighten adaptive challenge and handoff wording.**
   - Replace primarily round-number-based challenge triggers at lines 181-189 and 306-310 with signal-based triggers plus round thresholds as guardrails.
   - Remove minor naming/duplication drift in autoresearch + execution bridge sections at lines 220-240 and 246-289.
   - Cross-check the execution-bridge wording against `/Users/choi/.codex/skills/plan/SKILL.md:71-112,276-278` and `/Users/choi/.codex/skills/ralplan/SKILL.md:37-42` so the alias/handoff language remains compatible.
   - Define a scope-widening trigger: if the final deep-interview wording would require semantic changes (not just alias wording) to `plan` or `ralplan` handoff behavior, broaden into a follow-up alignment plan; otherwise keep the first pass single-file and record only a note.
5. **Run document verification.**
   - Re-read the skill as an execution contract.
   - Verify every acceptance criterion maps to a concrete section.
   - Explicitly compare the final deep-interview handoff wording against the downstream `plan` and `ralplan` skill contracts.
   - If wording changes create pipeline drift, capture explicit follow-up notes for `/Users/choi/.codex/skills/plan/SKILL.md` and `/Users/choi/.codex/skills/ralplan/SKILL.md` without broadening the initial change unnecessarily.

## Risks and Mitigations
- **Risk:** Over-correcting into a broader workflow rewrite.
  - **Mitigation:** Keep the write scope focused on contract clarity, gating, and profile right-sizing.
- **Risk:** Quick-mode slimming conflicts with final checklist requirements.
  - **Mitigation:** Explicitly split required outputs by profile and preserve residual-risk reporting for lighter exits.
- **Risk:** Cross-skill terminology drift remains after a single-file edit.
  - **Mitigation:** Add an explicit alignment note and only broaden scope if concrete mismatches remain after the targeted revision.
- **Risk:** Quick-mode slimming removes too much structure and weakens downstream handoff quality.
  - **Mitigation:** Require a minimum quick-mode handoff schema and preserve residual-risk warnings.

## Verification Steps
1. Confirm all acceptance criteria are represented in the updated skill text.
2. Confirm tool fallback order is unambiguous and does not mention unavailable tools as requirements.
3. Confirm readiness gates remain mandatory regardless of the numeric ambiguity score.
4. Confirm the state schema supports all later-referenced fields.
5. Confirm quick-mode artifact expectations are lighter than standard/deep without removing safety warnings.
6. Confirm the final deep-interview handoff wording is still compatible with the current `plan` and `ralplan` skill contracts.
7. Confirm no direct-implementation instruction was introduced.

## ADR
- **Decision:** Use a focused deep-interview contract cleanup as the first pass.
- **Drivers:** Runtime clarity, gate consistency, maintainability, limited write scope.
- **Alternatives considered:** Full cross-skill harmonization immediately; keep the skill unchanged and rely on agent judgment.
- **Why chosen:** The identified problems are concentrated in the deep-interview contract itself, and current alias drift appears manageable as long as this pass includes explicit compatibility checks and a minimum quick-handoff contract.
- **Consequences:** The initial diff remains small, but the plan now carries a hard trigger to widen scope if compatibility checks show substantive downstream mismatch.
- **Follow-ups:** If final review finds pipeline wording drift beyond minor alias cleanup, create a narrow follow-up plan covering `plan` and `ralplan` alignment.

## Available-Agent-Types Roster
- `executor` — implementation/edit lane for the approved documentation changes
- `planner` — plan drafting and sequencing
- `architect` — tradeoff review and structure validation
- `critic` — quality gating and acceptance-criteria enforcement
- `writer` — documentation polish if execution later needs copy cleanup
- `verifier` — completion-evidence check after edits

## Follow-up Staffing Guidance
### For `$ralph`
- Suggested lanes: 1 `executor` (high) for doc edits, 1 `verifier` (high) for contract validation.
- Why: This is likely a narrow, sequential documentation cleanup with explicit verification checkpoints.

### For `$team`
- Suggested lanes: 1 `executor` (high) for the skill-doc edit, 1 `writer` (medium) for copy consistency, 1 `verifier` (high) for acceptance-criteria audit.
- Why: Only useful if the scope expands into cross-skill harmonization.

## Launch Hints
- Ralph path: `$ralph .omx/plans/prd-deep-interview-skill-improvements.md`
- Team path: `omx team 3 ".omx/plans/prd-deep-interview-skill-improvements.md"` or `$team 3 ".omx/plans/prd-deep-interview-skill-improvements.md"`, only if the compatibility trigger widens scope beyond the single-file pass.

## Team Verification Path
- Team proves the deep-interview skill text satisfies the agreed acceptance criteria and flags any cross-skill drift.
- Ralph (or a verifier pass) confirms the final contract is internally consistent, profile-aware, and still requirements-only.
