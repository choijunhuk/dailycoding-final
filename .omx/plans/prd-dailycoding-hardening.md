# PRD: DailyCoding Hardening and Polish

## Problem Statement
The DailyCoding platform has achieved functional completeness for its core flows but requires production-grade hardening. Current session management relies solely on short-lived tokens without seamless rotation, creating user friction. Performance degrades on complex aggregations like leaderboards and submission heatmaps. On the presentation layer, the UI lacks consistent theming (Dark/Light modes), suffers on mobile viewports, and the AI feedback integration is static and unintuitive.

## Scope
- Implement a secure, Redis-backed refresh token rotation strategy.
- Enforce strict password complexity and input validation across all authentication and submission endpoints.
- Migrate contest leaderboards from relational queries to Redis Sorted Sets for O(log N) operations.
- Migrate submission activity heatmaps to Redis Hashes for constant-time read/write performance.
- Refactor CSS to systematically support dark and light themes using CSS variables.
- Audit and adjust critical UI layouts (editor, dashboard, leaderboards) for mobile responsiveness.
- Enhance the AI feedback component to be interactive (e.g., clear contextual highlighting, side-panel layout).

## Non-goals
- Rewriting the entire frontend in a new framework or major version upgrade.
- Migrating from MySQL to another RDBMS.
- Adding new core contest or problem types.
- Implementing social logins (OAuth) during this phase.
- Supporting legacy browsers (IE11).

## Acceptance Criteria

### T1: Refresh Token strategy (Redis-backed)
- **AC1:** API generates both an access token (short-lived, e.g., 15m) and a refresh token (long-lived, e.g., 7d) upon login.
- **AC2:** Refresh tokens are securely stored in Redis as key-value pairs with a TTL matching their expiration.
- **AC3:** The `/auth/refresh` endpoint seamlessly issues a new access token if the provided refresh token is valid in Redis.
- **AC4:** Logout or password change endpoints invalidate the refresh token in Redis immediately.

### T2: Password complexity & input validation
- **AC1:** Registration and password update endpoints require passwords to meet complexity rules (min 8 chars, 1 uppercase, 1 number, 1 special character).
- **AC2:** All API endpoints receiving user input (e.g., registration, code submission, profile updates) utilize validation middleware to sanitize and reject malformed data with 400 Bad Request responses.

### T3: Redis Sorted Sets for Contest Leaderboards
- **AC1:** Valid contest code submissions update a Redis Sorted Set (`ZADD`) with the user's highest score.
- **AC2:** Leaderboard retrieval uses `ZREVRANGE` for O(log N) fetch time.
- **AC3:** Fallback mechanisms ensure Redis is hydrated from MySQL if the Redis cache is flushed or unavailable.

### T4: Redis Hash for Submission Heatmaps
- **AC1:** User daily submission counts are incremented in a Redis Hash (`HINCRBY heatmap:{userId} {YYYY-MM-DD} 1`).
- **AC2:** The frontend heatmap component fetches the user's heatmap data via an API endpoint that reads directly from Redis (`HGETALL`).

### T5: Dark/Light mode audit & CSS refactor
- **AC1:** A global state or context manages the active theme (dark/light) and persists user preference to `localStorage`.
- **AC2:** Core UI components (navbar, editor wrapper, dashboards) strictly use CSS variables for colors, ensuring accessible contrast ratios in both modes.
- **AC3:** Monaco editor theme dynamically switches based on the global theme.

### T6: Mobile responsiveness audit
- **AC1:** The application is usable on screens as narrow as 320px without horizontal scrolling for the main document body.
- **AC2:** Mobile navigation collapses into a responsive hamburger menu or bottom tab bar.
- **AC3:** Complex data tables (leaderboards, submissions) display as scrollable containers or stacked cards on mobile viewports.

### T7: Interactive AI Feedback UI
- **AC1:** AI feedback is displayed in a dedicated, resizable side-panel or modular overlay rather than breaking the primary code editor layout.
- **AC2:** The feedback UI renders markdown and code blocks accurately with syntax highlighting.
- **AC3:** Loading states for AI feedback are clearly indicated (e.g., skeleton loaders or streaming text).

## Constraints and Dependencies
- **Infrastructure:** Backend must rely on the existing Redis instance. No new datastores are to be introduced.
- **UI Integrations:** The CSS refactor must not conflict with or break the `monaco-editor` instance.
- **Timeline:** To be executed within the current sprint boundary.
- **Compatibility:** Ensure compatibility with the current `react-router-dom` and `axios` versions.

## Handoff Checklist
- [x] PRD reviewed and approved.
- [x] All 7 tasks have clear, distinct technical bounds.
- [x] Target state infrastructure (Redis) is verified to be active in the `docker-compose.yml`.
- [x] UI design tokens (color palettes for dark/light) are defined or implicitly governed by standard Tailwind/CSS variables.
- [x] Architecture aligns with `omg-executor` constraints and execution pipeline rules.