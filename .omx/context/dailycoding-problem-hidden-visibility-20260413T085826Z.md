# Task Context Snapshot

## Task statement
`desktop/dailycoding-final` 프로젝트에서 문제 구성을 완성한다. 기존 10문제 기준 코드 오류를 우선 수정하고, 이미 충분한 문제 수가 있으면 추가 생성은 생략한다. 히든 케이스 최소 10개 강제를 제거하고, 히든 케이스 입력/출력이 사용자에게 보이도록 한다.

## Desired outcome
- 문제 카탈로그/노출이 정상 동작
- 히든 테스트케이스 입력/출력 공개
- 히든 케이스 최소 개수 제한 해제
- 기존 문제의 히든 입력/출력 누락이 없도록 보장

## Known facts / evidence
- shared problem catalog에는 총 60문제가 정의되어 있음
- 기존 10문제(1001~1010)는 hidden testcase 입력/출력 누락 0건
- 비관리자 `/api/problems/:id` 응답에서 `testcases`를 제거하는 로직 존재
- 프론트 JudgePage는 examples만 렌더링, hidden testcases 렌더링 없음
- Admin/Contest 화면에서 MIN_HIDDEN_TESTCASES(10) 강제 검증 존재

## Constraints
- AGENTS.md 및 프로젝트 규칙 준수
- 최소 수정으로 기능 완성
- 새 의존성 추가 금지

## Unknowns / open questions
- 배포 환경에서 서버 재시작 시점

## Likely touchpoints
- `dailycoding-server/src/routes/problems.js`
- `dailycoding-server/src/shared/problemCatalog.js`
- `dailycoding/src/pages/JudgePage.jsx`
- `dailycoding/src/pages/AdminPage.jsx`
- `dailycoding/src/pages/ContestPage.jsx`
