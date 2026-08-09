#!/usr/bin/env bash
# Read-only acceptance smoke for retail/wholesale storefronts + public API.
# Does NOT create orders, payments, users, or mutate production data.
# JSON/slug handled via node argv/stdin only (no shell interpolation into -c).
set -euo pipefail

API="${API_URL:-https://api.poshaktaranom.com/v1}"
WHOLESALE="${WHOLESALE_URL:-https://poshaktaranom.com}"
RETAIL="${RETAIL_URL:-https://poshaktaranom.ir}"
CURL_COMMON=(--max-time 20 --max-redirs 3)

echo "=== API health ==="
curl -sf --max-time 15 "$API/health"
echo

echo "=== Wholesale catalog (limit=1) ==="
PRODUCT_JSON=$(curl -sf --max-time 20 "$API/products?limit=1")
# Pass JSON as argv (not eval); node parses safely
PRODUCT_ID=$(node -e "const d=JSON.parse(process.argv[1]); if(!d.data||!d.data[0]) process.exit(2); console.log(String(d.data[0].id))" "$PRODUCT_JSON")
SLUG=$(node -e "const d=JSON.parse(process.argv[1]); console.log(String(d.data[0].slug||''))" "$PRODUCT_JSON")
# Reject unexpected characters before URL use
node -e "const s=process.argv[1]; if(!/^[A-Za-z0-9._~-]+$/.test(s)) process.exit(4)" "$SLUG"
node -e "const id=process.argv[1]; if(!/^[A-Za-z0-9-]+$/.test(id)) process.exit(5)" "$PRODUCT_ID"
echo "product_id=$PRODUCT_ID slug=$SLUG"

echo "=== Product detail ==="
DETAIL=$(curl -sf --max-time 20 "$API/products/$PRODUCT_ID")
node -e "const d=JSON.parse(process.argv[1]); if(!(d.id||d.slug)) process.exit(3); console.log('detail_ok', String(d.name||'').slice(0,80))" "$DETAIL"

echo "=== Slug endpoint ==="
ENCODED_SLUG=$(node -e "console.log(encodeURIComponent(process.argv[1]))" "$SLUG")
curl -sf "${CURL_COMMON[@]}" -o /dev/null -w "slug HTTP %{http_code}\n" "$API/products/slug/$ENCODED_SLUG"

echo "=== Storefront HTTP ==="
# Bound redirects (SEC-004); allowlist checked by fixed env defaults
curl -sf "${CURL_COMMON[@]}" -o /dev/null -w "wholesale_home %{http_code}\n" -L "$WHOLESALE/"
curl -sf "${CURL_COMMON[@]}" -o /dev/null -w "retail_home %{http_code}\n" -L "$RETAIL/"
curl -sf "${CURL_COMMON[@]}" -o /dev/null -w "wholesale_products %{http_code}\n" -L "$WHOLESALE/products"
code=$(curl -s -o /dev/null -w "%{http_code}" "${CURL_COMMON[@]}" -L "$RETAIL/retail/products" || true)
if [ "$code" = "200" ] || [ "$code" = "301" ] || [ "$code" = "308" ]; then
  echo "retail_products $code"
else
  curl -sf "${CURL_COMMON[@]}" -o /dev/null -w "retail_products_alt %{http_code}\n" -L "$RETAIL/products"
fi

echo "=== ACCEPTANCE_SMOKE_READONLY PASS ==="
