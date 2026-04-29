# PRD: 미완성 영역 정리 및 최적화 실행 계획

> Supersedes `.omx/plans/prd-post-change-roadmap-2026-04.md` for execution priority. The older roadmap contains stale judge assumptions about battle native support and the current test failure cause.

## Requirements Summary
- 저장소 기준으로 실제 미완성 기능, 깨진 계약, 최적화 우선순위를 다시 정렬한다.
- 우선순위는 "지금 막혀 있는 결함 복구 -> 잘못된 기능 계약 수정 -> 초기 로딩/중복 요청 최적화 -> 큰 화면 유지보수성 개선" 순서를 따른다.
- 실행 단계는 작고 검증 가능해야 하며, 각 단계는 빌드/테스트/수동 QA로 완료 여부를 판단할 수 있어야 한다.

## Current Evidence
- 프런트엔드는 현재 빌드된다: `cd dailycoding && npm run build` 통과, Vite output main chunk `dist/assets/index-V63XDJmm.js` 484.16 kB.
- 백엔드는 judge 테스트 이전에 파싱 단계에서 막힌다. `dailycoding-server/src/services/judge.js:106` 과 `dailycoding-server/src/services/judge.js:336` 에서 `OUTPUT_LIMIT` 이 중복 선언되어 `node --test src/services/judge.test.js` 가 실패한다.
- 현재 judge 테스트는 Python-only 가정이 아니라 5개 언어 native 지원을 기대한다: `dailycoding-server/src/services/judge.test.js:17`, `dailycoding-server/src/services/judge.test.js:32`, `dailycoding-server/src/services/judge.test.js:39`.
- 이전 로드맵의 "battle native judge는 503" 가정은 더 이상 맞지 않는다. 실제 battle route는 runtime mode에 따라 `judgeCode` 또는 `judgeCodeNative` 를 선택한다: `dailycoding-server/src/routes/battles.js:206`, `dailycoding-server/src/routes/battles.js:224`.
- Judge 페이지의 "예제 실행"은 별도 run endpoint가 아니라 실제 제출 API를 호출한다: `dailycoding/src/pages/JudgePage.jsx:234`, `dailycoding/src/pages/JudgePage.jsx:244`, `dailycoding-server/src/routes/submissions.js:45`, `dailycoding-server/src/routes/submissions.js:106`.
- `customInput` UI는 존재하지만 서버에 전달되지 않는다. `dailycoding/src/pages/JudgePage.jsx:79`, `dailycoding/src/pages/JudgePage.jsx:625`, `dailycoding/src/pages/JudgePage.jsx:627`.
- 프런트는 모든 주요 페이지를 초기 앱 번들에 eager import 한다: `dailycoding/src/App.jsx:5`, `dailycoding/src/App.jsx:14`, `dailycoding/src/App.jsx:23`.
- 내부 이동에도 `window.location.href` 를 사용해 SPA 장점을 버리는 경로가 있다: `dailycoding/src/App.jsx:41`, `dailycoding/src/App.jsx:61`, `dailycoding/src/App.jsx:111`.
- 같은 데이터가 여러 화면에서 중복 호출된다.
  - ranking: `dailycoding/src/pages/Dashboard.jsx:72`, `dailycoding/src/pages/RankingPage.jsx:106`
  - subscription status: `dailycoding/src/components/TopNav.jsx:92`, `dailycoding/src/pages/ProfilePage.jsx:107`, `dailycoding/src/pages/PricingPage.jsx:72`

## Problem Statement
현재 문제는 "기능이 적다"가 아니라 "동작 이름과 실제 행동이 다르고, 일부 핵심 경로는 이미 깨져 있으며, 초기 로딩과 데이터 fetch 구조가 비효율적"이라는 점이다. 특히 judge 관련 경로는 테스트가 막혀 있고, 예제 실행은 제출과 분리되어 있지 않으며, 이전 계획 문서의 전제가 현재 코드와 맞지 않는다.

## Goals
1. judge 경로를 다시 실행 가능한 상태로 복구한다.
2. 예제 실행과 실제 제출을 분리해 사용자 행동과 서버 부작용 계약을 맞춘다.
3. judge runtime 정책을 현재 구현 기준으로 문서/테스트/UI에 정렬한다.
4. 초기 번들과 중복 API 호출을 줄여 체감 성능과 유지보수성을 개선한다.

## Acceptance Criteria
- `dailycoding-server/src/services/judge.js` 가 파싱 가능하고 `node --test src/services/judge.test.js` 가 실행된다.
- Judge 페이지의 예제 실행/커스텀 실행은 DB 제출, solved 처리, 알림 생성 없이 결과만 반환한다.
- Judge 페이지 제출은 여전히 실제 제출로 저장되며, run 과 submit 경로가 명확히 분리된다.
- battle/submission/JudgePage/docs/test 가 동일한 judge 지원 정책을 따른다.
- 앱 엔트리에서 주요 라우트가 lazy load 되고, 빌드 산출물에서 heavy route chunk 분리가 확인된다.
- ranking/subscription 상태는 공유 fetch 또는 캐시된 상태를 사용해 같은 세션에서 중복 호출이 줄어든다.
- 내부 라우팅은 가능한 한 React Router navigation 으로 처리되고, 불필요한 full reload 가 제거된다.

## Implementation Steps

### Step 1. Baseline 복구와 stale 가정 정리
**Targets**
- `dailycoding-server/src/services/judge.js:106`
- `dailycoding-server/src/services/judge.js:336`
- `dailycoding-server/src/services/judge.test.js:17`
- `.omx/plans/prd-post-change-roadmap-2026-04.md:9`

**Work**
- `judge.js` 의 중복 상수/부분 병합 흔적을 정리해 서버 파싱을 복구한다.
- 현재 judge 테스트가 무엇을 실제로 기대하는지 확인하고, 실패 원인을 "정책 불일치"가 아니라 "소스 파싱 실패" 기준으로 재정리한다.
- 기존 `.omx` 로드맵에서 stale 전제를 inventory 로 남기고, 이후 실행은 본 PRD를 기준으로 진행한다.

**Done when**
- backend test runner 가 syntax error 없이 시작된다.
- stale assumption inventory 가 남아 후속 작업자가 오래된 계획을 기준으로 구현하지 않는다.

### Step 2. 예제 실행과 제출 흐름 분리
**Targets**
- `dailycoding/src/pages/JudgePage.jsx:234`
- `dailycoding/src/pages/JudgePage.jsx:244`
- `dailycoding/src/pages/JudgePage.jsx:625`
- `dailycoding-server/src/routes/submissions.js:45`
- `dailycoding-server/src/services/judge.js:231`
- `dailycoding-server/src/services/judge.js:383`

**Work**
- `POST /api/submissions` 는 "저장되는 제출" 전용으로 유지한다.
- 별도 run endpoint 또는 명시적인 sample-run route 를 추가해 examples/custom input 을 저장 없이 실행한다.
- JudgePage 의 `runExamples` 와 custom input 실행 버튼을 새 run endpoint 로 연결한다.
- sample run 은 `examples` 또는 `customInput` 을 명확히 구분해 결과를 반환하고, DB/알림/풀이 처리 부작용을 만들지 않게 한다.

**Done when**
- "예제 실행" 이 제출 내역을 만들지 않는다.
- custom input 이 실제 실행 입력으로 전달된다.
- 제출은 기존처럼 저장/채점/정답 처리 흐름을 유지한다.

### Step 3. Judge 지원 정책과 UI 계약 정렬
**Targets**
- `dailycoding-server/src/routes/submissions.js:69`
- `dailycoding-server/src/routes/battles.js:206`
- `dailycoding/src/pages/JudgePage.jsx:102`
- `dailycoding-server/src/services/judge.test.js:17`
- `CLAUDE.md`

**Work**
- submissions 와 battles 가 공유하는 judge 지원 정책을 하나로 문서화한다.
- `judge-status` 응답, battle code judge, JudgePage 언어 선택지, test expectations, docs 설명을 같은 기준으로 맞춘다.
- battle native 지원을 유지할지 제한할지 결정하되, 실제 코드와 문서를 불일치 상태로 두지 않는다.

**Done when**
- 한 경로에서 허용되는 언어가 다른 경로에서 이유 없이 거부되지 않는다.
- battle/native 관련 문서와 실제 응답이 일치한다.

### Step 4. 초기 로딩 최적화와 SPA 복구
**Targets**
- `dailycoding/src/App.jsx:5`
- `dailycoding/src/App.jsx:35`
- `dailycoding/src/App.jsx:61`
- `dailycoding/src/App.jsx:111`

**Work**
- heavy page route 를 `React.lazy`/`Suspense` 기반으로 분리해 엔트리 번들을 줄인다.
- post-login redirect, landing CTA, footer link 등 내부 이동을 `navigate` 또는 `Link` 기반으로 바꿔 full reload 를 줄인다.
- lazy loading 후에도 auth gate 와 기존 skeleton 동작이 깨지지 않게 조정한다.

**Done when**
- 빌드 결과에서 route chunk 분리가 보인다.
- 내부 페이지 이동이 전체 새로고침 없이 동작한다.

### Step 5. 중복 fetch 제거와 공유 상태 정리
**Targets**
- `dailycoding/src/context/AppContext.jsx:19`
- `dailycoding/src/pages/Dashboard.jsx:72`
- `dailycoding/src/pages/RankingPage.jsx:106`
- `dailycoding/src/components/TopNav.jsx:92`
- `dailycoding/src/pages/ProfilePage.jsx:107`
- `dailycoding/src/pages/PricingPage.jsx:72`

**Work**
- ranking, subscription status 같이 여러 화면이 반복 조회하는 데이터를 shared context 또는 session-level cache 로 올린다.
- TopNav/Profile/Pricing 에 흩어진 subscription fetch 를 단일 source of truth 로 합친다.
- Dashboard/Ranking 의 ranking fetch 중복을 줄이고, 필요한 slice 만 소비하도록 정리한다.

**Done when**
- 로그인 후 같은 세션에서 동일 데이터 요청이 불필요하게 중복되지 않는다.
- 각 화면이 개별 API 호출 타이밍에 덜 의존한다.

### Step 6. 고복잡도 화면 정리와 회귀 방지
**Targets**
- `dailycoding/src/pages/JudgePage.jsx:1`
- `dailycoding/src/pages/BattlePage.jsx:1`
- `dailycoding/src/pages/ProfilePage.jsx:1`
- `dailycoding/src/App.jsx:30`

**Work**
- 우선순위가 높은 큰 화면부터 presentation, network, derived-state 책임을 분리한다.
- 최소 1개 화면은 추출 가능한 subcomponent/hooks 로 쪼개서 이후 수정 비용을 낮춘다.
- judge run/submit 분리, route lazy loading, shared fetch 변경에 대한 회귀 체크리스트를 붙인다.

**Done when**
- 수정한 핵심 화면의 책임 경계가 이전보다 명확하다.
- 후속 최적화가 한 파일에 다시 누적되지 않는다.

## Risks and Mitigations
- **Risk:** judge run/submit 분리 중 기존 제출 흐름이 깨질 수 있다.
  - **Mitigation:** run endpoint 는 새 route 로 추가하고 submit endpoint 의미는 유지한다.
- **Risk:** lazy loading 후 auth/skeleton 타이밍 회귀가 생길 수 있다.
  - **Mitigation:** `App.jsx` 에서 기존 loading gate 를 유지한 채 route-level fallback 을 추가한다.
- **Risk:** shared cache 도입 후 stale data 가 남을 수 있다.
  - **Mitigation:** mutation 이후 invalidate 지점을 명시하고, polling/refresh entry 를 남긴다.
- **Risk:** judge 정책 변경을 문서만 바꾸고 battle/submission 중 하나를 놓칠 수 있다.
  - **Mitigation:** Step 3 완료 조건에 submissions/battles/JudgePage/test/docs 동시 정렬을 묶는다.

## Verification Steps
1. `cd dailycoding-server && node --test src/services/judge.test.js`
2. `cd dailycoding-server && node --check src/routes/submissions.js`
3. `cd dailycoding-server && node --check src/routes/battles.js`
4. `cd dailycoding && npm run build`
5. JudgePage 수동 QA
   - 예제 실행은 제출 목록 증가 없음
   - custom input 실행 결과 반영
   - 실제 제출은 제출 목록/정답 처리 유지
6. Network QA
   - Dashboard 방문 후 Ranking 방문 시 ranking 재호출 감소 여부 확인
   - TopNav/Profile/Pricing 이동 시 subscription status 중복 호출 감소 여부 확인
7. Navigation QA
   - 로그인 후 redirect, landing CTA, footer 링크가 full reload 없이 동작하는지 확인

## Change Boundaries
- No new dependencies.
- 정책 결정이 필요하더라도 먼저 deterministic bug 와 잘못된 run contract 를 복구한다.
- judge 정책 축소/확장은 Step 3 에서 결정하되, Step 1~2 는 어느 정책에서도 필요한 공통 정리 작업이다.

## Recommended Execution Order
1. Step 1
2. Step 2
3. Step 3
4. Step 4
5. Step 5
6. Step 6
