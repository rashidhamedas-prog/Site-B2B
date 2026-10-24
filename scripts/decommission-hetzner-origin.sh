#!/usr/bin/env bash
# Quarantine the decommissioned Hetzner/Germany origin so it cannot serve or
# auto-deploy. Run ONCE on 5.75.200.102 as wholesale-admin (sudo).
# Does not delete the cloud VM — that is a console/API step after Iran smoke.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/taranom}"
MARKER="/etc/taranom/HETZNER_DECOMMISSIONED"

echo "$(date -Is) disabling auto-deploy timer/service..."
sudo systemctl stop taranom-autodeploy.timer 2>/dev/null || true
sudo systemctl disable taranom-autodeploy.timer 2>/dev/null || true
sudo systemctl stop taranom-autodeploy.service 2>/dev/null || true
sudo systemctl disable taranom-autodeploy.service 2>/dev/null || true

echo "$(date -Is) stopping warm-homes / ops timers if present..."
sudo systemctl stop taranom-warm-homes.timer 2>/dev/null || true
sudo systemctl disable taranom-warm-homes.timer 2>/dev/null || true
sudo systemctl stop omnichannel-ops-backup.timer 2>/dev/null || true
sudo systemctl disable omnichannel-ops-backup.timer 2>/dev/null || true

if [[ -d "$APP_DIR" ]]; then
  echo "$(date -Is) stopping docker compose stack in $APP_DIR..."
  cd "$APP_DIR"
  docker compose down --remove-orphans || sudo docker compose down --remove-orphans
fi

sudo mkdir -p /etc/taranom
sudo tee "$MARKER" >/dev/null <<EOF
decommissioned_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
reason=sole_iran_origin
do_not_restart_stack=1
EOF

echo "$(date -Is) hetzner_quarantine_ok marker=$MARKER"
echo "Next (human/console): destroy the Hetzner cloud VM after Iran smoke passes."
