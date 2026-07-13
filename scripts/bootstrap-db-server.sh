#!/bin/bash
set -e
cd /opt/taranom
# Bootstrap schema on fresh DB
if ! grep -q 'DB_SYNC=true' .env; then
  echo 'DB_SYNC=true' >> .env
fi
sed -i "s/synchronize: config.get('NODE_ENV') !== 'production',/synchronize: true,/" apps/api/src/config/database.config.ts
docker compose build api
docker compose up -d api
sleep 18
docker compose exec -T api node dist/seed.js
# Lock down after bootstrap
sed -i "s/synchronize: true,/synchronize: config.get('NODE_ENV') !== 'production',/" apps/api/src/config/database.config.ts
sed -i '/^DB_SYNC=true/d' .env
docker compose build api
docker compose up -d api
sleep 10
curl -sf http://localhost:4000/v1/health && echo
curl -sk -o /dev/null -w "https:%{http_code}\n" https://poshaktaranom.com
