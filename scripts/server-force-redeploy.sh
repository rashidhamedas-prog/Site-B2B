#!/bin/bash
set -euo pipefail
cd /opt/taranom

echo "=== PULL LATEST ==="
git fetch origin
git reset --hard origin/master
git log -1 --oneline

echo "=== REBUILD (no cache) ==="
docker compose build --no-cache api web
docker compose up -d api web
docker compose restart nginx

echo "=== WAIT ==="
sleep 20

echo "=== HEALTH ==="
curl -sf http://localhost:4000/v1/health && echo
curl -sf -o /dev/null -w "web %{http_code}\n" http://localhost:3000

echo "=== DEPLOY COMPLETE ==="
