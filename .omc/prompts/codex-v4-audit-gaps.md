# DailyCoding — Codex 프롬프트 v4 (Audit Gap 보완)
> 작성일: 2026-04-22
> 기존 v2/v3 프롬프트에 **없는** 항목만 수록. 중복 없음.
> 실행 전 반드시 기존 파일 읽어서 이미 완료된 항목 확인할 것.

---

## 스택 & 규칙 (반드시 숙지)

```
Frontend: React 18 + Vite, ESM, no TypeScript
Backend:  Express.js + MySQL + Redis, ESM (import/export만, require 금지)
배포:     VPS — Nginx + PM2 + Docker Compose
Judge:    JUDGE_MODE=docker (VPS)
```

**절대 규칙:**
- `import`/`export`만 사용 — `require()` 금지
- DB는 `query()`, `queryOne()`, `insert()`, `run()` 헬퍼만 — `pool.query()` 직접 호출 금지
- 캐시 무효화는 `redis.clearPrefix()` — `client.keys()` 금지
- 유저 데이터 반환 시 반드시 `User.safe()` 통과
- Admin role은 반드시 DB에서 재확인 — JWT role 클레임 신뢰 금지

---

## 🔴 P0 — 즉시 (보안·위생)

---

### [AUDIT-01] admin1234 기본 비밀번호 제거

```
Context:
- dailycoding-server/README.md line 3: admin1234 평문 노출
- dailycoding-server/src/config/mysql.js line 67: 인메모리 폴백에서 admin1234로 어드민 계정 생성
- 운영 단계에서 이 비밀번호가 그대로 사용될 위험이 있음

Task:
1. config/mysql.js 인메모리 폴백 어드민 시딩 수정:
   - 현재: password: 'admin1234' (또는 유사 하드코딩)
   - 수정: process.env.ADMIN_PASSWORD를 사용
     - ADMIN_PASSWORD가 없으면 랜덤 UUID 생성 후 콘솔에 1회 출력:
       const fallbackPw = process.env.ADMIN_PASSWORD || (() => {
         const pw = crypto.randomUUID();
         console.warn(`[SETUP] In-memory admin password: ${pw}`);
         return pw;
       })();
   - import crypto from 'crypto'; 상단에 추가 (Node 내장)

2. dailycoding-server/README.md 수정:
   - admin1234 언급 전체 삭제
   - 대체 텍스트: "초기 관리자 계정은 ADMIN_PASSWORD 환경변수로 설정합니다.
     미설정 시 서버 시작 시 콘솔에 임시 비밀번호가 1회 출력됩니다."

3. .env.example에 ADMIN_PASSWORD= 항목이 없으면 추가:
   ADMIN_PASSWORD=  # 운영 환경에서 반드시 설정

주의:
- ESM: import crypto from 'crypto' (require 금지)
- 기존 production 어드민 계정에 영향 없음 — 인메모리 폴백만 변경
- bcrypt hash 방식은 기존 User.create() 로직 그대로 유지
```

---

### [AUDIT-02] 저장소 위생 — .gitignore 강화

```
Context:
- 현재 워크스페이스에 node_modules/, dist/, .DS_Store가 트래킹됨
- 두 앱이 모노레포 구조 (dailycoding/ + dailycoding-server/)

Task:
1. 루트 /Users/choi/Desktop/dailycoding-final/.gitignore 파일 확인:
   - 없으면 생성, 있으면 아래 항목 누락분만 추가

   최소 필수 내용:
   ```
   # Dependencies
   node_modules/
   */node_modules/

   # Build outputs
   dist/
   */dist/
   build/

   # Runtime / OS
   .DS_Store
   *.log
   npm-debug.log*

   # Environment
   .env
   .env.local
   .env.production

   # Editor
   .vscode/
   .idea/
   *.swp
   *.swo

   # Test coverage
   coverage/
   */coverage/

   # Temp
   *.tmp
   .cache/
   ```

2. dailycoding/.gitignore 확인 — 없으면 아래 추가:
   ```
   dist/
   node_modules/
   .DS_Store
   .env
   .env.local
   ```

3. dailycoding-server/.gitignore 확인 — 없으면 아래 추가:
   ```
   node_modules/
   .env
   .env.local
   logs/
   *.log
   ```

주의:
- 이미 git에 올라간 파일은 이 작업으로 자동 제거되지 않음
- "git rm --cached node_modules -r" 등은 실행하지 말 것 (사용자가 수동 처리)
- .gitignore 파일만 생성/수정하는 것이 이 태스크의 전부
```

---

### [AUDIT-03] lint/test 스크립트 표준화

```
Context:
- dailycoding/package.json: dev/build/preview/start만 있고 test/lint 없음
- dailycoding-server/package.json: dev/start/docker만 있고 test/lint 없음
- CI에 바로 얹기 위한 최소 스크립트 필요

Task:
1. dailycoding/package.json scripts 섹션에 추가:
   "lint": "npx eslint src --ext .js,.jsx --max-warnings 0",
   "lint:fix": "npx eslint src --ext .js,.jsx --fix"

   - .eslintrc.json 없으면 생성:
     {
       "env": { "browser": true, "es2022": true },
       "parserOptions": { "ecmaVersion": 2022, "sourceType": "module", "ecmaFeatures": { "jsx": true } },
       "extends": ["eslint:recommended"],
       "rules": {
         "no-unused-vars": "warn",
         "no-console": "off"
       }
     }

2. dailycoding-server/package.json scripts 섹션에 추가:
   "test": "node --test src/**/*.test.js --timeout 10000",
   "test:single": "node --test",
   "lint": "npx eslint src --ext .js --max-warnings 0",
   "lint:fix": "npx eslint src --ext .js --fix"

   - .eslintrc.json 없으면 생성:
     {
       "env": { "node": true, "es2022": true },
       "parserOptions": { "ecmaVersion": 2022, "sourceType": "module" },
       "extends": ["eslint:recommended"],
       "rules": {
         "no-unused-vars": "warn",
         "no-console": "off"
       }
     }

3. 루트 package.json이 있으면 (없어도 무방):
   "scripts": {
     "test:all": "npm test --workspace=dailycoding-server",
     "lint:all": "npm run lint --workspace=dailycoding && npm run lint --workspace=dailycoding-server"
   }

주의:
- eslint 패키지가 없으면 devDependencies에 추가 필요
  dailycoding/: npm install -D eslint
  dailycoding-server/: npm install -D eslint
- 기존 코드에 eslint 오류가 많을 수 있음 — warn 수준으로만 설정
- TypeScript 없으므로 @typescript-eslint 패키지 불필요
```

---

### [AUDIT-04] 백엔드 테스트 열린 핸들 수정

```
Context:
- node --test src/**/*.test.js 실행 시 테스트는 통과하지만 프로세스가 종료되지 않음
- 원인: MySQL pool, Redis client, Socket.io, setInterval(scheduler) 등이 정리되지 않음

Task:
1. 각 *.test.js 파일에 afterEach/after 정리 훅 확인:
   - MySQL pool이 열려있으면:
     import { pool } from '../config/mysql.js';  // pool export가 있는지 확인
     after(() => pool?.end());

   - Redis client가 열려있으면:
     import { client } from '../config/redis.js';  // client export 확인
     after(() => client?.quit());

2. mysql.js 파일 확인:
   - pool이 모듈 레벨에서 생성되는지 확인
   - 테스트 환경(process.env.NODE_ENV === 'test')에서 waitForDB()가 바로 resolve하도록:
     if (process.env.NODE_ENV === 'test') {
       // 인메모리 폴백으로 즉시 전환, 실제 DB 연결 시도하지 않음
     }

3. 테스트 파일들 목록 확인 후 공통 패턴:
   - 각 test 파일 상단:
     import { after, afterEach, before, describe, it } from 'node:test';
   - 파일 하단:
     after(async () => {
       // 여기서 DB, Redis, 서버 정리
     });

4. package.json test 스크립트에 --test-force-exit 플래그 추가 (임시 방편):
   "test": "node --test --test-force-exit src/**/*.test.js"
   단, 이건 임시방편 — 위 1-3의 근본 수정을 먼저 시도

주의:
- 실제 테스트 파일들 먼저 읽어서 현재 구조 파악 후 수정
- DB/Redis 연결을 mock으로 교체하는 것보다 연결 정리(cleanup)가 더 안전
- process.env.NODE_ENV = 'test' 는 package.json test 스크립트에서 앞에 설정:
  "test": "NODE_ENV=test node --test --test-force-exit src/**/*.test.js"
```

---

## 🟠 P1 — 이번 스프린트 (구조 개선)

---

### [AUDIT-05] backend index.js 책임 분리

```
Context:
- File: dailycoding-server/src/index.js
- 현재: 초기화(DB/Redis 연결 대기), 보안 미들웨어(helmet/cors/rate limit),
         sanitize 미들웨어, 라우터 등록, 헬스체크, Socket.io, ensureAdmin() 등이 모두 집중됨
- 수정 비용이 클수록 분리 효과가 큼

Task:
1. src/app.js 신규 파일 생성 — Express 앱 인스턴스 + 미들웨어 등록만:
   import express from 'express';
   import { configureMiddleware } from './middleware/setup.js';
   import { registerRoutes } from './routes/registry.js';

   export function createApp() {
     const app = express();
     configureMiddleware(app);
     registerRoutes(app);
     return app;
   }

2. src/middleware/setup.js 신규 파일 — 미들웨어 등록 로직 이동:
   - helmet, cors, rate limit, bodyParser, sanitize 미들웨어
   - trust proxy 설정

3. src/routes/registry.js 신규 파일 — 라우터 import + app.use() 한 곳에:
   import authRouter from './auth.js';
   import problemsRouter from './problems.js';
   // ... 모든 라우터
   export function registerRoutes(app) {
     app.use('/api/auth', authRouter);
     app.use('/api/problems', problemsRouter);
     // ...
   }

4. index.js는 진입점만 남김:
   - waitForDB() 호출
   - createApp()
   - httpServer 생성 + Socket.io 연결
   - app.listen()
   - ensureAdmin()

주의:
- 기능 변경 없이 순수 파일 분리
- 순환 import 발생하지 않도록 의존성 방향 주의
- 기존 동작하는 모든 라우트 그대로 유지
- ESM: export/import로 연결
```

---

### [AUDIT-06] 큰 파일 분해 — auth.js 라우터 (898줄)

```
Context:
- File: dailycoding-server/src/routes/auth.js (~898줄)
- 현재: 로컬 auth, OAuth(GitHub/Google), 이메일 인증, 비밀번호 재설정,
         프로필 관리, 어드민 전용 유저 관리가 모두 한 파일

Task:
1. 파일 먼저 읽어서 라우트 목록 파악
2. 아래 기준으로 분리:
   - src/routes/auth/local.js — POST /register, POST /login, POST /logout, POST /refresh
   - src/routes/auth/oauth.js — GET/callback GitHub, GET/callback Google
   - src/routes/auth/email.js — POST /forgot-password, POST /reset-password, POST /verify-email
   - src/routes/auth/profile.js — GET /me, PATCH /me, GET /me/stats, GET /me/activity, GET /profile/:id
   - src/routes/auth/admin-users.js — adminOnly 전용 유저 관리 (PATCH /:id/ban 등)

3. src/routes/auth.js는 라우터 조합만:
   import localRouter from './auth/local.js';
   // ... 나머지 import
   router.use('/', localRouter);
   router.use('/', oauthRouter);
   // ...
   export default router;

주의:
- 분리 전 파일을 반드시 전체 읽어서 공유 헬퍼/변수 파악
- 공유 헬퍼는 src/routes/auth/helpers.js로 추출
- 기존 URL 경로 변경 없음 (/api/auth/... 전부 유지)
- ESM, 기존 미들웨어 import 패턴 유지
```

---

### [AUDIT-07] 일일 미션 시스템 (리텐션 핵심)

```
Context:
- Project: DailyCoding — 코딩 문제 풀이 플랫폼
- 기존: 연속 풀이 스트릭(streak)은 있으나, 하루에 여러 미션 목표는 없음
- 주간 챌린지(weekly_challenges)는 이미 구현됨 → 이건 별도 일일 미션

Goal: 매일 새로고침되는 3개 미션 → 완료 시 포인트/뱃지 보상

Backend:
1. mysql.js에 테이블 추가:
   CREATE TABLE IF NOT EXISTS daily_missions (
     id INT AUTO_INCREMENT PRIMARY KEY,
     user_id INT NOT NULL,
     mission_date DATE NOT NULL,
     mission_type ENUM('solve_1','solve_3','battle_win','correct_streak_3','review_ai') NOT NULL,
     is_completed TINYINT(1) DEFAULT 0,
     completed_at TIMESTAMP NULL,
     reward_type VARCHAR(50) NOT NULL DEFAULT 'points',
     reward_value INT NOT NULL DEFAULT 10,
     UNIQUE KEY unique_mission (user_id, mission_date, mission_type),
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
     INDEX idx_user_date (user_id, mission_date)
   );

2. src/services/missionService.js 신규 파일:
   export const MISSION_TEMPLATES = [
     { type: 'solve_1',         label: '오늘 문제 1개 풀기',        reward_value: 10 },
     { type: 'solve_3',         label: '오늘 문제 3개 풀기',        reward_value: 30 },
     { type: 'correct_streak_3',label: '3문제 연속 정답',           reward_value: 20 },
     { type: 'battle_win',      label: '배틀에서 1승',              reward_value: 25 },
     { type: 'review_ai',       label: 'AI 코드 리뷰 1회 사용',    reward_value: 5  },
   ];

   // 오늘 미션이 없으면 랜덤 3개 생성
   export async function ensureDailyMissions(userId) {
     const today = new Date().toISOString().split('T')[0];
     const existing = await query(
       'SELECT * FROM daily_missions WHERE user_id=? AND mission_date=?',
       [userId, today]
     );
     if (existing.length >= 3) return existing;

     // 랜덤 3개 선택 (이미 있는 type 제외)
     const existingTypes = existing.map(m => m.mission_type);
     const available = MISSION_TEMPLATES.filter(t => !existingTypes.includes(t.type));
     const toCreate = available.sort(() => Math.random() - 0.5).slice(0, 3 - existing.length);

     for (const t of toCreate) {
       await insert(
         'INSERT IGNORE INTO daily_missions (user_id, mission_date, mission_type, reward_value) VALUES (?, ?, ?, ?)',
         [userId, today, t.type, t.reward_value]
       );
     }
     return query('SELECT * FROM daily_missions WHERE user_id=? AND mission_date=?', [userId, today]);
   }

   // 미션 완료 처리 (중복 호출 안전)
   export async function completeMission(userId, missionType) {
     const today = new Date().toISOString().split('T')[0];
     const mission = await queryOne(
       'SELECT * FROM daily_missions WHERE user_id=? AND mission_date=? AND mission_type=? AND is_completed=0',
       [userId, today, missionType]
     );
     if (!mission) return null; // 없거나 이미 완료

     await run(
       'UPDATE daily_missions SET is_completed=1, completed_at=NOW() WHERE id=?',
       [mission.id]
     );
     // 포인트 지급 (User.addPoints가 있으면 사용, 없으면 직접 UPDATE)
     await run('UPDATE users SET rating = rating + ? WHERE id=?', [mission.reward_value, userId]);
     return { missionType, rewardValue: mission.reward_value };
   }

3. src/routes/missions.js 신규 파일:
   GET /api/missions/daily — auth 필요
   - ensureDailyMissions(req.user.id) 호출
   - 응답: { missions: [{type, label, isCompleted, rewardValue}], date }

   (미션 완료는 각 액션 발생 지점에서 completeMission 호출)

4. 미션 트리거 지점 추가:
   - routes/submissions.js: 정답(correct) 처리 후
     await completeMission(userId, 'solve_1');
     // 오늘 정답 수 체크 후
     const todaySolved = await queryOne('SELECT COUNT(*) AS cnt FROM submissions WHERE user_id=? AND result=? AND DATE(submitted_at)=CURDATE()', [userId, 'correct']);
     if (todaySolved.cnt >= 3) await completeMission(userId, 'solve_3');

   - routes/ai.js: AI 리뷰 호출 후
     await completeMission(req.user.id, 'review_ai');

   - routes/battles.js: 배틀 승리 처리 후
     await completeMission(winnerId, 'battle_win');

5. index.js에 라우터 등록:
   import missionsRouter from './routes/missions.js';
   app.use('/api', missionsRouter);

Frontend:
6. Dashboard.jsx에 일일 미션 카드 추가:
   useEffect → GET /api/missions/daily

   카드 레이아웃:
   <div style={{ padding:'18px 22px', borderRadius:16, border:'1px solid var(--border)', marginBottom:16 }}>
     <h3 style={{ color:'var(--text)', marginBottom:12 }}>📋 오늘의 미션</h3>
     {missions.map(m => (
       <div key={m.type} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
         <span style={{ fontSize:18 }}>{m.isCompleted ? '✅' : '⬜'}</span>
         <span style={{ color: m.isCompleted ? 'var(--text3)' : 'var(--text)', textDecoration: m.isCompleted ? 'line-through' : 'none' }}>
           {m.label}
         </span>
         <span style={{ marginLeft:'auto', color:'var(--yellow)', fontSize:13 }}>+{m.rewardValue}pt</span>
       </div>
     ))}
   </div>

주의:
- ESM only
- completeMission은 멱등성 보장 (UNIQUE KEY + is_completed=0 조건)
- 트리거 추가 시 기존 정답 처리 로직의 에러 핸들링을 방해하지 않도록 try/catch로 감쌀 것
- 미션 실패해도 메인 기능(제출/AI 리뷰)이 실패하면 안 됨
```

---

## 🟡 P2 — 다음 스프린트 (배틀 강화)

---

### [AUDIT-08] 배틀 히스토리 & 리매치

```
Context:
- File: dailycoding-server/src/routes/battles.js (존재 추정)
         dailycoding/src/pages/BattlePage.jsx
- 현재: 배틀 결과는 저장되나 히스토리 조회 UI가 없을 가능성 높음

Task:
1. battles.js 읽어서 배틀 결과 저장 구조 파악
2. 결과 저장 테이블 확인 (battles 또는 battle_results 추정)

3. GET /api/battles/history — auth 필요:
   SELECT b.id, b.problem_id, p.title, b.winner_id, b.created_at,
          b.duration_sec, b.my_result, b.opponent_id,
          u.username AS opponentName, u.tier AS opponentTier
   FROM battles b
   JOIN users u ON u.id = CASE WHEN b.user1_id=? THEN b.user2_id ELSE b.user1_id END
   JOIN problems p ON p.id = b.problem_id
   WHERE (b.user1_id=? OR b.user2_id=?)
     AND b.status = 'ended'
   ORDER BY b.created_at DESC
   LIMIT 20
   (실제 컬럼명은 파일 읽어서 확인)

4. POST /api/battles/:id/rematch — auth 필요:
   - 해당 배틀의 problem_id와 opponent_id 조회
   - 신규 배틀 생성 요청 (기존 배틀 생성 로직 재사용)
   - 상대방에게 Socket.io로 리매치 요청 알림:
     io.to(`user:${opponentId}`).emit('battle:rematch_request', { battleId: newId, from: req.user.id })

5. Frontend: BattlePage.jsx 결과 화면에 버튼 2개 추가:
   [리매치] → POST /api/battles/:id/rematch
   [히스토리] → navigate('/battles/history')

6. BattleHistoryPage.jsx 신규 또는 ProfilePage 탭에 히스토리 섹션 추가:
   - 배틀 목록: 날짜 / 문제 / 상대방 / 승패 / 소요시간
   - 승/패 뱃지: 승=초록, 패=빨강, 무승부=회색

주의:
- 실제 battles 테이블 컬럼명은 파일 먼저 읽어서 확인
- Socket.io는 req.app.get('io')로 접근
- 리매치는 상대방이 거절할 수 있어야 함 — 수락/거절 이벤트 추가
```

---

### [AUDIT-09] 시즌 랭킹 시스템

```
Context:
- 현재: 누적 rating 기반 전체 랭킹만 있음
- 추가: 월별 시즌 랭킹 (매월 1일 초기화, 시즌 종료 시 보상)

Backend:
1. mysql.js 테이블 추가:
   CREATE TABLE IF NOT EXISTS season_rankings (
     id INT AUTO_INCREMENT PRIMARY KEY,
     user_id INT NOT NULL,
     season VARCHAR(7) NOT NULL,  -- '2026-04' 형식
     season_rating INT NOT NULL DEFAULT 0,
     solved_count INT NOT NULL DEFAULT 0,
     battle_wins INT NOT NULL DEFAULT 0,
     final_rank INT NULL,  -- 시즌 종료 후 확정 순위
     reward_granted TINYINT(1) DEFAULT 0,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     UNIQUE KEY unique_season_user (user_id, season),
     INDEX idx_season_rating (season, season_rating DESC),
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   );

2. missionService.js 또는 새 seasonService.js:
   export function getCurrentSeason() {
     const now = new Date();
     return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
   }

   export async function updateSeasonRating(userId, ratingDelta) {
     const season = getCurrentSeason();
     await run(
       `INSERT INTO season_rankings (user_id, season, season_rating, solved_count)
        VALUES (?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
          season_rating = season_rating + ?,
          solved_count = solved_count + 1,
          updated_at = NOW()`,
       [userId, season, Math.max(0, ratingDelta), Math.max(0, ratingDelta)]
     );
   }

3. routes/ranking.js에 엔드포인트 추가:
   GET /api/ranking/season?season=2026-04 — auth 선택
   - season 파라미터 없으면 현재 월 사용
   - SELECT sr.*, u.username, u.tier, u.avatar_emoji
     FROM season_rankings sr
     JOIN users u ON u.id = sr.user_id
     WHERE sr.season = ?
     ORDER BY sr.season_rating DESC
     LIMIT 100
   - Redis 캐시: `ranking:season:{season}` TTL 60초

4. submissions.js 정답 처리 후 updateSeasonRating 호출:
   - ratingDelta는 기존 rating 재계산 후 변화량 사용
   - 또는 간단히 문제 tier 기반 점수 (bronze=5, silver=10, gold=15, ...)

Frontend:
5. RankingPage.jsx에 탭 추가: "전체" / "이번 시즌"
   - 시즌 탭: GET /api/ranking/season 호출
   - 현재 시즌 표시: "2026년 4월 시즌"
   - 남은 기간: "시즌 종료까지 N일"

주의:
- 시즌 rating은 전체 rating과 독립 — 전체 rating 수정 없음
- ESM, 캐시 무효화는 clearPrefix('ranking:season:') 사용
- 시즌 보상은 추후 확장 포인트 (reward_granted 컬럼만 추가)
```

---

## 파일 위치 레퍼런스

| 목적 | 경로 |
|------|------|
| DB 헬퍼 | `dailycoding-server/src/config/mysql.js` |
| Redis 헬퍼 | `dailycoding-server/src/config/redis.js` |
| 인증 미들웨어 | `dailycoding-server/src/middleware/auth.js` |
| Rate limit | `dailycoding-server/src/middleware/rateLimit.js` |
| 검증 | `dailycoding-server/src/middleware/validate.js` |
| 서버 진입점 | `dailycoding-server/src/index.js` |
| Socket 서버 | `dailycoding-server/src/services/socketServer.js` |
| 공유 상수 | `dailycoding-server/src/shared/constants.js` |
| 전역 CSS | `dailycoding/src/index.css` |
| API 클라이언트 | `dailycoding/src/api.js` |

---

## 실행 순서 (이 파일 한정)

```
P0 즉시:   AUDIT-01 (admin 비밀번호) → AUDIT-02 (.gitignore) → AUDIT-03 (스크립트)
P0 병렬:   AUDIT-04 (테스트 핸들) — 03과 동시 진행 가능
P1 다음:   AUDIT-05 (index.js 분리) → AUDIT-06 (auth.js 분리)
P1 기능:   AUDIT-07 (일일 미션) — 구조 정리 후 진행
P2 여유:   AUDIT-08 (배틀 히스토리) → AUDIT-09 (시즌 랭킹)
```

---

## 기존 프롬프트와 연계

이 파일은 기존 두 문서와 **중복 없이** 보완 관계:
- `codex-improvement-prompt-v2.md` — 디자인(D-1~D-8), 보안(S-1~S-4), 품질(Q-1~Q-7)
- `autopilot/codex-prompts.md` — 성능(PROMPT-01~05), 기능(PROMPT-F/V3 시리즈)
- **이 파일(v4)** — 운영보안, 저장소위생, CI, 파일분해, 리텐션, 배틀강화
