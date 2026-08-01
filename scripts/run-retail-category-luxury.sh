#!/bin/bash
set -euo pipefail
cd /opt/taranom
set -a
# shellcheck disable=SC1091
source .env
set +a
DB_USER="${DB_USER:-taranom}"
DB_NAME="${DB_NAME:-taranom_db}"

docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" < scripts/apply-retail-category-luxury.sql
echo "SQL_OK"

curl -sf http://localhost:4000/v1/health >/dev/null && echo "HEALTH_OK"

python3 - <<'PY'
import json, urllib.request
cats = json.load(urllib.request.urlopen("http://localhost:4000/v1/categories"))
print(sum(1 for c in cats if c.get("bannerUrl")), "categories with banner")
home = json.load(urllib.request.urlopen("http://localhost:4000/v1/cms/site-content/RETAIL/home"))
print("blocks:", [b.get("type") for b in home.get("blocks", [])])
PY
