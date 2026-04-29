# Test Spec: DailyCoding 미완성 정리 및 최적화 합의안

## Purpose
- 합의안이 실제 저장소 상태에 근거하고, 각 단계가 자동/수동 검증으로 닫히는지 확인한다.

## Test Areas

### 1. Baseline Recovery
- `dailycoding-server/src/services/judge.js` 가 syntax error 없이 import 가능해야 한다.
- `node --test src/services/judge.test.js` 가 import failure 가 아니라 test assertion 실행 단계에 들어가야 한다.

### 2. Shared Execution Core and Run/Submit Split
- persisted submit 와 non-persist run 이 같은 execution core 를 공유해야 한다.
- submit route 는 persistence/solve/notification/ranking invalidation 을 유지해야 한다.
- run route 는 그 side effect 를 일으키지 않아야 한다.

### 3. Judge Policy Ownership
- `dailycoding-server/src/services/judge.js` 가 runtime capability, language normalization, public allowlisting 의 owner 여야 한다.
- `submissions`, `battles`, `judge-status`, JudgePage, judge tests 가 같은 owner 를 소비해야 한다.

### 4. Frontend Load and Navigation
- `App.jsx` heavy routes 가 lazy load 되어야 한다.
- internal in-app links/redirect 는 full reload 없이 동작해야 한다.

### 5. Narrow Session Loader Behavior
- 같은 로그인 세션에서 invalidation 전까지:
  - `Dashboard -> Ranking` 이동 시 `/ranking` 요청 수는 1회를 넘지 않아야 한다.
  - `TopNav -> Profile -> Pricing` 이동 시 `/subscription/status` 요청 수는 1회를 넘지 않아야 한다.

### 6. Scope Discipline
- JudgePage 수정은 execution/result slice 에 한정되어야 한다.
- broad page rewrite 가 계획 없이 끼어들면 실패다.

## Verification Method
1. Backend commands
   - `cd dailycoding-server && node --test src/services/judge.test.js`
   - `cd dailycoding-server && node --check src/routes/submissions.js`
   - `cd dailycoding-server && node --check src/routes/battles.js`
2. Frontend command
   - `cd dailycoding && npm run build`
3. Automated backend proof
   - non-persist run path 테스트에서 `Submission.create`, `Problem.incrementSubmit`, `Problem.incrementSolved`, `Notification.create`, `redis.del('ranking:global')` 가 호출되지 않음을 spy/stub 로 확인
4. Manual QA
   - example run
   - custom input run
   - real submit
   - JudgePage language selector
   - battle code judge language behavior
   - post-login redirect
   - landing/footer in-app links
5. Network inspection
   - session-level `/ranking` ceiling 확인
   - session-level `/subscription/status` ceiling 확인

## Exit Criteria
- baseline recovery, shared execution core split, judge policy ownership, frontend load/navigation, narrow session loader behavior, scope discipline 6개 영역이 모두 충족된다.
- 실행자는 별도 해석 없이 어떤 자동 검증과 어떤 수동 검증이 필요한지 바로 알 수 있다.
