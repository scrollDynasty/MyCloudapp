/**
 * Email Verification API Endpoints
 * Обработка подтверждения email при регистрации
 */

const express = require('express');
const router = express.Router();
const emailUtil = require('../../core/utils/email');
const db = require('../../core/db/connection');
const { authenticate } = require('../../core/utils/auth');

/**
 * POST /api/auth/verify-email/send
 * Отправка verification email (для повторной отправки)
 */
router.post('/send', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Получаем данные пользователя
    const users = await db.query(
      'SELECT id, email, first_name, last_name, email_verified FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Пользователь не найден'
      });
    }
    
    const user = users[0];
    
    // Проверяем, не подтверждён ли уже email
    if (user.email_verified) {
      return res.status(400).json({
        success: false,
        error: 'Email уже подтверждён'
      });
    }
    
    // Генерируем токен
    const token = await emailUtil.generateVerificationToken(userId);
    
    // Отправляем email
    const name = `${user.first_name} ${user.last_name}`.trim();
    const sent = await emailUtil.sendVerificationEmail(user.email, name, token);
    
    if (!sent) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось отправить email'
      });
    }
    
    res.json({
      success: true,
      message: 'Письмо с подтверждением отправлено',
      email: user.email
    });
    
  } catch (error) {
    console.error('Send verification email error:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при отправке письма',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/verify-email/confirm
 * Подтверждение email по токену
 */
router.post('/confirm', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Токен не предоставлен'
      });
    }
    
    // Подтверждаем email
    const result = await emailUtil.confirmEmail(token);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      message: 'Email успешно подтверждён',
      email: result.email,
      name: result.name
    });
    
  } catch (error) {
    console.error('Confirm email error:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при подтверждении email',
      message: error.message
    });
  }
});

/**
 * GET /api/auth/verify-email/status
 * Проверка статуса подтверждения email
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const users = await db.query(
      'SELECT email_verified, verified_at FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Пользователь не найден'
      });
    }
    
    const user = users[0];
    
    res.json({
      success: true,
      data: {
        email_verified: user.email_verified || false,
        verified_at: user.verified_at
      }
    });
    
  } catch (error) {
    console.error('Check verification status error:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при проверке статуса',
      message: error.message
    });
  }
});

module.exports = router;

