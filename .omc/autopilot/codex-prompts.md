# DailyCoding — Codex 실행 프롬프트 모음 (v6, 2026-04-25 2차 업데이트)

> v6 변경 (2026-04-25 07:05 커밋 감사):
> - 수정 확인 파일: redis.js, rateLimit.js, User.js, profile.js + 테스트 4개 신규 추가
> - v5 발견 버그 4개 전부 오늘 07:05에 수정 완료 ✅
> - 테스트 인프라 구축: `npm test` (node:test runner) 정상 작동 확인
> - 신규 발견 이슈: V6-BE-01 (minor, 중복 expire 호출)

---

## ✅ v5 완료 항목 (오늘 07:05 수정 확인됨)

| 프롬프트 | 상태 | 확인 위치 |
|---------|------|----------|
| V5-BE-01 (calcRatingFromTop100 순서 버그) | ✅ 완료 | User.js:232 — `exists` 체크가 `zAdd` 전으로 이동, `getSolvedCodingProblems` 별도 메서드 분리 |
| V5-BE-02 (redis.zAdd TTL 무시) | ✅ 완료 | redis.js:109-111 — `ttlSec > 0` 시 `client.expire()` 호출, `__setRedisClientForTests` 추가 |
| V5-BE-03 (인메모리 Map 무제한) | ✅ 완료 | rateLimit.js:5-31 — `fallbackMaxSize=50000`, `cleanupFallback()`, `setInterval+unref()` |
| V5-BE-04 (아바타 매직 바이트 미검증) | ✅ 완료 | profile.js:47-62 — `validateAvatarUpload()` 내보내기, route에서 사용 |

**신규 테스트 추가됨**:
- `User.test.js` — `calcRatingFromTop100` 호출 순서 검증 (`exists→query→zAddMany→expire→zAdd→expire→zRevRange`)
- `redis.test.js` — `zAdd` TTL 조건부 적용 검증
- `rateLimit.test.js` — rate limit 헤더, fallback Map 크기 제한 검증
- `profile.test.js` — 아바타 매직 바이트 검증 (정상/위조 파일 모두 테스트)
- `package.json` `"test"` 스크립트: `NODE_ENV=test node --test --test-force-exit src/**/*.test.js` ✅

---

## 🔧 GROUP V6-BE — v6 신규 발견 이슈

---

### [V6-BE-01] Minor: calcRatingFromTop100에서 redis.expire 중복 호출

```
프로젝트: DailyCoding (Express.js backend, ES modules)
파일: dailycoding-server/src/models/User.js
위치: calcRatingFromTop100, 라인 ~238-244

[문제]
redis.zAddMany(zsetKey, members, SOLVED_ZSET_TTL_SEC) 내부에서
이미 client.expire(key, ttlSec)를 호출하는데,
바로 다음 라인에서 redis.expire(zsetKey, SOLVED_ZSET_TTL_SEC)를 또 호출합니다.
기능상 문제는 없지만 불필요한 Redis 왕복이 발생합니다.

[현재 코드]
  await redis.zAddMany(zsetKey, members, SOLVED_ZSET_TTL_SEC);  // 내부에서 expire 호출
  await redis.expire(zsetKey, SOLVED_ZSET_TTL_SEC);             // ← 중복

[수정 방법]
두 가지 접근 중 하나 선택:

방법 A (간단): 중복 expire 제거
  await redis.zAddMany(zsetKey, members, SOLVED_ZSET_TTL_SEC);
  // redis.expire 라인 제거

방법 B (일관성): zAddMany에서 TTL 처리하지 않고 호출자에서 관리
  await redis.zAddMany(zsetKey, members);  // ttlSec 인자 제거
  await redis.expire(zsetKey, SOLVED_ZSET_TTL_SEC);  // 명시적 TTL 관리

권장: 방법 A (zAddMany가 TTL을 처리하는 것이 캡슐화에 더 적합)

[영향도]
- Redis 요청 1회 추가 발생 (기능 영향 없음)
- 우선순위: Low — 다른 수정 작업과 함께 처리해도 무방

[검증]
- 수정 전: Redis 로그에서 동일 키에 EXPIRE 2회 연속 호출 확인 가능
- 수정 후: EXPIRE 1회만 호출
```

---

## 📋 현재 상태 요약 (v6 기준)

```
✅ 모든 Critical/High 이슈 해결 완료
✅ 테스트 인프라 구축 완료 (node:test + 4개 테스트 파일)
⚠️ V6-BE-01 (Low): 중복 expire 호출 — 선택적 정리

다음 추천 작업:
1. npm test 실행 → 4개 테스트 모두 통과 확인
2. V6-BE-01 정리 (낮은 우선순위)
3. 나머지 v4 프롬프트 (BE-03~BE-06, FE-01~FE-04) 진행 여부 검토
```

---

# DailyCoding — Codex 실행 프롬프트 모음 (v5, 2026-04-25 업데이트)

> v5 변경 (2026-04-25): 2026-04-24 14:38~14:42 수정된 파일 집중 감사
> - 감사 완료 파일: auth.js, rateLimit.js, helpers.js, local.js, submissions.js,
>   User.js, profile.js, index.js, TopNav.jsx, Dashboard.jsx, BattlePage.jsx, JudgePage.jsx
> - v4 SEC/BE 프롬프트 전부 적용 완료 확인 ✅
> - 신규 Critical 버그 1개, Medium 3개 추가

---

## ✅ v4 완료 항목 (이미 적용됨 — Codex에 중복 지시하지 말 것)

| 프롬프트 | 상태 | 확인 위치 |
|---------|------|----------|
| SEC-01 (프리미엄 체크 누락) | ✅ 완료 | submissions.js:106-109, 243-247 (`/run`도 적용됨) |
| SEC-02 (JWT 7일→15분, PII 제거) | ✅ 완료 | helpers.js: `{ id: user.id }`, `expiresIn: '15m'` |
| SEC-03 (리프레시 토큰 검증 강화) | ✅ 완료 | local.js: `parseRefreshTokenValue()` 헬퍼 완전 구현 |
| SEC-04 (관리자 비밀번호 로깅 제거) | ✅ 완료 | index.js:191 — 실제 비밀번호 로그 제거됨 |
| SEC-05 (인증 라우트 rate limiting) | ✅ 완료 | registry.js:34 `authLimiter`, email.js `forgotPasswordLimiter` |
| SEC-06 (JSON.parse 안전 처리) | ✅ 완료 | User.js: `safeParseJSON()` + safe() 전체 적용, profile.js도 동일 |
| BE-01 (solveTimeSec 서버사이드 검증) | ✅ 완료 | submissions.js:82-86 `normalizeSolveTimeSecInput(5~86400)` |
| BE-02 (이메일 에러 logger 구조화) | ✅ 완료 | local.js:60-63 `logger.error()` 사용 |

**보너스 (요청 외 자발적 개선 — 이미 적용됨)**:
- 리프레시 토큰 → HTTP-only 쿠키 전환 (helpers.js:issueTokens + local.js:/refresh)
- 토큰 로테이션 + 10초 grace period (local.js:111-120)
- 레이팅 계산 Redis Sorted Set 기반 최적화 (User.js:calcRatingFromTop100)
- USER_SELECTABLE_FIELDS 화이트리스트 (User.js:normalizeUserFields)
- Redis 전역 랭킹 Sorted Set (User.js:onSolve → `ranking:global:zset`)

---

## 🚨 GROUP V5-BE — v5 신규 발견 버그 (병렬 실행 가능)

---

### [V5-BE-01] ⚠️ CRITICAL: calcRatingFromTop100 zset 초기화 순서 버그

```
프로젝트: DailyCoding (Express.js backend, ES modules)
파일: dailycoding-server/src/models/User.js
함수: User.calcRatingFromTop100 (약 라인 219~264)

[문제]
zset TTL 만료(7일) 후 첫 번째 풀이 시 레이팅이 대폭 낮아지는 버그.

버그 재현 순서:
1. 사용자가 50개 문제 풀어 레이팅 5000점 달성
2. 7일 이상 풀이 없음 → Redis zset 키 `user:{id}:solved_coding_zset` 만료
3. 51번째 문제 풀이 → calcRatingFromTop100(userId, newProblem) 호출
4. 라인 ~225: redis.zAdd(zsetKey, ..., newProblem.id) → 키가 새로 생성됨
5. 라인 ~229: redis.exists(zsetKey) → true 반환 (방금 생성했으니)
6. 하이드레이션 블록 스킵 → zset에는 새 문제 1개만 존재
7. 결과: 레이팅이 1개 문제 기준으로만 계산됨

[현재 코드 구조 (버그)]
  // ❌ zAdd가 먼저 key를 생성
  if (newProblem && ...) {
    await redis.zAdd(zsetKey, score, newProblem.id, SOLVED_ZSET_TTL_SEC);
  }
  // ❌ key가 이미 존재하므로 exists=true → 하이드레이션 스킵
  const exists = await redis.exists(zsetKey);
  if (!exists) {
    // 이 블록은 실행되지 않음
    const allSolved = await query(...);
    // ...
  }

[수정 방법]
exists 체크를 zAdd 호출 전으로 이동:

  const exists = await redis.exists(zsetKey);

  // Redis에 데이터가 없으면 DB에서 먼저 전체 하이드레이션
  if (!exists) {
    const allSolved = await query(`
      SELECT p.id, p.tier, p.difficulty
      FROM submissions s
      JOIN problems p ON s.problem_id = p.id
      WHERE s.user_id = ? AND s.result = 'correct'
        AND COALESCE(p.problem_type, 'coding') = 'coding'
      GROUP BY p.id, p.tier, p.difficulty
    `, [userId]);

    if (allSolved.length > 0) {
      const members = allSolved.map(p => ({
        score: this.tierScore(p.tier || 'bronze') + (p.difficulty || 0),
        value: String(p.id)
      }));
      await redis.zAddMany(zsetKey, members, SOLVED_ZSET_TTL_SEC);
    } else if (!newProblem) {
      return 0;
    }
    await redis.expire(zsetKey, SOLVED_ZSET_TTL_SEC);
  }

  // 하이드레이션 후 신규 풀이 추가 (없으면 스킵)
  if (newProblem && (newProblem.problemType || newProblem.problem_type || 'coding') === 'coding') {
    const score = this.tierScore(newProblem.tier || 'bronze') + (newProblem.difficulty || 0);
    await redis.zAdd(zsetKey, score, newProblem.id);
    // 하이드레이션 후 add이므로 TTL 갱신
    await redis.expire(zsetKey, SOLVED_ZSET_TTL_SEC);
  }

  // 상위 100개 가져오기
  const top100 = await redis.zRevRangeWithScores(zsetKey, 0, 99);
  // ... 나머지 계산 동일

[검증]
1. 새 계정으로 50문제 풀기
2. Redis에서 `DEL user:{id}:solved_coding_zset` 실행 (TTL 만료 시뮬레이션)
3. 51번째 문제 제출 → `/api/auth/me` 호출 → rating이 51문제 기준으로 계산되는지 확인
4. 이전: rating이 1문제 기준(≈20점)으로 떨어짐
5. 수정 후: rating이 51문제 모두 반영된 값으로 유지
```

---

### [V5-BE-02] redis.zAdd TTL 파라미터 무시 — 메모리 누수

```
프로젝트: DailyCoding (Express.js backend, ES modules)
파일: dailycoding-server/src/config/redis.js

[문제]
redis.zAdd()의 4번째 파라미터 ttlSec이 Redis 연결 상태에서 완전히 무시됩니다.
User.js에서 redis.zAdd(zsetKey, score, newProblem.id, SOLVED_ZSET_TTL_SEC)를 호출해도
TTL이 설정되지 않아 해당 zset 키가 Redis에 영구적으로 남습니다.

[현재 코드]
  async zAdd(key, score, member, ttlSec = RANKING_CACHE_TTL) {
    if (connected) return await client.zAdd(key, [{ score, value: String(member) }]);
    // ← ttlSec가 Redis 연결 시 전혀 사용되지 않음
    ...fallback code uses ttlSec...
  }

[영향]
- 사용자가 문제 풀 때마다 TTL 없는 zset key 생성
- Redis 메모리 계속 증가
- User.js:V5-BE-01 수정 시 함께 해결되어야 함

[수정 방법]
redis.js의 zAdd 메서드에서 TTL 설정 추가:

  async zAdd(key, score, member, ttlSec) {
    if (connected) {
      const result = await client.zAdd(key, [{ score, value: String(member) }]);
      if (ttlSec && ttlSec > 0) {
        await client.expire(key, ttlSec);
      }
      return result;
    }
    // ... fallback 코드 유지
  }

주의: V5-BE-01 수정 시 calcRatingFromTop100에서 이미 redis.expire를 별도 호출하므로
zAdd 내부 TTL 설정과 중복될 수 있음. 일관성을 위해 zAdd에서는 TTL을 설정하지 말고
호출하는 쪽에서 redis.expire()를 명시적으로 호출하는 패턴으로 통일하는 것도 가능.

[검증]
- 문제 제출 후 redis-cli에서 TTL user:{id}:solved_coding_zset 확인
- 수정 전: -1 (TTL 없음 = 영구)
- 수정 후: ~604800 (7일)
```

---

### [V5-BE-03] Rate Limit 인메모리 폴백 Map 무제한 증가

```
프로젝트: DailyCoding (Express.js backend, ES modules)
파일: dailycoding-server/src/middleware/rateLimit.js

[문제]
Redis 장애 시 사용되는 인메모리 폴백 Map이 크기 제한이 없습니다.
Redis 장애가 길어지면 Map에 무제한 엔트리가 쌓여 메모리 고갈 가능.

현재 코드:
  const fallback = new Map();
  function inMemoryCheck(key, max, windowSec) {
    const now = Date.now();
    let entry = fallback.get(key);
    if (!entry || now > entry.expires) {
      entry = { count: 0, expires: now + windowSec * 1000 };
    }
    entry.count++;
    fallback.set(key, entry);  // ← 만료된 엔트리 정리 없음
    ...
  }

[문제 세부]
1. 만료된 엔트리가 Set에 그대로 남음 (다음 요청이 없으면 영구 잔존)
2. 최대 엔트리 수 제한 없음 (1만개, 10만개도 가능)
3. 장시간 Redis 장애 + 대량 요청 시 OOM 위험

[수정 방법]
주기적 정리 + 최대 크기 제한 추가:

  const fallback = new Map();
  const FALLBACK_MAX_SIZE = 50000;

  function cleanupFallback() {
    const now = Date.now();
    for (const [key, entry] of fallback) {
      if (now > entry.expires) fallback.delete(key);
    }
  }

  // 1분마다 만료 엔트리 정리 (서버 시작 시 등록)
  setInterval(cleanupFallback, 60 * 1000);

  function inMemoryCheck(key, max, windowSec) {
    const now = Date.now();
    
    // Map이 너무 커지면 오래된 항목 강제 정리
    if (fallback.size > FALLBACK_MAX_SIZE) {
      cleanupFallback();
      // 그래도 크면 가장 오래된 항목 제거 (FIFO)
      if (fallback.size > FALLBACK_MAX_SIZE) {
        const firstKey = fallback.keys().next().value;
        fallback.delete(firstKey);
      }
    }

    let entry = fallback.get(key);
    if (!entry || now > entry.expires) {
      entry = { count: 0, expires: now + windowSec * 1000 };
    }
    entry.count++;
    fallback.set(key, entry);
    return {
      count: entry.count,
      retryAfter: Math.max(1, Math.ceil((entry.expires - now) / 1000)),
    };
  }

[검증]
- Redis 연결 끊기
- 50001개 서로 다른 IP로 요청 전송
- fallback.size가 50000을 초과하지 않는지 확인
```

---

### [V5-BE-04] 아바타 업로드 파일 타입 우회 취약점

```
프로젝트: DailyCoding (Express.js backend, ES modules)
파일: dailycoding-server/src/routes/auth/profile.js
위치: router.post('/profile/avatar', ...)

[문제]
multer의 fileFilter가 Content-Type 헤더(mimetype)만 검증합니다.
공격자가 JavaScript 파일의 Content-Type을 'image/jpeg'로 설정해 업로드 가능.
업로드된 파일은 /uploads/avatars/ 경로에 .jpg 확장자로 저장되어
직접 실행은 불가능하지만, 경로 탐색 공격이나 향후 기능 추가 시 위험.

[현재 코드]
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('지원하지 않는 이미지 형식입니다.'));
  }

[수정 방법]
파일 매직 바이트(파일 시그니처)로 실제 이미지 여부 검증 추가:

  const IMAGE_MAGIC = {
    jpeg: [0xFF, 0xD8, 0xFF],
    png:  [0x89, 0x50, 0x4E, 0x47],
    webp: [0x52, 0x49, 0x46, 0x46],  // RIFF
  };

  function isValidImageBuffer(buffer, mimetype) {
    if (!buffer || buffer.length < 4) return false;
    if (mimetype === 'image/jpeg') {
      return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    }
    if (mimetype === 'image/png') {
      return buffer[0] === 0x89 && buffer[1] === 0x50 &&
             buffer[2] === 0x4E && buffer[3] === 0x47;
    }
    if (mimetype === 'image/webp') {
      // RIFF....WEBP
      return buffer[0] === 0x52 && buffer[1] === 0x49 &&
             buffer[2] === 0x46 && buffer[3] === 0x46 &&
             buffer.length >= 12 &&
             buffer[8] === 0x57 && buffer[9] === 0x45 &&
             buffer[10] === 0x42 && buffer[11] === 0x50;
    }
    return false;
  }

  // router.post('/profile/avatar', ...) 내부, fs.writeFile 전에:
  if (!isValidImageBuffer(req.file.buffer, req.file.mimetype)) {
    return errorResponse(res, 400, 'VALIDATION_ERROR', '파일 내용이 이미지 형식이 아닙니다.');
  }

[검증]
- Content-Type: image/jpeg인 텍스트 파일 업로드 → 400 반환
- 실제 JPEG 파일 업로드 → 정상 처리
- 실제 PNG 파일 업로드 → 정상 처리
```

---

## 📋 Codex 병렬 실행 배치 (v5)

```
BATCH V5-A (순서 무관, 병렬 실행):
  → V5-BE-01: calcRatingFromTop100 exists/zAdd 순서 수정
  → V5-BE-02: redis.zAdd TTL 처리 (V5-BE-01과 함께 coordinating)
  → V5-BE-03: 인메모리 폴백 Map 크기 제한
  → V5-BE-04: 아바타 업로드 매직 바이트 검증

주의: V5-BE-01과 V5-BE-02는 같은 파일(User.js + redis.js)을 수정하므로
동시 실행 시 충돌 주의. V5-BE-01 먼저, V5-BE-02 나중에 실행 권장.
```

---

# DailyCoding — Codex 실행 프롬프트 모음 (v4, 2026-04-24 업데이트)

> v4 변경 (2026-04-24): 전체 코드베이스 3-에이전트 병렬 감사 후 신규 이슈 추가
> - 보안 감사 에이전트: 18개 취약점 발견 (Critical 3, High 5, Medium 6, Low 4)
> - 백엔드 감사 에이전트: 17개 이슈 발견
> - 프론트엔드 감사 에이전트: 10개 카테고리 이슈 발견
>
> **새로 추가된 프롬프트: SEC-01~SEC-06, BE-01~BE-06, FE-01~FE-04**

---

## 🚨 GROUP SEC — 보안 긴급 수정 (오늘 안에)

---

### [SEC-01] 특수 유형 문제 프리미엄 체크 누락 — 즉시 수익 손실 방지

```
프로젝트: DailyCoding (Express.js backend, ES modules)
파일: dailycoding-server/src/routes/submissions.js

[문제]
라인 105-163: problemType이 'fill-blank' 또는 'bug-fix'인 경우 프리미엄 체크(라인 99-103)를
건너뜁니다. 무료 사용자가 프리미엄 특수 유형 문제를 무료로 제출 가능합니다.

[수정 위치]
라인 106: if (problemType !== 'coding' && problemType !== 'build') {
  바로 다음(try 블록 시작 전)에 삽입:

      if (prob.isPremium && !isAdmin && subTier !== 'pro' && subTier !== 'team') {
        return errorResponse(res, 403, 'FORBIDDEN', '프리미엄 문제에 제출하려면 Pro 이상의 멤버십이 필요합니다.', {
          isPremium: true
        });
      }

[검증]
- isPremium=true인 fill-blank 문제에 무료 사용자 제출 → 403
- Pro 사용자 동일 문제 제출 → 정상 채점
```

---

### [SEC-02] JWT 액세스 토큰 만료 7일 → 15분으로 단축

```
프로젝트: DailyCoding (Express.js backend, ES modules)
파일: dailycoding-server/src/routes/auth/helpers.js

[문제]
JWT 액세스 토큰이 7일 만료로 설정되어 있습니다.
토큰 탈취 시 7일간 무단 접근이 가능합니다.
또한 payload에 email이 포함되어 모든 요청 헤더에 PII가 노출됩니다.

[현재 코드 (대략적 위치)]
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    SECRET,
    { expiresIn: '7d', issuer: 'dailycoding', audience: 'dailycoding-client' }
  );

[수정 방법]
  jwt.sign(
    { id: user.id },  // PII 제거, role은 DB에서 검증하므로 불필요
    SECRET,
    { expiresIn: '15m', issuer: 'dailycoding', audience: 'dailycoding-client' }
  );

주의:
- auth.js의 auth 미들웨어가 decoded.id만 사용하는지 확인 후 적용
- 리프레시 토큰 로직은 변경하지 않음 (별도 파일에 있음)
- 변경 후 프론트엔드에서 15분마다 토큰 갱신이 이루어지는지 확인
  (api.js의 토큰 갱신 인터셉터가 있는지 확인 — 없으면 자동 로그아웃됨)

[검증]
- 로그인 후 토큰 decode → exp가 15분 이내
- 15분 후 API 호출 → 401 → 리프레시 토큰으로 갱신 → 정상 동작
```

---

### [SEC-03] 리프레시 토큰 형식 검증 강화

```
프로젝트: DailyCoding (Express.js backend, ES modules)
파일: dailycoding-server/src/routes/auth/local.js

[문제]
리프레시 토큰 파싱 시 split('.')으로 분리하는데,
여러 개의 점이 있거나 숫자가 아닌 userId가 들어올 경우 잘못 처리됩니다.

[현재 코드 (파일에서 확인)]
  const [userId, token] = refreshToken.split('.');
  if (!userId || !token) return errorResponse(res, 401, ...);

[수정 방법]
  const dotIndex = refreshToken.indexOf('.');
  if (dotIndex === -1) {
    return errorResponse(res, 401, 'INVALID_TOKEN', '유효하지 않은 리프레시 토큰입니다.');
  }
  const userId = refreshToken.slice(0, dotIndex);
  const token = refreshToken.slice(dotIndex + 1);
  const parsedUserId = Number(userId);
  if (!Number.isFinite(parsedUserId) || parsedUserId <= 0) {
    return errorResponse(res, 401, 'INVALID_TOKEN', '유효하지 않은 토큰 형식입니다.');
  }
  if (!token) {
    return errorResponse(res, 401, 'INVALID_TOKEN', '유효하지 않은 리프레시 토큰입니다.');
  }
  const user = await User.findById(parsedUserId);

[검증]
- 'abc.token' 형식 → 401
- '0.token' 형식 → 401
- '.token' 형식 → 401
- '1234.validtoken' → 정상
```

---

### [SEC-04] .env 보안 자격증명 강화 (약한 비밀키 교체)

```
프로젝트: DailyCoding (Express.js backend)
파일: dailycoding-server/.env, dailycoding-server/.gitignore

[문제]
.env 파일에 약한 자격증명이 있습니다:
- JWT_SECRET=local_jwt_secret_for_smoke_test (너무 짧고 예측 가능)
- ADMIN_PASSWORD=admin1234 (매우 취약)

[수정 방법]

1. .gitignore에 .env.bak 추가:
   파일 열어서 마지막에 추가:
   .env.bak
   .env.*.bak

2. .env의 JWT_SECRET을 강력한 랜덤값으로 교체:
   터미널에서 생성: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   생성된 값을 JWT_SECRET에 설정

3. ADMIN_PASSWORD도 강력한 값으로 교체 (16자 이상, 대소문자+숫자+특수문자 혼합)

4. index.js에서 어드민 임시 패스워드 로깅 라인 찾아서 수정:
   현재: logger.warn(`[SETUP] Admin password: ${initPw}`);
   교체: logger.warn(`[SETUP] Admin password auto-generated. Check server startup for hint. Set ADMIN_PASSWORD env var.`);
   // 실제 패스워드를 로그에 남기지 않음

주의: .env 파일을 Git에 커밋하지 않도록 주의. .gitignore에 .env가 이미 포함되어 있는지 확인.
```

---

### [SEC-05] 인증 라우트 Rate Limiting 적용

```
프로젝트: DailyCoding (Express.js backend, ES modules)
파일: dailycoding-server/src/routes/auth/local.js
관련: dailycoding-server/src/middleware/rateLimit.js

[문제]
POST /api/auth/login, POST /api/auth/register에 rate limiting이 없어
브루트포스 공격에 취약합니다.

[수정 방법]
1. rateLimit.js 파일 열어서 authLimiter 존재 여부 확인
   없으면 추가:
   export const authLimiter = rateLimit({
     windowMs: 15 * 60 * 1000,
     max: 10,
     message: { message: '너무 많은 요청입니다. 15분 후 다시 시도해주세요.' },
     standardHeaders: true,
     legacyHeaders: false,
     keyGenerator: (req) => req.ip,
   });

2. local.js 상단에 import 추가:
   import { authLimiter } from '../../middleware/rateLimit.js';

3. 라우트에 적용:
   router.post('/login', authLimiter, async (req, res) => {
   router.post('/register', authLimiter, async (req, res) => {

[검증]
- 동일 IP에서 11번째 로그인 시도 → 429 반환
- 15분 후 → 정상 요청 가능
```

---

### [SEC-06] JSON.parse() 안전 처리 (크래시 방지)

```
프로젝트: DailyCoding (Express.js backend, ES modules)
파일: dailycoding-server/src/models/User.js

[문제]
safe() 메서드 (약 라인 620-623)에서 JSON.parse()가 try-catch 없이 호출됩니다.
DB에 잘못된 JSON이 저장되면 전체 요청이 크래시됩니다.

[수정 방법]
User.js 상단(import 아래)에 헬퍼 함수 추가:

function safeParseJSON(str, fallback) {
  if (typeof str !== 'string') return str ?? fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

safe() 메서드에서 교체 (현재 JSON.parse 직접 호출 부분):
  socialLinks: safeParseJSON(user.social_links, {}),
  techStack:   safeParseJSON(user.tech_stack, []),
  settings:    safeParseJSON(user.settings, {}),

추가로 auth/profile.js에서도 동일 패턴 찾아서 같은 방식으로 수정.
(profile.js에 User.safe를 거치지 않고 직접 JSON.parse하는 곳이 있음)

[검증]
- DB social_links 컬럼에 'invalid{json' 저장 후 /api/auth/me 호출 → {} 반환, 500 에러 없음
```

---

## 🔧 GROUP BE — 백엔드 버그 수정 (이번 주 안에) — 병렬 실행 가능

---

### [BE-01] solve_time_sec 서버사이드 검증

```
프로젝트: DailyCoding (Express.js backend, ES modules)
파일: dailycoding-server/src/routes/submissions.js

[문제]
solveTimeSec: req.body?.solveTimeSec 가 검증 없이 저장됩니다.
사용자가 0이나 999999를 보내도 그대로 저장되어 통계 오염 가능.

[수정 방법]
Submission.create() 호출 전에 (두 곳 — 특수 유형 경로와 일반 코딩 경로):

  const rawSolveTime = req.body?.solveTimeSec;
  const solveTimeSec = (
    typeof rawSolveTime === 'number' &&
    Number.isFinite(rawSolveTime) &&
    rawSolveTime >= 5 &&      // 5초 미만은 비현실적
    rawSolveTime <= 86400     // 24시간 이상은 비현실적
  ) ? Math.round(rawSolveTime) : null;

두 개의 Submission.create 호출 모두에 solveTimeSec: solveTimeSec 적용.

[검증]
- solveTimeSec: -1 → null 저장
- solveTimeSec: 3 → null 저장 (5초 미만)
- solveTimeSec: 120 → 120 저장
- solveTimeSec: 99999 → null 저장 (24시간 초과)
```

---

### [BE-02] 이메일 전송 에러 로깅 개선

```
프로젝트: DailyCoding (Express.js backend, ES modules)
파일: dailycoding-server/src/routes/auth/local.js

[문제]
회원가입 시 이메일 전송 실패를 console.error로 로깅합니다.
구조화된 logger를 사용해야 합니다.

[수정 방법]
파일 상단 import 확인 (logger가 있는지):
  import logger from '../../config/logger.js';
없으면 추가.

이메일 전송 catch 블록에서:
  console.error('[register] email send failed:', emailErr.message)
교체:
  logger.error('[register] email send failed', {
    userId: newUser?.id,
    error: emailErr.message
  });
```

---

### [BE-03] 제출 피드 다른 사용자 비공개 제출 접근 차단

```
프로젝트: DailyCoding (Express.js backend, ES modules)
파일: dailycoding-server/src/routes/submissions.js
라인: GET / 핸들러 (라인 ~281-289)

[문제]
GET /api/submissions?userId=123 으로 submissions_public=false인
다른 사용자의 제출 기록에 접근 가능합니다.

[수정 방법]
const { scope, q, result, lang, limit, userId } = req.query; 아래에 추가:

  let targetUserId = userId ? Number(userId) : null;

  if (targetUserId && targetUserId !== req.user.id) {
    const User = await getUserModel();
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return errorResponse(res, 404, 'NOT_FOUND', '사용자를 찾을 수 없습니다.');
    }
    if (!targetUser.submissions_public) {
      return errorResponse(res, 403, 'FORBIDDEN', '이 사용자의 제출 기록은 비공개입니다.');
    }
  }

그리고 Submission.findFeed 호출 시 userId: targetUserId 전달.

[검증]
- submissions_public=0인 사용자 ID로 GET /submissions?userId=N → 403
- 자기 자신 ID → 정상
- submissions_public=1인 타인 → 정상
```

---

### [BE-04] onSolve Redis 락 키 충돌 방지

```
프로젝트: DailyCoding (Express.js backend, ES modules)
파일: dailycoding-server/src/models/User.js
라인: onSolve 메서드 (약 라인 257)

[문제]
const lockKey = `onsolve:lock:${userId}:${probObj.id || 'unknown'}`;
문제 ID가 없으면 모든 호출이 동일한 락 키('unknown')를 공유합니다.

[수정 방법]
  const problemId = probObj?.id;
  if (!problemId) {
    // 문제 ID 없는 레거시 호출 — 락 없이 진행 (충돌 위험 낮음)
  }
  const lockKey = problemId
    ? `onsolve:lock:${userId}:${problemId}`
    : `onsolve:lock:${userId}:noid:${Date.now()}`;
  const acquired = await redis.setNX(lockKey, '1', 60);
  if (!acquired && problemId) return;  // problemId 있을 때만 중복 방지
```

---

### [BE-05] Submission 통계 쿼리 N+1 제거

```
프로젝트: DailyCoding (Express.js backend, ES modules)
파일: dailycoding-server/src/models/Submission.js

[문제]
getSolveTimeStats (또는 유사 통계 메서드)에서
query('SELECT id, title, tier FROM problems', []) — WHERE 없이 전체 테이블 스캔.

[수정 방법]
해당 쿼리 찾아서:

  // 먼저 풀이한 문제 ID만 수집
  const solvedProblemIds = [...new Set(submissionRows.map(r => r.problem_id))];

  if (solvedProblemIds.length === 0) {
    return { avgSolveTime: null, fastestSolve: null, totalSolveTime: 0, solveTimeByTier: {} };
  }

  // 해당 문제만 조회
  const placeholders = solvedProblemIds.map(() => '?').join(',');
  const problemRows = await query(
    `SELECT id, title, tier FROM problems WHERE id IN (${placeholders})`,
    solvedProblemIds
  );

[검증]
- 10개 문제를 풀었을 때 → WHERE id IN (10개) 쿼리 실행
- 전체 문제 테이블 스캔 없음
```

---

### [BE-06] 핵심 DB 인덱스 추가

```
프로젝트: DailyCoding (Express.js backend, ES modules)
파일: dailycoding-server/init.sql 또는 MySQL 초기화 파일

[문제]
팔로우 피드, 문제 필터링, 북마크 등의 쿼리에 인덱스가 없어
사용자 증가 시 성능 저하 예상.

[수정 방법]
init.sql 적절한 위치에 추가 (CREATE TABLE 이후):

-- 제출 피드 성능 (팔로우 피드 쿼리 핵심)
CREATE INDEX IF NOT EXISTS idx_submissions_user_result_date
  ON submissions(user_id, result, submitted_at DESC);

-- 문제 목록 필터링
CREATE INDEX IF NOT EXISTS idx_problems_tier_type
  ON problems(tier, problem_type);

-- 북마크 조회
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_problem
  ON bookmarks(user_id, problem_id);

-- 알림 읽지않음 조회
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications(user_id, is_read, created_at DESC);

주의: 서버 실행 중 ALTER TABLE로도 적용 가능하지만
      init.sql에 넣으면 IF NOT EXISTS로 안전하게 반복 실행 가능
```

---

## 🎨 GROUP FE — 프론트엔드 UX 개선 (이번 주) — 병렬 실행 가능

---

### [FE-01] 메모리 누수 수정 (BattlePage + JudgePage)

```
프로젝트: DailyCoding (React 18 + Vite, ES modules)
파일:
- dailycoding/src/pages/BattlePage.jsx
- dailycoding/src/pages/JudgePage.jsx

[문제 1] BattlePage: AudioContext가 컴포넌트 언마운트 시 닫히지 않음
[문제 2] JudgePage: Ctrl+Enter 핸들러가 state 변경 시마다 새 listener 추가, 이전 것 제거 안 됨

[수정 BattlePage]
AudioContext를 생성하는 부분(useTypingSound 훅 또는 인라인):
  useEffect(() => {
    return () => {
      if (ctxRef.current && ctxRef.current.state !== 'closed') {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
    };
  }, []);

[수정 JudgePage]
Ctrl+Enter 핸들러 useEffect:
  const handleSubmitRef = useRef(handleSubmit);
  useEffect(() => { handleSubmitRef.current = handleSubmit; }, [handleSubmit]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        handleSubmitRef.current?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);  // cleanup 필수
  }, []);  // 빈 deps — ref로 최신 함수 참조

[검증]
- BattlePage 마운트/언마운트 10회 반복 → AudioContext 개수 1개 유지
- JudgePage에서 코드 입력 후 Ctrl+Enter → 제출 1번만 실행
```

---

### [FE-02] API 에러 처리 일관성 개선

```
프로젝트: DailyCoding (React 18 + Vite, ES modules)
파일:
- dailycoding/src/pages/ProblemsPage.jsx
- dailycoding/src/pages/Dashboard.jsx
- dailycoding/src/pages/ProfilePage.jsx
- dailycoding/src/pages/BattlePage.jsx

[문제]
.catch(() => {}) 패턴으로 API 에러 완전 무시.
사용자는 데이터 로드 실패 시 피드백 없음.

[수정 방법]
각 파일에서 useToast() 가져와서 에러 시 toast 표시:

1. 각 파일 상단에 (없으면):
   import { useToast } from '../context/ToastContext.jsx';
   ...
   const toast = useToast();

2. 중요한 데이터 로드 실패 시:
   .catch(err => {
     if (err.response?.status !== 401) {  // 401은 AuthContext가 처리
       toast.error?.(err.response?.data?.message || '데이터를 불러오지 못했습니다.');
     }
   });

3. 중요하지 않은 선택적 데이터 (AI quota, 추천 문제 등):
   .catch(() => {})  // 유지 — 실패해도 UX에 영향 없음

실제 toast 호출 방식은 ToastContext.jsx 읽어서 확인 후 적용.

[검증]
- 서버 꺼진 상태에서 문제 목록 페이지 → 에러 토스트 메시지 표시
- AI 쿼터 조회 실패 → 조용히 실패 (토스트 없음)
```

---

### [FE-03] 알림 미읽음 뱃지 TopNav 추가

```
프로젝트: DailyCoding (React 18 + Vite, ES modules)
파일: dailycoding/src/components/TopNav.jsx

[문제]
CLAUDE.md에 GET /api/notifications/unread-count 엔드포인트가 있지만
TopNav에서 미사용 → 읽지 않은 알림 수가 뱃지로 표시되지 않음.

[수정 방법]
TopNav 컴포넌트 안에 추가:

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }
    const fetch = () =>
      api.get('/notifications/unread-count')
        .then(r => setUnreadCount(r.data?.count || 0))
        .catch(() => {});
    fetch();
    const id = setInterval(fetch, 60000);
    return () => clearInterval(id);
  }, [user]);

알림 버튼/아이콘 부분에 뱃지 추가:
  <div style={{ position: 'relative', display: 'inline-flex' }}>
    {/* 기존 알림 버튼 */}
    {unreadCount > 0 && (
      <span style={{
        position: 'absolute', top: -4, right: -4,
        background: 'var(--red)', color: '#fff',
        borderRadius: '50%', minWidth: 16, height: 16,
        fontSize: 10, fontWeight: 700, lineHeight: '16px',
        textAlign: 'center', padding: '0 2px',
        pointerEvents: 'none',
      }}>
        {unreadCount > 9 ? '9+' : unreadCount}
      </span>
    )}
  </div>

주의: 알림 기능이 없거나 버튼이 없으면 알림 아이콘 먼저 확인

[검증]
- 읽지 않은 알림 3개 → 빨간 뱃지 "3" 표시
- 모두 읽음 → 뱃지 사라짐
```

---

### [FE-04] 핵심 컴포넌트 접근성 기초 추가 (aria-label + focus 스타일)

```
프로젝트: DailyCoding (React 18 + Vite, ES modules)
파일:
- dailycoding/src/components/TopNav.jsx
- dailycoding/src/index.css

[문제]
아이콘 버튼에 aria-label 없어 스크린리더 사용 불가.
포커스 스타일 없어 키보드 내비게이션 불가.

[수정 index.css]
파일 하단에 추가:

/* 키보드 포커스 가시성 */
:focus-visible {
  outline: 2px solid var(--blue, #79c0ff);
  outline-offset: 2px;
  border-radius: 4px;
}
:focus:not(:focus-visible) {
  outline: none;
}

[수정 TopNav.jsx]
아이콘 버튼들에 aria-label 추가 (실제 버튼 찾아서):

테마 토글 버튼:
  <button aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'} ...>

알림 버튼:
  <button aria-label={`알림${unreadCount > 0 ? ` ${unreadCount}개 읽지 않음` : ''}`} ...>

언어 토글 버튼:
  <button aria-label={`언어: ${lang === 'ko' ? '한국어' : 'English'}`} ...>

주의: 실제 버튼 코드 먼저 읽어서 확인 후 적용

[검증]
- Tab 키로 버튼 포커스 → 파란 테두리 표시
- 스크린리더 VoiceOver/NVDA → 버튼 설명 읽힘
```

---

## 🆕 GROUP D — 새 기능 (다음 스프린트) — 병렬 실행 가능

---

### [D-NEW-01] 제출 취소 타이머 (실수 제출 방지)

```
프로젝트: DailyCoding (React 18 + Vite, ES modules)
파일: dailycoding/src/pages/JudgePage.jsx

[기능]
제출 버튼 클릭 후 3초 카운트다운, 취소 버튼으로 취소 가능.
서버 변경 없음 — 프론트엔드 UX만.

[구현]
상태 추가:
  const [submitPending, setSubmitPending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const cancelRef = useRef(false);

handleSubmit 래퍼:
  const handleSubmitWithDelay = async () => {
    cancelRef.current = false;
    setSubmitPending(true);
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise(r => setTimeout(r, 1000));
      if (cancelRef.current) { setSubmitPending(false); return; }
    }
    setSubmitPending(false);
    await handleSubmit();  // 기존 제출 함수 호출
  };

제출 버튼 교체:
  {submitPending ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span className="mono" style={{ color: 'var(--text2)', fontSize: 13 }}>
        {countdown}초 후 제출
      </span>
      <button className="btn btn-danger" onClick={() => { cancelRef.current = true; }}>
        취소
      </button>
    </div>
  ) : (
    <button className="btn btn-primary" onClick={handleSubmitWithDelay}>
      제출
    </button>
  )}
```

---

### [D-NEW-02] 파일 업로드 실제 콘텐츠 검증 (MIME 우회 방지)

```
프로젝트: DailyCoding (Express.js backend, ES modules)
파일: dailycoding-server/src/routes/auth/profile.js

[문제]
아바타 업로드 시 MIME 타입을 클라이언트 제공값으로만 체크합니다.
실제 파일 내용(magic bytes) 검증이 없어 위장된 파일 업로드 가능.

[수정 방법]
1. 패키지 설치: npm install file-type (package.json 확인 후 없으면)

2. profile.js 상단에 import 추가:
   import { fileTypeFromBuffer } from 'file-type';

3. multer 처리 후 파일 내용 검증 추가:
   const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

   const detected = await fileTypeFromBuffer(req.file.buffer);
   if (!detected || !ALLOWED_IMAGE_TYPES.has(detected.mime)) {
     return res.status(400).json({
       message: '유효하지 않은 이미지 파일입니다. JPEG, PNG, WebP, GIF만 허용됩니다.'
     });
   }

[검증]
- .txt 파일을 image/jpeg로 MIME 위장 업로드 → 400 에러
- 실제 PNG 파일 업로드 → 정상 처리
```

---

## 📊 전체 우선순위 실행 배치

```
배치 1 (오늘, 보안 긴급):
SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06
→ 모두 독립적, 동시 실행 가능

배치 2 (이번 주, 백엔드 버그):
BE-01, BE-02, BE-03, BE-04, BE-05, BE-06
→ 모두 독립적, 동시 실행 가능

배치 3 (이번 주, 프론트엔드):
FE-01, FE-02, FE-03, FE-04
→ 모두 독립적, 동시 실행 가능

배치 4 (다음 스프린트, 기능):
D-NEW-01, D-NEW-02
+ 기존 V3 프롬프트들: PROMPT-V3-01~07
→ 모두 독립적, 동시 실행 가능
```

---

---

# DailyCoding — Codex 실행 프롬프트 모음 (v3, 2026-04-21 업데이트)

> 최초 생성: 2026-04-20 / **v3 업데이트: 2026-04-21**
> v3 변경: 4/21 구현 완료 항목 표시 + 신규 프롬프트 F5~F9 추가

> 생성일: 2026-04-20 (v2 — 소스코드 직접 확인 후 재작성)
> 프로젝트: `/Users/choi/Desktop/dailycoding-final`
>
> ## 이전 분석과의 차이
> 초기 분석에서 지적된 항목 대부분이 **이미 수정 완료**:
> - community.js: transaction, requireVerified, rate limiter, sanitizeTags, INSERT IGNORE — 모두 완료
> - redis.js: RANKING_CACHE_TTL default 파라미터 — 완료  
> - User.js: 상수 import, findAll pagination — 완료
> - auth.js: 에러 핸들링 표준화, User.findAll 페이지네이션 — 완료
> - ProfilePage.jsx: YearHeatmap 컴포넌트 — 이미 구현됨
> - Problem.findAll: search는 캐시 우회로 설계되어 있어 캐시 버그 없음
>
> **아래 프롬프트는 코드를 직접 읽어 확인한 실제 잔존 이슈만 포함합니다.**

---

## 🔴 CRITICAL — 즉시 수정

---

### [PROMPT-01] contests.js N+1 쿼리 — isJoined 루프 제거

```
Context:
- File: dailycoding-server/src/routes/contests.js (GET /, lines 48-58)
- Problem: Contest.findAll()로 N개 대회를 가져온 후, 각 대회마다 Contest.isJoined() 를 호출함.
  Promise.all로 병렬화되어 있어도 DB 쿼리가 N개 발생 → 대회가 20개면 21 queries.
  
Current code (lines 50-55):
  const contests = await Contest.findAll(req.query.status, req.query.q);
  const enriched = await Promise.all(contests.map(async (c) => {
    const participation = await Contest.isJoined(c.id, req.user.id);
    return { ...c, myStatus: participation?.status || null };
  }));

Task:
1. Contest 모델(dailycoding-server/src/models/Contest.js) 에 getMyStatuses(userId, contestIds) 메서드 추가:
   - SELECT contest_id, status FROM contest_participants WHERE user_id = ? AND contest_id IN (...)
   - 반환: Map<contestId, status>
   - contestIds가 빈 배열이면 빈 Map 반환 (IN () 쿼리 에러 방지)

2. contests.js GET / 핸들러 교체:
   const contests = await Contest.findAll(req.query.status, req.query.q);
   const ids = contests.map(c => c.id);
   const statusMap = ids.length > 0 ? await Contest.getMyStatuses(req.user.id, ids) : new Map();
   const enriched = contests.map(c => ({ ...c, myStatus: statusMap.get(c.id) || null }));

3. contest_participants 테이블 컬럼명은 Contest.js 실제 코드 확인 후 맞출 것
   (contest_id, user_id, status 가 일반적인 패턴)

주의: ESM only, query 헬퍼 사용 (raw pool 금지), IN() 에 빈 배열 들어가지 않도록 반드시 검사
```

---

### [PROMPT-02] problems.js — similar 문제 추천 전체 로드 제거

```
Context:
- File: dailycoding-server/src/routes/problems.js (GET /:id/similar, lines ~594-605)
- Problem: 유사 문제 추천 시 Problem.findAll({ userId })로 전체 문제를 메모리에 올린 후 JS로 필터링.
  문제가 1000개 넘으면 매번 1000+개를 로드해서 JS 필터 — 캐시도 안 탐 (userId 있어서 per-user).

Current code:
  const prob = await Problem.findById(Number(req.params.id));
  if (!prob) return res.json([]);
  const all = await Problem.findAll({ userId: req.user.id });
  const similar = all
    .filter(p => p.id !== prob.id && (p.tier === prob.tier || (p.tags||[]).some(t => (prob.tags||[]).includes(t))))
    .sort((a,b) => { ... })
    .slice(0, 8);

Task:
1. Problem 모델에 findSimilar(problemId, userId, { tier, tags, limit=8 }) 메서드 추가:
   - SQL로 직접 유사 문제 조회:
     SELECT p.id, p.title, p.tier, p.difficulty, p.solved_count,
            GROUP_CONCAT(DISTINCT pt.tag) AS tags,
            (SELECT 1 FROM submissions s WHERE s.user_id=? AND s.problem_id=p.id AND s.result='correct' LIMIT 1) AS isSolved
     FROM problems p
     LEFT JOIN problem_tags pt ON p.id = pt.problem_id
     WHERE p.id != ?
       AND COALESCE(p.visibility,'global') = 'global'
       AND (p.tier = ? OR EXISTS(SELECT 1 FROM problem_tags pt2 WHERE pt2.problem_id=p.id AND pt2.tag IN (?...)))
     GROUP BY p.id
     ORDER BY (p.tier = ?) DESC, p.solved_count DESC
     LIMIT 8
   - tags IN (?) 부분: tags 배열이 비면 tier match만으로 조회

2. routes/problems.js GET /:id/similar:
   Problem.findAll() 제거 → Problem.findSimilar(id, req.user.id, { tier: prob.tier, tags: prob.tags }) 호출
   응답 형태는 기존 유지

주의: ESM, tags는 배열 — IN(?...) 바인딩 시 tags.map(()=>'?').join(',') 패턴 사용
```

---

## 🟠 HIGH — 이번 스프린트

---

### [PROMPT-03] contests.js 에러 핸들링 표준화

```
Context:
- File: dailycoding-server/src/routes/contests.js
- Problem: 전체 파일에서 res.status(500).json({ message: '서버 오류' }) 패턴 사용.
  auth.js, submissions.js 등은 errorResponse() / internalError() 헬퍼를 사용하는 구조.
- Helper 위치: dailycoding-server/src/middleware/errorHandler.js

Task:
1. contests.js 상단에 import 추가:
   import { errorResponse, internalError } from '../middleware/errorHandler.js';

2. 파일 전체에서 다음 패턴 교체:
   - res.status(500).json({ message: '...' }) → internalError(res)
   - catch 블록에서 console.error 있으면 그대로 유지, internalError만 교체
   - res.status(400/403/404).json({ message: '...' }) → errorResponse(res, status, 'ERROR_CODE', message)
     단, 이미 명확한 메시지가 있는 경우 errorResponse의 4번째 파라미터에 동일 메시지 사용

3. errorHandler.js 실제 시그니처 먼저 확인 후 적용:
   - errorResponse(res, httpStatus, errorCode, message) 형태인지 확인
   - internalError(res, err?) 형태인지 확인

주의: 이 작업은 순수 리팩터링 — 동작 변화 없이 응답 형식만 통일
```

---

### [PROMPT-04] problems.js — random/daily 문제 선택 SQL화

```
Context:
- File: dailycoding-server/src/routes/problems.js
- Lines:
  - GET /random (~line 257-265): Problem.findAll() 전체 로드 → JS 필터 → shuffle
  - GET /daily-challenge (~line 277-295): Problem.findAll() 전체 로드 → 배열에서 선택
  - GET /recommend (~line 302-310): Problem.findAll() 전체 로드 → JS 필터

Task:
Problem 모델에 세 메서드 추가하거나 기존 findAll 호출을 SQL로 교체:

1. **random 문제** (이미 캐시 없음):
   Problem.findAll 제거 →
   SELECT p.id, p.title, p.tier, p.difficulty FROM problems p
   LEFT JOIN problem_tags pt ON p.id = pt.problem_id
   WHERE COALESCE(p.visibility,'global')='global'
     AND COALESCE(p.problem_type,'coding')='coding'
     [AND p.tier = ? IF tier 파라미터 있을 때]
     [AND p.difficulty BETWEEN ? AND ? IF minDiff/maxDiff 있을 때]
     AND p.id NOT IN (SELECT problem_id FROM submissions WHERE user_id=? AND result='correct')
   GROUP BY p.id ORDER BY RAND() LIMIT 1
   → JS 필터/shuffle 제거

2. **daily challenge**: 
   이미 1h 캐시 있고 1개만 선택 → 기존 Problem.findAll 호출은 캐시 덕분에 첫 번째만 DB 조회.
   이건 낮은 우선순위 — 현재 로직이 느린 건 아님 (캐시 있음).

3. **recommend 문제** (미해결 + 유저 티어 기반):
   Problem.findAll 제거 →
   SELECT p.id, p.title, p.tier, p.difficulty, p.solved_count,
          GROUP_CONCAT(DISTINCT pt.tag) AS tags
   FROM problems p
   LEFT JOIN problem_tags pt ON p.id = pt.problem_id
   WHERE COALESCE(p.visibility,'global')='global'
     AND COALESCE(p.problem_type,'coding')='coding'
     AND p.tier IN (?, ?)  -- 유저 티어, 한 단계 위 티어
     AND p.id NOT IN (SELECT problem_id FROM submissions WHERE user_id=? AND result='correct')
   GROUP BY p.id
   ORDER BY RAND()
   LIMIT 6
   → 기존 JS 필터 로직 제거

주의:
- ORDER BY RAND()는 문제 수 적을 때 OK (보통 수백 개 수준 — 이 프로젝트에 적합)
- ESM, query 헬퍼 사용
- 기존 응답 구조 유지
```

---

## 🟡 MEDIUM — 다음 스프린트

---

### [PROMPT-05] contests.js 대회 참가 N+1 — 제출 순위 집계 쿼리 최적화

```
Context:
- File: dailycoding-server/src/routes/contests.js (GET /:id/leaderboard 또는 유사 엔드포인트)
- 추가 확인 필요: Contest.getLeaderboard() 또는 유사 메서드가 있으면 해당 파일 읽어서
  N+1 패턴 있는지 확인 후 수정

Task:
1. Contest.js 모델 파일 열어서 leaderboard/ranking 관련 메서드 확인
2. 각 참가자별로 개별 쿼리 발생하는 패턴 찾아서
   단일 JOIN 쿼리로 교체:
   SELECT cp.user_id, u.username, u.tier, u.avatar_emoji,
          COUNT(DISTINCT cs.problem_id) AS solved_count,
          MIN(cs.solved_at) AS last_solved
   FROM contest_participants cp
   JOIN users u ON cp.user_id = u.id
   LEFT JOIN contest_submissions cs ON cs.user_id = cp.user_id AND cs.contest_id = cp.contest_id AND cs.result='correct'
   WHERE cp.contest_id = ?
   GROUP BY cp.user_id
   ORDER BY solved_count DESC, last_solved ASC
3. 실제 테이블/컬럼명은 Contest.js 읽어서 확인 후 맞출 것
```

---

## 🚀 신규 기능

---

### [PROMPT-F1] 문제 체감 난이도 투표 기능

```
Context:
- Project: DailyCoding — 코딩 문제 풀이 플랫폼
- Stack: Express.js (ESM) backend + React 18 + Vite frontend
- DB: MySQL, query/queryOne/insert/run 헬퍼 사용 (raw pool 금지)
- 기존: admin이 설정한 difficulty(1-10 integer) 있음
- 신규: 유저가 체감 난이도 투표 (1-5점)

Task:
Backend:
1. DB 마이그레이션 (dailycoding-server/src/config/mysql.js seedData 블록 또는 별도 migration):
   CREATE TABLE IF NOT EXISTS problem_difficulty_votes (
     id INT AUTO_INCREMENT PRIMARY KEY,
     user_id INT NOT NULL,
     problem_id INT NOT NULL,
     vote TINYINT NOT NULL CHECK (vote BETWEEN 1 AND 5),
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     UNIQUE KEY unique_vote (user_id, problem_id),
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
     FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
   );

2. routes/problems.js에 엔드포인트 추가:
   POST /api/problems/:id/difficulty-vote  body: { vote: 1-5 }
   - auth + requireVerified 미들웨어
   - INSERT INTO problem_difficulty_votes ... ON DUPLICATE KEY UPDATE vote = ?, created_at = NOW()
   - 응답: { myVote: N, avgVote: N.N, voteCount: N }
   - avgVote/voteCount는 SELECT AVG(vote) AS avg, COUNT(*) AS cnt FROM problem_difficulty_votes WHERE problem_id=? 로 계산

   GET /api/problems/:id/difficulty-vote (내 투표 확인)
   - auth 미들웨어
   - SELECT vote FROM problem_difficulty_votes WHERE user_id=? AND problem_id=?
   - 응답: { myVote: N | null, avgVote: N.N, voteCount: N }

3. Problem.findById() 응답에 avgDifficulty, voteCount 필드 추가 (LEFT JOIN 또는 서브쿼리):
   (SELECT AVG(dv.vote) FROM problem_difficulty_votes dv WHERE dv.problem_id=p.id) AS avgDifficulty,
   (SELECT COUNT(*) FROM problem_difficulty_votes dv WHERE dv.problem_id=p.id) AS voteCount

Frontend (dailycoding/src/pages/JudgePage.jsx — 문제 상세 페이지):
4. 문제 하단에 별점 투표 UI (★☆☆☆☆):
   - 로그인 + 이메일 인증 유저만 투표 가능
   - 이미 투표했으면 내 투표값 하이라이트
   - 전체 평균 표시: "평균 ★3.8 (42명)"
   - onClick → POST /api/problems/:id/difficulty-vote
   - src/api.js axios 인스턴스 사용
   - CSS variables 활용 (--yellow for stars, --text3 for empty stars)

주의: ESM only, auth + requireVerified 미들웨어 필수, ON DUPLICATE KEY UPDATE로 race condition 방지
```

---

### [PROMPT-F2] 문제 북마크 프론트엔드 UI 추가

```
Context:
- Project: DailyCoding
- 확인된 사실: Problem.findAll()이 이미 bookmarks 테이블을 조회하고 isBookmarked 필드를 반환함
  (dailycoding-server/src/models/Problem.js lines 132-138)
  즉 백엔드는 이미 북마크 데이터를 제공 중
- 확인 필요: GET/POST /api/problems/:id/bookmark 엔드포인트 존재 여부

Task:
1. 먼저 routes/problems.js에서 bookmark 관련 엔드포인트 검색:
   - 없으면: POST /api/problems/:id/bookmark 추가 (INSERT IGNORE + affectedRows 패턴)
   - 있으면: 스킵

2. Frontend: dailycoding/src/pages/ProblemsPage.jsx 읽어서 문제 카드 구조 파악 후
   각 문제 카드에 북마크 아이콘(★) 추가:
   - 클릭 시 POST /api/problems/:id/bookmark 호출
   - 낙관적 UI 업데이트 (응답 전에 isBookmarked 상태 토글)
   - 로그인 유저만 표시

3. ProblemsPage.jsx의 status='bookmarked' 필터가 이미 있는지 확인:
   - 있으면: 필터 버튼이 이미 동작하는지 테스트
   - 없으면: 필터 옵션에 '북마크' 추가

주의:
- 실제 코드 먼저 읽고 중복 구현 방지
- isBookmarked 필드는 이미 API 응답에 포함됨 — 별도 조회 불필요
- src/api.js axios 인스턴스 사용
```

---

### [PROMPT-F3] 공개 프로필 — 팔로우 기능 프론트엔드 완성

```
Context:
- Project: DailyCoding
- 확인된 사실:
  - follows.js 라우트 파일 존재 (dailycoding-server/src/routes/follows.js)
  - PublicProfilePage.jsx 프론트엔드 파일 존재 (dailycoding/src/pages/PublicProfilePage.jsx)
  - ProfilePage.jsx에 followStats state 있음 (followers, following)

Task:
1. PublicProfilePage.jsx 읽어서 팔로우 버튼 구현 상태 확인
2. follows.js API 엔드포인트 확인 (POST /api/follows/:id, GET /api/follows/:id/stats 등)
3. 미구현된 부분만 추가:
   - 팔로우/언팔로우 토글 버튼
   - 팔로워/팔로잉 수 표시
   - 팔로우 상태 반영 (이미 팔로우 중이면 "언팔로우" 버튼)
4. 실시간성 불필요 — API 호출 후 상태 업데이트로 충분

주의: 코드 먼저 읽고 이미 구현된 부분 파악 후 missing piece만 추가
```

---

### [PROMPT-F4] 배틀 결과 공유 기능 (SNS/클립보드)

```
Context:
- Project: DailyCoding
- File: dailycoding/src/pages/BattlePage.jsx
- 현재: 배틀 종료 후 승/패 결과 화면이 있을 것으로 예상
- 신규: 결과를 클립보드 또는 트위터로 공유

Task:
1. BattlePage.jsx 읽어서 결과 화면 컴포넌트 위치 파악
2. 결과 화면에 "결과 공유" 버튼 추가:
   - 클립보드 복사: navigator.clipboard.writeText(shareText)
   - shareText 예시: "DailyCoding 배틀에서 ${outcome}했습니다! 🔥 문제: ${problemTitle} | ${myTime}s 소요"
   - 트위터 공유: window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`)
   - 두 버튼: [📋 복사] [🐦 트위터]
3. 클립보드 복사 성공 시 토스트 알림 (기존 useToast() 훅 사용)
4. HTTPS 환경에서만 navigator.clipboard 동작 — fallback으로 execCommand('copy') 추가

주의:
- 외부 라이브러리 추가 금지 — Web API만 사용
- 기존 CSS variables 사용 (--blue, --text, --glass-bg)
- 모바일: navigator.share() API 우선 사용 (지원 시)
```

---

## 실행 순서 권장

```
1단계 (즉시, 확실한 버그): PROMPT-01 → PROMPT-02
2단계 (이번 주, 품질):     PROMPT-03 → PROMPT-04
3단계 (다음 주, 최적화):   PROMPT-05
4단계 (기능):              PROMPT-F1 → PROMPT-F2 → PROMPT-F3 → PROMPT-F4
```

---

## 부록: 확인 완료 — 수정 불필요 항목

| 항목 | 상태 | 근거 |
|------|------|------|
| community.js 트랜잭션 | ✅ 완료 | line 329: transaction() 사용 중 |
| community.js blockFilter SQL | ✅ 완료 | ALLOWED_BLOCK_ALIASES whitelist + parseInt |
| User.findAll() OOM | ✅ 완료 | limit/offset/fields 파라미터 있음 |
| requireVerified on POST | ✅ 완료 | line 321, 378, 429 |
| communityLimiter | ✅ 완료 | line 7, 321, 429 |
| sanitizeTags | ✅ 완료 | line 62 |
| redis.js zAdd TTL | ✅ 완료 | line 100: ttlSec = RANKING_CACHE_TTL |
| User.js tier 상수 | ✅ 완료 | line 6: constants.js import |
| auth.js 페이지네이션 | ✅ 완료 | line 245-262 |
| 좋아요 race condition | ✅ 완료 | INSERT IGNORE 패턴 (line 534, 565) |
| Problem.findAll 캐시 버그 | ✅ 없음 | search 시 캐시 우회 설계 (line 54-55) |
| ProfilePage 히트맵 | ✅ 완료 | YearHeatmap 컴포넌트 구현됨 (line 103) |
| contests.js N+1 (PROMPT-01) | ✅ 완료 | getMyStatuses() + Map 패턴 구현됨 (4/21) |
| 코드 공유 (PROMPT-F4 일부) | ✅ 완료 | SharedSubmissionPage.jsx + share.js (4/21) |
| 북마크 백엔드 | ✅ 완료 | POST /api/problems/:id/bookmark + ProblemsPage 필터 (4/21) |
| 풀이 시간 추적 | ✅ 완료 | solve_time_sec 컬럼 + /api/auth/me/stats + ProfilePage (4/21) |
| 52주 잔디 캘린더 | ✅ 완료 | Dashboard.jsx grassData (4/21) |
| 배틀 관전 | ✅ 완료 | spectateBattle() + socket.io battle:spectate (4/21) |
| AI 분석 캐싱 | ✅ 완료 | analyze:{userId}:{date} Redis 키 (4/21) |
| Judge 캐시 모듈화 | ✅ 완료 | judgeRuntimeCache.js (4/21) |

---

## 🔴 v3 신규 — 즉시 수정

---

### [PROMPT-V3-01] SharedSubmissionPage Monaco 에디터 적용

```
Context:
- File: dailycoding/src/pages/SharedSubmissionPage.jsx
- Problem: 코드를 <pre> 태그로만 보여줌. 신택스 하이라이팅 없음.
- 참고: JudgePage.jsx에서 Monaco Editor를 이미 lazy import로 사용 중:
    const Editor = lazy(() => import('@monaco-editor/react'));
  동일 패턴 재사용 가능 (추가 패키지 설치 불필요)

Task:
1. SharedSubmissionPage.jsx 상단에 lazy import 추가:
   import { lazy, Suspense } from 'react';
   const Editor = lazy(() => import('@monaco-editor/react'));

2. 언어 매핑 함수 추가:
   function toMonacoLang(lang) {
     const map = { python:'python', javascript:'javascript', cpp:'cpp', c:'c', java:'java' };
     return map[lang] || 'plaintext';
   }

3. <pre> 태그를 Monaco Editor read-only로 교체:
   <Suspense fallback={<div style={{padding:20,color:'var(--text3)'}}>코드 로딩 중...</div>}>
     <Editor
       height={`${Math.min(600, (data.code.split('\n').length + 2) * 20)}px`}
       language={toMonacoLang(data.lang)}
       value={data.code}
       theme="vs-dark"
       options={{
         readOnly: true,
         minimap: { enabled: false },
         scrollBeyondLastLine: false,
         fontSize: 13,
         lineNumbers: 'on',
         wordWrap: 'on',
       }}
     />
   </Suspense>

4. 다크/라이트 테마 연동 (선택):
   - ThemeContext를 import하고 있으면 theme 값 읽어서
     theme={isDark ? 'vs-dark' : 'light'} 적용
   - ThemeContext 없으면 'vs-dark' 고정 OK

주의:
- lazy + Suspense 패턴 필수 (Monaco는 무거운 번들)
- @monaco-editor/react 패키지는 이미 dailycoding/package.json에 존재
- readOnly: true 반드시 설정
```

---

### [PROMPT-V3-02] 이번 주의 문제 (Weekly Challenge)

```
Context:
- Project: DailyCoding — 코딩 문제 풀이 플랫폼
- Stack: Express.js (ESM) + React 18 + Vite, MySQL, Redis
- DB 헬퍼: dailycoding-server/src/config/mysql.js의 query/queryOne/insert/run 사용
- auth 미들웨어: middleware/auth.js의 auth, adminOnly, requireVerified

Goal: 매주 어드민이 1개 문제를 주간 챌린지로 지정, 달성 시 보상 지급.

Backend (dailycoding-server/src/):
1. mysql.js의 테이블 생성 블록에 추가:
   CREATE TABLE IF NOT EXISTS weekly_challenges (
     id INT AUTO_INCREMENT PRIMARY KEY,
     problem_id INT NOT NULL,
     week_start DATE NOT NULL,
     reward_code VARCHAR(50) NOT NULL DEFAULT 'weekly_solver',
     created_by INT NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     UNIQUE KEY unique_week (week_start),
     FOREIGN KEY (problem_id) REFERENCES problems(id),
     FOREIGN KEY (created_by) REFERENCES users(id)
   );

2. dailycoding-server/src/routes/weekly.js 신규 파일 생성:
   - GET /api/weekly — 인증 없이 접근 가능
     현재 주(이번 월요일 기준) 챌린지 반환
     SELECT wc.*, p.title, p.tier, p.difficulty,
            (SELECT 1 FROM submissions s
             WHERE s.user_id=? AND s.problem_id=wc.problem_id AND s.result='correct'
             LIMIT 1) AS isSolved
     FROM weekly_challenges wc
     JOIN problems p ON wc.problem_id = p.id
     WHERE wc.week_start = ?
     로그인 유저면 isSolved 포함, 비로그인이면 null
     응답: { id, problemId, problemTitle, tier, difficulty, weekStart, weekEnd, rewardCode, isSolved }

   - POST /api/weekly — adminOnly
     body: { problemId, rewardCode? }
     이번 주 week_start(월요일) 자동 계산:
       const now = new Date();
       const day = now.getDay(); // 0=일,1=월,...
       const diff = (day === 0) ? -6 : 1 - day;
       const monday = new Date(now); monday.setDate(now.getDate() + diff);
       const weekStart = monday.toISOString().split('T')[0];
     INSERT INTO weekly_challenges (problem_id, week_start, reward_code, created_by)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE problem_id=VALUES(problem_id), reward_code=VALUES(reward_code)
     응답: { weekStart, problemId, rewardCode }

3. dailycoding-server/src/index.js에 라우트 등록:
   import weeklyRouter from './routes/weekly.js';
   app.use('/api', weeklyRouter);  // GET/POST /api/weekly

4. dailycoding-server/src/services/submissionExecution.js:
   정답 처리 완료 후(correct 결과) 주간 챌린지 보상 지급 로직 추가:
   - 이번 주 챌린지 problem_id 조회
   - 제출된 problem_id와 일치하면 Reward.grant(userId, rewardCode) 호출
   - Reward 모델은 dailycoding-server/src/models/Reward.js 참고
   - 이미 받은 보상이면 중복 지급 안 되도록 처리 (Reward.grant 내부 중복 체크 확인)

Frontend (dailycoding/src/):
5. Dashboard.jsx — 52주 캘린더 섹션 위에 주간 챌린지 배너 카드 추가:
   useEffect로 GET /api/weekly 호출 (로그인 시 auth 헤더 자동 포함)
   챌린지 없으면 null → 카드 숨김

   카드 레이아웃:
   <div style={{
     padding:'18px 22px', borderRadius:16,
     background:'linear-gradient(135deg,var(--purple)18,var(--bg2))',
     border:'1px solid var(--purple)44', marginBottom:16
   }}>
     <div>🏆 이번 주의 문제</div>
     <div>[문제 제목] · [tier] · 보상: [rewardCode]</div>
     {isSolved
       ? <span style={{color:'var(--green)'}}>✓ 완료</span>
       : <button onClick={() => navigate(`/problems/${problemId}`)}>도전하기</button>
     }
   </div>

6. AdminPage.jsx — 주간 챌린지 설정 섹션 추가:
   - 문제 ID 입력 + 보상 코드 입력 + "설정" 버튼
   - POST /api/weekly 호출 (adminOnly — 어드민 토큰 자동 포함)
   - 현재 이번 주 챌린지 표시 (GET /api/weekly)

주의:
- ESM only (import/export)
- DB 헬퍼 사용 (raw pool 금지)
- auth/adminOnly → middleware/auth.js에서 import
- 보상 지급은 이미 정답 처리 후 — 배틀 결과는 포함하지 않음
```

---

### [PROMPT-V3-03] 문제 풀이 토론 댓글

```
Context:
- Project: DailyCoding
- 기존 커뮤니티 게시판(QnA/tech/lounge)과 별개로, 각 문제 전용 토론 스레드.
- DB 헬퍼: query/queryOne/insert/run (dailycoding-server/src/config/mysql.js)

Backend:
1. mysql.js 테이블 추가:
   CREATE TABLE IF NOT EXISTS problem_comments (
     id INT AUTO_INCREMENT PRIMARY KEY,
     problem_id INT NOT NULL,
     user_id INT NOT NULL,
     content VARCHAR(1000) NOT NULL,
     parent_id INT DEFAULT NULL,
     like_count INT DEFAULT 0,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE,
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
     FOREIGN KEY (parent_id) REFERENCES problem_comments(id) ON DELETE CASCADE
   );
   CREATE TABLE IF NOT EXISTS problem_comment_likes (
     user_id INT NOT NULL,
     comment_id INT NOT NULL,
     PRIMARY KEY (user_id, comment_id),
     FOREIGN KEY (comment_id) REFERENCES problem_comments(id) ON DELETE CASCADE
   );

2. routes/problems.js에 엔드포인트 추가 (기존 /:id 라우트 아래):

   GET /api/problems/:id/comments
   - auth 미들웨어만 (requireVerified 불필요 — 읽기는 자유)
   - 쿼리:
     SELECT pc.id, pc.parent_id, pc.content, pc.like_count, pc.created_at,
            u.username, u.nickname, u.tier, u.avatar_emoji,
            (SELECT 1 FROM problem_comment_likes pcl
             WHERE pcl.user_id=? AND pcl.comment_id=pc.id LIMIT 1) AS isLiked
     FROM problem_comments pc
     JOIN users u ON pc.user_id = u.id
     WHERE pc.problem_id = ?
     ORDER BY pc.parent_id IS NOT NULL, pc.created_at ASC
   - 응답: flat 배열 반환 (프론트에서 트리 구성)
   - 페이지네이션: ?offset=0&limit=50

   POST /api/problems/:id/comments
   - auth + requireVerified
   - body: { content (1~500자), parentId?: number }
   - content 검증: 1자 이상 500자 이하, XSS는 이미 글로벌 sanitizer가 처리
   - INSERT INTO problem_comments (problem_id, user_id, content, parent_id)
   - 멘션 알림: @username 패턴 감지 → Notification.create (community.js의 notifyMentions 함수 참고)

   DELETE /api/problems/:id/comments/:commentId
   - auth 미들웨어
   - 본인(user_id=req.user.id) 또는 admin만 삭제 가능
   - hard delete (CASCADE로 대댓글도 삭제)

   POST /api/problems/:id/comments/:commentId/like
   - auth
   - INSERT IGNORE INTO problem_comment_likes (user_id, comment_id) VALUES (?, ?)
   - affectedRows === 1이면 like_count+1, 0이면 이미 좋아요 → 취소(DELETE + like_count-1)
   - 응답: { liked: boolean, likeCount: number }

Frontend:
3. JudgePage.jsx 탭 목록에 "💬 토론" 탭 추가
   (기존: 문제설명 / 힌트 / AI리뷰 / 내 제출 → + 토론)

4. 토론 탭 컴포넌트:
   - 댓글 목록: 최상위 댓글 + 대댓글 트리 (parent_id 기준 그룹핑)
   - 각 댓글: 아바타이모지 + 닉네임 + 티어 + 내용 + 시간 + 좋아요 버튼 + 답글 버튼
   - 댓글 작성 폼: textarea (최대 500자) + 제출 버튼
   - requireVerified 미충족 시 "이메일 인증 후 댓글을 작성할 수 있습니다" 안내
   - 정답(correct) 제출 직후 토론 탭 자동 활성화

주의:
- ESM only
- 글로벌 sanitizer가 content에서 script/iframe 제거 처리함 — 중복 sanitize 불필요
- auth/requireVerified → middleware/auth.js
- Notification 임포트: models/Notification.js
```

---

## 🟠 v3 HIGH — 이번 스프린트

---

### [PROMPT-V3-04] 팔로우 활동 피드

```
Context:
- Project: DailyCoding
- 팔로우 시스템은 이미 구현됨 (follows.js 라우트 + user_follows 테이블 존재로 추정)
- Goal: 팔로우한 유저의 최근 활동을 Dashboard에 표시

Backend:
1. follows.js 또는 새 파일에 엔드포인트 추가:
   GET /api/follows/feed  — auth 필요
   - 팔로우한 유저 ID 목록 조회:
     SELECT following_id FROM user_follows WHERE follower_id = ?
     (실제 컬럼명은 follows.js 파일 읽어서 확인)
   - 팔로우 대상 없으면 [] 반환
   - 최근 7일 활동 조회 (2개 쿼리를 UNION 또는 별도 실행 후 JS merge):

     -- 정답 제출
     SELECT 'solved' AS type, s.user_id, u.username, u.nickname, u.tier, u.avatar_emoji,
            p.id AS problemId, p.title AS problemTitle, s.lang, s.submitted_at AS createdAt
     FROM submissions s
     JOIN users u ON s.user_id = u.id
     JOIN problems p ON s.problem_id = p.id
     WHERE s.user_id IN (팔로우 ID 목록)
       AND s.result = 'correct'
       AND s.submitted_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     ORDER BY s.submitted_at DESC
     LIMIT 30

     -- 커뮤니티 게시글
     SELECT 'post' AS type, p.user_id, u.username, u.nickname, u.tier, u.avatar_emoji,
            p.id AS postId, p.title AS postTitle, p.board_type AS board,
            p.created_at AS createdAt
     FROM community_posts p
     JOIN users u ON p.user_id = u.id
     WHERE p.user_id IN (팔로우 ID 목록)
       AND p.post_visibility = 'public'
       AND p.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     ORDER BY p.created_at DESC
     LIMIT 20

   - 두 결과를 createdAt 기준 내림차순 정렬 후 최대 20개 반환
   - Redis 캐시: `feed:{userId}` TTL 60초

   (실제 테이블명 community_posts는 community.js 확인 후 조정)

Frontend:
2. Dashboard.jsx — 팔로우 대상 0명이면 섹션 숨김
   useEffect로 GET /api/follows/feed 호출

   피드 카드 레이아웃:
   {feed.map(item => (
     item.type === 'solved'
       ? <div>{item.avatarEmoji} <b>{item.username}</b>님이 <Link to={`/problems/${item.problemId}`}>{item.problemTitle}</Link>을 {item.lang}으로 풀었습니다</div>
       : <div>{item.avatarEmoji} <b>{item.username}</b>님이 <Link to={`/community?post=${item.postId}`}>{item.postTitle}</Link>을 작성했습니다</div>
   ))}

주의:
- IN() 쿼리에 빈 배열 전달 방지 (팔로우 대상 없으면 early return)
- 실제 테이블/컬럼명은 follows.js와 community.js 읽어서 확인
- ESM only, query 헬퍼 사용
```

---

### [PROMPT-V3-05] 어드민 통계 대시보드

```
Context:
- Project: DailyCoding
- File: dailycoding-server/src/routes/admin.js
         dailycoding/src/pages/AdminPage.jsx
- 현재: 어드민 페이지에 유저/문제 관리 기능만 있음
- 신규: 플랫폼 현황 통계 카드

Backend:
1. routes/admin.js에 엔드포인트 추가:
   GET /api/admin/stats  — adminOnly

   병렬 쿼리로 데이터 수집:
   const [userTotal, userWeek, activeToday, subToday, correctToday, tierDist, popularProbs] = await Promise.all([
     queryOne('SELECT COUNT(*) AS cnt FROM users WHERE role != ?', ['admin']),
     queryOne('SELECT COUNT(*) AS cnt FROM users WHERE join_date >= DATE_SUB(NOW(),INTERVAL 7 DAY) AND role!=?', ['admin']),
     queryOne('SELECT COUNT(DISTINCT user_id) AS cnt FROM submissions WHERE submitted_at >= CURDATE()'),
     queryOne('SELECT COUNT(*) AS cnt FROM submissions WHERE submitted_at >= CURDATE()'),
     queryOne('SELECT COUNT(*) AS cnt FROM submissions WHERE submitted_at >= CURDATE() AND result=?', ['correct']),
     query('SELECT tier, COUNT(*) AS cnt FROM users WHERE role!=? GROUP BY tier', ['admin']),
     query(`SELECT p.id, p.title, p.tier, COUNT(s.id) AS solveCount
            FROM problems p
            LEFT JOIN submissions s ON s.problem_id=p.id AND s.result='correct'
            GROUP BY p.id ORDER BY solveCount DESC LIMIT 5`),
   ]);

   응답:
   {
     userStats: { total, newThisWeek, activeToday },
     submissionStats: { totalToday, correctRate },
     tierDistribution: { bronze: N, silver: N, ... },
     popularProblems: [{ id, title, tier, solveCount }]
   }

   Redis 캐시: `admin:stats` TTL 300s

Frontend:
2. AdminPage.jsx 상단에 통계 섹션 추가:
   - 통계 카드 3개 (grid):
     총 유저 N명 (이번 주 +N)
     오늘 제출 N건 (정답률 N%)
     오늘 활성 유저 N명

   - 인기 문제 TOP5 (CSS-only 가로 막대):
     {popularProblems.map(p => (
       <div>
         <span>{p.title}</span>
         <div style={{ width: `${(p.solveCount / max) * 100}%`, height:8, background:'var(--blue)', borderRadius:4 }} />
         <span>{p.solveCount}명 풀이</span>
       </div>
     ))}

   - 티어 분포 누적 바:
     전체 유저 대비 각 티어 비율을 색상별 가로 바로 표시
     티어 색상: unranked=#666 / bronze=#cd7f32 / silver=#c0c0c0 / gold=#ffd700
               platinum=#00e5cc / diamond=#b9f2ff

주의:
- adminOnly 미들웨어 필수
- 차트 라이브러리 금지 — CSS width% 방식만 사용
- 캐시 5분 (플랫폼 통계는 실시간 불필요)
```

---

## 🟡 v3 MEDIUM — UX 개선

---

### [PROMPT-V3-06] JudgePage 모바일 레이아웃

```
Context:
- File: dailycoding/src/pages/JudgePage.jsx
         dailycoding/src/pages/JudgePage.css
- Problem: 좌우 2분할 레이아웃이 768px 이하에서 깨짐

Task:
1. JudgePage.css에 미디어 쿼리 추가:
   @media (max-width: 768px) {
     .judge-layout {
       flex-direction: column !important;
     }
     .judge-problem-panel {
       width: 100% !important;
       max-height: 40vh;
       overflow-y: auto;
       border-right: none !important;
       border-bottom: 1px solid var(--border);
     }
     .judge-editor-panel {
       width: 100% !important;
       min-height: 50vh;
     }
     .judge-tab-bar {
       overflow-x: auto;
       white-space: nowrap;
       -webkit-overflow-scrolling: touch;
     }
   }

   (실제 클래스명은 JudgePage.jsx / JudgePage.css 읽어서 확인 후 적용)

2. 모바일에서 문제 설명 패널:
   - 기본 접힘 상태 (isCollapsed: true on mobile)
   - "문제 보기 ▼" 버튼으로 토글
   - 화면 너비 감지: window.innerWidth < 768 or CSS media query + ref

3. Monaco 에디터 높이 모바일 조정:
   height={isMobile ? '40vh' : 'calc(100vh - 160px)'}

주의:
- JS로 isMobile 감지 시: const isMobile = window.innerWidth < 768
  resize 이벤트도 처리
- 기존 데스크톱 레이아웃 변경 없음 — 모바일 오버라이드만 추가
```

---

### [PROMPT-V3-07] Rate Limit 에러 UX 개선

```
Context:
- File: dailycoding/src/api.js
- Problem: 429 Too Many Requests 에러가 일반 에러와 동일하게 처리됨

Task:
1. api.js의 axios response interceptor에 429 처리 추가:
   현재 interceptor 구조 확인 후 error handler 블록에:

   if (error.response?.status === 429) {
     const retryAfter = error.response.headers['retry-after'];
     const code = error.response.data?.code;

     if (code === 'QUOTA_EXCEEDED') {
       // AI 쿼터 초과 — 업그레이드 유도
       // 이 경우는 각 컴포넌트에서 직접 처리하도록 그냥 reject 통과
     } else {
       // 일반 rate limit
       const sec = retryAfter ? parseInt(retryAfter) : null;
       const msg = sec
         ? `요청이 너무 많습니다. ${sec}초 후 다시 시도해주세요.`
         : '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
       // ToastContext를 api.js에서 직접 쓸 수 없으므로:
       // window 이벤트로 토스트 트리거
       window.dispatchEvent(new CustomEvent('dc:toast', {
         detail: { message: msg, type: 'error' }
       }));
     }
   }

2. ToastContext.jsx 또는 App.jsx에서 dc:toast 이벤트 수신:
   useEffect(() => {
     const handler = (e) => showToast(e.detail.message, e.detail.type);
     window.addEventListener('dc:toast', handler);
     return () => window.removeEventListener('dc:toast', handler);
   }, []);
   (showToast 함수는 기존 ToastContext.jsx 확인 후 적용)

3. AiPage.jsx / JudgePage.jsx — QUOTA_EXCEEDED 처리:
   catch 블록에서 err.response?.data?.code === 'QUOTA_EXCEEDED' 감지 시
   일반 에러 메시지 대신:
   <div>오늘 AI 힌트를 모두 사용했습니다.
     <Link to="/pricing">Pro로 업그레이드</Link>하면 무제한 사용 가능합니다.
   </div>

주의:
- api.js에서 React context 직접 import 불가 — window 이벤트 패턴 사용
- 기존 에러 처리 로직 변경 최소화 (추가만)
```

---

## 실행 순서 (v3 업데이트)

```
즉시 (P0):  PROMPT-V3-01 (Monaco 하이라이팅) — SharedSubmissionPage UX 개선
이번 주 (P1): PROMPT-V3-02 (주간 챌린지) — 리텐션 핵심 기능
이번 주 (P1): PROMPT-V3-03 (문제 댓글) — 커뮤니티 활성화
다음 주 (P2): PROMPT-V3-04 (팔로우 피드) — 소셜 완성
다음 주 (P2): PROMPT-V3-05 (어드민 통계) — 운영 효율화
여유 시 (P3): PROMPT-V3-06 (모바일 레이아웃) — 접근성
여유 시 (P3): PROMPT-V3-07 (Rate Limit UX) — 사용자 혼란 방지
```
