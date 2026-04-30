# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Structure

Two separate apps, developed and run independently:

- `dailycoding/` — React 18 frontend (Vite, no TypeScript)
- `dailycoding-server/` — Express.js backend (ESM, Node.js)

Both use `"type": "module"` (ES modules). Always use `import`/`export`, never `require`.

Shared code lives in `dailycoding-server/src/shared/` — imported by both backend and frontend via `dailycoding/src/data/`. If this directory is missing the server crashes at startup with `ERR_MODULE_NOT_FOUND`.

Key shared files:
- `problemCatalog.js` — problem seed data (used by `config/mysql.js`)
- `constants.js` — **single source of truth** for `TIER_THRESHOLDS`, `TIER_POINTS`, `TIER_ORDER`, `SUBSCRIPTION_PRICE`, `TEAM_SUBSCRIPTION_PRICE`, `AI_DAILY_QUOTA`, `RANKING_CACHE_TTL`. Always import from here — never hardcode these values anywhere else.

### problemCatalog.js patterns

`makeProblem()` consumes the `solve` function **at construction time** to pre-build `examples` and `testcases` arrays — `solve` is **not** exposed on the returned problem object. Never call `problem.solve(input)` at runtime; use `problem.testcases` instead.

Four shorthand wrappers exist: `pairProblem`, `singleIntProblem`, `arrayProblem`, `stringProblem` — each provides default `inputDesc`, `hiddenInputs`, and time/memory limits. Use `makeProblem` directly for custom input formats.

**Critical**: All string fields (`desc`, `hint`, `title`, etc.) use single-quoted JS strings. **Never use apostrophes** inside them (e.g. `Kahn's` breaks the parse). Rephrase in Korean or use backtick template literals if needed.

Tiers (full order): `unranked` → `iron` → `bronze` → `silver` → `gold` → `platinum` → `emerald` → `diamond` → `master` → `grandmaster` → `challenger`. IDs are namespaced by tier (1xxx=bronze, 2xxx=silver, 3xxx=gold) but the `tier:` field is the authoritative classifier — some problems in higher ID ranges carry lower tier labels. Problem tiers use the same identifiers as user tiers. `TIER_ORDER` array in `constants.js` is the canonical ordering — use its index for comparisons, not string equality.

Frontend mirror: `dailycoding/src/data/constants.js` re-exports the same values. When updating thresholds or prices, update **only** `shared/constants.js` and sync the frontend copy.

---

## Commands

### Frontend (`dailycoding/`)
```bash
npm run dev       # Vite dev server → http://localhost:5173
npm run build     # Production build → dist/
npm run preview   # Serve built dist locally
```

### Backend (`dailycoding-server/`)
```bash
npm run dev       # nodemon hot-reload → port 4000
npm run start     # Production node

# Docker (MySQL + Redis)
npm run docker         # docker-compose up -d
npm run docker:down    # docker-compose down
npm run docker:logs    # tail API container logs
```

No test runner is configured in either package.

---

## Environment Setup (Backend)

Copy `.env.example` to `.env` in `dailycoding-server/`. Required vars:

| Var | Notes |
|-----|-------|
| `JWT_SECRET` | Required at startup — server exits if missing |
| `ADMIN_PASSWORD` | Required in production — exits if missing |
| `DB_HOST/PORT/NAME/USER/PASS` | MySQL; default port **3307** (Docker-mapped local dev) — VPS uses **3306** |
| `REDIS_URL` | Falls back to in-memory cache if unreachable |
| `GEMINI_API_KEY` | Google Generative AI for AI features |
| `GITHUB_CLIENT_ID/SECRET` + `GOOGLE_CLIENT_ID/SECRET` | OAuth |
| `SMTP_*` | Nodemailer; email verification and password reset |
| `FRONTEND_URL` | Used for OAuth redirect target |
| `ALLOWED_ORIGINS` | Comma-separated CORS whitelist |

Frontend uses `VITE_API_URL` — if unset, requests go to `/api` (same-origin proxy).

---

## Backend Architecture

### Graceful Fallback Design
Both MySQL and Redis have **in-memory fallbacks**. The server starts and runs without either:
- MySQL unavailable → `MEM` object in `config/mysql.js` emulates all queries
- Redis unavailable → `Map`-based store in `config/redis.js` with TTL emulation

`waitForDB()` in `config/mysql.js` returns a Promise that resolves once the connection attempt completes (success or fallback). Server initialization waits on this before seeding data.

### DB Query Helpers (`config/mysql.js`)
Use these, never raw pool access in routes:
- `query(sql, params)` → returns array of rows
- `queryOne(sql, params)` → returns first row or null
- `insert(sql, params)` → returns inserted ID
- `run(sql, params)` → for UPDATE/DELETE

### Auth Middleware (`middleware/auth.js`)
- `auth` — verifies JWT (`issuer: 'dailycoding'`, `audience: 'dailycoding-client'`), attaches `req.user`
- `adminOnly` — re-validates role from DB (does **not** trust JWT claim)
- `requireVerified` — checks `email_verified` from DB; **admins bypass this check automatically** (`role === 'admin'` → `next()`)

**Always import all three from `../middleware/auth.js` if needed.** Past bug: `adminOnly` was used without being imported.

### Route → Model Pattern
Routes are thin controllers. Business logic lives in models (`models/`). Model methods are plain async functions on exported objects — no classes.

`User.safe(user)` is an explicit whitelist that strips sensitive fields before API responses. Always use it when returning user data.

### Code Judge (`services/judge.js`)
Two execution backends selected automatically at runtime:

- **`docker-sandbox`** — runs code in isolated Docker containers via `dockerode`. Used when Docker socket is available (local dev). Images: `python:3.12-alpine`, `node:20-alpine`, `gcc:13`, `openjdk:21-slim`.
- **`native-subprocess`** — runs code directly via `child_process.spawn` + `ulimit` sandboxing. Used on Railway (no Docker socket). Requires runtimes installed in Dockerfile: `python3`, `gcc`, `g++`, `openjdk21`, `node`.

**Runtime selection**: controlled by `JUDGE_MODE` env var (`auto` | `native` | `docker`). Default `auto` uses Docker if available, falls back to native. Judge availability is cached for 60s via the shared `services/judgeRuntimeCache.js` module — import `getCachedJudgeRuntime()` from there instead of duplicating cache logic in routes.

**Native subprocess sandbox constraints** (per-language virtual memory limits via `ulimit -v`):
- Python / C / C++: 128MB (`131072` KB)
- JavaScript: 256MB (`262144` KB) + `--max-old-space-size=64`
- Java: 512MB (`524288` KB) + `-Xmx64m -Xms16m` (JVM bootstrap needs 200MB+ of virtual address space)

**Output cap**: stdout is hard-capped at 512KB. Exceeding it kills the process and returns `outputExceeded: true` — checked before `exitCode !== 0` in `judgeCodeNative` to give the correct error message.

All 5 languages (`python`, `javascript`, `cpp`, `c`, `java`) are supported in both modes. `GET /api/submissions/judge-status` returns the current mode and `supportedLanguages` array — the frontend (`JudgePage.jsx`) uses this to filter the language selector.

### Caching Strategy
- Ranking: `ranking:global` key, 60s TTL
- Problem lists: `problems:list:*` prefix, cleared on create/update/delete
- Daily challenge: `daily:{userId}:{YYYY-MM-DD}` key, 1h TTL — per-user per-day
- AI analyze: `analyze:{userId}:{YYYY-MM-DD}` key, 1h TTL — cache hits must not increment AI quota
- Activity feed: `feed:{userId}` key, 60s TTL
- Admin stats: `admin:stats` key, 300s TTL
- Cache invalidation uses `redis.clearPrefix(prefix)` or `redis.del(key)`
- `clearPrefix` uses Redis `SCAN` (not `KEYS`) — never use `client.keys()` directly, it blocks the entire Redis server

### Socket.io
Initialized in `services/socketServer.js`, attached to the HTTP server. Available to routes via `req.app.get('io')`. Used for real-time battle events (`battle:started`, `battle:ended`, `battle:opponent_submitted`, `battle:spectate`).

### Frontend Shared Utilities
- `dailycoding/src/utils/tierImage.js` — `getTierImageUrl(tier)` maps tier names to `/tiers/*.webp`. `getTierGlowStyle(tier)` returns inline CSS animation style for high tiers (diamond/master/grandmaster/challenger). `TIER_COLORS` exports hex colors by tier. Used across RankingPage, ProfilePage, BattlePage, etc.
- `dailycoding/src/pages/battlePageUtils.js` — shared battle constants: `BATTLE_SEC` (default duration 1800s), `BATTLE_DURATIONS` (presets: blitz 300s, standard 1800s, marathon 3600s), `TYPE_LABEL`/`TYPE_COLOR` (problem type display), `fmtTime`, `getSocketUrl`. The `startTimer(startTime, roomDuration?)` in BattlePage reads `room.duration` if provided by backend, falls back to `BATTLE_SEC`.

### Code Sharing (`routes/share.js`)
`GET /api/share/:slug` — public, no auth required. Slug is created via `POST /api/submissions/:id/share` (auth required), stored in `shared_submissions` table. `Submission.getSharedSubmissionBySlug(slug)` joins submissions + problems + users. Frontend: `SharedSubmissionPage.jsx` at `/share/:slug` route (no `<PrivateRoute>` wrapper).

### Weekly Challenge (`routes/weekly.js`)
`GET /api/weekly` — auth optional (reads JWT if present to populate `isSolved`). Uses `getOptionalUserId()` which soft-decodes the token without failing on missing auth. `POST /api/weekly` — adminOnly, upserts current week's challenge via `ON DUPLICATE KEY UPDATE` keyed on `week_start` (Monday). Week start is always computed from `getWeekStartDate()` — never pass a client-supplied date.

### Input Sanitization
Global middleware in `index.js` strips `<script>`, `<iframe>`, `<object>`, `<embed>` tags and inline event handlers from all `req.body` strings. Prototype pollution keys (`__proto__`, `constructor`, `prototype`) are deleted.

`SKIP_SANITIZE_KEYS` exempts code/answer fields from sanitization: `code`, `sourceCode`, `answer`, `blankAnswers`, `testcases`, `specialConfig`, `codeTemplate`, `buggyCode`, `description`, `solution`, `hint`. Never remove fields from this set — sanitizing user-submitted code corrupts judge submissions.

### Rate Limiting (`middleware/rateLimit.js`)
Different limiters per route group: `authLimiter`, `submitLimiter`, `aiLimiter`, `generalLimiter`. Trust proxy is set to `1` (one reverse-proxy hop — Nginx on VPS, or Railway/Netlify CDN).

### AI Quota System (`routes/ai.js`)
- `checkAiQuota` middleware enforces 5 AI calls/day for Free users. Redis key: `quota:ai:{userId}:{YYYY-MM-DD}`, TTL 86400s.
- Applies to: `/ai/chat`, `/ai/hint`, `/ai/review`. Does **not** apply to `/ai/analyze` or `/ai/daily-quiz` (intentional — these have their own per-user/per-day caches).
- When `subscription_tier` is not `'free'`, quota is bypassed entirely.
- Quota is incremented **only on actual AI call** — cache hits must not increment. Check `cacheHit` flag before calling `redis.incr()`.

---

## Frontend Architecture

### API Client (`src/api.js`)
Axios instance with `Authorization: Bearer <token>` injected from `localStorage('dc_token')`. Base URL: `VITE_API_URL/api` or `/api`.

### Auth Flow
- JWT stored in `localStorage` as `dc_token`
- OAuth redirect: backend sends `#oauth_token=JWT` in URL **fragment** (not query string). `main.jsx` and `AuthContext.jsx` both read `window.location.hash` to extract it.
- `AuthContext.jsx` is the single source of truth for the authenticated user object

### Routing
React Router v7 in `App.jsx`. All routes require `<PrivateRoute>` wrapper except auth pages and landing.

### Monaco Editor
Used in `JudgePage.jsx` for the code editor. Language is mapped from UI selection to Monaco language IDs.

### Design System
Global CSS variables defined in `dailycoding/src/index.css`:
- Dark theme default (`--bg: #0d1117`), light theme via `[data-theme='light']`
- Fonts: `Space Mono` for code/numbers (`.mono`), `Noto Sans KR` for UI text
- Key vars: `--blue`, `--green`, `--purple`, `--yellow`, `--red`, `--orange`, `--accent`, `--glass-bg`, `--shadow`
- Utility classes: `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.btn-success`, `.mono`
- Component styles are inline JSX; page-level CSS files (e.g. `JudgePage.css`) handle layout only

### Mobile Responsive CSS Pattern
All page components use **inline `style={{}}`**, which CSS cannot override without `!important`. The mobile override workflow:
1. Add `className="my-class"` to the JSX element
2. Add `import './PageName.css'` at the top of the page file
3. Write `@media` rules with `!important` in the CSS file

**Critical layout pitfall**: Fixed-width flex/grid siblings crush adjacent elements on mobile. Known patterns that break on narrow screens:
- `display: flex` with one child having a fixed `width: Npx` — the sibling gets `viewport - N - padding` which can go negative
- `gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 1fr)'` — the `minmax(320px)` column demands 320px minimum, leaving the first column negative on 375px screens

**AuthPage** (`Auth.css`): Left intro panel hidden at ≤768px, right login form takes 100% width.  
**LandingPage** (`LandingPage.css`): Hero 2-column grid stacks to 1-column at ≤768px.  
**Dashboard** (`Dashboard.css`): Main 2-column grid (`minmax(0,1fr) 360px`) stacks at ≤900px via `.dashboard-main-grid`.  
**CommunityPage** (`CommunityPage.css`): Board tab descriptions hidden at ≤640px via `.community-tab-desc`; search bar becomes 2-row (`1fr auto` + nth-child placement).

---

### Deployment Target
**VPS** (Ubuntu 22.04) — Netlify + Railway는 더 이상 사용하지 않음.
- Nginx가 리버스 프록시: `/` → `/var/www/dailycoding/dist` (정적), `/api/` + `/socket.io/` → `localhost:4000`
- PM2 (fork mode, instances=1) — socket.io sticky session 때문에 cluster 모드 사용 불가
- Docker Compose: MySQL + Redis, 모두 `127.0.0.1` 바인딩 (외부 노출 없음)
- `JUDGE_MODE=docker` — VPS는 Docker socket 사용 가능
- 배포 스크립트: `scripts/deploy.sh` / 초기 세팅: `scripts/vps-setup.sh`

---

## API Endpoints Added (Post-Launch)

| Endpoint | Notes |
|----------|-------|
| `GET /api/notifications/unread-count` | Returns `{ count: N }` — use for nav badge |
| `GET /api/auth/profile/:id` | Public profile without email/ban fields |
| `GET /api/auth/me/stats` | Solve time statistics: avgSolveTime, fastestSolve, totalSolveTime, solveTimeByTier |
| `GET /api/auth/me/activity` | Date → solve-count map for 365 days; used by 52-week heatmap in Dashboard |
| `GET /api/problems/recommend` | 6 unsolved problems matched to user's tier + one tier above; prefers unsolved tags |
| `GET /api/problems/bookmarks` | Paginated list of bookmarked problems; returns `{ bookmarks, problems, total }` |
| `POST /api/problems/:id/bookmark` | Toggle bookmark; returns `{ bookmarked: boolean, count: N }` |
| `POST /api/problems/:id/comments/:commentId/like` | Atomic `likes + 1`; returns `{ likes: N }` |
| `GET /api/ai/quota` | Returns `{ used: N, limit: N, remaining: N }` — used by TopNav for Free users |
| `POST /api/submissions/:id/share` | Creates share slug; returns `{ slug, url }` |
| `GET /api/share/:slug` | Public — returns shared submission data (no auth) |
| `GET /api/weekly` | Current week's challenge; auth optional — `isSolved` is null when unauthenticated |
| `POST /api/weekly` | adminOnly — set/update this week's challenge problem |

## Key Invariants

- **Admin role** is always verified from DB, never from JWT. JWT `role` claim is informational only.
- **Admin email verification**: Admins never need email verification. `User.create()` sets `email_verified=1` when `role='admin'`. `requireVerified` middleware auto-passes admins. `ensureAdmin()` in `index.js` patches existing admins to `email_verified=1` on startup.
- **Subscription updates** must use `User.updateSubscription(id, { stripe_customer_id, subscription_tier, subscription_expires_at })` — NOT `User.update()`. This prevents the generic update allowlist from being misused to self-elevate subscription tier.
- **`User.onSolve()`** is called only on first-correct submission (`!alreadySolved` check in submissions route). It handles streak, `solved_count`, rating recalc, tier promotion, and reward grants.
- **Rating** is recalculated from scratch using top-100 solved problems on every solve, not incrementally.
- **Battle results** do not affect rating or streak — `User.onSolve()` is intentionally not called in battle judge.
- **Tier thresholds & pricing**: All values live in `dailycoding-server/src/shared/constants.js` (and mirrored in `dailycoding/src/data/constants.js`). `LandingPage.jsx`, `PricingPage.jsx`, `User.js`, and `ai.js` all import from there — never hardcode these numbers elsewhere. Stripe `currency: 'krw'`; amounts are in won (not cents).
- **Community blockFilter**: `buildBlockedUserClause()` uses parameterized query (`params: [id]`) — `blocked_id` column is interpolated as a table alias reference, not user input. The `id` value is always `parseInt`-validated before use.
- **`User.findAll()`**: `SELECT *` with limit=200 — ranks-only use case, but still fetches all columns. Pass explicit `fields` param for hot paths: `User.findAll({ fields: 'id,username,tier,rating,solved_count' })`.
- **Weekly challenge userId injection**: `routes/weekly.js` GET handler interpolates `Number(userId)` directly into the SQL string for the `isSolved` subquery. This is safe only because `getOptionalUserId()` guarantees a JavaScript `number` or `null` — but future edits must preserve this invariant.
- **Solve time tracking**: `solve_time_sec` is client-supplied from the frontend timer (`JudgeTimer` component). It is stored as-is — not server-validated for reasonableness. Treat as user-reported data, not authoritative.
- **Shared submissions**: `shared_submissions` table links submission IDs to public slugs. `GET /api/share/:slug` requires no auth — never include sensitive user data (email, ban status) in `Submission.getSharedSubmissionBySlug()` response.
