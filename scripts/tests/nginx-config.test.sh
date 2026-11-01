#!/bin/bash
# CI: nginx/nginx.conf with the same directory mount as docker-compose.yml.
#   1. `nginx -t` on nginx:stable and on the production image (nginx:alpine).
#   2. Throwaway container + scripts/nginx-http-healthcheck.sh (redirects, ACME,
#      444, HSTS). Upstreams (web/api/minio) do not exist here: HSTS is
#      `always`, so the 502 responses still carry it.
# Certs are temporary self-signed ECDSA pairs; no real key enters the repo.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROD_IMAGE="${NGINX_PROD_IMAGE:-nginx:alpine}"
NET="taranom-nginx-ci-$$"
NAME="taranom-nginx-ci-$$"
TMP="$(mktemp -d)"

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

grep -q "\./nginx:/etc/nginx/taranom:ro" "$ROOT/docker-compose.yml" \
  || { echo "docker-compose.yml must mount ./nginx as a directory at /etc/nginx/taranom" >&2; exit 1; }

for domain in poshaktaranom.com poshaktaranom.ir; do
  mkdir -p "$TMP/ssl/$domain"
  openssl req -x509 -nodes -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -days 1 \
    -subj "/CN=$domain" \
    -keyout "$TMP/ssl/$domain/privkey.pem" -out "$TMP/ssl/$domain/fullchain.pem" 2>/dev/null
done
chmod -R a+rX "$TMP/ssl"
mkdir -p "$TMP/conf.d" "$TMP/certbot"

# User-defined network → Docker DNS at 127.0.0.11 (nginx `resolver`) answers fast.
docker network create "$NET" >/dev/null

mounts=(
  -v "$ROOT/nginx:/etc/nginx/taranom:ro"
  -v "$TMP/ssl:/etc/nginx/ssl:ro"
  -v "$TMP/conf.d:/etc/nginx/conf.d:ro"
  -v "$TMP/certbot:/var/www/certbot:ro"
)

for image in nginx:stable "$PROD_IMAGE"; do
  echo "== nginx -t ($image)"
  docker run --rm --network "$NET" "${mounts[@]}" "$image" \
    nginx -c /etc/nginx/taranom/nginx.conf -t
done

echo "== container contract ($PROD_IMAGE)"
docker run -d --name "$NAME" --network "$NET" "${mounts[@]}" \
  -p 127.0.0.1:18080:80 -p 127.0.0.1:18443:443 \
  "$PROD_IMAGE" nginx -c /etc/nginx/taranom/nginx.conf -g 'daemon off;' >/dev/null

for _ in $(seq 1 30); do
  if curl -s -o /dev/null -H 'Host: poshaktaranom.com' http://127.0.0.1:18080/; then break; fi
  sleep 1
done

NGINX_CHECK_IP=127.0.0.1 NGINX_CHECK_HTTP_PORT=18080 NGINX_CHECK_HTTPS_PORT=18443 \
  bash "$ROOT/scripts/nginx-http-healthcheck.sh"

hsts_all="$(docker exec "$NAME" nginx -c /etc/nginx/taranom/nginx.conf -T 2>/dev/null | grep -i 'strict-transport-security' || true)"
if echo "$hsts_all" | grep -qiE 'preload|includeSubDomains'; then
  echo "HSTS must not use preload or includeSubDomains" >&2
  exit 1
fi

echo "nginx config tests OK"
