#!/bin/bash
API="http://localhost:4000/v1"
LOGIN=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" \
  -d '{"phone":"09159998877","password":"Test@123456"}')
echo "LOGIN: $LOGIN"
SUB=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'].split('.')[1])" | python3 -c "
import sys,base64,json
p=sys.stdin.read().strip()
p+='='*((4-len(p)%4)%4)
print(json.loads(base64.urlsafe_b64decode(p))['sub'])
")
echo "JWT sub: $SUB"
docker exec taranom_postgres psql -U taranom -d taranom_db -c "
SELECT id, phone, role, \"customerId\" FROM users WHERE phone='09159998877';
SELECT id, phone, \"businessName\" FROM customers WHERE phone='09159998877';
"
