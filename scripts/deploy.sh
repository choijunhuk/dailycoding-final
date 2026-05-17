#!/bin/bash
set -e

REPO_DIR="/home/ubuntu/dailycoding-final"
FRONTEND_DIST="/var/www/dailycoding/dist"

cd "$REPO_DIR"

echo "📦 [1/9] 코드 업데이트..."
git pull origin main

echo "🧪 [2/9] 프로덕션 설정 프리플라이트..."
NODE_ENV=production ALLOW_LOCAL_REDIS=1 ALLOW_SAME_ORIGIN_FRONTEND=1 node scripts/production-preflight.mjs dailycoding-server/.env dailycoding/.env.production

echo "🔧 [3/9] 백엔드 의존성..."
cd "$REPO_DIR/dailycoding-server"
npm ci --omit=dev

echo "🧪 [4/9] 공유 카탈로그 import 검증..."
node -e "import('./src/shared/problemCatalog.js').then((m)=>{ if(!Array.isArray(m.PROBLEMS) || m.PROBLEMS.length===0){ throw new Error('PROBLEMS export missing') } }).catch((err)=>{ console.error(err); process.exit(1) })"

echo "🏗  [5/9] 프론트엔드 빌드..."
cd "$REPO_DIR/dailycoding"
npm ci
VITE_API_URL="" npm run build

echo "📁 [6/9] 프론트엔드 배포..."
mkdir -p "$FRONTEND_DIST"
find "$FRONTEND_DIST" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -r "$REPO_DIR/dailycoding/dist"/* "$FRONTEND_DIST"/

echo "🐳 [7/9] Docker (MySQL + Redis)..."
cd "$REPO_DIR"
docker compose up -d

echo "🔄 [8/9] PM2 재시작..."
cd "$REPO_DIR/dailycoding-server"
pm2 reload ecosystem.config.cjs --env production || pm2 start ecosystem.config.cjs --env production

echo "🏥 [9/9] 헬스체크..."
HEALTH_URL="${HEALTH_URL:-https://dailycoding-final.com/api/health}"
EXPECTED_JUDGE_HEALTH="${EXPECTED_JUDGE_HEALTH:-docker}"
for attempt in 1 2 3 4 5; do
  if curl -fsS "$HEALTH_URL" >/tmp/dailycoding-health.json; then
    cat /tmp/dailycoding-health.json
    echo
    EXPECTED_JUDGE_HEALTH="$EXPECTED_JUDGE_HEALTH" node -e "const fs=require('fs'); const h=JSON.parse(fs.readFileSync('/tmp/dailycoding-health.json','utf8')); const s=h.services||{}; const expectedJudge=process.env.EXPECTED_JUDGE_HEALTH; const bad=[]; if(h.status!=='ok') bad.push('status'); if(s.database!=='connected') bad.push('database='+s.database); if(s.redis!=='connected') bad.push('redis='+s.redis); if(expectedJudge && s.judge!==expectedJudge) bad.push('judge='+s.judge); if(bad.length){ console.error('Health check degraded:', bad.join(', ')); process.exit(1); }"
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
