#!/usr/bin/env bash
# Install daily Postgres backup cron on the sole Iran production host.
# Run on Iran as root (or sudo):
#   sudo bash /opt/taranom/scripts/install-postgres-backup-cron.sh
set -euo pipefail

ROOT="${TARANOM_ROOT:-/opt/taranom}"
DEPLOY_USER="${DEPLOY_USER:-tnadmin}"
CRON_FILE="/etc/cron.d/taranom-postgres-backup"
LOG_FILE="/var/log/taranom-backup.log"
SCRIPT="$ROOT/scripts/backup-postgres.sh"
BACKUP_ROOT="$ROOT/backups/postgres"

if [[ ! -f "$SCRIPT" ]]; then
  echo "missing $SCRIPT" >&2
  exit 1
fi

chmod +x "$SCRIPT"
mkdir -p "$BACKUP_ROOT"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT"

touch "$LOG_FILE"
chown "${DEPLOY_USER}:${DEPLOY_USER}" "$LOG_FILE"
chmod 640 "$LOG_FILE"

cat >"$CRON_FILE" <<EOF
# Taranom sole-Iran Postgres backup (UTC). Managed by scripts/install-postgres-backup-cron.sh
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
15 2 * * * ${DEPLOY_USER} /bin/bash ${SCRIPT} >>${LOG_FILE} 2>&1
EOF
chmod 644 "$CRON_FILE"

echo "installed $CRON_FILE"
echo "running one-shot backup now..."
if id -nG "$DEPLOY_USER" 2>/dev/null | grep -qw docker; then
  sudo -u "$DEPLOY_USER" -H sg docker -c "bash $SCRIPT" || bash "$SCRIPT"
else
  bash "$SCRIPT"
fi
echo "install_ok"
