#!/bin/bash
# Disk usage alert (cron, every 10 min): warning at >=80%, critical at >=90%, recovery when back below.
# Always logs to syslog (tag taranom-disk-alert) and $STATE_DIR/disk-alert.log.
# Telegram push when TELEGRAM_BOT_TOKEN and DISK_ALERT_TELEGRAM_CHAT_ID are set in $ENV_FILE.
# DISK_ALERT_DRY_RUN=1 prints the message instead of sending it.
set -uo pipefail

WARN="${DISK_ALERT_WARN:-80}"
CRIT="${DISK_ALERT_CRIT:-90}"
MOUNT="${DISK_ALERT_MOUNT:-/}"
STATE_DIR="${DISK_ALERT_STATE_DIR:-/var/lib/taranom}"
ENV_FILE="${ENV_FILE:-/opt/taranom/.env}"
REPEAT_SEC="${DISK_ALERT_REPEAT_SEC:-21600}"
DRY_RUN="${DISK_ALERT_DRY_RUN:-0}"

read -r pct avail size < <(df -P -h "$MOUNT" | awk 'NR==2 { gsub("%", "", $5); print $5, $4, $2 }')
[ -n "${pct:-}" ] || { logger -t taranom-disk-alert -p user.err "df failed for $MOUNT"; exit 1; }

level=ok
[ "$pct" -ge "$WARN" ] && level=warning
[ "$pct" -ge "$CRIT" ] && level=critical

mkdir -p "$STATE_DIR"
state="$STATE_DIR/disk-alert.state"
prev_level=ok
prev_ts=0
[ -f "$state" ] && read -r prev_level prev_ts < "$state"
now=$(date +%s)

env_value() {
  [ -r "$ENV_FILE" ] || return 0
  grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d "\"'\r"
}

notify() {
  local prio="$1" text="$2"
  logger -t taranom-disk-alert -p "$prio" "$(head -1 <<<"$text")"
  echo "$(date -u +%FT%TZ) $(head -1 <<<"$text")" >> "$STATE_DIR/disk-alert.log"
  if [ "$DRY_RUN" = 1 ]; then
    printf '%s\n' "$text"
    return 0
  fi
  local token chat
  token=$(env_value TELEGRAM_BOT_TOKEN)
  chat=$(env_value DISK_ALERT_TELEGRAM_CHAT_ID)
  [ -n "$token" ] && [ -n "$chat" ] || return 0
  # Token via curl config on stdin so it never shows up in the process list or logs.
  if printf 'url = "https://api.telegram.org/bot%s/sendMessage"\n' "$token" |
    curl -fsS -m 15 -o /dev/null -K - --data-urlencode "chat_id=$chat" --data-urlencode "text=$text" 2>/dev/null; then
    logger -t taranom-disk-alert -p user.info "telegram sent ($level)"
  else
    logger -t taranom-disk-alert -p user.err "telegram push failed ($level)"
  fi
}

body() {
  printf '%s\nhost: %s\nmount: %s\nfree: %s of %s\nused: %s%%\nthresholds: warn %s%% / crit %s%%\ntime: %s' \
    "$1" "$(hostname)" "$MOUNT" "$avail" "$size" "$pct" "$WARN" "$CRIT" "$(date -u '+%Y-%m-%d %H:%M:%S UTC')"
}

if [ "$level" = ok ]; then
  if [ "$prev_level" != ok ]; then
    notify user.notice "$(body "[recovered] disk usage back below ${WARN}%")"
  fi
  echo "ok $now" > "$state"
  exit 0
fi

# Same level again: repeat only every REPEAT_SEC; escalation alerts immediately.
if [ "$level" = "$prev_level" ] && [ $((now - prev_ts)) -lt "$REPEAT_SEC" ]; then
  exit 0
fi

prio=user.warning
[ "$level" = critical ] && prio=user.crit
notify "$prio" "$(body "[$level] disk usage ${pct}%")"
echo "$level $now" > "$state"
