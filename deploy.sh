#!/bin/bash
# ============================================================
# Taranom B2B Platform — Production Deploy Script
# Run on your Linux server as root or sudo user
# Usage: bash deploy.sh
# ============================================================

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ---- Config ----
REPO_DIR="/opt/taranom"
DOMAIN_B2B="poshaktaranom.com"
DOMAIN_B2C="poshaktaranom.ir"
DOMAIN_API="api.poshaktaranom.com"
EMAIL="rashidhamedas@gmail.com"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║      پلتفرم ترنم — استقرار تولید        ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ---- Step 1: Prerequisites ----
info "بررسی پیش‌نیازها..."
command -v docker   >/dev/null 2>&1 || error "Docker نصب نیست. ابتدا Docker نصب کنید."
command -v git      >/dev/null 2>&1 || error "Git نصب نیست."

# ---- Step 2: Clone or pull ----
if [ -d "$REPO_DIR/.git" ]; then
  info "بروزرسانی کد از مخزن..."
  cd "$REPO_DIR"
  git pull origin master || git pull origin main
else
  warn "پوشه $REPO_DIR وجود ندارد — لطفاً کد را آپلود کنید:"
  warn "  scp -r ./\"Site BtoB\" user@server:$REPO_DIR"
  warn "  یا git clone your-repo $REPO_DIR"
  error "کد پروژه در $REPO_DIR پیدا نشد."
fi

cd "$REPO_DIR"

# ---- Step 3: .env check ----
if [ ! -f ".env" ]; then
  warn "فایل .env پیدا نشد!"
  warn "یک نمونه از .env.example بساز و مقادیر را وارد کن:"
  warn "  cp .env.example .env && nano .env"
  error "فایل .env ضروری است."
fi

info "بررسی متغیرهای محیطی..."
source .env
[ -z "$DB_PASS"    ] && error "DB_PASS در .env خالی است"
[ -z "$REDIS_PASS" ] && error "REDIS_PASS در .env خالی است"
[ -z "$JWT_SECRET" ] && error "JWT_SECRET در .env خالی است"

# ---- Step 4: SSL certificates ----
info "بررسی گواهی SSL..."

get_cert() {
  local domain=$1
  local dir="./nginx/ssl/$domain"
  if [ ! -f "$dir/fullchain.pem" ]; then
    warn "گواهی SSL برای $domain پیدا نشد — دریافت از Let's Encrypt..."
    mkdir -p certbot_www
    docker run --rm \
      -v "$(pwd)/certbot_www:/var/www/certbot" \
      -v "$(pwd)/nginx/ssl:/etc/letsencrypt" \
      -p 80:80 \
      certbot/certbot certonly \
        --webroot -w /var/www/certbot \
        --email "$EMAIL" \
        --agree-tos --no-eff-email \
        -d "$domain" -d "www.$domain" 2>&1 | tail -5
    mkdir -p "$dir"
    cp "/etc/letsencrypt/live/$domain/fullchain.pem" "$dir/"
    cp "/etc/letsencrypt/live/$domain/privkey.pem"   "$dir/"
    info "گواهی SSL برای $domain دریافت شد."
  else
    info "گواهی SSL برای $domain موجود است."
  fi
}

get_cert "$DOMAIN_B2B"
get_cert "$DOMAIN_B2C"

# ---- Step 5: Build & start ----
info "ساختن و راه‌اندازی سرویس‌ها..."
docker compose pull nginx redis postgres 2>/dev/null || true
docker compose build --no-cache api web
docker compose up -d

# ---- Step 6: Health check ----
info "صبر کن تا سرویس‌ها آماده شوند..."
sleep 15

check_http() {
  local url=$1
  local code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  if [ "$code" = "200" ] || [ "$code" = "301" ] || [ "$code" = "302" ]; then
    info "$url → HTTP $code ✓"
  else
    warn "$url → HTTP $code (ممکن است هنوز در حال راه‌اندازی باشد)"
  fi
}

check_http "http://localhost:4000/v1/health"
check_http "http://localhost:3000"

# ---- Step 7: Create admin if not exists ----
info "بررسی وجود کاربر ادمین..."
docker compose exec -T postgres psql -U "${DB_USER:-taranom}" -d "${DB_NAME:-taranom_db}" \
  -c "SELECT phone FROM users WHERE role='ADMIN' LIMIT 1;" 2>/dev/null | grep -q "09" && \
  info "ادمین موجود است." || \
  warn "ادمین پیدا نشد — با API ادمین بساز یا به مستندات مراجعه کن."

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║          استقرار با موفقیت انجام شد     ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  سایت عمده:   https://$DOMAIN_B2B"
echo "  سایت تک:     https://$DOMAIN_B2C"
echo "  API:          https://$DOMAIN_API/v1"
echo "  Swagger:      https://$DOMAIN_API/api/docs"
echo ""
echo "  مشاهده لاگ‌ها:"
echo "  docker compose logs -f api"
echo "  docker compose logs -f web"
echo ""
