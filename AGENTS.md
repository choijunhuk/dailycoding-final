# Repository Guidelines

## Project Structure & Module Organization
This repository has two apps:
- `dailycoding/`: Vite + React frontend. Main code is in `src/` (`pages/`, `components/`, `context/`, `hooks/`). Static assets live in `public/`.
- `dailycoding-server/`: Express backend. Use `src/routes/` for API endpoints, `src/services/` for judge/business logic, `src/models/` for DB access, and `src/middleware/` for auth/rate limits.

Treat `.omx/` and `.omc/` as workflow/runtime artifacts, not product source.

## Build, Test, and Development Commands
Run commands in the relevant app directory.

- `cd dailycoding && npm run dev` - start frontend dev server
- `cd dailycoding && npm run build` - build production bundle to `dist/`
- `cd dailycoding && npm run preview` - preview built frontend
- `cd dailycoding-server && npm run dev` - run API with nodemon
- `cd dailycoding-server && npm start` - run API in production mode
- `cd dailycoding-server && npm run docker` / `npm run docker:down` - start/stop local DB stack
- `cd dailycoding-server && node --test src/services/judge.test.js` - run backend tests

## Coding Style & Naming Conventions
Use 2-space indentation. Keep existing style per area: frontend generally no semicolons; backend generally uses semicolons. Naming conventions:
- `PascalCase` for React components/pages (`JudgePage.jsx`)
- `camelCase` for hooks/helpers
- lowercase for route/service files (`problems.js`, `submissionExecution.js`)
- singular model names (`User.js`, `Problem.js`)

## Testing Guidelines
Backend tests use Node's built-in test runner and should be `*.test.js` near related code. For backend changes, run touched tests plus `node --check` on edited files. For frontend changes, `npm run build` must pass and core flows should be smoke-tested manually (auth, problems, judge, submissions).

## Commit & Pull Request Guidelines
Use intent-first commit subjects. Follow Lore trailers when useful: `Constraint:`, `Rejected:`, `Confidence:`, `Scope-risk:`, `Tested:`, `Not-tested:`. Keep PRs focused; include changed paths, user-visible impact, env/migration notes, and screenshots for UI updates.

## Security & Configuration Tips
Do not commit real secrets. Keep templates only in `.env.example`. When changing deployment settings, update related values together (`ALLOWED_ORIGINS`, `FRONTEND_URL`, OAuth callbacks, Stripe webhook vars, `VITE_API_URL`).
