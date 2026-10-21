#!/bin/bash
# Disk usage alert (cron, every 10 min): warning at >=80%, critical at >=90%.
# Always logs to syslog (tag taranom-disk-alert) and $STATE_DIR/disk-alert.log.
# Telegram push only when DISK_ALERT_TELEGRAM_CHAT_ID is set in .env (reuses TELEGRAM_BOT_TOKEN).
set -uo pipefail

WARN="${DISK_ALERT_WARN:-80}"
CRIT="${DISK_ALERT_CRIT:-90}"
MOUNT="${DISK_ALERT_MOUNT:-/}"
STATE_DIR="${DISK_ALERT_STATE_DIR:-/var/lib/taranom}"
ENV_FILE="${ENV_FILE:-/opt/taranom/.env}"
REPEAT_SEC="${DISK_ALERT_REPEAT_SEC:-21600}"

pct=$(df -P "$MOUNT" | awk 'NR==2 { gsub("%", "", $5); print $5 }')
[ -n "$pct" ] || { logger -t taranom-disk-alert -p user.err "df failed for $MOUNT"; exit 1; }

level=ok
[ "$pct" -ge "$WARN" ] && level=warning
[ "$pct" -ge "$CRIT" ] && level=critical

mkdir -p "$STATE_DIR"
state="$STATE_DIR/disk-alert.state"
prev_level=ok
prev_ts=0
[ -f "$state" ] && read -r prev_level prev_ts < "$state"
now=$(date +%s)

if [ "$level" = ok ]; then
  [ "$prev_level" != ok ] && logger -t taranom-disk-alert -p user.notice "recovered: $MOUNT at ${pct}%"
  echo "ok $now" > "$state"
  exit 0
fi

# Same level again: repeat only every REPEAT_SEC; escalation alerts immediately.
if [ "$level" = "$prev_level" ] && [ $((now - prev_ts)) -lt "$REPEAT_SEC" ]; then
  exit 0
fi

msg="[$level] $(hostname) disk $MOUNT at ${pct}% (warn ${WARN}%, crit ${CRIT}%)"
prio=user.warning
[ "$level" = critical ] && prio=user.crit
logger -t taranom-disk-alert -p "$prio" "$msg"
echo "$(date -u +%FT%TZ) $msg" >> "$STATE_DIR/disk-alert.log"

env_value() {
  [ -r "$ENV_FILE" ] || return 0
  grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d "\"'\r"
}
token=$(env_value TELEGRAM_BOT_TOKEN)
chat=$(env_value DISK_ALERT_TELEGRAM_CHAT_ID)
if [ -n "$token" ] && [ -n "$chat" ]; then
  # Token via curl config on stdin so it never shows up in the process list.
  printf 'url = "https://api.telegram.org/bot%s/sendMessage"\n' "$token" |
    curl -fsS -m 10 -o /dev/null -K - --data-urlencode "chat_id=$chat" --data-urlencode "text=$msg" ||
    logger -t taranom-disk-alert -p user.err "telegram push failed"
fi

echo "$level $now" > "$state"
