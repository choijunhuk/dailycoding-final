# Task Context Snapshot

## Task statement
$autopilot 더 완벽히 완성 및 디버깅

## Desired outcome
- 최근 수정(히든케이스 공개/최소개수 완화)의 회귀 없는 안정화
- 빌드/테스트/정적검사 증거 추가 확보
- 남은 리스크 식별 및 보완

## Known facts/evidence
- frontend build 성공
- backend 핵심 테스트 통과
- 문제 총 60개, 기존 10문제 hidden I/O 누락 0

## Constraints
- 기존 기능 회귀 금지
- 새 의존성 추가 금지

## Unknowns/open questions
- 실제 배포 DB/서버 재기동 여부

## Likely touchpoints
- dailycoding-server/src/routes/problems.js
- dailycoding-server/src/shared/problemCatalog.js
- dailycoding/src/pages/JudgePage.jsx
- dailycoding/src/pages/AdminPage.jsx
- dailycoding/src/pages/ContestPage.jsx
