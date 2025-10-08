const crypto = require('crypto');

class PaymeHelper {
  constructor() {
    this.merchantId = process.env.PAYME_MERCHANT_ID;
    this.secretKey = process.env.PAYME_SECRET_KEY;
    this.url = process.env.PAYME_URL || 'https://checkout.paycom.uz';
  }

  // Generate authorization header for Payme API
  generateAuthHeader() {
    const credentials = `Paycom:${this.secretKey}`;
    return 'Basic ' + Buffer.from(credentials).toString('base64');
  }

  // Create checkout URL
  createCheckoutUrl(orderId, amount, returnUrl) {
    // amount in tiyin (1 UZS = 100 tiyin)
    const amountInTiyin = Math.round(amount * 100);

    // Validate merchant ID
    if (!this.merchantId || this.merchantId.length === 0) {
      console.error('❌ PAYME_MERCHANT_ID is not configured!');
      throw new Error('PAYME_MERCHANT_ID is not configured');
    }
    
    // Encode params
    const paramsObject = {
      m: this.merchantId,
      ac: {
        order_id: orderId.toString()
      },
      a: amountInTiyin
    };

    // Only add return URL if it's provided and not empty
    if (returnUrl && returnUrl.trim() !== '') {
      paramsObject.c = returnUrl;
    }

    const params = Buffer.from(JSON.stringify(paramsObject)).toString('base64');
    const fullUrl = `${this.url}/${params}`;

    return fullUrl;
  }

  // Verify Payme request signature
  verifySignature(request) {
    // Payme uses Basic Auth with secret key
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return false;
    }

    const credentials = Buffer.from(authHeader.substring(6), 'base64').toString();
    const [username, password] = credentials.split(':');

    return username === 'Paycom' && password === this.secretKey;
  }

  // Format amount to tiyin
  toTiyin(amount) {
    return Math.round(amount * 100);
  }

  // Format amount from tiyin
  fromTiyin(amountInTiyin) {
    return amountInTiyin / 100;
  }

  // Error codes
  static ERRORS = {
    INVALID_AMOUNT: -31001,
    TRANSACTION_NOT_FOUND: -31003,
    INVALID_ACCOUNT: -31050,
    COULD_NOT_PERFORM: -31008,
    COULD_NOT_CANCEL: -31007
  };

  // Transaction states
  static STATES = {
    CREATED: 1,
    COMPLETED: 2,
    CANCELLED: -1,
    CANCELLED_AFTER_COMPLETE: -2
  };
}

module.exports = PaymeHelper;