#!/bin/bash
set -euo pipefail
cd /opt/taranom
set -a
# shellcheck disable=SC1091
source .env
set +a
DB_USER="${DB_USER:-taranom}"
DB_NAME="${DB_NAME:-taranom_db}"

docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" <<'SQL'
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "torobClid" varchar;
CREATE INDEX IF NOT EXISTS "IDX_orders_torobClid"
  ON orders ("torobClid") WHERE "torobClid" IS NOT NULL;

-- Enable Torob order sync flag inside marketing JSON settings
INSERT INTO app_settings (key, value)
VALUES ('marketing', '{"torobOrderSyncEnabled": true}'::jsonb)
ON CONFLICT (key) DO UPDATE
SET value = COALESCE(app_settings.value, '{}'::jsonb) || '{"torobOrderSyncEnabled": true}'::jsonb;
SQL

echo "SQL_OK"

# Without JWT should be 401 JSON, not XML
CODE=$(curl -s -o /tmp/torob_orders_body.txt -w "%{http_code}" \
  "http://localhost:4000/torob/v1/orders?purchase_timestamp_gt=2020-01-01T00:00:00.000Z&limit=10")
CT=$(curl -sI "http://localhost:4000/torob/v1/orders?purchase_timestamp_gt=2020-01-01T00:00:00.000Z&limit=10" | tr -d '\r' | awk -F': ' 'tolower($1)=="content-type"{print $2; exit}')
echo "STATUS=$CODE"
echo "CONTENT_TYPE=$CT"
head -c 200 /tmp/torob_orders_body.txt; echo

# Same via retail nginx path
CODE2=$(curl -sk -o /tmp/torob_orders_proxy.txt -w "%{http_code}" \
  -H "Host: www.poshaktaranom.ir" \
  "https://127.0.0.1/api/torob/v1/orders?purchase_timestamp_gt=2020-01-01T00:00:00.000Z&limit=10" || true)
echo "PROXY_STATUS=$CODE2"
head -c 200 /tmp/torob_orders_proxy.txt; echo
