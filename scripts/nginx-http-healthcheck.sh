#!/bin/bash
# ============================================================================
# nginx edge contract: every http:// host → exactly one 301 to its canonical
# https origin (path + query kept), ACME webroot reachable on http without a
# redirect, unknown Host closed (444), HSTS max-age only (no includeSubDomains,
# no preload) on https and never on http.
#
# Used by scripts/auto-deploy.sh (against the live container on 127.0.0.1) and
# by scripts/tests/nginx-config.test.sh in CI (against a throwaway container).
# Exit 1 on the first mismatch.
# ============================================================================
set -euo pipefail

IP="${NGINX_CHECK_IP:-127.0.0.1}"
HTTP_PORT="${NGINX_CHECK_HTTP_PORT:-80}"
HTTPS_PORT="${NGINX_CHECK_HTTPS_PORT:-443}"
HSTS_EXPECTED="max-age=31536000"
PROBE_PATH='/about?hc=1&utm_source=test'

fail() {
  echo "nginx healthcheck FAIL: $*" >&2
  exit 1
}

canonical_for() {
  case "$1" in
    poshaktaranom.ir | www.poshaktaranom.ir) echo "https://www.poshaktaranom.ir" ;;
    poshaktaranom.com | www.poshaktaranom.com) echo "https://poshaktaranom.com" ;;
    api.poshaktaranom.com) echo "https://api.poshaktaranom.com" ;;
    *) return 1 ;;
  esac
}

for h in poshaktaranom.ir www.poshaktaranom.ir poshaktaranom.com www.poshaktaranom.com api.poshaktaranom.com; do
  exp="$(canonical_for "$h")${PROBE_PATH}"
  out="$(curl -s -o /dev/null -m10 -w '%{http_code} %{redirect_url}' \
    -H "Host: $h" "http://${IP}:${HTTP_PORT}${PROBE_PATH}" || true)"
  [ "$out" = "301 $exp" ] || fail "http redirect $h: got '$out', want '301 $exp'"

  hsts_http="$(curl -s -o /dev/null -D - -m10 -H "Host: $h" "http://${IP}:${HTTP_PORT}/" \
    | grep -i '^strict-transport-security:' || true)"
  [ -z "$hsts_http" ] || fail "HSTS must not be sent on http ($h)"

  acme="$(curl -s -o /dev/null -m10 -w '%{http_code}' \
    -H "Host: $h" "http://${IP}:${HTTP_PORT}/.well-known/acme-challenge/hc-probe" || true)"
  [ "$acme" = "404" ] || fail "ACME path on http $h: got '$acme', want 404 (no redirect)"
done

unknown="$(curl -s -o /dev/null -m10 -w '%{http_code}' \
  -H 'Host: unknown.invalid' "http://${IP}:${HTTP_PORT}/" || true)"
[ "$unknown" = "000" ] || fail "unknown Host on http: got '$unknown', want closed connection (444)"

for h in www.poshaktaranom.ir poshaktaranom.com poshaktaranom.ir www.poshaktaranom.com api.poshaktaranom.com; do
  values="$(curl -sk -o /dev/null -D - -m15 --resolve "${h}:${HTTPS_PORT}:${IP}" "https://${h}:${HTTPS_PORT}/" \
    | grep -i '^strict-transport-security:' | sed -E 's/^[^:]+:[[:space:]]*//; s/[[:space:]]+$//' | tr -d '\r' || true)"
  [ "$values" = "$HSTS_EXPECTED" ] || fail "HSTS on https://$h: got '${values//$'\n'/ | }', want exactly '$HSTS_EXPECTED'"
done

echo "nginx healthcheck OK (http→https single hop, ACME 404, unknown Host 444, HSTS ${HSTS_EXPECTED})"
