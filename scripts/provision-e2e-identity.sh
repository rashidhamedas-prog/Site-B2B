#!/usr/bin/env bash
# Provision an immutable E2E environment identity fixture for non-production stacks.
# Writes scripts/fixtures/e2e-expected-identity.json (not forgeable via casual E2E_* env).
# Operator must set DEPLOYMENT_IDENTITY + APP_ENV on the API compose service to match.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FIXTURE_DIR="$ROOT/scripts/fixtures"
FIXTURE_PATH="$FIXTURE_DIR/e2e-expected-identity.json"
APP_ENV_ARG="${1:-disposable}"

case "$APP_ENV_ARG" in
  disposable|local|staging) ;;
  *)
    echo "Usage: $0 [disposable|local|staging]" >&2
    exit 1
    ;;
esac

if command -v python3 >/dev/null 2>&1; then
  PYTHON=python3
elif command -v python >/dev/null 2>&1; then
  PYTHON=python
else
  echo "FAIL: python3 or python is required" >&2
  exit 1
fi

mkdir -p "$FIXTURE_DIR"

DEPLOYMENT_ID="$("$PYTHON" -c 'import uuid; print(uuid.uuid4())')"

"$PYTHON" -c '
import json, sys
path, dep_id, app_env = sys.argv[1], sys.argv[2], sys.argv[3]
payload = {
  "expectedDeploymentId": dep_id,
  "environment": app_env,
  "nonProduction": True,
  "provisionedAt": __import__("datetime").datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
  "notes": "Immutable E2E identity fixture. Do not override via E2E_ALLOWED_* or casual env. API must expose GET /v1/env-identity with matching DEPLOYMENT_IDENTITY.",
}
with open(path, "w", encoding="utf-8") as f:
  json.dump(payload, f, indent=2)
  f.write("\n")
print(path)
' "$FIXTURE_PATH" "$DEPLOYMENT_ID" "$APP_ENV_ARG"

echo
echo "=== E2E identity provisioned ==="
echo "Fixture: $FIXTURE_PATH"
echo "expectedDeploymentId: $DEPLOYMENT_ID"
echo "environment: $APP_ENV_ARG"
echo
echo "Set these on the API (compose / .env) so GET /v1/env-identity returns them:"
echo "  DEPLOYMENT_IDENTITY=$DEPLOYMENT_ID"
echo "  APP_ENV=$APP_ENV_ARG"
echo
echo "Optional system copy (VPS disposable):"
echo "  sudo mkdir -p /etc/taranom && sudo cp $FIXTURE_PATH /etc/taranom/e2e-expected-identity.json"
echo
echo "Then run E2E with provisioned credentials (no SQL password reset):"
echo "  E2E_TARGET=$APP_ENV_ARG E2E_ALLOW_MUTATION=1 E2E_PHONE=... E2E_PASSWORD=... \\"
echo "  E2E_PRODUCT_ID=... bash scripts/e2e-purchase-test.sh"
