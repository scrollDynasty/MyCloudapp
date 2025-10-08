const db = require('../core/db/connection');
const createDatabase = require('./create-database');

async function setupDatabase() {
  console.log('🚀 Starting database setup...');
  
  try {
    // Step 0: Create database if it doesn't exist
    console.log('🏗️  Step 0: Creating database...');
    await createDatabase();
    
    // Connect to database
    await db.connect();
    
    // 1. Full reset - drop existing tables
    console.log('💣 Dropping existing tables...');
    await db.query('SET FOREIGN_KEY_CHECKS = 0');
    
    const dropQueries = [
      'DROP TABLE IF EXISTS vps_plans',
      'DROP TABLE IF EXISTS orders', 
      'DROP TABLE IF EXISTS users',
      'DROP TABLE IF EXISTS providers',
      'DROP TABLE IF EXISTS regions',
      'DROP TABLE IF EXISTS currencies'
    ];
    
    for (const query of dropQueries) {
      try {
        await db.query(query);
        console.log(`✅ ${query}`);
      } catch (error) {
        console.log(`⚠️  ${query} - ${error.message}`);
      }
    }
    
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
    
    // 2. Create providers table
    console.log('🏢 Creating providers table...');
    await db.query(`
      CREATE TABLE providers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        website VARCHAR(255),
        country VARCHAR(128),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    // 3. Create regions table
    console.log('🌍 Creating regions table...');
    await db.query(`
      CREATE TABLE regions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        country VARCHAR(128)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    // 4. Create currencies table
    console.log('💰 Creating currencies table...');
    await db.query(`
      CREATE TABLE currencies (
        code VARCHAR(10) PRIMARY KEY,
        name VARCHAR(64),
        symbol VARCHAR(8),
        exchange_rate_to_usd DECIMAL(10,4),
        updated_at DATETIME
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    // 5. Create vps_plans table
    console.log('🖥️  Creating vps_plans table...');
    await db.query(`
      CREATE TABLE vps_plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        provider_id INT NOT NULL,
        plan_name VARCHAR(255) NOT NULL,
        cpu_cores INT NOT NULL,
        memory_gb FLOAT NOT NULL,
        storage_gb INT NOT NULL,
        bandwidth_tb FLOAT,
        price_per_month DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10),
        region VARCHAR(255),
        available BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (provider_id) REFERENCES providers(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    // 6. Create users table for testing
    console.log('👥 Creating users table...');
    await db.query(`
      CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(20),
        password_hash VARCHAR(255),
        status ENUM('active', 'inactive', 'banned') DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    // 7. Create orders table for testing
    console.log('📦 Creating orders table...');
    await db.query(`
      CREATE TABLE orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        vps_plan_id INT NOT NULL,
        status ENUM('pending', 'active', 'suspended', 'cancelled') DEFAULT 'pending',
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10) NOT NULL,
        payment_method VARCHAR(50),
        payment_id VARCHAR(255),
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (vps_plan_id) REFERENCES vps_plans(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    // 8. Insert default currencies
    console.log('💱 Inserting default currencies...');
    const currencies = [
      ['USD', 'US Dollar', '$', 1.0000],
      ['UZS', 'Uzbek Som', 'сум', 12700.0000],
      ['RUB', 'Russian Ruble', '₽', 92.5000],
      ['EUR', 'Euro', '€', 0.9200]
    ];
    
    for (const [code, name, symbol, rate] of currencies) {
      await db.query(
        'INSERT INTO currencies (code, name, symbol, exchange_rate_to_usd, updated_at) VALUES (?, ?, ?, ?, NOW())',
        [code, name, symbol, rate]
      );
    }
    
    // 9. Insert default regions
    console.log('🗺️  Inserting default regions...');
    const regions = [
      ['Global', 'Worldwide'],
      ['Germany', 'Germany'],
      ['Lithuania', 'Lithuania'],
      ['Russia', 'Russia'],
      ['Uzbekistan', 'Uzbekistan'],
      ['USA', 'United States'],
      ['Netherlands', 'Netherlands'],
      ['Singapore', 'Singapore']
    ];
    
    for (const [name, country] of regions) {
      await db.query(
        'INSERT INTO regions (name, country) VALUES (?, ?)',
        [name, country]
      );
    }
    
    console.log('✅ Database setup completed successfully!');
    console.log('📊 Tables created:');
    console.log('   - providers');
    console.log('   - regions');
    console.log('   - currencies');
    console.log('   - vps_plans');
    console.log('   - users');
    console.log('   - orders');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    throw error;
  } finally {
    await db.close();
  }
}

// Run setup if called directly
if (require.main === module) {
  setupDatabase()
    .then(() => {
      console.log('🎉 Setup completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💀 Setup failed:', error);
      process.exit(1);
    });
}

module.exports = setupDatabase;