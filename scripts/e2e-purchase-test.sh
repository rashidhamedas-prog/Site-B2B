#!/bin/bash
set -e
API="${API_URL:-http://localhost:4000/v1}"

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
  echo "FAIL: No variant with stock"
  exit 1
fi

echo "=== 3. Slug endpoint ==="
ENCODED_SLUG=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$SLUG'))")
curl -sf -o /dev/null -w "slug HTTP %{http_code}\n" "$API/products/slug/$ENCODED_SLUG"

echo "=== 4. Customer login ==="
CUSTOMER_PHONE=$(docker exec taranom_postgres psql -U taranom -d taranom_db -tAc "SELECT phone FROM users WHERE role='CUSTOMER' AND \"isActive\"=true LIMIT 1;" 2>/dev/null | tr -d '[:space:]')

if [ -z "$CUSTOMER_PHONE" ]; then
  TEST_PHONE="09159998877"
  echo "Creating test customer $TEST_PHONE"
  curl -sf -X POST "$API/auth/register" -H "Content-Type: application/json" \
    -d "{\"phone\":\"$TEST_PHONE\",\"password\":\"Test@123456\",\"businessName\":\"E2E Test\",\"ownerName\":\"Tester\",\"province\":\"Tehran\",\"city\":\"Tehran\"}" || true
  docker exec taranom_postgres psql -U taranom -d taranom_db -c "UPDATE users SET \"isActive\"=true WHERE phone='$TEST_PHONE';" >/dev/null
  docker exec taranom_postgres psql -U taranom -d taranom_db -c "UPDATE customers SET status='ACTIVE' WHERE phone='$TEST_PHONE';" >/dev/null
  CUSTOMER_PHONE="$TEST_PHONE"
fi

LOGIN_RESP=""
for PASS in "Test@123456" "123456"; do
  LOGIN_RESP=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" \
    -d "{\"phone\":\"$CUSTOMER_PHONE\",\"password\":\"$PASS\"}")
  if echo "$LOGIN_RESP" | grep -q accessToken; then
    echo "Logged in as $CUSTOMER_PHONE"
    break
  fi
done

if ! echo "$LOGIN_RESP" | grep -q accessToken; then
  echo "Resetting password for $CUSTOMER_PHONE"
  HASH=$(docker exec taranom_api node -e "const b=require('bcryptjs'); b.hash('Test@123456',12).then(h=>process.stdout.write(h))")
  docker exec taranom_postgres psql -U taranom -d taranom_db -c "UPDATE users SET \"passwordHash\"='$HASH', \"isActive\"=true WHERE phone='$CUSTOMER_PHONE';" >/dev/null
  LOGIN_RESP=$(curl -sf -X POST "$API/auth/login" -H "Content-Type: application/json" \
    -d "{\"phone\":\"$CUSTOMER_PHONE\",\"password\":\"Test@123456\"}")
fi

TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

echo "=== 5. Create order ==="
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
  'paymentMethod': 'CREDIT',
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
curl -sf -o /dev/null -w "products HTTP %{http_code}\n" http://localhost:3000/products
curl -sf -o /dev/null -w "checkout HTTP %{http_code}\n" http://localhost:3000/checkout

echo "=== E2E PASSED ==="
