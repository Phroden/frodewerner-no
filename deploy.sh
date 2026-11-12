#!/usr/bin/env bash
# Bygger frodewerner.no og legger den ut på serveren. Kjør fra denne mappen: ./deploy.sh
# DEPLOY_HOST (standard root@frodewerner.no – samme server som Herah) og DEPLOY_PATH (standard /var/www/frodewerner.no) kan overstyres.
set -euo pipefail
cd "$(dirname "$0")"
HOST="${DEPLOY_HOST:-root@frodewerner.no}"
DEST="${DEPLOY_PATH:-/var/www/frodewerner.no}"

npm ci
# Versjonen fra Herah FØR bygget (til /herah-build.json); går det ikke, blir den tom, og Herah regner byggestatus som ukjent
API="${HERAH_API:-https://herah.frodewerner.no}"
VERSION="$(curl -fsS --max-time 20 "$API/api/site/version" | node -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).version??"")}catch{}})' || true)"
# Feiler heller enn å publisere plassholdere hvis noe ikke er publisert i Herah
HERAH_VERSION="$VERSION" HERAH_COMMIT="$(git rev-parse HEAD 2>/dev/null || true)" HERAH_ALLOW_FALLBACK=0 npm run build

rsync -az --delete dist/ "$HOST:$DEST/"
echo "Lagt ut til $HOST:$DEST"
