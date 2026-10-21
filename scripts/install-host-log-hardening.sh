#!/bin/bash
# Idempotent host log caps + disk alert for the Hetzner origin. Run as a sudoer:
#   bash scripts/install-host-log-hardening.sh
# Does not restart dockerd (daemon.json log-opts only reach containers created afterwards)
# and never touches backups.
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/taranom}"
SAVE_DIR=/var/backups/taranom-host
STAMP=$(date -u +%Y%m%dT%H%M%SZ)

sudo mkdir -p "$SAVE_DIR"
save() { [ -e "$1" ] && sudo cp -a "$1" "$SAVE_DIR/$(basename "$1").$STAMP" || true; }

# 1) syslog family: daily + 100M cap, 7 compressed generations. No delaycompress: rsyslog-rotate HUPs rsyslogd.
save /etc/logrotate.d/rsyslog
sudo tee /etc/logrotate.d/rsyslog >/dev/null <<'EOF'
/var/log/syslog
/var/log/mail.log
/var/log/kern.log
/var/log/auth.log
/var/log/user.log
/var/log/cron.log
{
	daily
	maxsize 100M
	rotate 7
	missingok
	notifempty
	compress
	sharedscripts
	postrotate
		/usr/lib/rsyslog/rsyslog-rotate
	endscript
}
EOF
sudo logrotate -d /etc/logrotate.d/rsyslog >/dev/null 2>&1

# maxsize is only evaluated when logrotate runs: run it hourly.
sudo mkdir -p /etc/systemd/system/logrotate.timer.d
sudo tee /etc/systemd/system/logrotate.timer.d/taranom-hourly.conf >/dev/null <<'EOF'
[Timer]
OnCalendar=
OnCalendar=hourly
AccuracySec=5m
EOF

# 2) journald cap.
sudo mkdir -p /etc/systemd/journald.conf.d
sudo tee /etc/systemd/journald.conf.d/taranom.conf >/dev/null <<'EOF'
[Journal]
SystemMaxUse=300M
SystemMaxFileSize=50M
MaxRetentionSec=14day
EOF

# 3) Cloudflare WARP debug chatter stays in the (capped) journal, not in /var/log/syslog.
sudo tee /etc/rsyslog.d/30-taranom-noise.conf >/dev/null <<'EOF'
if $programname == 'warp-svc' then stop
EOF
sudo rsyslogd -N1 >/dev/null 2>&1

# 4) lead-api (separate project) crash-loops every 7s while lead_postgres is stopped: slow the loop, keep it enabled.
if systemctl cat lead-api.service >/dev/null 2>&1; then
  sudo mkdir -p /etc/systemd/system/lead-api.service.d
  sudo tee /etc/systemd/system/lead-api.service.d/taranom-throttle.conf >/dev/null <<'EOF'
[Service]
RestartSec=600
EOF
fi

# 5) Docker default log caps for containers created from now on.
if [ ! -e /etc/docker/daemon.json ]; then
  sudo tee /etc/docker/daemon.json >/dev/null <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
EOF
else
  echo "WARN /etc/docker/daemon.json exists; not modified" >&2
fi

# 6) Disk alert every 10 minutes.
sudo chmod +x "$APP_DIR/scripts/disk-alert.sh"
sudo mkdir -p /var/lib/taranom
sudo tee /etc/cron.d/taranom-disk-alert >/dev/null <<EOF
*/10 * * * * root $APP_DIR/scripts/disk-alert.sh
EOF
sudo chmod 644 /etc/cron.d/taranom-disk-alert

sudo systemctl daemon-reload
sudo systemctl restart systemd-journald rsyslog
sudo systemctl restart logrotate.timer
sudo journalctl --vacuum-size=300M >/dev/null 2>&1 || true
sudo logrotate -f /etc/logrotate.d/rsyslog

echo "host log hardening applied (saved originals in $SAVE_DIR)"
