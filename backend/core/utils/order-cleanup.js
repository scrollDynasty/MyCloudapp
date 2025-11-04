const db = require('../db/connection');
const { logger } = require('./logger');

/**
 * Очистка неоплаченных заказов старше 10 минут
 * Удаляет заказы со статусом 'pending' и payment_status 'pending' или NULL,
 * которые были созданы более 10 минут назад
 */
async function cleanupExpiredOrders() {
  try {
    await db.connect();
    
    // Удаляем заказы со статусом 'pending' и payment_status 'pending' или NULL,
    // которые были созданы более 10 минут назад
    const result = await db.query(`
      DELETE FROM orders 
      WHERE status = 'pending' 
        AND (payment_status IS NULL OR payment_status = 'pending')
        AND created_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
    `);
    
    if (result.affectedRows > 0) {
      logger.info(`Cleaned up ${result.affectedRows} expired pending orders`);
    }
    
    return result.affectedRows;
  } catch (error) {
    logger.error('Error cleaning up expired orders:', error);
    throw error;
  }
}

/**
 * Запуск периодической очистки неоплаченных заказов
 * Проверяет каждую минуту и удаляет заказы старше 10 минут
 */
function startOrderCleanupJob() {
  // Запускаем сразу при старте
  cleanupExpiredOrders().catch(err => {
    logger.error('Failed to run initial order cleanup:', err);
  });
  
  // Затем запускаем каждую минуту
  const interval = setInterval(() => {
    cleanupExpiredOrders().catch(err => {
      logger.error('Failed to run periodic order cleanup:', err);
    });
  }, 60000); // 60 секунд = 1 минута
  
  logger.info('Order cleanup job started - will clean expired orders every minute');
  
  // Возвращаем функцию для остановки (если нужно)
  return () => clearInterval(interval);
}

module.exports = {
  cleanupExpiredOrders,
  startOrderCleanupJob
};

