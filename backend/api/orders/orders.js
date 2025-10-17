const express = require('express');
const db = require('../../core/db/connection');
const SQL = require('../../core/db/queries');

const router = express.Router();

// GET /api/orders - Get all orders
router.get('/', async (req, res) => {
  try {
    // Database is already initialized at startup
    
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
        vp.name as plan_name,
        vp.cpu_cores,
        vp.ram_gb as memory_gb,
        vp.storage_gb,
        vp.bandwidth_gb as bandwidth_tb,
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
    // Database is already initialized at startup
    
    const {
      user_id,
      vps_plan_id,
      service_plan_id,
      notes
    } = req.body;

    // Validate input - need either vps_plan_id or service_plan_id
    if (!user_id || (!vps_plan_id && !service_plan_id)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: user_id and (vps_plan_id or service_plan_id)'
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

    let planDetails;
    let amount;
    let currency = 'UZS';
    let planName;
    let orderType;

    if (vps_plan_id) {
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

      planDetails = vpsPlans[0];
      amount = planDetails.price_monthly || planDetails.price_per_month;
      planName = `${planDetails.provider_name} ${planDetails.name}`;
      orderType = 'vps';
    } else {
      // Get service plan details
      const servicePlans = await db.query(`
        SELECT 
          sp.*,
          sg.name_ru as group_name
        FROM service_plans sp
        JOIN service_groups sg ON sp.group_id = sg.id
        WHERE sp.id = ? AND sp.is_active = true AND sg.is_active = true
      `, [service_plan_id]);

      if (servicePlans.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Service plan not found or not available'
        });
      }

      planDetails = servicePlans[0];
      amount = planDetails.discount_price || planDetails.price;
      currency = planDetails.currency;
      planName = `${planDetails.group_name} - ${planDetails.name_ru}`;
      orderType = 'service';
    }

    // Generate unique order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    // Calculate total amount (same as amount for now, can add taxes/fees later)
    const totalAmount = amount;

    // Create order
    const result = await db.query(`
      INSERT INTO orders 
      (user_id, vps_plan_id, service_plan_id, order_number, status, amount, total_amount, currency, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, NOW(), NOW())
    `, [
      user_id,
      vps_plan_id || null,
      service_plan_id || null,
      orderNumber,
      amount,
      totalAmount,
      currency,
      notes || null
    ]);

    const orderId = result.insertId;

    res.status(201).json({
      success: true,
      data: {
        id: orderId,
        order_number: orderNumber,
        user_id: user_id,
        plan_name: planName,
        order_type: orderType,
        status: 'pending',
        amount: parseFloat(amount),
        currency: currency,
        notes: notes
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
    // Database is already initialized at startup
    
    const { id } = req.params;

    // First get basic order info to determine type
    const basicOrder = await db.query('SELECT * FROM orders WHERE id = ?', [id]);
    
    if (basicOrder.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const orderData = basicOrder[0];
    let orderDetails;

    if (orderData.vps_plan_id) {
      // VPS order
      const orders = await db.query(`
        SELECT 
          o.*,
          u.username,
          u.email,
          u.phone,
          u.first_name,
          u.last_name,
          vp.name as plan_name,
          vp.cpu_cores,
          vp.ram_gb as memory_gb,
          vp.storage_gb,
          vp.bandwidth_gb as bandwidth_tb,
          vp.price_monthly as price_per_month,
          p.name as provider_name,
          p.website as provider_website,
          p.country as provider_country
        FROM orders o
        JOIN users u ON o.user_id = u.id
        JOIN vps_plans vp ON o.vps_plan_id = vp.id
        JOIN providers p ON vp.provider_id = p.id
        WHERE o.id = ?
      `, [id]);

      orderDetails = orders[0];
      
      return res.json({
        success: true,
        data: {
          order_id: orderDetails.id,
          order_type: 'vps',
          user_id: orderDetails.user_id,
          vps_plan_id: orderDetails.vps_plan_id,
          full_name: `${orderDetails.first_name || ''} ${orderDetails.last_name || ''}`.trim() || orderDetails.username,
          email: orderDetails.email,
          phone: orderDetails.phone,
          plan_name: orderDetails.plan_name,
          provider_name: orderDetails.provider_name,
          provider_country: orderDetails.provider_country,
          provider_website: orderDetails.provider_website,
          cpu_cores: orderDetails.cpu_cores,
          memory_gb: orderDetails.memory_gb,
          storage_gb: orderDetails.storage_gb,
          bandwidth_tb: orderDetails.bandwidth_tb,
          status: orderDetails.status,
          amount: parseFloat(orderDetails.amount),
          currency: orderDetails.currency,
          payment_method: orderDetails.payment_method,
          payment_id: orderDetails.payment_id,
          payment_status: orderDetails.payment_status,
          notes: orderDetails.notes,
          created_at: orderDetails.created_at,
          updated_at: orderDetails.updated_at
        }
      });
    } else if (orderData.service_plan_id) {
      // Service order
      const orders = await db.query(`
        SELECT 
          o.*,
          u.username,
          u.email,
          u.phone,
          u.first_name,
          u.last_name,
          sp.name_ru as plan_name,
          sp.price,
          sp.discount_price,
          sp.billing_period,
          sg.name_ru as group_name
        FROM orders o
        JOIN users u ON o.user_id = u.id
        JOIN service_plans sp ON o.service_plan_id = sp.id
        JOIN service_groups sg ON sp.group_id = sg.id
        WHERE o.id = ?
      `, [id]);

      orderDetails = orders[0];

      // Get plan fields (characteristics)
      const fields = await db.query(`
        SELECT *
        FROM plan_fields
        WHERE plan_id = ?
        ORDER BY display_order ASC
      `, [orderDetails.service_plan_id]);
      
      return res.json({
        success: true,
        data: {
          order_id: orderDetails.id,
          order_type: 'service',
          user_id: orderDetails.user_id,
          service_plan_id: orderDetails.service_plan_id,
          full_name: `${orderDetails.first_name || ''} ${orderDetails.last_name || ''}`.trim() || orderDetails.username,
          email: orderDetails.email,
          phone: orderDetails.phone,
          plan_name: orderDetails.plan_name,
          group_name: orderDetails.group_name,
          billing_period: orderDetails.billing_period,
          fields: fields,
          status: orderDetails.status,
          amount: parseFloat(orderDetails.amount),
          currency: orderDetails.currency,
          payment_method: orderDetails.payment_method,
          payment_id: orderDetails.payment_id,
          payment_status: orderDetails.payment_status,
          notes: orderDetails.notes,
          created_at: orderDetails.created_at,
          updated_at: orderDetails.updated_at
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid order: no plan associated'
      });
    }

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
    // Database is already initialized at startup
    
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
        vp.name as plan_name,
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