Task statement
- Audit and improve `dailycoding-final` for deployment readiness, local verification, and safer admin/test account provisioning.

Desired outcome
- Harden admin/bootstrap behavior before domain + server deployment.
- Add a local-only, explicit bootstrap path for admin and test users so the app can be verified without manual DB edits.
- Preserve existing app behavior and keep the diff narrow enough to verify locally.

Known facts / evidence
- Workspace has a Vite React frontend in `dailycoding/` and an Express backend in `dailycoding-server/`.
- Backend always ensures an `admin@dailycoding.com` account on startup in [src/index.js](/Users/choi/Desktop/dailycoding-final/dailycoding-server/src/index.js:185).
- When `ADMIN_PASSWORD` is missing, backend generates a password and logs a warning; the in-memory fallback also prints a generated admin password in [src/config/mysql.js](/Users/choi/Desktop/dailycoding-final/dailycoding-server/src/config/mysql.js:81).
- Frontend stores the access token in `localStorage` in [src/api.js](/Users/choi/Desktop/dailycoding-final/dailycoding/src/api.js:12) and [src/context/AuthContext.jsx](/Users/choi/Desktop/dailycoding-final/dailycoding/src/context/AuthContext.jsx:28).
- Admin user listing API returns `{ users, total, limit, offset }`, but the admin page currently assigns `r.data` directly to `users`, which risks breaking the UI in [src/pages/AdminPage.jsx](/Users/choi/Desktop/dailycoding-final/dailycoding/src/pages/AdminPage.jsx:69).
- Backend README already documents local Docker + Vite startup and references `ADMIN_PASSWORD`, but there is no explicit local-only demo/test bootstrap flow.

Constraints
- Do not retrieve or disclose existing admin credentials.
- Do not create or expose non-local privileged access paths.
- Keep local bootstrap limited to non-production environments and explicit opt-in.
- No new dependencies.

Unknowns / open questions
- Whether the operator wants seeded credentials in env only or safe defaults for local-only bootstrap.
- Whether production will run behind a reverse proxy with TLS termination and cookie passthrough.

Likely touchpoints
- `dailycoding-server/src/index.js`
- `dailycoding-server/src/config/mysql.js`
- `dailycoding-server/README.md`
- `dailycoding-server/.env.example`
- `dailycoding/src/pages/AdminPage.jsx`
- optional helper under `dailycoding-server/src/services/`
