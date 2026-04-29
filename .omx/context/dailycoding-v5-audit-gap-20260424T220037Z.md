Task statement
- Execute the updated v5 prompt in `.omc/autopilot/codex-prompts.md`, honoring the prompt's explicit instruction that the earlier v4 SEC/BE tranche is already complete and should not be reimplemented.

Desired outcome
- Refresh autopilot scope to the newly added v5 backend issues only.
- Implement and verify the remaining unresolved `V5-BE-01..04` items with minimal, reviewable diffs.
- Preserve the working v4 security/backend/frontend fixes already landed in the repository.

Known facts / evidence
- The prompt file is now `v5` dated 2026-04-25.
- The prompt explicitly marks `SEC-01..06` and `BE-01..02` as complete and says not to duplicate those instructions.
- Current code still shows the newly reported v5 gaps:
  - `User.calcRatingFromTop100()` adds to the Redis zset before checking cache existence, which can skip hydration after TTL expiry.
  - `redis.zAdd()` ignores its TTL parameter in connected Redis mode.
  - `rateLimit.js` fallback `Map` has no cleanup or size cap.
  - avatar upload validation in `auth/profile.js` relies on `file.mimetype` only.

Constraints
- Follow the repository and AGENTS.md guidance.
- Keep scope on the v5 tranche unless new evidence shows a prompt item is already complete.
- Prefer cheap regression tests for logic-heavy changes.
- No new dependencies unless there is no practical in-repo alternative.

Unknowns / open questions
- Whether existing test coverage can exercise the avatar upload guard without spinning up the whole route stack.
- Whether the Redis helper should enforce TTL itself or whether call sites should own all TTL refresh logic.
- Whether the v5 prompt includes additional hidden work beyond `V5-BE-01..04` that needs later continuation.

Likely codebase touchpoints
- `dailycoding-server/src/models/User.js`
- `dailycoding-server/src/config/redis.js`
- `dailycoding-server/src/middleware/rateLimit.js`
- `dailycoding-server/src/routes/auth/profile.js`
- related backend tests under `dailycoding-server/src/**/*.test.js`
