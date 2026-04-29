# Validation Strategy

## Critical Verification Commands
- **Backend Build/Lint**: `npm start` (Verify entry point health).
- **Backend Tests**: `node --test src/services/judge.test.js` (Run specific service tests).
- **Frontend Build**: `npm run build` (Verify production build integrity).
- **Docker Readiness**: `docker-compose config` (Verify infrastructure orchestration).

## Success Metrics
- [ ] 100% test pass on critical logic (Judge, Auth).
- [ ] Zero lint warnings on modified files.
- [ ] `npm run build` passes without errors.
- [ ] Logs correctly ingested into Grafana/Loki.
- [ ] Redis keys correctly prefixed and scanning.

## Known Environment Gaps
- **Gemini AI**: API Key required for generative features.
- **Docker**: Requires `docker.sock` mount for sandbox execution.
- **Port Conflicts**: Defaults to 3000 (Web), 4000 (API), 3307 (MySQL), 6379 (Redis), 3001 (Grafana).
