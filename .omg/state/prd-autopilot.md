# PRD: Battle System Fix & Admin Management Audit

## 1. Problem Statement
- **Battle System**: Users report the battle system is not working correctly. The user suspects a subscription/payment issue, though no explicit guards were found in the routes.
- **Admin Management**: Admins cannot see or manage all problems (especially contest-related or non-global ones) because the `Problem.findAll` method strictly filters for `visibility = 'global'`.

## 2. Goals
- Fix the battle system logic to ensure it's functional for all verified users (or clarify subscription requirements).
- Enable admins to see and manage all problems regardless of visibility status.
- Ensure the Admin Panel provides a comprehensive view of the system state.

## 3. Acceptance Criteria
- **AC-BATTLE-1**: Verified users can invite, accept, and participate in battles without being blocked by invisible subscription requirements.
- **AC-ADMIN-1**: Admins can see all problems (global and contest-specific) in the Admin Panel.
- **AC-ADMIN-2**: `Problem.findAll` supports an `isAdmin` or `includeHidden` flag to bypass global visibility filters.
- **AC-ADMIN-3**: Admins can edit and delete contest-specific problems from the main problem list in the Admin Panel.

## 4. Technical Constraints
- Maintain existing `visibility` logic for standard users.
- Use `adminOnly` middleware for any expanded data access.
