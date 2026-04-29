# DailyCoding Platform — Codex Improvement Prompt

## 프로젝트 개요

DailyCoding은 LeetCode 스타일의 코딩 챌린지 플랫폼입니다.

**스택:**
- Frontend: React 18 + Vite (TypeScript 없음, ESM)
- Backend: Express.js + MySQL + Redis (ESM, Node.js)
- Judge: Docker sandbox (로컬) / Native subprocess (VPS)
- AI: Google Generative AI
- 결제: Stripe (KRW)
- 실시간: Socket.io
- 배포: VPS (Ubuntu 22.04) — Nginx + PM2 + Docker Compose

**디렉토리 구조:**
```
dailycoding-final/
├── dailycoding/              # React 18 + Vite 프론트엔드
│   └── src/
│       ├── pages/            # 20개 페이지
│       ├── components/       # 공통 컴포넌트
│       ├── context/          # AuthContext, AppContext, ThemeContext, ToastContext
│       ├── hooks/            # 커스텀 훅
│       └── api.js            # Axios 인스턴스
└── dailycoding-server/       # Express.js 백엔드
    └── src/
        ├── routes/           # 15개 라우트 파일 (90+ 엔드포인트)
        ├── models/           # 9개 모델
        ├── services/         # judge, ai, email, socket, submissionExecution
        ├── middleware/       # auth, rateLimit, validate
        └── config/           # mysql, redis, logger, dateutil
```

---

## 작업 지시 (Codex에게)

아래 개선사항들을 **우선순위 순서대로** 구현해줘. 각 섹션은 독립적이야. 반드시 기존 코드 컨벤션을 유지하고 (`import`/`export` ESM, async/await, 모델 레이어에 비즈니스 로직 배치), 새 파일을 불필요하게 만들지 마.

---

## 🔴 CRITICAL — 보안 취약점 수정

### 1. SQL Injection 위험 제거 — `routes/community.js`

**문제:** `blockFilter()` / `replyBlockFilter()` 함수가 SQL 문자열에 userId를 직접 interpolation함

**현재 코드 패턴 (위험):**
```js
const blockFilter = (userId) => userId
  ? `AND p.user_id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id=${userId})`
  : '';
```

**요청:**
- `blockFilter()` / `replyBlockFilter()` 를 파라미터 바인딩 방식으로 리팩터링
- `query(sql, params)` 헬퍼를 사용해 `?` 플레이스홀더로 교체
- 기존 호출 지점 모두 업데이트

---

### 2. Stripe Webhook 서명 검증 — `routes/subscription.js`

**문제:** Webhook이 raw JSON을 받지만 서명 검증 로직이 없을 수 있음

**요청:**
- `stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)` 확인 및 적용
- `index.js`의 Stripe webhook 라우트에 `express.raw({ type: 'application/json' })` 미들웨어 확인
- 검증 실패 시 400 응답 반환

---

### 3. Socket.io JWT 인증 추가 — `services/socketServer.js`

**문제:** Socket.io 연결 시 JWT 인증 없이 연결 허용될 수 있음

**요청:**
- `io.use()` 미들웨어에서 `socket.handshake.auth.token` 검증
- 유효하지 않은 토큰이면 `next(new Error('Unauthorized'))` 반환
- 인증된 `userId`를 `socket.data.userId`에 저장해 이후 이벤트 핸들러에서 사용

---

### 4. 비밀번호 복잡도 검증 추가 — `routes/auth.js`

**문제:** 비밀번호 강도 요구사항 미적용

**요청:**
- 회원가입 / 비밀번호 변경 엔드포인트에서 검증:
  - 최소 8자
  - 대문자 1개 이상
  - 숫자 1개 이상
  - 특수문자 1개 이상 (`!@#$%^&*` 등)
- 기존 Joi 스키마 (`middleware/validate.js`)에 통합

---

## 🟠 HIGH — 코드 품질 / 아키텍처 개선

### 5. 티어 임계값 중앙화 — 상수 파일 생성

**문제:** 티어 포인트 임계값이 `User.js`, `LandingPage.jsx`, `CLAUDE.md`에 분산됨

```
현재 임계값: unranked→bronze 200, bronze→silver 2000,
             silver→gold 5500, gold→platinum 11000, platinum→diamond 19000
```

**요청:**
- `dailycoding-server/src/shared/constants.js` 생성:
```js
export const TIER_THRESHOLDS = {
  bronze: 200,
  silver: 2000,
  gold: 5500,
  platinum: 11000,
  diamond: 19000,
};
export const SUBSCRIPTION_PRICE = { pro_monthly: 9900, pro_yearly: 99000 };
export const AI_DAILY_QUOTA = 5;
export const RANKING_CACHE_TTL = 60;
```
- `User.js`, `subscription.js`, `ai.js`에서 이 상수 import해서 사용
- `dailycoding/src/data/constants.js`도 같은 값으로 동기화 (공유 파일 또는 복사)
- `LandingPage.jsx`, `PricingPage.jsx`에서 import 해서 사용

---

### 6. Ranking 쿼리 최적화 — `models/User.js`

**문제:** `findAll()`이 `SELECT *` + JS sort → 대규모 유저시 OOM 위험

**요청:**
- `User.getRanking(limit = 100)` 메서드 신규 추가:
```js
SELECT id, username, tier, rating, solved_count, avatar_url, equipped_badge, equipped_title
FROM users
WHERE banned_at IS NULL AND role != 'admin'
ORDER BY rating DESC
LIMIT ?
```
- `routes/ranking.js`에서 `User.findAll()` 대신 `User.getRanking()` 사용

---

### 7. 배틀 문제 DB 이관 — `models/Battle.js`

**문제:** 배틀용 fill-blank/bug-fix 문제 4개가 `Battle.js`에 하드코딩됨

**요청:**
- `dailycoding-server/config/mysql.js` seed 또는 migration SQL에 배틀용 샘플 문제 INSERT 추가
- `Battle.selectProblems()`에서 DB에서 problem_type + battle_eligible 조건으로 조회하도록 변경
- `problems` 테이블에 `battle_eligible TINYINT(1) DEFAULT 0` 컬럼 추가하는 migration SQL 작성

---

### 8. 입력 길이 제한 추가 — `middleware/validate.js`

**문제:** description, code 등 LONGTEXT 필드에 길이 검증 없음

**요청:**
- 문제 생성/수정: `description` ≤ 50,000자, `title` ≤ 200자
- 커뮤니티 게시글: `content` ≤ 10,000자, `title` ≤ 300자
- 코드 제출: `code` ≤ 100,000자
- 기존 Joi 스키마에 `.max()` 추가

---

### 9. 에러 응답 형식 표준화 — 전체 routes/

**문제:** 에러 응답 형식이 라우트마다 다름 (`message`, `error`, `msg` 혼재)

**요청:**
- 모든 에러 응답을 `{ success: false, error: { code: string, message: string } }` 형태로 통일
- `middleware/errorHandler.js` 신규 생성:
```js
export const errorResponse = (res, status, code, message) =>
  res.status(status).json({ success: false, error: { code, message } });
```
- 자주 쓰이는 응답 코드: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `INTERNAL_ERROR`
- 가장 많이 쓰이는 라우트 3개 (`auth.js`, `problems.js`, `submissions.js`)에 먼저 적용

---

## 🟡 MEDIUM — 기능 추가

### 10. 관리자 감사 로그 — `routes/admin.js` + DB

**문제:** 관리자가 어떤 행동을 했는지 추적 불가

**요청:**
- `admin_logs` 테이블 migration SQL 작성:
```sql
CREATE TABLE admin_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id INT,
  detail JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_id (admin_id),
  INDEX idx_created_at (created_at)
);
```
- `routes/admin.js`의 모든 변경 작업 (밴/언밴, 역할 변경, 캐시 삭제, 컨텐츠 삭제)에 로그 INSERT 추가
- `GET /api/admin/logs?page=1&limit=50` 엔드포인트 추가

---

### 11. 비밀번호 찾기 Rate Limiting — `routes/auth.js`

**문제:** `POST /forgot-password`에 rate limit 없음 → 이메일 플러드 가능

**요청:**
- `middleware/rateLimit.js`에 `forgotPasswordLimiter` 추가: IP당 5회/시간
- `routes/auth.js`의 `/forgot-password` 라우트에 적용

---

### 12. 전역 검색 엔드포인트 — `routes/problems.js` + `routes/community.js`

**문제:** 문제/게시글을 통합 검색하는 단일 API 없음

**요청:**
- `GET /api/search?q=keyword&type=all|problem|post&limit=10` 엔드포인트 신규 추가 (별도 `routes/search.js` 파일로)
- 문제: title + tag 검색 (기존 problems 쿼리 재사용)
- 게시글: title + content 검색 (LIKE 또는 FULLTEXT)
- 응답: `{ problems: [], posts: [], total: N }`

---

### 13. 문제 Editorial (공식 해설) 기능

**문제:** 공식 해설 없음 — 댓글로만 해결 방식 공유

**요청:**
- `problem_editorials` 테이블 migration SQL:
```sql
CREATE TABLE problem_editorials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  problem_id INT NOT NULL UNIQUE,
  content LONGTEXT NOT NULL,
  author_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
);
```
- `GET /api/problems/:id/editorial` — 공개 조회
- `POST /api/problems/:id/editorial` — 관리자 전용 작성
- `PUT /api/problems/:id/editorial` — 관리자 전용 수정
- `JudgePage.jsx`에 "Editorial" 탭 추가 (문제 제출 후 또는 관리자 공개 시 표시)

---

### 14. 유저 활동 피드 API — `routes/auth.js` 또는 신규 `routes/activity.js`

**문제:** 유저의 활동 (풀이, 댓글, 배틀, 팔로우) 통합 타임라인 없음

**요청:**
- `GET /api/users/:id/activity?page=1&limit=20` 엔드포인트:
  - submissions (correct만): `{ type: 'solve', problem_title, lang, submitted_at }`
  - community posts: `{ type: 'post', board, title, created_at }`
  - battle results: `{ type: 'battle', result: win|lose, created_at }`
- `PublicProfilePage.jsx`에 활동 피드 섹션 추가

---

### 15. 대회 자동 종료 스케줄러

**문제:** 대회 `duration_min`은 저장되지만 백엔드에서 자동 종료 안됨

**요청:**
- `services/scheduler.js` 생성 — `setInterval` 또는 `node-cron` 사용
- 1분마다 `status='running'` + `started_at + duration_min < NOW()` 인 대회 쿼리
- 해당 대회들을 `status='ended'`로 업데이트 + 수상자에게 보상 자동 지급
- `index.js`에서 서버 시작 시 스케줄러 실행

---

## 🟢 LOW — UX / 프론트엔드 개선

### 16. 제출 코드 비교 기능 — `SubmissionsPage.jsx`

**요청:**
- 제출 목록에서 두 제출을 선택해 diff 비교하는 모달 추가
- Monaco Editor diff mode: `monaco.editor.createDiffEditor()` 사용
- 왼쪽: 이전 제출 코드, 오른쪽: 현재 제출 코드

---

### 17. 랭킹 페이지 필터링 — `RankingPage.jsx`

**요청:**
- 티어별 필터 드롭다운 추가 (전체 / 브론즈 / 실버 / 골드 / 플래티넘 / 다이아몬드)
- `GET /api/ranking?tier=gold` 파라미터 지원 추가 (`routes/ranking.js`)
- 언어별 풀이 수 정렬 옵션 추가 (rating / solved_count)

---

### 18. 프로필 배지 쇼케이스 — `ProfilePage.jsx`

**요청:**
- 공개 프로필에 획득한 배지/칭호 목록 표시 (현재는 equipped 1개만 표시)
- `GET /api/auth/profile/:id` 응답에 `rewards: []` 배열 추가
- 프로필 카드에 획득 배지를 그리드로 표시 (최대 9개, 나머지는 "+N more")

---

### 19. 코드 스니펫 저장 기능 — `JudgePage.jsx`

**요청:**
- Monaco Editor 우측에 "Save Snippet" 버튼 추가
- 유저가 현재 코드를 `localStorage`에 언어별로 저장 (key: `snippet:{problemId}:{lang}`)
- 페이지 재방문 시 저장된 스니펫 자동 로드 (기존 코드 없을 때)
- 저장된 스니펫 삭제 버튼

---

### 20. 다크/라이트 모드 전환 개선 — `ThemeContext.jsx`

**요청:**
- OS 설정 (`prefers-color-scheme`) 자동 감지 및 초기값 적용
- localStorage에 사용자 선택 저장/복원 (현재 구현 확인 후 누락이면 추가)
- Monaco Editor 테마도 다크/라이트에 따라 자동 변경 (`vs-dark` / `vs`)

---

## 📊 인프라 / 모니터링

### 21. 구조화된 로깅 강화 — `config/logger.js`

**요청:**
- Winston 로거에 아래 structured fields 추가:
  - `userId`, `requestId` (uuid 생성), `endpoint`, `statusCode`, `durationMs`
- `index.js`에 요청 시작/종료 미들웨어 추가 (response time 측정)
- 에러 레벨: `warn` (4xx), `error` (5xx), `info` (주요 이벤트)

---

### 22. 헬스체크 엔드포인트 강화 — `routes/` 또는 `index.js`

**현재:** `/api/health` 없거나 기본적인 응답만 있을 수 있음

**요청:**
- `GET /api/health` 응답:
```json
{
  "status": "ok",
  "timestamp": "2026-04-20T00:00:00Z",
  "services": {
    "database": "connected|fallback|error",
    "redis": "connected|fallback|error",
    "judge": "docker|native|unavailable"
  },
  "version": "1.0.0"
}
```
- DB/Redis 상태는 실제 ping 결과 반영

---

## ⚠️ 구현 시 반드시 지켜야 할 규칙

1. **ESM 전용**: `require()` 절대 사용 금지, `import`/`export` 사용
2. **DB 헬퍼 사용**: `pool.query()` 직접 사용 금지, `query()`, `queryOne()`, `insert()`, `run()` 헬퍼 사용
3. **SKIP_SANITIZE_KEYS 유지**: `code`, `sourceCode`, `answer`, `blankAnswers`, `testcases` 등 코드 필드는 sanitize 제외 목록에서 제거하지 말 것
4. **Admin role은 DB에서 검증**: JWT의 role claim 신뢰 금지, `adminOnly` 미들웨어 사용
5. **캐시 무효화는 SCAN 사용**: `client.keys()` 대신 `redis.clearPrefix()` 사용
6. **User.safe() 사용**: 유저 데이터 반환 시 항상 `User.safe(user)` 통과시켜 민감 필드 제거
7. **Rate limit 고려**: 새 엔드포인트에 적절한 rate limiter 적용
8. **배포 환경 호환**: 새 패키지 추가 시 VPS Dockerfile 또한 업데이트 필요

---

## 파일 위치 참고

| 목적 | 파일 경로 |
|------|-----------|
| 인증 미들웨어 | `dailycoding-server/src/middleware/auth.js` |
| Rate limit | `dailycoding-server/src/middleware/rateLimit.js` |
| Joi validation | `dailycoding-server/src/middleware/validate.js` |
| DB 헬퍼 | `dailycoding-server/src/config/mysql.js` |
| Redis 헬퍼 | `dailycoding-server/src/config/redis.js` |
| 서버 진입점 | `dailycoding-server/src/index.js` |
| 공유 상수 (신규) | `dailycoding-server/src/shared/constants.js` |
| 프론트 API 클라이언트 | `dailycoding/src/api.js` |
| 프론트 라우팅 | `dailycoding/src/App.jsx` |

---

*이 프롬프트는 DailyCoding 플랫폼의 전체 코드베이스 감사를 기반으로 작성됨. 2026-04-20 기준.*
