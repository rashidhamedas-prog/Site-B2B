#!/bin/bash
grep NEXT_PUBLIC /opt/taranom/.env
docker exec taranom_web sh -c 'find /app -name "*.js" -path "*chunks*" 2>/dev/null | head -3 | xargs grep -l "poshaktaranom" 2>/dev/null | head -1 | xargs grep -o "https://poshaktaranom.com[^\"]*" 2>/dev/null | head -5'
docker exec taranom_web sh -c 'find /app -name "*.js" 2>/dev/null | xargs grep -l "localhost:4000" 2>/dev/null | head -3'
