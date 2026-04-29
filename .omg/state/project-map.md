# Project Map

## Module Map

| Layer | Responsibility | Key Files |
|---|---|---|
| **Core** | Server entry and middleware | `dailycoding-server/src/index.js`, `middleware/auth.js` |
| **Logic** | Business logic & Database helpers | `dailycoding-server/src/models/`, `config/mysql.js`, `config/redis.js` |
| **Services** | Isolated high-level features | `dailycoding-server/src/services/` (Judge, Socket, Sandbox) |
| **Routes** | API Endpoint definitions | `dailycoding-server/src/routes/` |
| **UI** | Global layout and routing | `dailycoding/src/App.jsx`, `main.jsx`, `api.js` |
| **Features** | Interactive views & State | `dailycoding/src/pages/` (BattlePage, ContestPage, JudgePage) |
| **Components** | Reusable UI elements | `dailycoding/src/components/` |

## Dependency Hotspots
- **Redis**: Central hub for battle state (`Battle.js`) and ranking (`User.js`).
- **SocketServer**: Hub for real-time signaling for Battles and Contests.
- **Judge Service**: Complex interaction between models and sandbox environments.
- **MySQL Config**: Crucial singleton pattern for connection pooling.

## Known Constraints
- **Indentation**: 2-space indentation.
- **ES Modules**: Mandatory `import/export`.
- **User Privacy**: `User.safe()` mandatory for all user data responses.
- **Redis Hygiene**: `SCAN` required via `redis.clearPrefix()` or `redis.scan()`.
