# PRD: DailyCoding 미완성 정리 및 최적화 합의안

## Requirements Summary
- 현재 저장소 기준으로 실제 미완성 기능, 깨진 계약, 최적화 우선순위를 합의형 계획으로 정리한다.
- 우선순위는 `deterministic breakage 복구 -> run/submit 계약 분리 -> judge 정책 일원화 -> frontend 로딩/중복 요청 최적화 -> touched hotspot 유지보수성 보강` 순서를 따른다.
- 계획은 구현이 아니라 실행 계약이다. 이후 `$ralph` 또는 `$team` 이 바로 집행할 수 있도록 테스트 가능하고 역할 분리가 명확해야 한다.
- No new dependencies.

## Grounded Evidence
- 프런트엔드는 현재 빌드된다: `cd dailycoding && npm run build` 통과. 빌드 산출물에서 메인 JS 청크는 `dist/assets/index-V63XDJmm.js` 484.16 kB.
- 백엔드 judge 테스트는 assertion 이전 파싱에서 막힌다. `dailycoding-server/src/services/judge.js` 에 `OUTPUT_LIMIT` 가 중복 선언되어 `node --test src/services/judge.test.js` 가 실패한다.
- 현재 구현과 테스트는 모두 native 5개 언어 지원을 가정한다. Python-only 는 현재 코드 기준 계약이 아니다.
- 이전 로드맵의 “battle native judge 503” 가정은 stale 이다. 실제 battle route 는 runtime mode 에 따라 `judgeCode` 또는 `judgeCodeNative` 를 선택한다.
- Judge 페이지의 “예제 실행”은 별도 run contract 가 아니라 persisted submit route 를 호출한다. 그래서 sample run 이 submission-side effect 를 만든다.
- `customInput` UI 는 존재하지만 dedicated run flow 로 전달되지 않는다.
- judge capability 관련 진실은 현재 여러 곳에 흩어져 있다.
  - runtime capability: `dailycoding-server/src/services/judge.js`
  - normalization/allowlisting: `dailycoding-server/src/routes/submissions.js`, `dailycoding-server/src/routes/battles.js`
  - UI filtering: `dailycoding/src/pages/JudgePage.jsx`
- 앱은 큰 페이지들을 초기 번들에 eager import 하고, 내부 라우팅에도 `window.location.href` 를 사용한다.
- ranking 과 subscription status fetch 가 여러 화면에서 중복된다.

## RALPLAN-DR Summary

### Principles
1. 결정적 오류 복구가 최적화보다 먼저다.
2. 사용자 계약을 지킨다: `run` 은 `submit` 처럼 행동하면 안 된다.
3. judge capability, normalization, public allowlisting 은 하나의 소유 모듈에서 관리한다.
4. 넓은 재작성보다 좁은 seam 추출과 통합을 우선한다.
5. 각 단계는 독립적으로 검증 가능하고 되돌릴 수 있어야 한다.

### Decision Drivers
1. 백엔드 검증이 parse-time judge failure 로 막혀 있다.
2. 현재 sample run 이 submit side effect 를 일으켜 기능 이름과 행동 계약이 어긋난다.
3. judge 정책이 runtime, route, UI, test 에 분산되어 drift 가능성이 높다.

### Viable Options
#### Option A. Contract-preserving repair, then optimize
- 현재 5개 언어 runtime 계약을 기준선으로 유지하면서 baseline breakage 를 고치고, run/submit 을 shared execution core 위에서 분리한 뒤, policy/UI/test 정렬과 frontend 최적화를 진행한다.
- 장점: 현재 코드/테스트와 가장 잘 맞고, 가장 위험한 계약 위반을 먼저 제거한다.
- 단점: backend/frontend 를 함께 건드려야 하고, 좁은 seam 추출 설계가 필요하다.

#### Option B. Policy reset before repair
- native 정책을 먼저 축소 또는 재정의하고, tests/UI/routes/docs 를 새 정책에 맞춰 다시 정렬한 뒤 최적화를 한다.
- 장점: 장기적으로 더 작은 정책 면적을 선택할 수 있다.
- 단점: 현재 코드/테스트와 즉시 충돌하고, deterministic breakage 복구 전에 불필요한 churn 을 만든다.

### Recommendation
- **Option A** 를 채택한다.
- 단, Architect 리뷰를 반영해 단순 route 추가가 아니라 **service-first** 구조로 집행한다.

### Antithesis
- Option A 는 제품 계약을 보존하는 대신 accidental architecture 도 같이 보존할 위험이 있다. shared execution seam 없이 run route 만 추가하면 duplication 이 늘고 drift 가 더 심해질 수 있다.

### Tradeoff Tensions
- correctness-first repair vs seam-first refactor
- duplicate-fetch reduction vs AppContext 확장 과잉

### Synthesis
- Step 1 로 baseline 을 먼저 살린 뒤, Step 2 에서 shared execution core 를 추출하고 그 위에 submit/run 을 분리한다.
- Step 5 는 broad global context 확장이 아니라 좁은 session cache/loader 로 제한한다.

## Acceptance Criteria
- `dailycoding-server/src/services/judge.js` 가 파싱 가능하고 `OUTPUT_LIMIT` 중복 선언이 제거된다.
- `cd dailycoding-server && node --test src/services/judge.test.js` 가 import failure 가 아니라 실제 assertion 실행 단계까지 진입한다.
- judge execution 은 shared backend core 로 분리되고, persisted submit route 와 non-persist run route 가 그 core 를 각기 다른 side-effect 정책으로 감싼다.
- non-persist run path 는 `Submission.create`, `Problem.incrementSubmit`, `Problem.incrementSolved`, `Notification.create`, `redis.del('ranking:global')` 를 호출하지 않는다.
- `customInput` 은 dedicated run path 로 실제 전달된다.
- judge capability owner 는 `dailycoding-server/src/services/judge.js` 로 일원화되고, runtime capability + language normalization + public allowlisting 이 그 모듈에 포함된다.
- `/api/submissions`, `/api/battles/room/:roomId/code-judge`, `/api/submissions/judge-status`, JudgePage 언어 선택지, judge tests 가 같은 judge policy owner 를 소비한다.
- `dailycoding/src/App.jsx` 는 heavy authenticated routes 를 lazy-load 하고, 인앱 이동에서 불필요한 `window.location.href` full reload 를 제거한다.
- 측정 가능한 fetch 최적화 기준:
  - 같은 로그인 세션에서 invalidation 또는 manual refresh 전까지 `/ranking` 요청은 `Dashboard -> Ranking` 이동 시 최대 1회만 발생한다.
  - 같은 로그인 세션에서 invalidation 또는 payment callback 전까지 `/subscription/status` 요청은 `TopNav -> Profile -> Pricing` 이동 시 최대 1회만 발생한다.
- `cd dailycoding && npm run build` 가 계속 통과한다.

## Implementation Steps

### Step 1. Restore backend judge baseline
**Files**
- `dailycoding-server/src/services/judge.js`
- `dailycoding-server/src/services/judge.test.js`

**Work**
- 중복 `OUTPUT_LIMIT` 선언과 병합 잔여물을 제거한다.
- 현행 runtime contract 를 `buildJudgeRuntime()` 와 judge tests 기준으로 재확인한다.
- 현재 실패 원인을 “정책 불일치”가 아니라 “deterministic source breakage” 로 고정한다.

**Exit**
- judge module import 가능
- judge tests assertion 단계 진입

### Step 2. Extract shared execution core, then split run from submit
**Files**
- `dailycoding-server/src/services/judge.js`
- `dailycoding-server/src/routes/submissions.js`
- `dailycoding/src/pages/JudgePage.jsx`

**Work**
- judge layer 에 normalized language, code, cases, execution mode 를 받아 result 만 돌려주는 shared execution core 를 추출한다.
- `POST /api/submissions` 는 그 core 를 호출한 뒤 persistence, solve progression, notifications, ranking invalidation 을 수행하는 wrapper 로 남긴다.
- 새 non-persist run route 는 같은 core 를 호출하되 side effect 없이 result 만 반환한다.
- JudgePage 의 example/custom execution 은 새 run route 를 사용하게 바꾼다.
- UI state 에서 run result 와 submit result 를 분리한다.

**Exit**
- run 은 side-effect-free
- submit 은 persisted behavior 유지

### Step 3. Centralize judge policy ownership
**Owner module**
- `dailycoding-server/src/services/judge.js`

**Owner responsibilities**
- runtime capability resolution
- language normalization
- public allowlisting / label-to-runtime mapping
- consumer-facing supported language export

**Consumers**
- `/api/submissions`
- `/api/battles/room/:roomId/code-judge`
- `/api/submissions/judge-status`
- `dailycoding/src/pages/JudgePage.jsx`
- `dailycoding-server/src/services/judge.test.js`

**Work**
- `submissions.js` 와 `battles.js` 에 흩어진 `LANG_NORM` / allowlist 를 owner module 로 이동한다.
- battle 은 **같은 capability policy owner** 를 반드시 재사용한다.
- battle 은 shared execution core 도 계약이 맞는 구간에서는 재사용할 수 있지만, room update / scoring / locking 같은 battle-specific logic 는 route/service 바깥 레이어에 남긴다.
- stale roadmap assumption 을 retired 상태로 명시한다.

**Exit**
- route/UI/test 중 어느 곳도 별도 judge language truth 를 갖지 않는다.

### Step 4. Reduce initial load and restore SPA navigation behavior
**Files**
- `dailycoding/src/App.jsx`

**Work**
- heavy authenticated routes 를 `React.lazy` + route-level `Suspense` 로 분리한다.
- 내부 이동에 사용하는 `window.location.href` 를 router navigation 으로 교체한다.
- 현재 auth/loading gate 는 유지한다.

**Exit**
- route chunk 분리 확인
- 인앱 이동 full reload 제거

### Step 5. Consolidate repeated fetches with bounded session loaders
**Files**
- `dailycoding/src/pages/Dashboard.jsx`
- `dailycoding/src/pages/RankingPage.jsx`
- `dailycoding/src/components/TopNav.jsx`
- `dailycoding/src/pages/ProfilePage.jsx`
- `dailycoding/src/pages/PricingPage.jsx`
- `dailycoding/src/context/AppContext.jsx`

**Work**
- broad `AppContext.loadAll()` 확장 대신, ranking summary 와 subscription status 에 한정된 narrow session cache/loader strategy 를 도입한다.
- 구현 형태는 provider slice 또는 small cache hook 중 repo style 에 맞는 쪽으로 제한한다.
- invalidate 조건을 명시한다.
  - ranking: follow mutation, solve/submission side effect, explicit refresh
  - subscription: payment callback, explicit refresh, auth state reset

**Exit**
- fetch ceiling 충족
- unrelated global bootstrap 확장 없음

### Step 6. Harden maintainability around touched hotspots
**Files**
- `dailycoding/src/pages/JudgePage.jsx`
- `dailycoding/src/App.jsx`
- `dailycoding/src/pages/ProfilePage.jsx`
- `dailycoding/src/pages/BattlePage.jsx`

**Work**
- touched execution/result slice 에 한해서만 helper/hook/subcomponent 분리를 허용한다.
- regression check 를 같이 붙인다.

**Non-goal**
- run/custom-input/execution-result slice 를 넘는 광범위한 JudgePage 재작성 금지

## Risks and Mitigations
- **Risk:** run route 추가가 duplication 을 더 만들 수 있다.
  - **Mitigation:** route 추가 전에 shared execution core 를 먼저 추출한다.
- **Risk:** judge policy owner 를 선언만 하고 normalization/allowlist 는 route 에 남겨둘 수 있다.
  - **Mitigation:** Step 3 완료 조건에 normalization + allowlisting 이동을 포함한다.
- **Risk:** session cache 도입이 AppContext 스코프 팽창으로 이어질 수 있다.
  - **Mitigation:** ranking/subscription 두 리소스로 한정하고 `loadAll()` 확대를 non-goal 로 둔다.
- **Risk:** frontend 최적화가 auth/loading 흐름을 깨뜨릴 수 있다.
  - **Mitigation:** 기존 gate 유지, chunk 분리와 navigation 변경만 범위에 둔다.

## Verification Steps
1. `cd dailycoding-server && node --test src/services/judge.test.js`
2. `cd dailycoding-server && node --check src/routes/submissions.js`
3. `cd dailycoding-server && node --check src/routes/battles.js`
4. `cd dailycoding && npm run build`
5. Automated backend verification
   - 새 run path 에 대한 test 를 추가해 `Submission.create`, `Problem.incrementSubmit`, `Problem.incrementSolved`, `Notification.create`, `redis.del('ranking:global')` 가 호출되지 않음을 stub/spy 로 증명한다.
6. Manual Judge QA
   - example run does not create persisted submission
   - custom input execution sends the entered input
   - real submit still persists and updates solve flow
7. Runtime policy QA
   - JudgePage language selector matches `/submissions/judge-status`
   - battle code judge accepts/rejects the same normalized language set that owner module exports
8. Frontend navigation QA
   - post-login redirect is client-side for in-app destinations
   - landing CTA and footer links avoid full reload for in-app pages
9. Measurable network QA
   - one logged-in session, `Dashboard -> Ranking`: `/ranking` request count <= 1 before invalidation/manual refresh
   - one logged-in session, `TopNav -> Profile -> Pricing`: `/subscription/status` request count <= 1 before payment callback/invalidation/manual refresh

## ADR
### Decision
- 현재 5개 언어 runtime 계약을 기준선으로 유지하면서, judge baseline 복구 -> shared execution core 추출 -> run/submit 분리 -> policy ownership 일원화 -> frontend 최적화 순서로 진행한다.

### Drivers
- parse-time backend failure
- sample run contract violation
- distributed judge policy truth

### Alternatives Considered
- native policy 를 먼저 축소하고 전체 surface 를 다시 정렬
- `/submissions` 하나에 flag 로 run/submit 공존
- app-shell 최적화를 judge 계약 정리보다 먼저 수행

### Why Chosen
- 현재 코드/테스트와 가장 잘 맞고, 가장 치명적인 correctness issue 를 가장 작은 정책 churn 으로 제거한다.

### Consequences
- backend 와 frontend judge flow 모두 손댄다.
- 기존 stale roadmap assumption 은 폐기된다.
- 최적화는 correctness 와 policy alignment 이후로 밀린다.

### Follow-ups
- Step 3 이후 judge owner export surface 를 최소화할지 검토
- Step 5 이후 ranking/subscription loader 를 더 일반화할 가치가 있는지 검토
- Step 6 이후 JudgePage execution slice 분리가 충분한지 재평가

## Available-Agent-Types Roster
- `planner`
- `architect`
- `critic`
- `executor`
- `debugger`
- `test-engineer`
- `verifier`
- `code-simplifier`
- `build-fixer`
- `explore`
- `writer`

## Follow-up Staffing Guidance
### Ralph path
- lane 1: `executor` high, backend judge baseline + shared execution core + run/submit split
- lane 2: `executor` high, JudgePage/App/navigation/session-loader changes
- lane 3: `test-engineer` medium, automated backend non-persist proof + regression evidence
- lane 4: `verifier` medium, final acceptance and network/manual QA closure

### Team path
- worker 1: `executor` high, `dailycoding-server/src/services/judge.js`, `submissions.js`, `battles.js`
- worker 2: `executor` high, `dailycoding/src/pages/JudgePage.jsx`, `dailycoding/src/App.jsx`
- worker 3: `executor` or `code-simplifier` medium, ranking/subscription narrow session loaders
- worker 4: `test-engineer` or `verifier` medium, tests/build/network/manual proof

## Launch Hints
### Ralph
```bash
omx ralph "Execute .omx/plans/prd-ralplan-completion-optimization-2026-04-12.md and .omx/plans/test-spec-ralplan-completion-optimization-2026-04-12.md in order: Step 1 -> Step 2 -> Step 3 -> Step 4 -> Step 5 -> Step 6. Preserve the current five-language runtime contract unless changed everywhere together. No new dependencies."
```

### Team
```bash
omx team 4:executor "Execute the approved DailyCoding completion/optimization consensus plan. Worker 1 owns backend judge baseline, shared execution core, and policy centralization. Worker 2 owns JudgePage/App route and navigation changes. Worker 3 owns bounded ranking/subscription session loaders. Worker 4 owns automated and manual verification closure."
```

## Team Verification Path
- prove backend judge file parses and judge tests run
- prove run path is non-persist by automated backend test
- prove submit path still persists
- prove battle/submission/JudgePage/test all consume the same judge policy owner
- prove frontend build still passes and route chunk split exists
- prove `/ranking` and `/subscription/status` meet the stated per-session request ceilings
