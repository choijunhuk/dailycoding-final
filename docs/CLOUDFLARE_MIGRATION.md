# Cloudflare 전환 가이드

`dailycoding-final.com` 을 Cloudflare 뒤로 옮겨서 다음을 얻는다:

- **CDN 캐싱** — 정적 자산 (dist/assets/\*) 전 세계 엣지에서 서빙
- **DDoS 보호** — 무료 플랜에서도 L3/L4/L7 자동 차단
- **무료 SSL** — 오리진/엣지 둘 다 무료
- **DNS Always Online** — 오리진 다운되어도 캐시된 페이지 보여줌
- **Bot 차단/Rate limit** — 무료 한도 내에서 기본 룰

## 사전 체크리스트

- 도메인 등록업체 (현재 가비아) 콘솔 접근 권한
- Cloudflare 무료 계정 (cloudflare.com 가입)
- KW 서버 sudo (nginx 설정 1회 수정)

## 단계별

### 1. Cloudflare에 도메인 추가

1. https://dash.cloudflare.com → **Add a site**
2. `dailycoding-final.com` 입력 → **Free plan** 선택
3. Cloudflare가 기존 DNS 레코드 자동 가져옴 — 확인:
   - `A   @     128.134.57.111`
   - `A   www   128.134.57.111`
4. 두 레코드 모두 **Proxy status: Proxied** (오렌지 구름) 으로 설정
5. **네임서버** 2개를 받음. 예:
   ```
   ada.ns.cloudflare.com
   max.ns.cloudflare.com
   ```

### 2. 가비아에서 네임서버 변경

1. 가비아 마이페이지 → My가비아 → 도메인 → `dailycoding-final.com` 관리
2. **네임서버 설정** 메뉴
3. 기존 가비아 NS 모두 삭제 후 위에서 받은 Cloudflare NS 2개 입력
4. 저장
5. 전파 5분~24시간 (대부분 30분 안)

### 3. 전파 확인

```bash
dig +short NS dailycoding-final.com
# 결과에 cloudflare.com 들어오면 완료
```

Cloudflare 대시보드 상단에 **Active** 상태로 표시됨 (확인 자동 폴링).

### 4. SSL 모드 설정 (중요)

Cloudflare 대시보드 → **SSL/TLS** → **Overview**

- **Full (strict)** 선택 (Let's Encrypt 인증서 이미 발급되어 있음)
- "Flexible" 선택 금지 — 무한 리다이렉트 위험

**SSL/TLS → Edge Certificates**:
- **Always Use HTTPS** 켜기
- **Automatic HTTPS Rewrites** 켜기
- **Minimum TLS Version** = `TLS 1.2`

### 5. 페이지 룰 / 캐시 룰

Cloudflare → **Rules → Cache Rules** → **Create rule**

**룰 1: 정적 자산 캐싱 강화**
- Field: `URI Path` contains `/assets/`
- Then: **Cache eligibility = Eligible**, **Edge TTL = 1 month**

**룰 2: API/소켓 캐싱 차단**
- Field: `URI Path` starts with `/api/` OR starts with `/socket.io/`
- Then: **Cache eligibility = Bypass cache**

### 6. nginx에서 진짜 클라이언트 IP 복원

Cloudflare를 통과하면 `$remote_addr`가 Cloudflare 엣지 IP가 된다. real-IP 모듈로 복원:

KW 서버에서:
```bash
sudo nano /etc/nginx/conf.d/cloudflare-real-ip.conf
```

내용 붙여넣기:
```nginx
# Cloudflare IPv4 ranges (https://www.cloudflare.com/ips-v4)
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;
# Cloudflare IPv6 ranges
set_real_ip_from 2400:cb00::/32;
set_real_ip_from 2606:4700::/32;
set_real_ip_from 2803:f800::/32;
set_real_ip_from 2405:b500::/32;
set_real_ip_from 2405:8100::/32;
set_real_ip_from 2a06:98c0::/29;
set_real_ip_from 2c0f:f248::/32;

real_ip_header CF-Connecting-IP;
real_ip_recursive on;
```

적용:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 7. 오리진 직접 접근 차단 (선택, 권장)

오리진 IP (128.134.57.111) 가 노출되어도 Cloudflare를 우회해서 직접 공격할 수 있다. 방어:

옵션 A — Cloudflare 만 허용 (UFW)
```bash
# 위 IP 목록을 UFW에 추가하는 스크립트
curl https://www.cloudflare.com/ips-v4 | xargs -I {} sudo ufw allow from {} to any port 443 proto tcp
curl https://www.cloudflare.com/ips-v6 | xargs -I {} sudo ufw allow from {} to any port 443 proto tcp
sudo ufw deny 443/tcp
sudo ufw enable
```

옵션 B — Cloudflare Tunnel
오리진 IP 완전 숨김. 별도 cloudflared 데몬 설치 필요. 가이드: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/

### 8. 검증

```bash
curl -I https://dailycoding-final.com
# 헤더에 server: cloudflare 보여야 함
# cf-cache-status: HIT (캐시 히트)

curl -I https://dailycoding-final.com/api/health
# cf-cache-status: BYPASS (API는 캐시 안 됨)
```

브라우저 DevTools → Network 탭에서 응답 헤더에 `cf-ray:` 보이면 성공.

## 문제 해결

| 증상 | 원인 | 해결 |
|---|---|---|
| 무한 리다이렉트 | SSL이 Flexible | Full (strict) 로 변경 |
| 525/526 에러 | 오리진 SSL 깨짐 | nginx + Let's Encrypt 재확인 |
| API 캐싱돼서 stale | Cache Rule 누락 | `/api/*` Bypass 룰 추가 |
| 소켓 끊김 | Cloudflare WebSocket 막힘 | Free 플랜은 기본 OK. Rules로 확인 |
| 실 IP 안 나옴 | real_ip 모듈 미설정 | 6단계 conf.d/cloudflare-real-ip.conf 확인 |

## 롤백

문제 생기면 가비아에서 NS 다시 가비아 기본 NS로 복원하면 즉시 우회됨. DNS 전파 시간 동안 트래픽 양쪽으로 흐를 수 있음.
