/**
 * Phone Authentication API
 * Handles SMS-based authentication for Uzbekistan phone numbers (+998)
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { query } = require('../../core/db/queries');

// Временное хранилище кодов (в продакшене использовать Redis)
const verificationCodes = new Map();

// Конфигурация
const CODE_EXPIRY = 10 * 60 * 1000; // 10 минут
const MAX_ATTEMPTS = 5;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Генерация 6-значного кода
 */
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * POST /api/auth/phone/send-code
 * Отправка SMS-кода на телефон
 */
router.post('/send-code', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    // Валидация номера телефона
    if (!phoneNumber || !phoneNumber.match(/^\+998\d{9}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Неверный формат номера телефона'
      });
    }

    // Проверка лимита попыток
    const existing = verificationCodes.get(phoneNumber);
    if (existing && existing.attempts >= MAX_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        error: 'Слишком много попыток, попробуйте позже'
      });
    }

    // Генерация кода
    const code = generateCode();
    const expiresAt = Date.now() + CODE_EXPIRY;

    // Сохранение кода
    verificationCodes.set(phoneNumber, {
      code,
      expiresAt,
      attempts: existing ? existing.attempts + 1 : 1,
      verified: false
    });

    // В ПРОДАКШЕНЕ: Интеграция с SMS-провайдером (Twilio, SMS.uz и т.д.)
    // Для разработки: выводим код в консоль
    console.log(`📱 SMS Code for ${phoneNumber}: ${code}`);
    console.log(`⏰ Expires at: ${new Date(expiresAt).toLocaleString()}`);

    // ВРЕМЕННО: Возвращаем код в ответе для тестирования (УДАЛИТЬ В ПРОДАКШЕНЕ!)
    // В продакшене просто отправить SMS и вернуть success: true
    return res.json({
      success: true,
      message: 'Код отправлен на ваш номер',
      // УДАЛИТЬ в продакшене:
      debug: {
        code,
        expiresIn: CODE_EXPIRY / 1000
      }
    });

  } catch (error) {
    console.error('Send code error:', error);
    return res.status(500).json({
      success: false,
      error: 'Ошибка отправки SMS, проверьте номер'
    });
  }
});

/**
 * POST /api/auth/phone/verify-code
 * Проверка кода и вход/регистрация
 */
router.post('/verify-code', async (req, res) => {
  try {
    const { phoneNumber, code } = req.body;

    // Валидация
    if (!phoneNumber || !code) {
      return res.status(400).json({
        success: false,
        error: 'Не указан номер телефона или код'
      });
    }

    if (!phoneNumber.match(/^\+998\d{9}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Неверный формат номера телефона'
      });
    }

    if (!code.match(/^\d{6}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Код должен содержать 6 цифр'
      });
    }

    // Проверка наличия кода
    const stored = verificationCodes.get(phoneNumber);
    if (!stored) {
      return res.status(400).json({
        success: false,
        error: 'Код не найден. Запросите новый код'
      });
    }

    // Проверка срока действия
    if (Date.now() > stored.expiresAt) {
      verificationCodes.delete(phoneNumber);
      return res.status(400).json({
        success: false,
        error: 'Код истек, запросите новый'
      });
    }

    // Проверка кода
    if (stored.code !== code) {
      return res.status(400).json({
        success: false,
        error: 'Неверный код подтверждения'
      });
    }

    // Код верен - очищаем
    verificationCodes.delete(phoneNumber);

    // Проверяем, существует ли пользователь с таким номером
    const existingUsers = await query(
      'SELECT * FROM users WHERE phone_number = ? AND is_active = TRUE',
      [phoneNumber]
    );

    let user;
    let isNewUser = false;

    if (existingUsers.length > 0) {
      // Пользователь существует - обновляем время последнего входа
      user = existingUsers[0];
      
      await query(
        'UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE user_id = ?',
        [user.user_id]
      );

      console.log(`✅ User ${phoneNumber} logged in`);
    } else {
      // Новый пользователь - создаем запись
      isNewUser = true;
      
      const insertResult = await query(
        `INSERT INTO users (
          full_name, 
          email, 
          phone_number, 
          role, 
          is_active, 
          oauth_provider,
          created_at,
          updated_at,
          last_login_at
        ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
        [
          `Пользователь ${phoneNumber.slice(-4)}`, // Временное имя
          null, // Email не используется
          phoneNumber,
          'individual', // Роль по умолчанию
          true,
          null
        ]
      );

      // Получаем созданного пользователя
      const newUsers = await query(
        'SELECT * FROM users WHERE user_id = ?',
        [insertResult.insertId]
      );
      
      user = newUsers[0];

      console.log(`🆕 New user created: ${phoneNumber}`);
    }

    // Генерация JWT токена
    const token = jwt.sign(
      {
        userId: user.user_id,
        phoneNumber: user.phone_number,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Формируем ответ
    const userData = {
      user_id: user.user_id,
      full_name: user.full_name,
      email: user.email,
      phone_number: user.phone_number,
      role: user.role,
      company_name: user.company_name
    };

    return res.json({
      success: true,
      message: isNewUser ? 'Регистрация успешна' : 'Вход выполнен',
      data: {
        token,
        user: userData,
        isNewUser
      }
    });

  } catch (error) {
    console.error('Verify code error:', error);
    return res.status(500).json({
      success: false,
      error: 'Произошла ошибка, попробуйте снова'
    });
  }
});

/**
 * Очистка устаревших кодов (запускать периодически)
 */
function cleanupExpiredCodes() {
  const now = Date.now();
  for (const [phoneNumber, data] of verificationCodes.entries()) {
    if (now > data.expiresAt) {
      verificationCodes.delete(phoneNumber);
      console.log(`🧹 Cleaned up expired code for ${phoneNumber}`);
    }
  }
}

// Запуск очистки каждую минуту
setInterval(cleanupExpiredCodes, 60 * 1000);

module.exports = router;
