#!/bin/bash
# Fix test user customerId linkage
docker exec taranom_postgres psql -U taranom -d taranom_db -c "
UPDATE users u
SET \"customerId\" = c.id
FROM customers c
WHERE u.phone = c.phone
  AND u.phone = '09159998877'
  AND u.\"customerId\" IS NULL;
SELECT u.phone, u.\"customerId\", c.\"businessName\"
FROM users u
LEFT JOIN customers c ON c.id = u.\"customerId\"
WHERE u.phone = '09159998877';
"
