# Настройка Email Verification для MyCloud

## ✅ Что уже сделано:

1. ✅ Создана таблица `email_verification_tokens` в базе данных
2. ✅ Добавлены поля `email_verified` и `verified_at` в таблицу `users`
3. ✅ Установлен пакет `nodemailer`
4. ✅ Созданы API endpoints для подтверждения email
5. ✅ Обновлена логика регистрации
6. ✅ Созданы экраны для мобильного приложения

## 📧 Настройка SMTP в .env файле

Добавьте следующие переменные в файл `/home/whoami/prj/MyCloudapp/backend/.env`:

```bash
# Email Configuration для подтверждения регистрации
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Frontend URL для deep links (мобильное приложение)
FRONTEND_URL=mycloud://auth

# Или если тестируете на web:
# FRONTEND_URL=http://localhost:8081/auth
```

## 🔐 Получение App Password для Gmail:

1. Войдите в свой Google аккаунт
2. Перейдите в [Google Account Security](https://myaccount.google.com/security)
3. Включите двухфакторную аутентификацию (если не включена)
4. Перейдите в "App passwords" (Пароли приложений)
5. Создайте новый пароль для приложения "Mail"
6. Скопируйте сгенерированный пароль и вставьте в `SMTP_PASS`

## 📱 Альтернативные SMTP сервисы:

### SendGrid
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

### Mailgun
```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASS=your-mailgun-password
```

### Mail.ru
```bash
SMTP_HOST=smtp.mail.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@mail.ru
SMTP_PASS=your-password
```

### Yandex.Mail
```bash
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@yandex.ru
SMTP_PASS=your-password
```

## 🧪 Тестирование настройки

После добавления настроек в .env:

1. Перезапустите backend сервер:
```bash
cd /home/whoami/prj/MyCloudapp/backend
npm run dev
```

2. Проверьте подключение (создайте тестовый скрипт):
```bash
node -e "
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.log('❌ SMTP Error:', error);
  } else {
    console.log('✅ SMTP Server is ready to send emails');
  }
});
"
```

## 📋 API Endpoints

### Регистрация (автоматически отправляет email)
```
POST /api/auth/register
```

### Подтверждение email
```
POST /api/auth/verify-email/confirm
Body: { "token": "verification-token" }
```

### Повторная отправка письма
```
POST /api/auth/verify-email/send
Headers: Authorization: Bearer <jwt-token>
```

### Проверка статуса подтверждения
```
GET /api/auth/verify-email/status
Headers: Authorization: Bearer <jwt-token>
```

## 🔄 Процесс подтверждения email:

1. **Регистрация**: Пользователь регистрируется через форму
2. **Отправка письма**: Система автоматически отправляет письмо с ссылкой
3. **Экран "Email отправлен"**: Показывается экран с инструкциями
4. **Подтверждение**: Пользователь нажимает на ссылку в письме
5. **Экран "Email подтверждён"**: Показывается успешное подтверждение
6. **Автоматический редирект**: Через 10 секунд перенаправление на логин

## 🔒 Безопасность:

- ✅ Токены действительны только 10 минут
- ✅ Токены одноразовые (помечаются как использованные)
- ✅ Пользователи с неподтверждённым email не могут войти
- ✅ Google OAuth автоматически помечает email как подтверждённый
- ✅ Старые неиспользованные токены можно удалять через cron job

## 🐛 Troubleshooting:

### Письма не отправляются
```bash
# Проверьте логи backend
tail -f /home/whoami/prj/MyCloudapp/backend/logs/app.log

# Проверьте переменные окружения
node -e "require('dotenv').config(); console.log('SMTP_HOST:', process.env.SMTP_HOST);"
```

### Ошибка "Invalid credentials"
- Проверьте правильность SMTP_USER и SMTP_PASS
- Для Gmail используйте App Password, а не обычный пароль
- Убедитесь, что двухфакторная аутентификация включена (для Gmail)

### Письма попадают в спам
- Настройте SPF, DKIM, DMARC записи для вашего домена
- Используйте профессиональные SMTP сервисы (SendGrid, Mailgun)
- Добавьте домен отправителя в белый список

## 📝 Пример .env файла (полный)

```bash
# Server
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your-db-password
DB_NAME=vps_billing
DB_PORT=3306

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback

# Email Verification (ДОБАВЬТЕ ЭТО!)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FRONTEND_URL=mycloud://auth

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:8081
```

## ✨ Готово!

После настройки .env файла система подтверждения email готова к работе.

Для тестирования:
1. Зарегистрируйте нового пользователя через мобильное приложение
2. Проверьте почту и нажмите на ссылку подтверждения
3. Убедитесь, что редирект работает корректно

---

**Создано:** 2025-01-28  
**Автор:** AI Assistant  
**Версия:** 1.0

