const db = require('../db/connection');
const { logger } = require('./logger');
const PaymeHelper = require('./payme-helper');

const paymeClient = new PaymeHelper();

/**
 * Автоматически отменяет неоплаченные заказы старше 1 часа
 * Переводит заказы и связанные Payme транзакции в статус 'cancelled'
 */
async function cleanupExpiredOrders() {
  const cancelTime = Date.now();
  const timeoutReason = PaymeHelper.CANCEL_REASONS.TIMEOUT;

  try {
    await db.connect();

    // Находим просроченные заказы, которые ещё ожидают оплату
    const expiredOrders = await db.query(`
      SELECT id, payme_transaction_id
      FROM orders
      WHERE status = 'pending'
        AND (payment_status IS NULL OR payment_status = 'pending')
        AND created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `);

    if (!Array.isArray(expiredOrders) || expiredOrders.length === 0) {
      return 0;
    }

    const orderIds = expiredOrders.map(order => order.id);
    const paymeTransactionIds = expiredOrders
      .map(order => order.payme_transaction_id)
      .filter(Boolean);

    // Отменяем связанные Payme транзакции через Merchant API
    if (paymeTransactionIds.length > 0) {
      for (const transactionId of paymeTransactionIds) {
        try {
          if (paymeClient.isConfigured()) {
            await paymeClient.cancelTransaction(transactionId, timeoutReason);
            logger.info(`Cancelled Payme transaction ${transactionId} via merchant API (timeout)`);
          } else {
            logger.warn('Payme merchant credentials are not configured. Skipping remote cancellation.');
            break;
          }
        } catch (error) {
          logger.warn(`Failed to cancel Payme transaction ${transactionId}: ${error.message}`);
        }
      }

      const placeholders = paymeTransactionIds.map(() => '?').join(',');
      await db.query(`
        UPDATE payme_transactions
        SET state = ?,
            cancel_time = ?,
            reason = ?,
            updated_at = NOW()
        WHERE payme_transaction_id IN (${placeholders})
          AND state = ?
      `, [
        PaymeHelper.STATES.CANCELLED,
        cancelTime,
        timeoutReason,
        ...paymeTransactionIds,
        PaymeHelper.STATES.CREATED
      ]);
    }

    // Обновляем сами заказы, переводя их в отменённое состояние
    const placeholders = orderIds.map(() => '?').join(',');
    const result = await db.query(`
      UPDATE orders
      SET status = 'cancelled',
          payment_status = 'cancelled',
          payme_state = CASE
            WHEN payme_transaction_id IS NOT NULL THEN ?
            ELSE payme_state
          END,
          payme_cancel_time = CASE
            WHEN payme_transaction_id IS NOT NULL THEN ?
            ELSE payme_cancel_time
          END,
          payme_cancel_reason = CASE
            WHEN payme_transaction_id IS NOT NULL THEN ?
            ELSE payme_cancel_reason
          END,
          updated_at = NOW()
      WHERE id IN (${placeholders})
    `, [
      PaymeHelper.STATES.CANCELLED,
      cancelTime,
      timeoutReason,
      ...orderIds
    ]);

    if (result.affectedRows > 0) {
      logger.info(`Cancelled ${result.affectedRows} unpaid orders that exceeded 1 hour timeout`);
    }

    return result.affectedRows;
  } catch (error) {
    logger.error('Error cleaning up expired orders:', error);
    throw error;
  }
}

/**
 * Запуск периодической очистки неоплаченных заказов
 * Проверяет каждую минуту и отменяет заказы, ожидающие оплату более часа
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

  logger.info('Order cleanup job started - will cancel unpaid orders after 1 hour');

  // Возвращаем функцию для остановки (если нужно)
  return () => clearInterval(interval);
}

module.exports = {
  cleanupExpiredOrders,
  startOrderCleanupJob
};

