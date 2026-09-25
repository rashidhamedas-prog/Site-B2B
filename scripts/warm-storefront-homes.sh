#!/bin/bash
# ============================================================================
# Keep critical storefront HTML warm in Next ISR so Iran/field traffic
# rarely pays a cold SSR TTFB (CWV LCP). Hits the local web container
# with public Host headers — same shape as CMS on-demand warm.
#
# Intended for systemd timer every ~50s (matches s-maxage=60).
# Safe to overlap-skip via flock; best-effort (non-zero only if all fail).
# ============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/taranom}"
LOCK_FILE="/tmp/taranom-warm-homes.lock"
WEB_BASE="${WEB_INTERNAL_URL:-http://127.0.0.1:3000}"
WEB_BASE="${WEB_BASE%/}"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "$(date -Is) warm already running — skip"
  exit 0
fi

warm() {
  local channel="$1" host="$2" path="$3"
  local out code ttfb
  out="$(
    curl -sS -o /dev/null \
      --max-time 20 \
      -w "%{http_code} %{time_starttransfer}" \
      -H "Host: ${host}" \
      -H "x-forwarded-host: ${host}" \
      -H "x-forwarded-proto: https" \
      -H "x-taranom-channel: ${channel}" \
      -H "x-taranom-revalidate-warm: 1" \
      -A "taranom-warm-homes/1.0" \
      "${WEB_BASE}${path}" 2>/dev/null || echo "000 0"
  )"
  code="${out%% *}"
  ttfb="${out##* }"
  echo "$(date -Is) ${channel} ${path} code=${code} ttfb=${ttfb}s"
  [[ "$code" =~ ^2 ]] || [[ "$code" == "307" ]] || [[ "$code" == "308" ]]
}

ok=0
fail=0

# Homes first (LCP field samples), then catalog (previous lab LCP pain).
for row in \
  "RETAIL|www.poshaktaranom.ir|/" \
  "WHOLESALE|poshaktaranom.com|/" \
  "RETAIL|www.poshaktaranom.ir|/products" \
  "WHOLESALE|poshaktaranom.com|/products"
do
  IFS='|' read -r channel host path <<<"$row"
  if warm "$channel" "$host" "$path"; then
    ok=$((ok + 1))
  else
    fail=$((fail + 1))
  fi
done

if [ "$ok" -eq 0 ]; then
  echo "$(date -Is) warm failed for all targets" >&2
  exit 1
fi
echo "$(date -Is) warm done ok=${ok} fail=${fail}"
exit 0
