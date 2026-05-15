# Security And Operations Checklist

## Production Gates

Run before deploy:

```bash
node scripts/production-preflight.mjs dailycoding-server/.env dailycoding/.env.production
```

This checks for:

- Required server env values.
- HTTPS frontend/API URLs.
- No localhost production origins.
- Strong-enough JWT/admin/DB/SMTP values.
- Docker judge mode.
- Stripe test payment links.
- Frontend API URL consistency.

## Runtime Expectations

- `NODE_ENV=production`
- `JUDGE_MODE=docker`
- `FRONTEND_URL=https://...`
- `ALLOWED_ORIGINS` includes the exact frontend origin.
- `REDIS_URL` points to the production Redis instance.
- SMTP is configured so verification/reset links never fall back to console logging.

## Deployment Health

`scripts/deploy.sh` now treats degraded health as a failed deploy:

- `status === "ok"`
- `services.database === "connected"`
- `services.redis === "connected"`
- `services.judge === "docker"` by default

Only use `EXPECTED_JUDGE_HEALTH=native` for a deliberately native judge deployment.

## High-Value Next Security Work

- Add database backup and restore rehearsal scripts.
- Add Playwright smoke tests for login, problem solve, submit, AI hint, and checkout entry.
- Add alerting for `/api/health` degradation, judge failures, Stripe webhook errors, and AI quota cooldown.
- Add admin audit export and retention policy.
- Add dependency audit to CI with an allowlist for accepted advisories.
