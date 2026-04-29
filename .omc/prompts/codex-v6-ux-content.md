# DailyCoding — Codex 프롬프트 v6 (UX·콘텐츠·설정 개선)
> 작성일: 2026-04-22
> 이미지 자산 확인 완료 — 루트 폴더에 tier 이미지 + 배경 이미지 있음

---

## 스택 & 규칙 (필수 숙지)

```
Frontend: React 18 + Vite, ESM, TypeScript 없음
Backend:  Express.js + MySQL + Redis, ESM
이미지:   Vite 정적 자산 → dailycoding/public/ 폴더에 배치하면 /파일명으로 접근
CSS:      CSS 변수 기반 (--bg, --bg2, --bg3, --blue, --green, --border, --text, --text2, --text3)
```

---

## 🟣 UX-01 — 이미지 자산 배치 (다른 모든 작업 전에 먼저 실행)

```
Context:
- 루트 폴더(/Users/choi/Desktop/dailycoding-final/)에 이미지 파일들이 있음
- Vite에서 정적 이미지는 dailycoding/public/ 하위에 있어야 /경로로 접근 가능

Task:
1. 아래 디렉토리 생성:
   dailycoding/public/tiers/
   dailycoding/public/backgrounds/

2. 티어 이미지 복사 (루트 → public/tiers/):
   - iron.webp → dailycoding/public/tiers/iron.webp
   - bronze.webp → dailycoding/public/tiers/bronze.webp
   - silver.webp → dailycoding/public/tiers/silver.webp
   - gold.webp → dailycoding/public/tiers/gold.webp
   - " emerald.webp" → dailycoding/public/tiers/emerald.webp  (주의: 원본 파일명에 공백 있음)
   - master.webp → dailycoding/public/tiers/master.webp
   - grandmaster.webp → dailycoding/public/tiers/grandmaster.webp
   - challenger.webp → dailycoding/public/tiers/challenger.webp
   - unrank.webp → dailycoding/public/tiers/unrank.webp

3. 배경 이미지 복사:
   - background4.jpg → dailycoding/public/backgrounds/bg-default.jpg

4. 코드에서 티어 이미지 사용 헬퍼 (dailycoding/src/utils/tierImage.js 신규):
   export function getTierImageUrl(tier) {
     const map = {
       unranked: '/tiers/unrank.webp',
       iron:       '/tiers/iron.webp',
       bronze:     '/tiers/bronze.webp',
       silver:     '/tiers/silver.webp',
       gold:       '/tiers/gold.webp',
       emerald:    '/tiers/emerald.webp',
       platinum:   '/tiers/emerald.webp',  // emerald로 대체 (없으면)
       master:     '/tiers/master.webp',
       grandmaster:'/tiers/grandmaster.webp',
       challenger: '/tiers/challenger.webp',
     };
     return map[tier?.toLowerCase()] || '/tiers/unrank.webp';
   }

   export const TIER_COLORS = {
     unranked:    '#888',
     iron:        '#a8a8a8',
     bronze:      '#cd7f32',
     silver:      '#c0c0c0',
     gold:        '#ffd700',
     emerald:     '/tiers/emerald.webp',
     platinum:    '#00e5cc',
     master:      '#9b59b6',
     grandmaster: '#e74c3c',
     challenger:  '#f39c12',
   };

5. 기존 TierBadge 컴포넌트 또는 티어 표시 위치 찾아서
   이모지/텍스트 대신 <img> 태그로 교체:
   <img
     src={getTierImageUrl(tier)}
     alt={tier}
     style={{ width:32, height:32, objectFit:'contain' }}
   />

주의:
- cp 명령어로 파일 복사 (이미 존재하면 덮어씀)
- emerald 원본 파일명에 앞 공백 있으므로 cp " emerald.webp" 형식으로 처리
- 루트 경로 기준: /Users/choi/Desktop/dailycoding-final/
```

---

## 🟣 UX-02 — 3가지 테마 모드 (다크/라이트/시스템)

```
Context:
- 현재: ThemeContext.jsx에 다크/라이트 2가지 모드 있음
- 추가: "시스템 설정 따르기" 3번째 모드
- Reporch 참고: 설정 화면에서 다크/라이트/시스템(현재사용자모드) 선택

Task:
1. dailycoding/src/context/ThemeContext.jsx 수정:
   - 현재 theme state: 'dark' | 'light'
   - 변경 후: 'dark' | 'light' | 'system'
   - localStorage key: 'dc_theme' (기존 유지)

   system 모드 처리:
   const getEffectiveTheme = (theme) => {
     if (theme === 'system') {
       return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
     }
     return theme;
   };

   시스템 변경 감지:
   useEffect(() => {
     if (theme !== 'system') return;
     const mq = window.matchMedia('(prefers-color-scheme: dark)');
     const handler = () => setEffectiveTheme(mq.matches ? 'dark' : 'light');
     mq.addEventListener('change', handler);
     return () => mq.removeEventListener('change', handler);
   }, [theme]);

   document에 data-theme 적용: effectiveTheme 기준 ('dark' | 'light')

2. 테마 선택 UI (설정 페이지에서 — UX-04 참고):
   3개 버튼 그리드:
   [🌙 다크모드] [☀️ 라이트모드] [💻 시스템 설정]
   선택된 것 하이라이트 (border: 2px solid var(--blue))

주의:
- 기존 ThemeContext 구독 컴포넌트들은 effectiveTheme 값을 사용하므로 API 변경 최소화
- localStorage에는 'system' 그대로 저장, 실제 적용은 effectiveTheme
```

---

## 🟣 UX-03 — 언어 변경 기능 (한국어/English)

```
Context:
- 현재: 한국어 고정
- 추가: 한국어 / English 전환 (전체 번역이 아닌 UI 주요 텍스트만)

Task:
1. dailycoding/src/context/LangContext.jsx 신규:
   import { createContext, useContext, useState } from 'react';

   const LangContext = createContext();

   const STRINGS = {
     ko: {
       problems: '문제', ranking: '랭킹', community: '커뮤니티',
       battle: '배틀', settings: '설정', logout: '로그아웃',
       profile: '프로필', mypage: '마이페이지', exams: '모의 코테',
       subscribe: '구독 관리', darkMode: '다크 모드', lightMode: '라이트 모드',
       systemMode: '시스템 설정', save: '저장', cancel: '취소',
       tier: '티어', solved: '해결', rating: '레이팅',
       streak: '연속 풀이', today: '오늘', week: '이번 주',
     },
     en: {
       problems: 'Problems', ranking: 'Ranking', community: 'Community',
       battle: 'Battle', settings: 'Settings', logout: 'Logout',
       profile: 'Profile', mypage: 'My Page', exams: 'Mock Exam',
       subscribe: 'Subscription', darkMode: 'Dark Mode', lightMode: 'Light Mode',
       systemMode: 'System', save: 'Save', cancel: 'Cancel',
       tier: 'Tier', solved: 'Solved', rating: 'Rating',
       streak: 'Streak', today: 'Today', week: 'This Week',
     },
   };

   export function LangProvider({ children }) {
     const [lang, setLang] = useState(() => localStorage.getItem('dc_lang') || 'ko');
     const t = (key) => STRINGS[lang]?.[key] || STRINGS.ko[key] || key;
     const toggleLang = () => {
       const next = lang === 'ko' ? 'en' : 'ko';
       setLang(next);
       localStorage.setItem('dc_lang', next);
     };
     return <LangContext.Provider value={{ lang, t, toggleLang }}>{children}</LangContext.Provider>;
   }

   export const useLang = () => useContext(LangContext);

2. main.jsx 또는 App.jsx에서 LangProvider로 감싸기

3. TopNav.jsx에서 언어 전환 버튼 추가 (우측 상단):
   const { lang, toggleLang } = useLang();
   <button onClick={toggleLang}
     style={{ background:'none', border:'1px solid var(--border)', borderRadius:6,
              padding:'4px 10px', color:'var(--text2)', fontSize:12, cursor:'pointer' }}>
     {lang === 'ko' ? 'EN' : 'KO'}
   </button>

4. TopNav의 주요 레이블에 t() 적용:
   const { t } = useLang();
   // 예: label:'문제' → label: t('problems')

주의:
- 전체 번역 불필요 — 네비게이션, 공통 버튼, 설정 레이블 정도만
- 페이지 내 콘텐츠(문제 설명, 커뮤니티 글)는 번역 대상 아님
```

---

## 🟣 UX-04 — 설정 페이지 TopNav 이동 + UX 개선

```
Context:
- 현재 문제:
  1. 설정이 프로필 페이지 안에 있음 → 찾기 어려움
  2. 설정 저장 버튼이 상단에 있음 → 직관적이지 않음
  3. 구독 관리가 설정 안에 있음 → 결제와 설정은 별개
- 목표: 설정 → 독립 페이지 + TopNav 탭

Task:
1. src/pages/SettingsPage.jsx 신규 파일 (또는 기존 있으면 리팩터):
   탭 구조:
   - 계정 (이메일, 비밀번호 변경, 프로필 이미지)
   - 화면 (테마, 언어)
   - 알림 (이메일 알림 on/off)
   - 개인정보 (계정 삭제)

   저장 버튼 위치: 각 섹션 하단 or 페이지 최하단 고정
   <div style={{ position:'sticky', bottom:0, background:'var(--bg)', padding:'16px 0',
                 borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end' }}>
     <button className="btn btn-primary">저장</button>
   </div>

2. App.jsx 라우트 추가:
   <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />

3. TopNav.jsx에 설정 아이콘 추가 (우측 유저 아바타 옆):
   import { Settings } from 'lucide-react';
   <Link to="/settings">
     <Settings size={18} style={{ color:'var(--text2)' }} />
   </Link>

4. 구독 관리 분리:
   - 현재 설정에 있는 구독/결제 관련 UI → /pricing 또는 /subscription 페이지로 이동
   - 설정 페이지에서는 현재 플랜 표시 + "플랜 변경하기 →" 링크만:
     <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
       <span>현재 플랜: <strong>{subscriptionTier}</strong></span>
       <Link to="/pricing" className="btn btn-ghost" style={{ fontSize:13 }}>플랜 변경 →</Link>
     </div>

5. 기존 ProfilePage에서 설정 섹션 제거, 대신 링크:
   <Link to="/settings">⚙️ 설정으로 이동</Link>

주의:
- 기존 설정 저장 API 로직은 그대로 유지, UI 위치만 변경
- PrivateRoute 필수
```

---

## 🟣 UX-05 — 프로필 배경 꾸미기 + 아바타 이미지 업로드

```
Context:
- 현재: 아바타는 이모지만 선택 가능, 프로필 배경 없음
- 추가:
  1. 프로필 커버 배경 (기본 제공 + 대회 보상)
  2. 아바타 이미지 직접 업로드

Backend:
1. mysql.js 테이블 추가:
   CREATE TABLE IF NOT EXISTS profile_backgrounds (
     id INT AUTO_INCREMENT PRIMARY KEY,
     slug VARCHAR(50) NOT NULL UNIQUE,
     name VARCHAR(100) NOT NULL,
     image_url VARCHAR(300) NOT NULL,
     is_default TINYINT(1) DEFAULT 0,
     is_premium TINYINT(1) DEFAULT 0,  -- 1이면 보상으로만 획득 가능
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   CREATE TABLE IF NOT EXISTS user_backgrounds (
     user_id INT NOT NULL,
     background_slug VARCHAR(50) NOT NULL,
     unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     PRIMARY KEY (user_id, background_slug),
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   );

   users 테이블에 컬럼 추가:
   ALTER TABLE users ADD COLUMN IF NOT EXISTS
     equipped_background VARCHAR(50) NULL DEFAULT NULL;
   ALTER TABLE users ADD COLUMN IF NOT EXISTS
     avatar_url_custom VARCHAR(500) NULL DEFAULT NULL;

2. 기본 배경 시드 데이터 (mysql.js seedData):
   INSERT IGNORE INTO profile_backgrounds (slug, name, image_url, is_default) VALUES
   ('default-dark', '기본 다크', '/backgrounds/bg-default.jpg', 1),
   ('gradient-blue', '블루 그라데이션', 'gradient:linear-gradient(135deg,#0d1117,#0a2a4a)', 1),
   ('gradient-purple', '퍼플 그라데이션', 'gradient:linear-gradient(135deg,#0d1117,#1a0a2e)', 1),
   ('gradient-green', '그린 그라데이션', 'gradient:linear-gradient(135deg,#0d1117,#0a2e1a)', 1);

   -- 프리미엄 (대회 보상용)
   INSERT IGNORE INTO profile_backgrounds (slug, name, image_url, is_default, is_premium) VALUES
   ('neon-city', '네온 시티', '/backgrounds/neon-city.jpg', 0, 1),
   ('galaxy', '갤럭시', '/backgrounds/galaxy.jpg', 0, 1),
   ('challenger-bg', '챌린저 배경', '/backgrounds/challenger-bg.jpg', 0, 1);

3. routes/auth.js 또는 새 routes/profile.js에 추가:

   GET /api/profile/backgrounds — auth 필요
   - 내가 잠금 해제한 배경 + 기본 배경 목록:
     SELECT pb.*, (ub.user_id IS NOT NULL) AS isUnlocked
     FROM profile_backgrounds pb
     LEFT JOIN user_backgrounds ub ON ub.background_slug=pb.slug AND ub.user_id=?
     WHERE pb.is_default=1 OR ub.user_id=?
     ORDER BY pb.is_default DESC, ub.unlocked_at DESC

   PATCH /api/profile/background — auth 필요
   - body: { backgroundSlug }
   - 유저가 해당 배경 소유했는지 확인 (is_default=1이면 무조건 가능)
   - UPDATE users SET equipped_background=? WHERE id=?

   POST /api/profile/avatar — auth 필요, multipart/form-data
   - 이미지 업로드 (multer 미들웨어 사용)
   - 파일 크기 제한: 2MB, 허용 타입: image/jpeg, image/png, image/webp
   - VPS 저장 경로: /var/www/dailycoding/uploads/avatars/{userId}.{ext}
   - Nginx 설정에 /uploads/ → 정적 서빙 필요 (별도 설정)
   - 임시 방편: base64로 DB 저장 (파일 작으면 가능하나 권장 안 함)
   - avatar_url_custom 업데이트: UPDATE users SET avatar_url_custom=? WHERE id=?
   - 응답: { avatarUrl }

4. multer 패키지 확인:
   dailycoding-server/package.json에 multer 있는지 확인
   없으면: npm install multer (dailycoding-server/ 폴더에서)

Frontend:
5. ProfilePage.jsx 또는 PublicProfilePage.jsx:
   프로필 상단 커버 배경 영역 추가:
   <div style={{
     height: 160,
     background: equippedBg?.startsWith('gradient:')
       ? equippedBg.replace('gradient:', '')
       : `url(${equippedBg || '/backgrounds/bg-default.jpg'}) center/cover`,
     borderRadius: '12px 12px 0 0',
     position: 'relative',
   }}>
     {isOwner && (
       <button onClick={() => setBgModalOpen(true)}
         style={{ position:'absolute', bottom:12, right:12,
                  background:'rgba(0,0,0,0.6)', color:'#fff',
                  border:'none', borderRadius:8, padding:'6px 12px',
                  fontSize:12, cursor:'pointer' }}>
         🎨 배경 변경
       </button>
     )}
   </div>

6. 배경 선택 모달 (BackgroundPickerModal 컴포넌트):
   - 획득한 배경 그리드 (4열)
   - 각 배경 미리보기 썸네일
   - 클릭 시 PATCH /api/profile/background 호출
   - 잠긴 배경: 흐리게 표시 + 🔒 아이콘

7. SettingsPage.jsx의 아바타 섹션:
   현재 아바타 표시 + 두 옵션:
   <div style={{ display:'flex', gap:16, alignItems:'center' }}>
     <div>
       {/* 현재 아바타 */}
       {user.avatarUrlCustom
         ? <img src={user.avatarUrlCustom} style={{ width:80, height:80, borderRadius:'50%', objectFit:'cover' }} />
         : <span style={{ fontSize:60 }}>{user.avatarEmoji}</span>
       }
     </div>
     <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
       <label className="btn btn-ghost" style={{ cursor:'pointer' }}>
         📷 이미지 업로드
         <input type="file" accept="image/*" style={{ display:'none' }}
           onChange={handleAvatarUpload} />
       </label>
       <button className="btn btn-ghost" onClick={() => setShowEmojiPicker(true)}>
         😊 이모지 선택
       </button>
     </div>
   </div>

   handleAvatarUpload:
   const handleAvatarUpload = async (e) => {
     const file = e.target.files[0];
     if (!file) return;
     if (file.size > 2 * 1024 * 1024) { alert('2MB 이하 이미지만 가능합니다'); return; }
     const formData = new FormData();
     formData.append('avatar', file);
     const res = await api.post('/profile/avatar', formData, {
       headers: { 'Content-Type': 'multipart/form-data' }
     });
     // 유저 상태 업데이트
   };

주의:
- 파일 업로드 경로는 VPS 환경에 맞게 설정 필요 (개발 환경과 다를 수 있음)
- User.safe()에 avatarUrlCustom, equippedBackground 필드 추가 필요
- 배경 잠금 해제는 Reward.grant() 시스템과 연동 (대회 보상 지급 시 user_backgrounds INSERT)
```

---

## 🟣 UX-06 — 문제 세트 & 단계별 학습 (콘텐츠 컨테이너)

```
Context:
- 참고 사이트(Reporch): 한국정보올림피아드, 삼성 코테, IOI 문제 세트 + 단계별 문제 있음
- 중요: 실제 대회 문제는 저작권이 있으므로 Codex가 직접 가져올 수 없음
         → 관리자가 직접 입력하는 컨테이너 구조만 구현

Goal:
1. 문제 세트 (Problem Sheet): "KOI 2019", "삼성 SW 역량 테스트 기출" 같은 큐레이션 컬렉션
2. 단계별 학습 (Learning Path): 입출력 → 조건문 → 반복문 → 배열 → ... 초보자 트랙

Backend:
1. mysql.js 테이블 추가:
   CREATE TABLE IF NOT EXISTS problem_sheets (
     id INT AUTO_INCREMENT PRIMARY KEY,
     title VARCHAR(200) NOT NULL,
     description TEXT,
     category ENUM('contest','learning','company','custom') NOT NULL,
     contest_name VARCHAR(100) NULL,  -- 'KOI', 'IOI', 'Samsung' 등
     contest_year INT NULL,
     difficulty_level ENUM('beginner','intermediate','advanced','mixed') DEFAULT 'mixed',
     problem_ids JSON NOT NULL,  -- [1, 5, 12, ...] 순서 있는 배열
     is_official TINYINT(1) DEFAULT 0,  -- 관리자가 만든 공식 세트
     created_by INT NOT NULL,
     play_count INT DEFAULT 0,
     thumbnail_color VARCHAR(20) DEFAULT '#79c0ff',
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     INDEX idx_category (category),
     INDEX idx_official (is_official)
   );

   CREATE TABLE IF NOT EXISTS learning_paths (
     id INT AUTO_INCREMENT PRIMARY KEY,
     title VARCHAR(200) NOT NULL,
     description TEXT,
     order_index INT NOT NULL,  -- 단계 순서
     tag VARCHAR(50) NOT NULL,  -- '입출력', '조건문', '반복문', '배열', '함수', '재귀', ...
     icon VARCHAR(10) DEFAULT '📚',
     problem_ids JSON NOT NULL,
     is_active TINYINT(1) DEFAULT 1,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

2. 기본 단계별 학습 시드 데이터:
   INSERT IGNORE INTO learning_paths (title, description, order_index, tag, icon, problem_ids) VALUES
   ('입력과 출력',    '프로그래밍의 기초. 값을 입력받고 출력하는 방법을 배웁니다.', 1, '입출력', '📥', '[]'),
   ('조건문',        'if/else를 이용해 조건에 따라 다른 동작을 만듭니다.', 2, '조건문', '🔀', '[]'),
   ('반복문',        'for/while로 반복 작업을 처리합니다.', 3, '반복문', '🔁', '[]'),
   ('배열과 리스트',  '여러 데이터를 묶어서 다루는 방법을 배웁니다.', 4, '배열', '📦', '[]'),
   ('함수',          '코드를 재사용하기 위한 함수 작성법.', 5, '함수', '⚙️', '[]'),
   ('문자열',        '문자열 처리와 다양한 조작 방법.', 6, '문자열', '📝', '[]'),
   ('재귀',          '자기 자신을 호출하는 재귀 함수.', 7, '재귀', '🌀', '[]'),
   ('정렬',          '데이터를 순서대로 배열하는 알고리즘.', 8, '정렬', '📊', '[]'),
   ('탐색',          '데이터에서 원하는 값을 찾는 방법.', 9, '탐색', '🔍', '[]'),
   ('스택과 큐',     '스택, 큐 자료구조와 활용.', 10, '자료구조', '🏗️', '[]');

3. 기본 문제 세트 시드 (관리자가 실제 문제 추가 전 구조만):
   INSERT IGNORE INTO problem_sheets (title, description, category, contest_name, contest_year, problem_ids, is_official, created_by, thumbnail_color) VALUES
   ('KOI 2023 초등부', '한국정보올림피아드 2023년 초등부 문제 모음', 'contest', 'KOI', 2023, '[]', 1, 1, '#56d364'),
   ('KOI 2023 중등부', '한국정보올림피아드 2023년 중등부 문제 모음', 'contest', 'KOI', 2023, '[]', 1, 1, '#56d364'),
   ('삼성 SW 역량테스트 기출', '삼성전자 SW 역량테스트 유형 문제 모음', 'company', 'Samsung', NULL, '[]', 1, 1, '#79c0ff'),
   ('카카오 코테 기출', '카카오 코딩테스트 유형 문제 모음', 'company', 'Kakao', NULL, '[]', 1, 1, '#ffd700'),
   ('초보자 입문 트랙', '프로그래밍을 처음 시작하는 분들을 위한 문제 모음', 'learning', NULL, NULL, '[]', 1, 1, '#d2a8ff');

4. routes/sheets.js 신규 파일:
   GET /api/sheets — auth 선택
   - ?category=contest|learning|company|custom
   - SELECT * FROM problem_sheets WHERE is_official=1 OR created_by=? ORDER BY category, created_at DESC

   GET /api/sheets/:id — auth 선택
   - 세트 정보 + 포함된 문제 목록 (problem_ids 순서대로)
   - 각 문제별 유저의 해결 여부 포함 (로그인 시)

   POST /api/sheets (adminOnly) — 문제 세트 생성/수정

   GET /api/learning-paths — auth 선택
   - SELECT * FROM learning_paths WHERE is_active=1 ORDER BY order_index

   GET /api/learning-paths/:id — auth 선택
   - 단계 정보 + 포함된 문제 목록 + 각 문제 해결 여부

5. index.js에 등록:
   import sheetsRouter from './routes/sheets.js';
   app.use('/api/sheets', sheetsRouter);
   app.use('/api/learning-paths', sheetsRouter);  // 같은 파일에 두 라우터

Frontend:
6. SheetsPage.jsx 신규 파일 — src/pages/SheetsPage.jsx:
   상단 탭: [전체] [대회 문제] [기업 기출] [단계별 학습] [나의 세트]

   문제 세트 카드:
   <div style={{
     borderRadius:12, overflow:'hidden', border:'1px solid var(--border)',
     transition:'transform .2s, box-shadow .2s',
   }}
   onMouseEnter={e => e.currentTarget.style.transform='translateY(-4px)'}
   onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}>
     {/* 컬러 헤더 */}
     <div style={{ height:8, background:sheet.thumbnailColor }} />
     <div style={{ padding:16 }}>
       <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
         <div>
           <div style={{ fontWeight:700, fontSize:15 }}>{sheet.title}</div>
           {sheet.contestYear && (
             <div style={{ color:'var(--text3)', fontSize:12, marginTop:2 }}>
               {sheet.contestName} {sheet.contestYear}년
             </div>
           )}
         </div>
         <span style={{ fontSize:11, padding:'2px 8px', borderRadius:4,
                        background:'var(--bg3)', color:'var(--text3)' }}>
           {sheet.category === 'contest' ? '대회' : sheet.category === 'company' ? '기업' : '학습'}
         </span>
       </div>
       <div style={{ color:'var(--text2)', fontSize:13, marginTop:8 }}>{sheet.description}</div>
       <div style={{ display:'flex', justifyContent:'space-between', marginTop:12, fontSize:12 }}>
         <span style={{ color:'var(--text3)' }}>문제 {sheet.problemCount}개</span>
         <span style={{ color:'var(--text3)' }}>도전 {sheet.playCount}회</span>
       </div>
       {/* 진행률 바 (로그인 시) */}
       {solvedCount !== null && (
         <div style={{ marginTop:8 }}>
           <div style={{ height:4, background:'var(--bg3)', borderRadius:2 }}>
             <div style={{ height:'100%', width:`${(solvedCount/totalCount)*100}%`,
                           background:'var(--green)', borderRadius:2 }} />
           </div>
           <div style={{ color:'var(--text3)', fontSize:11, marginTop:4 }}>
             {solvedCount}/{totalCount} 해결
           </div>
         </div>
       )}
       <button className="btn btn-primary" style={{ width:'100%', marginTop:12 }}
         onClick={() => navigate(`/sheets/${sheet.id}`)}>
         시작하기
       </button>
     </div>
   </div>

7. 단계별 학습 LearningPathPage.jsx:
   아코디언 또는 카드 형태로 단계 나열:
   {paths.map((path, i) => (
     <div key={path.id} style={{ display:'flex', gap:16, alignItems:'flex-start', marginBottom:20 }}>
       {/* 왼쪽: 단계 번호 + 연결선 */}
       <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
         <div style={{
           width:40, height:40, borderRadius:'50%', background:'var(--bg2)',
           border:`2px solid ${path.isCompleted ? 'var(--green)' : 'var(--border)'}`,
           display:'flex', alignItems:'center', justifyContent:'center', fontSize:18
         }}>
           {path.isCompleted ? '✅' : path.icon}
         </div>
         {i < paths.length - 1 && (
           <div style={{ width:2, flex:1, minHeight:20, background:'var(--border)', marginTop:4 }} />
         )}
       </div>
       {/* 오른쪽: 내용 */}
       <div style={{ flex:1, paddingBottom:16 }}>
         <div style={{ fontWeight:700 }}>Step {path.orderIndex}. {path.title}</div>
         <div style={{ color:'var(--text2)', fontSize:13 }}>{path.description}</div>
         <button className="btn btn-ghost" style={{ marginTop:8, fontSize:13 }}
           onClick={() => navigate(`/learning/${path.id}`)}>
           {path.isCompleted ? '복습하기' : '시작하기'} →
         </button>
       </div>
     </div>
   ))}

8. App.jsx 라우트 추가:
   <Route path="/sheets" element={<PrivateRoute><SheetsPage /></PrivateRoute>} />
   <Route path="/sheets/:id" element={<PrivateRoute><SheetDetailPage /></PrivateRoute>} />
   <Route path="/learning" element={<LearningPathPage />} />  {/* 비로그인도 접근 가능 */}

9. TopNav에 메뉴 추가:
   { path:'/sheets', label:'문제 세트' }
   { path:'/learning', label:'단계별 학습' }

주의:
- KOI(한국정보올림피아드), IOI 문제: 대회 후 공개되어 비상업적 연습 목적 사용 가능.
  실제 문제 제목/내용/예제를 problemCatalog.js 시드 데이터에 포함해도 됨.
  (BOJ 등 다른 온라인 저지도 동일하게 활용 중)
- 삼성 SW 역량테스트: 내부 기업 시험 문제라 공개된 적 없음. 포함 금지.
  Samsung 세트는 "삼성 유형" 분류로 직접 만든 유사 문제만 넣을 것.
- problem_ids JSON 배열의 순서가 학습 순서 → JS에서 map() 시 순서 보장
- problems 테이블에 INSERT 후 해당 id를 problem_sheets의 problem_ids에 넣을 것
- ESM only, DB 헬퍼 사용

KOI/IOI 시드 문제 예시 (problemCatalog.js에 추가):
  {
    title: 'A+B',
    description: '두 정수 A와 B를 입력받은 다음, A+B를 출력하는 프로그램을 작성하시오.',
    tier: 'unranked', difficulty: 1, problem_type: 'coding',
    tags: ['입출력', '수학'],
    testcases: [{ input: '1 2', output: '3' }, { input: '3 4', output: '7' }],
  },
  {
    title: '최솟값 찾기',
    description: 'N개의 정수가 주어졌을 때, 최솟값을 구하는 프로그램을 작성하시오.',
    tier: 'bronze', difficulty: 2, problem_type: 'coding',
    tags: ['배열', '반복문'],
    testcases: [{ input: '5\n3 1 4 1 5', output: '1' }],
  },
  {
    title: '피보나치 수',
    description: 'n번째 피보나치 수를 구하는 프로그램을 작성하시오. F(0)=0, F(1)=1, F(n)=F(n-1)+F(n-2)',
    tier: 'silver', difficulty: 4, problem_type: 'coding',
    tags: ['재귀', '다이나믹 프로그래밍'],
    testcases: [{ input: '10', output: '55' }, { input: '0', output: '0' }],
  },
  {
    title: '이진 탐색',
    description: 'N개의 정수 배열에서 특정 값 X의 위치를 이진 탐색으로 찾으시오. 없으면 -1 출력.',
    tier: 'silver', difficulty: 5, problem_type: 'coding',
    tags: ['이진 탐색', '배열'],
    testcases: [{ input: '5 3\n1 2 3 4 5', output: '3' }],
  },
  -- KOI 유형 문제 (공개 대회 기반)
  {
    title: '최단 경로 (BFS)',
    description: '미로에서 시작점(1,1)부터 끝점(N,M)까지 최단 경로를 구하시오. 1은 이동 가능, 0은 벽.',
    tier: 'gold', difficulty: 6, problem_type: 'coding',
    tags: ['BFS', '그래프'],
    testcases: [{ input: '4 6\n101111\n101010\n101011\n111011', output: '15' }],
  },
  {
    title: '괄호 검사',
    description: '주어진 문자열이 올바른 괄호 문자열인지 판단하시오.',
    tier: 'silver', difficulty: 4, problem_type: 'coding',
    tags: ['스택', '문자열'],
    testcases: [{ input: '(())()', output: 'YES' }, { input: '))()(', output: 'NO' }],
  },
  {
    title: '소수 판별',
    description: '주어진 수 N이 소수인지 아닌지 판단하는 프로그램을 작성하시오.',
    tier: 'bronze', difficulty: 3, problem_type: 'coding',
    tags: ['수학', '소수'],
    testcases: [{ input: '7', output: 'YES' }, { input: '4', output: 'NO' }],
  }
```

---

## 🟣 UX-07 — 푸터 개선 + 소셜 링크

```
Context:
- Reporch 푸터 구조: 서비스/약관/컨텐츠 섹션 + 사업자 정보
- 소셜 링크 추가 (개발자 연락처):
  GitHub: https://github.com/choijunhuk
  Instagram: https://www.instagram.com/jh__k77/

Task:
1. Footer.jsx 신규 또는 기존 푸터 개선:
   4컬럼 레이아웃:

   const FOOTER_LINKS = {
     서비스: [
       { label: '문제 풀기', path: '/problems' },
       { label: '랭킹', path: '/ranking' },
       { label: '배틀', path: '/battle' },
       { label: '커뮤니티', path: '/community' },
       { label: '모의 코테', path: '/exams' },
     ],
     학습: [
       { label: '단계별 학습', path: '/learning' },
       { label: '문제 세트', path: '/sheets' },
       { label: '주간 챌린지', path: '/weekly' },
     ],
     약관: [
       { label: '이용약관', path: '/terms' },
       { label: '개인정보처리방침', path: '/privacy' },
     ],
     컨텐츠: [
       { label: '문제 제보', href: 'mailto:contact@dailycoding.dev' },
       { label: '광고 문의', href: 'mailto:contact@dailycoding.dev' },
     ],
   };

   <footer style={{ background:'var(--bg2)', borderTop:'1px solid var(--border)',
                    padding:'48px 24px 32px', marginTop:80 }}>
     <div style={{ maxWidth:1200, margin:'0 auto' }}>
       {/* 상단: 로고 + 소개 */}
       <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr', gap:32, marginBottom:40 }}>
         <div>
           <div style={{ fontFamily:'Space Mono', fontWeight:700, fontSize:18, color:'var(--text)' }}>
             DailyCoding
           </div>
           <div style={{ color:'var(--text3)', fontSize:13, marginTop:8, lineHeight:1.6 }}>
             코테 준비를 계속하게 만드는<br/>경쟁형 성장 서비스
           </div>
           {/* 소셜 링크 */}
           <div style={{ display:'flex', gap:12, marginTop:16 }}>
             <a href="https://github.com/choijunhuk" target="_blank" rel="noopener noreferrer"
                style={{ color:'var(--text3)', textDecoration:'none', fontSize:13,
                         display:'flex', alignItems:'center', gap:4 }}>
               GitHub
             </a>
             <a href="https://www.instagram.com/jh__k77/" target="_blank" rel="noopener noreferrer"
                style={{ color:'var(--text3)', textDecoration:'none', fontSize:13,
                         display:'flex', alignItems:'center', gap:4 }}>
               Instagram
             </a>
           </div>
         </div>
         {Object.entries(FOOTER_LINKS).map(([section, links]) => (
           <div key={section}>
             <div style={{ fontWeight:700, fontSize:13, color:'var(--text2)', marginBottom:12 }}>
               {section}
             </div>
             {links.map(link => (
               <div key={link.label} style={{ marginBottom:8 }}>
                 {link.path
                   ? <Link to={link.path} style={{ color:'var(--text3)', textDecoration:'none', fontSize:13 }}>
                       {link.label}
                     </Link>
                   : <a href={link.href} style={{ color:'var(--text3)', textDecoration:'none', fontSize:13 }}>
                       {link.label}
                     </a>
                 }
               </div>
             ))}
           </div>
         ))}
       </div>

       {/* 하단 구분선 + 저작권 */}
       <div style={{ borderTop:'1px solid var(--border)', paddingTop:24,
                     display:'flex', justifyContent:'space-between', alignItems:'center' }}>
         <div style={{ color:'var(--text3)', fontSize:12 }}>
           © 2026 DailyCoding. All rights reserved.
         </div>
         {/* 테마 토글 */}
         <button onClick={toggleTheme}
           style={{ background:'none', border:'1px solid var(--border)', borderRadius:6,
                    padding:'4px 12px', color:'var(--text3)', fontSize:12, cursor:'pointer' }}>
           {isDark ? '☀️ 라이트' : '🌙 다크'}
         </button>
       </div>
     </div>
   </footer>

2. App.jsx에서 Footer를 모든 페이지 공통으로 렌더 (현재 없으면 추가):
   Router 바깥 또는 Routes 아래에 <Footer /> 배치

주의:
- 소셜 링크는 target="_blank" + rel="noopener noreferrer" 필수 (보안)
- 모바일: grid-template-columns → 2열 또는 1열로 변경
  @media (max-width:768px) { gridTemplateColumns: '1fr 1fr' }
```

---

## 🟣 UX-08 — 전역 애니메이션 + 페이지 트랜지션

```
Context:
- 현재: 대부분 즉시 렌더, 애니메이션 거의 없음
- 목표: 부드러운 전환 + 주요 요소 진입 애니메이션

Task:
1. dailycoding/src/index.css 하단에 추가 (없으면 v2 프롬프트 D-7 내용과 합쳐서):
   /* 페이지 진입 */
   @keyframes fadeIn {
     from { opacity: 0; }
     to   { opacity: 1; }
   }
   @keyframes fadeInUp {
     from { opacity: 0; transform: translateY(20px); }
     to   { opacity: 1; transform: translateY(0); }
   }
   @keyframes fadeInDown {
     from { opacity: 0; transform: translateY(-12px); }
     to   { opacity: 1; transform: translateY(0); }
   }
   @keyframes slideInLeft {
     from { opacity: 0; transform: translateX(-16px); }
     to   { opacity: 1; transform: translateX(0); }
   }
   @keyframes scaleIn {
     from { opacity: 0; transform: scale(0.92); }
     to   { opacity: 1; transform: scale(1); }
   }
   @keyframes shimmer {
     0%   { background-position: -200% 0; }
     100% { background-position:  200% 0; }
   }
   @keyframes pulse {
     0%, 100% { opacity: 1; }
     50%       { opacity: .5; }
   }

   /* 유틸리티 클래스 */
   .animate-fade-in    { animation: fadeIn .3s ease both; }
   .animate-fade-up    { animation: fadeInUp .4s ease both; }
   .animate-fade-down  { animation: fadeInDown .3s ease both; }
   .animate-slide-left { animation: slideInLeft .35s ease both; }
   .animate-scale-in   { animation: scaleIn .3s ease both; }
   .animate-pulse      { animation: pulse 2s ease infinite; }

   .delay-1 { animation-delay: .05s; }
   .delay-2 { animation-delay: .1s; }
   .delay-3 { animation-delay: .15s; }
   .delay-4 { animation-delay: .2s; }
   .delay-5 { animation-delay: .25s; }

   /* 스켈레톤 로딩 */
   .skeleton {
     background: linear-gradient(90deg, var(--bg2) 25%, var(--bg3) 50%, var(--bg2) 75%);
     background-size: 200% 100%;
     animation: shimmer 1.5s infinite;
     border-radius: 6px;
   }

   /* 카드 hover lift */
   .card-hover {
     transition: transform .2s ease, box-shadow .2s ease;
   }
   .card-hover:hover {
     transform: translateY(-4px);
     box-shadow: 0 12px 40px rgba(0,0,0,.25);
   }

   /* 버튼 클릭 */
   .btn { transition: opacity .15s, transform .1s; }
   .btn:active { transform: scale(0.97); }

   /* 그라데이션 텍스트 */
   .gradient-text {
     background: linear-gradient(135deg, var(--blue) 0%, var(--purple) 100%);
     -webkit-background-clip: text;
     -webkit-text-fill-color: transparent;
     background-clip: text;
   }

2. 페이지 진입 애니메이션 적용:
   각 페이지 컴포넌트 최상위 div에:
   <div className="animate-fade-in"> ... </div>

   Dashboard의 카드들:
   {cards.map((card, i) => (
     <div className={`animate-fade-up delay-${i+1}`} key={card.id}> ... </div>
   ))}

3. React Router 페이지 전환 (선택사항, 간단 버전):
   App.jsx에서 key={location.pathname}으로 Routes에 key 부여:
   const location = useLocation();
   <Routes key={location.pathname}> ... </Routes>
   → 페이지 이동 시 fadeIn 애니메이션 자동 트리거

4. 토스트 알림 애니메이션 (ToastContext.jsx 있으면 수정):
   토스트 등장: animate-slide-left
   토스트 사라짐: opacity 0 + translateX(20px) 0.2s

주의:
- prefers-reduced-motion 미디어 쿼리 고려:
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .01ms !important; }
  }
- CSS 파일이 너무 길어지지 않도록 애니메이션 섹션 주석으로 구분
```

---

## 🟣 UX-09 — 문제 설명 인라인 이미지 지원 (Content Blocks)

```
Context:
- 현재: problems 테이블의 description 컬럼이 단순 TEXT → 이미지 삽입 불가
- 목표: 문제 설명 중간에 이미지를 자유롭게 끼워넣기
  예: "아래 그림과 같이 N×M 미로가 주어진다." → [이미지] → "시작점은..."
- 방식: Content Blocks JSON 배열 (외부 라이브러리 추가 없이 구현)

Content Block 구조:
[
  { "type": "text",    "content": "N×M 크기의 미로가 주어진다." },
  { "type": "image",   "url": "/uploads/problems/maze.png", "caption": "그림 1. 미로 예시", "width": 400 },
  { "type": "text",    "content": "시작점(1,1)에서 끝점(N,M)까지..." },
  { "type": "code",    "content": "입력 예시:\n4 6\n101111", "lang": "text" },
  { "type": "image",   "url": "/uploads/problems/maze2.png", "caption": "그림 2. 정답 경로" },
  { "type": "text",    "content": "출력: 최단 경로의 칸 수" }
]

Backend:
1. problems 테이블에 컬럼 추가:
   ALTER TABLE problems ADD COLUMN IF NOT EXISTS
     description_blocks JSON NULL DEFAULT NULL;
   -- 기존 description TEXT 컬럼은 유지 (하위 호환)
   -- description_blocks가 있으면 우선 사용, 없으면 description fallback

2. routes/problems.js POST/PATCH 문제 생성·수정:
   - body에 descriptionBlocks 있으면 JSON.stringify 후 저장
   - SKIP_SANITIZE_KEYS에 'descriptionBlocks' 추가 (index.js)

3. Problem.findById() 응답에 descriptionBlocks 포함:
   - JSON.parse(row.description_blocks) 후 반환
   - parse 실패 시 null 반환 (하위 호환)

4. routes/problems.js — 문제 이미지 업로드 엔드포인트:
   POST /api/problems/:id/image — auth + adminOnly
   - multer 미들웨어 (AUDIT-04에서 이미 설치됨)
   - 저장 경로: /var/www/dailycoding/uploads/problems/{problemId}-{timestamp}.{ext}
   - 파일 제한: 5MB, image/jpeg, image/png, image/gif, image/webp
   - 응답: { url: '/uploads/problems/...' }
   - 이 URL을 descriptionBlocks의 image block url에 사용

Frontend:
5. src/components/ProblemContent.jsx 신규 컴포넌트:
   descriptionBlocks 배열을 순서대로 렌더링

   export default function ProblemContent({ blocks, fallbackText }) {
     if (!blocks || blocks.length === 0) {
       return <div style={{ lineHeight:1.8, color:'var(--text)' }}>{fallbackText}</div>;
     }
     return (
       <div style={{ lineHeight:1.8, color:'var(--text)' }}>
         {blocks.map((block, i) => {
           if (block.type === 'text') return (
             <p key={i} style={{ marginBottom:16, whiteSpace:'pre-wrap' }}>{block.content}</p>
           );
           if (block.type === 'image') return (
             <figure key={i} style={{ margin:'20px 0', textAlign:'center' }}>
               <img
                 src={block.url}
                 alt={block.caption || ''}
                 style={{
                   maxWidth: block.width ? `${block.width}px` : '100%',
                   borderRadius:8,
                   border:'1px solid var(--border)',
                 }}
                 loading="lazy"
               />
               {block.caption && (
                 <figcaption style={{ color:'var(--text3)', fontSize:13, marginTop:6 }}>
                   {block.caption}
                 </figcaption>
               )}
             </figure>
           );
           if (block.type === 'code') return (
             <pre key={i} style={{
               background:'var(--bg3)', borderRadius:8, padding:'14px 16px',
               fontFamily:'Space Mono, monospace', fontSize:13,
               overflowX:'auto', margin:'16px 0',
               border:'1px solid var(--border)',
             }}>
               <code>{block.content}</code>
             </pre>
           );
           return null;
         })}
       </div>
     );
   }

6. JudgePage.jsx에서 문제 설명 렌더링 교체:
   현재: <div>{problem.description}</div>
   변경:
   import ProblemContent from '../components/ProblemContent';
   <ProblemContent
     blocks={problem.descriptionBlocks}
     fallbackText={problem.description}
   />

7. AdminPage.jsx — 문제 편집기에 블록 에디터 추가:
   문제 생성/수정 폼에 블록 편집 UI:

   const [blocks, setBlocks] = useState([{ type:'text', content:'' }]);

   블록 추가 버튼들:
   <div style={{ display:'flex', gap:8, marginBottom:12 }}>
     <button className="btn btn-ghost" onClick={() => addBlock('text')}>+ 텍스트</button>
     <button className="btn btn-ghost" onClick={() => addBlock('image')}>+ 이미지</button>
     <button className="btn btn-ghost" onClick={() => addBlock('code')}>+ 코드블록</button>
   </div>

   각 블록 편집:
   {blocks.map((block, i) => (
     <div key={i} style={{ border:'1px solid var(--border)', borderRadius:8, padding:12, marginBottom:8 }}>
       <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
         <span style={{ color:'var(--text3)', fontSize:12 }}>
           {block.type === 'text' ? '📝 텍스트' : block.type === 'image' ? '🖼️ 이미지' : '💻 코드'}
         </span>
         <div style={{ display:'flex', gap:6 }}>
           {i > 0 && <button onClick={() => moveBlock(i, -1)}>↑</button>}
           {i < blocks.length-1 && <button onClick={() => moveBlock(i, 1)}>↓</button>}
           <button onClick={() => removeBlock(i)} style={{ color:'var(--red)' }}>✕</button>
         </div>
       </div>

       {block.type === 'text' && (
         <textarea value={block.content} rows={4}
           onChange={e => updateBlock(i, { content: e.target.value })}
           style={{ width:'100%', background:'var(--bg3)', border:'1px solid var(--border)',
                    borderRadius:6, padding:8, color:'var(--text)', resize:'vertical' }}
         />
       )}
       {block.type === 'image' && (
         <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
           <input placeholder="이미지 URL 직접 입력 또는 아래에서 업로드"
             value={block.url || ''} onChange={e => updateBlock(i, { url: e.target.value })}
             style={{ padding:'8px 12px', background:'var(--bg3)', border:'1px solid var(--border)',
                      borderRadius:6, color:'var(--text)' }} />
           <label className="btn btn-ghost" style={{ cursor:'pointer', display:'inline-block' }}>
             📎 이미지 업로드
             <input type="file" accept="image/*" style={{ display:'none' }}
               onChange={e => handleImageUpload(e, i)} />
           </label>
           <input placeholder="캡션 (선택사항)" value={block.caption || ''}
             onChange={e => updateBlock(i, { caption: e.target.value })}
             style={{ padding:'8px 12px', background:'var(--bg3)', border:'1px solid var(--border)',
                      borderRadius:6, color:'var(--text)' }} />
           {block.url && (
             <img src={block.url} alt="미리보기"
               style={{ maxWidth:300, borderRadius:6, border:'1px solid var(--border)' }} />
           )}
         </div>
       )}
       {block.type === 'code' && (
         <textarea value={block.content} rows={4}
           onChange={e => updateBlock(i, { content: e.target.value })}
           style={{ width:'100%', background:'var(--bg3)', border:'1px solid var(--border)',
                    borderRadius:6, padding:8, color:'var(--text)',
                    fontFamily:'Space Mono, monospace', fontSize:13, resize:'vertical' }}
         />
       )}
     </div>
   ))}

   헬퍼 함수:
   const addBlock = (type) => setBlocks(b => [...b, { type, content:'', url:'', caption:'' }]);
   const removeBlock = (i) => setBlocks(b => b.filter((_, idx) => idx !== i));
   const updateBlock = (i, patch) => setBlocks(b => b.map((bl, idx) => idx===i ? {...bl,...patch} : bl));
   const moveBlock = (i, dir) => {
     setBlocks(b => {
       const arr = [...b];
       [arr[i], arr[i+dir]] = [arr[i+dir], arr[i]];
       return arr;
     });
   };
   const handleImageUpload = async (e, blockIdx) => {
     const file = e.target.files[0];
     if (!file) return;
     const formData = new FormData();
     formData.append('image', file);
     const res = await api.post(`/problems/${problemId}/image`, formData, {
       headers: { 'Content-Type': 'multipart/form-data' }
     });
     updateBlock(blockIdx, { url: res.data.url });
   };

   폼 제출 시:
   body에 descriptionBlocks: JSON.stringify(blocks) 포함

8. index.js SKIP_SANITIZE_KEYS에 추가:
   기존: ['code', 'sourceCode', 'answer', ...]
   추가: 'descriptionBlocks'

주의:
- descriptionBlocks가 null이면 기존 description TEXT로 fallback — 하위 호환 완전 유지
- 이미지 업로드는 adminOnly — 일반 유저 업로드 불가
- block 배열 순서 = 렌더링 순서 — moveBlock으로 재배치 가능
- 이미지 URL은 /uploads/problems/ 경로 (Nginx 정적 서빙 필요)
- ESM only, multer는 AUDIT-04에서 이미 설치 확인
```

---

## 실행 순서

```
먼저 (자산 배치):  UX-01 (이미지 복사) — 반드시 가장 먼저
함께 실행:         UX-02 (테마) + UX-03 (언어) + UX-08 (애니메이션) — 독립적
다음:              UX-04 (설정 페이지 이동)
다음:              UX-05 (배경/아바타)
다음:              UX-06 (문제 세트) ← 구조만, 문제 내용은 Claude가 별도 작업
다음:              UX-07 (푸터)
마지막:            UX-09 (인라인 이미지) — DB 마이그레이션 + AdminPage 수정
```

## 역할 분담 (중요)

```
Codex 담당:
- UX-01 ~ UX-09 전체 구조·코드 구현
- problem_sheets 테이블, learning_paths 테이블 생성
- 시트 UI, 단계별 학습 UI, Content Block 에디터

Claude(나) 담당 (Codex 작업 완료 후 별도 실행):
- KOI(한국정보올림피아드) 기출 문제 내용을 problemCatalog.js에 직접 작성
- IOI(국제정보올림피아드) 기출 문제 내용 작성
- 단계별 학습 트랙의 문제 내용 (입출력, 조건문, 반복문 등) 작성
- 각 문제를 해당 시트(problem_sheets)에 연결

→ Codex 작업 완료 후 "이제 문제 데이터 넣어줘"라고 말하면 진행
```

## 저작권 안내

```
KOI, IOI: 대회 후 공개된 문제, 비상업적 연습 목적 사용 가능.
삼성 SW 역량테스트: 내부 기업 시험, 포함 금지.
문제 내용 입력은 Codex가 아닌 Claude가 별도로 담당.
Codex는 구조(테이블, UI, API)만 구현하면 됨.
시드 데이터의 problem_ids는 빈 배열([])로 유지하세요.
```
