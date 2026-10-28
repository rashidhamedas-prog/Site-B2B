#!/bin/bash
# Minimal legacy lock logic (auto-deploy.sh lines 30-34 style) for compatibility tests.
set -euo pipefail
LOCK_FILE="${TARANOM_DEPLOY_LOCK_FILE:-/tmp/taranom-autodeploy.lock}"
: >>"$LOCK_FILE"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "$(date -Is) another deploy is running — skipping"
  exit 0
fi
# Hold until signaled or timeout
HOLD_SEC="${OLD_LOCK_HOLD_SEC:-2}"
sleep "$HOLD_SEC"
exit 0
