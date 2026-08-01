#!/usr/bin/env bash
set -euo pipefail

cd /opt/taranom
backup=/opt/taranom/backups/20260801-hardening/.env.pre-rotation
test -s "$backup"

old_db_pass="$(sed -n 's/^DB_PASS=//p' "$backup")"
new_db_pass="$(openssl rand -hex 32)"
new_redis_pass="$(openssl rand -hex 32)"
new_minio_pass="$(openssl rand -hex 32)"
new_meili_key="$(openssl rand -hex 32)"
new_jwt_secret="$(openssl rand -hex 48)"

set_env() {
  local key="$1"
  local value="$2"
  sed -i "s|^${key}=.*|${key}=${value}|" .env
}

rollback() {
  local exit_code=$?
  trap - ERR
  cp "$backup" .env
  chmod 600 .env
  printf "ALTER ROLE taranom WITH PASSWORD '%s';\n" "$old_db_pass" \
    | docker exec -i taranom_postgres psql -v ON_ERROR_STOP=1 -U taranom -d taranom_db >/dev/null 2>&1 || true
  docker compose up -d --force-recreate postgres redis minio meilisearch api web >/dev/null 2>&1 || true
  docker compose restart nginx >/dev/null 2>&1 || true
  echo "ROTATION_ROLLED_BACK"
  exit "$exit_code"
}
trap rollback ERR

printf "ALTER ROLE taranom WITH PASSWORD '%s';\n" "$new_db_pass" \
  | docker exec -i taranom_postgres psql -v ON_ERROR_STOP=1 -U taranom -d taranom_db >/dev/null

set_env DB_PASS "$new_db_pass"
set_env REDIS_PASS "$new_redis_pass"
set_env MINIO_PASS "$new_minio_pass"
set_env MEILI_MASTER_KEY "$new_meili_key"
set_env JWT_SECRET "$new_jwt_secret"
chmod 600 .env

docker compose up -d --force-recreate postgres redis minio meilisearch
docker compose up -d --force-recreate api web
docker compose restart nginx

for _ in $(seq 1 24); do
  if curl -fsS http://127.0.0.1:4000/v1/health >/dev/null; then
    break
  fi
  sleep 5
done

curl -fsS http://127.0.0.1:4000/v1/health >/dev/null
curl -fsS http://127.0.0.1:3000 >/dev/null
curl -kfsS https://poshaktaranom.com >/dev/null
curl -kfsS https://www.poshaktaranom.ir >/dev/null

trap - ERR
unset old_db_pass new_db_pass new_redis_pass new_minio_pass new_meili_key new_jwt_secret
echo "INTERNAL_ROTATION_OK"
