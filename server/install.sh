#!/usr/bin/env bash
# Setter opp automatisk bygging av frodewerner.no på serveren. Kjør som root, én gang: bash server/install.sh
# (kan kjøres på nytt uten skade). Er repoet privat, trengs en lesenøkkel («deploy key») på GitHub; skriptet lager den og forklarer.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Kjør som root (sudo bash server/install.sh)"; exit 1; }

APP=/opt/frodewerner-no
WWW=/var/www/frodewerner.no
STATE=/var/lib/frodewerner-build
REPO_HTTPS="https://github.com/Phroden/frodewerner-no.git"
REPO_SSH="git@github.com:Phroden/frodewerner-no.git"

echo "== Pakker"
apt-get update -qq
apt-get install -y -qq nodejs npm rsync curl jq git openssh-client util-linux >/dev/null
node -e 'process.exit(parseInt(process.versions.node) >= 20 ? 0 : 1)' || { echo "Node må være versjon 20 eller nyere (nå: $(node --version))."; exit 1; }

echo "== Bruker og mapper"
id sitebuild >/dev/null 2>&1 || useradd --system --home-dir "$STATE" --shell /usr/sbin/nologin sitebuild
mkdir -p "$STATE" "$APP" "$WWW"
chown -R sitebuild: "$STATE" "$APP" "$WWW"
chmod 755 "$WWW"

as_build() { sudo -u sitebuild -H env HOME="$STATE" "$@"; }

echo "== Hente koden"
if [ ! -d "$APP/.git" ]; then
  if as_build git ls-remote "$REPO_HTTPS" >/dev/null 2>&1; then
    as_build git clone --quiet "$REPO_HTTPS" "$APP"
  else
    KEY="$STATE/.ssh/id_ed25519"
    if [ ! -f "$KEY" ]; then
      as_build mkdir -p "$STATE/.ssh"; chmod 700 "$STATE/.ssh"
      as_build ssh-keygen -q -t ed25519 -N "" -C "frodewerner-build@$(hostname)" -f "$KEY"
    fi
    as_build bash -c "ssh-keyscan -t ed25519 github.com >> '$STATE/.ssh/known_hosts' 2>/dev/null"
    echo
    echo "Repoet er privat. Legg til denne nøkkelen på GitHub som «deploy key» (bare lesing):"
    echo "  github.com/Phroden/frodewerner-no → Settings → Deploy keys → Add deploy key (ikke kryss av for write access)"
    echo
    cat "$KEY.pub"
    echo
    read -r -p "Trykk Enter når nøkkelen er lagt til … " _
    as_build git clone --quiet "$REPO_SSH" "$APP"
  fi
fi
as_build git -C "$APP" remote get-url origin >/dev/null
as_build git -C "$APP" fetch --quiet origin main && as_build git -C "$APP" reset --hard --quiet origin/main

echo "== Caddy (frodewerner.no)"
# Oppsettet ligger i repoet (server/frodewerner.caddy). Er det endret, tas en kopi av det gamle; godtar ikke Caddy det nye, legges det gamle tilbake.
SITE_CADDY=/etc/caddy/sites/frodewerner.caddy
if command -v caddy >/dev/null && [ -f /etc/caddy/Caddyfile ]; then
  mkdir -p /etc/caddy/sites
  if ! cmp -s "$APP/server/frodewerner.caddy" "$SITE_CADDY"; then
    BACKUP=""
    if [ -f "$SITE_CADDY" ]; then BACKUP="$SITE_CADDY.bak-$(date +%Y%m%d-%H%M%S)"; cp "$SITE_CADDY" "$BACKUP"; fi
    install -m 644 "$APP/server/frodewerner.caddy" "$SITE_CADDY"
    if caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
      systemctl reload caddy
      echo "Caddy-oppsettet er oppdatert${BACKUP:+ (det gamle ligger i $BACKUP)}"
    else
      echo "Caddy godtok ikke det nye oppsettet – legger tilbake det gamle:"
      caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile 2>&1 | tail -3 || true
      if [ -n "$BACKUP" ]; then mv "$BACKUP" "$SITE_CADDY"; else rm -f "$SITE_CADDY"; fi
    fi
  else
    echo "Caddy-oppsettet er uendret"
  fi
else
  echo "Fant ikke Caddy – hopper over (frodewerner.caddy må legges inn for hånd)"
fi

echo "== systemd"
install -m 644 "$APP/server/frodewerner-build.service" /etc/systemd/system/
install -m 644 "$APP/server/frodewerner-build.timer" /etc/systemd/system/
chmod 755 "$APP/server/build-if-changed.sh"
systemctl daemon-reload
systemctl enable --now frodewerner-build.timer

echo "== Første bygging"
systemctl start frodewerner-build.service || echo "Første bygging feilet – se: journalctl -u frodewerner-build -n 40"
echo
echo "Ferdig. Følg med: journalctl -u frodewerner-build -f"
