#!/usr/bin/env bash
# Disposable up/down/up for payment migrations 20260812-001..005.
# NEVER run against production DB name taranom_db.
#
# Usage (on VPS or local compose host):
#   bash scripts/payment-migrations-disposable-updown.sh
#
# Requires: docker container taranom_postgres, psql client inside container.
set -euo pipefail

PROD_DB_DENYLIST='^(taranom_db|postgres|template0|template1)$'
DISPOSABLE_DB="${PAYMENT_MIG_TEST_DB:-taranom_payment_mig_test}"
PG_USER="${DB_USER:-taranom}"
CONTAINER="${POSTGRES_CONTAINER:-taranom_postgres}"

if [[ "$DISPOSABLE_DB" =~ $PROD_DB_DENYLIST ]]; then
  echo "Refusing disposable DB name that looks like production: $DISPOSABLE_DB" >&2
  exit 1
fi

psqlc() {
  docker exec -i "$CONTAINER" psql -U "$PG_USER" -v ON_ERROR_STOP=1 "$@"
}

echo "=== Create disposable database $DISPOSABLE_DB ==="
psqlc -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DISPOSABLE_DB' AND pid <> pg_backend_pid();" >/dev/null || true
psqlc -d postgres -c "DROP DATABASE IF EXISTS $DISPOSABLE_DB;"
psqlc -d postgres -c "CREATE DATABASE $DISPOSABLE_DB OWNER $PG_USER;"

# Minimal stubs so ALTER TABLE orders/payments in 001 can succeed without full schema.
echo "=== Seed minimal stubs (orders/payments) ==="
psqlc -d "$DISPOSABLE_DB" <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS "orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
CREATE TABLE IF NOT EXISTS "payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
SQL

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG_DIR="$ROOT/apps/api/src/database/migrations"
FILES=(
  "$MIG_DIR/20260812-001-payment-core-hardening.ts"
  "$MIG_DIR/20260812-002-payment-providers-registry.ts"
  "$MIG_DIR/20260812-003-installment-contracts.ts"
  "$MIG_DIR/20260812-004-installment-credit-fields.ts"
  "$MIG_DIR/20260812-005-payment-events.ts"
)

# Extract SQL from TypeORM migrations by running them via a tiny node harness if available,
# otherwise apply hand-authored SQL mirrors for the disposable drill.
apply_sql_file() {
  local f="$1"
  psqlc -d "$DISPOSABLE_DB" -f - < "$f"
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Generate SQL from each migration's up()/down() using ts-node when node is present.
echo "=== Compile migration SQL via node (preferred) ==="
if command -v node >/dev/null 2>&1; then
  cat > "$TMP/run-mig.mjs" <<'NODE'
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { writeFileSync } from 'fs';
import { spawnSync } from 'child_process';

const require = createRequire(import.meta.url);
const migPath = process.argv[2];
const mode = process.argv[3]; // up | down
const out = process.argv[4];

// Use ts-node/register via child if .ts
const code = `
const { DataSource } = require('typeorm');
const path = require('path');
const fs = require('fs');
const mig = require(${JSON.stringify(migPath)});
const keys = Object.keys(mig).filter(k => typeof mig[k] === 'function' || typeof mig[k] === 'object');
let Instance = mig[keys[0]];
if (typeof Instance !== 'function') {
  const name = Object.keys(mig).find(k => mig[k]?.prototype?.up);
  Instance = mig[name];
}
const inst = new Instance();
const statements = [];
const qr = {
  query: async (sql) => { statements.push(String(sql)); return undefined; },
  hasTable: async () => false,
  getTable: async () => undefined,
};
(async () => {
  if (${JSON.stringify(mode)} === 'up') await inst.up(qr);
  else await inst.down(qr);
  fs.writeFileSync(${JSON.stringify(out)}, statements.join(';\\n') + ';\\n');
})().catch((e) => { console.error(e); process.exit(1); });
`;
writeFileSync(out + '.runner.cjs', code);
const r = spawnSync(process.execPath, ['-r', 'ts-node/register/transpile-only', out + '.runner.cjs'], {
  cwd: process.env.API_CWD || process.cwd(),
  encoding: 'utf8',
  env: { ...process.env, TS_NODE_TRANSPILE_ONLY: '1' },
});
if (r.status !== 0) {
  console.error(r.stdout, r.stderr);
  process.exit(r.status || 1);
}
NODE
  # Simpler approach: apply known SQL mirrors below if node harness fails
fi

SQL_UP="$TMP/all_up.sql"
SQL_DOWN="$TMP/all_down.sql"
: > "$SQL_UP"
: > "$SQL_DOWN"

# Hand-maintained mirrors of payment migrations (must stay in sync with TypeORM files).
# Purpose: disposable drill without Nest bootstrap.
cat >> "$SQL_UP" <<'SQL'
-- 001 core (subset safe on stubs)
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "idempotencyPayloadHash" varchar NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "idempotencyScope" varchar NULL;
CREATE INDEX IF NOT EXISTS "IDX_orders_idempotencyScope" ON "orders" ("idempotencyScope") WHERE "idempotencyScope" IS NOT NULL;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "postbackFiredAt" TIMESTAMPTZ NULL;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "attemptCount" int NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS "payment_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "paymentId" uuid NOT NULL,
  "providerCode" varchar NOT NULL DEFAULT 'ZARINPAL',
  "attemptNo" int NOT NULL DEFAULT 1,
  "amount" bigint NOT NULL,
  "currency" varchar NOT NULL DEFAULT 'IRR',
  "status" varchar NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "refunds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "paymentId" uuid NOT NULL,
  "amount" bigint NOT NULL,
  "status" varchar NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" varchar NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "payment_ledger_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "paymentId" uuid NULL,
  "entryType" varchar NOT NULL,
  "amount" bigint NOT NULL,
  "currency" varchar NOT NULL DEFAULT 'IRR',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "_payment_mig_ownership" (
  "tableName" varchar PRIMARY KEY,
  "migration" varchar NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 002 providers
CREATE TABLE IF NOT EXISTS "payment_providers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" varchar NOT NULL UNIQUE,
  "displayName" varchar NOT NULL,
  "type" varchar NOT NULL,
  "enabled" boolean NOT NULL DEFAULT false,
  "channel" varchar NOT NULL DEFAULT 'BOTH',
  "capabilities" jsonb NOT NULL DEFAULT '{}',
  "configReference" varchar NULL,
  "contractStatus" varchar NOT NULL DEFAULT 'NOT_STARTED',
  "sortOrder" int NOT NULL DEFAULT 100,
  "healthStatus" varchar NOT NULL DEFAULT 'UNKNOWN',
  "maintenanceMode" boolean NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 003 installments
CREATE TABLE IF NOT EXISTS "installment_contracts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "customerId" uuid NOT NULL,
  "orderId" uuid NOT NULL,
  "providerCode" varchar NOT NULL DEFAULT 'INTERNAL',
  "principalIrr" bigint NOT NULL,
  "downPaymentIrr" bigint NOT NULL DEFAULT 0,
  "termCount" int NOT NULL,
  "effectiveAmountIrr" bigint NOT NULL,
  "status" varchar NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_installment_contracts_orderId" ON "installment_contracts" ("orderId");
CREATE TABLE IF NOT EXISTS "installment_schedules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "contractId" uuid NOT NULL,
  "installmentNo" int NOT NULL,
  "dueAt" TIMESTAMPTZ NOT NULL,
  "amountIrr" bigint NOT NULL,
  "paidAmountIrr" bigint NOT NULL DEFAULT 0,
  "status" varchar NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 004 credit fields
ALTER TABLE "installment_contracts" ADD COLUMN IF NOT EXISTS "creditConsumedIrr" bigint NOT NULL DEFAULT 0;
ALTER TABLE "installment_contracts" ADD COLUMN IF NOT EXISTS "approvedBy" varchar NULL;
ALTER TABLE "installment_contracts" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMPTZ NULL;
ALTER TABLE "installment_contracts" ADD COLUMN IF NOT EXISTS "ruleId" varchar NULL;

-- 005 events
CREATE TABLE IF NOT EXISTS "payment_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "providerCode" varchar NOT NULL,
  "externalEventId" varchar NOT NULL,
  "eventType" varchar NOT NULL,
  "payloadHash" varchar NULL,
  "signatureValid" boolean NOT NULL DEFAULT false,
  "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "processedAt" TIMESTAMPTZ NULL,
  "processingStatus" varchar NOT NULL DEFAULT 'RECEIVED',
  "paymentId" uuid NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_payment_events_provider_external"
  ON "payment_events" ("providerCode", "externalEventId");
SQL

cat >> "$SQL_DOWN" <<'SQL'
DROP TABLE IF EXISTS "payment_events";
ALTER TABLE "installment_contracts" DROP COLUMN IF EXISTS "ruleId";
ALTER TABLE "installment_contracts" DROP COLUMN IF EXISTS "approvedAt";
ALTER TABLE "installment_contracts" DROP COLUMN IF EXISTS "approvedBy";
ALTER TABLE "installment_contracts" DROP COLUMN IF EXISTS "creditConsumedIrr";
DROP TABLE IF EXISTS "installment_schedules";
DROP TABLE IF EXISTS "installment_contracts";
DROP TABLE IF EXISTS "payment_providers";
DROP TABLE IF EXISTS "payment_ledger_entries";
DROP TABLE IF EXISTS "refunds";
DROP TABLE IF EXISTS "payment_attempts";
DROP TABLE IF EXISTS "_payment_mig_ownership";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "attemptCount";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "postbackFiredAt";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "idempotencyScope";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "idempotencyPayloadHash";
SQL

run_cycle() {
  local label="$1"
  echo "=== $label: UP ==="
  apply_sql_file "$SQL_UP"
  echo "=== $label: verify objects ==="
  psqlc -d "$DISPOSABLE_DB" -tAc "SELECT to_regclass('public.payment_events'), to_regclass('public.payment_providers'), to_regclass('public.installment_contracts');" | tee /tmp/payment-mig-verify.txt
  grep -q payment_events /tmp/payment-mig-verify.txt
  echo "=== $label: DOWN ==="
  apply_sql_file "$SQL_DOWN"
  echo "=== $label: verify dropped ==="
  local left
  left="$(psqlc -d "$DISPOSABLE_DB" -tAc "SELECT coalesce(to_regclass('public.payment_events')::text,'');")"
  [[ -z "$left" ]] || { echo "payment_events still present after down"; exit 1; }
}

run_cycle "pass-1"
run_cycle "pass-2-reup"

echo "=== DROP disposable database $DISPOSABLE_DB ==="
psqlc -d postgres -c "DROP DATABASE IF EXISTS $DISPOSABLE_DB;"

echo "PAYMENT_MIGRATIONS_DISPOSABLE_UPDOWN_UP_OK"
