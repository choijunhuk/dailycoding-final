# Deep Init Summary

## Core Mandate
DailyCoding: A production-grade AI coding platform with 1:1 battles, contests, and real-time code execution.

## Entry Points
- **Backend**: `dailycoding-server/src/index.js` (Express, ESM)
- **Frontend**: `dailycoding/src/main.jsx` (Vite, React 18 SPA)
- **Infrastructure**: `docker-compose.yml` (MySQL, Redis, API, Web, Grafana, Loki, Promtail)

## Architecture Boundaries
- **Frontend/Backend**: Clear REST API (Axios) + Real-time Socket.io signaling.
- **Data Persistence**: MySQL 8.0 (Primary) / Redis 7.0 (Ranking, Battle State, Caching).
- **Execution Sandbox**: Dockerode (Local/Dev) / Native Subprocess (Production).
- **Monitoring**: Centralized logging via Winston JSON -> Promtail -> Loki -> Grafana.

## High-Risk Zones
- **Code Execution**: Running user-provided code in isolated environments (Docker/ulimit).
- **Atomic Operations**: Contest scoring and Redis Sorted Set updates.
- **Authentication**: JWT refresh token rotation and session management.
- **Race Conditions**: Concurrent battle state updates in Redis (mitigated via `Battle.js` logic).

## Dependencies & Tooling
- **Backend**: Node.js 18+, Express, Socket.io, Redis, MySQL2, Winston, Dockerode, Google Gemini AI.
- **Frontend**: React 18, React Router v7, Monaco Editor, Axios.
- **Build/Test**: `npm run dev`, `node --test` (Backend), `npm run build` (Frontend).
