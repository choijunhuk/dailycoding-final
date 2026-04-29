# DailyCoding Commercial Launch Specification

## Executive Summary

DailyCoding is a competitive coding practice platform built with React (Vite) frontend, Express backend, MySQL, Redis, and Docker-based code judging. The platform currently supports problem solving, submissions with Docker sandboxed judging, contests, 1v1 battles, AI hints (Gemini), rewards/badges, user profiles, and rankings.

**Current state:** Functional prototype with GitHub/Google OAuth already implemented, basic rate limiting, input sanitization, and an in-memory fallback for MySQL/Redis. However, the platform lacks email verification, password reset, WebSocket real-time features (battles use HTTP polling at 2.5s intervals), structured logging, payment infrastructure, PWA support, admin moderation tools, automated testing, and CI/CD.

**Goal:** Transform this prototype into a commercially viable, secure, and scalable SaaS product across 14 feature workstreams organized in three priority tiers.

---

## Architecture Overview (Current)

```
Frontend:  dailycoding/          (React 18 + Vite 5, react-router-dom v7, Monaco Editor, axios)
Backend:   dailycoding-server/   (Express 4, ES modules, node 20+)
Database:  MySQL 8.0 (docker-compose, port 3307) + Redis 7 (port 6379)
Judge:     Docker sandbox via dockerode (python, node, gcc, openjdk containers)
AI:        Gemini 2.5 flash-lite via @google/generative-ai
Auth:      JWT (24h expiry, issuer/audience claims) + bcryptjs
```

### Key Files Reference
- **Server entry:** `dailycoding-server/src/index.js`
- **Auth routes:** `dailycoding-server/src/routes/auth.js` (register, login, OAuth, password change)
- **Auth middleware:** `dailycoding-server/src/middleware/auth.js` (JWT verify, adminOnly)
- **User model:** `dailycoding-server/src/models/User.js`
- **Battle model:** `dailycoding-server/src/models/Battle.js` (Redis-stored rooms)
- **Judge service:** `dailycoding-server/src/services/judge.js` (Docker sandbox)
- **Rate limiter:** `dailycoding-server/src/middleware/rateLimit.js` (Redis-backed + in-memory fallback)
- **Frontend auth:** `dailycoding/src/context/AuthContext.jsx`
- **Frontend API client:** `dailycoding/src/api.js` (axios, baseURL /api)
- **DB schema:** `dailycoding-server/init.sql` (15 tables)
- **Docker Compose:** `dailycoding-server/docker-compose.yml`
- **Environment:** `dailycoding-server/.env`

---

## TIER 1 -- Critical (Must-Have for Launch)

### 1. Email Verification on Signup + Password Reset Flow

**Current state:** Registration immediately returns a JWT and logs the user in. No email verification. No password reset ("forgot password") flow exists. The `.env` has no SMTP configuration.

#### Requirements

1. **Email verification on signup:**
   - After `POST /api/auth/register`, set user status to `email_unverified` (new column `email_verified TINYINT(1) DEFAULT 0` on `users` table).
   - Generate a cryptographically random token (32 bytes hex), store in new `email_verification_tokens` table with expiry (24 hours).
   - Send verification email via nodemailer with a link: `{FRONTEND_URL}/verify-email?token={token}`.
   - New endpoint `GET /api/auth/verify-email?token=xxx` validates token, sets `email_verified=1`, deletes token.
   - Unverified users can log in but see a banner prompting verification. After 7 days without verification, restrict access to problem submissions only (no contests, battles, AI).

2. **Password reset flow:**
   - New endpoint `POST /api/auth/forgot-password` accepts email, generates reset token (32 bytes hex, 1 hour expiry), stores in `password_reset_tokens` table, sends email with link `{FRONTEND_URL}/reset-password?token={token}`.
   - New endpoint `POST /api/auth/reset-password` accepts `{ token, newPassword }`, validates token + expiry, updates password via `User.updatePassword()`, deletes token.
   - Rate limit: max 3 forgot-password requests per email per hour.
   - Always return success message even if email not found (prevent user enumeration).

3. **Frontend changes:**
   - Add "Forgot password?" link on AuthPage login form.
   - New pages: `ForgotPasswordPage.jsx`, `ResetPasswordPage.jsx`, `VerifyEmailPage.jsx`.
   - Add verification banner component in `AppInner` when `user.emailVerified === false`.
   - New routes in `App.jsx`: `/forgot-password`, `/reset-password`, `/verify-email`.

#### Acceptance Criteria

- [ ] AC1.1: User registers -> receives verification email within 60 seconds -> clicks link -> `email_verified` becomes 1 in DB.
- [ ] AC1.2: Unverified user sees persistent banner with "Resend verification" button.
- [ ] AC1.3: User clicks "Forgot password" -> enters email -> receives reset email -> clicks link -> enters new password -> can log in with new password.
- [ ] AC1.4: Expired token (>24h for verify, >1h for reset) returns 400 with clear message.
- [ ] AC1.5: Password reset endpoint returns 200 even for non-existent emails.
- [ ] AC1.6: Rate limit of 3 forgot-password requests per email per hour enforced.
- [ ] AC1.7: OAuth users (who have `password=NULL`) skip email verification (already verified by provider).

#### Technical Implementation Notes

- Use `nodemailer` with SMTP transport. Support Gmail SMTP for dev, generic SMTP for production.
- Token generation: `crypto.randomBytes(32).toString('hex')`.
- New `.env` variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
- Email templates: simple HTML with inline CSS (no template engine dependency needed).
- The `findOrCreateOAuthUser()` in `auth.js` already sets `password=NULL` for OAuth users -- these should be auto-verified (`email_verified=1`).

#### File Changes

| File | Change |
|------|--------|
| `dailycoding-server/init.sql` | Add `email_verified` column to `users`, add `email_verification_tokens` table, add `password_reset_tokens` table |
| `dailycoding-server/src/routes/auth.js` | Add `/verify-email`, `/forgot-password`, `/reset-password` endpoints; modify `/register` to send verification email |
| `dailycoding-server/src/services/email.js` | **NEW** -- nodemailer transport setup + `sendVerificationEmail()`, `sendPasswordResetEmail()` |
| `dailycoding-server/src/models/User.js` | Add `email_verified` to `safe()` whitelist |
| `dailycoding-server/.env` | Add SMTP variables |
| `dailycoding-server/.env.example` | Add SMTP variables |
| `dailycoding/src/pages/ForgotPasswordPage.jsx` | **NEW** |
| `dailycoding/src/pages/ResetPasswordPage.jsx` | **NEW** |
| `dailycoding/src/pages/VerifyEmailPage.jsx` | **NEW** |
| `dailycoding/src/pages/AuthPage.jsx` | Add "Forgot password?" link |
| `dailycoding/src/App.jsx` | Add new routes (accessible without auth) |
| `dailycoding/src/components/VerificationBanner.jsx` | **NEW** |

#### Dependencies

- `nodemailer` (backend)

---

### 2. Security Hardening

**Current state:**
- JWT_SECRET is loaded from `.env` and the server exits if missing (good).
- However, the committed `.env` file contains a real JWT secret (`2059812148ab...`), a real Gemini API key (`AIzaSy...`), and hardcoded DB/Redis passwords.
- `docker-compose.yml` hardcodes `JWT_SECRET: dailycoding_secret_key_2025` (weak, predictable).
- Manual security headers set in `index.js` (X-Content-Type-Options, X-Frame-Options, etc.) -- should use helmet.js.
- CORS is properly configured with whitelist.
- Input sanitization exists but is custom (strip dangerous HTML tags).
- No HTTPS enforcement.
- No Content-Security-Policy header.
- Admin password defaults to `admin1234` if `ADMIN_PASSWORD` env var not set.

#### Requirements

1. **Secret management:**
   - Remove `.env` from version control; add to `.gitignore`.
   - Replace all hardcoded secrets in `docker-compose.yml` with `${VAR}` references.
   - Document all required environment variables in `.env.example` with placeholder values.
   - Generate cryptographically strong JWT_SECRET on first setup (document in README).

2. **Helmet.js integration:**
   - Replace manual security headers (lines 41-47 of `index.js`) with `helmet()` middleware.
   - Configure CSP to allow Monaco Editor (requires `unsafe-eval` for the editor worker), inline styles, and Gemini API calls.

3. **CORS hardening:**
   - Current CORS implementation is already good (whitelist-based). Ensure production origins are configurable.

4. **HTTPS enforcement:**
   - Add middleware to redirect HTTP to HTTPS in production (`NODE_ENV=production`).
   - Set `Strict-Transport-Security` header via helmet.

5. **Additional hardening:**
   - Add `express-mongo-sanitize` equivalent for SQL (already have custom sanitization, but add parameterized query audit).
   - Ensure all DB queries use parameterized queries (current code does this correctly with `?` placeholders -- verify no string concatenation in SQL).
   - Add request payload size limit (already `5mb` -- reduce to `1mb` for non-code endpoints, keep `5mb` for submission).

#### Acceptance Criteria

- [ ] AC2.1: `.env` is in `.gitignore` and not tracked. `.env.example` has all variables with placeholder values.
- [ ] AC2.2: `docker-compose.yml` uses `${VAR}` for all secrets (JWT_SECRET, DB_PASS, REDIS password, GEMINI_API_KEY).
- [ ] AC2.3: `helmet()` is applied as middleware; response headers include `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`.
- [ ] AC2.4: Monaco Editor still works (CSP allows `unsafe-eval` for editor worker).
- [ ] AC2.5: Server starts successfully with only `.env.example` variables filled in (no hardcoded fallbacks for secrets).
- [ ] AC2.6: In production mode (`NODE_ENV=production`), HTTP requests redirect to HTTPS.

#### File Changes

| File | Change |
|------|--------|
| `dailycoding-server/.gitignore` | Add `.env` (if not already present) |
| `dailycoding-server/.env.example` | Full list of all env vars with placeholders |
| `dailycoding-server/docker-compose.yml` | Replace hardcoded secrets with `${VAR}` |
| `dailycoding-server/src/index.js` | Replace manual headers with `helmet()`, add HTTPS redirect middleware |
| `dailycoding-server/package.json` | Add `helmet` dependency |

#### Dependencies

- `helmet` (backend)

---

### 3. WebSocket Real-Time Features (Socket.io)

**Current state:** Battles use HTTP polling at 2.5-second intervals (`POLL_MS = 2500` in `BattlePage.jsx`). Contest leaderboards have no real-time updates. Notifications are fetched on page load only. Battle room state is stored in Redis with TTLs.

#### Requirements

1. **Socket.io server setup:**
   - Integrate socket.io with the existing Express HTTP server in `index.js`.
   - Authenticate socket connections using JWT (extract token from handshake auth or query param).
   - Use Redis adapter (`@socket.io/redis-adapter`) for horizontal scaling.

2. **Battle real-time events:**
   - Replace HTTP polling with socket events for battle rooms.
   - Events: `battle:room-update` (room state change), `battle:typing` (opponent typing indicator), `battle:invite` (incoming invite notification), `battle:ended` (battle conclusion).
   - Each battle room = a socket.io room (`battle:{roomId}`).
   - Players join the socket room on battle start, leave on end.

3. **Contest live leaderboard:**
   - Event: `contest:leaderboard-update` (broadcast to all participants when a submission is judged).
   - Event: `contest:status-change` (contest started/ended).
   - Each contest = a socket.io room (`contest:{contestId}`).

4. **Live notifications:**
   - Event: `notification:new` (push to specific user when notification created).
   - Replace the notification polling/fetch-on-load pattern.

5. **Frontend socket client:**
   - Create `dailycoding/src/context/SocketContext.jsx` -- connect on login, disconnect on logout.
   - Provide socket instance via React context.
   - Refactor `BattlePage.jsx` to use socket events instead of polling (remove all `setInterval` polling).
   - Add live leaderboard updates to `ContestPage.jsx`.
   - Add real-time notification count in `TopNav.jsx`.

#### Acceptance Criteria

- [ ] AC3.1: Battle room state updates appear on both players' screens within 500ms of a submission (vs current 2.5s polling).
- [ ] AC3.2: Typing indicator shows/hides in real-time via socket (no more POST /typing + poll).
- [ ] AC3.3: Battle invite notification appears instantly without polling.
- [ ] AC3.4: Contest leaderboard updates live when any participant submits.
- [ ] AC3.5: New notifications appear in TopNav badge count without page refresh.
- [ ] AC3.6: Socket connection authenticates via JWT; unauthenticated connections are rejected.
- [ ] AC3.7: Graceful fallback: if WebSocket connection fails, fall back to HTTP polling (existing behavior).
- [ ] AC3.8: Server supports multiple instances via Redis adapter (socket.io rooms work across processes).

#### Technical Implementation Notes

- The Express server in `index.js` uses `app.listen()` which returns an `http.Server`. Refactor to: `const server = http.createServer(app); const io = new Server(server, { ... }); server.listen(PORT)`.
- Battle model (`Battle.js`) methods that modify room state should emit socket events after Redis writes.
- Keep the REST API endpoints for battles (they handle business logic); socket.io is for pushing state updates.
- Frontend: `socket.io-client` connects to the same origin, so CORS is shared.

#### File Changes

| File | Change |
|------|--------|
| `dailycoding-server/src/index.js` | Refactor to `http.createServer()`, initialize socket.io with Redis adapter |
| `dailycoding-server/src/config/socket.js` | **NEW** -- socket.io setup, auth middleware, room management |
| `dailycoding-server/src/models/Battle.js` | Emit socket events on room state changes |
| `dailycoding-server/src/routes/contests.js` | Emit socket events on leaderboard changes |
| `dailycoding-server/src/models/Notification.js` | Emit socket event on `create()` and `broadcast()` |
| `dailycoding/src/context/SocketContext.jsx` | **NEW** -- socket.io-client provider |
| `dailycoding/src/pages/BattlePage.jsx` | Replace polling with socket listeners |
| `dailycoding/src/pages/ContestPage.jsx` | Add live leaderboard via socket |
| `dailycoding/src/components/TopNav.jsx` | Real-time notification badge via socket |
| `dailycoding/src/App.jsx` | Wrap with SocketProvider |

#### Dependencies

- `socket.io` (backend)
- `@socket.io/redis-adapter` (backend)
- `socket.io-client` (frontend)

---

### 4. Google OAuth Social Login

**Current state:** Both GitHub and Google OAuth are already fully implemented in `dailycoding-server/src/routes/auth.js` (lines 139-285). The frontend `AuthPage.jsx` has buttons for both providers. The DB schema includes `oauth_provider`, `oauth_id`, `avatar_url` columns with a unique index.

**Assessment:** This feature is ALREADY COMPLETE. The only remaining work is:

#### Requirements

1. **Verification:** Confirm Google OAuth works end-to-end with real credentials.
2. **Token in URL security:** Currently, OAuth callback redirects to `{FRONTEND_URL}?oauth_token={token}`. The JWT appears in the URL, which is logged in browser history and server logs. Refactor to use a short-lived authorization code pattern or redirect with token in URL fragment (`#token=xxx`) instead of query param.
3. **Frontend token handling:** Add `useEffect` in `AuthContext.jsx` to capture `oauth_token` from URL on page load, store in localStorage, and clean URL.

#### Acceptance Criteria

- [ ] AC4.1: User clicks "Google로 계속하기" -> redirected to Google consent screen -> returns to app logged in.
- [ ] AC4.2: OAuth token is passed via URL fragment (not query param) to prevent server-side logging.
- [ ] AC4.3: Existing user with same email has their account linked to OAuth provider (already implemented in `findOrCreateOAuthUser`).
- [ ] AC4.4: OAuth users cannot use password-based login (password is NULL); UI hides password-change section for OAuth users.

#### File Changes

| File | Change |
|------|--------|
| `dailycoding-server/src/routes/auth.js` | Change `?oauth_token=` to `#oauth_token=` in redirect |
| `dailycoding/src/context/AuthContext.jsx` | Parse `window.location.hash` for `oauth_token` on mount |
| `dailycoding/src/pages/ProfilePage.jsx` | Hide password change section for OAuth users (`user.password === null`) |

#### Dependencies

None (already implemented).

---

### 5. Structured Error Logging (Winston)

**Current state:** All logging uses `console.log`, `console.warn`, `console.error` with Korean emoji-prefixed messages. No log levels, no file output, no structured format, no request ID tracking. Error handlers in routes use bare `catch {}` or `catch (err) { console.error(...) }` with no correlation.

#### Requirements

1. **Winston logger setup:**
   - Create a centralized logger with levels: error, warn, info, http, debug.
   - Console transport: colorized, human-readable for development.
   - File transport: JSON format, rotating files (daily rotation, 14-day retention, 20MB max size).
   - Separate error log file (`error.log`) and combined log file (`combined.log`).

2. **Request logging middleware:**
   - Log every HTTP request with: method, URL, status code, response time, user ID (if authenticated), request ID (UUID).
   - Attach `req.id` (UUID) to every request for correlation.

3. **Replace all console.* calls:**
   - Replace all `console.log/warn/error` throughout the backend with `logger.info/warn/error`.
   - Include structured context (userId, problemId, etc.) as metadata.

4. **Error handling middleware:**
   - Add centralized Express error handler at the end of the middleware chain.
   - Log unhandled errors with full stack trace and request context.
   - Return sanitized error messages to client (no stack traces in production).

#### Acceptance Criteria

- [ ] AC5.1: All backend log output goes through Winston (no direct `console.*` calls remain).
- [ ] AC5.2: Each log entry in file transport is valid JSON with `{ timestamp, level, message, ...metadata }`.
- [ ] AC5.3: Error logs include stack trace, request ID, user ID, and endpoint.
- [ ] AC5.4: Log files rotate daily, old logs (>14 days) are automatically deleted.
- [ ] AC5.5: In production, console output is minimal (warn+error only); in development, all levels shown.
- [ ] AC5.6: Request logging shows method, URL, status, and response time for every API call.

#### File Changes

| File | Change |
|------|--------|
| `dailycoding-server/src/config/logger.js` | **NEW** -- Winston logger configuration |
| `dailycoding-server/src/middleware/requestLogger.js` | **NEW** -- HTTP request logging + request ID |
| `dailycoding-server/src/middleware/errorHandler.js` | **NEW** -- centralized error handler |
| `dailycoding-server/src/index.js` | Add logger middleware, error handler; replace console.* |
| `dailycoding-server/src/routes/*.js` | Replace all `console.error/log/warn` with logger |
| `dailycoding-server/src/config/mysql.js` | Replace console.* with logger |
| `dailycoding-server/src/config/redis.js` | Replace console.* with logger |
| `dailycoding-server/src/services/judge.js` | Replace console.* with logger |
| `dailycoding-server/.gitignore` | Add `logs/` directory |

#### Dependencies

- `winston` (backend)
- `winston-daily-rotate-file` (backend)
- `uuid` or `crypto.randomUUID()` (built-in, no dependency)

---

## TIER 2 -- Important (Strong Commercial Product)

### 6. Stripe Subscription System (Free/Pro/Team)

**Current state:** No payment or subscription system. All features are available to all users. No `subscription` or `plan` concept in the DB.

#### Requirements

1. **Subscription tiers:**
   - **Free:** 5 submissions/day, 3 AI requests/day, basic problems, no contest creation.
   - **Pro ($9.99/month):** Unlimited submissions, 50 AI requests/day, all problems, contest creation, priority judge queue.
   - **Team ($29.99/month per seat):** Pro features + team management, shared problem sets, team leaderboards.

2. **Backend Stripe integration:**
   - Stripe Checkout for subscription creation.
   - Stripe webhook endpoint (`POST /api/billing/webhook`) for payment events (subscription.created, updated, deleted, invoice.paid, invoice.payment_failed).
   - New DB table: `subscriptions` (user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end).
   - New column on `users`: `plan ENUM('free','pro','team') DEFAULT 'free'`.
   - Middleware: `requirePlan('pro')` to gate features by subscription tier.

3. **Usage tracking and enforcement:**
   - Track daily submission count and AI request count per user.
   - Enforce limits based on plan in submission and AI routes.
   - Return `402 Payment Required` with upgrade prompt when limit exceeded.

4. **Frontend billing UI:**
   - New `BillingPage.jsx` with plan comparison, current plan display, Stripe Checkout redirect.
   - Upgrade/downgrade buttons.
   - Usage meter showing remaining submissions/AI requests for the day.

#### Acceptance Criteria

- [ ] AC6.1: Free user submitting 6th problem in a day gets 402 with "Upgrade to Pro" message.
- [ ] AC6.2: User clicks "Upgrade to Pro" -> redirected to Stripe Checkout -> payment succeeds -> plan updates to 'pro' within 30 seconds (webhook).
- [ ] AC6.3: Pro user can create contests; free user cannot.
- [ ] AC6.4: Subscription cancellation via Stripe portal -> plan reverts to 'free' at period end.
- [ ] AC6.5: Failed payment -> user notified, 3-day grace period, then downgrade to free.
- [ ] AC6.6: Webhook endpoint validates Stripe signature (prevents spoofing).

#### File Changes

| File | Change |
|------|--------|
| `dailycoding-server/src/routes/billing.js` | **NEW** -- Stripe checkout, webhook, portal |
| `dailycoding-server/src/models/Subscription.js` | **NEW** -- subscription CRUD |
| `dailycoding-server/src/middleware/plan.js` | **NEW** -- `requirePlan()` middleware |
| `dailycoding-server/src/middleware/rateLimit.js` | Modify limits per plan tier |
| `dailycoding-server/src/routes/submissions.js` | Add daily limit check |
| `dailycoding-server/src/routes/ai.js` | Add daily AI limit check |
| `dailycoding-server/init.sql` | Add `subscriptions` table, `plan` column to `users` |
| `dailycoding-server/src/index.js` | Mount billing router (note: webhook needs `express.raw()` body) |
| `dailycoding/src/pages/BillingPage.jsx` | **NEW** |
| `dailycoding/src/components/UsageMeter.jsx` | **NEW** |
| `dailycoding/src/App.jsx` | Add `/billing` route |
| `dailycoding/src/components/TopNav.jsx` | Add billing link |

#### Dependencies

- `stripe` (backend)

---

### 7. PWA Support

**Current state:** Standard SPA with no service worker, no web manifest, no offline support. The Vite config is default.

#### Requirements

1. **Web App Manifest:** `manifest.json` with app name ("DailyCoding"), icons (192x192, 512x512), theme color, background color, display: standalone.
2. **Service Worker:** Register via `vite-plugin-pwa`. Cache static assets (JS, CSS, fonts). Network-first strategy for API calls. Offline fallback page.
3. **Install prompt:** Show custom "Install App" banner on mobile when PWA install criteria are met.
4. **Push notifications (future-ready):** Register service worker for push capability but do not implement push server yet (deferred to Tier 3).

#### Acceptance Criteria

- [ ] AC7.1: Lighthouse PWA audit score >= 90.
- [ ] AC7.2: App is installable on Chrome mobile (shows "Add to Home Screen" prompt).
- [ ] AC7.3: After install, app launches in standalone mode (no browser chrome).
- [ ] AC7.4: Static assets load from cache when offline; API failures show friendly offline message.
- [ ] AC7.5: Manifest includes correct name, icons, theme color matching the app's dark theme.

#### File Changes

| File | Change |
|------|--------|
| `dailycoding/vite.config.js` | Add `vite-plugin-pwa` configuration |
| `dailycoding/public/manifest.json` | **NEW** |
| `dailycoding/public/icons/` | **NEW** -- PWA icons at multiple sizes |
| `dailycoding/index.html` | Add manifest link, theme-color meta tag |
| `dailycoding/src/components/InstallPrompt.jsx` | **NEW** -- custom install banner |

#### Dependencies

- `vite-plugin-pwa` (frontend dev)

---

### 8. Admin Moderation

**Current state:** Admin can manage users (list, change role, delete, reset password) and manage contests (create, start, end, add/remove problems). No comment moderation, no user banning, no content reports system.

#### Requirements

1. **Comment moderation:**
   - Admin can delete any comment (new endpoint `DELETE /api/problems/:pid/comments/:cid`).
   - Comments table already exists in schema.

2. **User banning:**
   - New column: `users.banned_at DATETIME DEFAULT NULL`, `users.ban_reason TEXT`.
   - Banned users receive 403 on all authenticated endpoints (check in `auth` middleware).
   - Admin endpoints: `PATCH /api/auth/users/:id/ban` (ban with reason), `PATCH /api/auth/users/:id/unban`.

3. **Content reports:**
   - New `reports` table: `id, reporter_id, target_type ENUM('comment','problem','user'), target_id, reason, status ENUM('pending','resolved','dismissed'), created_at, resolved_by, resolved_at`.
   - User endpoint: `POST /api/reports` to submit a report.
   - Admin endpoints: `GET /api/reports` (list pending), `PATCH /api/reports/:id` (resolve/dismiss).

4. **Admin dashboard enhancements:**
   - Show pending reports count.
   - Ban/unban buttons on user management.
   - Moderation log view.

#### Acceptance Criteria

- [ ] AC8.1: Admin can delete any comment; non-admin cannot delete others' comments.
- [ ] AC8.2: Banned user gets 403 with ban reason on any API call.
- [ ] AC8.3: User can report a comment; admin sees report in dashboard; admin can resolve/dismiss.
- [ ] AC8.4: Banned user's existing sessions are invalidated (JWT check in middleware looks up ban status).

#### File Changes

| File | Change |
|------|--------|
| `dailycoding-server/init.sql` | Add `banned_at`, `ban_reason` to users; add `reports` table |
| `dailycoding-server/src/middleware/auth.js` | Check `banned_at` in `auth()` middleware |
| `dailycoding-server/src/routes/auth.js` | Add ban/unban endpoints |
| `dailycoding-server/src/routes/reports.js` | **NEW** |
| `dailycoding-server/src/routes/problems.js` | Add comment delete endpoint for admin |
| `dailycoding-server/src/index.js` | Mount reports router |
| `dailycoding/src/pages/AdminPage.jsx` | Add moderation UI (reports, ban/unban) |

#### Dependencies

None.

---

### 9. Email Notifications

**Current state:** Notifications are stored in MySQL `notifications` table and displayed in the app. The `Notification.broadcast()` method sends to all users (DB-only). No email delivery for any notification type.

#### Requirements (depends on Feature 1 -- nodemailer already installed)

1. **Notification preferences:**
   - New column `users.email_notifications JSON DEFAULT '{"contest":true,"battle":true,"weekly":true}'`.
   - Settings UI on ProfilePage to toggle each category.

2. **Triggered emails:**
   - Contest start: email all participants when admin starts a contest.
   - Battle invite: email invited user when a battle invite is created.
   - Weekly digest: cron job (or scheduled task) every Monday with stats summary (problems solved, rating change, streak).

3. **Email queue:**
   - Use Redis list as a simple email queue to avoid blocking request handlers.
   - Background worker polls queue and sends via nodemailer.

#### Acceptance Criteria

- [ ] AC9.1: User with contest notifications enabled receives email when a contest they joined starts.
- [ ] AC9.2: User with battle notifications enabled receives email on battle invite.
- [ ] AC9.3: Weekly digest email is sent every Monday at 9:00 AM KST to users with digest enabled.
- [ ] AC9.4: User can disable each email category independently; disabled category produces no email.
- [ ] AC9.5: Email sending does not block the API response (queued async).

#### File Changes

| File | Change |
|------|--------|
| `dailycoding-server/init.sql` | Add `email_notifications` column to users |
| `dailycoding-server/src/services/email.js` | Add email templates for contest, battle, digest |
| `dailycoding-server/src/services/emailWorker.js` | **NEW** -- Redis queue consumer |
| `dailycoding-server/src/models/Notification.js` | Queue email on `create()` if user preference is on |
| `dailycoding-server/src/routes/auth.js` | Add endpoint to update notification preferences |
| `dailycoding/src/pages/ProfilePage.jsx` | Add notification settings UI |

#### Dependencies

- `node-cron` (backend, for weekly digest scheduler)

---

### 10. Database Indexes + Redis Caching

**Current state:** The `init.sql` has no secondary indexes beyond primary keys and the OAuth unique index. Redis is used for rate limiting, battle rooms, and some AI response caching. No query result caching for common reads (problem list, ranking, user profiles).

#### Requirements

1. **MySQL indexes:**
   ```sql
   CREATE INDEX idx_submissions_user ON submissions(user_id, result);
   CREATE INDEX idx_submissions_problem ON submissions(problem_id, result);
   CREATE INDEX idx_submissions_date ON submissions(submitted_at DESC);
   CREATE INDEX idx_solve_logs_user ON solve_logs(user_id, solve_date);
   CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
   CREATE INDEX idx_problems_tier ON problems(tier, difficulty);
   CREATE INDEX idx_users_rating ON users(rating DESC);
   CREATE INDEX idx_contest_participants ON contest_participants(contest_id, score DESC);
   ```

2. **Redis caching strategy:**
   - Problem list: cache for 5 minutes (`cache:problems`), invalidate on problem create/update/delete.
   - Ranking: already cached (`ranking:global`), extend to tier-specific rankings.
   - User profile: cache for 2 minutes (`cache:user:{id}`), invalidate on profile update.
   - Contest leaderboard: cache for 30 seconds.

3. **Cache invalidation:**
   - On write operations (create/update/delete), explicitly delete relevant cache keys.
   - Use the existing `redis.clearPrefix()` for pattern-based invalidation.

#### Acceptance Criteria

- [ ] AC10.1: `EXPLAIN` on common queries (submissions by user, ranking, problem list) shows index usage (no full table scans).
- [ ] AC10.2: Problem list endpoint serves cached response (Redis hit) on 2nd request within 5 minutes.
- [ ] AC10.3: Cache is invalidated within 1 second of a write operation.
- [ ] AC10.4: Page load time for ranking page < 200ms at 1000 users (vs current uncached).

#### File Changes

| File | Change |
|------|--------|
| `dailycoding-server/init.sql` | Add secondary indexes |
| `dailycoding-server/src/routes/problems.js` | Add Redis caching on GET list |
| `dailycoding-server/src/routes/ranking.js` | Extend caching to tier rankings |
| `dailycoding-server/src/models/User.js` | Cache user lookups |
| `dailycoding-server/src/routes/contests.js` | Cache leaderboard |

#### Dependencies

None (Redis already integrated).

---

## TIER 3 -- Polish

### 11. API Rate Limiting per User Tier

**Current state:** Rate limiting is IP-based with fixed limits (auth: 10/min, AI: 20/min, submit: 15/min, general: 100/min). No per-user or per-plan differentiation.

#### Requirements

- Extend rate limiter to be user-aware (use `req.user.id` when authenticated, `req.ip` as fallback).
- Different limits per plan: Free (current limits), Pro (2x), Team (5x).
- Return `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers.

#### Acceptance Criteria

- [ ] AC11.1: Pro user gets 2x the rate limit of free user on the same endpoint.
- [ ] AC11.2: Rate limit headers are present on all API responses.
- [ ] AC11.3: Unauthenticated requests fall back to IP-based limiting.

#### File Changes

| File | Change |
|------|--------|
| `dailycoding-server/src/middleware/rateLimit.js` | Refactor to support user-aware + plan-based limits, add response headers |

---

### 12. Swagger/OpenAPI Documentation

**Current state:** No API documentation.

#### Requirements

- Generate OpenAPI 3.0 spec from route definitions.
- Serve Swagger UI at `/api/docs`.
- Document all endpoints with request/response schemas, auth requirements, and examples.

#### Acceptance Criteria

- [ ] AC12.1: `/api/docs` serves interactive Swagger UI.
- [ ] AC12.2: All endpoints are documented with request body schemas and response examples.
- [ ] AC12.3: Auth requirements (Bearer token) are documented and testable from Swagger UI.

#### File Changes

| File | Change |
|------|--------|
| `dailycoding-server/src/docs/swagger.js` | **NEW** -- OpenAPI spec definition |
| `dailycoding-server/src/index.js` | Mount swagger-ui-express |

#### Dependencies

- `swagger-ui-express` (backend)
- `swagger-jsdoc` (backend)

---

### 13. Vitest Unit Test Setup

**Current state:** Zero tests. No test framework configured.

#### Requirements

- Configure Vitest for both frontend and backend.
- Write foundational tests: User model CRUD, auth routes (register/login), rate limiter, judge service (mock Docker).
- Frontend: test AuthContext, utility functions.
- Target: 60% coverage on backend models and routes.

#### Acceptance Criteria

- [ ] AC13.1: `npm test` runs Vitest and all tests pass.
- [ ] AC13.2: Backend test coverage >= 60% on `src/models/` and `src/routes/`.
- [ ] AC13.3: Tests run in isolation (no real DB/Redis needed -- mock or in-memory fallback).

#### File Changes

| File | Change |
|------|--------|
| `dailycoding-server/vitest.config.js` | **NEW** |
| `dailycoding-server/tests/` | **NEW** -- test files for models, routes, middleware |
| `dailycoding/vitest.config.js` | **NEW** |
| `dailycoding/tests/` | **NEW** -- test files for context, utilities |
| `dailycoding-server/package.json` | Add vitest to devDependencies, add test script |
| `dailycoding/package.json` | Add vitest to devDependencies, add test script |

#### Dependencies

- `vitest` (both, dev)
- `@testing-library/react` (frontend, dev)
- `supertest` (backend, dev)

---

### 14. CI/CD GitHub Actions Pipeline

**Current state:** No CI/CD. No `.github/` directory.

#### Requirements

- **CI pipeline (on PR and push to main):** lint, typecheck (if applicable), run tests, build frontend.
- **CD pipeline (on push to main):** build Docker image, push to registry, deploy (configurable target).
- **PR checks:** require passing CI before merge.

#### Acceptance Criteria

- [ ] AC14.1: Push to any branch triggers CI (lint + test + build).
- [ ] AC14.2: CI failure blocks PR merge.
- [ ] AC14.3: Push to `main` triggers CD (Docker build + push).
- [ ] AC14.4: Pipeline completes in under 5 minutes.

#### File Changes

| File | Change |
|------|--------|
| `.github/workflows/ci.yml` | **NEW** |
| `.github/workflows/cd.yml` | **NEW** |
| `dailycoding-server/Dockerfile` | Verify multi-stage build optimization |

#### Dependencies

None (GitHub Actions built-in).

---

## Dependency Summary

### Backend (`dailycoding-server/package.json`)

| Package | Version | Tier | Purpose |
|---------|---------|------|---------|
| `nodemailer` | ^6.9 | T1 | Email verification + password reset |
| `helmet` | ^7.1 | T1 | Security headers |
| `socket.io` | ^4.7 | T1 | WebSocket server |
| `@socket.io/redis-adapter` | ^8.3 | T1 | Socket.io Redis adapter |
| `winston` | ^3.11 | T1 | Structured logging |
| `winston-daily-rotate-file` | ^5.0 | T1 | Log rotation |
| `stripe` | ^14.0 | T2 | Payment processing |
| `node-cron` | ^3.0 | T2 | Scheduled tasks |
| `swagger-ui-express` | ^5.0 | T3 | API docs UI |
| `swagger-jsdoc` | ^6.2 | T3 | API docs generator |
| `vitest` | ^1.0 | T3 (dev) | Testing framework |
| `supertest` | ^6.3 | T3 (dev) | HTTP test assertions |

### Frontend (`dailycoding/package.json`)

| Package | Version | Tier | Purpose |
|---------|---------|------|---------|
| `socket.io-client` | ^4.7 | T1 | WebSocket client |
| `vite-plugin-pwa` | ^0.19 | T2 | PWA support |
| `vitest` | ^1.0 | T3 (dev) | Testing |
| `@testing-library/react` | ^14.0 | T3 (dev) | React test utilities |

---

## Database Schema Changes Summary

```sql
-- Tier 1: Email verification
ALTER TABLE users ADD COLUMN email_verified TINYINT(1) DEFAULT 0;
ALTER TABLE users ADD COLUMN plan ENUM('free','pro','team') DEFAULT 'free';

CREATE TABLE email_verification_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tier 2: Subscriptions
CREATE TABLE subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  stripe_customer_id VARCHAR(100),
  stripe_subscription_id VARCHAR(100),
  plan ENUM('free','pro','team') DEFAULT 'free',
  status ENUM('active','past_due','canceled','trialing') DEFAULT 'active',
  current_period_end DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tier 2: Moderation
ALTER TABLE users ADD COLUMN banned_at DATETIME DEFAULT NULL;
ALTER TABLE users ADD COLUMN ban_reason TEXT;
ALTER TABLE users ADD COLUMN email_notifications JSON DEFAULT '{"contest":true,"battle":true,"weekly":true}';

CREATE TABLE reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reporter_id INT NOT NULL,
  target_type ENUM('comment','problem','user') NOT NULL,
  target_id INT NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('pending','resolved','dismissed') DEFAULT 'pending',
  resolved_by INT,
  resolved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tier 2: Performance indexes
CREATE INDEX idx_submissions_user ON submissions(user_id, result);
CREATE INDEX idx_submissions_problem ON submissions(problem_id, result);
CREATE INDEX idx_submissions_date ON submissions(submitted_at DESC);
CREATE INDEX idx_solve_logs_user ON solve_logs(user_id, solve_date);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_problems_tier ON problems(tier, difficulty);
CREATE INDEX idx_users_rating ON users(rating DESC);
CREATE INDEX idx_contest_participants ON contest_participants(contest_id, score DESC);
```

---

## Risk Areas and Mitigation

### High Risk

1. **WebSocket + Docker Judge interaction:** The judge service runs Docker containers that can take up to 10 seconds (compile + execute). Socket.io events must not block. **Mitigation:** Judge runs asynchronously; socket emits happen after judge completes. Use a job queue if judge load is high.

2. **Stripe webhook reliability:** Webhooks can fail, be duplicated, or arrive out of order. **Mitigation:** Implement idempotency keys on webhook processing. Store `stripe_event_id` to deduplicate. Use Stripe's webhook retry mechanism.

3. **Email deliverability:** Emails from a new domain may land in spam. **Mitigation:** Configure SPF, DKIM, and DMARC DNS records. Use a transactional email service (SendGrid, Mailgun) for production instead of raw SMTP.

4. **In-memory fallback complexity:** The codebase has extensive in-memory fallback for MySQL and Redis. Adding features (subscriptions, email tokens) requires updating the in-memory fallback parser in `mysql.js`. **Mitigation:** Consider deprecating the in-memory fallback for production and requiring real MySQL/Redis. Keep it only for local development without Docker.

### Medium Risk

5. **Battle state in Redis only:** Battle rooms exist only in Redis with a 2-hour TTL. If Redis restarts, all active battles are lost. **Mitigation:** Accept this limitation for now; battles are short-lived. Document in operational runbook.

6. **Socket.io scaling:** Without Redis adapter, socket.io only works with a single server process. **Mitigation:** Redis adapter is included in the spec (Feature 3). Ensure deployment uses a single process or properly configures the adapter.

7. **Migration safety:** Adding columns and tables to a live database. **Mitigation:** All schema changes use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`. Test migrations on a staging DB first.

### Low Risk

8. **PWA service worker cache invalidation:** Stale cached assets after deployment. **Mitigation:** `vite-plugin-pwa` uses content hashing for cache busting.

9. **Monaco Editor CSP compatibility:** Monaco uses `eval()` for its worker. **Mitigation:** CSP must include `'unsafe-eval'` for the editor scripts domain. Document this requirement.

---

## Implementation Order Recommendation

```
Phase 1 (Week 1-2): Security + Logging
  - Feature 2 (Security Hardening) -- foundation for everything
  - Feature 5 (Winston Logger) -- needed for debugging all subsequent features

Phase 2 (Week 2-3): Auth Completion
  - Feature 1 (Email Verification + Password Reset)
  - Feature 4 (Google OAuth polish)

Phase 3 (Week 3-5): Real-Time
  - Feature 3 (WebSocket / Socket.io)

Phase 4 (Week 5-7): Monetization + Performance
  - Feature 6 (Stripe Subscriptions)
  - Feature 10 (DB Indexes + Caching)
  - Feature 11 (Rate Limiting per Tier)

Phase 5 (Week 7-8): Engagement
  - Feature 8 (Admin Moderation)
  - Feature 9 (Email Notifications)
  - Feature 7 (PWA)

Phase 6 (Week 8-9): Quality
  - Feature 13 (Vitest Setup)
  - Feature 12 (Swagger Docs)
  - Feature 14 (CI/CD)
```

---

## Open Questions

- [ ] What is the production deployment target (VPS, AWS, GCP, Vercel)? This affects CD pipeline configuration, SMTP choice, and environment variable management.
- [ ] Should the in-memory MySQL/Redis fallback be maintained for all new features, or can it be deprecated for production? Maintaining it significantly increases implementation complexity for every new table/query.
- [ ] For email verification, should unverified users be blocked entirely after 7 days, or just restricted from specific features? The spec assumes feature restriction.
- [ ] What transactional email service will be used in production (raw SMTP, SendGrid, Mailgun, AWS SES)? This affects the nodemailer transport configuration.
- [ ] For Stripe subscriptions, should there be a trial period for Pro tier? If so, how many days?
- [ ] The UI is entirely in Korean. Should email templates also be Korean-only, or should i18n be considered?
- [ ] For the weekly digest email, what specific metrics should be included (problems solved, rating change, streak, rank position)?
- [ ] Should battle results eventually affect rating/tier (currently explicitly excluded per code comments)?

