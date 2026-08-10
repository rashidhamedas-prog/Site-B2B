#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "=== argv injection proof ==="
OUT=$(python -c 'from urllib.parse import urlparse; import sys; print(repr(urlparse(sys.argv[1]).hostname))' "http://evil.com';print('PWNED')")
echo "parsed=$OUT"
[[ "$OUT" == *"PWNED"* ]] && { echo "FAIL: injection executed"; exit 2; }
echo "ARGV_OK exit=0"

echo "=== custom host bypass rejected ==="
set +e
OUT=$(E2E_ALLOW_CUSTOM_HOST=1 E2E_TARGET=local E2E_ALLOW_MUTATION=1 E2E_PHONE=1 E2E_PASSWORD=1 E2E_PRODUCT_ID=1 \
  API_URL='http://127.0.0.1:9/v1' WEB_URL='http://127.0.0.1:9' ./scripts/e2e-purchase-test.sh 2>&1)
EC=$?
set -e
echo "$OUT" | head -n 5
[[ $EC -ne 0 ]] && echo "$OUT" | grep -q 'E2E_ALLOW_CUSTOM_HOST is removed' && echo "BYPASS_OK exit=$EC" || { echo "BYPASS_FAIL"; exit 3; }

echo "=== prod host denied ==="
set +e
OUT=$(E2E_TARGET=local E2E_ALLOW_MUTATION=1 E2E_PHONE=1 E2E_PASSWORD=1 E2E_PRODUCT_ID=1 \
  API_URL='https://api.poshaktaranom.com/v1' WEB_URL='http://127.0.0.1:9' ./scripts/e2e-purchase-test.sh 2>&1)
EC=$?
set -e
echo "$OUT" | head -n 5
[[ $EC -ne 0 ]] && echo "$OUT" | grep -qi 'not in exact allowlist\|production' && echo "PROD_OK exit=$EC" || { echo "PROD_FAIL"; exit 4; }

echo "=== sql without disposable sentinel ==="
set +e
OUT=$(E2E_TARGET=staging E2E_ALLOW_MUTATION=1 E2E_PHONE=1 E2E_PASSWORD=1 E2E_PRODUCT_ID=1 \
  E2E_ALLOW_DB_ACTIVATE=1 E2E_POSTGRES_DB=taranom_db E2E_POSTGRES_CONTAINER=taranom_postgres \
  API_URL='http://127.0.0.1:9/v1' WEB_URL='http://127.0.0.1:9' ./scripts/e2e-purchase-test.sh 2>&1)
EC=$?
set -e
echo "$OUT" | head -n 8
[[ $EC -ne 0 ]] && echo "$OUT" | grep -qi 'disposable\|production\|sentinel\|E2E_TARGET' && echo "SQL_OK exit=$EC" || { echo "SQL_FAIL"; exit 5; }

echo "=== disposable sentinel override rejected ==="
set +e
OUT=$(E2E_DISPOSABLE_DB=evil_db E2E_TARGET=disposable E2E_ALLOW_MUTATION=1 E2E_PHONE=1 E2E_PASSWORD=1 E2E_PRODUCT_ID=1 \
  API_URL='http://127.0.0.1:9/v1' WEB_URL='http://127.0.0.1:9' ./scripts/e2e-purchase-test.sh 2>&1)
EC=$?
set -e
echo "$OUT" | head -n 5
[[ $EC -ne 0 ]] && echo "$OUT" | grep -qi 'override forbidden\|immutable sentinel' && echo "SENTINEL_OK exit=$EC" || { echo "SENTINEL_FAIL"; exit 6; }

echo "ALL_NEGATIVE_GUARDS_PASSED"
