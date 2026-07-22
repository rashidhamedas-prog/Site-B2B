#!/bin/bash
set -euo pipefail
cd /opt/taranom
set -a
# shellcheck disable=SC1091
source .env
set +a

git fetch origin master
git reset --hard origin/master

DB_USER_VAL="${DB_USER:-taranom}"
DB_NAME_VAL="${DB_NAME:-taranom}"

docker compose exec -T -e PGPASSWORD="$DB_PASS" postgres \
  psql -U "$DB_USER_VAL" -d "$DB_NAME_VAL" <<'SQL'
INSERT INTO app_settings (key, value, "updatedAt")
VALUES (
  'theme',
  jsonb_build_object(
    'primaryColor', '#1B5C4A',
    'secondaryColor', '#C9A84C',
    'displayMode', 'light',
    'backgroundImageUrl', '',
    'glassBlurPx', 12,
    'popups', jsonb_build_object(
      'boutique', jsonb_build_object(
        'enabled', true,
        'trigger', 'delay',
        'delaySeconds', 6,
        'title', 'بوتیک دارید؟ عمده بگیرید',
        'body', 'مستقیم از تولیدی ترنم در مشهد — لینن و کتان، حداقل سفارش عمده، ارسال سراسر ایران. همین حالا ثبت‌نام کنید تا لیست قیمت عمده برایتان فعال شود.',
        'ctaLabel', 'ثبت‌نام عمده‌فروش',
        'ctaUrl', '/portal/register'
      ),
      'newsletter', jsonb_build_object(
        'enabled', true,
        'trigger', 'exit',
        'delaySeconds', 18,
        'title', 'کلکسیون لینن جدید',
        'body', 'قبل از اتمام موجودی فصل، از مدل‌های جدید شومیزی و مانتو لینن باخبر شوید — تماس با فروش یا عضویت از صفحه تماس.',
        'ctaLabel', 'مشاوره خرید عمده',
        'ctaUrl', '/contact'
      )
    )
  ),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  "updatedAt" = NOW();
SQL

docker compose build api web
docker compose up -d api web
docker compose restart nginx
sleep 4
curl -sS "http://127.0.0.1:4000/v1/settings/public" | tr ',' '\n' | head -n 50
