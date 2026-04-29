# Team Commit Hygiene Finalization Guide

- team: dailycoding-1-ui-2-3-seed
- generated_at: 2026-04-14T23:15:55.607Z
- lore_commit_protocol_required: true
- runtime_commits_are_scaffolding: true

## Suggested Leader Finalization Prompt

```text
Team "dailycoding-1-ui-2-3-seed" is ready for commit finalization. Treat runtime-originated commits (auto-checkpoints, merge/cherry-picks, cross-rebases, shutdown checkpoints) as temporary scaffolding rather than final history. Do not reuse operational commit subjects verbatim. Use the completed task descriptions and resulting diffs to infer semantic commit boundaries. Rewrite or squash the operational history into clean Lore-format final commit(s) with intent-first subjects and relevant trailers. Use task subjects/results and shutdown diff reports to choose semantic commit boundaries and rationale.
```

## Task Summary

- task-1 | status=in_progress | owner=worker-1 | subject=특수유형 문제 생성/수정 UI + 서버연동 완성
  - description: 특수유형 문제 생성/수정 UI + 서버연동 완성
- task-2 | status=in_progress | owner=worker-2 | subject=배틀 문제 구성 비율(코딩/빈칸/버그)과 문제 수를 관리자에서 실시간 변경 가능
  - description: 배틀 문제 구성 비율(코딩/빈칸/버그)과 문제 수를 관리자에서 실시간 변경 가능
- task-3 | status=pending | owner=worker-1 | subject=문제 수 확장(seed) 및 검증(테스트/빌드)까지 완료
  - description: 문제 수 확장(seed) 및 검증(테스트/빌드)까지 완료

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
