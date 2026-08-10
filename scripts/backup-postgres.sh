#!/usr/bin/env bash
# Taranom — daily Postgres custom-format backup (expand-only ops helper).
# Intended for VPS cron: 15 2 * * * wholesale-admin /opt/taranom/scripts/backup-postgres.sh
# Does NOT touch MinIO/object storage. Does NOT restore.
set -euo pipefail

ROOT="${TARANOM_ROOT:-/opt/taranom}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${BACKUP_DIR:-$ROOT/backups/postgres}/$STAMP"
CONTAINER="${POSTGRES_CONTAINER:-taranom_postgres}"
DB_USER="${DB_USER:-taranom}"
DB_NAME="${DB_NAME:-taranom_db}"

mkdir -p "$OUT_DIR"
COMMIT="unknown"
if [[ -d "$ROOT/.git" ]]; then
  COMMIT="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
fi

{
  echo "checkpoint_id=$STAMP"
  echo "git_commit=$COMMIT"
  echo "created_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "container=$CONTAINER"
  echo "db=$DB_NAME"
} >"$OUT_DIR/META.txt"

docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc -f /tmp/taranom-backup.dump
docker cp "$CONTAINER:/tmp/taranom-backup.dump" "$OUT_DIR/postgres.dump"
docker exec "$CONTAINER" rm -f /tmp/taranom-backup.dump

# Listable verify (not a restore)
docker cp "$OUT_DIR/postgres.dump" "$CONTAINER:/tmp/taranom-backup-check.dump"
if docker exec "$CONTAINER" pg_restore -l /tmp/taranom-backup-check.dump >/dev/null; then
  echo "pg_restore_list=ok" >>"$OUT_DIR/META.txt"
else
  echo "pg_restore_list=FAIL" >>"$OUT_DIR/META.txt"
  docker exec "$CONTAINER" rm -f /tmp/taranom-backup-check.dump || true
  exit 1
fi
docker exec "$CONTAINER" rm -f /tmp/taranom-backup-check.dump

# Retention
find "${BACKUP_DIR:-$ROOT/backups/postgres}" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS" -exec rm -rf {} + 2>/dev/null || true

echo "backup_ok path=$OUT_DIR size=$(wc -c <"$OUT_DIR/postgres.dump") bytes"
