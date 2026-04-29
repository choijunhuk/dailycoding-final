Task statement
- Resume and complete frontend i18n for `dailycoding/` after a partial prior attempt.

Desired outcome
- All requested frontend files use `useLang()` for UI chrome and hardcoded Korean UI strings are replaced with `t('key')` calls.
- `TermsPage.jsx`, `PrivacyPage.jsx`, and `AdminPage.jsx` remain untouched.
- `LangContext.jsx` contains all keys referenced by the updated components.
- `npm run build` succeeds with zero errors.

Known facts / evidence
- `src/context/LangContext.jsx` already contains the expanded base dictionary and a substantial number of additional keys from a previous partial pass.
- `TopNav.jsx`, `SettingsPage.jsx`, several auth/support pages, and some feature pages already import `useLang()`.
- Large untranslated areas remain in `Dashboard.jsx`, `ProfilePage.jsx`, `BattlePage.jsx`, `ContestPage.jsx`, `RankingPage.jsx`, `SubmissionsPage.jsx`, `CommunityPage.jsx`, `JudgePage.jsx`, `TeamDashboard.jsx`, `VerificationBanner.jsx`, `MockAd.jsx`, and `PublicProfilePage.jsx`.
- `.omx/state/.../autopilot-state.json` was left active at `planning` without task-specific execution evidence.

Constraints
- Translate only UI strings rendered by the frontend.
- Do not translate backend-returned content, legal pages, admin page content, code strings, IDs, or comments.
- No new dependencies.
- Verification is limited to frontend build; tests should not be run.

Unknowns / open questions
- Exact completeness of the previous partial i18n pass across all listed target files.
- Whether existing extra keys in `LangContext.jsx` already cover all remaining UI strings.

Likely codebase touchpoints
- `dailycoding/src/context/LangContext.jsx`
- `dailycoding/src/components/*.jsx`
- `dailycoding/src/pages/*.jsx`
