# GEMINI.md - Project Context & Instructions

This document provides essential context and instructions for AI agents working on the **DailyCoding** project.

## Project Overview

**DailyCoding** is a production-grade full-stack AI coding platform. It features 1:1 coding battles, competitive programming contests, AI-driven code reviews, and a tiered subscription model.

### Core Technologies
- **Frontend**: React 18 (Vite, SPA), React Router v7, Monaco Editor, Axios.
- **Backend**: Node.js (Express, ESM), Socket.io (Real-time), Google Gemini AI (Generative features).
- **Data & Cache**: MySQL 8.0 (Primary Store), Redis 7.0 (High-performance Ranking/Caching).
- **Security**: JWT-based Authentication (Refresh Token rotation), Bcrypt, Helmet, CORS, Input Sanitization.
- **Infrastructure**: Docker Compose (MySQL, Redis, API, Web), Dockerode (Isolated Sandbox).

### Architecture
- **Monorepo Structure**:
    - `dailycoding/`: Frontend application.
    - `dailycoding-server/`: Backend API server.
- **Graceful Fallbacks**: The backend is designed to run even if MySQL or Redis is unavailable, using in-memory fallbacks for development convenience.
- **Code Execution Sandbox**:
    - **`docker-sandbox`**: Uses Docker containers for secure code execution (Local/Dev).
    - **`native-subprocess`**: Uses `child_process` with `ulimit` constraints (Production/Railway).

---

## Building and Running

### Prerequisites
- Node.js (v18+)
- Docker & Docker Compose (optional but recommended for DB/Sandbox)
- Environment variables (see `.env.example` in each subproject)

### Backend (`dailycoding-server/`)
- **Start DB/Cache**: `npm run docker` (starts MySQL 3307 & Redis 6379)
- **Dev Mode**: `npm run dev` (starts on port 4000 with nodemon)
- **Prod Mode**: `npm start`
- **Tests**: `node --test src/services/judge.test.js`

### Frontend (`dailycoding/`)
- **Dev Mode**: `npm run dev` (starts Vite on port 5173)
- **Build**: `npm run build`
- **Preview**: `npm run preview`

---

## Development Conventions

### Coding Style
- **ES Modules**: Always use `import`/`export`. `require` is forbidden.
- **Indentation**: 2-space indentation.
- **Naming**:
    - Components/Pages: `PascalCase` (`JudgePage.jsx`).
    - Hooks/Helpers: `camelCase` (`useAuth.js`).
    - Routes/Models/Services: `lowercase` (`auth.js`, `User.js`).
- **Semicolons**: Generally used in the backend; optional/minimal in the frontend.

### Architecture Patterns
- **Thin Controllers**: Keep routes simple; move business logic to Models (`models/`).
- **DB Helpers**: Always use `query`, `queryOne`, `insert`, and `run` from `config/mysql.js`. Never access the pool directly.
- **User Sanitization**: Always use `User.safe(user)` before returning user data to the client to avoid leaking sensitive fields.
- **Redis Hygiene**: Use `SCAN` instead of `KEYS` (via `redis.clearPrefix`) to avoid blocking the server.

### Security Mandates
- **Auth Middleware**: Use `auth`, `adminOnly`, and `requireVerified` from `middleware/auth.js`.
- **Admin Bypass**: Admins bypass email verification and are automatically authorized for all restricted routes.
- **Input Sanitization**: Use the global sanitization middleware in `index.js` to strip dangerous HTML and prevent prototype pollution.

---

## Key Business Logic
- **Rating System**: Recalculated from the top 100 solved problems on every solve.
- **Tier Promotion**: Automatically handled in `User.onSolve()` based on rating thresholds.
- **Streak Management**: Updated daily in `User.onSolve()`; grants badges/titles at milestones.
- **Contest Scoring**: Uses atomic SQL updates (`score = score + 1`) and syncs to Redis Sorted Sets for real-time leaderboards.

---

## Verification Strategy
- **Backend**: Run specific tests via `node --test`. Check for `console.error` and `logger.warn` in output.
- **Frontend**: `npm run build` must pass. Test core flows: Login -> Problem List -> Judge -> Submission History.
- **Integration**: Verify Redis keys via `redis-cli` and MySQL records via `mysql-client` during development.
