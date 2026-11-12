#!/usr/bin/env bash
# Bygger frodewerner.no på nytt hvis noe har endret seg, og legger den ut. Kjøres hvert minutt av systemd (frodewerner-build.timer).
# «Endret» = ny kode i repoet (origin/main) ELLER ny versjon fra Herah (/api/site/version, som bare endrer seg når noe publisert endres).
set -euo pipefail

main() {
  local APP="${APP_DIR:-/opt/frodewerner-no}" WWW="${WWW_DIR:-/var/www/frodewerner.no}" STATE="${STATE_DIR:-/var/lib/frodewerner-build}"
  local API="${HERAH_API:-https://herah.frodewerner.no}"

  exec 9>"$STATE/lock"
  flock -n 9 || return 0   # en bygging pågår allerede

  cd "$APP"
  git fetch --quiet origin main
  local head version key
  head="$(git rev-parse origin/main)"
  version="$(curl -fsS --max-time 20 "$API/api/site/version" | jq -er .version)"
  key="$head:$version"

  if [ -f "$STATE/built" ] && [ "$(cat "$STATE/built")" = "$key" ]; then return 0; fi
  # Feilet akkurat denne kombinasjonen nylig, vent 10 minutter før neste forsøk (ikke bygg i ring)
  if [ -f "$STATE/failed" ]; then
    local fkey ftime
    read -r fkey ftime < "$STATE/failed" || true
    if [ "${fkey:-}" = "$key" ] && [ $(( $(date +%s) - ${ftime:-0} )) -lt 600 ]; then return 0; fi
  fi

  echo "Bygger $key"
  git reset --hard --quiet "$head"
  local lock
  lock="$(sha256sum package-lock.json | cut -d' ' -f1)"
  if [ ! -d node_modules ] || [ "$(cat "$STATE/lock-hash" 2>/dev/null || true)" != "$lock" ]; then
    npm ci --no-audit --no-fund
    echo "$lock" > "$STATE/lock-hash"
  fi

  # HERAH_ALLOW_FALLBACK=0: feiler heller enn å publisere plassholdere, og da blir forrige versjon stående
  if HERAH_API="$API" HERAH_ALLOW_FALLBACK=0 npm run build; then
    rsync -a --delete dist/ "$WWW/"
    echo "$key" > "$STATE/built"
    rm -f "$STATE/failed"
    echo "Lagt ut $key"
  else
    echo "$key $(date +%s)" > "$STATE/failed"
    echo "Bygget feilet – forrige versjon står fortsatt" >&2
    return 1
  fi
}

# Hele skriptet ligger i main(), så git reset midt i kjøringen ikke kan endre skriptet mens bash leser det
main "$@"
exit $?
