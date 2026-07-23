#!/usr/bin/env bash
# Enable SSL + nginx for poshaktaranom.ir / www.poshaktaranom.ir
# Run on server: bash /opt/taranom/scripts/enable-ir-ssl.sh
set -euo pipefail

DOMAIN_IR=poshaktaranom.ir
WWW_IR=www.poshaktaranom.ir
EXPECTED_IP=5.75.200.102
SSL_DIR=/opt/taranom/nginx/ssl/${DOMAIN_IR}
# Must match the docker volume mounted into nginx as /var/www/certbot
WEBROOT=/var/lib/docker/volumes/taranom_certbot_www/_data

echo "==> Checking public DNS for ${DOMAIN_IR} ..."
RESOLVED=$(dig +short ${DOMAIN_IR} A @1.1.1.1 | head -1 || true)
echo "    resolved: ${RESOLVED:-"(empty)"}"
# Cloudflare orange proxy returns CF anycast IPs — also accept if origin answers RETAIL.
if [[ "${RESOLVED}" != "${EXPECTED_IP}" ]]; then
  echo "WARN: dig → ${RESOLVED:-empty} (expected ${EXPECTED_IP} or Cloudflare proxy)."
  echo "Continuing if HTTP origin is reachable..."
fi

echo "==> Issuing Let's Encrypt cert ..."
sudo mkdir -p "${WEBROOT}"
sudo certbot certonly --webroot -w "${WEBROOT}" \
  -d "${DOMAIN_IR}" -d "${WWW_IR}" \
  --agree-tos --non-interactive \
  -m rashidhamedas@gmail.com \
  --keep-until-expiring

echo "==> Linking certs into nginx/ssl ..."
sudo mkdir -p "${SSL_DIR}"
sudo cp -L "/etc/letsencrypt/live/${DOMAIN_IR}/fullchain.pem" "${SSL_DIR}/fullchain.pem"
sudo cp -L "/etc/letsencrypt/live/${DOMAIN_IR}/privkey.pem" "${SSL_DIR}/privkey.pem"
sudo chown -R wholesale-admin:wholesale-admin "${SSL_DIR}"
sudo chmod 640 "${SSL_DIR}/privkey.pem"

echo "==> Reloading nginx container ..."
cd /opt/taranom
docker compose up -d nginx
docker compose exec -T nginx nginx -t
docker compose exec -T nginx nginx -s reload || docker compose restart nginx

echo "==> Done. Test: https://${WWW_IR}/"
