# Product Requirements Document (PRD): Personalization, Content Expansion, and Functional Completion

## 1. Problem Statement
Users currently lack the ability to deeply personalize their workspace and organize their learning. Specifically, the environment forgets their preferred editor settings (font size, theme, language), they have no native way to store private notes or observations on problems, and discovering relevant problems is difficult due to basic filtering capabilities. Furthermore, the problem catalog needs expansion to sustain active user engagement and challenge higher-tier competitors. 

## 2. Scope and Non-Goals
### Scope
- **User Settings Module**: Implement a JSON-based persistence layer for editor preferences (font size, theme overrides, preferred programming language).
- **Problem Notes Feature**: Build full-stack support for private user-specific and problem-specific annotations (Database, API, and UI integration).
- **Advanced Problem Filtering**: Enhance the problem discovery interface and backend APIs to support multi-select filtering across multiple tags and difficulty tiers simultaneously.
- **Content Expansion**: Add 10+ new high-quality problems (with descriptions, constraints, examples, and comprehensive test cases) to the database seed.
- **UI/UX Enhancements**: Create a dedicated, modern Settings UI page/modal and embed a "Notes" tab directly within the JudgePage.

### Non-Goals
- Public sharing of problem notes (notes remain strictly private to the user).
- A complete visual overhaul of the entire platform (UI changes are limited to Settings and the JudgePage Notes tab).
- Complex analytics or rich-text (WYSIWYG) editors for notes; a standard Markdown-capable textarea is sufficient.
- Multi-language translation of the problem descriptions (English only).

## 3. Acceptance Criteria
- [ ] **User Settings (JSON)**: Editor preferences (font size, theme, preferred language) are saved to the user's profile and applied automatically upon login and navigating to the JudgePage.
- [ ] **Problem Notes**: A user can write, save, and retrieve private text notes for any specific problem. Notes persist across sessions.
- [ ] **Advanced Problem Filtering**: The problem list allows combining multiple tags (e.g., "DP" AND "Graph") with tier filters (e.g., "Gold"). The backend efficiently returns the correct intersection.
- [ ] **Content**: The `init.sql` or seed script contains 10+ new problems. Each problem has at least 3 valid test cases, time/space constraints, and an expected solution structure.
- [ ] **UI/UX**: 
    - The JudgePage includes a visually distinct, accessible "Notes" tab alongside the Problem/Submissions tabs.
    - A newly designed Settings interface is accessible from the user profile/navigation menu.

## 4. Constraints and Dependencies
- **Technical**: 
  - Database schema migrations are required for `User` (to add a `settings` JSON column) and a new `ProblemNotes` table.
  - Settings must be validated and sanitized to prevent injection attacks or invalid JSON shapes.
- **Dependencies**: 
  - The UI updates depend on the existing React Router v7 structure and Monaco Editor state.
  - The advanced filtering must optimize DB queries or utilize the existing Redis cache to maintain performance on the problem list.
- **Compatibility**: 
  - Existing users should default to standard settings if their JSON column is null.
  - Fallback logic should ensure the backend operates normally if Redis caching for new filters fails.

## 5. Handoff Checklist
- [ ] PRD reviewed against project intent.
- [ ] Database schema changes detailed (Settings JSON, ProblemNotes table).
- [ ] Required API routes documented for Notes (`GET/PUT /api/problems/:id/notes`) and Settings (`PUT /api/users/settings`).
- [ ] Handoff ready for `omg-executor` (Frontend/Backend implementation).
- [ ] Handoff ready for `omg-verifier` (End-to-End tests for Settings persistence, filtering logic, and Note CRUD operations).