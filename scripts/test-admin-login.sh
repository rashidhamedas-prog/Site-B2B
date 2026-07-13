#!/bin/bash
curl -s -X POST http://localhost:4000/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"09152424624","password":"Admin@1234"}'
echo
docker exec taranom_postgres psql -U taranom -d taranom_db -c "SELECT phone, role, \"isActive\" FROM users;"
curl -sk -X POST https://poshaktaranom.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"09152424624","password":"Admin@1234"}'
echo
