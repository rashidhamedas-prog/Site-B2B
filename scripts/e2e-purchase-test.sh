#!/usr/bin/env bash
# Wholesale purchase E2E — disposable / exact-allowlisted non-prod ONLY.
# Never run against production DB or live payment gateways.
#
# Required:
#   E2E_TARGET=disposable|local|staging
#   E2E_ALLOW_MUTATION=1
#   E2E_PHONE / E2E_PASSWORD  (no hardcoded credentials)
#   E2E_PRODUCT_ID or E2E_PRODUCT_SKU  (deterministic fixture; stock >= MOQ required)
#
# Hosts: exact positive allowlist only (default localhost). Staging hosts must be
# listed exactly in E2E_ALLOWED_API_HOSTS / E2E_ALLOWED_WEB_HOSTS (comma-separated).
# There is NO E2E_ALLOW_CUSTOM_HOST bypass.
#
# SQL activate/password mutation: ONLY when E2E_TARGET=disposable AND
# E2E_POSTGRES_DB / E2E_POSTGRES_CONTAINER match the immutable disposable sentinels
# (defaults: taranom_e2e_disposable / taranom_c3_e2e). Labels alone are insufficient.
#
# Optional:
#   API_URL (default http://127.0.0.1:4000/v1)
#   WEB_URL (default http://127.0.0.1:3000)
#   E2E_ALLOWED_API_HOSTS / E2E_ALLOWED_WEB_HOSTS
#   E2E_DISPOSABLE_DB / E2E_DISPOSABLE_CONTAINER
#   E2E_ALLOW_DB_ACTIVATE=1 / E2E_ALLOW_PASSWORD_RESET=1 (disposable sentinel only)
set -euo pipefail

API="${API_URL:-http://127.0.0.1:4000/v1}"
WEB_URL="${WEB_URL:-http://127.0.0.1:3000}"
TARGET="${E2E_TARGET:-}"
ALLOW_MUTATION="${E2E_ALLOW_MUTATION:-0}"
PHONE="${E2E_PHONE:-}"
PASSWORD="${E2E_PASSWORD:-}"
PG_CONTAINER="${E2E_POSTGRES_CONTAINER:-}"
PG_USER="${E2E_POSTGRES_USER:-taranom}"
PG_DB="${E2E_POSTGRES_DB:-}"
ALLOW_DB_ACTIVATE="${E2E_ALLOW_DB_ACTIVATE:-0}"
ALLOW_PASSWORD_RESET="${E2E_ALLOW_PASSWORD_RESET:-0}"
PRODUCT_ID_ENV="${E2E_PRODUCT_ID:-}"
PRODUCT_SKU_ENV="${E2E_PRODUCT_SKU:-}"
DISPOSABLE_DB="taranom_e2e_disposable"
DISPOSABLE_CONTAINER="taranom_c3_e2e"
ALLOWED_API_HOSTS="${E2E_ALLOWED_API_HOSTS:-localhost,127.0.0.1,::1}"
ALLOWED_WEB_HOSTS="${E2E_ALLOWED_WEB_HOSTS:-localhost,127.0.0.1,::1}"

fail() { echo "FAIL: $*" >&2; exit 1; }

# Immutable disposable sentinels — env overrides of names are rejected.
if [[ -n "${E2E_DISPOSABLE_DB:-}" && "${E2E_DISPOSABLE_DB}" != "$DISPOSABLE_DB" ]]; then
  fail "E2E_DISPOSABLE_DB override forbidden; immutable sentinel is '$DISPOSABLE_DB'."
fi
if [[ -n "${E2E_DISPOSABLE_CONTAINER:-}" && "${E2E_DISPOSABLE_CONTAINER}" != "$DISPOSABLE_CONTAINER" ]]; then
  fail "E2E_DISPOSABLE_CONTAINER override forbidden; immutable sentinel is '$DISPOSABLE_CONTAINER'."
fi

if command -v python3 >/dev/null 2>&1 && python3 -c 'import sys' >/dev/null 2>&1; then
  PYTHON=python3
elif command -v python >/dev/null 2>&1 && python -c 'import sys' >/dev/null 2>&1; then
  PYTHON=python
else
  fail "python3 or python is required"
fi

# Reject legacy bypass entirely (even if set).
if [[ -n "${E2E_ALLOW_CUSTOM_HOST:-}" ]]; then
  fail "E2E_ALLOW_CUSTOM_HOST is removed. Add exact hosts to E2E_ALLOWED_API_HOSTS / E2E_ALLOWED_WEB_HOSTS."
fi

case "$TARGET" in
  staging|local|disposable) ;;
  *)
    fail "E2E_TARGET must be staging|local|disposable (got '${TARGET:-empty}'). Production is forbidden."
    ;;
esac

[[ "$ALLOW_MUTATION" == "1" ]] || fail "Set E2E_ALLOW_MUTATION=1 to create orders (non-prod only)."
[[ -n "$PHONE" ]] || fail "Set E2E_PHONE (no hardcoded test phone)."
[[ -n "$PASSWORD" ]] || fail "Set E2E_PASSWORD (no hardcoded test password)."
[[ -n "$PRODUCT_ID_ENV" || -n "$PRODUCT_SKU_ENV" ]] || fail "Set E2E_PRODUCT_ID or E2E_PRODUCT_SKU (deterministic fixture; no first-product fallback)."

# Safe argv parsing — never interpolate untrusted values into python -c source.
API_HOST="$("$PYTHON" -c 'from urllib.parse import urlparse; import sys; print(urlparse(sys.argv[1]).hostname or "")' "$API")"
WEB_HOST="$("$PYTHON" -c 'from urllib.parse import urlparse; import sys; print(urlparse(sys.argv[1]).hostname or "")' "$WEB_URL")"

host_in_csv() {
  local host="$1"
  local csv="$2"
  local item
  IFS=',' read -ra _hosts <<< "$csv"
  for item in "${_hosts[@]}"; do
    item="$(echo "$item" | tr -d '[:space:]')"
    [[ -n "$item" && "$host" == "$item" ]] && return 0
  done
  return 1
}

[[ -n "$API_HOST" ]] || fail "API_URL has no hostname."
[[ -n "$WEB_HOST" ]] || fail "WEB_URL has no hostname."

# Exact positive allowlist (no globs, no substring staging matches).
host_in_csv "$API_HOST" "$ALLOWED_API_HOSTS" || fail "API_URL host '$API_HOST' not in exact allowlist E2E_ALLOWED_API_HOSTS='$ALLOWED_API_HOSTS'."
host_in_csv "$WEB_HOST" "$ALLOWED_WEB_HOSTS" || fail "WEB_URL host '$WEB_HOST' not in exact allowlist E2E_ALLOWED_WEB_HOSTS='$ALLOWED_WEB_HOSTS'."

# Hard production denylist (defense in depth; allowlist is primary).
case "$API_HOST" in
  api.poshaktaranom.com|poshaktaranom.com|poshaktaranom.ir|www.poshaktaranom.com|www.poshaktaranom.ir|5.75.200.102)
    fail "API_URL host '$API_HOST' is production — forbidden."
    ;;
esac
case "$WEB_HOST" in
  poshaktaranom.com|poshaktaranom.ir|www.poshaktaranom.com|www.poshaktaranom.ir|5.75.200.102)
    fail "WEB_URL host '$WEB_HOST' is production — forbidden."
    ;;
esac

require_disposable_sentinel() {
  [[ "$TARGET" == "disposable" ]] || fail "SQL mutation requires E2E_TARGET=disposable (got '$TARGET')."
  [[ -n "$PG_CONTAINER" && -n "$PG_DB" ]] || fail "SQL mutation requires E2E_POSTGRES_CONTAINER and E2E_POSTGRES_DB."
  [[ "$PG_DB" == "$DISPOSABLE_DB" ]] || fail "E2E_POSTGRES_DB must exactly equal disposable sentinel '$DISPOSABLE_DB' (got '$PG_DB'). Denylist/labels insufficient."
  [[ "$PG_CONTAINER" == "$DISPOSABLE_CONTAINER" ]] || fail "E2E_POSTGRES_CONTAINER must exactly equal disposable sentinel '$DISPOSABLE_CONTAINER' (got '$PG_CONTAINER')."
  # Positive identity probe inside the disposable DB.
  local marker
  marker="$(docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -Atqc "SELECT current_database();" 2>/dev/null || true)"
  [[ "$marker" == "$DISPOSABLE_DB" ]] || fail "Disposable sentinel probe failed: current_database='$marker' expected '$DISPOSABLE_DB'."
}

if [[ "$ALLOW_DB_ACTIVATE" == "1" || "$ALLOW_PASSWORD_RESET" == "1" ]]; then
  require_disposable_sentinel
fi

# Refuse known production DB names even if somehow passed.
if [[ -n "$PG_DB" ]]; then
  case "$PG_DB" in
    taranom_db|postgres|production|prod)
      fail "E2E_POSTGRES_DB='$PG_DB' looks like production. Use disposable sentinel '$DISPOSABLE_DB'."
      ;;
  esac
fi

if [[ "${PG_CONTAINER}" == "taranom_postgres" ]]; then
  fail "Refusing production-shaped container 'taranom_postgres'. Use disposable sentinel '$DISPOSABLE_CONTAINER'."
fi

echo "=== E2E target=$TARGET api=$API web=$WEB_URL ==="
echo "=== 1. API Health ==="
curl -sf "$API/health"
echo

echo "=== 2. Get deterministic product fixture ==="
if [[ -n "$PRODUCT_ID_ENV" ]]; then
  DETAIL=$(curl -sf "$API/products/$PRODUCT_ID_ENV") || fail "Fixture product id '$PRODUCT_ID_ENV' not found."
else
  # Resolve by SKU via list filter if API supports it; else scan small page.
  PRODUCT_JSON=$(curl -sf "$API/products?limit=50&sku=$("$PYTHON" -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$PRODUCT_SKU_ENV")") || true
  PRODUCT_ID=$(echo "${PRODUCT_JSON:-}" | "$PYTHON" -c '
import sys, json
sku = sys.argv[1]
raw = sys.stdin.read().strip()
if not raw:
  raise SystemExit(1)
try:
  data = json.loads(raw)
except Exception:
  raise SystemExit(1)
rows = data.get("data") if isinstance(data, dict) else data
if not isinstance(rows, list):
  rows = []
match = next((p for p in rows if str(p.get("sku") or "") == sku), None)
if not match:
  raise SystemExit(1)
print(match["id"])
' "$PRODUCT_SKU_ENV") || fail "Fixture SKU '$PRODUCT_SKU_ENV' not found among products?limit=50."
  DETAIL=$(curl -sf "$API/products/$PRODUCT_ID") || fail "Fixture product '$PRODUCT_ID' detail fetch failed."
fi

PRODUCT_ID=$(echo "$DETAIL" | "$PYTHON" -c 'import sys,json; print(json.load(sys.stdin)["id"])')
SLUG=$(echo "$DETAIL" | "$PYTHON" -c 'import sys,json; print(json.load(sys.stdin).get("slug") or "")')
echo "Product ID: $PRODUCT_ID slug=$SLUG"

PICK=$(echo "$DETAIL" | "$PYTHON" -c '
import sys, json
d = json.load(sys.stdin)
min_q = max(int(d.get("minOrderQty", 1) or 1), 1)
vs = [v for v in d.get("variants", []) if int(v.get("stock", 0) or 0) >= min_q]
if not vs:
  print("NO_MOQ_STOCK", file=sys.stderr)
  raise SystemExit(2)
v = vs[0]
qty = min_q
print("|".join([
  v["id"],
  v.get("color", ""),
  v.get("size", ""),
  str(int(d.get("wholesalePrice", 0) or 0)),
  (d.get("name") or "").replace("|", " "),
  d.get("sku") or "",
  str(qty),
  str(int(v.get("stock", 0) or 0)),
  str(min_q),
]))
') || fail "Seeded fixture has no variant with stock >= MOQ. Refusing below-MOQ fallback."

IFS='|' read -r VARIANT_ID COLOR SIZE PRICE NAME SKU QTY STOCK MIN_Q <<< "$PICK"
echo "Variant: $VARIANT_ID | $COLOR/$SIZE | qty=$QTY | stock=$STOCK | moq=$MIN_Q"

[[ -n "$VARIANT_ID" ]] || fail "No eligible variant."
[[ "$QTY" -ge "$MIN_Q" ]] || fail "Quantity $QTY < MOQ $MIN_Q."

echo "=== 3. Slug endpoint ==="
ENCODED_SLUG=$("$PYTHON" -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$SLUG")
curl -sf -o /dev/null -w "slug HTTP %{http_code}\n" "$API/products/slug/$ENCODED_SLUG"

echo "=== 4. Customer login ==="
CUSTOMER_PHONE="$PHONE"

if [[ "$ALLOW_DB_ACTIVATE" == "1" ]]; then
  require_disposable_sentinel
  docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 \
    -v phone="$CUSTOMER_PHONE" \
    -c "UPDATE users SET \"isActive\"=true WHERE phone = :'phone';" >/dev/null
  docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 \
    -v phone="$CUSTOMER_PHONE" \
    -c "UPDATE customers SET status='ACTIVE' WHERE phone = :'phone';" >/dev/null
fi

LOGIN_RESP=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" \
  -d "{\"phone\":\"$CUSTOMER_PHONE\",\"password\":\"$PASSWORD\"}")

if ! echo "$LOGIN_RESP" | grep -q accessToken; then
  if [[ "$ALLOW_PASSWORD_RESET" == "1" ]]; then
    require_disposable_sentinel
    echo "Password reset authorized ONLY for disposable sentinel DB=$PG_DB container=$PG_CONTAINER"
    API_CONTAINER="${E2E_API_CONTAINER:-taranom_api}"
    HASH=$(docker exec -e E2E_PW="$PASSWORD" "$API_CONTAINER" node -e "const b=require('bcryptjs'); b.hash(process.env.E2E_PW,12).then(h=>process.stdout.write(h))")
    docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 \
      -v phone="$CUSTOMER_PHONE" -v hash="$HASH" \
      -c "UPDATE users SET \"passwordHash\" = :'hash', \"isActive\" = true WHERE phone = :'phone';" >/dev/null
    docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 \
      -v phone="$CUSTOMER_PHONE" \
      -c "UPDATE customers SET status = 'ACTIVE' WHERE phone = :'phone';" >/dev/null
    LOGIN_RESP=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" \
      -d "{\"phone\":\"$CUSTOMER_PHONE\",\"password\":\"$PASSWORD\"}")
  else
    echo "Login failed body: $LOGIN_RESP"
    fail "Login failed. Provide correct E2E_PASSWORD or disposable sentinel + E2E_ALLOW_PASSWORD_RESET=1."
  fi
fi

if ! echo "$LOGIN_RESP" | grep -q accessToken; then
  echo "Login failed body: $LOGIN_RESP"
  exit 1
fi
echo "Logged in as $CUSTOMER_PHONE"
TOKEN=$(echo "$LOGIN_RESP" | "$PYTHON" -c 'import sys,json; print(json.load(sys.stdin)["accessToken"])')

echo "=== 5. Create order (CASH — no gateway charge) ==="
ORDER_BODY=$("$PYTHON" -c '
import json, sys
variant_id, qty, price, name, sku, color, size = sys.argv[1:8]
print(json.dumps({
  "items": [{
    "productVariantId": variant_id,
    "quantity": int(qty),
    "unitPrice": int(price),
    "productName": name,
    "sku": sku,
    "color": color,
    "size": size,
  }],
  "shippingMethod": "CHAPAR",
  "paymentMethod": "CASH",
  "notes": "E2E automated test",
}))
' "$VARIANT_ID" "$QTY" "$PRICE" "$NAME" "$SKU" "$COLOR" "$SIZE")

ORDER_RESP=$(curl -s -X POST "$API/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$ORDER_BODY")

if ! echo "$ORDER_RESP" | grep -q orderNumber; then
  echo "Order failed: $ORDER_RESP"
  exit 1
fi

ORDER_ASSERT=$(echo "$ORDER_RESP" | "$PYTHON" -c '
import sys, json
o = json.load(sys.stdin)
num = o.get("orderNumber")
status = o.get("status")
pm = o.get("paymentMethod")
items = o.get("items") or []
assert num, "missing orderNumber"
assert status, "missing status"
assert pm == "CASH", f"paymentMethod want CASH got {pm}"
assert len(items) >= 1, "missing items"
it = items[0]
want_vid = sys.argv[1]
want_qty = int(sys.argv[2])
want_price = int(sys.argv[3])
got_vid = str(it.get("productVariantId") or it.get("variantId") or "")
got_qty = int(it.get("quantity") or 0)
got_unit = int(it.get("unitPrice") or it.get("price") or 0)
assert got_vid == want_vid, f"variant want {want_vid} got {got_vid}"
assert got_qty == want_qty, f"qty want {want_qty} got {got_qty}"
# totals: exact line total; shipping extras must be absent for CASH E2E fixture
total = o.get("totalAmount")
if total is None:
  total = o.get("payableAmount")
if total is None:
  total = o.get("total")
if total is None:
  total = got_unit * got_qty
total = int(total)
expected = want_price * want_qty
assert total == expected, f"total want {expected} got {total}"
print("|".join([str(num), str(status), str(pm), got_vid, str(got_qty), str(got_unit), str(total)]))
' "$VARIANT_ID" "$QTY" "$PRICE") || fail "Exact order assertion failed on create response."

IFS='|' read -r ORDER_NUM ORDER_STATUS ORDER_PM ORDER_VID ORDER_QTY ORDER_UNIT ORDER_TOTAL <<< "$ORDER_ASSERT"
echo "Order: $ORDER_NUM status=$ORDER_STATUS pm=$ORDER_PM items=1 qty=$ORDER_QTY unit=$ORDER_UNIT total=$ORDER_TOTAL"

echo "=== 6. Verify exact order in list ==="
curl -sf -H "Authorization: Bearer $TOKEN" "$API/orders?limit=20" | "$PYTHON" -c '
import sys, json
want = sys.argv[1]
want_status = sys.argv[2]
want_pm = sys.argv[3]
want_vid = sys.argv[4]
want_qty = int(sys.argv[5])
data = json.load(sys.stdin)
rows = data.get("data") if isinstance(data, dict) else data
match = next((o for o in rows if str(o.get("orderNumber")) == want), None)
assert match is not None, f"created order {want} not found in list"
assert str(match.get("status")) == want_status, f"status mismatch {match.get('status')}"
pm = match.get("paymentMethod")
assert str(pm) == want_pm, f"paymentMethod mismatch want {want_pm} got {pm}"
items = match.get("items") or []
assert any(
  str(i.get("productVariantId") or i.get("variantId") or "") == want_vid
  and int(i.get("quantity") or 0) == want_qty
  for i in items
), "item variant/qty not found on listed order"
print("Verified exact order:", want, match.get("status"), len(items), "items")
' "$ORDER_NUM" "$ORDER_STATUS" "$ORDER_PM" "$ORDER_VID" "$ORDER_QTY" || fail "Exact order list assertion failed."

echo "=== 7. Web pages ==="
curl -sf -o /dev/null -w "products HTTP %{http_code}\n" "$WEB_URL/products"
curl -sf -o /dev/null -w "checkout HTTP %{http_code}\n" "$WEB_URL/checkout"

echo "=== E2E PASSED (target=$TARGET order=$ORDER_NUM status=$ORDER_STATUS pm=$ORDER_PM qty=$ORDER_QTY total=$ORDER_TOTAL) ==="
