#!/bin/bash
# Install/refresh taranom-warm-homes systemd units from the repo copy.
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/taranom}"
UNIT_DIR=/etc/systemd/system

sudo cp "$APP_DIR/deploy/systemd/taranom-warm-homes.service" "$UNIT_DIR/"
sudo cp "$APP_DIR/deploy/systemd/taranom-warm-homes.timer" "$UNIT_DIR/"
sudo chmod +x "$APP_DIR/scripts/warm-storefront-homes.sh"
sudo systemctl daemon-reload
sudo systemctl enable --now taranom-warm-homes.timer
sudo systemctl start taranom-warm-homes.service
systemctl status taranom-warm-homes.timer --no-pager
journalctl -u taranom-warm-homes.service -n 20 --no-pager
