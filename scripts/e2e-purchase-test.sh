#!/usr/bin/env bash
# Wholesale purchase E2E — disposable / exact-allowlisted non-prod ONLY.
# Never run against production DB or live payment gateways.
#
# Required:
#   E2E_TARGET=disposable|local|staging
#   E2E_ALLOW_MUTATION=1
#   E2E_PHONE / E2E_PASSWORD  (provisioned fixture users — no SQL activate/reset)
#   E2E_PRODUCT_ID or E2E_PRODUCT_SKU  (deterministic fixture; stock >= MOQ required)
#   Identity fixture (from scripts/provision-e2e-identity.sh):
#     scripts/fixtures/e2e-expected-identity.json
#     OR /etc/taranom/e2e-expected-identity.json
#
# Host allowlists are IMMUTABLE. Setting E2E_ALLOWED_API_HOSTS or
# E2E_ALLOWED_WEB_HOSTS causes an immediate fail-closed exit.
#
#   local|disposable → ONLY localhost,127.0.0.1,::1
#   staging → ONLY staging-api.poshaktaranom.com (+ www) and
#             staging.poshaktaranom.com (+ www)
#
# SQL activate/password mutation paths were REMOVED.
#
# Optional:
#   API_URL (default http://127.0.0.1:4000/v1)
#   WEB_URL (default http://127.0.0.1:3000)
#   E2E_IDENTITY_FIXTURE (path override for fixture file — not the deployment id)
set -euo pipefail

API="${API_URL:-http://127.0.0.1:4000/v1}"
WEB_URL="${WEB_URL:-http://127.0.0.1:3000}"
TARGET="${E2E_TARGET:-}"
ALLOW_MUTATION="${E2E_ALLOW_MUTATION:-0}"
PHONE="${E2E_PHONE:-}"
PASSWORD="${E2E_PASSWORD:-}"
PRODUCT_ID_ENV="${E2E_PRODUCT_ID:-}"
PRODUCT_SKU_ENV="${E2E_PRODUCT_SKU:-}"

EXPECTED_INITIAL_STATUS="PENDING_REVIEW"
EXPECTED_PAYMENT_METHOD="CASH"
EXPECTED_ITEMS_COUNT=1
PROD_IP_DENYLIST="5.75.200.102"

IMMUTABLE_LOCAL_HOSTS="localhost,127.0.0.1,::1"
IMMUTABLE_STAGING_API_HOSTS="staging-api.poshaktaranom.com,www.staging-api.poshaktaranom.com"
IMMUTABLE_STAGING_WEB_HOSTS="staging.poshaktaranom.com,www.staging.poshaktaranom.com"

fail() { echo "FAIL: $*" >&2; exit 1; }

if command -v python3 >/dev/null 2>&1 && python3 -c 'import sys' >/dev/null 2>&1; then
  PYTHON=python3
elif command -v python >/dev/null 2>&1 && python -c 'import sys' >/dev/null 2>&1; then
  PYTHON=python
else
  fail "python3 or python is required"
fi

# Reject override / legacy escape hatches.
if [[ -n "${E2E_ALLOW_CUSTOM_HOST:-}" ]]; then
  fail "E2E_ALLOW_CUSTOM_HOST is removed. Host allowlists are immutable in-script."
fi
if [[ -n "${E2E_ALLOWED_API_HOSTS:-}" ]]; then
  fail "E2E_ALLOWED_API_HOSTS overrides are forbidden. Trust-root hosts are hardcoded immutable allowlists."
fi
if [[ -n "${E2E_ALLOWED_WEB_HOSTS:-}" ]]; then
  fail "E2E_ALLOWED_WEB_HOSTS overrides are forbidden. Trust-root hosts are hardcoded immutable allowlists."
fi
if [[ -n "${E2E_ALLOW_DB_ACTIVATE:-}" && "${E2E_ALLOW_DB_ACTIVATE}" != "0" ]]; then
  fail "SQL activate path removed. Provision fixture users; E2E_ALLOW_DB_ACTIVATE is forbidden."
fi
if [[ -n "${E2E_ALLOW_PASSWORD_RESET:-}" && "${E2E_ALLOW_PASSWORD_RESET}" != "0" ]]; then
  fail "SQL password-reset path removed. Provision fixture users; E2E_ALLOW_PASSWORD_RESET is forbidden."
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

case "$TARGET" in
  local|disposable)
    ALLOWED_API_HOSTS="$IMMUTABLE_LOCAL_HOSTS"
    ALLOWED_WEB_HOSTS="$IMMUTABLE_LOCAL_HOSTS"
    ;;
  staging)
    ALLOWED_API_HOSTS="$IMMUTABLE_STAGING_API_HOSTS"
    ALLOWED_WEB_HOSTS="$IMMUTABLE_STAGING_WEB_HOSTS"
    ;;
esac

host_in_csv "$API_HOST" "$ALLOWED_API_HOSTS" || fail "API_URL host '$API_HOST' not in immutable allowlist for E2E_TARGET=$TARGET ('$ALLOWED_API_HOSTS')."
host_in_csv "$WEB_HOST" "$ALLOWED_WEB_HOSTS" || fail "WEB_URL host '$WEB_HOST' not in immutable allowlist for E2E_TARGET=$TARGET ('$ALLOWED_WEB_HOSTS')."

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

# --- Identity fixture must exist BEFORE DNS/login/mutation (localhost alone is insufficient) ---
resolve_identity_fixture() {
  if [[ -n "${E2E_IDENTITY_FIXTURE:-}" ]]; then
    [[ -f "$E2E_IDENTITY_FIXTURE" ]] || fail "E2E_IDENTITY_FIXTURE='$E2E_IDENTITY_FIXTURE' not found."
    echo "$E2E_IDENTITY_FIXTURE"
    return
  fi
  local repo_fixture
  repo_fixture="$(cd "$(dirname "$0")" && pwd)/fixtures/e2e-expected-identity.json"
  if [[ -f "$repo_fixture" ]]; then
    echo "$repo_fixture"
    return
  fi
  if [[ -f /etc/taranom/e2e-expected-identity.json ]]; then
    echo /etc/taranom/e2e-expected-identity.json
    return
  fi
  fail "Missing E2E identity fixture. Run scripts/provision-e2e-identity.sh (writes scripts/fixtures/e2e-expected-identity.json) or install /etc/taranom/e2e-expected-identity.json. Localhost alone is not proof of non-production."
}

IDENTITY_FIXTURE="$(resolve_identity_fixture)"
EXPECTED_DEPLOYMENT_ID="$("$PYTHON" -c '
import json, sys
with open(sys.argv[1], encoding="utf-8") as f:
  data = json.load(f)
dep = data.get("expectedDeploymentId") or ""
if not dep:
  raise SystemExit(1)
print(dep)
' "$IDENTITY_FIXTURE")" || fail "Identity fixture '$IDENTITY_FIXTURE' missing expectedDeploymentId."

resolve_and_deny_prod_ips() {
  local label="$1"
  local host="$2"
  # Loopback needs no DNS; skip to avoid platform getaddrinfo hangs.
  case "$host" in
    localhost|127.0.0.1|::1) return 0 ;;
  esac
  local result
  result="$("$PYTHON" -c '
import socket, sys
host = sys.argv[1]
deny = set(sys.argv[2].split(","))
socket.setdefaulttimeout(3)
try:
  infos = socket.getaddrinfo(host, None)
except socket.gaierror as e:
  print("UNRESOLVED|" + str(e))
  raise SystemExit(4)
except OSError as e:
  print("ERROR|" + str(e))
  raise SystemExit(3)
for fam, _, _, _, sockaddr in infos:
  ip = sockaddr[0]
  if ip in deny:
    print("DENIED|" + ip)
    raise SystemExit(2)
print("OK")
' "$host" "$PROD_IP_DENYLIST")" || fail "$label host '$host' resolves to a production IP (denylist $PROD_IP_DENYLIST)."
  case "$result" in
    DENIED\|*) fail "$label host '$host' resolves to production IP ${result#DENIED|}." ;;
    ERROR\|*) fail "$label host '$host' DNS resolve failed: ${result#ERROR|}." ;;
    UNRESOLVED\|*) fail "$label host '$host' DNS unresolved (fail closed; cannot validate against production IP denylist): ${result#UNRESOLVED|}." ;;
  esac
}

resolve_and_deny_prod_ips "API" "$API_HOST"
resolve_and_deny_prod_ips "WEB" "$WEB_HOST"

echo "=== E2E target=$TARGET api=$API web=$WEB_URL identity_fixture=$IDENTITY_FIXTURE ==="
echo "=== 0. Environment identity (fail closed before login/mutation) ==="

IDENTITY_TMP="$(mktemp)"
IDENTITY_META=$(curl -sS -o "$IDENTITY_TMP" -w "%{http_code}|%{url_effective}" \
  --connect-timeout 3 --max-time 8 --max-redirs 0 \
  "$API/env-identity" 2>/dev/null || true)
IDENTITY_CODE="${IDENTITY_META%%|*}"
IDENTITY_EFFECTIVE="${IDENTITY_META#*|}"
IDENTITY_BODY="$(cat "$IDENTITY_TMP" 2>/dev/null || true)"
rm -f "$IDENTITY_TMP"

[[ "$IDENTITY_CODE" == "200" ]] || fail "GET /v1/env-identity returned HTTP ${IDENTITY_CODE:-none}. API must have DEPLOYMENT_IDENTITY + APP_ENV=staging|local|disposable. Provision via scripts/provision-e2e-identity.sh."

EFFECTIVE_HOST="$("$PYTHON" -c 'from urllib.parse import urlparse; import sys; print(urlparse(sys.argv[1]).hostname or "")' "$IDENTITY_EFFECTIVE")"
[[ "$EFFECTIVE_HOST" == "$API_HOST" ]] || fail "env-identity effective host '$EFFECTIVE_HOST' != API host '$API_HOST' (possible redirect to another environment)."

GOT_DEPLOYMENT_ID="$("$PYTHON" -c '
import sys, json
raw = sys.stdin.read().strip()
try:
  data = json.loads(raw)
except Exception:
  raise SystemExit(1)
dep = data.get("deploymentId") or ""
env = str(data.get("environment") or "")
non_prod = data.get("nonProduction")
if not dep or non_prod is not True:
  raise SystemExit(2)
print(dep + "|" + env)
' <<<"$IDENTITY_BODY")" || fail "env-identity body invalid or nonProduction!=true: $IDENTITY_BODY"

GOT_DEP="${GOT_DEPLOYMENT_ID%%|*}"
GOT_ENV="${GOT_DEPLOYMENT_ID#*|}"
[[ "$GOT_DEP" == "$EXPECTED_DEPLOYMENT_ID" ]] || fail "Environment identity mismatch: fixture expectedDeploymentId='$EXPECTED_DEPLOYMENT_ID' but API deploymentId='$GOT_DEP'. Refusing login/orders."
echo "Identity OK: deploymentId=$GOT_DEP environment=$GOT_ENV"

echo "=== 1. API Health ==="
curl -sf "$API/health"
echo

echo "=== 2. Get deterministic product fixture ==="
if [[ -n "$PRODUCT_ID_ENV" ]]; then
  DETAIL=$(curl -sf "$API/products/$PRODUCT_ID_ENV") || fail "Fixture product id '$PRODUCT_ID_ENV' not found."
else
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
server_price = int(d.get("wholesalePrice", 0) or 0)
if server_price <= 0:
  print("NO_WHOLESALE_PRICE", file=sys.stderr)
  raise SystemExit(3)
print("|".join([
  v["id"],
  v.get("color", ""),
  v.get("size", ""),
  str(server_price),
  (d.get("name") or "").replace("|", " "),
  d.get("sku") or "",
  str(qty),
  str(int(v.get("stock", 0) or 0)),
  str(min_q),
  d.get("id") or "",
]))
') || fail "Seeded fixture has no variant with stock >= MOQ (or missing wholesalePrice). Refusing below-MOQ fallback."

IFS='|' read -r VARIANT_ID COLOR SIZE PRICE NAME SKU QTY STOCK MIN_Q PRODUCT_ID_FROM_DETAIL <<< "$PICK"
echo "Variant: $VARIANT_ID | $COLOR/$SIZE | qty=$QTY | stock=$STOCK | moq=$MIN_Q | wholesalePrice=$PRICE"

[[ -n "$VARIANT_ID" ]] || fail "No eligible variant."
[[ "$QTY" -ge "$MIN_Q" ]] || fail "Quantity $QTY < MOQ $MIN_Q."
[[ "$PRICE" -gt 0 ]] || fail "Fixture wholesalePrice must be > 0."

echo "=== 3. Slug endpoint ==="
ENCODED_SLUG=$("$PYTHON" -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$SLUG")
curl -sf -o /dev/null -w "slug HTTP %{http_code}\n" "$API/products/slug/$ENCODED_SLUG"

echo "=== 4. Customer login (provisioned credentials only — no SQL mutate) ==="
CUSTOMER_PHONE="$PHONE"

LOGIN_RESP=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" \
  -d "{\"phone\":\"$CUSTOMER_PHONE\",\"password\":\"$PASSWORD\"}")

if ! echo "$LOGIN_RESP" | grep -q accessToken; then
  echo "Login failed body: $LOGIN_RESP"
  fail "Login failed. Provision fixture users (active customer + known password) for this disposable/staging stack — SQL activate/password-reset paths were removed from this harness."
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
want_status = sys.argv[1]
want_pm = sys.argv[2]
want_vid = sys.argv[3]
want_qty = int(sys.argv[4])
want_unit = int(sys.argv[5])
want_items = int(sys.argv[6])
want_product_id = sys.argv[7]

num = o.get("orderNumber")
status = o.get("status")
pm = o.get("paymentMethod")
items = o.get("items") or []

assert num, "missing orderNumber"
assert status == want_status, f"status want exact {want_status} got {status!r} (presence alone insufficient)"
assert pm == want_pm, f"paymentMethod want {want_pm} got {pm}"
assert len(items) == want_items, f"items count want {want_items} got {len(items)}"

it = items[0]
got_vid = str(it.get("productVariantId") or it.get("variantId") or "")
got_qty = int(it.get("quantity") or 0)
got_unit = int(it.get("unitPrice") or it.get("price") or 0)
got_pid = str(it.get("productId") or "")

assert got_vid == want_vid, f"variant want {want_vid} got {got_vid}"
assert got_qty == want_qty, f"qty want {want_qty} got {got_qty}"
assert got_unit == want_unit, f"unitPrice want fixture wholesalePrice {want_unit} got {got_unit}"
if want_product_id and got_pid:
  assert got_pid == want_product_id, f"productId want {want_product_id} got {got_pid}"

subtotal = o.get("subtotal")
discount = o.get("discount")
shipping = o.get("shippingFee")
if shipping is None:
  shipping = o.get("shipping")
total = o.get("total")
if total is None:
  total = o.get("totalAmount")
payable = o.get("payableAmount")
if payable is None:
  payable = o.get("payable")
currency = o.get("currency")

assert subtotal is not None, "missing subtotal"
assert discount is not None, "missing discount"
assert shipping is not None, "missing shippingFee"
assert total is not None, "missing total"

subtotal = int(subtotal)
discount = int(discount)
shipping = int(shipping)
total = int(total)
expected_subtotal = want_unit * want_qty
assert subtotal == expected_subtotal, f"subtotal want {expected_subtotal} got {subtotal}"
assert discount >= 0, f"discount must be >= 0 got {discount}"
assert shipping >= 0, f"shipping must be >= 0 got {shipping}"
expected_total = max(0, subtotal - discount + shipping)
assert total == expected_total, f"total want {expected_total} (=subtotal-discount+shipping) got {total}"
if payable is not None:
  payable = int(payable)
  assert payable == total, f"payableAmount want {total} got {payable}"
if currency is not None:
  assert str(currency) in ("IRR", "IRT", "RLS", "ریال"), f"unexpected currency {currency!r}"

print("|".join([
  str(num), str(status), str(pm), got_vid, str(got_qty), str(got_unit),
  str(subtotal), str(discount), str(shipping), str(total),
]))
' "$EXPECTED_INITIAL_STATUS" "$EXPECTED_PAYMENT_METHOD" "$VARIANT_ID" "$QTY" "$PRICE" "$EXPECTED_ITEMS_COUNT" "$PRODUCT_ID") || fail "Exact order assertion failed on create response."

IFS='|' read -r ORDER_NUM ORDER_STATUS ORDER_PM ORDER_VID ORDER_QTY ORDER_UNIT \
  ORDER_SUBTOTAL ORDER_DISCOUNT ORDER_SHIPPING ORDER_TOTAL <<< "$ORDER_ASSERT"
echo "Order: $ORDER_NUM status=$ORDER_STATUS pm=$ORDER_PM items=$EXPECTED_ITEMS_COUNT qty=$ORDER_QTY unit=$ORDER_UNIT subtotal=$ORDER_SUBTOTAL discount=$ORDER_DISCOUNT shipping=$ORDER_SHIPPING total=$ORDER_TOTAL"

echo "=== 6. Verify exact order in list (create+fetch status/money match) ==="
curl -sf -H "Authorization: Bearer $TOKEN" "$API/orders?limit=20" | "$PYTHON" -c '
import sys, json
want = sys.argv[1]
want_status = sys.argv[2]
want_pm = sys.argv[3]
want_vid = sys.argv[4]
want_qty = int(sys.argv[5])
want_unit = int(sys.argv[6])
want_items = int(sys.argv[7])
want_subtotal = int(sys.argv[8])
want_discount = int(sys.argv[9])
want_shipping = int(sys.argv[10])
want_total = int(sys.argv[11])

data = json.load(sys.stdin)
rows = data.get("data") if isinstance(data, dict) else data
match = next((o for o in rows if str(o.get("orderNumber")) == want), None)
assert match is not None, f"created order {want} not found in list"
assert str(match.get("status")) == want_status, f"fetch status want exact {want_status} got {match.get('status')!r}"
pm = match.get("paymentMethod")
assert str(pm) == want_pm, f"paymentMethod mismatch want {want_pm} got {pm}"
items = match.get("items") or []
assert len(items) == want_items, f"fetch items count want {want_items} got {len(items)}"
it = next(
  (i for i in items if str(i.get("productVariantId") or i.get("variantId") or "") == want_vid),
  None,
)
assert it is not None, "item variant not found on listed order"
assert int(it.get("quantity") or 0) == want_qty, "fetch qty mismatch"
assert int(it.get("unitPrice") or it.get("price") or 0) == want_unit, "fetch unitPrice mismatch"

def field(obj, *names):
  for n in names:
    if obj.get(n) is not None:
      return int(obj.get(n))
  return None

got_sub = field(match, "subtotal")
got_disc = field(match, "discount")
got_ship = field(match, "shippingFee", "shipping")
got_tot = field(match, "total", "totalAmount")
if got_sub is not None:
  assert got_sub == want_subtotal, f"fetch subtotal want {want_subtotal} got {got_sub}"
if got_disc is not None:
  assert got_disc == want_discount, f"fetch discount want {want_discount} got {got_disc}"
if got_ship is not None:
  assert got_ship == want_shipping, f"fetch shipping want {want_shipping} got {got_ship}"
if got_tot is not None:
  assert got_tot == want_total, f"fetch total want {want_total} got {got_tot}"

print("Verified exact order:", want, match.get("status"), len(items), "items",
      f"subtotal={want_subtotal}", f"total={want_total}")
' "$ORDER_NUM" "$EXPECTED_INITIAL_STATUS" "$EXPECTED_PAYMENT_METHOD" "$ORDER_VID" "$ORDER_QTY" \
  "$ORDER_UNIT" "$EXPECTED_ITEMS_COUNT" "$ORDER_SUBTOTAL" "$ORDER_DISCOUNT" "$ORDER_SHIPPING" "$ORDER_TOTAL" \
  || fail "Exact order list assertion failed."

echo "=== 7. Web pages ==="
curl -sf -o /dev/null -w "products HTTP %{http_code}\n" "$WEB_URL/products"
curl -sf -o /dev/null -w "checkout HTTP %{http_code}\n" "$WEB_URL/checkout"

echo "=== E2E PASSED (target=$TARGET order=$ORDER_NUM status=$ORDER_STATUS pm=$ORDER_PM qty=$ORDER_QTY total=$ORDER_TOTAL) ==="
