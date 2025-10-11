#!/usr/bin/env node

/**
 * Тестовый скрипт для генерации и проверки Payme checkout URLs
 * Использование: node test-payme-urls.js [order_id] [amount]
 */

require('dotenv').config();
const PaymeHelper = require('./core/utils/payme-helper');

// Получаем параметры из командной строки
const orderId = process.argv[2] || '17';
const amount = parseFloat(process.argv[3] || '50000');

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║       ТЕСТИРОВАНИЕ PAYME CHECKOUT URLS                        ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

console.log('📋 Параметры теста:');
console.log(`   Order ID: ${orderId}`);
console.log(`   Amount: ${amount} UZS (${Math.round(amount * 100)} tiyin)`);
console.log(`   Merchant ID: ${process.env.PAYME_MERCHANT_ID}`);
console.log('\n' + '─'.repeat(65) + '\n');

// Создаем экземпляр PaymeHelper
const payme = new PaymeHelper();

try {
  // Генерируем стандартный URL
  console.log('🔗 СТАНДАРТНЫЙ CHECKOUT URL:\n');
  const standardUrl = payme.createCheckoutUrl(orderId, amount);
  
  // Генерируем альтернативные URLs
  console.log('\n' + '─'.repeat(65) + '\n');
  const alternatives = payme.generateAlternativeCheckoutUrls(orderId, amount);
  
  // Инструкции
  console.log('\n' + '═'.repeat(65));
  console.log('\n📝 ИНСТРУКЦИИ ПО ТЕСТИРОВАНИЮ:\n');
  console.log('1. Откройте каждый URL в браузере');
  console.log('2. Если видите форму оплаты Payme - URL правильный ✅');
  console.log('3. Если видите "[object Object]" - пробуйте следующий URL ❌');
  console.log('4. Запомните какой формат сработал\n');
  
  console.log('⚠️  ВАЖНО:');
  console.log('   • Merchant ID должен быть активирован в системе Payme');
  console.log('   • Account поля должны быть настроены в личном кабинете');
  console.log('   • Return URL должен быть в белом списке (если используется)\n');
  
  console.log('💡 Если ВСЕ URL показывают "[object Object]":');
  console.log('   1. Проверьте что Merchant ID активен');
  console.log('   2. Свяжитесь с поддержкой Payme: +998 78 150 01 04');
  console.log('   3. Запросите правильные настройки account полей\n');
  
  console.log('═'.repeat(65) + '\n');
  
  // Копируемые ссылки для быстрого тестирования
  console.log('📎 КОПИРУЕМЫЕ ССЫЛКИ ДЛЯ ТЕСТИРОВАНИЯ:\n');
  console.log('Standard (ac.order_id):');
  console.log(alternatives.standard);
  console.log('\nAccount (ac.account):');
  console.log(alternatives.account);
  console.log('\nID (ac.id):');
  console.log(alternatives.id);
  console.log('\nMultiple fields:');
  console.log(alternatives.multiple);
  console.log('\n');
  
  // Декодируем один URL для примера
  console.log('═'.repeat(65));
  console.log('\n🔍 РАСШИФРОВКА СТАНДАРТНОГО URL:\n');
  const base64Part = standardUrl.split('/').pop();
  const decoded = Buffer.from(base64Part, 'base64').toString();
  console.log('Base64:', base64Part);
  console.log('Decoded:', decoded);
  console.log('\nФормат параметров:');
  const params = decoded.split(';');
  params.forEach((param, i) => {
    console.log(`   ${i + 1}. ${param}`);
  });
  console.log('\n═'.repeat(65) + '\n');
  
  // Сохраняем URLs в файл для удобства
  const fs = require('fs');
  const outputFile = './payme-test-urls.txt';
  const output = `
PAYME CHECKOUT URLS - ${new Date().toISOString()}
${'='.repeat(65)}

Order ID: ${orderId}
Amount: ${amount} UZS (${Math.round(amount * 100)} tiyin)
Merchant ID: ${process.env.PAYME_MERCHANT_ID}

${'='.repeat(65)}

1. STANDARD (ac.order_id):
${alternatives.standard}

2. ACCOUNT (ac.account):
${alternatives.account}

3. ID (ac.id):
${alternatives.id}

4. MULTIPLE FIELDS:
${alternatives.multiple}

${'='.repeat(65)}

ИНСТРУКЦИИ:
- Откройте каждый URL в браузере
- Если видите форму оплаты ✅ - используйте этот формат
- Если видите "[object Object]" ❌ - пробуйте следующий

ВАЖНО:
- Merchant ID должен быть активирован
- Account поля должны быть настроены
- Обратитесь в Payme support: +998 78 150 01 04
`;
  
  fs.writeFileSync(outputFile, output);
  console.log(`✅ URLs сохранены в файл: ${outputFile}\n`);
  
} catch (error) {
  console.error('\n❌ ОШИБКА:', error.message);
  console.error('\nПроверьте:');
  console.error('1. Переменную PAYME_MERCHANT_ID в .env файле');
  console.error('2. Что Merchant ID имеет длину 24 символа');
  console.error('3. Что сумма больше 1 UZS\n');
  process.exit(1);
}

console.log('✅ Тест завершен успешно!\n');
