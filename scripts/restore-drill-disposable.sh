#!/usr/bin/env bash
# Disposable restore drill — NEVER targets live taranom_db.
# Usage: bash scripts/restore-drill-disposable.sh [/path/to/postgres.dump]
set -euo pipefail

DUMP="${1:-}"
ROOT="${TARANOM_ROOT:-/opt/taranom}"
NAME="taranom_c3_restore_drill"
IMAGE="${POSTGRES_DRILL_IMAGE:-postgres:16-alpine}"
DRILL_DB="taranom_restore_drill"
DRILL_USER="taranom"
DRILL_PASS="c3drill"

if [[ -z "$DUMP" ]]; then
  DUMP="$(ls -1t "$ROOT"/backups/20260809-c3-evidence/*.dump "$ROOT"/backups/postgres/*/postgres.dump 2>/dev/null | head -1 || true)"
fi
if [[ -z "$DUMP" || ! -f "$DUMP" ]]; then
  echo "FAIL: no dump file found" >&2
  exit 1
fi

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

cleanup
echo "Using dump: $DUMP"
START="$(date +%s)"
docker run -d --name "$NAME" \
  -e POSTGRES_PASSWORD="$DRILL_PASS" \
  -e POSTGRES_USER="$DRILL_USER" \
  -e POSTGRES_DB="$DRILL_DB" \
  "$IMAGE" >/dev/null

for i in $(seq 1 60); do
  if docker exec "$NAME" pg_isready -U "$DRILL_USER" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker cp "$DUMP" "$NAME:/tmp/in.dump"
set +e
docker exec "$NAME" pg_restore -U "$DRILL_USER" -d "$DRILL_DB" --no-owner --no-acl /tmp/in.dump
RESTORE_EXIT=$?
set -e
END="$(date +%s)"
RTO=$((END - START))

TABLES="$(docker exec "$NAME" psql -U "$DRILL_USER" -d "$DRILL_DB" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" | tr -d '[:space:]')"
PRODUCTS="$(docker exec "$NAME" psql -U "$DRILL_USER" -d "$DRILL_DB" -tAc "SELECT count(*) FROM products;" 2>/dev/null | tr -d '[:space:]' || echo 0)"
ORDERS="$(docker exec "$NAME" psql -U "$DRILL_USER" -d "$DRILL_DB" -tAc "SELECT count(*) FROM orders;" 2>/dev/null | tr -d '[:space:]' || echo 0)"

echo "restore_exit=$RESTORE_EXIT"
echo "rto_seconds=$RTO"
echo "public_tables=$TABLES"
echo "products=$PRODUCTS"
echo "orders=$ORDERS"

if [[ "${TABLES:-0}" -lt 10 ]]; then
  echo "FAIL: too few tables after restore" >&2
  exit 1
fi

echo "DISPOSABLE_RESTORE_DRILL PASS"
# trap cleans container
