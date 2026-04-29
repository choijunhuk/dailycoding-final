# Test Spec: 최근 코드 변경 이후 우선순위 로드맵

## 목적
로드맵이 실제 저장소 상태와 최근 검증 결과를 기반으로 우선순위를 정했고, 특히 **native 정책 결정과 최소 안전 승인 게이트가 후속 phase보다 앞선다**는 점이 명확히 반영되었는지 확인한다.

## 테스트 영역

### 1. 근거 정합성
- `judge.js`가 native mode에서 5개 언어를 노출한다는 점이 반영되어야 한다.
- `judge.test.js`가 Python-only 기대치 때문에 실패 중이라는 점이 반영되어야 한다.
- `submissions.js`, `battles.js`, `JudgePage.jsx`의 역할 차이가 반영되어야 한다.
- 기대 결과: 로드맵이 실제 코드베이스 증거 위에 세워져 있다.

### 2. 게이트 순서 검증
- Phase 1A가 native 정책 결정 + 최소 안전 승인 게이트로 분리되어 있어야 한다.
- Phase 1B가 계약 정렬 단계로 분리되어 있어야 한다.
- Phase 2 이후 단계에 **Phase 1A/1B 완료 전 착수 금지**가 반영되어야 한다.
- 기대 결과: 정책 미확정 상태에서 downstream work가 시작되지 않는다.

### 3. 우선순위 적절성
- 1순위가 judge 안정화/안전 경계 정리인지 확인한다.
- 성능, 기존 기능, 보안 하드닝, 디자인, 신규 기능이 그 이후로 배치되는지 확인한다.
- 기대 결과: 현재 리스크와 사용자 요구가 균형 있게 반영된다.

### 4. 수용 기준의 테스트 가능성
- Phase 1A에서 정책 승인 결과가 `승인/조건부 승인/불승인` 형태로 기록되도록 되어 있어야 한다.
- Phase 1B에서 tests/API/UI/docs 정렬이 검증과 연결되어야 한다.
- 각 후속 phase마다 acceptance criteria와 verification이 연결되어야 한다.
- 기대 결과: 완료 여부를 주관적으로 판단하지 않는다.

### 4A. Gate 1/2 결정 매트릭스 검증
- 언제 Python-only로 강제되는지 문서상 조건이 있어야 한다.
- 언제 5개 언어 유지가 허용되는지 문서상 조건이 있어야 한다.
- 불승인 시 어떤 범위만 허용되는지 문서상 분기가 있어야 한다.
- 기대 결과: Phase 1A가 단순 논의가 아니라 실제 의사결정 규칙으로 작동한다.

### 5. Railway 적합성
- 로드맵이 Railway 운영 가능성을 중심 제약으로 다룬다.
- native judge 보안/격리 한계가 리스크가 아니라 **실제 게이트**로 표현된다.
- 기대 결과: 플랫폼 현실과 동떨어진 계획이 아니다.

### 6. 실행 핸드오프 가능성
- ADR, agent roster, Ralph/Team follow-up guidance가 존재한다.
- Phase 1A와 1B를 분리 실행할 수 있는 staffing guidance가 있어야 한다.
- 기대 결과: 계획 승인 후 바로 실행 모드로 넘길 수 있다.

## 검증 방법
- PRD를 읽고 Phase 1A/1B 분리 여부를 확인한다.
- open questions 1~3이 backlog가 아니라 게이트로 승격되었는지 확인한다.
- Phase 1A 산출물(ADR/checklist/inventory/approval record)과 승인 주체가 명시되었는지 확인한다.
- battle 비지원 유지 시 503 응답/메시지/UI·문서 검증이 포함되었는지 확인한다.
- 최근 검증 결과(frontend build pass / backend judge test fail)가 PRD에 반영되었는지 확인한다.
- 각 phase의 acceptance criteria와 verification 섹션을 매칭한다.

## 완료 조건
- 위 6개 테스트 영역이 모두 충족된다.
- 현재 judge 계약 불일치, 보안 리스크, Railway 제약이 로드맵 우선순위와 순서 제약에 반영되어 있다.
- 실행자가 별도 해석 없이 **Phase 1A부터** 시작할 수 있다.
