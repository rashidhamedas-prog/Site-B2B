#!/bin/bash
# Local smoke test for admin login.
# Usage:
#   ADMIN_PHONE=09xxxxxxxxx ADMIN_PASSWORD='your-password' ./scripts/test-admin-login.sh
# Never hardcode real credentials in this file.

set -euo pipefail

API_URL="${API_URL:-http://localhost:4000}"
PHONE="${ADMIN_PHONE:?Set ADMIN_PHONE}"
PASSWORD="${ADMIN_PASSWORD:?Set ADMIN_PASSWORD}"

curl -sS -X POST "${API_URL}/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"phone\":\"${PHONE}\",\"password\":\"${PASSWORD}\"}"
echo
