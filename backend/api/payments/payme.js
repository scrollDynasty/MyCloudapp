const express = require('express');
const db = require('../../core/db/connection');
const SQL = require('../../core/db/queries');
const PaymeHelper = require('../../core/utils/payme-helper');
const { authenticate } = require('../../core/utils/auth');

const router = express.Router();
const payme = new PaymeHelper();

/**
 * Logger for Payme requests/responses
 */
function logPayme(type, method, data) {
  const timestamp = new Date().toISOString();
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[${timestamp}] 💳 PAYME ${type.toUpperCase()}: ${method}`);
  console.log(JSON.stringify(data, null, 2));
  console.log('='.repeat(80));
}

// POST /api/payments/payme - Create Payme payment (Authenticated users only)
router.post('/payme', authenticate, async (req, res) => {
  try {
    await db.connect();
    
    const { order_id, return_url } = req.body;

    // Validate input
    if (!order_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: order_id'
      });
    }

    // Get order details
    const orderQuery = `
      SELECT 
        o.*,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        vp.name as plan_name,
        p.name as provider_name
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN vps_plans vp ON o.vps_plan_id = vp.id
      JOIN providers p ON vp.provider_id = p.id
      WHERE o.id = ?
    `;

    const orders = await db.query(orderQuery, [order_id]);

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orders[0];

    // Check if order belongs to user (or user is admin)
    if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You can only create payments for your own orders'
      });
    }

    // Check if order is already paid
    if (order.payment_status === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Order is already paid'
      });
    }

    // Получаем сумму в UZS (узбекских сумах)
    let amountInUzs = order.amount;

    // Валидация суммы для Payme
    const amountInTiyin = Math.round(amountInUzs * 100);
    const MIN_AMOUNT_TIYIN = 100; // Минимум 1 UZS
    const MAX_AMOUNT_TIYIN = 99999999999; // Максимум ~1 млрд UZS
    
    if (amountInTiyin < MIN_AMOUNT_TIYIN) {
      return res.status(400).json({
        success: false,
        error: 'Amount too small',
        message: `Minimum amount is 1 UZS (got ${amountInUzs} UZS)`
      });
    }
    
    if (amountInTiyin > MAX_AMOUNT_TIYIN) {
      return res.status(400).json({
        success: false,
        error: 'Amount too large',
        message: `Maximum amount is 999,999,999 UZS (got ${amountInUzs} UZS)`
      });
    }


    // Return URL handling
    // IMPORTANT: Return URL must be configured in PayMe merchant dashboard
    // If not configured, set PAYME_USE_RETURN_URL=false in .env to avoid errors
    let validReturnUrl = null;
    
    // Check if return URL is enabled in environment
    const useReturnUrl = process.env.PAYME_USE_RETURN_URL !== 'false';
    
    if (useReturnUrl) {
      // Only use return URL if it's a valid production URL
      if (return_url && !return_url.includes('localhost')) {
        validReturnUrl = return_url;
      } else {
        // Use environment variable for production return URL
        validReturnUrl = process.env.RETURN_URL || null;
      }
    } else {
      console.log('⚠️  Return URL disabled via PAYME_USE_RETURN_URL=false');
      validReturnUrl = null;
    }

    // Валидация Merchant ID
    const merchantId = process.env.PAYME_MERCHANT_ID;
    if (!merchantId || merchantId.length !== 24) {
      console.error('❌ Invalid PAYME_MERCHANT_ID:', merchantId);
      return res.status(500).json({
        success: false,
        error: 'Payment system configuration error',
        message: 'Merchant ID is not properly configured'
      });
    }

    // Валидация order_id (должен быть положительным числом)
    const orderIdNum = parseInt(order_id, 10);
    if (isNaN(orderIdNum) || orderIdNum <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order_id',
        message: 'Order ID must be a positive number'
      });
    }


    // Log payment request details
    console.log('💳 Creating Payme payment:');
    console.log(`   Order ID: ${order_id}`);
    console.log(`   Amount: ${amountInUzs} UZS (${amountInTiyin} tiyin)`);
    console.log(`   Currency: ${order.currency}`);
    console.log(`   Return URL: ${validReturnUrl || 'not provided'}`);
    console.log(`   Merchant ID: ${merchantId}`);

    // Generate Payme checkout URL
    const checkoutUrl = payme.createCheckoutUrl(
      order_id,
      amountInUzs,
      validReturnUrl
    );

    console.log('✅ Checkout URL created successfully');

    // Генерируем также альтернативные URL для отладки
    const alternativeUrls = payme.generateAlternativeCheckoutUrls(order_id, amountInUzs);

    // Update order
    await db.query(
      'UPDATE orders SET payment_method = ?, updated_at = NOW() WHERE id = ?',
      ['payme', order_id]
    );

    res.json({
      success: true,
      data: {
        order_id: order.id,
        checkout_url: checkoutUrl,
        alternative_urls: alternativeUrls, // Альтернативные форматы для тестирования
        amount: parseFloat(order.amount),
        currency: order.currency,
        order_details: {
          plan: `${order.provider_name} ${order.plan_name}`,
          customer: `${order.first_name} ${order.last_name}`,
          email: order.email
        },
        instructions: {
          step_1: 'Redirect user to checkout_url',
          step_2: 'User completes payment on Payme',
          step_3: 'Payme will call our callback endpoint',
          step_4: 'Order status will be updated automatically',
          troubleshooting: 'If you see "[object Object]" error, try alternative_urls'
        },
        debug: {
          merchant_id: merchantId,
          amount_tiyin: amountInTiyin,
          return_url: validReturnUrl,
          note: 'Если ошибка "[object Object]" - Merchant ID не активирован или account поля не настроены'
        }
      }
    });

  } catch (error) {
    console.error('Payme Payment Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create Payme payment',
      message: error.message
    });
  }
});

// POST /api/payments/payme/callback - Payme merchant API callback
router.post('/payme/callback', async (req, res) => {
  try {
    logPayme('request', req.body.method, req.body);

    // Verify Payme signature
    if (!payme.verifySignature(req)) {
      const errorResponse = {
        error: {
          code: PaymeHelper.ERRORS.INSUFFICIENT_PRIVILEGE,
          message: {
            ru: 'Недостаточно привилегий для выполнения метода',
            uz: 'Usul bajarish uchun yetarli huquq yo\'q',
            en: 'Insufficient privilege to perform this method'
          }
        }
      };
      logPayme('response', req.body.method, errorResponse);
      return res.json(errorResponse);
    }

    await db.connect();
    
    const { method, params, id: requestId } = req.body;
    let response;

    switch (method) {
      case 'CheckPerformTransaction':
        response = await handleCheckPerformTransaction(params);
        break;

      case 'CreateTransaction':
        response = await handleCreateTransaction(params);
        break;

      case 'PerformTransaction':
        response = await handlePerformTransaction(params);
        break;

      case 'CancelTransaction':
        response = await handleCancelTransaction(params);
        break;

      case 'CheckTransaction':
        response = await handleCheckTransaction(params);
        break;

      case 'GetStatement':
        response = await handleGetStatement(params);
        break;

      default:
        response = {
          error: {
            code: PaymeHelper.ERRORS.METHOD_NOT_FOUND,
            message: {
              ru: 'Метод не найден',
              uz: 'Usul topilmadi',
              en: 'Method not found'
            }
          }
        };
    }

    // Add request ID to response
    if (requestId) {
      response.id = requestId;
    }

    logPayme('response', method, response);
    res.json(response);

  } catch (error) {
    console.error('Payme Callback Error:', error);
    const errorResponse = {
      error: {
        code: PaymeHelper.ERRORS.SYSTEM_ERROR,
        message: {
          ru: 'Внутренняя ошибка сервера',
          uz: 'Ichki server xatosi',
          en: 'Internal server error'
        },
        data: error.message
      }
    };
    logPayme('error', req.body?.method || 'unknown', errorResponse);
    res.json(errorResponse);
  }
});

/**
 * CheckPerformTransaction - Check if transaction can be performed
 * This method MUST NOT create any records, only validate
 */
async function handleCheckPerformTransaction(params) {
  const { account, amount } = params;
  const orderId = account.order_id;

  // 1. Check if order exists
  const orders = await db.query(
    'SELECT id, user_id, amount, currency, payment_status, status FROM orders WHERE id = ?',
    [orderId]
  );
  
  if (orders.length === 0) {
    return {
      error: {
        code: PaymeHelper.ERRORS.ORDER_NOT_FOUND,
        message: {
          ru: 'Заказ не найден',
          uz: 'Buyurtma topilmadi',
          en: 'Order not found'
        },
        data: 'order_id'
      }
    };
  }

  const order = orders[0];

  // 2. Check if user exists
  const users = await db.query(
    'SELECT id, status FROM users WHERE id = ?',
    [order.user_id]
  );

  if (users.length === 0) {
    return {
      error: {
        code: PaymeHelper.ERRORS.USER_NOT_FOUND,
        message: {
          ru: 'Пользователь не найден',
          uz: 'Foydalanuvchi topilmadi',
          en: 'User not found'
        },
        data: 'user_id'
      }
    };
  }

  // 3. Check if order is already paid
  if (order.payment_status === 'paid') {
    return {
      error: {
        code: PaymeHelper.ERRORS.ORDER_ALREADY_PAID,
        message: {
          ru: 'Заказ уже оплачен',
          uz: 'Buyurtma allaqachon to\'langan',
          en: 'Order is already paid'
        },
        data: 'order_id'
      }
    };
  }

  // 4. Validate amount
  const expectedAmount = payme.toTiyin(order.amount);
  if (amount !== expectedAmount) {
    return {
      error: {
        code: PaymeHelper.ERRORS.INVALID_AMOUNT,
        message: {
          ru: `Неверная сумма. Ожидается ${expectedAmount}, получено ${amount}`,
          uz: `Noto'g'ri summa. Kutilgan ${expectedAmount}, olindi ${amount}`,
          en: `Invalid amount. Expected ${expectedAmount}, got ${amount}`
        },
        data: 'amount'
      }
    };
  }

  // 5. Check if amount is positive
  if (amount <= 0) {
    return {
      error: {
        code: PaymeHelper.ERRORS.INVALID_AMOUNT,
        message: {
          ru: 'Сумма должна быть больше нуля',
          uz: 'Summa noldan katta bo\'lishi kerak',
          en: 'Amount must be greater than zero'
        },
        data: 'amount'
      }
    };
  }

  // 6. Check database connection (system availability)
  try {
    await db.query('SELECT 1');
  } catch (error) {
    return {
      error: {
        code: PaymeHelper.ERRORS.SYSTEM_ERROR,
        message: {
          ru: 'Система временно недоступна',
          uz: 'Tizim vaqtincha mavjud emas',
          en: 'System temporarily unavailable'
        },
        data: 'database'
      }
    };
  }

  // All checks passed - return success with optional additional info
  return {
    result: {
      allow: true,
      additional: {
        order_id: order.id,
        order_status: order.status,
        amount: payme.fromTiyin(amount),
        currency: order.currency
      }
    }
  };
}

/**
 * CreateTransaction - Create transaction record
 * Must be idempotent - return existing transaction if already created
 */
async function handleCreateTransaction(params) {
  const { id: transactionId, time: paymeTime, amount, account } = params;
  const orderId = account.order_id;
  const createTime = Date.now();

  // 1. Check idempotency - if transaction already exists, return it
  const existingTx = await db.query(
    'SELECT * FROM payme_transactions WHERE payme_transaction_id = ?',
    [transactionId]
  );

  if (existingTx.length > 0) {
    const tx = existingTx[0];
    
    // Verify that parameters match
    if (tx.amount !== amount || JSON.parse(tx.account).order_id !== orderId) {
      return {
        error: {
          code: PaymeHelper.ERRORS.INVALID_AMOUNT,
          message: {
            ru: 'Параметры транзакции не совпадают с существующей',
            uz: 'Tranzaksiya parametrlari mavjud bilan mos kelmaydi',
            en: 'Transaction parameters do not match existing one'
          }
        }
      };
    }

    // Return existing transaction
    return {
      result: {
        create_time: tx.create_time,
        transaction: tx.transaction,
        state: tx.state
      }
    };
  }

  // 2. Validate order exists and available
  const orders = await db.query(
    'SELECT id, amount, payment_status, status FROM orders WHERE id = ?',
    [orderId]
  );

  if (orders.length === 0) {
    return {
      error: {
        code: PaymeHelper.ERRORS.ORDER_NOT_FOUND,
        message: {
          ru: 'Заказ не найден',
          uz: 'Buyurtma topilmadi',
          en: 'Order not found'
        },
        data: 'order_id'
      }
    };
  }

  const order = orders[0];

  if (order.payment_status === 'paid') {
    return {
      error: {
        code: PaymeHelper.ERRORS.ORDER_ALREADY_PAID,
        message: {
          ru: 'Заказ уже оплачен',
          uz: 'Buyurtma allaqachon to\'langan',
          en: 'Order is already paid'
        }
      }
    };
  }

  // 3. Validate amount
  const expectedAmount = payme.toTiyin(order.amount);
  if (amount !== expectedAmount) {
    return {
      error: {
        code: PaymeHelper.ERRORS.INVALID_AMOUNT,
        message: {
          ru: `Неверная сумма. Ожидается ${expectedAmount}, получено ${amount}`,
          uz: `Noto'g'ri summa. Kutilgan ${expectedAmount}, olindi ${amount}`,
          en: `Invalid amount. Expected ${expectedAmount}, got ${amount}`
        }
      }
    };
  }

  // 4. Create transaction record in payme_transactions table
  const internalTxId = `${orderId}-${Date.now()}`;
  
  await db.query(`
    INSERT INTO payme_transactions (
      payme_transaction_id,
      payme_time,
      amount,
      account,
      create_time,
      state,
      transaction,
      order_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    transactionId,
    paymeTime,
    amount,
    JSON.stringify(account),
    createTime,
    PaymeHelper.STATES.CREATED,
    internalTxId,
    orderId
  ]);

  // 5. Update order - reserve it (set to pending payment)
  await db.query(`
    UPDATE orders 
    SET payment_status = 'pending',
        payment_method = 'payme',
        payme_transaction_id = ?,
        payme_transaction_time = ?,
        payme_state = ?,
        updated_at = NOW()
    WHERE id = ?
  `, [transactionId, paymeTime, PaymeHelper.STATES.CREATED, orderId]);

  // 6. Return success response
  return {
    result: {
      create_time: createTime,
      transaction: internalTxId,
      state: PaymeHelper.STATES.CREATED
    }
  };
}

/**
 * PerformTransaction - Complete the transaction (payment confirmed)
 */
async function handlePerformTransaction(params) {
  const { id: transactionId } = params;
  const performTime = Date.now();

  // 1. Find transaction
  const transactions = await db.query(
    'SELECT * FROM payme_transactions WHERE payme_transaction_id = ?',
    [transactionId]
  );

  if (transactions.length === 0) {
    return {
      error: {
        code: PaymeHelper.ERRORS.TRANSACTION_NOT_FOUND,
        message: {
          ru: 'Транзакция не найдена',
          uz: 'Tranzaksiya topilmadi',
          en: 'Transaction not found'
        }
      }
    };
  }

  const tx = transactions[0];

  // 2. Check if transaction is in correct state
  if (tx.state !== PaymeHelper.STATES.CREATED) {
    // If already performed, return existing data
    if (tx.state === PaymeHelper.STATES.COMPLETED) {
      return {
        result: {
          transaction: tx.transaction,
          perform_time: tx.perform_time,
          state: tx.state
        }
      };
    }

    // Cannot perform cancelled transaction
    return {
      error: {
        code: PaymeHelper.ERRORS.COULD_NOT_PERFORM,
        message: {
          ru: 'Невозможно выполнить транзакцию',
          uz: 'Tranzaksiyani bajarish mumkin emas',
          en: 'Could not perform transaction'
        }
      }
    };
  }

  // 3. Update transaction state
  await db.query(`
    UPDATE payme_transactions
    SET state = ?,
        perform_time = ?,
        updated_at = NOW()
    WHERE payme_transaction_id = ?
  `, [PaymeHelper.STATES.COMPLETED, performTime, transactionId]);

  // 4. Update order - mark as PAID and ACTIVE
  await db.query(`
    UPDATE orders 
    SET status = 'active',
        payment_status = 'paid',
        payme_state = ?,
        payme_perform_time = ?,
        paid_at = NOW(),
        activated_at = NOW(),
        updated_at = NOW()
    WHERE payme_transaction_id = ?
  `, [PaymeHelper.STATES.COMPLETED, performTime, transactionId]);

  // 5. Return success response
  return {
    result: {
      transaction: tx.transaction,
      perform_time: performTime,
      state: PaymeHelper.STATES.COMPLETED
    }
  };
}

/**
 * CancelTransaction - Cancel the transaction
 */
async function handleCancelTransaction(params) {
  const { id: transactionId, reason } = params;
  const cancelTime = Date.now();

  // 1. Find transaction
  const transactions = await db.query(
    'SELECT * FROM payme_transactions WHERE payme_transaction_id = ?',
    [transactionId]
  );

  if (transactions.length === 0) {
    return {
      error: {
        code: PaymeHelper.ERRORS.TRANSACTION_NOT_FOUND,
        message: {
          ru: 'Транзакция не найдена',
          uz: 'Tranzaksiya topilmadi',
          en: 'Transaction not found'
        }
      }
    };
  }

  const tx = transactions[0];

  // 2. Determine new state based on current state
  let newState;
  if (tx.state === PaymeHelper.STATES.CREATED) {
    // Cancelled before payment
    newState = PaymeHelper.STATES.CANCELLED;
  } else if (tx.state === PaymeHelper.STATES.COMPLETED) {
    // Cancelled after payment (refund)
    newState = PaymeHelper.STATES.CANCELLED_AFTER_COMPLETE;
  } else {
    // Already cancelled
    return {
      result: {
        transaction: tx.transaction,
        cancel_time: tx.cancel_time,
        state: tx.state
      }
    };
  }

  // 3. Update transaction
  await db.query(`
    UPDATE payme_transactions
    SET state = ?,
        cancel_time = ?,
        reason = ?,
        updated_at = NOW()
    WHERE payme_transaction_id = ?
  `, [newState, cancelTime, reason, transactionId]);

  // 4. Update order
  await db.query(`
    UPDATE orders 
    SET status = 'cancelled',
        payment_status = 'cancelled',
        payme_state = ?,
        payme_cancel_time = ?,
        payme_cancel_reason = ?,
        updated_at = NOW()
    WHERE payme_transaction_id = ?
  `, [newState, cancelTime, reason, transactionId]);

  // 5. Return success response
  return {
    result: {
      transaction: tx.transaction,
      cancel_time: cancelTime,
      state: newState
    }
  };
}

/**
 * CheckTransaction - Check transaction status
 */
async function handleCheckTransaction(params) {
  const { id: transactionId } = params;

  // Find transaction
  const transactions = await db.query(
    'SELECT * FROM payme_transactions WHERE payme_transaction_id = ?',
    [transactionId]
  );

  if (transactions.length === 0) {
    return {
      error: {
        code: PaymeHelper.ERRORS.TRANSACTION_NOT_FOUND,
        message: {
          ru: 'Транзакция не найдена',
          uz: 'Tranzaksiya topilmadi',
          en: 'Transaction not found'
        }
      }
    };
  }

  const tx = transactions[0];

  return {
    result: {
      create_time: tx.create_time,
      perform_time: tx.perform_time || 0,
      cancel_time: tx.cancel_time || 0,
      transaction: tx.transaction,
      state: tx.state,
      reason: tx.reason || null
    }
  };
}

/**
 * GetStatement - Get list of transactions for a period
 */
async function handleGetStatement(params) {
  const { from, to } = params;
  
  const transactions = await db.query(`
    SELECT * FROM payme_transactions
    WHERE create_time >= ? AND create_time <= ?
    ORDER BY create_time DESC
  `, [from, to]);

  const statement = transactions.map(tx => ({
    id: tx.payme_transaction_id,
    time: tx.payme_time,
    amount: tx.amount,
    account: JSON.parse(tx.account),
    create_time: tx.create_time,
    perform_time: tx.perform_time || 0,
    cancel_time: tx.cancel_time || 0,
    transaction: tx.transaction,
    state: tx.state,
    reason: tx.reason || null
  }));

  return {
    result: {
      transactions: statement
    }
  };
}

// GET /api/payments/payme/test-urls/:order_id - Generate test checkout URLs (Development only)
router.get('/payme/test-urls/:order_id', authenticate, async (req, res) => {
  try {
    const { order_id } = req.params;
    
    await db.connect();
    
    // Get order to get amount
    const orders = await db.query('SELECT amount FROM orders WHERE id = ?', [order_id]);
    
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    const order = orders[0];
    const amount = parseFloat(order.amount);
    
    // Generate all test URLs
    const urls = {
      standard: payme.createCheckoutUrl(order_id, amount),
      account: payme.createCheckoutUrlAlternative(order_id, amount, 'account'),
      id: payme.createCheckoutUrlAlternative(order_id, amount, 'id'),
      order: payme.createCheckoutUrlAlternative(order_id, amount, 'order'),
      orderId: payme.createCheckoutUrlAlternative(order_id, amount, 'orderId')
    };
    
    res.json({
      success: true,
      message: 'Test URLs generated. Try each URL in browser to find working format.',
      data: {
        order_id: order_id,
        amount: amount,
        urls: urls,
        instructions: {
          step_1: 'Open each URL in browser',
          step_2: 'If you see payment form - format is correct!',
          step_3: 'If you see error "[object Object]" - try next URL',
          step_4: 'Remember which format works and use it in code'
        },
        troubleshooting: {
          merchant_id: process.env.PAYME_MERCHANT_ID,
          issue: 'If all URLs show error, Merchant ID is not activated',
          solution: 'Contact Payme support: @payme_support or support@paycom.uz'
        }
      }
    });
    
  } catch (error) {
    console.error('Test URLs Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate test URLs',
      message: error.message
    });
  }
});

// GET /api/payments/payme/status/:order_id - Check payment status (Authenticated)
router.get('/payme/status/:order_id', authenticate, async (req, res) => {
  try {
    await db.connect();
    
    const { order_id } = req.params;

    const orders = await db.query(
      `SELECT 
        o.id,
        o.user_id,
        o.status,
        o.payment_status,
        o.payment_id,
        o.amount,
        o.currency,
        o.payme_transaction_id,
        o.paid_at,
        o.updated_at
      FROM orders o
      WHERE o.id = ?`,
      [order_id]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orders[0];

    // Check if order belongs to user (or user is admin)
    if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: {
        order_id: order.id,
        order_status: order.status,
        payment_status: order.payment_status,
        payme_transaction_id: order.payme_transaction_id,
        amount: parseFloat(order.amount),
        currency: order.currency,
        paid_at: order.paid_at,
        updated_at: order.updated_at
      }
    });

  } catch (error) {
    console.error('Payment Status Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check payment status',
      message: error.message
    });
  }
});

module.exports = router;