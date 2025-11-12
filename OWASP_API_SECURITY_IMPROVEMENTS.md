# OWASP API Security Top 10 - Исправления

## Выполненные исправления

### ✅ API1: Broken Object Level Authorization (BOLA/IDOR)
**Статус**: Исправлено

**Изменения**:
- Добавлена аутентификация на все endpoints заказов (`/api/orders`)
- Пользователи могут видеть только свои заказы
- Админы могут видеть все заказы
- Добавлена проверка владельца ресурса при создании и просмотре заказов
- Обновление статуса заказа доступно только админам

**Файлы**:
- `backend/api/orders/orders.js`

### ✅ API2: Broken Authentication
**Статус**: Исправлено

**Изменения**:
- JWT токены теперь короткоживущие (15 минут вместо 7 дней)
- Добавлены refresh tokens (7 дней)
- Роль пользователя не хранится в JWT (загружается из БД)
- Добавлен endpoint `/api/auth/refresh` для обновления токенов
- Login endpoint возвращает оба токена (access + refresh)

**Файлы**:
- `backend/core/utils/auth.js`
- `backend/api/auth/auth.js`

### ✅ API3: Broken Object Property Level Authorization (BOPLA)
**Статус**: Частично исправлено

**Изменения**:
- Добавлен middleware `filterSensitiveFields` для автоматического удаления чувствительных полей
- Улучшена функция `sanitizeResponse` в `security.js`
- Добавлена валидация входных данных через `validateInput` middleware

**Файлы**:
- `backend/core/middleware/security.js`
- `backend/core/utils/security.js`

### ✅ API4: Unrestricted Resource Consumption
**Статус**: Улучшено

**Изменения**:
- Добавлен middleware `validatePagination` с жесткими лимитами
- Максимальный limit для orders: 100
- Максимальный limit для users: 50
- Проверка на отрицательные значения offset/limit
- Rate limiting уже был настроен (100 req/min для API)

**Файлы**:
- `backend/core/middleware/security.js`
- `backend/api/orders/orders.js`
- `backend/api/auth/auth.js`

### ⚠️ API5: Broken Function Level Authorization (BFLA)
**Статус**: Уже реализовано

**Текущее состояние**:
- JWT подпись всегда валидируется
- Роль проверяется из БД, а не из JWT payload
- RBAC middleware (`adminOnly`, `adminOrSelf`) работает корректно
- Все админ-эндпоинты защищены

**Рекомендации**:
- Роль уже загружается из БД в middleware `authenticate`
- JWT не содержит роль (удалено в последнем обновлении)

### ⚠️ API7: Server-Side Request Forgery (SSRF)
**Статус**: Требует внимания

**Рекомендации для реализации**:
```javascript
// Добавить в backend/core/utils/security.js
const ALLOWED_DOMAINS = ['api.paycom.uz', 'checkout.paycom.uz'];
const BLOCKED_IPS = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./
];

function validateExternalURL(url) {
  const parsed = new URL(url);
  
  // Проверка whitelist доменов
  if (!ALLOWED_DOMAINS.includes(parsed.hostname)) {
    return { valid: false, error: 'Domain not allowed' };
  }
  
  // Блокировка приватных IP
  for (const pattern of BLOCKED_IPS) {
    if (pattern.test(parsed.hostname)) {
      return { valid: false, error: 'Private IP addresses not allowed' };
    }
  }
  
  return { valid: true };
}
```

**Применить к**:
- `backend/api/payments/payme.js` (внешние запросы к Payme)

### ✅ API8: Security Misconfiguration
**Статус**: Частично реализовано

**Текущее состояние**:
- HTTPS: Настроено через Nginx (предполагается)
- CORS: Настроен с whitelist доменов
- Security Headers: Реализованы (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `HSTS`)
- CSP: Настроен для Payme интеграции

**Рекомендации**:
- Убедиться, что в production используется HTTPS
- Проверить `.env` файл на наличие всех секретов
- Отключить debug логи в production

### ⚠️ API10: Unsafe Consumption of APIs
**Статус**: Требует внимания

**Рекомендации для реализации**:
```javascript
// Добавить в backend/core/utils/security.js
const axios = require('axios');

async function safeExternalRequest(url, options = {}) {
  // Валидация URL
  const urlValidation = validateExternalURL(url);
  if (!urlValidation.valid) {
    throw new Error(urlValidation.error);
  }
  
  // Таймаут
  const timeout = options.timeout || 5000;
  
  // Валидация ответа
  try {
    const response = await axios({
      url,
      ...options,
      timeout,
      maxRedirects: 2
    });
    
    // Санитизация данных
    if (response.data && typeof response.data === 'object') {
      return sanitizeResponse(response.data);
    }
    
    return response.data;
  } catch (error) {
    // Безопасное сообщение об ошибке
    throw new Error('External API request failed');
  }
}
```

**Применить к**:
- `backend/api/payments/payme.js`
- Любые другие внешние API вызовы

## Дополнительные рекомендации

### 1. Переменные окружения
Убедитесь, что `.env` содержит:
```env
JWT_SECRET=<strong-random-secret>
JWT_REFRESH_SECRET=<another-strong-random-secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

### 2. Bcrypt rounds
Текущее: 10 rounds
Рекомендуется: 12+ rounds для production

### 3. Логирование
- ✅ Критичные операции логируются
- ✅ Чувствительные данные не логируются (через `sanitizeResponse`)
- ⚠️ Добавить централизованное логирование ошибок

### 4. Мониторинг
- Добавить мониторинг неудачных попыток входа
- Добавить алерты на подозрительную активность
- Логировать все изменения критичных данных (роли, статусы)

### 5. Обновление зависимостей
Регулярно выполнять:
```bash
npm audit
npm audit fix
```

## Тестирование безопасности

### Ручное тестирование
1. Попытка доступа к чужим заказам
2. Попытка изменить свою роль через API
3. Попытка обойти rate limiting
4. Попытка использовать истекший токен
5. Попытка SQL injection в параметрах

### Автоматизированное тестирование
Рекомендуется использовать:
- OWASP ZAP
- Burp Suite
- Postman Security Tests

## Статус по задачам

- ✅ API1: BOLA/IDOR - **Исправлено**
- ✅ API2: Broken Authentication - **Исправлено**
- ✅ API3: BOPLA - **Частично исправлено**
- ✅ API4: Resource Consumption - **Улучшено**
- ✅ API5: BFLA - **Уже реализовано**
- ⚠️ API7: SSRF - **Требует внимания** (добавить whitelist)
- ✅ API8: Security Misconfiguration - **Частично реализовано**
- ⚠️ API10: Unsafe API Consumption - **Требует внимания** (добавить валидацию внешних API)

## Следующие шаги

1. Добавить SSRF защиту для внешних API вызовов
2. Реализовать безопасную обработку внешних данных
3. Настроить централизованное логирование
4. Провести security audit
5. Обновить документацию API

