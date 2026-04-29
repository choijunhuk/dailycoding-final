Task statement
- Read `codex-v4-audit-gaps.md`, `codex-v5-growth-features.md`, and `codex-v6-ux-content.md`, then execute the real remaining instructions against the current DailyCoding codebase.

Desired outcome
- Land the highest-priority v5/v6 items that materially improve activation, retention, and UX without duplicating already-shipped v4 work.

Known facts / evidence
- v4 tranche had already landed admin credential hardening, ignore/tooling improvements, backend structure split, daily missions, season ranking, and battle rematch.
- Current code already had an independent `SettingsPage`, `ThemeContext`, battle history, weekly challenge, and v4 growth features, so those should be extended rather than rebuilt.
- Root assets for tier images and background image exist and were copied into `dailycoding/public/tiers` and `dailycoding/public/backgrounds`.

Implemented in this tranche
- Backend:
  - `user_onboarding` and `promotion_series` migration
  - onboarding API
  - promotion snapshot API
  - promotion service and `User.onSolve()` promotion-series integration
  - battle loss integration for promotion failure progress
  - recommendation endpoint filtered by onboarding experience level
- Frontend:
  - `LangContext`
  - `ThemeContext` with `system` mode
  - `OnboardingModal`
  - App-level onboarding fetch/show flow
  - top nav language toggle and translated core labels
  - settings page theme/language controls
  - tier image utility + usage in ranking/profile
  - onboarding recommendation strip in `ProblemsPage`
  - promotion banner/recent promotion card in dashboard

Still not implemented from v5/v6
- Mock exam system
- Referral loop
- Build-problem category
- Profile background unlocker and avatar upload
- Problem sheets / learning paths
- Footer/content polish items from the tail of v6

Constraints
- ESM only
- DB helpers only
- No new heavy frontend charting dependencies
- Preserve current platform behavior while layering the new growth/UX systems
