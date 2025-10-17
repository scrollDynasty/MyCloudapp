/**
 * Migration Script: Add service_plan_id to orders table
 * Adds support for service plans in orders
 */

const mysql = require('mysql2/promise');
const { dbConfig } = require('../core/config/database-extended');

async function addServicePlanToOrders() {
  let connection;
  
  try {
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');

    // Check if column already exists
    console.log('Checking if service_plan_id column exists...');
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'orders' 
      AND COLUMN_NAME = 'service_plan_id'
    `, [dbConfig.database || 'vps_billing']);

    if (columns.length > 0) {
      console.log('⚠️  Column service_plan_id already exists, skipping migration');
      return;
    }

    // Add service_plan_id column
    console.log('Adding service_plan_id column to orders table...');
    await connection.execute(`
      ALTER TABLE orders 
      ADD COLUMN service_plan_id INT NULL COMMENT 'ID тарифа из service_plans' AFTER vps_plan_id,
      ADD INDEX idx_service_plan (service_plan_id)
    `);
    console.log('✅ service_plan_id column added');

    // Add foreign key constraint (if service_plans table exists)
    console.log('Checking if service_plans table exists...');
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'service_plans'
    `, [dbConfig.database || 'vps_billing']);

    if (tables.length > 0) {
      console.log('Adding foreign key constraint...');
      await connection.execute(`
        ALTER TABLE orders 
        ADD CONSTRAINT fk_orders_service_plan 
        FOREIGN KEY (service_plan_id) REFERENCES service_plans(id) 
        ON DELETE SET NULL
      `);
      console.log('✅ Foreign key constraint added');
    } else {
      console.log('⚠️  service_plans table does not exist, skipping foreign key');
    }

    // Modify vps_plan_id to allow NULL (since now we have two plan types)
    console.log('Updating vps_plan_id to allow NULL...');
    await connection.execute(`
      ALTER TABLE orders 
      MODIFY COLUMN vps_plan_id INT NULL COMMENT 'ID плана VPS'
    `);
    console.log('✅ vps_plan_id updated to allow NULL');

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log('  - Added service_plan_id column to orders table');
    console.log('  - Added index for service_plan_id');
    console.log('  - Added foreign key constraint (if service_plans exists)');
    console.log('  - Updated vps_plan_id to allow NULL');

  } catch (error) {
    console.error('❌ Error running migration:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔐 Database connection closed');
    }
  }
}

// Run the migration
if (require.main === module) {
  addServicePlanToOrders()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Failed to run migration:', error);
      process.exit(1);
    });
}

module.exports = { addServicePlanToOrders };
