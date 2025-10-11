#!/usr/bin/env node

/**
 * Утилита для тестирования разных форматов Payme checkout URL
 * 
 * Использование:
 *   node test-payme-checkout-url.js [order_id] [amount]
 * 
 * Пример:
 *   node test-payme-checkout-url.js 17 50000
 */

// Загружаем .env файл если dotenv установлен
try {
  require('dotenv').config();
} catch (error) {
  // Если dotenv не установлен, читаем .env вручную
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        process.env[key.trim()] = value;
      }
    });
  }
}

const PaymeHelper = require('./core/utils/payme-helper');

const orderId = process.argv[2] || '17';
const amount = parseFloat(process.argv[3] || '50000');

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║     ТЕСТИРОВАНИЕ PAYME CHECKOUT URL - РАЗНЫЕ ФОРМАТЫ         ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const payme = new PaymeHelper();

console.log('📋 Параметры:');
console.log(`   Order ID: ${orderId}`);
console.log(`   Amount: ${amount} UZS (${Math.round(amount * 100)} tiyin)`);
console.log(`   Merchant ID: ${process.env.PAYME_MERCHANT_ID}`);
console.log(`   Merchant ID Length: ${process.env.PAYME_MERCHANT_ID?.length || 0}`);
console.log('');

// Проверка конфигурации
if (!process.env.PAYME_MERCHANT_ID || process.env.PAYME_MERCHANT_ID.length !== 24) {
  console.error('❌ ОШИБКА: PAYME_MERCHANT_ID не настроен или имеет неправильную длину!');
  console.error('   Требуется: 24 символа');
  console.error(`   Получено: ${process.env.PAYME_MERCHANT_ID?.length || 0} символов`);
  process.exit(1);
}

console.log('═══════════════════════════════════════════════════════════════\n');

// 1. Стандартный метод
console.log('1️⃣  СТАНДАРТНЫЙ МЕТОД (order_id):');
console.log('─────────────────────────────────────');
try {
  const standardUrl = payme.createCheckoutUrl(orderId, amount);
  console.log('✅ Успешно создан!\n');
} catch (error) {
  console.error(`❌ Ошибка: ${error.message}\n`);
}

console.log('═══════════════════════════════════════════════════════════════\n');

// 2. Альтернативные форматы
console.log('2️⃣  АЛЬТЕРНАТИВНЫЕ ФОРМАТЫ:');
console.log('─────────────────────────────────────');

const alternativeFields = [
  { name: 'account', description: 'Используется в некоторых кассах' },
  { name: 'id', description: 'Простой формат' },
  { name: 'order', description: 'Сокращенное название' },
  { name: 'orderId', description: 'CamelCase формат' }
];

alternativeFields.forEach((field, index) => {
  console.log(`\n${index + 1}. Формат: ac.${field.name}`);
  console.log(`   ${field.description}`);
  try {
    const url = payme.createCheckoutUrlAlternative(orderId, amount, field.name);
    console.log('   ✅ URL создан успешно');
  } catch (error) {
    console.error(`   ❌ Ошибка: ${error.message}`);
  }
});

console.log('\n═══════════════════════════════════════════════════════════════\n');

// 3. Генерация всех вариантов
console.log('3️⃣  СВОДНАЯ ТАБЛИЦА ВСЕХ ВАРИАНТОВ:');
console.log('─────────────────────────────────────');
const testUrls = payme.generateTestUrls(orderId, amount);

console.log('═══════════════════════════════════════════════════════════════\n');

// 4. Рекомендации
console.log('📝 РЕКОМЕНДАЦИИ ПО УСТРАНЕНИЮ ОШИБКИ "[object Object]":');
console.log('─────────────────────────────────────────────────────────────');
console.log('');
console.log('1. ПРОВЕРЬТЕ MERCHANT ID в личном кабинете Payme:');
console.log('   - Войдите в https://business.payme.uz');
console.log('   - Перейдите в раздел "Кассы"');
console.log('   - Убедитесь что касса АКТИВИРОВАНА');
console.log('   - Скопируйте правильный Merchant ID (24 символа)');
console.log('');
console.log('2. ПРОВЕРЬТЕ НАСТРОЙКИ ACCOUNT ПОЛЕЙ:');
console.log('   - В настройках кассы найдите раздел "Account поля"');
console.log('   - Посмотрите какие поля настроены (order_id, account, id, etc.)');
console.log('   - Используйте ТОЧНО ТЕ ЖЕ названия полей в коде');
console.log('');
console.log('3. ТЕСТИРОВАНИЕ:');
console.log('   - Попробуйте каждый из сгенерированных URL выше');
console.log('   - Откройте URL в браузере и проверьте результат');
console.log('   - Если видите форму оплаты - формат правильный!');
console.log('   - Если видите ошибку - попробуйте следующий вариант');
console.log('');
console.log('4. RETURN URL (опционально):');
console.log('   - НЕ используйте return URL если не настроен в dashboard');
console.log('   - Для настройки: добавьте URL в белый список в кабинете');
console.log('   - Или используйте БЕЗ return URL (как сейчас)');
console.log('');
console.log('5. ПОЛУЧИТЕ ПОМОЩЬ ОТ PAYME:');
console.log('   - Telegram: @payme_support');
console.log('   - Email: support@paycom.uz');
console.log('   - Телефон: +998 78 150 01 11');
console.log('');
console.log('═══════════════════════════════════════════════════════════════\n');

// 5. Следующие шаги
console.log('🚀 СЛЕДУЮЩИЕ ШАГИ:');
console.log('─────────────────────────────────────');
console.log('1. Скопируйте один из URL выше');
console.log('2. Откройте его в браузере');
console.log('3. Если видите форму оплаты - используйте этот формат!');
console.log('4. Если ошибка - свяжитесь с поддержкой Payme\n');
console.log('═══════════════════════════════════════════════════════════════\n');
