# ⚡ DailyCoding

## 🔐 관리자 계정

| 항목 | 값 |
|------|-----|
| **이메일** | admin@dailycoding.com |
| **비밀번호** | `ADMIN_PASSWORD` 환경변수 |
| **권한** | 문제 생성/수정/삭제, 대회 관리, 유저 관리 |

> 운영 환경에서는 `ADMIN_PASSWORD`를 반드시 설정해야 합니다.
> 더 이상 서버가 임시 관리자 비밀번호를 생성해서 출력하지 않습니다.

## 🧪 로컬 검증용 부트스트랩

도메인 연결 전 로컬에서 관리자/일반 유저 흐름을 바로 확인하려면 아래 값을 사용하세요.

```env
ENABLE_LOCAL_BOOTSTRAP=true
LOCAL_ADMIN_PASSWORD=local-admin-1234
LOCAL_TEST_EMAIL=tester@dailycoding.local
LOCAL_TEST_USERNAME=LocalTester
LOCAL_TEST_PASSWORD=local-tester-1234
```

이 설정을 켜면 개발 환경에서만 아래 계정을 자동 생성/보정합니다.

| 용도 | 이메일 | 비밀번호 |
|------|--------|----------|
| 관리자 | admin@dailycoding.com | `ADMIN_PASSWORD` 또는 `LOCAL_ADMIN_PASSWORD` |
| 테스트 유저 | tester@dailycoding.local | `LOCAL_TEST_PASSWORD` |

주의:
- `ENABLE_LOCAL_BOOTSTRAP`는 production에서 무시됩니다.
- 실제 배포에서는 위 기본값을 절대 사용하지 말고 강한 비밀번호와 실제 도메인 환경변수를 사용하세요.

---

## 🚀 실행 방법

### 준비물
- [Docker Desktop](https://www.docker.com/products/docker-desktop) 설치
- Node.js 18 이상

### 터미널 1 — 백엔드

```powershell
# dailycoding-server 폴더로 이동
cd dailycoding-server

# MySQL + Redis 실행 (처음 한 번만 이미지 다운로드)
docker-compose up -d mysql redis

# 10~15초 대기 (MySQL 초기화 시간)
# 그 다음 서버 실행
npm install
npm run dev
```

**성공 시 출력:**
```
✅ MySQL 연결 성공
✅ Redis 연결 성공
🚀 DailyCoding API Server
   ➜  http://localhost:4000/api/health
```

> MySQL 없어도 자동 인메모리 모드로 동작 (재시작 시 데이터 초기화)

### 터미널 2 — 프론트엔드

```powershell
# dailycoding 폴더로 이동
cd dailycoding

npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

---

## 🛠️ 자주 발생하는 문제

### MySQL 포트 3306 충돌
로컬에 MySQL이 이미 설치된 경우, docker-compose가 3307 포트를 사용합니다.
자동 처리되므로 별도 설정 불필요.

### Docker "없음" 표시
Docker Desktop이 실행 중인지 확인하세요.
Docker를 쓸 수 없는 환경에서는 native subprocess 채점으로 동작합니다.
현재 native subprocess 경로는 Python / JavaScript / C / C++ / Java를 지원합니다.

### MySQL 연결 실패 후 재시도
```powershell
# 서버만 재시작
# Ctrl+C 후
npm run dev
```

---

## 🌐 환경변수 (.env)

```env
PORT=4000
JWT_SECRET=랜덤_문자열_32자이상
ADMIN_PASSWORD=운영_환경에서는_반드시_설정
GEMINI_API_KEY=구글_AI스튜디오_API_키
ENABLE_LOCAL_BOOTSTRAP=false
FRONTEND_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

DB_HOST=127.0.0.1
DB_PORT=3307
DB_NAME=dailycoding
DB_USER=dcuser
DB_PASS=dcpass1234

REDIS_URL=redis://:redis1234@localhost:6379
JUDGE_MODE=auto

STRIPE_PRO_MONTHLY_ID=price_1TMw1HCLaoSRWv0iBNyj2VCG
STRIPE_PRO_ANNUAL_ID=price_1TMw5LCLaoSRWv0iZLncCZez
STRIPE_TEAM_MONTHLY_ID=price_1TMw5hCLaoSRWv0i1qtbccfV
STRIPE_TEAM_ANNUAL_ID=price_1TMw66CLaoSRWv0iPJLPw5Pu
STRIPE_PRO_MONTHLY_URL=https://buy.stripe.com/test_aFa7sKcI66dAa3x20a5c409
STRIPE_PRO_ANNUAL_URL=https://buy.stripe.com/test_6oU7sKeQegSe0sX0W65c40c
STRIPE_TEAM_MONTHLY_URL=https://buy.stripe.com/test_cNidR88rQ59wcbF8oy5c40b
STRIPE_TEAM_ANNUAL_URL=https://buy.stripe.com/test_3cIdR89vUbxUa3x48i5c40a
```

## ✅ 로컬 확인 순서

1. `dailycoding-server/.env`에 `JWT_SECRET`을 넣고, 로컬 계정이 필요하면 `ENABLE_LOCAL_BOOTSTRAP=true`를 켭니다.
2. `docker-compose up -d mysql redis`
3. `npm install`
4. `npm run dev`
5. 별도 터미널에서 `dailycoding` 프론트엔드를 `npm run dev`로 실행합니다.
6. `http://localhost:5173`에서 로그인합니다.
7. 관리자 확인: `admin@dailycoding.com` + `ADMIN_PASSWORD` 또는 `LOCAL_ADMIN_PASSWORD`
8. 일반 유저 확인: `LOCAL_TEST_EMAIL` + `LOCAL_TEST_PASSWORD`

## 🚚 도메인 / VPS 배포 체크리스트

1. 프론트 도메인과 API 도메인을 먼저 확정합니다.
   - 예시 프론트: `https://dailycoding.example.com`
   - 예시 API: `https://api.dailycoding.example.com`
2. 백엔드 `.env`에서 아래 값을 함께 맞춥니다.
   - `NODE_ENV=production`
   - `JWT_SECRET=<강한 랜덤 문자열>`
   - `FRONTEND_URL=https://dailycoding.example.com`
   - `ALLOWED_ORIGINS=https://dailycoding.example.com`
   - `GITHUB_CALLBACK_URL=https://api.dailycoding.example.com/api/auth/github/callback`
   - `GOOGLE_CALLBACK_URL=https://api.dailycoding.example.com/api/auth/google/callback`
3. 프론트엔드 `dailycoding/.env.production`은 API 기준으로 맞춥니다.
   - `VITE_API_URL=https://api.dailycoding.example.com`
   - `VITE_ALLOWED_HOSTS=localhost,127.0.0.1`
4. production에서는 `accessToken` / `refreshToken` 쿠키가 `Secure + SameSite=None`으로 발급되므로 반드시 HTTPS 뒤에서 운영해야 합니다.
5. Stripe는 가능하면 `STRIPE_SECRET_KEY + Price ID` 조합으로 운영하고, 결제 링크 URL은 테스트/비상 fallback 용도로 사용하세요.
6. 관리자 계정으로 `/api/subscription/ops`를 호출하면 Stripe 설정 상태와 최근 webhook 이벤트/에러를 점검할 수 있습니다.
7. `/api/health`의 `services.billing` 값이 `stripe_session`이면 checkout-session 기반 구성이 활성화된 상태입니다.

## 🌍 Nginx 예시

```nginx
server {
  listen 443 ssl http2;
  server_name api.dailycoding.example.com;

  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

참고:
- 프론트/백엔드가 다른 서브도메인이면 CORS와 cookie HTTPS 조건이 동시에 맞아야 로그인 유지가 됩니다.
- CSP는 다시 활성화되어 있으므로, 외부 스크립트/iframe을 추가할 때는 `helmet` 정책도 함께 조정해야 합니다.
