Task statement
- Implement the remaining v5/v6 roadmap items in one broader tranche after the earlier onboarding/promotion/theme/lang tranche.

Desired outcome
- Land the remaining growth/product systems in a functional form: referral loop, mock exams, build-problem support, profile background/avatar flows, and sheets/learning pages.

Implemented in this tranche
- Backend:
  - migration `018_remaining_growth_platform.sql`
  - referrals service + API
  - exam sets / attempts API
  - sheets / learning paths API
  - uploads static serving
  - build-problem metadata support in `Problem.findById`
  - profile background equip + avatar upload endpoints
  - referral code attach on register
  - referral reward claim hook in submission flow
- Frontend:
  - exams list/detail pages
  - sheets list/detail pages
  - learning path page
  - App routes for exams/sheets/learning
  - TopNav entries for new pages
  - Dashboard referral card
  - ProblemsPage build type filter meta
  - JudgePage build-mode UI
  - ProfilePage background/avatar controls

Verification evidence
- `dailycoding-server`: `npm test` passed after the tranche.
- `dailycoding`: `npm run build` passed after the tranche.

Remaining risks
- Some newly added systems are lightly integrated and need browser-level smoke validation:
  - exam attempt flow
  - referral reward end-to-end
  - profile avatar/background UI
  - sheets/learning detail navigation
- The roadmap tail items around richer footer/content polish and a more advanced build-problem/sql-judge path are not deeply developed beyond the initial support surface.
