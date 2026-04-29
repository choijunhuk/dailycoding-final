# Product Requirements Document (PRD): DailyCoding Phase Next - Hardening & Expansion

## Problem Statement
The DailyCoding platform has successfully established its core features, but requires architectural and functional hardening to support scale and improve user experience. Specifically, the monolithic `JudgePage.jsx` hinders maintainability, the AI features are isolated rather than integrated into the user's workflow, the code execution sandbox lacks configurable limits and robust error logging, and the dashboard lacks dynamic, real-time engagement features.

## Scope
This phase focuses on 4 specific actionable improvements:
1. **AI Integration**: Implement live debugging and AI-driven hints directly within the coding interface using the Gemini API.
2. **Refactoring**: Deconstruct the `JudgePage.jsx` component in the frontend into smaller, focused, and reusable sub-components.
3. **Execution Scalability**: Parameterize engine limits (e.g., timeout, memory) in the `judgeCode` engine and enhance logging for sandbox execution failures.
4. **Social/Gamification**: Introduce a real-time "Recent Activity" feed on the user dashboard displaying recent solves, tier promotions, and contest results via Socket.io.

### Non-Goals
- Migrating the primary data store away from MySQL.
- Replacing the Monaco Editor with a different code editor.
- Implementing new programming languages for the execution engine (stick to currently supported ones).
- Overhauling the entire site's UI design; stick to existing design system.

## Acceptance Criteria

### Task 1: AI Integration (Live Debugging/Hints)
- **AC1.1**: A "Get AI Hint" or "Debug with AI" button is accessible directly from the main coding interface.
- **AC1.2**: Clicking the button sends the current code, problem description, and any execution errors to the Gemini API.
- **AC1.3**: The AI response is displayed in a non-intrusive panel or modal without losing the user's code context.
- **AC1.4**: Rate limiting is applied to prevent abuse of the Gemini API endpoint.

### Task 2: Refactoring `JudgePage.jsx`
- **AC2.1**: `JudgePage.jsx` is split into logical sub-components (e.g., `ProblemDescription`, `CodeEditorPanel`, `TestCasesPanel`, `ExecutionResults`).
- **AC2.2**: State management is effectively passed down to child components or handled via a shared context/hook without unnecessary re-renders.
- **AC2.3**: No existing functionality (code editing, submission, result rendering) is broken.
- **AC2.4**: The total lines of code in `JudgePage.jsx` is significantly reduced (e.g., under 200 lines) and becomes a container/orchestrator component.

### Task 3: Execution Scalability (`judgeCode` Enhancements)
- **AC3.1**: Sandbox limits (timeout, memory, process count) are configurable via environment variables or a configuration file, rather than hardcoded.
- **AC3.2**: A robust error logging mechanism captures raw output, exit codes, and resource usage for failed sandbox executions.
- **AC3.3**: Administrators or developers can access these logs to diagnose recurring sandbox issues.
- **AC3.4**: Fallback mechanisms correctly handle and report `ulimit` or Docker sandbox crashes to the user gracefully.

### Task 4: Social/Gamification (Recent Activity Feed)
- **AC4.1**: The main dashboard displays a "Recent Activity" component.
- **AC4.2**: The feed is updated in real-time using Socket.io when users solve problems, achieve streaks, or get promoted.
- **AC4.3**: The feed displays a maximum number of recent items (e.g., top 50) and handles reconnection gracefully.
- **AC4.4**: Redis is utilized to cache the recent activity list to ensure quick load times for new connections.

## Constraints & Dependencies
- **Dependencies**: React 18, Socket.io, Node.js backend, Google Gemini API, Redis, MySQL.
- **Constraints**: 
  - Must maintain the existing architecture (thin controllers, Model-based business logic).
  - Do not use `require` (use ES Modules).
  - All backend API routes must utilize existing auth middlewares (`auth`, `adminOnly`, etc.).
- **Compatibility**: The frontend changes must build successfully using Vite (`npm run build`).

## Handoff Checklist
- [ ] Read through the PRD and confirm understanding of the goals and non-goals.
- [ ] For Task 2, inspect `JudgePage.jsx` first to plan the component hierarchy before making edits.
- [ ] For Task 3, inspect the current sandbox implementations (`docker-sandbox`, `native-subprocess`) to locate hardcoded limits.
- [ ] For Task 4, ensure Redis operations are used safely without blocking the event loop.
- [ ] Verify that all new features and refactored components align with the `.omg-core` and project-specific conventions.