#!/bin/bash
API="http://localhost:4000/v1"
LOGIN=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" \
  -d '{"phone":"09159998877","password":"Test@123456"}')
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")
CID=$(docker exec taranom_postgres psql -U taranom -d taranom_db -tAc "SELECT \"customerId\" FROM users WHERE phone='09159998877';" | tr -d '[:space:]')
echo "customerId=$CID"

BODY='{"customerId":"'"$CID"'","items":[{"productVariantId":"9d92071b-df1e-4188-927c-8591f72ec8af","quantity":18,"unitPrice":9900000,"productName":"test","sku":"MANTO-LINEN-516","color":"blue","size":"36"}],"shippingMethod":"CHAPAR","paymentMethod":"CREDIT"}'

curl -s -w "\nHTTP %{http_code}\n" -X POST "$API/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$BODY"
