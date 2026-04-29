# Team Commit Hygiene Finalization Guide

- team: omx-plans-prd-deep-interview-s
- generated_at: 2026-04-11T18:28:29.155Z
- lore_commit_protocol_required: true
- runtime_commits_are_scaffolding: true

## Suggested Leader Finalization Prompt

```text
Team "omx-plans-prd-deep-interview-s" is ready for commit finalization. Treat runtime-originated commits (auto-checkpoints, merge/cherry-picks, cross-rebases, shutdown checkpoints) as temporary scaffolding rather than final history. Do not reuse operational commit subjects verbatim. Completed task subjects: Implement: .omx/plans/prd-deep-interview-skill-improvements.md | Test: .omx/plans/prd-deep-interview-skill-improvements.md | Review and document: .omx/plans/prd-deep-interview-skill-improvements.md. Rewrite or squash the operational history into clean Lore-format final commit(s) with intent-first subjects and relevant trailers. Use task subjects/results and shutdown diff reports to choose semantic commit boundaries and rationale.
```

## Task Summary

- task-1 | status=completed | owner=worker-1 | subject=Implement: .omx/plans/prd-deep-interview-skill-improvements.md
  - description: Implement the core functionality for: .omx/plans/prd-deep-interview-skill-improvements.md
  - result_excerpt: Updated /Users/choi/.codex/skills/deep-interview/SKILL.md to match the PRD/test-spec.

Changes:
- Added one explicit Tool_Resolution_Order with structured-question, plain-text, and degraded-resume fallbacks.
- Expanded the documented state…
- task-2 | status=completed | owner=worker-2 | subject=Test: .omx/plans/prd-deep-interview-skill-improvements.md
  - description: Write tests and verify: .omx/plans/prd-deep-interview-skill-improvements.md
  - result_excerpt: Verification: PASS — PRD acceptance criteria 1-8 are mirrored by .omx/plans/test-spec-deep-interview-skill-improvements.md; PASS — plan/ralplan compatibility remains semantically consistent; FAIL (expected upstream gap) — /Users/choi/.code…
- task-3 | status=completed | owner=worker-2 | subject=Review and document: .omx/plans/prd-deep-interview-skill-improvements.md
  - description: Review code quality and update documentation for: .omx/plans/prd-deep-interview-skill-improvements.md
  - result_excerpt: Documentation complete: .omx/drafts/worker-2-deep-interview-skill-improvements-review.md records the PRD/test-spec verification, line references, and the expected upstream skill gaps (dimension_scores and exit_reason).

## Runtime Operational Ledger

- No runtime-originated commit activity recorded.

## Finalization Guidance

1. Treat `omx(team): ...` runtime commits as temporary scaffolding, not as the final PR history.
2. Reconcile checkpoint, merge/cherry-pick, cross-rebase, and shutdown checkpoint activity into semantic Lore-format final commit(s).
3. Use task outcomes, code diffs, and shutdown diff reports to name and scope the final commits.

## Recommended Next Steps

1. Inspect the current branch diff/log and identify which runtime-originated commits should be squashed or rewritten.
2. Derive semantic commit boundaries from completed task subjects, code diffs, and shutdown reports rather than from omx(team) operational commit subjects.
3. Create final commit messages in Lore format with intent-first subjects and only the trailers that add decision context.
