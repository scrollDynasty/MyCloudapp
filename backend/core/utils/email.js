/**
 * Email Utility для отправки verification emails
 * Использует nodemailer для отправки писем
 */

const nodemailer = require('nodemailer');
const crypto = require('crypto');
const db = require('../db/connection');

// Конфигурация email транспорта
const createTransporter = () => {
  // Используем SMTP настройки из .env
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true', // true для 465, false для других портов
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

/**
 * Генерация verification token
 * @param {number} userId - ID пользователя
 * @returns {Promise<string>} - Возвращает токен
 */
async function generateVerificationToken(userId) {
  // Генерируем случайный токен
  const token = crypto.randomBytes(32).toString('hex');
  
  // Токен действителен 10 минут
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  
  try {
    // Удаляем старые токены для этого пользователя
    await db.query(
      'DELETE FROM email_verification_tokens WHERE user_id = ?',
      [userId]
    );
    
    // Сохраняем новый токен
    await db.query(
      'INSERT INTO email_verification_tokens (user_id, token, expires_at, created_at) VALUES (?, ?, ?, NOW())',
      [userId, token, expiresAt]
    );
    
    return token;
  } catch (error) {
    console.error('Error generating verification token:', error);
    throw error;
  }
}

/**
 * Проверка verification token
 * @param {string} token - Токен для проверки
 * @returns {Promise<object|null>} - Возвращает данные токена или null
 */
async function verifyEmailToken(token) {
  try {
    const results = await db.query(
      `SELECT vt.*, u.email, u.first_name, u.last_name 
       FROM email_verification_tokens vt
       JOIN users u ON vt.user_id = u.id
       WHERE vt.token = ? AND vt.expires_at > NOW() AND vt.used = FALSE`,
      [token]
    );
    
    if (results.length === 0) {
      return null;
    }
    
    return results[0];
  } catch (error) {
    console.error('Error verifying token:', error);
    throw error;
  }
}

/**
 * Отметить токен как использованный
 * @param {string} token - Токен
 */
async function markTokenAsUsed(token) {
  try {
    await db.query(
      'UPDATE email_verification_tokens SET used = TRUE, used_at = NOW() WHERE token = ?',
      [token]
    );
  } catch (error) {
    console.error('Error marking token as used:', error);
    throw error;
  }
}

/**
 * Отправка verification email
 * @param {string} email - Email получателя
 * @param {string} name - Имя получателя
 * @param {string} token - Verification token
 * @returns {Promise<boolean>} - Успешность отправки
 */
async function sendVerificationEmail(email, name, token) {
  try {
    const transporter = createTransporter();
    
    // URL для подтверждения (для мобильного приложения используем deep link)
    const verificationUrl = `${process.env.FRONTEND_URL || 'mycloud://auth'}/verify-email?token=${token}`;
    
    const mailOptions = {
      from: `"MyCloud" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Подтверждение регистрации - MyCloud',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Подтверждение Email</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              background-color: #f5f5f5;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              padding: 40px 20px;
              text-align: center;
            }
            .header h1 {
              color: #ffffff;
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .content {
              padding: 40px 30px;
            }
            .greeting {
              font-size: 18px;
              color: #333;
              margin-bottom: 20px;
            }
            .message {
              color: #666;
              font-size: 16px;
              margin-bottom: 30px;
              line-height: 1.8;
            }
            .button-container {
              text-align: center;
              margin: 35px 0;
            }
            .button {
              display: inline-block;
              padding: 16px 40px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: #ffffff !important;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              font-size: 16px;
              transition: transform 0.2s;
            }
            .button:hover {
              transform: translateY(-2px);
            }
            .expiry-notice {
              background: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 15px;
              margin: 25px 0;
              border-radius: 4px;
              font-size: 14px;
              color: #92400e;
            }
            .footer {
              background: #f9fafb;
              padding: 25px;
              text-align: center;
              border-top: 1px solid #e5e7eb;
              font-size: 14px;
              color: #6b7280;
            }
            .footer a {
              color: #667eea;
              text-decoration: none;
            }
            .security-notice {
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              font-size: 13px;
              color: #9ca3af;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✉️ Подтвердите ваш Email</h1>
            </div>
            <div class="content">
              <div class="greeting">
                Здравствуйте, ${name}!
              </div>
              <div class="message">
                Спасибо за регистрацию в <strong>MyCloud</strong>! Чтобы завершить создание аккаунта и получить доступ ко всем возможностям платформы, пожалуйста, подтвердите ваш email адрес.
              </div>
              
              <div class="button-container">
                <a href="${verificationUrl}" class="button">
                  Подтвердить Email
                </a>
              </div>
              
              <div class="expiry-notice">
                <strong>⏰ Важно:</strong> Эта ссылка действительна только в течение <strong>10 минут</strong>. После истечения срока вам потребуется запросить новую ссылку для подтверждения.
              </div>
              
              <div class="message">
                Если кнопка не работает, скопируйте и вставьте следующую ссылку в ваш браузер:
                <br>
                <a href="${verificationUrl}" style="color: #667eea; word-break: break-all;">${verificationUrl}</a>
              </div>
              
              <div class="security-notice">
                <strong>🔒 Безопасность:</strong> Если вы не регистрировались на MyCloud, просто проигнорируйте это письмо. Ваш аккаунт останется в безопасности.
              </div>
            </div>
            <div class="footer">
              <p>
                С уважением,<br>
                Команда <strong>MyCloud</strong>
              </p>
              <p>
                Нужна помощь? <a href="mailto:support@mycloud.uz">Свяжитесь с нами</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Здравствуйте, ${name}!

Спасибо за регистрацию в MyCloud! Чтобы завершить создание аккаунта, пожалуйста, подтвердите ваш email адрес.

Перейдите по ссылке для подтверждения:
${verificationUrl}

⏰ Важно: Эта ссылка действительна только в течение 10 минут.

🔒 Безопасность: Если вы не регистрировались на MyCloud, просто проигнорируйте это письмо.

С уважением,
Команда MyCloud

Нужна помощь? Свяжитесь с нами: support@mycloud.uz
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Verification email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending verification email:', error);
    return false;
  }
}

/**
 * Подтверждение email пользователя
 * @param {string} token - Verification token
 * @returns {Promise<object>} - Результат подтверждения
 */
async function confirmEmail(token) {
  try {
    // Проверяем токен
    const tokenData = await verifyEmailToken(token);
    
    if (!tokenData) {
      return {
        success: false,
        error: 'Токен недействителен или истёк'
      };
    }
    
    // Обновляем статус пользователя
    await db.query(
      'UPDATE users SET email_verified = TRUE, verified_at = NOW(), status = "active" WHERE id = ?',
      [tokenData.user_id]
    );
    
    // Отмечаем токен как использованный
    await markTokenAsUsed(token);
    
    return {
      success: true,
      email: tokenData.email,
      name: `${tokenData.first_name} ${tokenData.last_name}`.trim()
    };
  } catch (error) {
    console.error('Error confirming email:', error);
    return {
      success: false,
      error: 'Ошибка при подтверждении email'
    };
  }
}

module.exports = {
  generateVerificationToken,
  verifyEmailToken,
  sendVerificationEmail,
  confirmEmail,
  markTokenAsUsed
};

