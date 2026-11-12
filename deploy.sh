#!/usr/bin/env bash
# Bygger frodewerner.no og legger den ut på serveren. Kjør fra denne mappen: ./deploy.sh
# DEPLOY_HOST (standard root@frodewerner.no – samme server som Herah) og DEPLOY_PATH (standard /var/www/frodewerner.no) kan overstyres.
set -euo pipefail
cd "$(dirname "$0")"
HOST="${DEPLOY_HOST:-root@frodewerner.no}"
DEST="${DEPLOY_PATH:-/var/www/frodewerner.no}"

npm ci
# Feiler heller enn å publisere plassholdere hvis noe ikke er publisert i Herah
HERAH_ALLOW_FALLBACK=0 npm run build

rsync -az --delete dist/ "$HOST:$DEST/"
echo "Lagt ut til $HOST:$DEST"
