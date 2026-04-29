Task statement
- Execute the prompt backlog in `.omc/autopilot/codex-prompts.md` through the autopilot workflow, using the current codebase as the source of truth for what is already done versus still missing.

Desired outcome
- Produce a fresh execution spec and implementation plan grounded in the current repository state.
- Implement and verify the highest-priority unresolved items from the prompt file, starting with the security and near-term backend/frontend fixes.
- Avoid redoing items that are already shipped elsewhere in the codebase.

Known facts / evidence
- The prompt file contains multiple waves of work: `SEC-*`, `BE-*`, `FE-*`, `D-NEW-*`, `PROMPT-*`, and `PROMPT-V3-*`.
- Existing `.omx/plans/autopilot-spec.md` and `.omx/plans/autopilot-impl.md` do not match the current prompt scope; they describe older mission/ranking/rematch work.
- Prior context file `.omx/context/dailycoding-v4-audit-gap-20260421T203434Z.md` confirms several older gaps, but the repository may have changed since then.
- Workspace root is not a git repository; verification must rely on direct file inspection and command output instead of git history.

Constraints
- Follow the repository guidance in `AGENTS.md`.
- Use minimal, reviewable diffs and no new dependencies unless strictly required.
- Use ESM patterns in the backend and preserve existing frontend/backend conventions.
- Run verification after edits and keep moving until evidence is collected or a real blocker appears.

Unknowns / open questions
- Which prompt items are already implemented since the previous v4 context snapshot.
- Whether the full prompt file is still intended as a backlog or whether only the newly added v4 audit tranche remains unresolved.
- Which verification commands are currently available and stable in each app.

Likely codebase touchpoints
- Backend: `dailycoding-server/src/routes`, `dailycoding-server/src/models`, `dailycoding-server/src/middleware`, `dailycoding-server/src/services`
- Frontend: `dailycoding/src/pages`, `dailycoding/src/components`, `dailycoding/src/hooks`, `dailycoding/src/utils`
- Workflow artifacts: `.omx/plans/autopilot-spec.md`, `.omx/plans/autopilot-impl.md`
