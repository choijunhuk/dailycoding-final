# Decision Gates

## Gate 1 — Native 운영 정책
- [ ] Railway/native를 **Python-only로 축소**할지, **5개 언어 유지 + 하드닝**으로 갈지 승인한다.
- 결정 기준: Railway 운영성, 안전성, 테스트 정합성, 사용자 노출 일관성.

## Gate 2 — Native 최소 안전 승인
- [ ] 파일 접근, 네트워크, 프로세스 수, timeout semantics, output cap, temp cleanup, env 최소화 기준으로 `승인 / 조건부 승인 / 불승인` 판정을 내린다.
- 결정 기준: native judge를 현재 앱 프로세스와 함께 운영해도 되는 최소 근거가 있는가.

## Gate 3 — Battle 전략
- [ ] battle code judge를 native 대응 대상으로 둘지, 명시적 비지원 UX로 고정할지 승인한다.
- 결정 기준: 현재 `battles.js` 범위, Railway 적합성, 유지보수 비용.

## Backlog Question
- [ ] 성능 최적화 우선순위를 위해 어떤 최소 메트릭/로그를 먼저 남길 것인가?
- [ ] 디자인 개선 범위를 JudgePage 중심으로 제한할지, Dashboard/Profile/Ranking까지 묶을지?
