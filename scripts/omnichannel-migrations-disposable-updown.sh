#!/usr/bin/env bash
# Disposable up/down/up for omnichannel migrations only.
# NEVER run against production DB name taranom_db.
#
# Usage:
#   bash scripts/omnichannel-migrations-disposable-updown.sh
#
# Prefers a throwaway postgres container. If POSTGRES_CONTAINER is set and
# running, uses that host's postgres with a disposable database name.
set -euo pipefail

PROD_DB_DENYLIST='^(taranom_db|postgres|template0|template1)$'
DISPOSABLE_DB="${OMNICHANNEL_MIG_TEST_DB:-taranom_omnichannel_mig_test}"
PG_USER="${DB_USER:-taranom}"
OWN_CONTAINER=""

if [[ "$DISPOSABLE_DB" =~ $PROD_DB_DENYLIST ]]; then
  echo "Refusing disposable DB name that looks like production: $DISPOSABLE_DB" >&2
  exit 1
fi

cleanup() {
  if [ -n "$OWN_CONTAINER" ]; then
    docker rm -f "$OWN_CONTAINER" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [ -n "${POSTGRES_CONTAINER:-}" ] && docker inspect "${POSTGRES_CONTAINER}" >/dev/null 2>&1; then
  CONTAINER="$POSTGRES_CONTAINER"
else
  OWN_CONTAINER="taranom_omnichannel_mig_$$"
  CONTAINER="$OWN_CONTAINER"
  docker run -d --name "$CONTAINER" \
    -e POSTGRES_PASSWORD=drill \
    -e POSTGRES_USER="$PG_USER" \
    -e POSTGRES_DB="$DISPOSABLE_DB" \
    postgres:16-alpine >/dev/null
  for _ in $(seq 1 40); do
    if docker exec "$CONTAINER" pg_isready -U "$PG_USER" >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
fi

psqlc() {
  docker exec -i "$CONTAINER" psql -U "$PG_USER" -v ON_ERROR_STOP=1 "$@"
}

if [ -z "$OWN_CONTAINER" ]; then
  echo "=== Create disposable database $DISPOSABLE_DB ==="
  psqlc -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DISPOSABLE_DB' AND pid <> pg_backend_pid();" >/dev/null || true
  psqlc -d postgres -c "DROP DATABASE IF EXISTS $DISPOSABLE_DB;"
  psqlc -d postgres -c "CREATE DATABASE $DISPOSABLE_DB OWNER $PG_USER;"
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCHEMA="$ROOT/apps/api/src/database/migrations/20260826-001-omnichannel-schema.ts"
AUDIT="$ROOT/apps/api/src/database/migrations/20260829-001-omnichannel-audit.ts"
MEDIA="$ROOT/apps/api/src/database/migrations/20260829-002-omnichannel-media.ts"

extract_up() {
  node -e '
    const fs = require("fs");
    const src = fs.readFileSync(process.argv[1], "utf8");
    const up = src.split("public async up")[1].split("public async down")[0];
    const sqls = [...up.matchAll(/`([\s\S]*?)`/g)].map((m) => m[1]).filter((s) => /CREATE|ALTER|DROP|INDEX/i.test(s));
    process.stdout.write(sqls.join(";\n") + ";\n");
  ' "$1"
}

extract_down() {
  node -e '
    const fs = require("fs");
    const src = fs.readFileSync(process.argv[1], "utf8");
    const down = src.split("public async down")[1];
    const sqls = [...down.matchAll(/`([\s\S]*?)`/g)].map((m) => m[1]).filter((s) => /DROP/i.test(s));
    process.stdout.write(sqls.join(";\n") + ";\n");
  ' "$1"
}

apply_sql() {
  psqlc -d "$DISPOSABLE_DB" -f - <<<"$1"
}

echo "=== up schema ==="
apply_sql "$(extract_up "$SCHEMA")"
echo "=== up audit ==="
apply_sql "$(extract_up "$AUDIT")"
echo "=== up media ==="
apply_sql "$(extract_up "$MEDIA")"

echo "=== assert tables + secretRef-only ==="
psqlc -d "$DISPOSABLE_DB" -c "
SELECT to_regclass('public.omnichannel_channel_connections') IS NOT NULL
  AND to_regclass('public.omnichannel_outbox_events') IS NOT NULL
  AND to_regclass('public.omnichannel_audits') IS NOT NULL
  AND to_regclass('public.omnichannel_media_assets') IS NOT NULL;
"
cols="$(psqlc -d "$DISPOSABLE_DB" -Atc "SELECT column_name FROM information_schema.columns WHERE table_name='omnichannel_channel_connections';")"
echo "$cols" | grep -qx secretRef
if echo "$cols" | grep -Eiq '^(secret|token|password|botToken)$'; then
  echo "plaintext secret column found" >&2
  exit 1
fi

echo "=== unique violation on duplicate connection ==="
psqlc -d "$DISPOSABLE_DB" -c "INSERT INTO omnichannel_channel_connections (provider, channel, name, \"secretRef\") VALUES ('TELEGRAM','RETAIL','canary','TELEGRAM_BOT_TOKEN');"
if psqlc -d "$DISPOSABLE_DB" -c "INSERT INTO omnichannel_channel_connections (provider, channel, name, \"secretRef\") VALUES ('TELEGRAM','RETAIL','canary','TELEGRAM_BOT_TOKEN');" 2>/tmp/omni-mig-dup.err; then
  echo "expected unique violation" >&2
  exit 1
fi
grep -qi 'unique\|duplicate' /tmp/omni-mig-dup.err

echo "=== down media + audit + schema ==="
apply_sql "$(extract_down "$MEDIA")"
apply_sql "$(extract_down "$AUDIT")"
apply_sql "$(extract_down "$SCHEMA")"
gone="$(psqlc -d "$DISPOSABLE_DB" -Atc "SELECT to_regclass('public.omnichannel_channel_connections');")"
if [ -n "$gone" ] && [ "$gone" != "" ]; then
  echo "tables still present after down: $gone" >&2
  exit 1
fi

echo "=== up again ==="
apply_sql "$(extract_up "$SCHEMA")"
apply_sql "$(extract_up "$AUDIT")"
apply_sql "$(extract_up "$MEDIA")"
psqlc -d "$DISPOSABLE_DB" -c "SELECT to_regclass('public.omnichannel_audits') IS NOT NULL AND to_regclass('public.omnichannel_media_assets') IS NOT NULL;"

echo "omnichannel disposable migration up/down/up ok"
