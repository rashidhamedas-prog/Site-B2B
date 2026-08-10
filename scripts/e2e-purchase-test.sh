#!/usr/bin/env bash
# Wholesale purchase E2E — staging / local / disposable ONLY.
# Never run against production DB or live payment gateways.
#
# Required:
#   E2E_TARGET=staging|local|disposable
#   E2E_ALLOW_MUTATION=1
#   E2E_PHONE / E2E_PASSWORD  (no hardcoded credentials)
#
# Optional:
#   API_URL (default http://localhost:4000/v1)
#   WEB_URL (default http://localhost:3000)
#   E2E_POSTGRES_CONTAINER / E2E_POSTGRES_USER / E2E_POSTGRES_DB
#   E2E_ALLOW_DB_ACTIVATE=1  — activate user/customer rows via SQL (non-prod only)
#   E2E_ALLOW_PASSWORD_RESET=1 — bcrypt+SQL password reset (explicit; still blocked if DB is production name)
set -euo pipefail

API="${API_URL:-http://localhost:4000/v1}"
WEB_URL="${WEB_URL:-http://localhost:3000}"
TARGET="${E2E_TARGET:-}"
ALLOW_MUTATION="${E2E_ALLOW_MUTATION:-0}"
PHONE="${E2E_PHONE:-}"
PASSWORD="${E2E_PASSWORD:-}"
PG_CONTAINER="${E2E_POSTGRES_CONTAINER:-}"
PG_USER="${E2E_POSTGRES_USER:-taranom}"
PG_DB="${E2E_POSTGRES_DB:-}"
ALLOW_DB_ACTIVATE="${E2E_ALLOW_DB_ACTIVATE:-0}"
ALLOW_PASSWORD_RESET="${E2E_ALLOW_PASSWORD_RESET:-0}"

fail() { echo "FAIL: $*" >&2; exit 1; }

case "$TARGET" in
  staging|local|disposable) ;;
  *)
    fail "E2E_TARGET must be staging|local|disposable (got '${TARGET:-empty}'). Production is forbidden."
    ;;
esac

[[ "$ALLOW_MUTATION" == "1" ]] || fail "Set E2E_ALLOW_MUTATION=1 to create orders (staging/local/disposable only)."
[[ -n "$PHONE" ]] || fail "Set E2E_PHONE (no hardcoded test phone)."
[[ -n "$PASSWORD" ]] || fail "Set E2E_PASSWORD (no hardcoded test password)."

# Bind API/WEB hosts to non-production (SEC-004).
API_HOST="$(python3 -c "from urllib.parse import urlparse; print(urlparse('''$API''').hostname or '')")"
WEB_HOST="$(python3 -c "from urllib.parse import urlparse; print(urlparse('''$WEB_URL''').hostname or '')")"
is_allowed_host() {
  case "$1" in
    localhost|127.0.0.1|::1|*.local|staging.*|*staging*|*.test|*disposable*) return 0 ;;
    "") return 1 ;;
    *) return 1 ;;
  esac
}
# Explicit denylist for known production hosts
case "$API_HOST" in
  api.poshaktaranom.com|poshaktaranom.com|poshaktaranom.ir|www.poshaktaranom.com|www.poshaktaranom.ir)
    fail "API_URL host '$API_HOST' is production — forbidden."
    ;;
esac
case "$WEB_HOST" in
  poshaktaranom.com|poshaktaranom.ir|www.poshaktaranom.com|www.poshaktaranom.ir)
    fail "WEB_URL host '$WEB_HOST' is production — forbidden."
    ;;
esac
if ! is_allowed_host "$API_HOST"; then
  if [[ "${E2E_ALLOW_CUSTOM_HOST:-0}" != "1" ]]; then
    fail "API_URL host '$API_HOST' not in localhost/staging allowlist. Set E2E_ALLOW_CUSTOM_HOST=1 only for known non-prod staging."
  fi
fi

# Block known production DB names unless target is explicitly disposable AND operator overrides with non-prod DB name.
if [[ -n "$PG_DB" ]]; then
  case "$PG_DB" in
    taranom_db|postgres|production|prod)
      fail "E2E_POSTGRES_DB='$PG_DB' looks like production. Use a disposable/staging database name."
      ;;
  esac
fi

# Hard block: never docker-exec into default production container+db without explicit non-prod DB.
if [[ "${PG_CONTAINER}" == "taranom_postgres" && -z "$PG_DB" ]]; then
  fail "Refusing default taranom_postgres without E2E_POSTGRES_DB set to a non-production database."
fi

echo "=== E2E target=$TARGET api=$API web=$WEB_URL ==="
echo "=== 1. API Health ==="
curl -sf "$API/health"
echo

echo "=== 2. Get product ==="
PRODUCT_JSON=$(curl -sf "$API/products?limit=1")
PRODUCT_ID=$(echo "$PRODUCT_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")
SLUG=$(echo "$PRODUCT_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['slug'])")
echo "Product ID: $PRODUCT_ID"

DETAIL=$(curl -sf "$API/products/$PRODUCT_ID")
VARIANT_ID=$(echo "$DETAIL" | python3 -c "
import sys, json
d = json.load(sys.stdin)
min_q = max(int(d.get('minOrderQty', 1) or 1), 1)
vs = [v for v in d.get('variants', []) if int(v.get('stock', 0)) >= min_q]
if not vs:
  vs = [v for v in d.get('variants', []) if int(v.get('stock', 0)) > 0]
print(vs[0]['id'] if vs else '')
")
META=$(echo "$DETAIL" | python3 -c "
import sys, json
d = json.load(sys.stdin)
min_q = max(int(d.get('minOrderQty', 1) or 1), 1)
vs = [v for v in d.get('variants', []) if int(v.get('stock', 0)) >= min_q]
if not vs:
  vs = [v for v in d.get('variants', []) if int(v.get('stock', 0)) > 0]
v = vs[0] if vs else {}
qty = min(min_q, int(v.get('stock', 0))) if v else min_q
print('|'.join([
  v.get('color', ''),
  v.get('size', ''),
  str(d.get('wholesalePrice', 0)),
  d.get('name', '').replace('|', ' '),
  d.get('sku', ''),
  str(qty),
  str(len(d.get('images', []))),
  str(v.get('stock', 0)),
]))
")
IFS='|' read -r COLOR SIZE PRICE NAME SKU QTY IMAGES STOCK <<< "$META"
echo "Variant: $VARIANT_ID | $COLOR/$SIZE | qty=$QTY | stock=$STOCK | images=$IMAGES"

if [ -z "$VARIANT_ID" ]; then
  fail "No variant with stock"
fi

echo "=== 3. Slug endpoint ==="
ENCODED_SLUG=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$SLUG'''))")
curl -sf -o /dev/null -w "slug HTTP %{http_code}\n" "$API/products/slug/$ENCODED_SLUG"

echo "=== 4. Customer login (API only; no production password mutation) ==="
CUSTOMER_PHONE="$PHONE"

if [[ "$ALLOW_DB_ACTIVATE" == "1" ]]; then
  [[ -n "$PG_CONTAINER" && -n "$PG_DB" ]] || fail "E2E_ALLOW_DB_ACTIVATE=1 requires E2E_POSTGRES_CONTAINER and E2E_POSTGRES_DB"
  docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 \
    -v phone="$CUSTOMER_PHONE" \
    -c "UPDATE users SET \"isActive\"=true WHERE phone = :'phone';" >/dev/null || true
  docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 \
    -v phone="$CUSTOMER_PHONE" \
    -c "UPDATE customers SET status='ACTIVE' WHERE phone = :'phone';" >/dev/null || true
fi

LOGIN_RESP=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" \
  -d "{\"phone\":\"$CUSTOMER_PHONE\",\"password\":\"$PASSWORD\"}")

if ! echo "$LOGIN_RESP" | grep -q accessToken; then
  if [[ "$ALLOW_PASSWORD_RESET" == "1" ]]; then
    [[ -n "$PG_CONTAINER" && -n "$PG_DB" ]] || fail "Password reset requires E2E_POSTGRES_CONTAINER and E2E_POSTGRES_DB"
    [[ "$TARGET" != "staging" && "$TARGET" != "local" && "$TARGET" != "disposable" ]] && fail "unreachable"
    # Still refuse production-shaped DB names (already gated above).
    echo "Password reset authorized for non-prod DB=$PG_DB (E2E_ALLOW_PASSWORD_RESET=1)"
    API_CONTAINER="${E2E_API_CONTAINER:-taranom_api}"
    # Pass password via env into container (not argv); never use production DB names (gated above).
    HASH=$(docker exec -e E2E_PW="$PASSWORD" "$API_CONTAINER" node -e "const b=require('bcryptjs'); b.hash(process.env.E2E_PW,12).then(h=>process.stdout.write(h))")
    docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 \
      -v phone="$CUSTOMER_PHONE" -v hash="$HASH" \
      -c "UPDATE users SET \"passwordHash\" = :'hash', \"isActive\" = true WHERE phone = :'phone';" >/dev/null
    docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 \
      -v phone="$CUSTOMER_PHONE" \
      -c "UPDATE customers SET status = 'ACTIVE' WHERE phone = :'phone';" >/dev/null || true
    LOGIN_RESP=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" \
      -d "{\"phone\":\"$CUSTOMER_PHONE\",\"password\":\"$PASSWORD\"}")
  else
    echo "Login failed body: $LOGIN_RESP"
    fail "Login failed. Provide correct E2E_PASSWORD or use disposable DB with E2E_ALLOW_PASSWORD_RESET=1 (never production)."
  fi
fi

if ! echo "$LOGIN_RESP" | grep -q accessToken; then
  echo "Login failed body: $LOGIN_RESP"
  exit 1
fi
echo "Logged in as $CUSTOMER_PHONE"
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

echo "=== 5. Create order (CASH — no gateway charge) ==="
ORDER_BODY=$(echo "$DETAIL" | python3 -c "
import sys, json
d = json.load(sys.stdin)
min_q = max(int(d.get('minOrderQty', 1) or 1), 1)
vs = [v for v in d.get('variants', []) if int(v.get('stock', 0)) >= min_q]
if not vs:
  vs = [v for v in d.get('variants', []) if int(v.get('stock', 0)) > 0]
v = vs[0]
qty = min(min_q, int(v.get('stock', 0)))
print(json.dumps({
  'items': [{
    'productVariantId': v['id'],
    'quantity': qty,
    'unitPrice': int(d['wholesalePrice']),
    'productName': d['name'],
    'sku': d.get('sku', ''),
    'color': v['color'],
    'size': v['size'],
  }],
  'shippingMethod': 'CHAPAR',
  'paymentMethod': 'CASH',
  'notes': 'E2E automated test',
}))
")

ORDER_RESP=$(curl -s -X POST "$API/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$ORDER_BODY")

if ! echo "$ORDER_RESP" | grep -q orderNumber; then
  echo "Order failed: $ORDER_RESP"
  exit 1
fi

ORDER_NUM=$(echo "$ORDER_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['orderNumber'])")
ORDER_STATUS=$(echo "$ORDER_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
echo "Order: $ORDER_NUM status=$ORDER_STATUS"

echo "=== 6. Verify order list ==="
curl -sf -H "Authorization: Bearer $TOKEN" "$API/orders?limit=1" | python3 -c "import sys,json; o=json.load(sys.stdin)['data'][0]; print('Latest:', o['orderNumber'], o['status'], len(o.get('items',[])), 'items')"

echo "=== 7. Web pages ==="
curl -sf -o /dev/null -w "products HTTP %{http_code}\n" "$WEB_URL/products"
curl -sf -o /dev/null -w "checkout HTTP %{http_code}\n" "$WEB_URL/checkout"

echo "=== E2E PASSED (target=$TARGET order=$ORDER_NUM) ==="
