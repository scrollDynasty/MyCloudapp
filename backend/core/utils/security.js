/**
 * Утилиты безопасности для защиты от OWASP TOP 10
 */

// ============================================
// 1. Injection (SQL Injection, Command Injection)
// ============================================

/**
 * Санитизация строковых значений для SQL запросов
 * Используется вместе с параметризованными запросами
 */
function sanitizeString(input) {
  if (input === null || input === undefined) return '';
  if (typeof input !== 'string') return String(input).trim();
  
  // Удаляем опасные SQL символы
  return input
    .trim()
    .replace(/['";\\]/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    .substring(0, 1000); // Ограничение длины
}

/**
 * Валидация и санитизация email
 */
function sanitizeEmail(email) {
  if (!email || typeof email !== 'string') return null;
  
  const sanitized = email.trim().toLowerCase();
  
  // Проверка на опасные символы
  const dangerousChars = /[<>"';\\]/;
  if (dangerousChars.test(sanitized)) return null;
  
  // Стандартная валидация email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(sanitized)) return null;
  
  // Ограничение длины
  if (sanitized.length > 254) return null;
  
  return sanitized;
}

/**
 * Валидация и санитизация пароля
 */
function sanitizePassword(password) {
  if (!password || typeof password !== 'string') return null;
  
  // Ограничение длины пароля
  if (password.length < 6 || password.length > 128) return null;
  
  // Удаляем опасные символы, но сохраняем специальные символы для пароля
  return password.substring(0, 128);
}

/**
 * Валидация и санитизация числовых значений
 */
function sanitizeNumber(input, min, max) {
  const num = parseInt(input, 10);
  
  if (isNaN(num)) return null;
  
  if (min !== undefined && num < min) return null;
  if (max !== undefined && num > max) return null;
  
  return num;
}

// ============================================
// 2. Broken Authentication
// ============================================

/**
 * Проверка силы пароля
 */
function validatePasswordStrength(password) {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('Пароль должен содержать минимум 8 символов');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Пароль должен содержать строчные буквы');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Пароль должен содержать заглавные буквы');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Пароль должен содержать цифры');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Пароль должен содержать специальные символы');
  }
  
  let strength = 'weak';
  if (errors.length === 0) {
    strength = password.length >= 12 ? 'strong' : 'medium';
  }
  
  return {
    valid: errors.length === 0,
    strength,
    errors
  };
}

// ============================================
// 3. Sensitive Data Exposure
// ============================================

/**
 * Удаление чувствительных данных из объекта
 */
function sanitizeResponse(data, sensitiveFields) {
  if (!sensitiveFields) {
    sensitiveFields = ['password', 'password_hash', 'token', 'secret'];
  }
  if (data === null || data === undefined) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeResponse(item, sensitiveFields));
  }
  
  if (typeof data === 'object') {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (sensitiveFields.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeResponse(value, sensitiveFields);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
  
  return data;
}

// ============================================
// 4. XML External Entities (XXE) - не применимо для JSON
// ============================================

// ============================================
// 5. Broken Access Control
// ============================================

/**
 * Проверка прав доступа
 */
function checkAccess(userRole, requiredRoles) {
  return requiredRoles.includes(userRole);
}

/**
 * Проверка владения ресурсом
 */
function checkOwnership(userId, resourceUserId) {
  return userId === resourceUserId;
}

// ============================================
// 6. Security Misconfiguration
// ============================================

/**
 * Валидация заголовков безопасности
 */
function validateSecurityHeaders(headers) {
  const errors = [];
  
  // Проверка Content-Type
  if (headers['content-type'] && !headers['content-type'].includes('application/json')) {
    errors.push('Invalid Content-Type');
  }
  
  // Проверка размера запроса (защита от DoS)
  const contentLength = parseInt(headers['content-length'] || '0', 10);
  if (contentLength > 10 * 1024 * 1024) { // 10MB
    errors.push('Request too large');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================
// 7. Cross-Site Scripting (XSS)
// ============================================

/**
 * Санитизация HTML для защиты от XSS
 */
function sanitizeHTML(input) {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/<script/gi, '')
    .replace(/<iframe/gi, '')
    .replace(/<object/gi, '')
    .replace(/<embed/gi, '')
    .substring(0, 10000); // Ограничение длины
}

/**
 * Санитизация текста для безопасного отображения
 */
function escapeHTML(text) {
  if (!text || typeof text !== 'string') return '';
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// ============================================
// 8. Insecure Deserialization
// ============================================

/**
 * Безопасная десериализация JSON
 */
function safeJSONParse(json, defaultValue) {
  if (defaultValue === undefined) defaultValue = null;
  try {
    const parsed = JSON.parse(json);
    
    // Проверка на циклические ссылки и глубокую вложенность
    const depth = JSON.stringify(parsed).length;
    if (depth > 1000000) { // Ограничение размера
      return defaultValue;
    }
    
    return parsed;
  } catch (error) {
    return defaultValue;
  }
}

// ============================================
// 9. Using Components with Known Vulnerabilities
// ============================================

// Требуется регулярное обновление зависимостей и проверка через npm audit

// ============================================
// 10. Insufficient Logging & Monitoring
// ============================================

/**
 * Безопасное логирование (без чувствительных данных)
 */
function safeLog(message, data) {
  const sanitizedData = data ? sanitizeResponse(data) : null;
  console.log(`[SECURITY] ${message}`, sanitizedData || '');
}

module.exports = {
  sanitizeString,
  sanitizeEmail,
  sanitizePassword,
  sanitizeNumber,
  validatePasswordStrength,
  sanitizeResponse,
  checkAccess,
  checkOwnership,
  validateSecurityHeaders,
  sanitizeHTML,
  escapeHTML,
  safeJSONParse,
  safeLog
};

