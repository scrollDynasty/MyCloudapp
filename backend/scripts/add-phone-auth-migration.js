#!/usr/bin/env node

/**
 * Migration Script: Add Phone Authentication Support
 * Run with: node scripts/add-phone-auth-migration.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'vps_billing',
  multipleStatements: true
};

async function runMigration() {
  let connection;
  
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected successfully');

    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/002-add-phone-auth.sql');
    console.log(`📄 Reading migration file: ${migrationPath}`);
    
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    // Execute migration
    console.log('🚀 Running migration...');
    await connection.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify changes
    console.log('\n📊 Verifying changes...');
    const [columns] = await connection.query(`
      SHOW COLUMNS FROM users WHERE Field IN ('phone_number', 'last_login_at')
    `);
    
    console.log('Updated columns:');
    columns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key}`);
    });
    
    // Check indexes
    const [indexes] = await connection.query(`
      SHOW INDEXES FROM users WHERE Key_name = 'idx_users_phone_number'
    `);
    
    if (indexes.length > 0) {
      console.log('\n✅ Phone number index created successfully');
    }
    
    console.log('\n🎉 Migration completed! Phone authentication is now enabled.');
    console.log('\nNext steps:');
    console.log('1. Restart your backend server');
    console.log('2. Test phone login with +998 numbers');
    console.log('3. Check SMS codes in backend console logs');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run migration
runMigration();
