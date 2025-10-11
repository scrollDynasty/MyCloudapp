const crypto = require('crypto');

class PaymeHelper {
  constructor() {
    this.merchantId = process.env.PAYME_MERCHANT_ID;
    this.secretKey = process.env.PAYME_SECRET_KEY;
    this.url = process.env.PAYME_URL || 'https://checkout.paycom.uz';
  }

  generateAuthHeader() {
    const credentials = 'Paycom:' + this.secretKey;
    return 'Basic ' + Buffer.from(credentials).toString('base64');
  }

  createCheckoutUrl(orderId, amount, returnUrl = null, accountFields = null) {
    const amountInTiyin = Math.round(amount * 100);
    const orderIdNum = parseInt(orderId, 10);

    if (isNaN(orderIdNum)) {
      throw new Error('Invalid order ID');
    }

    if (!this.merchantId || this.merchantId.length !== 24) {
      throw new Error('Invalid merchant configuration');
    }

    if (amountInTiyin < 100) {
      throw new Error('Amount too small');
    }

    let accountParams;
    if (accountFields && typeof accountFields === 'object') {
      accountParams = Object.keys(accountFields)
        .map(key => 'ac.' + key + '=' + accountFields[key])
        .join(';');
    } else {
      accountParams = 'ac.order_id=' + orderIdNum;
    }

    let params = 'm=' + this.merchantId + ';' + accountParams + ';a=' + amountInTiyin;

    if (returnUrl && !returnUrl.includes('localhost')) {
      params += ';c=' + returnUrl;
    }

    const base64Params = Buffer.from(params).toString('base64');
    return this.url + '/' + base64Params;
  }

  verifySignature(request) {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return false;
    }

    try {
      const credentials = Buffer.from(authHeader.substring(6), 'base64').toString();
      const parts = credentials.split(':');
      const username = parts[0];
      const password = parts[1];

      const isValid = (username === 'Paycom' && password === this.secretKey) ||
                      (username === this.merchantId && password === this.secretKey);
      
      return isValid;
    } catch (error) {
      return false;
    }
  }

  toTiyin(amount) {
    return Math.round(amount * 100);
  }

  fromTiyin(amountInTiyin) {
    return amountInTiyin / 100;
  }

  generateAlternativeCheckoutUrls(orderId, amount) {
    const amountInTiyin = Math.round(amount * 100);
    const orderIdNum = parseInt(orderId, 10);
    const urls = {};

    const params1 = 'm=' + this.merchantId + ';ac.order_id=' + orderIdNum + ';a=' + amountInTiyin;
    urls.standard = this.url + '/' + Buffer.from(params1).toString('base64');

    const params2 = 'm=' + this.merchantId + ';ac.account=' + orderIdNum + ';a=' + amountInTiyin;
    urls.account = this.url + '/' + Buffer.from(params2).toString('base64');

    const params3 = 'm=' + this.merchantId + ';ac.id=' + orderIdNum + ';a=' + amountInTiyin;
    urls.id = this.url + '/' + Buffer.from(params3).toString('base64');

    const params4 = 'm=' + this.merchantId + ';ac.order_id=' + orderIdNum + ';ac.account=' + orderIdNum + ';a=' + amountInTiyin;
    urls.multiple = this.url + '/' + Buffer.from(params4).toString('base64');

    return urls;
  }

  static ERRORS = {
    SYSTEM_ERROR: -32400,
    METHOD_NOT_FOUND: -32601,
    INSUFFICIENT_PRIVILEGE: -32504,
    INVALID_AMOUNT: -31001,
    TRANSACTION_NOT_FOUND: -31003,
    COULD_NOT_PERFORM: -31008,
    COULD_NOT_CANCEL: -31007,
    INVALID_ACCOUNT: -31050,
    USER_NOT_FOUND: -31051,
    ORDER_NOT_FOUND: -31052,
    ORDER_ALREADY_PAID: -31053
  };

  static STATES = {
    CREATED: 1,
    COMPLETED: 2,
    CANCELLED: -1,
    CANCELLED_AFTER_COMPLETE: -2
  };

  static CANCEL_REASONS = {
    TIMEOUT: 4,
    REFUND_BY_MERCHANT: 5,
    REFUND_BY_PAYME: 1
  };
}

module.exports = PaymeHelper;
