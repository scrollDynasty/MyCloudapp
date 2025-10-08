const express = require('express');
const db = require('../../core/db/connection');
const SQL = require('../../core/db/queries');

const router = express.Router();

// GET /api/orders - Get all orders
router.get('/', async (req, res) => {
  try {
    await db.connect();
    
    const {
      user_id,
      status,
      limit = 20,
      offset = 0
    } = req.query;

    let whereConditions = [];
    let params = [];

    if (user_id) {
      whereConditions.push('o.user_id = ?');
      params.push(user_id);
    }

    if (status) {
      whereConditions.push('o.status = ?');
      params.push(status);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const query = `
      SELECT 
        o.*,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        vp.plan_name,
        vp.cpu_cores,
        vp.memory_gb,
        vp.storage_gb,
        vp.bandwidth_tb,
        p.name as provider_name,
        p.country as provider_country
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN vps_plans vp ON o.vps_plan_id = vp.id
      JOIN providers p ON vp.provider_id = p.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(parseInt(limit), parseInt(offset));

    const orders = await db.query(query, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN vps_plans vp ON o.vps_plan_id = vp.id
      JOIN providers p ON vp.provider_id = p.id
      ${whereClause}
    `;
    
    const countResult = await db.query(countQuery, params.slice(0, -2));
    const total = countResult[0].total;

    const formattedOrders = orders.map(order => ({
      order_id: order.id,
      user_id: order.user_id,
      vps_plan_id: order.vps_plan_id,
      full_name: `${order.first_name || ''} ${order.last_name || ''}`.trim() || order.username,
      email: order.email,
      plan_name: order.plan_name,
      provider_name: order.provider_name,
      provider_country: order.provider_country,
      cpu_cores: order.cpu_cores,
      memory_gb: order.memory_gb,
      storage_gb: order.storage_gb,
      bandwidth_tb: order.bandwidth_tb,
      status: order.status,
      total_price: parseFloat(order.amount || 0),
      currency_code: order.currency || 'UZS',
      payment_method: order.payment_method,
      payment_id: order.payment_id,
      notes: order.notes,
      created_at: order.created_at,
      updated_at: order.updated_at
    }));

    res.json({
      success: true,
      data: formattedOrders,
      pagination: {
        total: total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Orders API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders',
      message: error.message
    });
  }
});

// POST /api/orders - Create new order
router.post('/', async (req, res) => {
  try {
    await db.connect();
    
    const {
      user_id,
      vps_plan_id,
      notes
    } = req.body;

    // Validate input
    if (!user_id || !vps_plan_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: user_id, vps_plan_id'
      });
    }

    // Verify user exists
    const userExists = await db.query('SELECT id FROM users WHERE id = ?', [user_id]);
    if (userExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get VPS plan details
    const vpsPlans = await db.query(`
      SELECT 
        vp.*,
        p.name as provider_name
      FROM vps_plans vp
      JOIN providers p ON vp.provider_id = p.id
      WHERE vp.id = ? AND vp.available = true
    `, [vps_plan_id]);

    if (vpsPlans.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'VPS plan not found or not available'
      });
    }

    const vpsPlan = vpsPlans[0];

    // Create order
    const result = await db.query(`
      INSERT INTO orders 
      (user_id, vps_plan_id, status, amount, currency, notes, created_at, updated_at)
      VALUES (?, ?, 'pending', ?, ?, ?, NOW(), NOW())
    `, [
      user_id,
      vps_plan_id,
      vpsPlan.price_per_month,
      vpsPlan.currency,
      notes || null
    ]);

    const orderId = result.insertId;

    // Get full order details
    const newOrder = await db.query(`
      SELECT 
        o.*,
        u.username,
        u.email,
        vp.plan_name,
        vp.cpu_cores,
        vp.memory_gb,
        vp.storage_gb,
        vp.bandwidth_tb,
        p.name as provider_name
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN vps_plans vp ON o.vps_plan_id = vp.id
      JOIN providers p ON vp.provider_id = p.id
      WHERE o.id = ?
    `, [orderId]);

    const order = newOrder[0];

    res.status(201).json({
      success: true,
      data: {
        id: order.id,
        user: {
          id: order.user_id,
          username: order.username,
          email: order.email
        },
        vps_plan: {
          id: order.vps_plan_id,
          name: order.plan_name,
          provider: order.provider_name,
          specs: {
            cpu_cores: order.cpu_cores,
            memory_gb: order.memory_gb,
            storage_gb: order.storage_gb,
            bandwidth_tb: order.bandwidth_tb
          }
        },
        status: order.status,
        amount: parseFloat(order.amount),
        currency: order.currency,
        payment_method: order.payment_method,
        payment_id: order.payment_id,
        notes: order.notes,
        created_at: order.created_at,
        updated_at: order.updated_at
      }
    });

  } catch (error) {
    console.error('Create Order Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order',
      message: error.message
    });
  }
});

// GET /api/orders/:id - Get specific order
router.get('/:id', async (req, res) => {
  try {
    await db.connect();
    
    const { id } = req.params;

    const orders = await db.query(`
      SELECT 
        o.*,
        u.username,
        u.email,
        u.phone,
        u.first_name,
        u.last_name,
        vp.plan_name,
        vp.cpu_cores,
        vp.memory_gb,
        vp.storage_gb,
        vp.bandwidth_tb,
        vp.price_per_month,
        p.name as provider_name,
        p.website as provider_website,
        p.country as provider_country
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN vps_plans vp ON o.vps_plan_id = vp.id
      JOIN providers p ON vp.provider_id = p.id
      WHERE o.id = ?
    `, [id]);

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orders[0];

    res.json({
      success: true,
      data: {
        order_id: order.id,
        user_id: order.user_id,
        vps_plan_id: order.vps_plan_id,
        full_name: `${order.first_name || ''} ${order.last_name || ''}`.trim() || order.username,
        email: order.email,
        phone: order.phone,
        plan_name: order.plan_name,
        provider_name: order.provider_name,
        provider_country: order.provider_country,
        provider_website: order.provider_website,
        cpu_cores: order.cpu_cores,
        memory_gb: order.memory_gb,
        storage_gb: order.storage_gb,
        bandwidth_tb: order.bandwidth_tb,
        status: order.status,
        amount: parseFloat(order.amount),
        currency: order.currency,
        payment_method: order.payment_method,
        payment_id: order.payment_id,
        payment_status: order.payment_status,
        notes: order.notes,
        created_at: order.created_at,
        updated_at: order.updated_at
      }
    });

  } catch (error) {
    console.error('Order Detail Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order details',
      message: error.message
    });
  }
});

// PUT /api/orders/:id/status - Update order status
router.put('/:id/status', async (req, res) => {
  try {
    await db.connect();
    
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    const validStatuses = ['pending', 'active', 'suspended', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Check if order exists
    const orderExists = await db.query('SELECT id FROM orders WHERE id = ?', [id]);
    if (orderExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Update order
    await db.query(
      'UPDATE orders SET status = ?, notes = COALESCE(?, notes), updated_at = NOW() WHERE id = ?',
      [status, notes, id]
    );

    // Get updated order
    const updatedOrder = await db.query(`
      SELECT 
        o.*,
        u.username,
        vp.plan_name,
        p.name as provider_name
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN vps_plans vp ON o.vps_plan_id = vp.id
      JOIN providers p ON vp.provider_id = p.id
      WHERE o.id = ?
    `, [id]);

    const order = updatedOrder[0];

    res.json({
      success: true,
      data: {
        id: order.id,
        user_id: order.user_id,
        username: order.username,
        vps_plan: `${order.provider_name} ${order.plan_name}`,
        status: order.status,
        amount: parseFloat(order.amount),
        currency: order.currency,
        notes: order.notes,
        updated_at: order.updated_at
      }
    });

  } catch (error) {
    console.error('Update Order Status Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order status',
      message: error.message
    });
  }
});

module.exports = router;