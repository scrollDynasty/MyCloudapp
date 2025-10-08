const setupDatabase = require('./setup-database');
const ExcelDataImporter = require('./import-excel-data');
const addTestData = require('./add-test-data');
const path = require('path');

async function initializeSystem() {
  console.log('🚀 Initializing VPS Billing System...');
  console.log('=' * 60);

  try {
    // Step 1: Setup database structure
    console.log('\n🏗️  Step 1: Setting up database structure...');
    await setupDatabase();

    // Step 2: Import Excel data
    console.log('\n📊 Step 2: Importing Excel data...');
    const excelFile = path.join(__dirname, '../../VPS-Price.xlsx');
    const importer = new ExcelDataImporter();
    await importer.importExcelData(excelFile);

    // Step 3: Add test data
    console.log('\n🧪 Step 3: Adding test data...');
    await addTestData();

    console.log('\n🎉 System initialization completed successfully!');
    console.log('=' * 60);
    console.log('✅ Database structure created');
    console.log('✅ Excel data imported');
    console.log('✅ Test users and orders created');
    console.log('✅ System ready for use');
    
    console.log('\n🔗 Available endpoints:');
    console.log('   - GET  /api/vps                 - List VPS plans');
    console.log('   - GET  /api/vps/:id             - Get VPS plan details');
    console.log('   - GET  /api/vps/providers/list  - List providers');
    console.log('   - GET  /api/vps/regions/list    - List regions');
    console.log('   - GET  /api/orders              - List orders');
    console.log('   - POST /api/orders              - Create order');
    console.log('   - GET  /api/orders/:id          - Get order details');
    console.log('   - POST /api/payments/payme      - Create Payme payment');
    console.log('   - GET  /api/auth/users          - List users');
    console.log('   - POST /api/auth/users          - Create user');
    console.log('   - POST /api/auth/login          - User login');

    console.log('\n📋 Test Users:');
    console.log('   - john_doe / password123');
    console.log('   - jane_smith / password456');
    console.log('   - alex_dev / devpassword');
    console.log('   - maria_admin / adminpass');
    console.log('   - test_user / testpass');

    console.log('\n🎯 Next steps:');
    console.log('   1. Update .env with your MariaDB credentials');
    console.log('   2. Run: npm install');
    console.log('   3. Run: npm start');
    console.log('   4. Test API endpoints with curl or Postman');

  } catch (error) {
    console.error('\n💀 System initialization failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run initialization
if (require.main === module) {
  initializeSystem();
}

module.exports = initializeSystem;