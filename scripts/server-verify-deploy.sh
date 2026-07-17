#!/bin/bash
set -euo pipefail

echo "=== CHECKOUT JS ==="
CHK=$(docker exec taranom_web sh -c 'ls /app/apps/web/.next/static/chunks/app/checkout/page-*.js 2>/dev/null | head -1')
echo "file: $CHK"
docker exec taranom_web sh -c "grep -c INSTALLMENT $CHK 2>/dev/null || echo 0 INSTALLMENT"
docker exec taranom_web sh -c "grep -c CREDIT $CHK 2>/dev/null || echo 0 CREDIT"
docker exec taranom_web sh -c "grep -c 'productVariantId' $CHK 2>/dev/null || echo 0 productVariantId"
docker exec taranom_web sh -c "grep -c productId $CHK 2>/dev/null || echo 0 productId"

echo "=== ADMIN LAYOUT JS ==="
LAY=$(docker exec taranom_web sh -c 'ls /app/apps/web/.next/static/chunks/app/admin/layout-*.js 2>/dev/null | head -1')
echo "file: $LAY"
docker exec taranom_web sh -c "grep -c 'lg:mr-64' $LAY 2>/dev/null || echo 0 lg:mr-64"
docker exec taranom_web sh -c "grep -c 'lg:relative' $LAY 2>/dev/null || echo 0 lg:relative"

echo "=== ADMIN SIDEBAR (categories link) ==="
SB=$(docker exec taranom_web sh -c 'grep -rl AdminSidebar /app/apps/web/.next/static/chunks 2>/dev/null | head -1')
echo "file: $SB"
docker exec taranom_web sh -c "grep -c categories $SB 2>/dev/null || echo 0 categories"

echo "=== PRODUCT FORM categoryId ==="
PF=$(docker exec taranom_web sh -c 'grep -rl categoryId /app/apps/web/.next/static/chunks 2>/dev/null | head -3')
echo "$PF"

echo "=== NGINX restart web to clear any proxy cache ==="
cd /opt/taranom
docker compose restart web nginx
