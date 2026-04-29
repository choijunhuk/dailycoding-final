# Autopilot Spec — dailycoding improvement round 2

## Scope
Fix security gaps, UX gaps, and dead code identified in post-session audit.

## Priority 1 — Security Fixes
1. **Password validation mismatch**: `auth.js` still checks `password.length < 4` but `validate.js` enforces `minLength: 8`. Fix all four spots in auth.js to use 8.
2. **Rate limiting gap**: `/api/problems`, `/api/contests`, `/api/ranking` have no rate limiter. Add a general API limiter.
3. **Duplicate email pre-check**: Registration hashes password before checking if email exists → wastes CPU. Add email uniqueness check first.

## Priority 2 — UX Improvements
4. **404 page**: `<Route path="*">` currently redirects silently to `/`. Create a `NotFoundPage` component and show it instead.
5. **Code draft auto-save**: JudgePage loses code on refresh. Auto-save code + language to `localStorage` keyed by problem id, restore on mount.
6. **Loading skeletons**: Dashboard and RankingPage have no per-page loading state. Show skeleton while data loads.

## Priority 3 — Dead Code Removal
7. **Unused suggest state**: ProblemsPage declares `suggest` and `showSug` states that are never populated. Remove them.
8. **Unused console.log in JudgePage template**: Line 44 has a debug `console.log`. Remove it.

## Out of Scope (require large refactor or external changes)
- Rotating exposed .env API keys (user action required)
- Real-time contest leaderboard (WebSocket infra needed)
- Server-side pagination (requires API redesign)
- Component splitting (JudgePage 644 lines)
- Analytics integration
