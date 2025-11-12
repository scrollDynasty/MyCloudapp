# Промт для защиты API от уязвимостей OWASP Top 10 API

```markdown
Ты - эксперт по безопасности API. Проанализируй мой код API и исправь все уязвимости согласно OWASP API Security Top 10. Вот критерии для проверки и исправления:

## API1: Broken Object Level Authorization (BOLA/IDOR)

**Проверь:**
- Все эндпоинты с параметрами ID (userId, accountId, transactionId и т.д.)
- Доступ к ресурсам других пользователей

**Исправь:**
1. Добавь middleware для проверки владельца ресурса:
   - Извлекай userId из JWT-токена (не из тела запроса!)
   - Сравнивай с ID запрашиваемого ресурса
   - Блокируй доступ если userId !== resourceOwnerId
2. Реализуй проверку для ВСЕХ операций CRUD
3. Пример кода:
```javascript
const userId = req.user.id; // из JWT
const accountId = req.params.accountId;
if (userId !== accountId) {
  return res.status(403).json({ error: 'Access denied' });
}
```

## API2: Broken Authentication

**Проверь:**
- Процесс сброса пароля
- Генерацию и валидацию токенов
- Защиту от brute-force атак

**Исправь:**
1. Сброс пароля только с подтверждением по email (одноразовый токен)
2. Никогда не принимай username + new_password в одном запросе без верификации
3. Добавь rate limiting на критичные эндпоинты:
   - Максимум 5 попыток сброса пароля в час
   - Максимум 10 попыток входа в 15 минут
4. Используй длинные случайные токены (минимум 32 символа)
5. Логируй все неудачные попытки аутентификации

## API3: Broken Object Property Level Authorization (BOPLA)

**Проверь:**
- Какие поля возвращаются в ответах API
- Какие поля принимаются при создании/обновлении

**Исправь:**
1. **Excessive Data Exposure**: Используй DTO/serializers - возвращай ТОЛЬКО необходимые поля:
   - Убери is_admin, role, internal_id из публичных ответов
   - Создай отдельные схемы для разных ролей

2. **Mass Assignment**: Реализуй жёсткий whitelist полей:
```javascript
const ALLOWED_FIELDS = ['username', 'email', 'password'];
const filteredData = Object.keys(req.body)
  .filter(key => ALLOWED_FIELDS.includes(key))
  .reduce((obj, key) => {
    obj[key] = req.body[key];
    return obj;
  }, {});
```
3. Критичные поля (is_admin, balance, role) управляй ТОЛЬКО на сервере
4. Отклоняй запросы с недопустимыми полями с ошибкой 400

## API4: Unrestricted Resource Consumption

**Проверь:**
- Эндпоинты с выборкой данных (списки, истории)
- Операции с email/SMS
- Тяжёлые вычисления

**Исправь:**
1. **Rate Limiting** на ВСЕ эндпоинты:
```javascript
// Пример с express-rate-limit
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 100 // максимум 100 запросов
});
app.use('/api/', limiter);
```

2. **Пагинация с жёстким лимитом**:
   - Максимум limit = 100-200 записей
   - Если больше - возвращай ошибку 400
   - Всегда используй offset/cursor пагинацию

3. **Таймауты**:
   - Request timeout: 30 секунд
   - Database query timeout: 10 секунд
   - External API timeout: 5 секунд

4. **Аутентификация для тяжёлых операций**:
   - Экспорт данных только для авторизованных
   - Дополнительный throttling для authenticated users

## API5: Broken Function Level Authorization (BFLA)

**Проверь:**
- Админ-эндпоинты (удаление, одобрение, управление)
- Проверку JWT подписи
- RBAC реализацию

**Исправь:**
1. **ВСЕГДА валидируй JWT подпись**:
```javascript
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET; // храни в переменных окружения!

try {
  const decoded = jwt.verify(token, SECRET);
  req.user = decoded;
} catch (err) {
  return res.status(401).json({ error: 'Invalid token' });
}
```

2. **Проверяй роль из базы данных, НЕ из JWT payload**:
```javascript
const user = await db.users.findById(req.user.id);
if (user.role !== 'admin') {
  return res.status(403).json({ error: 'Admin only' });
}
```

3. **RBAC middleware для каждого эндпоинта**:
```javascript
function requireRole(role) {
  return async (req, res, next) => {
    const user = await db.users.findById(req.user.id);
    if (user.role !== role) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

router.delete('/users/:id', requireRole('admin'), deleteUser);
```

4. Используй короткие сроки жизни токенов:
   - Access token: 15 минут
   - Refresh token: 7 дней

## API6: Unrestricted Access to Sensitive Business Flows

**Проверь:**
- Эндпоинты изменения баланса, статусов, ролей
- Критичные бизнес-операции

**Исправь:**
1. Все критичные поля (balance, role, status) изменяй ТОЛЬКО через внутренние методы
2. Добавь MFA для рискованных операций (переводы > $1000)
3. Дополнительный rate limiting на финансовые операции
4. Используй схемы валидации с запретом дополнительных полей:
```javascript
const Joi = require('joi');
const schema = Joi.object({
  username: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required()
}).options({ allowUnknown: false }); // критично!
```

## API7: Server-Side Request Forgery (SSRF)

**Проверь:**
- Эндпоинты принимающие URL (загрузка файлов, webhooks, экспорт)
- Интеграции с внешними сервисами

**Исправь:**
1. **Whitelist разрешённых доменов**:
```javascript
const ALLOWED_DOMAINS = ['trusted-api.com', 'partner.example.org'];

function isAllowedURL(url) {
  const parsed = new URL(url);
  return ALLOWED_DOMAINS.includes(parsed.hostname);
}

if (!isAllowedURL(req.body.url)) {
  return res.status(400).json({ error: 'Domain not allowed' });
}
```

2. **Блокируй приватные IP**:
```javascript
const BLOCKED_IPS = [
  /^10\./,                    // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
  /^192\.168\./,              // 192.168.0.0/16
  /^127\./,                   // 127.0.0.0/8
  /^169\.254\./               // 169.254.0.0/16
];
```

3. **Блокируй опасные схемы**: file://, gopher://, dict://
4. Лимит на редиректы (максимум 2)
5. Таймаут для внешних запросов (5 секунд)

## API8: Security Misconfiguration

**Проверь:**
- Конфигурацию сервера, СУБД, облачных сервисов
- CORS, HTTPS, заголовки безопасности

**Исправь:**
1. **HTTPS ТОЛЬКО**:
   - Редирект с HTTP на HTTPS (код 301)
   - HSTS заголовок: `Strict-Transport-Security: max-age=31536000; includeSubDomains`

2. **CORS с whitelist**:
```javascript
const cors = require('cors');
const ALLOWED_ORIGINS = ['https://yourdomain.com'];

app.use(cors({
  origin: function(origin, callback) {
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
```

3. **Безопасные заголовки**:
```javascript
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
});
```

4. **Отключи debug в production**:
   - Убери verbose логирование
   - Скрой stack traces в ошибках
   - Удали dev-эндпоинты (/debug, /test)

5. **Безопасные сессии**:
   - httpOnly: true
   - secure: true (только HTTPS)
   - sameSite: 'strict'

6. **Заблокируй Swagger/docs в production**

## API9: Improper Inventory Management

**Проверь:**
- Документацию всех эндпоинтов
- Старые версии API
- Dev/staging эндпоинты

**Исправь:**
1. Веди полный реестр всех эндпоинтов с метаданными:
   - Версия, среда, ответственный, статус (active/deprecated)

2. **Версионирование API**:
   - /api/v1/, /api/v2/ и т.д.
   - Явная deprecation policy (за 6 месяцев до отключения)
   - Возвращай заголовок: `Deprecation: true` для старых версий

3. **Отключай старые версии**:
```javascript
app.use('/api/v1', (req, res) => {
  res.status(410).json({ 
    error: 'API v1 is deprecated. Use /api/v2' 
  });
});
```

4. **Блокируй dev/staging извне**:
   - Firewall rules
   - VPN/IP whitelist для non-prod сред

5. Сканируй регулярно на забытые эндпоинты

## API10: Unsafe Consumption of APIs

**Проверь:**
- Все интеграции с внешними API
- Обработку данных от третьих сторон

**Исправь:**
1. **Жёсткая валидация внешних данных**:
```javascript
const Joi = require('joi');
const externalDataSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
  name: Joi.string().max(100).required(),
  email: Joi.string().email().required()
}).unknown(false); // отклоняй неизвестные поля

const { error } = externalDataSchema.validate(externalData);
if (error) {
  throw new Error('Invalid external data');
}
```

2. **Санация данных**:
   - Экранируй HTML/SQL
   - Удаляй опасные теги
   - Используй DOMPurify для HTML

3. **OAuth 2.0 для аутентификации внешних API**

4. **Таймауты для внешних вызовов**:
   - 5 секунд для внешних API
   - 30 секунд для внутренних

5. **Безопасные сообщения об ошибках**:
   - НЕ раскрывай технические детали
   - Общие фразы: "Ошибка авторизации" вместо "JWT токен истёк"

6. **Мониторинг аномалий** в ответах внешних API

---

## Общие требования к коду:

1. Используй переменные окружения для всех секретов (.env файл)
2. Хешируй пароли с bcrypt (минимум 12 раундов)
3. Логируй все критичные операции (вход, изменения, ошибки)
4. Реализуй centralized error handling
5. Добавь health check эндпоинт
6. Используй prepared statements для SQL (защита от инъекций)
7. Валидируй ВСЕ входящие данные
8. Применяй принцип наименьших привилегий

---

## Формат ответа:

Для каждой найденной уязвимости предоставь:
1. **Описание проблемы** в моём коде
2. **Уязвимый код** (что сейчас)
3. **Исправленный код** (как должно быть)
4. **Объяснение**, почему это важно
5. **Дополнительные рекомендации**

Начни анализ с проверки аутентификации и авторизации, затем переходи к остальным уязвимостям.

---

## Как использовать этот промт:

1. Скопируй весь текст выше
2. Добавь в конец: **"Вот мой код API: [вставь свой код]"**
3. Отправь нейросети (ChatGPT, Claude, Gemini и т.д.)

Нейросеть проанализирует код и даст конкретные исправления для каждой уязвимости OWASP Top 10 API!
```