#!/bin/bash
# جلوگیری از دستورات خطرناک در ترمینال
if echo "$1" | grep -qE "rm -rf /|drop database|force push"; then
  echo "⛔ Dangerous command blocked!"
  exit 1
fi
exit 0