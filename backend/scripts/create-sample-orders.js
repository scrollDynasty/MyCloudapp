const db = require('../core/db/connection');

async function createSampleOrders() {
  try {
    await db.connect();
    console.log('✅ Connected to database');

    // Sample orders data
    const orders = [
      {
        user_id: 2, // John Doe
        vps_plan_id: 2, // VPS 1 CPU
        status: 'active',
        amount: 25000.00,
        currency: 'UZS',
        payment_method: 'payme',
        payment_status: 'paid'
      },
      {
        user_id: 3, // Jane Smith
        vps_plan_id: 1,
        status: 'pending',
        amount: 15000.00,
        currency: 'UZS',
        payment_method: 'payme',
        payment_status: 'pending'
      },
      {
        user_id: 4, // Tech Corporation
        vps_plan_id: 3,
        status: 'active',
        amount: 50000.00,
        currency: 'UZS',
        payment_method: 'payme',
        payment_status: 'paid'
      },
      {
        user_id: 2, // John Doe (another order)
        vps_plan_id: 3,
        status: 'cancelled',
        amount: 30000.00,
        currency: 'UZS',
        payment_method: 'payme',
        payment_status: 'failed'
      },
      {
        user_id: 3, // Jane Smith (another order)
        vps_plan_id: 2,
        status: 'active',
        amount: 25000.00,
        currency: 'UZS',
        payment_method: 'payme',
        payment_status: 'paid'
      }
    ];

    console.log('\n📝 Creating sample orders...\n');

    for (const order of orders) {
      const query = `
        INSERT INTO orders (user_id, vps_plan_id, status, amount, currency, payment_method, payment_status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `;
      
      await db.query(query, [
        order.user_id,
        order.vps_plan_id,
        order.status,
        order.amount,
        order.currency,
        order.payment_method,
        order.payment_status
      ]);

      console.log(`✅ Created order: User ${order.user_id}, Plan ${order.vps_plan_id}, Status: ${order.status}, Amount: ${order.amount} ${order.currency}`);
    }

    console.log('\n🎉 All sample orders created successfully!\n');

    // Show created orders
    const result = await db.query(`
      SELECT 
        o.id, 
        o.user_id,
        u.first_name,
        u.last_name,
        vp.plan_name,
        o.status,
        o.amount,
        o.currency
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN vps_plans vp ON o.vps_plan_id = vp.id
      ORDER BY o.created_at DESC
      LIMIT 10
    `);

    console.log('📋 Recent orders:');
    console.table(result);

  } catch (error) {
    console.error('❌ Error creating sample orders:', error);
  } finally {
    process.exit(0);
  }
}

createSampleOrders();
