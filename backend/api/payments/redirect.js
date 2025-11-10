const express = require('express');
const router = express.Router();

/**
 * GET /payment-success
 * 
 * Страница успешной оплаты.
 * Payme перенаправляет сюда после успешного платежа.
 * 
 * Показывает сообщение пользователю и перенаправляет в приложение.
 */
router.get('/payment-success', async (req, res) => {
  const { order_id, card_token, card_last4 } = req.query;
  
  // HTML страница с автоматическим редиректом
  const html = `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Платёж успешен</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }
        
        .container {
          background: white;
          border-radius: 20px;
          padding: 40px;
          max-width: 500px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          text-align: center;
          animation: slideUp 0.5s ease-out;
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(50px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .checkmark {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: #4CAF50;
          margin: 0 auto 30px;
          position: relative;
          animation: scaleIn 0.5s ease-out 0.2s both;
        }
        
        @keyframes scaleIn {
          from {
            transform: scale(0);
          }
          to {
            transform: scale(1);
          }
        }
        
        .checkmark::after {
          content: '';
          position: absolute;
          width: 20px;
          height: 40px;
          border: solid white;
          border-width: 0 4px 4px 0;
          transform: rotate(45deg);
          top: 15px;
          left: 30px;
        }
        
        h1 {
          color: #333;
          font-size: 28px;
          margin-bottom: 15px;
        }
        
        p {
          color: #666;
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 20px;
        }
        
        .order-info {
          background: #f5f5f5;
          border-radius: 10px;
          padding: 20px;
          margin: 20px 0;
        }
        
        .order-info strong {
          color: #667eea;
          font-size: 18px;
        }
        
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 15px 40px;
          border-radius: 25px;
          text-decoration: none;
          font-size: 16px;
          font-weight: 600;
          margin-top: 20px;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
        }
        
        .redirect-info {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          color: #999;
          font-size: 14px;
        }
        
        .spinner {
          display: inline-block;
          width: 20px;
          height: 20px;
          border: 3px solid rgba(102, 126, 234, 0.3);
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-left: 10px;
          vertical-align: middle;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="checkmark"></div>
        <h1>🎉 Платёж успешен!</h1>
        <p>Ваш платёж был успешно обработан через Payme.</p>
        
        ${order_id ? `
          <div class="order-info">
            <p>Заказ <strong>#${order_id}</strong> оплачен</p>
          </div>
        ` : ''}
        
        <p>Спасибо за ваш заказ! Мы начнём обработку вашего VPS сервера.</p>
        
        <a href="${process.env.FRONTEND_URL || 'http://localhost:8081'}/(user)/orders" class="button">
          Вернуться к заказам
        </a>
        
        <div class="redirect-info">
          <p>Вы будете автоматически перенаправлены через <span id="countdown">3</span> секунд
            <span class="spinner"></span>
          </p>
        </div>
      </div>
      
      <script>
        // Обратный отсчёт
        let seconds = 3;
        const countdownEl = document.getElementById('countdown');
        
        // Определяем мобильное устройство
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const isExpoGo = /Expo/i.test(navigator.userAgent);
        
        // URL для редиректа
        const params = new URLSearchParams({
          ${order_id ? `order_id: '${order_id}',` : ''}
          ${card_token ? `card_token: '${card_token}',` : ''}
          ${card_last4 ? `card_last4: '${card_last4}'` : ''}
        }).toString();
        
        const webUrl = '${process.env.FRONTEND_URL || 'http://localhost:8081'}/(user)/payment-success?' + params;
        const deepLink = 'exp://192.168.1.100:8081/--/(user)/payment-success?' + params; // Для Expo Go
        const customScheme = 'mycloud://payment-success?' + params; // Для production app
        
        // Для мобильных - пробуем открыть deep link немедленно
        if (isMobile) {
          // Попытка #1: Custom scheme (production)
          window.location.href = customScheme;
          
          // Попытка #2: Expo deep link (development)
          setTimeout(() => {
            window.location.href = deepLink;
          }, 500);
          
          // Попытка #3: Universal link (fallback)
          setTimeout(() => {
            window.location.href = webUrl;
          }, 1500);
        }
        
        const timer = setInterval(() => {
          seconds--;
          countdownEl.textContent = seconds;
          
          if (seconds <= 0) {
            clearInterval(timer);
            // Перенаправление
            if (isMobile) {
              // Для мобильных - финальная попытка
              window.location.href = customScheme;
              setTimeout(() => {
                window.location.href = deepLink;
              }, 500);
            } else {
              // Для веба
              window.location.href = webUrl;
            }
          }
        }, 1000);
      </script>
    </body>
    </html>
  `;
  
  res.send(html);
});

/**
 * GET /payment-cancel
 * 
 * Страница отмены платежа.
 * Payme перенаправляет сюда если пользователь отменил платёж.
 */
router.get('/payment-cancel', async (req, res) => {
  const { order_id } = req.query;
  
  const html = `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Платёж отменён</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }
        
        .container {
          background: white;
          border-radius: 20px;
          padding: 40px;
          max-width: 500px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          text-align: center;
        }
        
        .icon {
          font-size: 64px;
          margin-bottom: 20px;
        }
        
        h1 {
          color: #333;
          font-size: 28px;
          margin-bottom: 15px;
        }
        
        p {
          color: #666;
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 20px;
        }
        
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 15px 40px;
          border-radius: 25px;
          text-decoration: none;
          font-size: 16px;
          font-weight: 600;
          margin: 10px;
          transition: transform 0.2s;
        }
        
        .button:hover {
          transform: translateY(-2px);
        }
        
        .button-secondary {
          background: #f5f5f5;
          color: #333;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">❌</div>
        <h1>Платёж отменён</h1>
        <p>Ваш платёж не был завершён. Заказ остаётся в статусе ожидания оплаты.</p>
        
        ${order_id ? `<p>Заказ <strong>#${order_id}</strong></p>` : ''}
        
        <a href="${process.env.FRONTEND_URL || 'http://localhost:8081'}/(user)/checkout/${order_id || ''}" class="button">
          Попробовать снова
        </a>
        
        <a href="${process.env.FRONTEND_URL || 'http://localhost:8081'}/(user)/orders" class="button button-secondary">
          Вернуться к заказам
        </a>
      </div>
    </body>
    </html>
  `;
  
  res.send(html);
});

module.exports = router;
