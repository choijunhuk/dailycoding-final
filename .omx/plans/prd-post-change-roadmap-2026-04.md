# PRD: 최근 코드 변경 이후 우선순위 로드맵

## 요구 요약
최근 채점기 변경 이후 DailyCoding의 다음 투자 우선순위를 합의 가능한 실행 로드맵으로 재정렬한다. 대상 범주는 다음 6개다: (1) 채점 완성 및 최적화, (2) 성능/최적화, (3) 기존 기능 개선, (4) 보안/안전성, (5) 디자인 개선, (6) 신규 기능. 로드맵은 Railway 운영 가능성을 유지해야 하며, 작은 검증 단위로 나뉘고, **native judge 운영 정책과 최소 안전 승인 없이는 후속 phase로 넘어가지 않는다.**

## 근거 컨텍스트 / 파일 기준
- `CLAUDE.md`는 현재 native judge가 `python`, `javascript`, `cpp`, `c`, `java` 5개 언어를 모두 지원한다고 명시한다.
- 실제 구현도 native mode에서 전체 언어를 노출한다: `dailycoding-server/src/services/judge.js` (`ALL_LANGS`, `NATIVE_RAILWAY_MVP_LANGS`, `buildJudgeRuntime`).
- 현재 백엔드 테스트는 여전히 Python-only phase-1 가정을 검사하고 있어 실패한다: `dailycoding-server/src/services/judge.test.js`.
- native judge는 `child_process.spawn('sh', ['-c', ...])` 기반이며 Docker 수준 격리가 없다: `dailycoding-server/src/services/judge.js`.
- 제출 라우트는 native mode를 실제로 사용하며 judge status에 지원 언어 목록을 전달한다: `dailycoding-server/src/routes/submissions.js`.
- 배틀 코딩 채점은 여전히 docker-sandbox 전용이며 native mode에서는 503으로 막혀 있다: `dailycoding-server/src/routes/battles.js`.
- 프론트 Judge 페이지는 `/submissions/judge-status` 응답으로 언어 선택지를 필터링한다: `dailycoding/src/pages/JudgePage.jsx`.
- 신선한 검증 근거:
  - `cd dailycoding && npm run build` 통과
  - `cd dailycoding-server && node --test src/services/judge.test.js` 실패 (테스트 기대치와 구현 불일치)

## 핵심 문제 정의
지금의 핵심 불일치는 “기능 확장”이 아니라 “운영 가능한 계약 부재”다. 구현은 native judge를 5개 언어까지 확장했지만, 테스트/안전성/배틀 경로/운영 메시지는 그 변화에 맞춰 정렬되지 않았다. 따라서 로드맵의 첫 단계는 신규 기능이 아니라 **judge 정책 결정 + 최소 안전 승인 + 계약 정렬**이어야 한다.

## RALPLAN-DR 요약

### 원칙 (Principles)
1. **운영 가능성 우선**: Railway에서 안전하게 지속 운영할 수 없는 기능 확장은 우선순위를 낮춘다.
2. **계약 정합성 우선**: 구현, 테스트, API 응답, UI 노출 범위가 서로 다르면 먼저 맞춘다.
3. **보안은 게이트**: native safety 승인 전에는 성능/기능/디자인 확장을 시작하지 않는다.
4. **작은 검증 단위로 전진**: 각 단계는 1~2개의 명확한 성공 기준과 재현 가능한 검증 절차를 가져야 한다.
5. **기능보다 경험 완성도**: 신규 기능은 핵심 플로우 안정화 이후에만 투자한다.

### 결정 드라이버 (Top 3)
1. **안전성 리스크**: native judge가 Docker 격리 없이 호스트 파일 접근 위험을 가질 수 있다.
2. **계약 드리프트**: `judge.js` 구현과 `judge.test.js` 기대치가 이미 어긋나 있어 현재 상태를 신뢰하기 어렵다.
3. **Railway 현실성**: 배포 타깃을 유지하려면 작은 범위의 검증 가능한 단계별 강화가 필요하다.

### 실행 가능한 로드맵 구조 옵션
#### 옵션 A — 게이트 기반 안정화 후 확장 (권장)
- 1A에서 native 운영 정책과 최소 안전 승인을 확정하고, 1B에서 테스트/API/UI/docs 계약을 정렬한 뒤에만 후속 phase로 이동한다.
- 장점: 지금 가장 큰 리스크(안전성, 테스트 불일치, 배틀/native 계약 드리프트)를 순서대로 제거한다.
- 단점: 체감 개선은 늦게 보일 수 있다.

#### 옵션 B — 병렬 균형형 로드맵
- judge 안정화와 동시에 디자인/기능 개선을 병렬 추진한다.
- 장점: 체감 개선이 빨리 나온다.
- 단점: native 정책이 확정되지 않은 상태에서 병렬 작업이 늘어나면 회귀와 충돌이 커진다.

#### 옵션 C — 성장/신규 기능 선행형
- 신규 기능과 UX 개선을 먼저 밀고, judge와 보안은 추후 보완한다.
- 장점: 외형상 빠른 진척을 보여줄 수 있다.
- 단점: 현재 저장·채점·배틀·언어 노출 계약의 불안정성을 방치한다.

**권장안:** 옵션 A.

## 권장안 선택 이유
- 지금 부족한 것은 속도가 아니라 **정책과 계약의 일관성**이다.
- `JudgePage.jsx`는 서버의 `supportedLanguages`를 그대로 신뢰하므로, native 정책이 곧 사용자 노출 정책이다.
- `battles.js`가 여전히 docker-sandbox 전용인 점을 보면, 다중 언어 native 확대는 플랫폼 전반의 완료 상태가 아니다.

## 단계별 로드맵

### Phase 1A. Native 운영 정책 결정 + 최소 안전 승인 게이트
**범주 연결:** (1) 채점 완성 및 최적화, (4) 보안/안전성

**결정해야 할 것**
- native 운영 정책을 하나로 고정한다.
  - A안: Railway/native는 Python-only로 축소
  - B안: Railway/native는 5개 언어 유지 + 최소 안전 제한/운영 조건 승인
- 배틀 code judge는 phase 1 범위에서 native 지원 대상인지, 아니면 명시적 비지원 UX로 둘지 결정한다.
- native judge를 API 프로세스와 함께 유지 가능한지, 아니면 분리 worker/service가 필요한지 1차 판단한다.

**주요 작업**
- `judge.js`, `submissions.js`, `battles.js`, `JudgePage.jsx`, `judge.test.js`, `CLAUDE.md` 기준으로 현재 정책/리스크/불일치 지점을 정리한다.
- 최소 안전 승인 체크리스트를 만든다: 파일 접근, 네트워크 접근, 프로세스 수, timeout semantics, output cap, temp cleanup, env 최소화.
- open question 1~3을 backlog가 아니라 **승인 게이트**로 승격한다.

**수용 기준**
- native 운영 정책이 A/B 중 하나로 문서상 확정된다.
- 배틀 native 전략이 “지원” 또는 “명시적 비지원” 중 하나로 확정된다.
- 최소 안전 승인 결과가 `승인 / 조건부 승인 / 불승인`으로 기록된다.
- **이 게이트 승인 전에는 Phase 2 이후 착수 금지**가 문서에 반영된다.

**검증**
- 정책 결정 기록 작성
- 위험 체크리스트 검토
- 현재 구현/테스트/문서 불일치 목록 작성

**결정 매트릭스**
| 조건 | 판정 | 후속 분기 |
|---|---|---|
| 다중 언어(native 5개)에서 파일 접근/격리/timeout semantics 위험을 현재 앱 프로세스 수준에서 수용 불가 | **Python-only 강제** | Phase 1B에서 native `supportedLanguages=['python']`, UI Python-only, 나머지 언어는 Docker 전용 또는 비지원으로 정렬 |
| 다중 언어(native 5개)에 대해 최소 안전 승인과 운영 조건(문서화된 제한, 테스트, 배틀 비지원 또는 별도 분리)이 충족 | **5개 언어 조건부 유지** | Phase 1B에서 tests/API/UI/docs를 5개 언어 기준으로 정렬하되, battle은 별도 gate 없이는 계속 비지원 |
| 파일 접근/격리/timeout semantics 검증이 불충분하거나 상충 | **불승인** | Phase 1B는 정책 고정 최소치(Python-only 또는 native 비활성)만 허용, Phase 2~6 중단 |

**승인 판정별 후속 규칙**
- **승인:** 확정된 정책 범위까지만 `judge.js`, `submissions.js`, `JudgePage.jsx`, `judge.test.js`, `CLAUDE.md`를 정렬한다.
- **조건부 승인:** 다중 언어 유지가 가능하더라도 UI 노출/문서/운영 조건을 명시하고, battle code judge는 별도 승인 없이는 계속 비지원으로 둔다.
- **불승인:** Phase 1B는 축소 정책 반영 또는 native 비활성화 대응만 수행하며, 성능/기능/디자인 phase로 넘어가지 않는다.

**Phase 1A 산출물 / 승인 증거**
- 정책 ADR: `.omx/plans/adr-native-judge-policy.md`
- safety checklist: `.omx/plans/checklist-native-safety.md`
- mismatch inventory: `.omx/plans/inventory-native-contract-drift.md`
- 승인 기록: `.omx/plans/approval-phase-1a.md`
- 승인 주체: `architect` + `security-reviewer` 공동 승인, `test-engineer` 검증 보조

**Battle 전략 검증**
- 비지원 유지 시: `/api/battles/room/:roomId/code-judge`가 native 환경에서 `503`과 명시적 메시지를 반환하는지 확인
- UI/문서가 battle native 비지원 상태를 사용자에게 일관되게 알리는지 확인
- 지원 검토가 필요하면 별도 Gate 3 승인 후 후속 PRD로 분리

---

### Phase 1B. Judge 계약 정렬
**선행 조건:** Phase 1A 승인
**범주 연결:** (1) 채점 완성 및 최적화

**목표**
- 승인된 native 정책에 맞춰 테스트/API/UI/docs/runtime 계약을 정렬한다.

**주요 작업**
- `judge.js` / `judge.test.js` / `submissions.js` / `JudgePage.jsx` / `CLAUDE.md`를 동일 정책으로 맞춘다.
- `/api/submissions/judge-status`의 `mode`와 `supportedLanguages`를 정책과 일치시킨다.
- 배틀 code judge는 승인된 전략에 맞게 비지원 메시지 또는 후속 범위로 고정한다.

**수용 기준**
- 테스트 기대치와 실제 native 정책이 일치한다.
- UI 언어 선택 노출이 승인 결과(승인/조건부 승인/불승인)에 따른 허용 범위와 일치한다.
- 운영 문서가 현행 정책과 운영 제한을 설명한다.
- battle 전략은 1A 승인 결과와 모순되지 않는다.

**검증**
- `cd dailycoding-server && node --test src/services/judge.test.js`
- `cd dailycoding && npm run build`
- native mode 강제 후 judge-status 응답 확인
- 정답/오답/런타임에러/타임아웃/출력 초과 시나리오 확인

---

### Phase 2. 성능/운영 최적화 베이스라인 구축
**선행 조건:** Phase 1A, 1B 완료
**범주 연결:** (2) 성능/최적화

**목표**
- judge와 주요 화면의 병목을 측정 가능한 항목으로 전환한다.

**주요 작업**
- 채점 요청 지연 시간, 실패율, timeout 비율, output limit hit 비율을 최소 로그/메트릭으로 정의한다.
- `submissions`, `ranking`, `problems`, `dashboard` 경로의 캐시/쿼리/중복 호출을 점검한다.
- JudgePage, Dashboard, RankingPage의 초기 로딩/재호출 패턴을 정리한다.

**수용 기준**
- 최소 3개 핵심 경로(채점, 랭킹, 문제 목록)의 기준선이 문서화된다.
- 측정값 기반 최적화 후보가 우선순위화된다.

**검증**
- 주요 API 응답 시간 샘플 수집
- 캐시 hit/miss 또는 재호출 로그 점검
- 변경 전/후 비교표 작성

---

### Phase 3. 기존 기능 품질 개선
**선행 조건:** Phase 1A, 1B 완료
**범주 연결:** (3) 기존 기능 개선

**목표**
- 핵심 사용자 여정(문제 풀이, 제출 확인, 랭킹 확인, 프로필 탐색, 배틀 진입)의 불편과 계약 불일치를 줄인다.

**주요 작업**
- JudgePage의 제출/예제 실행/AI 리뷰/토론/풀이 로딩 흐름을 정리한다.
- 배틀 경로에서 non-docker 환경 메시지와 UX fallback을 개선한다.
- Dashboard / Ranking / Profile / Problems / Auth 표면의 에러/빈 상태/로딩 상태를 정리한다.

**수용 기준**
- 최소 5개 핵심 사용자 불편 항목이 우선순위와 함께 정리된다.
- 실제 버그와 완성도 부족 항목이 분리 관리된다.

**검증**
- 주요 플로우 수동 QA 체크리스트
- 프론트 빌드 재검증
- 관련 백엔드 라우트 smoke 확인

---

### Phase 4. 보안/안전성 하드닝
**선행 조건:** Phase 1A, 1B 완료
**범주 연결:** (4) 보안/안전성

**목표**
- Phase 1A의 최소 승인 이후, 운영상 허용 가능한 수준까지 방어를 강화한다.

**주요 작업**
- native judge를 계속 in-app으로 둘지, 분리 worker/service로 승격할지 결정 문서를 완성한다.
- 제출 빈도/코드 크기/실패 폭주/악성 입력에 대한 보호 장치를 점검한다.
- auth, 공개 프로필, 댓글/좋아요, 배틀 socket 이벤트의 신뢰 경계를 재검토한다.

**수용 기준**
- 위협 모델 초안이 존재한다.
- 고위험 항목이 `즉시 수정 / 운영 제한 / 다음 단계 설계`로 분류된다.

**검증**
- 라우트/미들웨어 점검 체크리스트
- 악성 코드/과대 출력/무한 루프/비정상 입력 시나리오 재현
- 보안 리뷰 결과 문서화

---

### Phase 5. 디자인 개선
**선행 조건:** Phase 1A, 1B 완료
**범주 연결:** (5) 디자인 개선

**목표**
- 학습 흐름과 가독성을 높이는 UI 일관성을 확보한다.

**주요 작업**
- JudgePage, Dashboard, RankingPage, ProfilePage, BattlePage의 시각 계층과 상태 표현을 정리한다.
- 로딩/에러/성공 상태 컴포넌트 패턴을 통일한다.
- 모바일 대응과 긴 콘텐츠 가독성을 개선한다.

**수용 기준**
- 최소 3개 핵심 화면에 대한 공통 UI 패턴 정의가 존재한다.
- 상태 표현(loading/empty/error/success)의 일관성 기준이 정리된다.

**검증**
- `cd dailycoding && npm run build`
- 주요 화면 전/후 스크린샷 비교
- 모바일/데스크톱 수동 체크

---

### Phase 6. 신규 기능 착수
**선행 조건:** Phase 1A, 1B 및 Phase 2~4 핵심 blocker 해소
**범주 연결:** (6) 신규 기능

**목표**
- 안정화가 끝난 뒤에만 신규 기능을 작은 실험 단위로 추가한다.

**후보 방향**
- 배틀 mode 확장 또는 native-compatible 대체 흐름
- 더 정교한 추천/학습 리포트
- 제출 분석/리뷰 고도화
- 문제 탐색/학습 경로 기능

**수용 기준**
- 각 신규 기능이 사용자 가치, 기술 리스크, Railway 적합성, 검증 계획을 가진다.
- 한 번에 1개 기능군만 진행한다.

**검증**
- 기능별 별도 PRD + 테스트 스펙 작성
- 출시 전 회귀 체크리스트 통과

## 추천 실행 순서 요약
1. **Phase 1A** — native 정책 결정 + 최소 안전 승인
2. **Phase 1B** — judge 계약/테스트/UI/docs 정렬
3. **Phase 2** — 성능 기준선 확보
4. **Phase 3** — 기존 기능 품질 개선
5. **Phase 4** — 보안 하드닝
6. **Phase 5** — 디자인 일관성 개선
7. **Phase 6** — 신규 기능 실험

## ADR
- **Decision:** 최근 변경 이후 로드맵은 “native 정책 결정 + 최소 안전 승인 + judge 계약 정렬”을 첫 게이트로 두는 안정화 우선 구조를 채택한다.
- **Drivers:** native judge 보안 리스크, 테스트-구현 불일치, Railway 운영 현실성.
- **Alternatives considered:** 병렬 균형형 로드맵, 성장/신규기능 선행형 로드맵.
- **Why chosen:** 지금 가장 큰 실패 원인은 기능 부족이 아니라 judge 정책과 계약 신뢰 부족이므로, 이를 먼저 고정해야 이후 성능/UX/신규 기능 투자가 유효해진다.
- **Consequences:** 단기적으로 신규 기능 속도는 늦어질 수 있으나, 회귀와 운영 리스크를 낮추고 이후 개선의 품질을 높인다.
- **Follow-ups:** Phase 1A 종료 시점에 native 지원 범위, battle native 전략, judge 분리 필요성을 재평가한다.

## 실행 핸드오프 가이드
### 가용 에이전트 타입
- `executor` — judge 계약 정렬, route/page 구현 변경
- `architect` — native judge 경계, worker 분리 여부 검토
- `test-engineer` — 회귀 테스트/검증 매트릭스 설계
- `verifier` — 단계 완료 증거 수집
- `writer` — 운영 문서/정책 문구 정리
- `security-reviewer` — native judge 및 입력 경계 보안 검토
- `designer` — 핵심 화면 UI 일관성 개선

### Ralph 경로 추천
- 1차: `architect` + `security-reviewer` + `test-engineer`로 Phase 1A 결정 게이트 완료
- 2차: `executor` + `test-engineer`로 Phase 1B 계약 정렬
- 3차: `verifier`로 policy/test/UI/docs 정합성 증명

### Team 경로 추천
- Lane 1: `architect` (high) — native 정책 결정, worker 분리 필요성 판단
- Lane 2: `security-reviewer` (high) — native safety 승인 체크리스트
- Lane 3: `executor` (high) — `judge.js`, `submissions.js`, `battles.js`, `JudgePage.jsx`
- Lane 4: `test-engineer` / `writer` (medium) — 회귀 테스트와 문서 정렬

### 실행 힌트
- Ralph: `$ralph .omx/plans/prd-post-change-roadmap-2026-04.md`
- Team: `omx team 4 ".omx/plans/prd-post-change-roadmap-2026-04.md"`

### 팀 검증 경로
- Step 1: Phase 1A 결정과 안전 승인 결과 확인
- Step 2: Phase 1B에서 judge-status / JudgePage / tests / docs 정합성 확인
- Step 3: Phase 2 이후 확장은 Phase 1A 승인 로그 없이는 시작하지 않음
- Step 4: 신규 기능은 별도 PRD/test spec 없이는 시작하지 않음

## 리스크 및 결정 게이트
1. **Native 정책 게이트:** Python-only 축소 vs 5개 언어 유지+하드닝 중 하나를 먼저 승인해야 한다.
2. **Safety 게이트:** 최소 안전 승인이 나오기 전에는 downstream 개선을 시작하지 않는다.
3. **Battle 게이트:** battle code judge를 native 대응 대상으로 둘지, 명시적 비지원 UX로 둘지 먼저 결정해야 한다.
4. **관측성 부족:** 성능 최적화를 우선순위화할 최소 지표/로그가 부족할 수 있다.
