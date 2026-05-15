# AI Handoff Guide

Use this when handing DailyCoding work to another AI agent or a future session.

## Fast Start

Generate a task brief:

```bash
node scripts/ai-brief.mjs "Fix <specific issue> in <area>"
```

Paste the output into the next AI session. Add any screenshots, logs, or exact user-facing behavior that changed since the brief was generated.

## Work Slices

Prefer one focused slice per AI task:

- Backend route/model/service fix: own only the touched route, model, service, and nearby tests.
- Frontend page/component fix: own one page/component family and its CSS/util tests.
- Security/config hardening: own config modules, env templates, deployment docs, and tests.
- Test stabilization: own only the flaky test file and the code path it directly proves.
- Documentation: own docs and scripts only unless a code sample must compile.

Avoid asking one AI to change unrelated frontend, backend, deployment, and visual design areas in a single pass.

## Required Brief Fields

Include:

- Goal: what should be true when done.
- Non-goals: what must not be changed.
- Files likely involved.
- Verification commands.
- Known dirty-worktree files that are unrelated.
- Screenshots/logs/error output when UI or runtime behavior matters.

## Default Verification

Backend:

```bash
cd dailycoding-server
npm run lint
npm test
```

Frontend:

```bash
cd dailycoding
npm run lint
npm test
npm run build
```

Production config:

```bash
node scripts/production-preflight.mjs dailycoding-server/.env dailycoding/.env.production
```

## Review Checklist

Before accepting AI output, confirm:

- It did not revert unrelated user changes.
- It did not add dependencies without approval.
- It updated or added tests for changed behavior.
- It did not weaken production fail-fast checks.
- It did not print secrets, auth tokens, or reset links in production paths.
- It reported verification evidence, not just intent.

## Useful Follow-Up Prompts

```text
Review only the diff in these files for security regressions. Prioritize auth, secrets, CORS, cookie, SSRF, file path, and command execution risks.
```

```text
Stabilize this failing test without hiding the behavior it is meant to prove. Keep the write scope to the test file and the directly related implementation.
```

```text
Split this large component into smaller units without changing behavior. First identify seams and tests, then make one reversible extraction.
```
