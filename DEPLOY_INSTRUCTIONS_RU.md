# 🚀 Инструкции по деплою MyCloud VPS Billing System

## 📋 Содержание

1. [Требования к серверу](#требования-к-серверу)
2. [Подготовка сервера](#подготовка-сервера)
3. [Установка Backend](#установка-backend)
4. [Настройка Nginx](#настройка-nginx)
5. [Настройка SSL](#настройка-ssl)
6. [Настройка PM2](#настройка-pm2)
7. [Деплой Frontend](#деплой-frontend)
8. [Проверка работоспособности](#проверка-работоспособности)
9. [Обслуживание](#обслуживание)

---

## 🖥️ Требования к серверу

### Минимальные требования
- **ОС:** Ubuntu 20.04 LTS или новее
- **CPU:** 2 ядра
- **RAM:** 2GB
- **Диск:** 20GB SSD
- **Сеть:** Статический IP адрес

### Рекомендуемые требования
- **ОС:** Ubuntu 22.04 LTS
- **CPU:** 4 ядра
- **RAM:** 4GB
- **Диск:** 40GB SSD
- **Сеть:** Статический IP + CDN

### Необходимое ПО
- Node.js 18.x или 20.x
- MariaDB 10.6+ или MySQL 8.0+
- Nginx 1.18+
- PM2 (process manager)
- Certbot (для SSL)

---

## 🔧 Подготовка сервера

### 1. Обновление системы

```bash
sudo apt update
sudo apt upgrade -y
sudo reboot
```

### 2. Установка Node.js

```bash
# Установка Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Проверка установки
node --version  # должно быть v20.x.x
npm --version   # должно быть 10.x.x
```

### 3. Установка MariaDB

```bash
# Установка MariaDB
sudo apt install -y mariadb-server

# Безопасная настройка
sudo mysql_secure_installation
# Ответьте:
# - Set root password? Yes (задайте надежный пароль)
# - Remove anonymous users? Yes
# - Disallow root login remotely? Yes
# - Remove test database? Yes
# - Reload privilege tables? Yes

# Запуск MariaDB
sudo systemctl start mariadb
sudo systemctl enable mariadb
```

### 4. Создание базы данных

```bash
# Войдите в MySQL
sudo mysql -u root -p

# Выполните следующие команды:
```

```sql
-- Создание базы данных
CREATE DATABASE vps_billing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Создание пользователя
CREATE USER 'vps_user'@'localhost' IDENTIFIED BY 'ваш_надежный_пароль';

-- Выдача прав
GRANT ALL PRIVILEGES ON vps_billing.* TO 'vps_user'@'localhost';
FLUSH PRIVILEGES;

-- Выход
EXIT;
```

### 5. Установка Nginx

```bash
sudo apt install -y nginx

# Запуск и автозагрузка
sudo systemctl start nginx
sudo systemctl enable nginx

# Проверка статуса
sudo systemctl status nginx
```

### 6. Настройка Firewall

```bash
# Установка UFW (если не установлен)
sudo apt install -y ufw

# Разрешить SSH
sudo ufw allow OpenSSH

# Разрешить HTTP и HTTPS
sudo ufw allow 'Nginx Full'

# Включить firewall
sudo ufw enable

# Проверить статус
sudo ufw status
```

---

## 📦 Установка Backend

### 1. Создание пользователя для приложения

```bash
# Создать пользователя
sudo adduser mcuser --disabled-password --gecos ""

# Переключиться на пользователя
sudo su - mcuser
```

### 2. Клонирование проекта

```bash
# Создать директорию
mkdir -p ~/backend
cd ~/backend

# Скопируйте файлы проекта на сервер
# Используйте scp, git или rsync

# Пример с git:
# git clone https://github.com/ваш-репо/mycloud-backend.git .

# Или через scp с вашей машины:
# scp -r backend/* mcuser@your-server-ip:~/backend/
```

### 3. Установка зависимостей

```bash
cd ~/backend
npm install --production
```

### 4. Настройка .env файла

```bash
nano ~/backend/.env
```

Вставьте следующее содержимое и настройте:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=vps_user
DB_PASS=ваш_пароль_из_mysql
DB_NAME=vps_billing

# Server Configuration
PORT=5000
NODE_ENV=production

# PayMe Integration
PAYME_MERCHANT_ID=ваш_merchant_id
PAYME_SECRET_KEY="ваш_secret_key"
PAYME_URL=https://checkout.paycom.uz
PAYME_API_URL=https://checkout.paycom.uz/api
PAYME_USE_RETURN_URL=false

# Google OAuth Configuration
GOOGLE_CLIENT_ID=ваш_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=ваш_client_secret
GOOGLE_REDIRECT_URI=https://apibilling.mycloud.uz/api/auth/google/callback

# JWT Configuration
JWT_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=7d

# Frontend & CORS Settings
FRONTEND_URL=https://billing.mycloud.uz
CORS_ORIGIN=https://billing.mycloud.uz,http://localhost:8081

# Production Domains
API_DOMAIN=https://apibilling.mycloud.uz
PAYME_CALLBACK_URL=https://apibilling.mycloud.uz/api/payments/payme/callback
RETURN_URL=https://billing.mycloud.uz/payment-success

# Deep Linking
APP_SCHEME=mycloud
```

Сохраните (Ctrl+O, Enter, Ctrl+X)

### 5. Тестирование запуска

```bash
cd ~/backend
node app.js

# Должно появиться:
# ✅ Database connected successfully
# ✅ VPS Billing API Server running on port 5000
```

Если все работает, нажмите Ctrl+C для остановки.

---

## 🌐 Настройка Nginx

### 1. Создание конфигурации Nginx

```bash
# Выйдите из пользователя mcuser
exit

# Создайте конфигурацию Nginx
sudo nano /etc/nginx/sites-available/apibilling.mycloud.uz
```

Вставьте следующее содержимое:

```nginx
server {
    listen 80;
    server_name apibilling.mycloud.uz;
    
    # Логи
    access_log /var/log/nginx/apibilling-access.log;
    error_log /var/log/nginx/apibilling-error.log;
    
    # Лимиты
    client_max_body_size 2M;
    
    # Прокси для API
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Таймауты
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Статические файлы (если есть)
    location /static/ {
        alias /home/mcuser/backend/public/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

Сохраните файл.

### 2. Активация конфигурации

```bash
# Создайте символическую ссылку
sudo ln -s /etc/nginx/sites-available/apibilling.mycloud.uz /etc/nginx/sites-enabled/

# Проверьте конфигурацию
sudo nginx -t

# Перезагрузите Nginx
sudo systemctl reload nginx
```

### 3. Настройка DNS

Добавьте A-запись в вашем DNS провайдере:

```
Тип: A
Имя: apibilling
Значение: IP_вашего_сервера
TTL: 3600
```

Подождите несколько минут для распространения DNS.

---

## 🔒 Настройка SSL

### 1. Установка Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Получение SSL сертификата

```bash
# Получить сертификат для apibilling.mycloud.uz
sudo certbot --nginx -d apibilling.mycloud.uz

# Следуйте инструкциям:
# - Введите email для уведомлений
# - Согласитесь с условиями
# - Выберите опцию редиректа HTTP -> HTTPS (рекомендуется: 2)
```

### 3. Автообновление сертификата

```bash
# Проверить автообновление
sudo certbot renew --dry-run

# Добавить в cron (если нужно)
sudo crontab -e
# Добавьте строку:
0 0 * * * certbot renew --quiet
```

---

## ⚙️ Настройка PM2

### 1. Установка PM2

```bash
sudo npm install -g pm2
```

### 2. Запуск приложения

```bash
# Переключитесь на пользователя mcuser
sudo su - mcuser
cd ~/backend

# Запуск с PM2
pm2 start app.js --name "vps-billing-api" --time

# Проверка статуса
pm2 status

# Просмотр логов
pm2 logs vps-billing-api

# Сохранить конфигурацию
pm2 save
```

### 3. Настройка автозапуска

```bash
# Сгенерировать скрипт автозапуска
pm2 startup

# Скопируйте команду из вывода и выполните её с sudo
# Пример:
# sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u mcuser --hp /home/mcuser

# Сохраните список процессов
pm2 save
```

### 4. Проверка автозапуска

```bash
# Перезагрузите сервер
sudo reboot

# После перезагрузки проверьте
sudo su - mcuser
pm2 list
# Приложение должно быть запущено
```

---

## 📱 Деплой Frontend

### Вариант 1: Expo EAS Build (Рекомендуется)

```bash
# На вашей локальной машине
cd /workspace
npm install -g eas-cli

# Авторизация
eas login

# Конфигурация
eas build:configure

# Build для Android
eas build --platform android --profile production

# Build для iOS (требуется аккаунт Apple Developer)
eas build --platform ios --profile production

# Ссылки на скачивание появятся после успешной сборки
```

### Вариант 2: Web версия

```bash
# На вашей локальной машине
cd /workspace

# Установите зависимости
npm install

# Build для Web
npx expo export --platform web

# Файлы будут в dist/
# Скопируйте их на сервер

scp -r dist/* mcuser@your-server-ip:/home/mcuser/frontend/
```

#### Настройка Nginx для Frontend

```bash
# На сервере
sudo nano /etc/nginx/sites-available/billing.mycloud.uz
```

```nginx
server {
    listen 80;
    server_name billing.mycloud.uz;
    
    root /home/mcuser/frontend;
    index index.html;
    
    # Логи
    access_log /var/log/nginx/billing-access.log;
    error_log /var/log/nginx/billing-error.log;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Кеширование статики
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Активировать конфигурацию
sudo ln -s /etc/nginx/sites-available/billing.mycloud.uz /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Получить SSL
sudo certbot --nginx -d billing.mycloud.uz
```

---

## ✅ Проверка работоспособности

### 1. Проверка Backend API

```bash
# Здоровье системы
curl https://apibilling.mycloud.uz/health

# Должно вернуть JSON с status: "ok"

# Метрики
curl https://apibilling.mycloud.uz/metrics
```

### 2. Проверка базы данных

```bash
sudo su - mcuser
cd ~/backend

# Подключиться к БД
mysql -u vps_user -p vps_billing

# Проверить таблицы
SHOW TABLES;
```

### 3. Проверка логов

```bash
# PM2 логи
pm2 logs vps-billing-api

# Nginx логи
sudo tail -f /var/log/nginx/apibilling-access.log
sudo tail -f /var/log/nginx/apibilling-error.log

# Логи приложения
tail -f ~/backend/logs/error.log
```

### 4. Тестирование Google OAuth

1. Откройте в браузере: `https://apibilling.mycloud.uz/api/auth/google`
2. Авторизуйтесь через Google
3. Должно перенаправить на `auth-callback.html` с токеном

---

## 🔧 Обслуживание

### Обновление приложения

```bash
# Переключиться на пользователя
sudo su - mcuser
cd ~/backend

# Получить новый код (git pull или scp)
git pull origin main
# или
# scp -r backend/* mcuser@server:~/backend/

# Установить зависимости
npm install --production

# Перезапустить PM2
pm2 restart vps-billing-api

# Проверить логи
pm2 logs vps-billing-api --lines 50
```

### Резервное копирование базы данных

```bash
# Создать backup
mysqldump -u vps_user -p vps_billing > backup_$(date +%Y%m%d_%H%M%S).sql

# Восстановить из backup
mysql -u vps_user -p vps_billing < backup_20250112_120000.sql

# Автоматизация backup (добавить в cron)
sudo crontab -e
# Добавить:
0 2 * * * mysqldump -u vps_user -p'пароль' vps_billing > /home/mcuser/backups/db_$(date +\%Y\%m\%d).sql
```

### Мониторинг ресурсов

```bash
# CPU и память
htop

# PM2 мониторинг
pm2 monit

# Использование диска
df -h

# Статистика Nginx
sudo tail -f /var/log/nginx/apibilling-access.log | grep -E "GET|POST"
```

### Чистка логов

```bash
# PM2 логи
pm2 flush

# Ротация логов Nginx (настроено автоматически через logrotate)
# Проверить конфигурацию:
cat /etc/logrotate.d/nginx

# Чистка логов приложения
cd ~/backend/logs
find . -name "*.log" -mtime +30 -delete  # Удалить логи старше 30 дней
```

---

## 🚨 Устранение неполадок

### Приложение не запускается

```bash
# Проверить логи PM2
pm2 logs vps-billing-api --err

# Проверить .env файл
cat ~/backend/.env

# Проверить подключение к БД
mysql -u vps_user -p vps_billing

# Проверить порты
sudo netstat -tulpn | grep 5000
```

### 502 Bad Gateway в Nginx

```bash
# Проверить, запущено ли приложение
pm2 list

# Перезапустить приложение
pm2 restart vps-billing-api

# Проверить логи Nginx
sudo tail -f /var/log/nginx/apibilling-error.log
```

### Высокое использование памяти

```bash
# Посмотреть использование памяти
pm2 monit

# Проверить метрики приложения
curl https://apibilling.mycloud.uz/metrics

# Перезапустить приложение
pm2 restart vps-billing-api
```

### Google OAuth не работает

1. Проверьте GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET в .env
2. Проверьте Redirect URI в Google Console: `https://apibilling.mycloud.uz/api/auth/google/callback`
3. Проверьте логи: `pm2 logs vps-billing-api | grep -i google`
4. Убедитесь, что файл `public/auth-callback.html` существует

---

## 📞 Поддержка

При возникновении проблем:

1. Проверьте логи
2. Проверьте документацию: `README_RU.md`
3. Проверьте оптимизацию: `OPTIMIZATION_RU.md`
4. Свяжитесь с технической поддержкой

---

## 📋 Чеклист деплоя

### Подготовка
- [ ] Сервер настроен и обновлен
- [ ] Установлены Node.js, MariaDB, Nginx
- [ ] Настроен firewall
- [ ] DNS записи созданы

### Backend
- [ ] Проект скопирован на сервер
- [ ] .env файл настроен
- [ ] База данных создана
- [ ] Зависимости установлены
- [ ] Nginx настроен
- [ ] SSL сертификат получен
- [ ] PM2 настроен и автозапуск работает

### Frontend
- [ ] Build создан (EAS или Web)
- [ ] Файлы скопированы на сервер (для Web)
- [ ] Nginx настроен (для Web)
- [ ] SSL сертификат получен (для Web)

### Тестирование
- [ ] /health возвращает OK
- [ ] /metrics показывает метрики
- [ ] Google OAuth работает
- [ ] Создание заказа работает
- [ ] PayMe интеграция работает

### Безопасность
- [ ] Firewall настроен
- [ ] SSL включен
- [ ] Rate limiting активен
- [ ] Резервное копирование настроено

---

**Последнее обновление:** 2025-10-12  
**Версия:** 1.0.0
