const express = require('express');
const db = require('../../core/db/connection');
const SQL = require('../../core/db/queries');
const PaymeHelper = require('../../core/utils/payme-helper');
const { authenticate } = require('../../core/utils/auth');

const router = express.Router();
const payme = new PaymeHelper();

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
        vp.plan_name,
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

    // Payme only accepts UZS - convert if needed
    let amountInUzs = order.amount;
    if (order.currency !== 'UZS') {
      // If currency is USD, convert to UZS (approximate rate: 1 USD = 12,500 UZS)
      const USD_TO_UZS_RATE = 12500;
      amountInUzs = order.amount * USD_TO_UZS_RATE;
    }

    // For development: Use a valid public URL or leave empty
    // Payme REJECTS localhost URLs
    let validReturnUrl = return_url;
    
    // If return_url is localhost, use a placeholder or your actual domain
    if (return_url && return_url.includes('localhost')) {
      validReturnUrl = process.env.RETURN_URL || 'https://myapp.uz/orders';
    }

    // Generate Payme checkout URL
    const checkoutUrl = payme.createCheckoutUrl(
      order_id,
      amountInUzs,
      validReturnUrl
    );

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
          step_4: 'Order status will be updated automatically'
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
    // Verify Payme signature
    if (!payme.verifySignature(req)) {
      return res.json({
        error: {
          code: -32504,
          message: 'Insufficient privilege to perform this method'
        }
      });
    }

    await db.connect();
    
    const { method, params } = req.body;
    const { id: transactionId } = params;

    switch (method) {
      case 'CheckPerformTransaction':
        // Check if transaction can be performed
        const { account } = params;
        const orderId = account.order_id;
        const amount = params.amount;

        const orderExists = await db.query(
          'SELECT id, amount, currency, payment_status FROM orders WHERE id = ?',
          [orderId]
        );
        
        if (orderExists.length === 0) {
          return res.json({
            error: {
              code: PaymeHelper.ERRORS.INVALID_ACCOUNT,
              message: 'Order not found'
            }
          });
        }

        const order = orderExists[0];

        // Check amount
        const expectedAmount = payme.toTiyin(order.amount);
        if (amount !== expectedAmount) {
          return res.json({
            error: {
              code: PaymeHelper.ERRORS.INVALID_AMOUNT,
              message: `Invalid amount. Expected ${expectedAmount}, got ${amount}`
            }
          });
        }

        if (order.payment_status === 'paid') {
          return res.json({
            error: {
              code: PaymeHelper.ERRORS.COULD_NOT_PERFORM,
              message: 'Order is already paid'
            }
          });
        }

        res.json({ 
          result: { 
            allow: true 
          } 
        });
        break;

      case 'CreateTransaction':
        // Create transaction record
        const createAccount = params.account;
        const createOrderId = createAccount.order_id;
        const createTime = params.time;
        
        // Check if transaction already exists
        const existing = await db.query(
          'SELECT id FROM orders WHERE payme_transaction_id = ?',
          [transactionId]
        );

        if (existing.length > 0) {
          // Transaction already created
          res.json({
            result: {
              create_time: createTime,
              transaction: transactionId.toString(),
              state: PaymeHelper.STATES.CREATED
            }
          });
          break;
        }

        // Update order with transaction info
        await db.query(`
          UPDATE orders 
          SET payme_transaction_id = ?,
              payme_transaction_time = ?,
              payment_status = 'pending',
              updated_at = NOW()
          WHERE id = ?
        `, [transactionId, createTime, createOrderId]);

        res.json({
          result: {
            create_time: createTime,
            transaction: transactionId.toString(),
            state: PaymeHelper.STATES.CREATED
          }
        });
        break;

      case 'PerformTransaction':
        // Perform (complete) transaction
        const performOrder = await db.query(
          'SELECT id, payme_transaction_time FROM orders WHERE payme_transaction_id = ?',
          [transactionId]
        );

        if (performOrder.length === 0) {
          return res.json({
            error: {
              code: PaymeHelper.ERRORS.TRANSACTION_NOT_FOUND,
              message: 'Transaction not found'
            }
          });
        }

        const performTime = Date.now();

        // Mark order as paid and active
        await db.query(`
          UPDATE orders 
          SET status = 'active',
              payment_status = 'paid',
              paid_at = NOW(),
              activated_at = NOW(),
              updated_at = NOW()
          WHERE payme_transaction_id = ?
        `, [transactionId]);

        res.json({
          result: {
            transaction: transactionId.toString(),
            perform_time: performTime,
            state: PaymeHelper.STATES.COMPLETED
          }
        });
        break;

      case 'CancelTransaction':
        // Cancel transaction
        const cancelReason = params.reason || 0;
        
        const cancelOrder = await db.query(
          'SELECT id, payment_status, payme_transaction_time FROM orders WHERE payme_transaction_id = ?',
          [transactionId]
        );

        if (cancelOrder.length === 0) {
          return res.json({
            error: {
              code: PaymeHelper.ERRORS.TRANSACTION_NOT_FOUND,
              message: 'Transaction not found'
            }
          });
        }

        const cancelTime = Date.now();
        const wasPaid = cancelOrder[0].payment_status === 'paid';

        // Cancel order
        await db.query(`
          UPDATE orders 
          SET status = 'cancelled',
              payment_status = 'failed',
              updated_at = NOW()
          WHERE payme_transaction_id = ?
        `, [transactionId]);

        res.json({
          result: {
            transaction: transactionId.toString(),
            cancel_time: cancelTime,
            state: wasPaid ? PaymeHelper.STATES.CANCELLED_AFTER_COMPLETE : PaymeHelper.STATES.CANCELLED
          }
        });
        break;

      case 'CheckTransaction':
        // Check transaction status
        const checkOrder = await db.query(
          'SELECT payment_status, payme_transaction_time, paid_at FROM orders WHERE payme_transaction_id = ?',
          [transactionId]
        );

        if (checkOrder.length === 0) {
          return res.json({
            error: {
              code: PaymeHelper.ERRORS.TRANSACTION_NOT_FOUND,
              message: 'Transaction not found'
            }
          });
        }

        const txOrder = checkOrder[0];
        let state = PaymeHelper.STATES.CREATED;
        let performTimeResult = 0;
        let cancelTimeResult = 0;

        if (txOrder.payment_status === 'paid') {
          state = PaymeHelper.STATES.COMPLETED;
          performTimeResult = txOrder.paid_at ? new Date(txOrder.paid_at).getTime() : Date.now();
        } else if (txOrder.payment_status === 'failed') {
          state = PaymeHelper.STATES.CANCELLED;
          cancelTimeResult = Date.now();
        }

        res.json({
          result: {
            create_time: txOrder.payme_transaction_time || Date.now(),
            perform_time: performTimeResult,
            cancel_time: cancelTimeResult,
            transaction: transactionId.toString(),
            state: state,
            reason: null
          }
        });
        break;

      case 'GetStatement':
        // Get statement (list of transactions)
        const { from, to } = params;
        
        const transactions = await db.query(`
          SELECT 
            payme_transaction_id as transaction,
            payme_transaction_time as create_time,
            paid_at,
            payment_status,
            amount,
            id as order_id
          FROM orders
          WHERE payme_transaction_id IS NOT NULL
            AND payme_transaction_time >= ?
            AND payme_transaction_time <= ?
          ORDER BY payme_transaction_time DESC
        `, [from, to]);

        const statement = transactions.map(tx => ({
          id: tx.transaction,
          time: tx.create_time,
          amount: payme.toTiyin(tx.amount),
          account: {
            order_id: tx.order_id.toString()
          },
          create_time: tx.create_time,
          perform_time: tx.paid_at ? new Date(tx.paid_at).getTime() : 0,
          cancel_time: 0,
          transaction: tx.transaction.toString(),
          state: tx.payment_status === 'paid' ? PaymeHelper.STATES.COMPLETED : PaymeHelper.STATES.CREATED,
          reason: null
        }));

        res.json({
          result: {
            transactions: statement
          }
        });
        break;

      default:
        res.json({
          error: {
            code: -32601,
            message: 'Method not found'
          }
        });
    }

  } catch (error) {
    console.error('Payme Callback Error:', error);
    res.json({
      error: {
        code: -32400,
        message: 'Internal server error',
        data: error.message
      }
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