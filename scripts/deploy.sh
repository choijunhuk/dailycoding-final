#!/bin/bash
set -e

REPO_DIR="/home/ubuntu/dailycoding-final"
FRONTEND_DIST="/var/www/dailycoding/dist"

cd "$REPO_DIR"

echo "📦 [1/7] 코드 업데이트..."
git pull origin main

echo "🔧 [2/7] 백엔드 의존성..."
cd "$REPO_DIR/dailycoding-server"
npm ci --omit=dev

echo "🧪 [3/7] 공유 카탈로그 import 검증..."
node -e "import('./src/shared/problemCatalog.js').then((m)=>{ if(!Array.isArray(m.PROBLEMS) || m.PROBLEMS.length===0){ throw new Error('PROBLEMS export missing') } }).catch((err)=>{ console.error(err); process.exit(1) })"

echo "🏗  [4/7] 프론트엔드 빌드..."
cd "$REPO_DIR/dailycoding"
npm ci
VITE_API_URL="" npm run build

echo "📁 [5/7] 프론트엔드 배포..."
mkdir -p "$FRONTEND_DIST"
cp -r "$REPO_DIR/dailycoding/dist"/* "$FRONTEND_DIST"/

echo "🐳 [6/7] Docker (MySQL + Redis)..."
cd "$REPO_DIR"
docker compose up -d

echo "🔄 [7/7] PM2 재시작..."
cd "$REPO_DIR/dailycoding-server"
pm2 reload ecosystem.config.cjs --env production || pm2 start ecosystem.config.cjs --env production

echo "✅ 배포 완료!"
pm2 status
