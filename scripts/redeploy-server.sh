#!/bin/bash
# Redeploy Taranom on server. Requires .env at /opt/taranom/.env (see TARANOM-SERVER-INFO.txt)
set -euo pipefail

REPO_URL="https://github.com/rashidhamedas-prog/Site-BtoB.git"
APP_DIR="/opt/taranom"
ENV_BACKUP="/opt/taranom/.env"

echo "=== 1. Prepare directory ==="
sudo mkdir -p "$APP_DIR"
sudo chown -R "$(whoami):$(whoami)" "$APP_DIR"

if [ -f "$ENV_BACKUP" ]; then
  cp "$ENV_BACKUP" /tmp/taranom.env.bak
fi

if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git fetch origin
  git reset --hard origin/master
else
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

if [ -f /tmp/taranom.env.bak ]; then
  cp /tmp/taranom.env.bak .env
elif [ ! -f .env ]; then
  echo "ERROR: .env missing. Create from .env.example + TARANOM-SERVER-INFO.txt"
  exit 1
fi
chmod 600 .env

echo "=== 2. SSL certificates ==="
mkdir -p nginx/ssl/poshaktaranom.com
sudo cp /etc/letsencrypt/live/poshaktaranom.com/fullchain.pem nginx/ssl/poshaktaranom.com/
sudo cp /etc/letsencrypt/live/poshaktaranom.com/privkey.pem nginx/ssl/poshaktaranom.com/
sudo chown -R "$(whoami):$(whoami)" nginx/ssl

echo "=== 3. Build & start ==="
docker compose build api web
docker compose up -d

echo "=== 4. Health checks ==="
sleep 20
curl -sf http://localhost:4000/v1/health && echo
curl -sf -o /dev/null -w "web HTTP %{http_code}\n" http://localhost:3000
docker compose ps
echo "=== REDEPLOY DONE ==="
