# Test Spec: 미완성 영역 정리 및 최적화 실행 계획

## Purpose
실행 계획이 "실제 저장소 기준 문제 복구"에 맞춰졌는지, 그리고 각 단계가 코드/빌드/수동 검증으로 닫히는지 확인한다.

## Test Areas

### 1. Baseline Recovery
- `dailycoding-server/src/services/judge.js` 가 syntax error 없이 import 가능해야 한다.
- `node --test src/services/judge.test.js` 가 테스트 실행 단계까지 진입해야 한다.
- 기대 결과: Step 1 이 정책 논쟁 전에 deterministic breakage 를 제거한다.

### 2. Sample Run Contract
- JudgePage 의 "예제 실행" 이 `POST /api/submissions` 저장 흐름을 타지 않아야 한다.
- custom input 이 실제 실행 payload 에 포함되어야 한다.
- 예제 실행 후 제출 목록 증가, 정답 처리, 알림 생성이 없어야 한다.
- 기대 결과: run 과 submit 의 의미가 분리된다.

### 3. Judge Policy Alignment
- `submissions`, `battles`, `JudgePage`, `judge.test.js`, docs 가 동일한 지원 언어 정책을 사용해야 한다.
- battle native 지원 여부는 코드와 문서가 동일하게 설명해야 한다.
- 기대 결과: 어느 한 경로만 다른 정책을 말하지 않는다.

### 4. Frontend Load Optimization
- `App.jsx` 에서 heavy routes 가 eager import 되지 않아야 한다.
- 빌드 후 엔트리 번들이 route chunk 로 분리되어야 한다.
- 내부 링크/redirect 는 불필요한 full reload 없이 동작해야 한다.
- 기대 결과: 초기 다운로드와 라우팅 체감이 개선된다.

### 5. Shared Fetch Optimization
- ranking 과 subscription status 는 같은 세션에서 공유 state/cache 로 재사용되어야 한다.
- Dashboard -> Ranking, TopNav -> Profile -> Pricing 이동 시 중복 호출이 줄어야 한다.
- 기대 결과: 동일 데이터에 대한 불필요한 API 호출이 감소한다.

### 6. Regression Safety
- judge run/submit 분리 후 실제 제출 저장/정답 처리 흐름이 유지되어야 한다.
- lazy loading 이후 auth gate, skeleton, page transition 이 깨지지 않아야 한다.
- 기대 결과: 최적화가 기능 회귀를 만들지 않는다.

## Verification Method
1. Backend
   - `cd dailycoding-server && node --test src/services/judge.test.js`
   - `cd dailycoding-server && node --check src/routes/submissions.js`
   - `cd dailycoding-server && node --check src/routes/battles.js`
2. Frontend
   - `cd dailycoding && npm run build`
   - build output 에서 route chunk 분리 확인
3. Manual QA
   - JudgePage 예제 실행
   - JudgePage custom input 실행
   - JudgePage 실제 제출
   - Dashboard -> Ranking 이동
   - TopNav -> Profile -> Pricing 이동
   - 로그인 후 redirect / footer 링크 이동

## Exit Criteria
- Baseline recovery, sample run contract, judge policy alignment, frontend load optimization, shared fetch optimization, regression safety 6개 영역이 모두 검증된다.
- 계획만 읽어도 실행자가 어떤 변경을 어떤 순서로 검증해야 하는지 추가 해석 없이 바로 시작할 수 있다.
