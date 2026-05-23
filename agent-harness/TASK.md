# Agent Task: Rewards Inventory, Profile Showcase, i18n, Verification, Deployment

## Goal

Improve the DailyCoding rewards system using the existing project structure.

This is not a full rewrite. First inspect the existing implementation, then reuse or minimally extend it.

## Main Requirements

1. Keep i18n support.
2. Do not hardcode new user-facing Korean/English UI text inside components.
3. Separate badges and titles visually in the rewards inventory page.
4. Allow badges to be showcased on the user profile.
5. If badge showcase already exists, reuse it instead of creating a duplicate system.
6. Allow users to set one representative title.
7. Show representative title on the profile.
8. Show representative title next to the user name in important user display areas.
9. Show personal progress percentage for each badge/title.
10. Show owner ratio for each badge/title among all users.
11. Check Korean/English translation completeness.
12. Check whether Korean/English UI text sounds natural.
13. Run verification before commit.
14. Deploy using the existing server deployment command only after verification passes.

## Search First

Before editing, search for existing code using these terms:

- reward
- rewards
- badge
- badges
- title
- titles
- achievement
- achievements
- profile
- inventory
- collection
- display
- showcase
- equipped
- selected
- representative
- progress
- percentage
- ownerRatio
- ownerCount
- totalUsers
- 보상
- 보관함
- 뱃지
- 배지
- 칭호
- 대표
- 전시
- 달성률
- 보유 비율
- i18n
- react-i18next
- useTranslation
- t(
- locales
- language
- locale
- ko
- en

## Existing Structure Must Be Checked

Check frontend:

- Rewards inventory page
- Badge list UI
- Title list UI
- Profile page
- User name display components
- Badge showcase UI
- Title selection/display UI
- Progress display UI
- Owner ratio display UI
- Existing i18n locale files
- Hardcoded Korean/English UI text

Check backend:

- badge routes/services/models
- title routes/services/models
- achievement routes/services/models
- profile routes/services/models
- reward routes/services/models
- user-owned badge/title storage
- representative title storage
- showcased badge storage
- total user count query
- owner count query per badge/title

Check DB or migrations for similar tables:

- badges
- titles
- user_badges
- user_titles
- achievements
- users
- profiles
- user_profile
- badge_showcase
- title_equipped
- rewards
- user_rewards

Do not create new tables or APIs before confirming existing structure.

## Rewards Inventory UI

The rewards inventory may remain a single page, but badges and titles must be clearly separated.

Use tabs or sections:

- Badges
- Titles

Each reward card should show, when data exists:

- Name
- Description
- Condition
- Owned/not owned status
- My progress percentage
- Owner ratio among all users
- Badge showcase button or title equip button

Badge card example:

- Badge name
- Badge description
- Unlock condition
- Owned status
- My progress: 70%
- Owner ratio: 12.4%
- Showcase / Remove showcase button

Title card example:

- Title name
- Title description
- Unlock condition
- Owned status
- My progress: 100%
- Owner ratio: 8.1%
- Equip representative title button
- Current representative title label

## Badge vs Title Meaning

Badge:

- Collection-type reward
- Multiple badges can be showcased on profile
- Examples: streak, solved count, battle wins

Title:

- Representative label shown near username
- Only one title can be equipped
- Examples: 초보 코더, 알고리즘 탐험가, 배틀 마스터

If badges and titles are stored in one reward structure, check whether there is a type/rewardType field.

If there is already a type field, use it.

If there is no type field, add the smallest possible change to distinguish badge/title.

Avoid large DB redesign.

## Representative Title

If representative title already exists:

- Connect it to profile display
- Connect it to user name display
- Connect title setting from rewards inventory

If it does not exist:

- Allow the user to set one owned title as representative
- User cannot equip a title they do not own
- Only one representative title per user
- API must validate ownership
- Profile response should include representative title

UI:

- Owned title: show “대표 칭호로 설정”
- Equipped title: show “대표 칭호”
- Locked title: disable equip button

## User Name Display

Find important places where username appears:

- Profile page
- Ranking
- Solve history
- Comments/posts if present
- Battle result
- Dashboard
- Header user menu

If there is a common component such as UserName/UserProfileDisplay/UserAvatar, update it.

If not, apply to important screens first:

- Profile
- Ranking
- Battle result

Possible display style:

- 홍길동 · 알고리즘 탐험가
- [알고리즘 탐험가] 홍길동

Use the existing design tone.

Do not over-refactor.

## Badge Showcase

If badge showcase already exists:

- Reuse it
- Connect showcase/remove showcase from rewards inventory
- Ensure showcased badges appear on profile
- Preserve existing max showcase limit

If badge showcase does not exist:

- Allow users to showcase owned badges
- Users cannot showcase badges they do not own
- Users can remove showcased badges
- Profile response should include showcased badges
- Rewards inventory should show showcase/remove button

Recommended default limit:

- Use existing limit if present
- Otherwise use 3 as default
- Put limit in a constant

## Progress Percentage

Show progress for each badge/title.

Examples:

- Solve 43 out of 100 problems → 43%
- Win 7 out of 10 battles → 70%
- Already owned → 100%

Rules:

- Reuse existing achievement/progress logic if available
- Prefer backend response with current/target/percentage
- Do not hardcode progress calculations in random frontend components
- If progress cannot be calculated, show a graceful fallback

Recommended response shape:

```json
{
  "id": 1,
  "type": "badge",
  "name": "Example Badge",
  "description": "Example description",
  "condition": "Solve 100 problems",
  "owned": true,
  "progress": {
    "current": 43,
    "target": 100,
    "percentage": 43
  },
  "ownerStats": {
    "ownerCount": 12,
    "totalUsers": 100,
    "ownerRatio": 12
  }
}
```

## Owner Ratio

Show how many users own each badge/title.

Examples:

- 12 out of 100 users → 12%
- 1 out of 37 users → 2.7%

Rules:

- Avoid division by zero
- Use active user policy if already defined
- Otherwise use users table count
- Show one decimal place if needed
- Use a natural label such as “보유 비율” or “전체 유저의 12.4%가 보유”
## i18n Rules

All new user-facing text must use translation keys.

Do not hardcode new Korean/English UI text inside components.

Preferred keys:

- rewards.inventory
- rewards.badges
- rewards.titles
- rewards.owned
- rewards.notOwned
- rewards.progress
- rewards.ownerRatio
- rewards.equipTitle
- rewards.equippedTitle
- rewards.showcaseBadge
- rewards.removeShowcase
- rewards.showcased
- rewards.locked
- rewards.condition
- profile.representativeTitle
- profile.showcasedBadges
- error.badgeNotOwned
- error.titleNotOwned
- error.showcaseLimitExceeded

Korean and English keys must match.

Korean should sound natural for a Korean web service.

English should be concise and not awkward direct translation.

Avoid mixed language UI like:

풀이 시간 통계
평균 풀이 시간
No record
총 풀이 시간
기록 없음

Use consistent translation.

Korean example:

풀이 시간 통계
평균 풀이 시간
아직 기록이 없습니다
총 풀이 시간
아직 기록이 없습니다
최단 풀이 시간
아직 기록이 없습니다

English example:

Solving Time Stats
Average Solving Time
No records yet
Total Solving Time
No records yet
Fastest Solve
No records yet
Do Not

Do not:

Rewrite unrelated battle/problem/judge logic
Change authentication logic unless required
Heavily redesign DB schema
Heavily rewrite routing
Redesign the entire UI
Create duplicate reward systems
Create duplicate badge showcase systems
Commit .env
Commit API keys
Commit DB passwords
Commit JWT secrets
Commit logs
Commit uploads
Commit node_modules
Commit runtime artifacts
Expose secrets in frontend code
Deploy before verification passes
Validation

Run the harness:

bash agent-harness/verify-before-commit.sh

If it fails, fix the issue and run it again.

Do not commit or deploy until it passes.

Deployment

This project is deployed by pushing changes to GitHub and then running the existing server deployment script over SSH.

Deployment command:

ssh -i ~/Downloads/LightsailDefaultKey-ap-northeast-2.pem ubuntu@13.125.79.231 "cd /home/ubuntu/dailycoding-final && bash scripts/deploy.sh"

Before deployment:

Run git status
Ensure no secrets/runtime files are staged
Run the harness verification
Commit changes
Push to GitHub

After deployment:

Check the deployed site:

Rewards inventory page
Badge section
Title section
Profile page
Representative title display
Badge showcase display
Progress display
Owner ratio display
Korean/English translation switching
No raw translation keys visible

If SSH key does not exist or server access fails, do not claim deployment succeeded.