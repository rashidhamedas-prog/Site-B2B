#!/usr/bin/env bash
# Static fail-closed guards for scripts/e2e-purchase-test.sh.
# These must fail BEFORE login/SQL/order mutation. No live API required for most cases.
set -euo pipefail
cd "$(dirname "$0")/.."
SCRIPT=./scripts/e2e-purchase-test.sh

echo "=== argv injection proof ==="
OUT=$(python -c 'from urllib.parse import urlparse; import sys; print(repr(urlparse(sys.argv[1]).hostname))' "http://evil.com';print('PWNED')")
echo "parsed=$OUT"
[[ "$OUT" == *"PWNED"* ]] && { echo "FAIL: injection executed"; exit 2; }
echo "ARGV_OK exit=0"

echo "=== custom host bypass rejected ==="
set +e
OUT=$(E2E_ALLOW_CUSTOM_HOST=1 E2E_TARGET=local E2E_ALLOW_MUTATION=1 E2E_PHONE=1 E2E_PASSWORD=1 E2E_PRODUCT_ID=1 \
  API_URL='http://127.0.0.1:9/v1' WEB_URL='http://127.0.0.1:9' "$SCRIPT" 2>&1)
EC=$?
set -e
echo "$OUT" | head -n 5
[[ $EC -ne 0 ]] && echo "$OUT" | grep -q 'E2E_ALLOW_CUSTOM_HOST is removed' && echo "BYPASS_OK exit=$EC" || { echo "BYPASS_FAIL"; exit 3; }

echo "=== prod hostname denied ==="
set +e
OUT=$(E2E_TARGET=local E2E_ALLOW_MUTATION=1 E2E_PHONE=1 E2E_PASSWORD=1 E2E_PRODUCT_ID=1 \
  API_URL='https://api.poshaktaranom.com/v1' WEB_URL='http://127.0.0.1:9' "$SCRIPT" 2>&1)
EC=$?
set -e
echo "$OUT" | head -n 5
[[ $EC -ne 0 ]] && echo "$OUT" | grep -qi 'not in immutable allowlist\|production\|forbidden' && echo "PROD_HOST_OK exit=$EC" || { echo "PROD_HOST_FAIL"; exit 4; }

echo "=== prod IP as host denied ==="
set +e
OUT=$(E2E_TARGET=local E2E_ALLOW_MUTATION=1 E2E_PHONE=1 E2E_PASSWORD=1 E2E_PRODUCT_ID=1 \
  API_URL='http://5.75.200.102:4000/v1' WEB_URL='http://127.0.0.1:9' "$SCRIPT" 2>&1)
EC=$?
set -e
echo "$OUT" | head -n 5
[[ $EC -ne 0 ]] && echo "$OUT" | grep -qi 'not in immutable allowlist\|production\|forbidden\|5\.75\.200\.102' && echo "PROD_IP_OK exit=$EC" || { echo "PROD_IP_FAIL"; exit 5; }

echo "=== production alias (www) denied ==="
set +e
OUT=$(E2E_TARGET=local E2E_ALLOW_MUTATION=1 E2E_PHONE=1 E2E_PASSWORD=1 E2E_PRODUCT_ID=1 \
  API_URL='https://www.poshaktaranom.com/v1' WEB_URL='http://127.0.0.1:9' "$SCRIPT" 2>&1)
EC=$?
set -e
echo "$OUT" | head -n 5
[[ $EC -ne 0 ]] && echo "$OUT" | grep -qi 'not in immutable allowlist\|production\|forbidden' && echo "PROD_ALIAS_OK exit=$EC" || { echo "PROD_ALIAS_FAIL"; exit 6; }

echo "=== E2E_ALLOWED_API_HOSTS override rejected ==="
set +e
OUT=$(E2E_ALLOWED_API_HOSTS='evil.example' E2E_TARGET=local E2E_ALLOW_MUTATION=1 E2E_PHONE=1 E2E_PASSWORD=1 E2E_PRODUCT_ID=1 \
  API_URL='http://127.0.0.1:9/v1' WEB_URL='http://127.0.0.1:9' "$SCRIPT" 2>&1)
EC=$?
set -e
echo "$OUT" | head -n 5
[[ $EC -ne 0 ]] && echo "$OUT" | grep -qi 'E2E_ALLOWED_API_HOSTS overrides are forbidden' && echo "ALLOW_API_OK exit=$EC" || { echo "ALLOW_API_FAIL"; exit 7; }

echo "=== E2E_ALLOWED_WEB_HOSTS override rejected ==="
set +e
OUT=$(E2E_ALLOWED_WEB_HOSTS='evil.example' E2E_TARGET=local E2E_ALLOW_MUTATION=1 E2E_PHONE=1 E2E_PASSWORD=1 E2E_PRODUCT_ID=1 \
  API_URL='http://127.0.0.1:9/v1' WEB_URL='http://127.0.0.1:9' "$SCRIPT" 2>&1)
EC=$?
set -e
echo "$OUT" | head -n 5
[[ $EC -ne 0 ]] && echo "$OUT" | grep -qi 'E2E_ALLOWED_WEB_HOSTS overrides are forbidden' && echo "ALLOW_WEB_OK exit=$EC" || { echo "ALLOW_WEB_FAIL"; exit 8; }

echo "=== SQL UPDATE users paths removed ==="
# Reject residual mutation paths only (forbid-message env names are OK).
if grep -nE 'UPDATE[[:space:]]+users|passwordHash|docker exec.*psql|psql -U' "$SCRIPT" >/dev/null 2>&1; then
  echo "SQL_PATH_FAIL: residual SQL mutate path found:"
  grep -nE 'UPDATE[[:space:]]+users|passwordHash|docker exec.*psql|psql -U' "$SCRIPT" || true
  exit 9
fi
echo "SQL_GONE_OK"

echo "=== identity fixture missing fails before mutation ==="
set +e
OUT=$(E2E_IDENTITY_FIXTURE=/tmp/e2e-missing-identity-$$.json \
  E2E_TARGET=local E2E_ALLOW_MUTATION=1 E2E_PHONE=1 E2E_PASSWORD=1 E2E_PRODUCT_ID=1 \
  API_URL='http://127.0.0.1:9/v1' WEB_URL='http://127.0.0.1:9' "$SCRIPT" 2>&1)
EC=$?
set -e
echo "$OUT" | head -n 8
# Must fail on fixture/allowlist/identity — never reach login mutation wording success.
[[ $EC -ne 0 ]] || { echo "MISSING_FIXTURE_FAIL: expected non-zero"; exit 10; }
echo "$OUT" | grep -qi 'identity fixture\|E2E_IDENTITY_FIXTURE\|Missing E2E identity\|overrides are forbidden\|not in immutable allowlist\|production' \
  || { echo "MISSING_FIXTURE_FAIL: unexpected error text"; exit 10; }
# Must not have attempted login (no token / Logged in).
echo "$OUT" | grep -qi 'Logged in\|accessToken\|Create order' && { echo "MISSING_FIXTURE_FAIL: reached mutation stage"; exit 10; }
echo "MISSING_FIXTURE_OK exit=$EC"

echo "=== redirect staging→prod note ==="
echo "DOC: identity fetch uses curl --max-redirs 0; effective host must equal API host (blocks staging→prod redirect)."

echo "ALL_NEGATIVE_GUARDS_PASSED"
