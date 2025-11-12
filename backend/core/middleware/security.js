/**
 * Middleware для защиты от CSRF атак
 */
const crypto = require('crypto');

// Хранилище токенов (в production использовать Redis)
const csrfTokens = new Map();

/**
 * Генерация CSRF токена
 */
function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Middleware для проверки CSRF токена
 */
function csrfProtection(req, res, next) {
  // Пропускаем GET запросы
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  // Пропускаем публичные эндпоинты
  const publicPaths = ['/api/auth/login', '/api/auth/register', '/api/auth/google'];
  if (publicPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  const token = req.headers['x-csrf-token'] || req.body?.csrf_token;
  const sessionId = req.headers['x-session-id'] || req.headers.authorization?.split(' ')[1];

  if (!token || !sessionId) {
    return res.status(403).json({
      success: false,
      error: 'CSRF token missing'
    });
  }

  const storedToken = csrfTokens.get(sessionId);
  if (!storedToken || storedToken !== token) {
    return res.status(403).json({
      success: false,
      error: 'Invalid CSRF token'
    });
  }

  next();
}

/**
 * Middleware для установки CSRF токена
 */
function setCSRFToken(req, res, next) {
  const sessionId = req.headers.authorization?.split(' ')[1] || crypto.randomBytes(16).toString('hex');
  const token = generateCSRFToken();
  
  csrfTokens.set(sessionId, token);
  
  // Очистка старых токенов (каждые 24 часа)
  setTimeout(() => {
    csrfTokens.delete(sessionId);
  }, 24 * 60 * 60 * 1000);

  res.setHeader('X-CSRF-Token', token);
  res.setHeader('X-Session-Id', sessionId);
  
  next();
}

/**
 * Rate limiting middleware
 */
const rateLimitStore = new Map();

function rateLimit(maxRequests = 100, windowMs = 15 * 60 * 1000) {
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const record = rateLimitStore.get(key);
    
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      });
    }

    record.count++;
    next();
  };
}

/**
 * Input validation middleware
 */
const securityUtils = require('../utils/security');

function validateInput(rules) {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rule] of Object.entries(rules)) {
      const value = req.body[field] || req.query[field];

      if (rule.required && (!value || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }

      if (value && rule.type) {
        if (rule.type === 'email' && !securityUtils.sanitizeEmail(value)) {
          errors.push(`${field} must be a valid email`);
        } else if (rule.type === 'string' && typeof value !== 'string') {
          errors.push(`${field} must be a string`);
        } else if (rule.type === 'number' && isNaN(Number(value))) {
          errors.push(`${field} must be a number`);
        }
      }

      if (value && rule.maxLength && value.length > rule.maxLength) {
        errors.push(`${field} exceeds maximum length of ${rule.maxLength}`);
      }

      if (value && rule.minLength && value.length < rule.minLength) {
        errors.push(`${field} must be at least ${rule.minLength} characters`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors
      });
    }

    next();
  };
}

/**
 * Security headers middleware
 */
function securityHeaders(req, res, next) {
  // Не устанавливаем заголовки, которые могут конфликтовать с CORS
  // CORS middleware уже установил Access-Control-Allow-Origin
  
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Strict-Transport-Security только для HTTPS
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Content-Security-Policy более мягкий для API
  res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' https://api.paycom.uz https://checkout.paycom.uz");
  
  next();
}

/**
 * Middleware для фильтрации чувствительных полей из ответов
 */
function filterSensitiveFields(req, res, next) {
  const originalJson = res.json.bind(res);
  
  res.json = function(data) {
    if (data && typeof data === 'object') {
      // Удаляем чувствительные поля
      const filtered = securityUtils.sanitizeResponse(data, [
        'password',
        'password_hash',
        'passwordHash',
        'jwt_secret',
        'api_key',
        'secret',
        'token_secret',
        'refresh_token_secret',
        'oauth_secret',
        'private_key'
      ]);
      return originalJson(filtered);
    }
    return originalJson(data);
  };
  
  next();
}

/**
 * Middleware для валидации и ограничения пагинации
 */
function validatePagination(maxLimit = 100) {
  return (req, res, next) => {
    let { limit, offset } = req.query;
    
    // Преобразуем в числа
    limit = parseInt(limit) || 20;
    offset = parseInt(offset) || 0;
    
    // Ограничиваем максимальный лимит
    if (limit > maxLimit) {
      return res.status(400).json({
        success: false,
        error: 'Pagination limit exceeded',
        message: `Maximum limit is ${maxLimit}, you requested ${limit}`
      });
    }
    
    // Проверяем на отрицательные значения
    if (limit < 1 || offset < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pagination parameters',
        message: 'Limit must be >= 1 and offset must be >= 0'
      });
    }
    
    // Устанавливаем валидированные значения
    req.query.limit = limit;
    req.query.offset = offset;
    
    next();
  };
}

module.exports = {
  csrfProtection,
  setCSRFToken,
  rateLimit,
  validateInput,
  securityHeaders,
  filterSensitiveFields,
  validatePagination
};

