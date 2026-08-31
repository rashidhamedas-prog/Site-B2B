#!/bin/bash
# Encrypted off-box backup, restore drill (disposable only), and queue alerts.
# Never prints BACKUP_PASSPHRASE or DB passwords.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/taranom}"
BACKUP_DIR="${BACKUP_DIR:-}"
ACTION="${1:-}"

need_backup_dir() {
  if [ -z "$BACKUP_DIR" ]; then
    echo "BACKUP_DIR is required" >&2
    exit 1
  fi
  mkdir -p "$BACKUP_DIR"
}

need_passphrase() {
  if [ -z "${BACKUP_PASSPHRASE:-}" ]; then
    echo "BACKUP_PASSPHRASE is required" >&2
    exit 1
  fi
}

encrypt_stdin() {
  openssl enc -aes-256-cbc -salt -pbkdf2 -pass env:BACKUP_PASSPHRASE
}

decrypt_file() {
  openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in "$1"
}

backup() {
  need_backup_dir
  need_passphrase
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  dest="$BACKUP_DIR/$stamp"
  mkdir -p "$dest"
  docker compose -f "$APP_DIR/docker-compose.yml" exec -T postgres \
    pg_dump -U "${DB_USER:-taranom}" "${DB_NAME:-taranom_db}" \
    | gzip | encrypt_stdin > "$dest/postgres.sql.gz.enc"
  if command -v mc >/dev/null 2>&1 && [ -n "${MINIO_ALIAS:-}" ]; then
    tmp="$(mktemp -d)"
    mc mirror --quiet "${MINIO_ALIAS}/taranom-products" "$tmp/minio" >/dev/null
    tar -C "$tmp" -czf - minio | encrypt_stdin > "$dest/minio.tgz.enc"
    rm -rf "$tmp"
  fi
  echo "encrypted backup written to $dest"
}

restore_drill() {
  if [ "${OMNICHANNEL_RESTORE_DRILL:-}" != "1" ]; then
    echo "OMNICHANNEL_RESTORE_DRILL=1 is required" >&2
    exit 1
  fi
  app_env="$(printf '%s' "${APP_ENV:-}" | tr '[:upper:]' '[:lower:]')"
  node_env="$(printf '%s' "${NODE_ENV:-}" | tr '[:upper:]' '[:lower:]')"
  if [ "$app_env" = "production" ] || [ "$node_env" = "production" ]; then
    echo "restore drill refused on production runtime" >&2
    exit 1
  fi
  if [ "${DB_NAME:-}" = "taranom_db" ]; then
    echo "restore drill refused for production database name taranom_db" >&2
    exit 1
  fi
  need_passphrase
  archive="${2:-}"
  if [ -z "$archive" ]; then
    echo "usage: $0 restore-drill /path/to/postgres.sql.gz.enc" >&2
    exit 1
  fi
  if [ ! -f "$archive" ]; then
    echo "archive not found" >&2
    exit 1
  fi
  name="taranom_omnichannel_restore_drill"
  docker rm -f "$name" >/dev/null 2>&1 || true
  docker run -d --name "$name" \
    -e POSTGRES_PASSWORD=drill \
    -e POSTGRES_USER=taranom \
    -e POSTGRES_DB=taranom_restore_drill \
    postgres:16-alpine >/dev/null
  for _ in $(seq 1 40); do
    if docker exec "$name" pg_isready -U taranom >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  decrypt_file "$archive" | gunzip | docker exec -i "$name" \
    psql -U taranom -d taranom_restore_drill >/dev/null
  docker rm -f "$name" >/dev/null
  echo "restore drill ok (disposable container destroyed)"
}

alerts() {
  dead="$(docker compose -f "$APP_DIR/docker-compose.yml" exec -T postgres \
    psql -U "${DB_USER:-taranom}" -d "${DB_NAME:-taranom_db}" -tAc \
    "SELECT count(*) FROM omnichannel_outbox_events WHERE status='DEAD'")"
  lag="$(docker compose -f "$APP_DIR/docker-compose.yml" exec -T postgres \
    psql -U "${DB_USER:-taranom}" -d "${DB_NAME:-taranom_db}" -tAc \
    "SELECT count(*) FROM omnichannel_outbox_events WHERE status IN ('PENDING','RETRY') AND \"availableAt\" < now() - interval '5 minutes'")"
  echo "dead=$dead lag=$lag"
  if [ "${dead:-0}" -gt 0 ] || [ "${lag:-0}" -gt 0 ]; then
    echo "omnichannel alert: dead or lag above zero" >&2
    exit 2
  fi
}

case "$ACTION" in
  backup) backup ;;
  restore-drill) restore_drill "$@" ;;
  alerts) alerts ;;
  *) echo "usage: $0 backup|restore-drill <archive>|alerts" >&2; exit 1 ;;
esac
