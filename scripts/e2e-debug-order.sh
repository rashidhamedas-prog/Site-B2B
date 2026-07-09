#!/bin/bash
API="http://localhost:4000/v1"
LOGIN=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" \
  -d '{"phone":"09159998877","password":"Test@123456"}')
echo "LOGIN: $LOGIN"
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))")
echo "TOKEN len: ${#TOKEN}"

DETAIL=$(curl -sf "$API/products/ccb29e0b-85b7-4e14-98df-5477e8f91d70")
BODY=$(echo "$DETAIL" | python3 -c "
import sys, json
d = json.load(sys.stdin)
v = [x for x in d['variants'] if x['stock'] > 0][0]
print(json.dumps({
  'items': [{
    'productVariantId': v['id'],
    'quantity': 18,
    'unitPrice': int(d['wholesalePrice']),
    'productName': d['name'],
    'sku': d.get('sku', ''),
    'color': v['color'],
    'size': v['size'],
  }],
  'shippingMethod': 'CHAPAR',
  'paymentMethod': 'CREDIT',
}))
")
echo "BODY: $BODY"

curl -s -w "\nHTTP %{http_code}\n" -X POST "$API/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$BODY"
