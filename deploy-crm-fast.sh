SERVER="mcuser@38.226.16.15"
REMOTE_WEB="/var/www/crm.mycloud.uz"

echo "🚀 Быстрый деплой CRM приложения..."

echo "📁 Копируем файлы из ~/crm-mobile-web/dist в production..."
ssh -t $SERVER "sudo rm -rf $REMOTE_WEB/* && \
                sudo cp -r ~/crm-mobile-web/dist/* $REMOTE_WEB/ && \
                sudo chown -R www-data:www-data $REMOTE_WEB"

echo "✅ Деплой завершен!"
echo "🌐 Проверьте: https://crm.mycloud.uz"

