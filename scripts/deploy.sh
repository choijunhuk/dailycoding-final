#!/bin/bash
set -e

# Auto-detect repo root from script location unless overridden
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${REPO_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
FRONTEND_DIST="${FRONTEND_DIST:-/var/www/dailycoding/dist}"

cd "$REPO_DIR"

# Ensure node/npm/pm2/docker on PATH for non-interactive SSH (GitHub Actions)
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
fi

echo "📦 [1/8] 코드 업데이트..."
git fetch origin main
git reset --hard origin/main

echo "🧪 [2/8] 프로덕션 설정 프리플라이트..."
NODE_ENV=production ALLOW_LOCAL_REDIS=1 ALLOW_SAME_ORIGIN_FRONTEND=1 \
  node scripts/production-preflight.mjs dailycoding-server/.env dailycoding/.env.production

echo "🧪 [3/8] 공유 카탈로그 import 검증..."
( cd "$REPO_DIR/dailycoding-server" && node -e "import('./src/shared/problemCatalog.js').then((m)=>{ if(!Array.isArray(m.PROBLEMS) || m.PROBLEMS.length===0){ throw new Error('PROBLEMS export missing') } console.log('PROBLEMS:', m.PROBLEMS.length) }).catch((err)=>{ console.error(err); process.exit(1) })" )

echo "🏗  [4/8] 프론트엔드 빌드..."
cd "$REPO_DIR/dailycoding"
npm ci
VITE_API_URL="" npm run build

echo "📁 [5/8] 프론트엔드 배포..."
mkdir -p "$FRONTEND_DIST"
find "$FRONTEND_DIST" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -r "$REPO_DIR/dailycoding/dist"/* "$FRONTEND_DIST"/

echo "🐳 [6/8] Docker 백엔드 빌드 + 재시작..."
cd "$REPO_DIR"
docker compose up -d --build backend
docker compose up -d mysql redis

if [ -f "$REPO_DIR/Dockerfile.kotlin" ] && ! docker image inspect dailycoding-kotlin:latest >/dev/null 2>&1; then
  echo "  ↳ Kotlin judge 이미지 빌드 중..."
  docker build -f "$REPO_DIR/Dockerfile.kotlin" -t dailycoding-kotlin:latest "$REPO_DIR"
fi

echo "⏳ [7/8] 백엔드 기동 대기..."
sleep 5

echo "🏥 [8/8] 헬스체크..."
HEALTH_URL="${HEALTH_URL:-https://dailycoding-final.com/api/health}"
EXPECTED_JUDGE_HEALTH="${EXPECTED_JUDGE_HEALTH:-docker}"
for attempt in 1 2 3 4 5 6 7 8; do
  if curl -fsS "$HEALTH_URL" >/tmp/dailycoding-health.json; then
    cat /tmp/dailycoding-health.json
    echo
    EXPECTED_JUDGE_HEALTH="$EXPECTED_JUDGE_HEALTH" node -e "const fs=require('fs'); const h=JSON.parse(fs.readFileSync('/tmp/dailycoding-health.json','utf8')); const s=h.services||{}; const expectedJudge=process.env.EXPECTED_JUDGE_HEALTH; const bad=[]; if(h.status!=='ok') bad.push('status'); if(s.database!=='connected') bad.push('database='+s.database); if(s.redis!=='connected') bad.push('redis='+s.redis); if(expectedJudge && s.judge!==expectedJudge) bad.push('judge='+s.judge); if(bad.length){ console.error('Health check degraded:', bad.join(', ')); process.exit(1); }"
    break
  fi
  if [ "$attempt" -eq 8 ]; then
    echo "❌ 헬스체크 실패: $HEALTH_URL"
    docker compose logs --tail=50 backend
    exit 1
  fi
  sleep 3
done

echo "✅ 배포 완료!"
docker compose ps
