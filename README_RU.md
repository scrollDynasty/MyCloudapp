# MyCloud VPS Billing System

## 📱 О проекте

MyCloud - это современная система биллинга VPS с мобильным приложением на React Native (Expo) и бэкендом на Node.js. Система поддерживает заказ VPS-серверов, интеграцию с платежной системой PayMe и авторизацию через Google OAuth.

## 🏗️ Архитектура

### Frontend (Мобильное приложение)
- **Фреймворк:** React Native + Expo
- **Навигация:** Expo Router
- **Язык:** TypeScript
- **UI:** Custom компоненты с современным дизайном
- **Состояние:** React Context API

### Backend (API Server)
- **Фреймворк:** Node.js + Express
- **База данных:** MariaDB (MySQL)
- **Авторизация:** JWT + Google OAuth 2.0
- **Платежи:** PayMe (Узбекистан)
- **Безопасность:** Helmet, CORS, Rate Limiting

## 🚀 Быстрый старт

### Предварительные требования
- Node.js 18+ 
- MariaDB/MySQL
- npm или yarn

### Установка Backend

```bash
cd backend
npm install

# Настройте .env файл (см. раздел Конфигурация)
cp .env.example .env
nano .env

# Запуск в режиме разработки
npm run dev

# Запуск в продакшене
npm start
```

### Установка Frontend

```bash
cd ..  # корневая директория проекта
npm install

# Настройте .env файл
echo "EXPO_PUBLIC_API_URL=https://apibilling.mycloud.uz" > .env

# Запуск для разработки
npm start

# Для Android
npm run android

# Для iOS
npm run ios

# Для Web
npm run web
```

## ⚙️ Конфигурация

### Backend Environment Variables (.env)

```bash
# База данных
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=ваш_пароль
DB_NAME=vps_billing

# Сервер
PORT=5000
NODE_ENV=production

# PayMe Integration
PAYME_MERCHANT_ID=ваш_merchant_id
PAYME_SECRET_KEY="ваш_секретный_ключ"
PAYME_URL=https://checkout.paycom.uz
PAYME_API_URL=https://checkout.paycom.uz/api
PAYME_USE_RETURN_URL=false

# Google OAuth
GOOGLE_CLIENT_ID=ваш_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=ваш_client_secret
GOOGLE_REDIRECT_URI=https://apibilling.mycloud.uz/api/auth/google/callback

# JWT
JWT_SECRET=ваш_секретный_ключ_jwt
JWT_EXPIRES_IN=7d

# Frontend & CORS
FRONTEND_URL=https://billing.mycloud.uz
CORS_ORIGIN=https://billing.mycloud.uz,http://localhost:8081,exp://localhost:8081

# Production Domains
API_DOMAIN=https://apibilling.mycloud.uz
PAYME_CALLBACK_URL=https://apibilling.mycloud.uz/api/payments/payme/callback
RETURN_URL=https://billing.mycloud.uz/payment-success

# Deep Linking
APP_SCHEME=mycloud
```

### Frontend Environment Variables (.env)

```bash
# API URL
EXPO_PUBLIC_API_URL=https://apibilling.mycloud.uz

# Для локальной разработки раскомментируйте:
# EXPO_PUBLIC_API_URL=http://localhost:5000
```

## 🔐 Google OAuth Настройка

### 1. Создание OAuth 2.0 приложения

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте новый проект или выберите существующий
3. Включите "Google+ API"
4. Перейдите в "Credentials" → "Create Credentials" → "OAuth client ID"
5. Выберите "Web application"
6. Добавьте Authorized redirect URIs:
   - `https://apibilling.mycloud.uz/api/auth/google/callback`
   - `http://localhost:5000/api/auth/google/callback` (для разработки)

### 2. Настройка Deep Linking для мобильного приложения

Deep linking уже настроен в `app.json`:
- **Scheme:** `mycloud://`
- **Universal Links:** `https://billing.mycloud.uz/auth/*`

## 💳 PayMe Integration

### Настройка

1. Зарегистрируйтесь на [PayMe Business](https://business.paycom.uz/)
2. Получите `MERCHANT_ID` и `SECRET_KEY`
3. Настройте Callback URL: `https://apibilling.mycloud.uz/api/payments/payme/callback`
4. Добавьте учетные данные в `.env`

### Тестирование

```bash
# Создать тестовый заказ
curl -X POST https://apibilling.mycloud.uz/api/payments/payme \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"order_id": 1}'
```

## 📊 API Endpoints

### Авторизация
```
POST   /api/auth/register       - Регистрация пользователя
POST   /api/auth/login          - Вход по email/паролю
GET    /api/auth/google         - Вход через Google
GET    /api/auth/me             - Получить текущего пользователя
GET    /api/auth/users          - Список пользователей (Admin)
GET    /api/auth/users/:id      - Детали пользователя
PUT    /api/auth/users/:id      - Обновить пользователя
```

### VPS Планы
```
GET    /api/vps                 - Список VPS планов
GET    /api/vps/:id             - Детали плана
POST   /api/vps-admin           - Создать план (Admin)
PUT    /api/vps-admin/:id       - Обновить план (Admin)
DELETE /api/vps-admin/:id       - Удалить план (Admin)
```

### Заказы
```
GET    /api/orders              - Список заказов пользователя
GET    /api/orders/:id          - Детали заказа
POST   /api/orders              - Создать заказ
PUT    /api/orders/:id          - Обновить заказ
GET    /api/orders/admin/all    - Все заказы (Admin)
```

### Платежи
```
POST   /api/payments/payme      - Создать PayMe checkout
POST   /api/payments/payme/callback - PayMe webhook
```

### Мониторинг
```
GET    /health                  - Проверка здоровья системы
GET    /metrics                 - Метрики производительности
```

## 🧪 Тестирование

### Тесты производительности
```bash
cd backend
npm run test:performance
```

### Обнаружение утечек памяти
```bash
cd backend
npm run test:memory
```

### Линтинг
```bash
# Frontend
npm run lint

# Backend
cd backend
npm run lint
npm run lint:fix
```

## 📱 Как работает Google OAuth

1. **Пользователь нажимает "Войти через Google"** в приложении
2. **Открывается браузер** с Google OAuth страницей
3. **Пользователь авторизуется** в Google
4. **Google перенаправляет** на `https://apibilling.mycloud.uz/api/auth/google/callback`
5. **Бэкенд создает/находит пользователя** и генерирует JWT токен
6. **Бэкенд перенаправляет** на `https://apibilling.mycloud.uz/auth-callback.html`
7. **HTML страница обрабатывает** токен и перенаправляет обратно в приложение через deep link `mycloud://auth/callback`
8. **Приложение получает токен** и сохраняет в AsyncStorage
9. **Пользователь авторизован** и перенаправлен на главную страницу

## 🛠️ Деплой

### Backend (на сервере)

```bash
# Установите зависимости
cd backend
npm install --production

# Настройте PM2 для автозапуска
npm install -g pm2
pm2 start app.js --name "vps-billing-api"
pm2 save
pm2 startup

# Настройте Nginx (см. backend/config/nginx/)
sudo cp backend/config/nginx/apibilling.mycloud.uz /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/apibilling.mycloud.uz /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Frontend (Expo)

```bash
# Для продакшена используйте EAS Build
npm install -g eas-cli
eas login
eas build:configure

# Build для Android
eas build --platform android

# Build для iOS
eas build --platform ios

# Web деплой
npm run web
# Затем деплойте содержимое dist/ на ваш хостинг
```

## 🔍 Мониторинг и отладка

### Логи Backend

```bash
# Живые логи
pm2 logs vps-billing-api

# Файловые логи
tail -f backend/logs/error.log
tail -f backend/logs/warn.log
tail -f backend/logs/payme.log
```

### Проверка здоровья системы

```bash
# Здоровье API
curl https://apibilling.mycloud.uz/health

# Метрики
curl https://apibilling.mycloud.uz/metrics
```

### Отладка мобильного приложения

```bash
# Запуск с туннелем (для тестирования на реальном устройстве)
npx expo start --tunnel

# Просмотр логов
npx expo start
# Затем нажмите 'j' чтобы открыть debugger
```

## 📋 Структура проекта

```
.
├── app/                      # Frontend (React Native)
│   ├── (admin)/             # Админ панель
│   ├── (user)/              # Пользовательская часть
│   ├── auth/                # Экраны авторизации
│   └── context/             # React Context
├── backend/                  # Backend (Node.js)
│   ├── api/                 # API маршруты
│   │   ├── auth/           # Авторизация
│   │   ├── orders/         # Заказы
│   │   ├── payments/       # Платежи
│   │   └── services/       # VPS сервисы
│   ├── core/                # Ядро приложения
│   │   ├── config/         # Конфигурация
│   │   ├── db/             # База данных
│   │   ├── middleware/     # Middleware
│   │   └── utils/          # Утилиты
│   ├── public/              # Статические файлы
│   └── scripts/             # Скрипты тестирования
├── assets/                   # Изображения и ресурсы
└── config/                   # Frontend конфигурация
```

## 🐛 Известные проблемы и решения

### Проблема: 404 ошибка на /auth/callback после Google OAuth

**Решение:** Теперь исправлено! Бэкенд перенаправляет на статическую HTML страницу `/auth-callback.html`, которая обрабатывает deep linking.

### Проблема: High heap usage warnings

**Решение:** Реализована оптимизация памяти:
- Пул подключений к БД
- Rate limiting
- Таймауты запросов
- Мониторинг памяти

См. подробности в `OPTIMIZATION_RU.md`

### Проблема: CORS ошибки в разработке

**Решение:** Добавьте ваш локальный адрес в `CORS_ORIGIN` в `.env`:
```bash
CORS_ORIGIN=https://billing.mycloud.uz,http://localhost:8081,exp://localhost:8081
```

## 📚 Дополнительные ресурсы

- [Документация Expo](https://docs.expo.dev/)
- [Документация Express](https://expressjs.com/)
- [PayMe API Docs](https://developer.help.paycom.uz/)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)

## 📄 Лицензия

Проприетарное ПО - Все права защищены © 2025 MyCloud

## 👥 Поддержка

Для вопросов и поддержки:
- Email: support@mycloud.uz
- Telegram: @mycloud_support

---

**Последнее обновление:** 2025-10-12
**Версия:** 1.0.0
