#!/bin/bash
# Seed default categories + shipping/installment settings on production DB
set -euo pipefail
cd /opt/taranom

echo "=== Seeding categories ==="
docker exec -i taranom_postgres psql -U taranom -d taranom_db <<'SQL'
INSERT INTO categories (id, name, "skuPrefix", "nextSequence", "createdAt", "updatedAt")
VALUES
  (uuid_generate_v4(), 'مانتو لینن', 'LINEN-', 1, now(), now()),
  (uuid_generate_v4(), 'شومیز', 'SHIRT-', 1, now(), now()),
  (uuid_generate_v4(), 'کت و شلوار', 'SUIT-', 1, now(), now())
ON CONFLICT (name) DO NOTHING;
SQL

echo "=== Seeding shipping companies in app_settings ==="
docker exec -i taranom_postgres psql -U taranom -d taranom_db <<'SQL'
INSERT INTO app_settings (key, value, "updatedAt")
VALUES (
  'shipping',
  '{
    "baseFee": 600000,
    "perKgFee": 250000,
    "freeThreshold": 500000000,
    "companies": [
      {"id":"TIPAX","label":"تیپاکس","isActive":true,"sort":10},
      {"id":"POST","label":"پست پیشتاز","isActive":true,"sort":20},
      {"id":"FREIGHT","label":"باربری","isActive":true,"sort":30},
      {"id":"BUS","label":"باربری اتوبوسی","isActive":true,"sort":40},
      {"id":"LOCAL","label":"باربری محلی","isActive":true,"sort":50},
      {"id":"OTHER","label":"سایر","isActive":true,"sort":60}
    ]
  }'::jsonb,
  now()
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = now();
SQL

echo "=== Seeding installment rules ==="
docker exec -i taranom_postgres psql -U taranom -d taranom_db <<'SQL'
INSERT INTO app_settings (key, value, "updatedAt")
VALUES (
  'installments',
  '{"minDownPaymentPercent":30,"minDownPaymentAmount":50000000,"maxMonths":6}'::jsonb,
  now()
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = now();
SQL

echo "=== Categories count ==="
docker exec taranom_postgres psql -U taranom -d taranom_db -t -c 'SELECT count(*) FROM categories;'

echo "=== Done ==="
