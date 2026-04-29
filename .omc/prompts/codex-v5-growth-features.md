# DailyCoding — Codex 프롬프트 v5 (성장 전략 기능)
> 작성일: 2026-04-22
> 이전 v2/v3/v4와 중복 없음. 신규 기능 및 전략적 기능만 수록.

---

## 스택 & 규칙 (필수 숙지)

```
Frontend: React 18 + Vite, ESM, TypeScript 없음
Backend:  Express.js + MySQL + Redis, ESM (import/export만, require 금지)
디자인:   CSS 변수 기반 (--bg, --blue, --green, --purple, --yellow, --accent, --glass-bg, --border)
          Space Mono (코드/숫자) + Noto Sans KR (UI)
배포:     VPS — Nginx + PM2 + Docker Compose
```

**절대 규칙:**
- `import`/`export`만 — `require()` 금지
- DB는 `query()`, `queryOne()`, `insert()`, `run()` 헬퍼만
- 유저 데이터는 반드시 `User.safe()` 통과
- Admin role은 DB 재확인 — JWT 클레임 신뢰 금지
- 외부 라이브러리 추가 금지 (lucide-react, @monaco-editor/react는 이미 있음)
- 차트는 CSS width% 방식만 — chart.js, recharts 등 추가 금지

---

## 🟣 FEATURE-01 — 온보딩 플로우 (가입 후 첫 7일 경험)

```
Context:
- 현재: 가입 후 바로 Dashboard로 이동 → 빈 상태, 무엇을 해야 할지 불명확
- 목표: 취준생이 가입 후 5분 안에 "이게 나한테 맞다"는 aha moment 경험
- Aha moment 기준: 첫 문제 정답 → AI 피드백 확인 → 다음 추천 문제 제시

Backend:
1. mysql.js 테이블 추가:
   CREATE TABLE IF NOT EXISTS user_onboarding (
     user_id INT PRIMARY KEY,
     step VARCHAR(50) NOT NULL DEFAULT 'select_goal',
     goal ENUM('job_hunting','skill_up','interview_prep','fun') NULL,
     target_company VARCHAR(100) NULL,
     experience_level ENUM('beginner','intermediate','advanced') NULL,
     completed_at TIMESTAMP NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   );

2. routes/auth.js 또는 새 routes/onboarding.js:
   GET /api/onboarding — auth 필요
   - SELECT * FROM user_onboarding WHERE user_id=?
   - 없으면 insert 후 반환 (step='select_goal')
   - 완료(completed_at IS NOT NULL)면 { completed: true }

   PATCH /api/onboarding — auth 필요
   - body: { step, goal?, targetCompany?, experienceLevel? }
   - UPDATE user_onboarding SET ... WHERE user_id=?
   - step이 'done'이면 completed_at=NOW() 설정

3. 문제 추천 최적화: routes/problems.js recommend 엔드포인트
   - experienceLevel 고려:
     beginner: difficulty 1-4
     intermediate: difficulty 4-7
     advanced: difficulty 7-10

Frontend:
4. OnboardingModal 컴포넌트 — src/components/OnboardingModal.jsx 신규:
   가입 직후(또는 onboarding.completed=false인 경우) 자동 표시
   - fullscreen 오버레이, 닫기 버튼 없음 (완료해야 닫힘)
   - 3단계 wizard:

   Step 1 — 목표 선택:
   <div style={{ textAlign:'center', padding:'60px 40px' }}>
     <h2>DailyCoding에 온 이유가 뭐예요?</h2>
     <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:24 }}>
       {[
         { id:'job_hunting',     label:'코테 합격', emoji:'🎯', desc:'취업/이직 준비 중' },
         { id:'skill_up',        label:'실력 향상', emoji:'📈', desc:'알고리즘 실력 키우기' },
         { id:'interview_prep',  label:'면접 준비', emoji:'💼', desc:'기술 면접 대비' },
         { id:'fun',             label:'그냥 재미', emoji:'🎮', desc:'꾸준히 즐기면서' },
       ].map(g => (
         <button key={g.id} onClick={() => setGoal(g.id)}
           style={{ padding:'20px', borderRadius:12, border:`2px solid ${goal===g.id ? 'var(--blue)' : 'var(--border)'}`,
                    background: goal===g.id ? 'var(--blue)11' : 'var(--bg2)', cursor:'pointer' }}>
           <div style={{ fontSize:32 }}>{g.emoji}</div>
           <div style={{ fontWeight:700, marginTop:8 }}>{g.label}</div>
           <div style={{ color:'var(--text3)', fontSize:13 }}>{g.desc}</div>
         </button>
       ))}
     </div>
   </div>

   Step 2 — 실력 수준:
   beginner / intermediate / advanced 3개 카드
   각 카드: "예: 버블 정렬은 알아요" 같은 체감 설명 포함

   Step 3 — 타겟 회사 (선택사항):
   input text: "어느 회사 코테 준비하고 있어요? (선택사항)"
   placeholder: "카카오, 네이버, 라인, 토스 ..."
   → 입력하면 저장, 스킵 가능

   완료 후:
   - PATCH /api/onboarding { step:'done', ... } 호출
   - 모달 닫히고 /problems?recommended=true 로 이동
   - 첫 추천 문제 배너 표시: "당신 수준에 맞는 첫 문제를 준비했어요 →"

5. AuthContext.jsx 또는 App.jsx:
   로그인 후 GET /api/onboarding 호출
   completed=false이면 OnboardingModal 표시

주의:
- 모달은 React portal로 document.body에 렌더
- wizard 상태는 로컬 state (서버 저장은 마지막 단계에만)
- 온보딩 완료 유저에게는 절대 다시 표시하지 않음
```

---

## 🟣 FEATURE-02 — 승급전 시스템

```
Context:
- 현재: rating 점수가 TIER_THRESHOLDS를 넘으면 자동 티어 승급
- 추가: 승급 자격 달성 후 "승급전" 진입 → 3판 2선승제로 확정
- 목적: 티어 상승에 의례(ritual)를 만들어 재방문/긴장감 유발

Backend:
1. mysql.js 테이블 추가:
   CREATE TABLE IF NOT EXISTS promotion_series (
     id INT AUTO_INCREMENT PRIMARY KEY,
     user_id INT NOT NULL,
     from_tier VARCHAR(20) NOT NULL,
     to_tier VARCHAR(20) NOT NULL,
     wins INT NOT NULL DEFAULT 0,
     losses INT NOT NULL DEFAULT 0,
     status ENUM('in_progress','promoted','failed') NOT NULL DEFAULT 'in_progress',
     expires_at TIMESTAMP NOT NULL,  -- 7일 후 만료
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     UNIQUE KEY unique_active (user_id, status),  -- in_progress는 1개만
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   );

2. dailycoding-server/src/shared/constants.js에 추가:
   export const PROMOTION_WINS_REQUIRED = 3;
   export const PROMOTION_LOSSES_ALLOWED = 2;  // 2패 시 실패
   export const PROMOTION_SERIES_DAYS = 7;

3. models/User.js의 onSolve() 또는 rating 재계산 후:
   - 새 tier != 이전 tier 이면:
     a) 현재 in_progress 승급전 있으면: wins + 1 업데이트
        wins >= PROMOTION_WINS_REQUIRED → status='promoted', 실제 티어 승급
     b) 승급전 없으면: promotion_series INSERT (from_tier=현재, to_tier=다음)
        expires_at = NOW() + 7일

   - 배틀 패배 시 (battle_results에서 패배 감지):
     현재 in_progress 승급전 있으면: losses + 1
     losses > PROMOTION_LOSSES_ALLOWED → status='failed'
     실패해도 티어는 유지 (강등 없음 — 취준생 사기 고려)

4. GET /api/promotion — auth 필요:
   SELECT * FROM promotion_series WHERE user_id=? AND status='in_progress' LIMIT 1
   만료된 것은 status='failed'로 업데이트 후 반환

Frontend:
5. Dashboard.jsx 또는 TopNav 배너:
   승급전 진행 중이면 눈에 띄는 배너:

   <div style={{
     background:'linear-gradient(135deg, var(--gold, #ffd700)22, var(--bg2))',
     border:'2px solid var(--gold, #ffd700)',
     borderRadius:12, padding:'14px 20px',
     display:'flex', alignItems:'center', gap:16, marginBottom:16
   }}>
     <span style={{ fontSize:28 }}>⚔️</span>
     <div>
       <div style={{ fontWeight:800, color:'var(--gold, #ffd700)' }}>승급전 진행중</div>
       <div style={{ color:'var(--text2)', fontSize:13 }}>
         {fromTier} → {toTier} | {wins}승 {losses}패 (3승 2패제)
       </div>
     </div>
     <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
       {Array(3).fill(0).map((_, i) => (
         <div key={i} style={{
           width:16, height:16, borderRadius:'50%',
           background: i < wins ? 'var(--green)' : 'var(--bg3)',
           border:'2px solid var(--border)'
         }} />
       ))}
     </div>
   </div>

6. 승급 성공 시 축하 모달:
   <div style={{ textAlign:'center', padding:40 }}>
     <div style={{ fontSize:72 }}>🎉</div>
     <h2>{toTier} 달성!</h2>
     <p style={{ color:'var(--text2)' }}>승급전 {wins}승으로 {fromTier}에서 {toTier}로 승급했습니다</p>
     <button className="btn btn-primary" onClick={() => navigate('/ranking')}>랭킹 확인하기</button>
   </div>

주의:
- 배틀 없이 문제 풀이만으로도 wins 카운트 가능 (진입 장벽 낮게)
- from_tier → to_tier 문자열은 shared/constants.js의 TIER_ORDER 사용
- expires_at 만료 체크는 cron 또는 API 호출 시 lazy update
```

---

## 🟣 FEATURE-03 — 모의 코테 모드 (Pro 전환 킬러)

```
Context:
- 현재: 개별 문제 풀이 + 대회(contest) 기능 있음
- 추가: "실전 코테 모드" — 실제 기업 코테 시뮬레이션
- 타겟: 취준생이 Pro 결제하는 가장 강력한 이유

Goal:
- 시간 제한(120분), 문제 2-3개, 실전 환경 시뮬레이션
- 기업별/유형별 큐레이션 세트 (무료: 일반 세트, Pro: 기업 특화 세트)

Backend:
1. mysql.js 테이블 추가:
   CREATE TABLE IF NOT EXISTS exam_sets (
     id INT AUTO_INCREMENT PRIMARY KEY,
     title VARCHAR(200) NOT NULL,
     description TEXT,
     duration_min INT NOT NULL DEFAULT 120,
     problem_ids JSON NOT NULL,  -- [1, 5, 12] 형태
     difficulty_avg DECIMAL(3,1),
     tier_required VARCHAR(20) NULL,  -- NULL이면 모두 가능
     is_pro TINYINT(1) DEFAULT 0,  -- 1이면 Pro 전용
     company_tag VARCHAR(50) NULL,  -- 'kakao', 'naver', 'line', 'toss' 등
     play_count INT DEFAULT 0,
     created_by INT NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     INDEX idx_company (company_tag),
     INDEX idx_pro (is_pro)
   );

   CREATE TABLE IF NOT EXISTS exam_attempts (
     id INT AUTO_INCREMENT PRIMARY KEY,
     user_id INT NOT NULL,
     exam_set_id INT NOT NULL,
     started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     finished_at TIMESTAMP NULL,
     time_used_sec INT NULL,
     score INT DEFAULT 0,  -- 통과 문제 수 기반
     status ENUM('in_progress','completed','abandoned') DEFAULT 'in_progress',
     answers JSON NULL,  -- { problemId: { code, result, timeMs } }
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
     FOREIGN KEY (exam_set_id) REFERENCES exam_sets(id),
     INDEX idx_user_set (user_id, exam_set_id)
   );

2. routes/exams.js 신규 파일:
   GET /api/exams — auth 필요
   - is_pro=0인 세트는 전체 반환
   - is_pro=1인 세트는 subscription_tier != 'free'인 유저만 제목/설명 반환 (상세 잠금)
   - 쿼리 파라미터: ?company=kakao&page=1&limit=10

   GET /api/exams/:id — auth 필요
   - is_pro=1이고 free 유저면: 403 + { code:'PRO_REQUIRED', message:'Pro 플랜 이상 필요합니다' }
   - 문제 목록 + 시간 제한 반환 (실제 문제 내용은 시험 시작 후에만)

   POST /api/exams/:id/start — auth 필요
   - 이미 in_progress 시도 있으면 기존 반환
   - exam_attempts INSERT
   - { attemptId, startedAt, durationMin, problems: [{ id, title, tier }] } 반환
   - 실제 문제 내용(지문, 테스트케이스)은 이 시점에 반환

   POST /api/exams/:id/submit — auth 필요
   - body: { attemptId, answers: { [problemId]: { code, lang } } }
   - 각 답안을 judge 서비스로 실행 (기존 judge.js 재사용)
   - score = 통과한 문제 수
   - exam_attempts UPDATE (status='completed', finished_at, score, time_used_sec)
   - 결과: { score, totalProblems, timeUsed, breakdown: [{ problemId, result, timeMs }] }

   GET /api/exams/:id/history — auth 필요
   - 내 이전 시도 목록 (최근 10개)

   POST /api/exams (adminOnly) — 시험 세트 생성

3. index.js에 등록:
   import examsRouter from './routes/exams.js';
   app.use('/api/exams', examsRouter);

Frontend:
4. ExamPage.jsx 신규 파일 — src/pages/ExamPage.jsx:
   라우팅: /exams/:id

   시험 진행 화면:
   - 상단: 카운트다운 타이머 (120:00 → 빨간색으로 전환 when < 10분)
   - 좌측: 문제 선택 탭 (문제1 / 문제2 / 문제3)
   - 중앙: 문제 설명 패널 (JudgePage 레이아웃 재사용)
   - 우측: Monaco 에디터 (기존 JudgePage의 Editor lazy import 패턴)
   - 하단: [임시저장] [전체 제출]

   타이머 구현:
   const [timeLeft, setTimeLeft] = useState(durationMin * 60);
   useEffect(() => {
     const id = setInterval(() => setTimeLeft(t => {
       if (t <= 0) { handleForceSubmit(); return 0; }
       return t - 1;
     }), 1000);
     return () => clearInterval(id);
   }, []);

   시험 목록 화면 (/exams):
   - 회사별 필터 탭: 전체 / 카카오 / 네이버 / 라인 / 토스
   - 각 세트 카드:
     <div style={{ border:'1px solid var(--border)', borderRadius:12, padding:20 }}>
       {isPro && userTier==='free' && (
         <span style={{ background:'var(--purple)', color:'#fff', fontSize:11,
                        padding:'2px 8px', borderRadius:4 }}>PRO</span>
       )}
       <h3>{title}</h3>
       <div style={{ color:'var(--text3)', fontSize:13 }}>
         {durationMin}분 · 문제 {problemCount}개 · 평균 난이도 {difficultyAvg}
       </div>
       <div style={{ marginTop:8, color:'var(--text3)', fontSize:12 }}>
         도전 {playCount}회
       </div>
       <button className="btn btn-primary" style={{ marginTop:16, width:'100%' }}>
         {isPro && userTier==='free' ? '🔒 Pro 전용' : '시작하기'}
       </button>
     </div>

5. App.jsx에 라우트 추가:
   <Route path="/exams" element={<PrivateRoute><ExamListPage /></PrivateRoute>} />
   <Route path="/exams/:id" element={<PrivateRoute><ExamPage /></PrivateRoute>} />

6. TopNav.jsx에 메뉴 추가:
   { path:'/exams', label:'모의 코테', icon: <Trophy size={16} /> }

초기 시험 세트 시드 데이터 (mysql.js seedData):
   INSERT IGNORE INTO exam_sets (title, description, duration_min, problem_ids, is_pro, company_tag, created_by) VALUES
   ('일반 코테 연습 A', '기초 알고리즘 2문제 · 80분', 80, '[1,2]', 0, NULL, 1),
   ('카카오 스타일 모의고사', '카카오 코테 유형 분석 세트', 120, '[3,7,12]', 1, 'kakao', 1),
   ('네이버 스타일 모의고사', '네이버 코테 유형 분석 세트', 120, '[4,8,15]', 1, 'naver', 1);
   (실제 problem_ids는 DB에 존재하는 ID로 변경)

주의:
- Pro 게이팅은 subscription_tier 체크 — JWT 클레임 신뢰 금지, DB에서 확인
- judge 실행은 기존 judge.js 재사용 — 새 judge 로직 작성 금지
- 타이머는 서버 started_at 기준 (클라이언트 타이머는 표시용만, 검증은 서버)
- ESM only
```

---

## 🟣 FEATURE-04 — 친구 초대 바이럴 루프

```
Context:
- 현재: 초대 기능 없음
- 목표: 가입 → 친구 초대 → 배틀 → 초대한 사람 Pro 1주 무료
- 취준생 타겟: 스터디 그룹, 오픈채팅 공유가 주 채널

Backend:
1. mysql.js 테이블 추가:
   CREATE TABLE IF NOT EXISTS referrals (
     id INT AUTO_INCREMENT PRIMARY KEY,
     referrer_id INT NOT NULL,
     referred_user_id INT NULL,  -- 가입 후 연결
     referral_code VARCHAR(12) NOT NULL UNIQUE,
     status ENUM('pending','signed_up','rewarded') DEFAULT 'pending',
     reward_granted_at TIMESTAMP NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     INDEX idx_referrer (referrer_id),
     INDEX idx_code (referral_code),
     FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE
   );

2. routes/referral.js 신규 파일:
   GET /api/referral/my-code — auth 필요
   - 내 referral_code 조회 or 생성
   - code 없으면: crypto.randomBytes(6).toString('hex') 로 12자리 생성
   - INSERT IGNORE INTO referrals (referrer_id, referral_code) VALUES (?, ?)
   - 응답: { code, inviteUrl: `${FRONTEND_URL}/join?ref=${code}`, totalReferrals, rewardedCount }

   GET /api/referral/stats — auth 필요
   - 내가 초대한 사람 수, 보상 받은 수 조회

   POST /api/auth/register (기존 라우트 수정):
   - body에 referralCode가 있으면:
     a) referrals WHERE referral_code=? 조회
     b) 있으면 referred_user_id=신규 유저 id, status='signed_up' 업데이트

   POST /api/referral/claim-reward — auth 내부 호출 또는 자동 트리거:
   - 초대된 유저가 첫 배틀 완료 또는 첫 정답 제출 시 자동 호출
   - referrals WHERE referred_user_id=? AND status='signed_up' 조회
   - referrer에게 Pro 7일 무료 지급:
     UPDATE users SET
       subscription_tier='pro',
       subscription_expires_at = GREATEST(COALESCE(subscription_expires_at, NOW()), NOW()) + INTERVAL 7 DAY
     WHERE id=?
   - status='rewarded', reward_granted_at=NOW() 업데이트
   - Notification.create(referrerId, '친구가 첫 문제를 풀었습니다! Pro 7일이 추가되었습니다.')

3. index.js에 등록:
   import referralRouter from './routes/referral.js';
   app.use('/api/referral', referralRouter);

4. 가입 페이지 처리 (기존 RegisterPage.jsx 또는 main.jsx):
   URL에 ?ref=CODE 있으면 localStorage.setItem('referralCode', CODE)
   가입 폼 submit 시 body에 referralCode 포함

Frontend:
5. Dashboard.jsx에 초대 카드 추가:
   <div style={{ border:'1px solid var(--border)', borderRadius:12, padding:20, marginBottom:16 }}>
     <h3>👥 친구 초대하고 Pro 받기</h3>
     <p style={{ color:'var(--text2)', fontSize:14 }}>
       친구가 가입 후 첫 문제를 풀면 <strong style={{ color:'var(--blue)' }}>Pro 7일</strong>이 추가됩니다
     </p>
     <div style={{ display:'flex', gap:8, marginTop:12 }}>
       <input
         readOnly value={inviteUrl}
         style={{ flex:1, background:'var(--bg3)', border:'1px solid var(--border)',
                  borderRadius:8, padding:'8px 12px', color:'var(--text)', fontSize:13 }}
       />
       <button className="btn btn-primary" onClick={() => {
         navigator.clipboard.writeText(inviteUrl);
         setCopied(true); setTimeout(() => setCopied(false), 2000);
       }}>
         {copied ? '✓ 복사됨' : '복사'}
       </button>
     </div>
     <div style={{ color:'var(--text3)', fontSize:12, marginTop:8 }}>
       초대 {totalReferrals}명 | 보상 {rewardedCount}회 받음
     </div>
   </div>

주의:
- referral_code는 server-side 생성 (클라이언트 생성 금지)
- subscription 업데이트는 반드시 User.updateSubscription() 사용 — User.update() 금지
- GREATEST() 로직: 이미 Pro 구독 중이면 만료일에 7일 추가, 아니면 지금부터 7일
- ESM only, DB 헬퍼 사용
```

---

## 🟣 FEATURE-05 — 개발형 코딩 테스트 모드 (신규 카테고리)

```
Context:
- 최근 코테 트렌드: 알고리즘만 아니라 "실제 기능 구현"형 문제 증가
  예: "로그인 API를 구현하세요", "게시판 CRUD를 완성하세요", "주어진 DB 스키마에 쿼리 작성"
- 현재 DailyCoding: 알고리즘 문제 + judge만 있음
- 추가: problem_type='build' 카테고리로 구현형 문제 지원

문제 유형 정의:
- Type A: 빈칸 채우기 (코드 스니펫 제공 → 핵심 로직만 구현)
  예: Express 라우터 뼈대 제공 → body validation + DB insert 로직 구현
- Type B: 명세 구현 (API 스펙 제공 → 전체 함수 구현)
  예: "이 함수가 주어진 input → output을 만족하도록 완성하세요"
- Type C: SQL 쿼리 작성 (스키마 제공 → SELECT/JOIN 쿼리 작성)

Backend:
1. 기존 problems 테이블에 problem_type 컬럼 이미 존재 (CLAUDE.md 확인됨)
   problem_type='build'를 신규 지원 타입으로 추가

2. mysql.js에 build 문제 전용 메타 테이블:
   CREATE TABLE IF NOT EXISTS build_problems (
     problem_id INT PRIMARY KEY,
     build_type ENUM('snippet','spec','sql') NOT NULL,
     starter_code TEXT,         -- 제공되는 뼈대 코드
     test_type ENUM('unit','integration','output_match') DEFAULT 'output_match',
     setup_code TEXT NULL,      -- SQL의 경우 CREATE TABLE 등 환경 설정
     expected_schema TEXT NULL, -- 응답 구조 검증용 JSON schema
     FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
   );

3. services/judge.js 또는 새 services/buildJudge.js:
   Type C (SQL) judge 추가:
   - setup_code로 임시 DB 환경 구성
   - 유저 쿼리 실행
   - expected output과 비교
   - SQLite를 인메모리로 사용 (MySQL 도커 연결 불필요):
     import Database from 'better-sqlite3';  -- 주의: 패키지 설치 필요 확인
     → 이미 있는 경우만, 없으면 output_match 방식으로 대체

   Type A/B (코드 구현):
   - 기존 judge.js의 native-subprocess 방식 재사용
   - starter_code를 prepend하고 유저 코드를 append 또는 특정 위치에 삽입
   - // YOUR CODE HERE 마커 위치에 유저 코드 삽입:
     const fullCode = starterCode.replace('// YOUR CODE HERE', userCode);

4. routes/problems.js GET /:id:
   problem_type='build'이면 build_problems JOIN해서 starter_code 포함 반환

Frontend:
5. JudgePage.jsx 수정 (problem_type='build'인 경우):
   - 에디터 초기값: problem.starterCode (기존 빈 에디터 대신)
   - "제공된 코드" 영역 표시:
     <div style={{ background:'var(--bg3)', padding:'12px 16px', borderRadius:8,
                   borderLeft:'3px solid var(--blue)', marginBottom:12 }}>
       <div style={{ color:'var(--text3)', fontSize:12, marginBottom:4 }}>뼈대 코드 (수정 불가 영역)</div>
       <Editor value={starterCode} options={{ readOnly:true }} height="120px" />
     </div>

   - SQL 타입인 경우: 언어 선택 드롭다운에서 'sql' 옵션 표시
   - 테이블 스키마 패널 (setup_code에서 파싱):
     "테이블 구조" 탭 추가 → CREATE TABLE 내용을 read-only로 표시

6. ProblemsPage.jsx 필터:
   problem_type 필터에 '구현형' 옵션 추가

초기 시드 문제 예시 (CLAUDE.md의 problemCatalog.js에 추가):
   {
     title: '사용자 검색 API 구현',
     problem_type: 'build',
     description: 'Express 라우터에서 username으로 사용자를 검색하는 API를 완성하세요.',
     starter_code: `// GET /api/users/search?q=keyword\nrouter.get('/search', async (req, res) => {\n  const { q } = req.query;\n  // YOUR CODE HERE\n  // users 배열에서 username이 q를 포함하는 항목 반환\n  // res.json({ users: [...], total: N }) 형식으로 응답\n});`,
     build_type: 'snippet',
     tier: 'silver',
     difficulty: 4,
   }

주의:
- better-sqlite3 패키지는 설치 전 package.json 확인 필수
  없으면 SQL 타입은 Phase 2로 미루고 snippet/spec 타입만 먼저 구현
- starter_code는 SKIP_SANITIZE_KEYS에 이미 포함된 필드만 사용
  (code, sourceCode 등 — 새 필드 추가 시 index.js SKIP_SANITIZE_KEYS에도 추가)
- 기존 알고리즘 문제 동작 변화 없음 — build 타입만 분기 처리
```

---

## 실행 우선순위

```
1단계 (리텐션 핵심):  FEATURE-01 (온보딩) → FEATURE-02 (승급전)
2단계 (수익화):       FEATURE-03 (모의 코테) → FEATURE-04 (초대 루프)
3단계 (차별화):       FEATURE-05 (개발형 코테)
```

## 기존 프롬프트와 연계

| 파일 | 커버 영역 |
|------|-----------|
| codex-improvement-prompt-v2.md | 디자인(D), 보안(S), 품질(Q) |
| autopilot/codex-prompts.md | 성능(N+1), 기능(V3 시리즈) |
| codex-v4-audit-gaps.md | 보안위생, CI, 파일분해, 일일미션, 배틀히스토리 |
| **이 파일(v5)** | 온보딩, 승급전, 모의코테, 바이럴루프, 개발형코테 |
