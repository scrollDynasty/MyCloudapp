#!/bin/bash

echo "🔍 Проверка API service-plans/3..."
echo ""

# Получаем токен (если есть)
TOKEN=$(mysql -u root -p1435511926Ss.. vps_billing -sN -e "SELECT token FROM users LIMIT 1" 2>/dev/null)

# Запрос к API
curl -s "https://apibilling.mycloud.uz/api/service-plans/3" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "ngrok-skip-browser-warning: true" \
  -H "Content-Type: application/json" | jq '{
    success: .success,
    plan_id: .data.id,
    plan_name: .data.name_ru,
    fields_count: (.data.fields | length),
    cpu_field: (.data.fields[] | select(.field_key == "cpu")),
    cpu_model_field: (.data.fields[] | select(.field_key == "cpu_model"))
  }'

echo ""
echo "✅ Проверка завершена"

