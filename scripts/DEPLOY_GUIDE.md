# VPS 배포 가이드

## 전제
- Ubuntu 22.04 LTS
- 도메인 DNS가 VPS IP를 가리킴
- Docker, Nginx, PM2, Certbot을 사용
- 프론트 정적 파일은 `/var/www/dailycoding/dist`
- 백엔드는 PM2로 `localhost:4000`에서 실행

## 최초 1회 설정

### 1. VPS 접속 및 초기 세팅
```bash
ssh root@<VPS_IP>
bash scripts/vps-setup.sh
```

### 2. 코드 클론 및 환경변수 설정
```bash
git clone <repo_url> /home/ubuntu/dailycoding-final
cd /home/ubuntu/dailycoding-final/dailycoding-server
cp .env.example .env
nano .env
```

필수 조정값:
- `DB_HOST=127.0.0.1`
- `DB_PORT=3306`
- `REDIS_URL=redis://:YOUR_REDIS_PASSWORD@127.0.0.1:6379`
- `FRONTEND_URL=https://yourdomain.com`
- `ALLOWED_ORIGINS=https://yourdomain.com`
- `JUDGE_MODE=docker`
- Google/GitHub callback URL을 실제 도메인으로 변경

루트 `docker-compose.yml`용 `.env`도 준비하세요.
예시:
```bash
cd /home/ubuntu/dailycoding-final
cat <<'ENVEOF' > .env
MYSQL_ROOT_PASSWORD=change_me
DB_USER=dcuser
DB_PASS=change_me
REDIS_PASSWORD=change_me
ENVEOF
```

### 3. Docker 시작
```bash
cd /home/ubuntu/dailycoding-final
docker compose up -d
```

### 4. Nginx 설정
```bash
cp /home/ubuntu/dailycoding-final/scripts/nginx-dailycoding.conf /etc/nginx/sites-available/dailycoding
sed -i 's/yourdomain.com/실제도메인.com/g' /etc/nginx/sites-available/dailycoding
ln -s /etc/nginx/sites-available/dailycoding /etc/nginx/sites-enabled/dailycoding
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### 5. SSL 인증서 발급
```bash
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### 6. 첫 배포
```bash
bash /home/ubuntu/dailycoding-final/scripts/deploy.sh
```

### 7. PM2 자동 시작 등록
```bash
pm2 startup
pm2 save
```

### 8. OAuth Redirect URI 업데이트
- Google Cloud Console: `https://yourdomain.com/api/auth/google/callback`
- GitHub OAuth App: `https://yourdomain.com/api/auth/github/callback`

## 이후 업데이트 배포

로컬에서:
```bash
git push origin main
```

VPS에서:
```bash
ssh ubuntu@<VPS_IP> "bash /home/ubuntu/dailycoding-final/scripts/deploy.sh"
```

## 운영 확인 명령어
```bash
pm2 logs dailycoding-api
pm2 monit
docker compose logs -f mysql
docker compose logs -f redis
systemctl status nginx
nginx -t
certbot renew --dry-run
```

## 선택: 채점 이미지 미리 받기
```bash
docker pull python:3.12-alpine
docker pull node:20-alpine
docker pull gcc:13
docker pull openjdk:21-slim
```
