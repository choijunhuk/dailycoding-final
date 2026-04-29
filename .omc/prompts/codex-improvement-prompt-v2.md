# DailyCoding Platform — Codex 개선 프롬프트 v2
> 2026-04-20 기준 | 오늘 변경사항 반영 + 상업적 디자인 개선 포함

---

## 프로젝트 현황 (오늘 완료된 것들)

아래 항목들은 **이미 완료**되었으므로 건드리지 말 것:
- ✅ `dailycoding/src/data/constants.js` — `TIER_THRESHOLDS`, `SUBSCRIPTION_PRICE`, `TEAM_SUBSCRIPTION_PRICE`, `AI_DAILY_QUOTA` 중앙화
- ✅ `LandingPage.jsx`, `PricingPage.jsx` — constants import 완료
- ✅ `RankingPage.jsx` — 티어별 필터 + 진행률 표시 업데이트
- ✅ `ThemeContext.jsx` — 다크/라이트 모드 개선

---

## 스택 요약

```
Frontend: React 18 + Vite (ESM, TypeScript 없음)
Backend:  Express.js + MySQL + Redis (ESM)
Judge:    Docker sandbox (로컬) / Native subprocess (VPS)
AI:       Google Generative AI (Gemini)
결제:     Stripe (KRW)
실시간:   Socket.io
배포:     VPS — Nginx + PM2 + Docker Compose
```

**디자인 시스템:**
- 컬러 팔레트: GitHub Dark (`#0d1117`, `#161b22`, `#21262d`)
- 폰트: `Space Mono` (코드/숫자) + `Noto Sans KR` (UI 텍스트)
- CSS 변수 기반 테마 (`--bg`, `--blue`, `--green`, `--glass-bg`, `--shadow` 등)
- 스타일: 대부분 JSX 인라인 스타일, 일부 CSS 파일

---

## 반드시 지켜야 할 규칙

1. **ESM 전용**: `require()` 금지, `import`/`export` 사용
2. **DB 헬퍼**: `query()`, `queryOne()`, `insert()`, `run()` — `pool.query()` 직접 호출 금지
3. **SKIP_SANITIZE_KEYS**: `code`, `sourceCode`, `answer`, `testcases` 등 코드 필드는 sanitize 제외 목록에서 제거 금지
4. **Admin role**: JWT 신뢰 금지, `adminOnly` 미들웨어 사용
5. **캐시 무효화**: `client.keys()` 금지, `redis.clearPrefix()` 사용
6. **User.safe()**: 유저 데이터 반환 시 항상 통과

---

---

# 🎨 PART 1 — 상업적 디자인 & UX 개선

> 목표: LeetCode/Codeforces 수준의 프로페셔널한 느낌 + 국내 SaaS 상업 플랫폼 느낌

---

## D-1. 랜딩 페이지 전면 개편 — `LandingPage.jsx`

**현재 문제:** 기능 나열 수준, 히어로 섹션 임팩트 없음, 소셜 프루프 없음

**요청:**

### 히어로 섹션
```
- 배경: CSS animated gradient (--bg → #0d2137 → --bg, 8s loop)
- 메인 헤드라인: "코딩 실력을 레벨업하세요" (큰 폰트, gradient text)
- 서브: "매일 문제 · AI 리뷰 · 실시간 배틀로 성장하는 개발자들의 플랫폼"
- CTA 버튼 2개: [무료로 시작하기 →] [데모 보기 ▶] (ghost 버튼)
- 우측: 코드 에디터 mockup 스크린샷 or animated code snippet (타이핑 효과)
```

### 통계 배너 (히어로 아래)
```
- "5,000+ 문제 풀이 완료"  "1,200+ 회원"  "98% 정확도"  "5개 언어 지원"
- 배경: var(--bg2), border-top/bottom: 1px solid var(--border)
- 카운트업 애니메이션 (IntersectionObserver 트리거)
```

### 소셜 프루프 섹션 (새로 추가)
```jsx
const TESTIMONIALS = [
  { name: '김개발', tier: 'gold', text: '매일 한 문제씩 풀다 보니 실력이 눈에 띄게 늘었어요.', company: '카카오 인턴' },
  { name: '이코딩', tier: 'platinum', text: 'AI 코드 리뷰가 정말 유용합니다. 제 코드의 문제점을 바로 알려줘요.', company: '스타트업 재직중' },
  { name: '박알고', tier: 'silver', text: '배틀 모드가 너무 재미있어요. 경쟁하면서 실력이 늘어요.', company: '대학원생' },
]
```
- 카드형 레이아웃, 3열 그리드
- 각 카드에 tier badge + 텍스트 + 이름/직함

### "어떻게 작동하나요?" 섹션
```
Step 1 → Step 2 → Step 3 형태로 numbered flow
① 회원가입 (30초) → ② 매일 문제 풀기 → ③ AI 리뷰로 성장
중간 화살표 연결, 각 스텝에 아이콘
```

### Footer 개선
```
- 4컬럼: 제품 / 리소스 / 회사 / 소셜
- 링크: 문제, 랭킹, 요금제, 커뮤니티 / 도움말, 문의하기 / 이용약관, 개인정보처리방침
- 하단: "© 2026 DailyCoding. All rights reserved." + 다크모드 토글
- 배경: var(--bg2), border-top: 1px solid var(--border)
```

---

## D-2. 네비게이션 개선 — `TopNav.jsx`

**현재 문제:** 이모지 아이콘(📋⚔️) → 비전문적으로 보임, 모바일 UX 열악

**요청:**

### 이모지 → Lucide React 아이콘으로 교체
```bash
npm install lucide-react  # dailycoding/ 에서
```
```jsx
// 교체 매핑
import { BookOpen, Trophy, Swords, BarChart2, MessageSquare, CreditCard, Bot, FileText } from 'lucide-react';

const NAV = [
  { path:'/problems',    label:'문제',     Icon: BookOpen },
  { path:'/contest',     label:'대회',     Icon: Trophy },
  { path:'/battle',      label:'배틀',     Icon: Swords },
  { path:'/ranking',     label:'랭킹',     Icon: BarChart2 },
  { path:'/community',   label:'커뮤니티', Icon: MessageSquare },
  { path:'/pricing',     label:'요금제',   Icon: CreditCard },
  { path:'/ai',          label:'AI',       Icon: Bot },
  { path:'/submissions', label:'제출',     Icon: FileText },
];
```

### 스크롤 시 backdrop-blur 효과
```css
/* TopNav가 스크롤 내려가면 blur 적용 */
position: sticky; top: 0; z-index: 100;
background: var(--glass-bg);
backdrop-filter: blur(12px);
border-bottom: 1px solid var(--border);
transition: box-shadow .2s;
```

### Pro 배지 표시
```jsx
{subTier === 'pro' && (
  <span style={{ 
    background: 'linear-gradient(135deg, #79c0ff, #d2a8ff)',
    color: '#0d1117', fontSize: 10, fontWeight: 800,
    padding: '1px 6px', borderRadius: 4
  }}>PRO</span>
)}
```

---

## D-3. 대시보드 개선 — `Dashboard.jsx`

**현재 문제:** 레이아웃이 단순, 상업적 플랫폼 느낌 없음

**요청:**

### 상단 히어로 카드 (웰컴 섹션)
```jsx
// 티어별 gradient 배경으로 welcoming 카드
<div style={{
  background: `linear-gradient(135deg, ${tierMeta.bg} 0%, var(--bg2) 100%)`,
  border: `1px solid ${tierMeta.color}30`,
  borderRadius: 16, padding: '28px 32px',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
}}>
  <div>
    <div style={{ fontSize: 22, fontWeight: 800 }}>안녕하세요, {user.username}님 👋</div>
    <div style={{ color: 'var(--text2)', marginTop: 6 }}>오늘도 꾸준히 성장하고 있어요!</div>
    {/* 티어 진행 바 + 다음 티어까지 N점 */}
  </div>
  <div>/* 티어 뱃지 (크게) */</div>
</div>
```

### StatCard 개선
- 현재: 단순 수치 표시
- 개선: 전주 대비 변화량 표시 (`+5 이번 주`, `▲ 12%`)
- 아이콘 배경에 색상 gradient 추가

### 오늘의 문제 카드
```
- 더 눈에 띄는 CTA — gradient border, 애니메이션 pulse 효과
- 난이도 + 예상 소요 시간 표시
- "어제 N명이 풀었어요" 같은 social proof
```

### 최근 제출 피드 개선
```
- 각 행에 결과별 아이콘: ✅ 정답 / ❌ 오답 / ⏰ 시간초과
- 언어별 색상 배지 (Python=파란, JS=노란, C++=보라 등)
- "더 보기" 버튼 → /submissions
```

---

## D-4. 문제 목록 페이지 — `ProblemsPage.jsx`

**현재 문제:** 단순 테이블, 검색/필터 UX 불편

**요청:**

### 문제 카드 레이아웃 옵션 추가
```
- 현재: 테이블 형식
- 추가: 카드 그리드 뷰 (2-3열)
- 우측 상단 토글 버튼으로 전환
- localStorage에 선호 뷰 저장
```

### 필터 UX 개선
```
- 현재: 드롭다운 분리됨
- 개선: 필터 칩(chip) 방식 — 선택된 필터가 태그로 표시, X 버튼으로 제거
- "필터 초기화" 버튼
- 결과 수 실시간 표시: "총 142개 문제 중 23개 표시"
```

### 문제 행 hover 개선
```
- hover 시 배경색 전환 + 우측에 "풀기 →" 버튼 등장 (translateX 애니메이션)
- 북마크 토글 버튼을 행 우측에 상시 표시 (북마크됨 = ★ filled)
```

---

## D-5. JudgePage (코드 에디터 페이지) — `JudgePage.jsx`

**현재 문제:** 이미 잘 만들어졌지만 추가 polish 필요

**요청:**

### 상단 헤더 개선
```
- 문제 제목 + 난이도 배지 + 티어 배지 한 줄에
- 우측: 북마크 ★ 버튼 + 공유 버튼 (URL 복사)
- 제출 성공 시: 🎉 confetti 효과 (canvas-confetti 라이브러리)
```

### 제출 결과 패널 개선
```
- 정답: 초록색 배너 + 통과한 테스트케이스 수 + 실행 시간/메모리
- 오답: 빨간 배너 + 실패한 케이스 번호 + 예상 vs 실제 출력 diff
- 타임아웃: 오렌지 배너 + "시간 복잡도를 확인해보세요" 메시지
```

### 패널 레이아웃 리사이즈 핸들
```
- 현재: 고정 비율 (문제 40% / 에디터 60%)
- 개선: 드래그로 패널 크기 조절 가능
- 구현: mousedown → mousemove → mouseup 이벤트로 flexBasis 조절
```

---

## D-6. 요금제 페이지 — `PricingPage.jsx`

**현재:** 기본적인 테이블 비교형

**요청:**

### 인기 플랜 강조 효과
```jsx
// Pro 카드에만 적용
{plan.highlight && (
  <div style={{
    background: 'linear-gradient(135deg, #79c0ff, #d2a8ff)',
    borderRadius: '16px 16px 0 0',
    padding: '8px',
    textAlign: 'center',
    fontSize: 12, fontWeight: 800, color: '#0d1117',
  }}>
    ✨ 가장 인기있는 플랜
  </div>
)}
```

### 연간 결제 할인 배지
```
- 연간 선택 시: "2개월 무료" 뱃지를 Pro 카드 우측 상단에 표시
- 가격 표시: ~~월 9,900원~~ → 연 99,000원 (월 8,250원)
```

### FAQ 섹션 추가
```jsx
const FAQ = [
  { q: '언제든지 구독을 취소할 수 있나요?', a: '네, 언제든지 취소 가능합니다. 취소해도 구독 기간이 끝날 때까지 Pro 기능을 사용할 수 있습니다.' },
  { q: '팀 플랜은 몇 명까지 가능한가요?', a: '팀 플랜은 최대 20명까지 지원합니다.' },
  { q: '학생 할인이 있나요?', a: '학교 이메일(.ac.kr, .edu)로 가입 시 30% 할인을 제공합니다.' },
  { q: '결제 수단은 어떤 것을 지원하나요?', a: '신용카드, 체크카드, 카카오페이를 지원합니다.' },
]
// 아코디언(collapse) UI로 구현
```

---

## D-7. 전역 CSS 개선 — `index.css`

**요청:**

### 애니메이션 유틸리티 추가
```css
/* index.css 하단에 추가 */

/* Fade in up */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up { animation: fadeInUp .4s ease both; }
.animate-delay-1 { animation-delay: .1s; }
.animate-delay-2 { animation-delay: .2s; }
.animate-delay-3 { animation-delay: .3s; }

/* Shimmer skeleton */
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
.skeleton {
  background: var(--shimmer);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite linear;
  border-radius: var(--r);
}

/* Gradient text */
.gradient-text {
  background: linear-gradient(135deg, var(--blue) 0%, var(--purple) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Card hover lift */
.card-hover {
  transition: transform .2s, box-shadow .2s;
}
.card-hover:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.3);
}

/* Glow effect for tier colors */
.glow-blue    { box-shadow: 0 0 20px rgba(121,192,255,.25); }
.glow-gold    { box-shadow: 0 0 20px rgba(255,215,0,.25); }
.glow-diamond { box-shadow: 0 0 20px rgba(185,242,255,.25); }
```

### CSS 변수 추가
```css
:root {
  /* 기존 변수들 유지하고 아래 추가 */
  --gradient-brand: linear-gradient(135deg, #79c0ff 0%, #d2a8ff 100%);
  --gradient-success: linear-gradient(135deg, #56d364 0%, #00e5cc 100%);
  --transition-fast: .15s ease;
  --transition-base: .25s ease;
  --transition-slow: .4s ease;
}
```

---

## D-8. Lucide React 아이콘 시스템 전체 적용

```bash
npm install lucide-react  # dailycoding/ 폴더에서
```

**적용 대상:**
- `TopNav.jsx` — 네비게이션 메뉴 (위 D-2에서 상세 명시)
- `Dashboard.jsx` — StatCard 아이콘 (`TrendingUp`, `CheckCircle`, `Flame`, `Target`)
- `ProblemsPage.jsx` — 필터 아이콘 (`Filter`, `Search`, `Grid`, `List`)
- `JudgePage.jsx` — 툴바 아이콘 (`Bookmark`, `Share2`, `Play`, `Send`)
- `CommunityPage.jsx` — 게시판 아이콘 (`MessageCircle`, `ThumbsUp`, `Bookmark`)

**이모지 → 아이콘 교체 원칙:**
- UI 요소(버튼, 메뉴, 탭)의 이모지는 모두 Lucide 아이콘으로
- 장식용 이모지(랜딩페이지 특성 설명, 배지)는 유지해도 됨

---

---

# 🔴 PART 2 — 보안 취약점 (Critical)

## S-1. SQL Injection 수정 — `routes/community.js`

**문제:** `blockFilter()` / `replyBlockFilter()`가 SQL에 userId를 직접 삽입

**수정:**
```js
// 현재 (위험)
const blockFilter = (userId) => userId
  ? `AND p.user_id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id=${userId})`
  : '';

// 수정 후 — 파라미터 바인딩으로 변경
// blockFilter를 반환값 대신 { clause, params } 객체로 변경
const blockFilter = (userId) => userId
  ? { clause: 'AND p.user_id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id=?)', params: [userId] }
  : { clause: '', params: [] };

// 사용 부분도 함께 업데이트
const bf = blockFilter(userId);
const rows = await query(`SELECT ... WHERE ... ${bf.clause}`, [...otherParams, ...bf.params]);
```

---

## S-2. Socket.io JWT 인증 — `services/socketServer.js`

```js
import jwt from 'jsonwebtoken';

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Unauthorized'));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'dailycoding',
      audience: 'dailycoding-client',
    });
    socket.data.userId = payload.id;
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});
```

---

## S-3. 비밀번호 복잡도 검증 — `middleware/validate.js`

```js
// 기존 Joi 스키마의 password 필드에 추가
password: Joi.string()
  .min(8)
  .pattern(/[A-Z]/, 'uppercase')
  .pattern(/[0-9]/, 'number')
  .pattern(/[!@#$%^&*()_+\-=\[\]{}|;':",.<>?]/, 'special')
  .required()
  .messages({
    'string.pattern.name': '비밀번호에 {{#name}}을(를) 포함해야 합니다',
    'string.min': '비밀번호는 최소 8자 이상이어야 합니다',
  })
```

---

## S-4. 비밀번호 찾기 Rate Limit — `middleware/rateLimit.js` + `routes/auth.js`

```js
// rateLimit.js에 추가
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1시간
  max: 5,
  message: { error: '너무 많은 요청입니다. 1시간 후 다시 시도해주세요.' },
  standardHeaders: true,
});

// auth.js에서 적용
import { forgotPasswordLimiter } from '../middleware/rateLimit.js';
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => { ... });
```

---

---

# 🟠 PART 3 — 코드 품질 & 기능

## Q-1. Ranking 쿼리 최적화 — `models/User.js`

```js
// 신규 메서드 추가 (findAll() 대체)
static async getRanking(limit = 100) {
  return query(
    `SELECT id, username, tier, rating, solved_count, avatar_url,
            equipped_badge, equipped_title
     FROM users
     WHERE banned_at IS NULL AND role != 'admin'
     ORDER BY rating DESC
     LIMIT ?`,
    [limit]
  );
}
```
- `routes/ranking.js`에서 `User.findAll()` → `User.getRanking()` 으로 교체

---

## Q-2. 에러 응답 표준화 — `middleware/errorHandler.js` 신규 생성

```js
// dailycoding-server/src/middleware/errorHandler.js
export const errorResponse = (res, status, code, message) =>
  res.status(status).json({ success: false, error: { code, message } });

export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
};
```
- `auth.js`, `problems.js`, `submissions.js` 3개 라우트부터 먼저 적용

---

## Q-3. 관리자 감사 로그

### Migration SQL 추가
```sql
-- 새 migration 파일 생성
CREATE TABLE admin_logs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  admin_id    INT NOT NULL,
  action      VARCHAR(100) NOT NULL,  -- 'ban_user', 'delete_post', 'clear_cache' 등
  target_type VARCHAR(50),            -- 'user', 'post', 'problem' 등
  target_id   INT,
  detail      JSON,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_id   (admin_id),
  INDEX idx_created_at (created_at)
);
```

### routes/admin.js에서 로그 INSERT
```js
// 모든 변경 작업 후 로그 기록
await insert(
  'INSERT INTO admin_logs (admin_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)',
  [req.user.id, 'ban_user', 'user', targetId, JSON.stringify({ reason })]
);
```

### GET /api/admin/logs 엔드포인트 추가
```
GET /api/admin/logs?page=1&limit=50&action=ban_user
응답: { logs: [...], total: N, page: N }
```

---

## Q-4. 입력 길이 제한 — `middleware/validate.js`

```js
// 기존 스키마에 .max() 추가
title:       Joi.string().max(200),
description: Joi.string().max(50000),
content:     Joi.string().max(10000),  // 커뮤니티
code:        Joi.string().max(100000), // 코드 제출
```

---

## Q-5. 전역 검색 API — `routes/search.js` (신규)

```js
// GET /api/search?q=keyword&type=all|problem|post&limit=10
router.get('/', auth, async (req, res) => {
  const { q, type = 'all', limit = 10 } = req.query;
  const [problems, posts] = await Promise.all([
    type !== 'post' ? query(
      `SELECT id, title, tier, problem_type FROM problems
       WHERE (title LIKE ? OR id IN (SELECT problem_id FROM problem_tags WHERE tag LIKE ?))
       AND visibility = 'public' LIMIT ?`,
      [`%${q}%`, `%${q}%`, Number(limit)]
    ) : [],
    type !== 'problem' ? query(
      `SELECT id, board, title, created_at FROM posts WHERE title LIKE ? LIMIT ?`,
      [`%${q}%`, Number(limit)]
    ) : [],
  ]);
  res.json({ problems, posts, total: problems.length + posts.length });
});
```
- `index.js`에 `import searchRouter` + `app.use('/api/search', auth, searchRouter)` 추가

---

## Q-6. 대회 자동 종료 스케줄러 — `services/scheduler.js` (신규)

```js
import { query, run } from '../config/mysql.js';

export function startScheduler() {
  setInterval(async () => {
    try {
      // 종료 시간이 된 대회 자동 종료
      await run(
        `UPDATE contests SET status = 'ended'
         WHERE status = 'running'
         AND DATE_ADD(started_at, INTERVAL duration_min MINUTE) < NOW()`,
        []
      );
    } catch (e) {
      console.error('[scheduler] contest auto-end error:', e.message);
    }
  }, 60_000); // 1분마다
}
```
- `index.js`에서 서버 시작 후 `startScheduler()` 호출

---

## Q-7. 헬스체크 엔드포인트 강화 — `index.js`

```js
app.get('/api/health', async (req, res) => {
  let dbStatus = 'connected';
  let redisStatus = 'connected';
  try { await query('SELECT 1'); } catch { dbStatus = 'fallback'; }
  try { await redis.ping(); } catch { redisStatus = 'fallback'; }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      redis: redisStatus,
      judge: process.env.JUDGE_MODE || 'auto',
    },
    version: process.env.npm_package_version || '1.0.0',
  });
});
```

---

---

# 📱 PART 4 — 모바일 반응형 개선

현재 대부분의 레이아웃이 모바일 미최적화 상태.

## M-1. 핵심 페이지 모바일 대응

### `TopNav.jsx`
- 모바일 햄버거 메뉴 개선 (현재 기본 구현 있음)
- 메뉴 열릴 때 backdrop overlay 추가
- 터치 영역 최소 44px 확보

### `Dashboard.jsx`
- StatCard 4개를 모바일에서 2×2 그리드로 변경
- `grid-template-columns: repeat(auto-fit, minmax(150px, 1fr))`

### `ProblemsPage.jsx`
- 필터 패널 모바일에서 bottom sheet로 변경 (슬라이드 업 애니메이션)

### `JudgePage.jsx`
- 모바일에서 문제/에디터 탭 전환 방식으로 변경 (좌우 split 불가)
- Monaco Editor는 모바일에서 CodeMirror로 폴백 고려

---

---

# 🚀 PART 5 — 성능 최적화

## P-1. 이미지 최적화
- LandingPage의 img 태그에 `loading="lazy"` + `width/height` 속성 추가
- avatar_url 없을 때 DiceBear API 사용: `https://api.dicebear.com/7.x/initials/svg?seed={username}`

## P-2. React.memo 적용
- `StatCard`, `TierBadge`, `Avatar` 같은 순수 표시 컴포넌트에 `React.memo()` 래핑

## P-3. 코드 스플리팅 확인
- `App.jsx`에서 `React.lazy()` + `Suspense`로 페이지 컴포넌트 lazy load 확인
  (Vite는 자동 스플리팅하지만 명시적으로 dynamic import 사용 권장)

---

---

# 파일 위치 레퍼런스

| 목적 | 경로 |
|------|------|
| 전역 CSS | `dailycoding/src/index.css` |
| 공유 상수 | `dailycoding/src/data/constants.js` |
| 인증 미들웨어 | `dailycoding-server/src/middleware/auth.js` |
| Rate limit | `dailycoding-server/src/middleware/rateLimit.js` |
| Joi 검증 | `dailycoding-server/src/middleware/validate.js` |
| DB 헬퍼 | `dailycoding-server/src/config/mysql.js` |
| Redis 헬퍼 | `dailycoding-server/src/config/redis.js` |
| 서버 진입점 | `dailycoding-server/src/index.js` |
| Socket 서버 | `dailycoding-server/src/services/socketServer.js` |

---

## 구현 우선순위 요약

| 우선순위 | 항목 | 예상 임팩트 |
|---------|------|------------|
| 1순위 | S-1 SQL Injection 수정 | 보안 Critical |
| 2순위 | D-2 TopNav 아이콘 교체 | 시각적 즉각 효과 |
| 3순위 | D-7 CSS 유틸리티 추가 | 전체 디자인 기반 |
| 4순위 | D-1 랜딩 페이지 개편 | 상업적 첫인상 |
| 5순위 | D-3 대시보드 개선 | 핵심 UX |
| 6순위 | S-2 Socket.io 인증 | 보안 High |
| 7순위 | Q-1 Ranking 최적화 | 성능/안정성 |
| 8순위 | Q-3 감사 로그 | 운영 필수 |
| 9순위 | M-1 모바일 반응형 | 사용자 범위 확대 |
| 10순위 | Q-5 전역 검색 | 사용성 |

---

*DailyCoding v2 — 상업적 플랫폼 완성을 위한 Codex 개선 프롬프트*
*생성일: 2026-04-20 | 오늘 완료 사항 반영 완료*
