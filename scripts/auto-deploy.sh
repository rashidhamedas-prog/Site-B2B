#!/bin/bash
# ============================================================================
# Taranom server-side auto-deploy (poll origin/master, rebuild on change).
# Installed as a systemd oneshot service driven by taranom-autodeploy.timer.
# Safe to run repeatedly: it only rebuilds when origin/master advances, holds
# a lock so runs never overlap, and leaves the running containers untouched if
# the build fails.
#
# After git reset, the script re-execs itself so newly pulled deploy steps
# actually run — bash does not re-read a script mid-run.
# GitHub Actions must call this same script (shared flock). No safety-net SQL.
# ============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/taranom}"
LOCK_FILE="/tmp/taranom-autodeploy.lock"

cd "$APP_DIR"

# Prevent overlapping deploys (with the GitHub Actions deploy or a previous run)
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "$(date -Is) another deploy is running — skipping"
  exit 0
fi

# Phase A: detect update, pull, re-exec into Phase B with updated script body
if [ "${TARANOM_DEPLOY_BUILD:-}" != "1" ]; then
  git fetch origin master -q
  LOCAL="$(git rev-parse HEAD)"
  REMOTE="$(git rev-parse origin/master)"

  if [ "$LOCAL" = "$REMOTE" ] && [ "${TARANOM_DEPLOY_FORCE:-}" != "1" ]; then
    echo "$(date -Is) already up to date (${LOCAL:0:7})"
    exit 0
  fi

  echo "$(date -Is) new revision detected: ${LOCAL:0:7} -> ${REMOTE:0:7}"
  git reset --hard origin/master
  export TARANOM_DEPLOY_BUILD=1
  exec /bin/bash "$APP_DIR/scripts/auto-deploy.sh"
fi

# Phase B: build + schema + health (always runs from the just-pulled script)
if [ -f "$APP_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$APP_DIR/.env"
  set +a
fi
echo "$(date -Is) building images..."
docker compose build api web worker worker-b

echo "$(date -Is) starting containers..."
docker compose up -d api web worker worker-b
docker compose restart nginx

echo "$(date -Is) schema is TypeORM migrations only (no safety-net SQL)"

echo "$(date -Is) waiting for API health..."
ok=0
for _ in $(seq 1 24); do
  if curl -sf http://localhost:4000/v1/health >/dev/null; then ok=1; break; fi
  sleep 5
done
if [ "$ok" != "1" ]; then
  echo "$(date -Is) WARNING: API health check did not pass"
  docker compose logs --tail 40 api || true
  exit 1
fi

echo "$(date -Is) deploy complete at $(git rev-parse --short HEAD)"
