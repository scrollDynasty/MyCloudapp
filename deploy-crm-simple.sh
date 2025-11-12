#!/bin/bash

SERVER="mcuser@38.226.16.15"

echo "🚀 Деплой CRM приложения..."

# 1. Собираем проект
echo "📦 Сборка проекта..."
cd /home/whoami/prj/MyCloudapp/crm-mobile-web
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Ошибка сборки проекта!"
  exit 1
fi

echo "✅ Сборка завершена"

# 2. Создаем архив для передачи
echo "📁 Создание архива..."
cd dist
tar -czf /tmp/crm-dist.tar.gz .
cd ..

# 3. Копируем архив на сервер
echo "📤 Копирование на сервер..."
scp /tmp/crm-dist.tar.gz $SERVER:/tmp/

echo ""
echo "✅ Файлы скопированы на сервер!"
echo ""
echo "📋 Теперь выполните на сервере следующие команды:"
echo ""
echo "ssh $SERVER"
echo "sudo rm -rf /var/www/crm.mycloud.uz/*"
echo "sudo tar -xzf /tmp/crm-dist.tar.gz -C /var/www/crm.mycloud.uz/"
echo "sudo chown -R www-data:www-data /var/www/crm.mycloud.uz"
echo "sudo systemctl reload nginx"
echo "rm /tmp/crm-dist.tar.gz"
echo "exit"
echo ""
echo "🌐 После этого проверьте: https://crm.mycloud.uz"
echo "💡 Очистите кэш браузера (Ctrl+Shift+R)"

