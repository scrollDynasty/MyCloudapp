const bcrypt = require('bcryptjs');
const db = require('../core/db/connection');

const testUsers = [
  { email: 'admin@vps-billing.com', password: 'admin123' },
  { email: 'john@individual.com', password: 'user123' },
  { email: 'jane@individual.com', password: 'user456' },
  { email: 'info@techcorp.uz', password: 'legal123' },
  { email: 'contact@biznes.uz', password: 'legal456' },
  { email: 'test@test.com', password: 'test123' }
];

async function fixPasswordHashes() {
  try {
    await db.connect();
    console.log('✅ Connected to database');
    
    for (const user of testUsers) {
      console.log(`\n🔧 Fixing password for: ${user.email}`);
      
      // Создаем правильный bcrypt хэш
      const passwordHash = await bcrypt.hash(user.password, 10);
      console.log(`   Generated hash: ${passwordHash.substring(0, 20)}...`);
      
      // Обновляем в базе
      await db.query(
        'UPDATE users SET password_hash = ? WHERE email = ?',
        [passwordHash, user.email]
      );
      console.log(`   ✅ Updated successfully`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ All passwords have been fixed!');
    console.log('='.repeat(60));
    
    // Проверяем результат
    console.log('\n📋 Verification:');
    const users = await db.query(
      'SELECT email, LEFT(password_hash, 20) as hash_start, LENGTH(password_hash) as hash_length FROM users WHERE oauth_provider = "local"'
    );
    
    users.forEach(user => {
      const status = user.hash_length === 60 ? '✅' : '❌';
      console.log(`${status} ${user.email}: ${user.hash_start}... (length: ${user.hash_length})`);
    });
    
    console.log('\n🎉 Done! You can now login with these credentials:');
    console.log('   admin@vps-billing.com / admin123');
    console.log('   john@individual.com / user123');
    console.log('   test@test.com / test123');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixPasswordHashes();
