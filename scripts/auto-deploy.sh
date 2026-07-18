#!/bin/bash
# ============================================================================
# Taranom server-side auto-deploy (poll origin/master, rebuild on change).
# Installed as a systemd oneshot service driven by taranom-autodeploy.timer.
# Safe to run repeatedly: it only rebuilds when origin/master advances, holds
# a lock so runs never overlap, and leaves the running containers untouched if
# the build fails.
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

git fetch origin master -q
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/master)"

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "$(date -Is) already up to date (${LOCAL:0:7})"
  exit 0
fi

echo "$(date -Is) new revision detected: ${LOCAL:0:7} -> ${REMOTE:0:7}"
git reset --hard origin/master

echo "$(date -Is) building images..."
docker compose build api web

echo "$(date -Is) starting containers..."
docker compose up -d api web
docker compose restart nginx

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
