#!/bin/bash
set -euo pipefail
cd /opt/taranom

echo "=== GIT ==="
git log -1 --oneline

echo "=== CONTAINERS ==="
docker compose ps

echo "=== DB TABLES ==="
docker exec taranom_postgres psql -U taranom -d taranom_db -t -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;"

echo "=== MIGRATIONS TABLE ==="
docker exec taranom_postgres psql -U taranom -d taranom_db -t -c "SELECT name FROM migrations ORDER BY id;" 2>/dev/null || echo "no migrations table"

echo "=== API CATEGORIES ==="
curl -sf http://localhost:4000/v1/categories || echo "categories endpoint failed"

echo "=== WEB ADMIN PATHS ==="
docker exec taranom_web ls -la /app/apps/web/.next/server/app/admin 2>/dev/null || docker exec taranom_web ls -la /app/.next/server/app/admin 2>/dev/null || echo "admin paths not found"

echo "=== ENV DB_SYNC / migrationsRun ==="
grep -E 'DB_SYNC|NODE_ENV' .env | head -5
