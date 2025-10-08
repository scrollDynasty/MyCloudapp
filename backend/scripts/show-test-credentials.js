const bcrypt = require('bcryptjs');

// Тестовые пароли из скрипта add-test-data.js
const testPasswords = {
  'admin@vps-billing.com': 'admin123',
  'john@individual.com': 'user123',
  'jane@individual.com': 'user123',
  'info@techcorp.uz': 'legal123',
  'contact@biznes.uz': 'legal123',
  'test@test.com': 'test123'
};

console.log('\n📋 Тестовые учетные данные для входа:\n');
console.log('=' .repeat(60));

for (const [email, password] of Object.entries(testPasswords)) {
  console.log(`\n📧 Email: ${email}`);
  console.log(`🔑 Password: ${password}`);
}

console.log('\n' + '='.repeat(60));
console.log('\n💡 Используйте эти данные для входа в систему\n');
