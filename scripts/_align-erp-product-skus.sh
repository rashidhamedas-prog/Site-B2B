#!/usr/bin/env bash
set -eu
cd /opt/taranom
USER=$(docker compose exec -T postgres printenv POSTGRES_USER | tr -d '\r')
DB=$(docker compose exec -T postgres printenv POSTGRES_DB | tr -d '\r')
docker compose exec -T postgres psql -U "$USER" -d "$DB" < scripts/_align-erp-product-skus.sql
