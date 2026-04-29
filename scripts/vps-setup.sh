#!/bin/bash
set -e

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root."
  exit 1
fi

echo "=== [1/5] 기본 패키지 ==="
apt-get update && apt-get upgrade -y
apt-get install -y git curl nginx certbot python3-certbot-nginx ufw ca-certificates

echo "=== [2/5] Node.js 20 LTS ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pm2

echo "=== [3/5] Docker ==="
curl -fsSL https://get.docker.com | sh
apt-get install -y docker-compose-plugin

echo "=== [4/5] 로그 디렉토리 ==="
mkdir -p /var/log/dailycoding /var/www/dailycoding/dist

echo "=== [5/5] 방화벽 ==="
ufw allow 22
ufw allow 80
ufw allow 443
ufw deny 4000
ufw deny 3306
ufw deny 6379
ufw --force enable

echo "✅ VPS 기본 세팅 완료"
