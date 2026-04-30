#!/bin/bash
set -e

REPO_DIR="/home/ubuntu/dailycoding-final"
FRONTEND_DIST="/var/www/dailycoding/dist"

cd "$REPO_DIR"

echo "📦 [1/8] 코드 업데이트..."
git pull origin main

echo "🔧 [2/8] 백엔드 의존성..."
cd "$REPO_DIR/dailycoding-server"
npm ci --omit=dev

echo "🧪 [3/8] 공유 카탈로그 import 검증..."
node -e "import('./src/shared/problemCatalog.js').then((m)=>{ if(!Array.isArray(m.PROBLEMS) || m.PROBLEMS.length===0){ throw new Error('PROBLEMS export missing') } }).catch((err)=>{ console.error(err); process.exit(1) })"

echo "🏗  [4/8] 프론트엔드 빌드..."
cd "$REPO_DIR/dailycoding"
npm ci
VITE_API_URL="" npm run build

echo "📁 [5/8] 프론트엔드 배포..."
mkdir -p "$FRONTEND_DIST"
find "$FRONTEND_DIST" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -r "$REPO_DIR/dailycoding/dist"/* "$FRONTEND_DIST"/

echo "🐳 [6/8] Docker (MySQL + Redis)..."
cd "$REPO_DIR"
docker compose up -d

echo "🔄 [7/8] PM2 재시작..."
cd "$REPO_DIR/dailycoding-server"
pm2 reload ecosystem.config.cjs --env production || pm2 start ecosystem.config.cjs --env production

echo "🏥 [8/8] 헬스체크..."
HEALTH_URL="${HEALTH_URL:-https://dailycoding-final.com/api/health}"
for attempt in 1 2 3 4 5; do
  if curl -fsS "$HEALTH_URL" >/tmp/dailycoding-health.json; then
    cat /tmp/dailycoding-health.json
    echo
    break
  fi
  if [ "$attempt" -eq 5 ]; then
    echo "❌ 헬스체크 실패: $HEALTH_URL"
    exit 1
  fi
  sleep 2
done

echo "✅ 배포 완료!"
pm2 status
