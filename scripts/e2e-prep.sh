#!/bin/bash
# Ensure test customer has stock for E2E order
set -e
docker exec taranom_postgres psql -U taranom -d taranom_db -c "
UPDATE users u SET \"customerId\" = c.id
FROM customers c WHERE u.phone = c.phone AND u.phone = '09159998877';

UPDATE product_variants SET stock = 100
WHERE id = '9d92071b-df1e-4188-927c-8591f72ec8af';

SELECT u.phone, u.\"customerId\" IS NOT NULL AS has_customer, pv.stock
FROM users u
JOIN product_variants pv ON pv.id = '9d92071b-df1e-4188-927c-8591f72ec8af'
WHERE u.phone = '09159998877';
"
