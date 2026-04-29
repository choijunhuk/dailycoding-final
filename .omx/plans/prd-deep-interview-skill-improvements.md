# PRD: Deep-Interview Skill Improvements

## Requirements Summary
Improve `/Users/choi/.codex/skills/deep-interview/SKILL.md` so the workflow stays intent-first and rigorous while its runtime contract becomes clearer, more internally consistent, and easier for downstream agents to execute. Preserve the core philosophy; tighten the execution details.

## Context
- Context snapshot: `.omx/context/deep-interview-skill-improvements-20260411T174929Z.md`
- Primary target: `/Users/choi/.codex/skills/deep-interview/SKILL.md`
- Compatibility check targets:
  - `/Users/choi/.codex/skills/plan/SKILL.md`
  - `/Users/choi/.codex/skills/ralplan/SKILL.md`

## Evidence / File References
- Mixed tool contract wording: `deep-interview/SKILL.md:42-59`, `:147-173`, `:297-303`
- Underspecified initial state vs later workflow needs: `:86-107`, `:156-189`
- Numeric ambiguity vs mandatory readiness gates: `:156-167`
- Binary context typing only: `:83-85`, `:95`
- Artifact burden and checklist weight across all profiles: `:193-216`, `:313-325`
- Challenge trigger rigidity: `:181-189`, `:306-310`
- Handoff/alias compatibility seam: `deep-interview/SKILL.md:242-293`, `plan/SKILL.md:71-112`, `plan/SKILL.md:276-278`, `ralplan/SKILL.md:37-67`

## Acceptance Criteria
1. The skill defines one explicit tool-resolution order for interview questioning and persistence, including plain-text and degraded-resume fallbacks.
2. The skill cannot crystallize or hand off while `Non-goals`, `Decision Boundaries`, or pressure-pass completion remain unresolved, regardless of weighted ambiguity score.
3. The documented state schema includes dimension scores, gate status, challenge-mode history, evidence/inference tracking, and exit reason.
4. The context-type model is explicit and concrete: `greenfield | brownfield | meta`, with `meta` covering skill/doc/process review tasks.
5. `--quick` has a lighter output policy than `--standard` / `--deep`, but still preserves minimum handoff data: requirements summary, unresolved risks, non-goals, decision boundaries, and next recommended lane.
6. Challenge-mode activation depends primarily on dialogue signals/stalls, with round counts used only as guardrails.
7. Deep-interview handoff wording remains compatible with current `plan` / `ralplan` contracts, or the change records a narrow follow-up trigger if semantic cross-skill alignment is required.
8. No direct implementation behavior is introduced into the deep-interview skill.

## RALPLAN-DR Summary
### Principles
1. Preserve deep-interview's intent-first philosophy.
2. Prefer explicit runtime contracts over implied behavior.
3. Keep revisions small, reviewable, and reversible.
4. Separate readiness gating from cosmetic scoring.
5. Reduce operator burden in lighter profiles.

### Decision Drivers
1. Prevent runtime confusion from mixed tool contracts and underspecified state.
2. Make completion rules mechanically consistent so agents do not exit too early.
3. Improve maintainability without turning deep-interview into a different workflow.

### Viable Options
#### Option A — Focused deep-interview contract cleanup
- Pros: Small diff, directly targets the surfaced issues, lowest regression risk.
- Cons: Requires explicit compatibility checks so deferring broad cross-skill harmonization stays safe.

#### Option B — Cross-skill harmonization pass (`deep-interview` + `plan` + `ralplan`)
- Pros: Stronger documentation consistency across the planning pipeline.
- Cons: Larger write scope, more review overhead, higher wording churn risk.

**Decision:** Start with Option A. Widen only if the compatibility check reveals semantic downstream mismatch.

## Implementation Steps
1. **Normalize runtime contract in `deep-interview/SKILL.md`.**
   - Unify tool-order guidance across questioning and persistence sections.
   - Pin the persistence fallback order: `state_write/state_read` when available; otherwise degrade to in-turn summary + artifact-file writes and explicitly mark resume safety as degraded rather than blocked.
2. **Repair readiness and state-model consistency.**
   - Expand the initialization schema to include dimension scores, gate status, challenge-mode history, evidence/inference tracking, and exit reason.
   - Rewrite scoring/readiness wording so mandatory gates override numeric ambiguity thresholds.
3. **Right-size branching and profile output policy.**
   - Replace binary task typing with explicit `greenfield | brownfield | meta` taxonomy.
   - Define a minimum quick-mode handoff schema and separate it from heavier standard/deep artifact expectations.
4. **Tighten adaptive challenge and handoff wording.**
   - Shift challenge-mode triggers toward signal-based activation, using round counts as guardrails only.
   - Remove minor naming/duplication drift in autoresearch and execution-bridge sections.
   - Cross-check the deep-interview bridge against `plan`/`ralplan`; if the new wording would require semantic changes in those skills, stop widening the current edit and instead record a narrow follow-up alignment task.
5. **Verify the document as an execution contract.**
   - Re-read for consistency, coverage, compatibility, and requirements-only behavior.

## Risks and Mitigations
- **Risk:** The edit broadens into a workflow rewrite.
  - **Mitigation:** Keep scope limited to contract clarity, gating, profile right-sizing, and compatibility checks.
- **Risk:** Quick-mode slimming removes too much structure.
  - **Mitigation:** Require a minimum quick-mode handoff schema plus residual-risk reporting.
- **Risk:** Cross-skill drift remains after a single-file pass.
  - **Mitigation:** Run explicit compatibility verification and widen only on semantic mismatch.

## Verification Steps
1. Confirm each acceptance criterion maps to a concrete section of the revised skill.
2. Confirm tool fallback order is explicit and unavailable tools are never mandatory.
3. Confirm readiness gates remain mandatory regardless of ambiguity score.
4. Confirm the state schema now supports all later-referenced fields.
5. Confirm `--quick` is lighter than `--standard` / `--deep` without losing safety warnings.
6. Confirm final handoff wording remains compatible with `plan` and `ralplan`.
7. Confirm the skill still forbids direct implementation in deep-interview mode.

## ADR
- **Decision:** Use a focused deep-interview contract cleanup as the first pass.
- **Drivers:** Runtime clarity, gate consistency, maintainability, limited write scope.
- **Alternatives considered:** Immediate full cross-skill harmonization; leave the skill unchanged and rely on agent judgment.
- **Why chosen:** The concrete defects are concentrated in the deep-interview contract, and a focused repair yields the highest value with the least churn.
- **Consequences:** The first pass stays small, but a follow-up may be required if compatibility verification finds semantic drift in `plan` or `ralplan`.
- **Follow-ups:** If compatibility verification fails, create a narrow documentation-alignment plan for `plan` and `ralplan`.

## Available-Agent-Types Roster
- `executor` — implementation/edit lane for approved documentation changes
- `planner` — plan drafting and sequencing
- `architect` — tradeoff review and structure validation
- `critic` — quality gating and acceptance-criteria enforcement
- `writer` — documentation polish if execution needs copy cleanup
- `verifier` — completion-evidence check after edits

## Follow-up Staffing Guidance
### For `$ralph`
- 1 `executor` (high) for the deep-interview skill edit
- 1 `verifier` (high) for contract-validation pass
- Best when the change remains a narrow single-file documentation fix

### For `$team`
- 1 `executor` (high) for the skill-doc edit
- 1 `writer` (medium) for copy consistency and section cleanup
- 1 `verifier` (high) for acceptance-criteria audit and compatibility re-check
- Best when scope widens into cross-skill harmonization

## Launch Hints
- Ralph path: `$ralph .omx/plans/prd-deep-interview-skill-improvements.md`
- Team path: `omx team 3 ".omx/plans/prd-deep-interview-skill-improvements.md"` or `$team 3 ".omx/plans/prd-deep-interview-skill-improvements.md"`

## Team Verification Path
- Team proves the revised deep-interview skill satisfies the acceptance criteria and flags any cross-skill semantic drift.
- A verifier/Ralph pass confirms the final contract is internally consistent, profile-aware, compatible with `plan` / `ralplan`, and still requirements-only.

## Consensus Changelog
- Added compatibility acceptance criteria for deep-interview ↔ plan/ralplan handoff.
- Added minimum quick-mode handoff schema.
- Pinned explicit tool and persistence fallback expectations.
- Added concrete scope-widening trigger for cross-skill alignment.
- Aligned staffing roster with execution lanes and launch hints.
