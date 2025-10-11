const crypto = require('crypto');

class PaymeHelper {
  constructor() {
    this.merchantId = process.env.PAYME_MERCHANT_ID || '65b78f9f3c319dec9d89218f';
    this.secretKey = process.env.PAYME_SECRET_KEY || 'n1qqWene%o6TTaorOPyk3M#wiqqRuCbTJoZD';
    this.url = process.env.PAYME_URL || 'https://checkout.paycom.uz';
  }

  // Generate authorization header for Payme API
  generateAuthHeader() {
    const credentials = `Paycom:${this.secretKey}`;
    return 'Basic ' + Buffer.from(credentials).toString('base64');
  }

  // Create checkout URL according to official Payme documentation
  // https://developer.help.paycom.uz/initsializatsiya-platezhey/
  createCheckoutUrl(orderId, amount, returnUrl = null, accountFields = null) {
    // amount in tiyin (1 UZS = 100 tiyin)
    const amountInTiyin = Math.round(amount * 100);

    // Validate merchant ID
    if (!this.merchantId || this.merchantId.length === 0) {
      console.error('❌ PAYME_MERCHANT_ID is not configured!');
      throw new Error('PAYME_MERCHANT_ID is not configured');
    }
    
    // Validate merchant ID format (must be 24 characters)
    if (this.merchantId.length !== 24) {
      console.error(`❌ Invalid PAYME_MERCHANT_ID length: ${this.merchantId.length} (expected 24)`);
      throw new Error(`Invalid PAYME_MERCHANT_ID: must be 24 characters, got ${this.merchantId.length}`);
    }
    
    // Validate amount
    if (amountInTiyin < 100) {
      throw new Error('Amount too small: minimum 1 UZS (100 tiyin)');
    }
    
    // Official Payme format: m=merchant_id;ac.field=value;a=amount_in_tiyin
    // Build params as string (NOT JSON!)
    
    // Build account parameters
    let accountParams;
    if (accountFields && typeof accountFields === 'object') {
      // Support multiple account fields
      accountParams = Object.keys(accountFields)
        .map(key => `ac.${key}=${accountFields[key]}`)
        .join(';');
    } else {
      // Default: use order_id as primary account field
      // Also try 'account' field as fallback (some merchants use this)
      accountParams = `ac.order_id=${orderId}`;
    }
    
    let params = `m=${this.merchantId};${accountParams};a=${amountInTiyin}`;
    
    // ВАЖНО: Параметр 'c' (callback/return URL) ОПЦИОНАЛЬНЫЙ
    // Он может вызывать ошибку "[object Object]" если:
    // 1. URL не добавлен в белый список в личном кабинете Payme
    // 2. Merchant не настроен для использования return URL
    // 3. URL содержит localhost или некорректный домен
    //
    // РЕКОМЕНДАЦИЯ: НЕ использовать return URL если не уверены в настройках
    // Payme будет использовать callback API для уведомлений о платеже
    if (returnUrl && !returnUrl.includes('localhost')) {
      // Return URL should NOT be URL-encoded when inside base64
      // PayMe will handle the URL directly
      params += `;c=${returnUrl}`;
    }
    
    // Encode to base64
    const base64Params = Buffer.from(params).toString('base64');
    const fullUrl = `${this.url}/${base64Params}`;

    console.log('🔗 Payme Checkout URL Generated:');
    console.log(`   Order ID: ${orderId}`);
    console.log(`   Amount: ${amount} UZS (${amountInTiyin} tiyin)`);
    console.log(`   Merchant ID: ${this.merchantId} (length: ${this.merchantId.length})`);
    console.log(`   Return URL: ${returnUrl || 'not provided (recommended)'}`);
    console.log(`   Raw params: ${params}`);
    console.log(`   Base64: ${base64Params}`);
    console.log(`   Full URL: ${fullUrl}`);
    console.log('');
    console.log('   ⚠️  ВАЖНО: Если видите ошибку "[object Object]" на странице Payme:');
    console.log('   1. Проверьте что Merchant ID активирован в личном кабинете');
    console.log('   2. Убедитесь что account поля настроены правильно');
    console.log('   3. Если используете return URL - он должен быть в белом списке');
    console.log('   4. Попробуйте БЕЗ return URL (уберите параметр c)');

    return fullUrl;
  }

  // Verify Payme request signature
  verifySignature(request) {
    // Payme uses Basic Auth with format: Basic base64(MerchantID:SecretKey)
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      console.error('❌ Payme Auth: Missing or invalid Authorization header');
      return false;
    }

    try {
      const credentials = Buffer.from(authHeader.substring(6), 'base64').toString();
      const [username, password] = credentials.split(':');

      // Check both formats: Paycom:SecretKey (old) and MerchantID:SecretKey (correct)
      const isValid = (username === 'Paycom' && password === this.secretKey) ||
                      (username === this.merchantId && password === this.secretKey);
      
      if (!isValid) {
        console.error('❌ Payme Auth: Invalid credentials');
        console.error('   Expected MerchantID:', this.merchantId);
        console.error('   Received username:', username);
      }
      
      return isValid;
    } catch (error) {
      console.error('❌ Payme Auth: Error parsing credentials:', error.message);
      return false;
    }
  }

  // Format amount to tiyin
  toTiyin(amount) {
    return Math.round(amount * 100);
  }

  // Format amount from tiyin
  fromTiyin(amountInTiyin) {
    return amountInTiyin / 100;
  }

  /**
   * Generate alternative checkout URLs with different account field formats
   * Use this for debugging if standard checkout URL causes "[object Object]" error
   * @param {number} orderId - Order ID
   * @param {number} amount - Amount in UZS
   * @returns {Object} - Object with different URL variations
   */
  generateAlternativeCheckoutUrls(orderId, amount) {
    const amountInTiyin = Math.round(amount * 100);
    const urls = {};

    // Variation 1: ac.order_id (стандартный)
    const params1 = `m=${this.merchantId};ac.order_id=${orderId};a=${amountInTiyin}`;
    urls.standard = `${this.url}/${Buffer.from(params1).toString('base64')}`;

    // Variation 2: ac.account (альтернативный)
    const params2 = `m=${this.merchantId};ac.account=${orderId};a=${amountInTiyin}`;
    urls.account = `${this.url}/${Buffer.from(params2).toString('base64')}`;

    // Variation 3: ac.id (простой ID)
    const params3 = `m=${this.merchantId};ac.id=${orderId};a=${amountInTiyin}`;
    urls.id = `${this.url}/${Buffer.from(params3).toString('base64')}`;

    // Variation 4: несколько полей (order_id + account)
    const params4 = `m=${this.merchantId};ac.order_id=${orderId};ac.account=${orderId};a=${amountInTiyin}`;
    urls.multiple = `${this.url}/${Buffer.from(params4).toString('base64')}`;

    console.log('\n🔄 Альтернативные форматы Payme Checkout URL:');
    console.log('\n1. Стандартный (ac.order_id):');
    console.log(`   ${urls.standard}`);
    console.log('\n2. Account (ac.account):');
    console.log(`   ${urls.account}`);
    console.log('\n3. ID (ac.id):');
    console.log(`   ${urls.id}`);
    console.log('\n4. Множественные поля:');
    console.log(`   ${urls.multiple}`);
    console.log('\n💡 Попробуйте каждый URL если первый не работает');
    console.log('   Правильный формат зависит от настроек в личном кабинете Payme\n');

    return urls;
  }

  /**
   * Создает альтернативный checkout URL с разными форматами account полей
   * Используйте этот метод если стандартный createCheckoutUrl дает ошибку
   * 
   * @param {string|number} orderId - ID заказа
   * @param {number} amount - Сумма в UZS
   * @param {string} accountFieldName - Название account поля ('order_id', 'account', 'id', etc.)
   * @returns {string} Checkout URL
   */
  createCheckoutUrlAlternative(orderId, amount, accountFieldName = 'account') {
    const amountInTiyin = Math.round(amount * 100);
    
    if (!this.merchantId || this.merchantId.length !== 24) {
      throw new Error('Invalid MERCHANT_ID');
    }
    
    // Используем альтернативное название поля
    // Некоторые кассы Payme используют 'account' вместо 'order_id'
    const params = `m=${this.merchantId};ac.${accountFieldName}=${orderId};a=${amountInTiyin}`;
    const base64Params = Buffer.from(params).toString('base64');
    const fullUrl = `${this.url}/${base64Params}`;
    
    console.log(`🔄 Альтернативный Payme URL (account field: ${accountFieldName}):`);
    console.log(`   Raw params: ${params}`);
    console.log(`   URL: ${fullUrl}`);
    
    return fullUrl;
  }

  /**
   * Генерирует несколько вариантов checkout URL для тестирования
   * Используйте для отладки если основной метод не работает
   */
  generateTestUrls(orderId, amount) {
    const variants = [
      { name: 'Стандартный (order_id)', field: 'order_id' },
      { name: 'Альтернативный (account)', field: 'account' },
      { name: 'Простой (id)', field: 'id' },
      { name: 'Полный (order)', field: 'order' }
    ];
    
    console.log('\n=== ТЕСТОВЫЕ ВАРИАНТЫ PAYME URL ===');
    console.log(`Order ID: ${orderId}, Amount: ${amount} UZS\n`);
    
    const urls = {};
    variants.forEach(variant => {
      try {
        const url = this.createCheckoutUrlAlternative(orderId, amount, variant.field);
        urls[variant.field] = url;
        console.log(`✅ ${variant.name}: ${url}\n`);
      } catch (error) {
        console.log(`❌ ${variant.name}: ${error.message}\n`);
      }
    });
    
    return urls;
  }

  // Error codes according to Payme documentation
  static ERRORS = {
    // System errors
    SYSTEM_ERROR: -32400,              // System unavailable
    METHOD_NOT_FOUND: -32601,          // Method not found
    INSUFFICIENT_PRIVILEGE: -32504,    // Authorization failed
    
    // Amount errors
    INVALID_AMOUNT: -31001,            // Invalid amount
    
    // Transaction errors
    TRANSACTION_NOT_FOUND: -31003,     // Transaction not found
    COULD_NOT_PERFORM: -31008,         // Cannot perform transaction
    COULD_NOT_CANCEL: -31007,          // Cannot cancel transaction
    
    // Account errors (use range -31050 to -31099)
    INVALID_ACCOUNT: -31050,           // Account not found (order/user)
    USER_NOT_FOUND: -31051,            // User not found
    ORDER_NOT_FOUND: -31052,           // Order not found
    ORDER_ALREADY_PAID: -31053         // Order already paid
  };

  // Transaction states according to Payme documentation
  static STATES = {
    CREATED: 1,                        // Transaction created, waiting for payment
    COMPLETED: 2,                      // Payment completed successfully
    CANCELLED: -1,                     // Cancelled before completion
    CANCELLED_AFTER_COMPLETE: -2       // Cancelled after completion (refund)
  };

  // Cancellation reason codes
  static CANCEL_REASONS = {
    TIMEOUT: 4,                        // Transaction timeout (12 hours)
    REFUND_BY_MERCHANT: 5,            // Refunded by merchant
    REFUND_BY_PAYME: 1                // Refunded by Payme
  };
}

module.exports = PaymeHelper;