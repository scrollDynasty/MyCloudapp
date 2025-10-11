# PayMe Integration Documentation

## Overview
This document describes the PayMe payment integration for the VPS Billing System. The integration follows the official PayMe Merchant API documentation.

## Configuration

### Environment Variables
The following environment variables must be configured in `.env`:

```bash
PAYME_MERCHANT_ID=your_merchant_id_here
PAYME_SECRET_KEY=your_secret_key_here
PAYME_URL=https://checkout.paycom.uz
PAYME_API_URL=https://checkout.paycom.uz/api
RETURN_URL=https://yourdomain.com/payment-success
```

⚠️ **Important**: Do NOT use quotes around the secret key value in `.env` file.

### Test Environment
For testing, use PayMe's test environment:
```bash
PAYME_MERCHANT_ID=your_test_merchant_id
PAYME_SECRET_KEY=your_test_secret_key
PAYME_URL=https://checkout.test.paycom.uz
```

## Payment Flow

### 1. Create Payment
**Endpoint**: `POST /api/payments/payme`

**Request**:
```json
{
  "order_id": 123,
  "return_url": "https://yourdomain.com/payment-success?order_id=123"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "order_id": 123,
    "checkout_url": "https://checkout.paycom.uz/base64_encoded_params",
    "amount": 50000,
    "currency": "UZS"
  }
}
```

### 2. Redirect to PayMe Checkout
The frontend should redirect the user to the `checkout_url` where they can complete the payment.

### 3. PayMe Callback
PayMe will call the callback endpoint to process the payment:
**Endpoint**: `POST /api/payments/payme/callback`

This endpoint implements the following PayMe Merchant API methods:
- `CheckPerformTransaction` - Validate the transaction before processing
- `CreateTransaction` - Create a transaction record
- `PerformTransaction` - Complete the payment
- `CancelTransaction` - Cancel the transaction
- `CheckTransaction` - Check transaction status
- `GetStatement` - Get transactions for a period

### 4. Payment Success
After successful payment, PayMe redirects the user to:
`GET /payment-success?order_id=123`

## Database Schema

### payme_transactions Table
```sql
CREATE TABLE payme_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payme_transaction_id VARCHAR(255) UNIQUE NOT NULL,
  order_id INT NOT NULL,
  payme_time BIGINT NOT NULL,
  amount BIGINT NOT NULL,
  account TEXT NOT NULL,
  create_time BIGINT NOT NULL,
  perform_time BIGINT DEFAULT NULL,
  cancel_time BIGINT DEFAULT NULL,
  transaction VARCHAR(255) NOT NULL,
  state INT NOT NULL,
  reason INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
```

### orders Table (PayMe fields)
The orders table includes the following PayMe-related fields:
- `payment_method` - Payment method (e.g., 'payme')
- `payment_status` - Payment status (pending, paid, cancelled)
- `payme_transaction_id` - PayMe transaction ID
- `payme_transaction_time` - Transaction creation time
- `payme_perform_time` - Transaction completion time
- `payme_cancel_time` - Transaction cancellation time
- `payme_cancel_reason` - Cancellation reason code
- `payme_state` - PayMe transaction state

## Transaction States

According to PayMe documentation:
- `1` - Transaction created (waiting for payment)
- `2` - Transaction completed (payment successful)
- `-1` - Transaction cancelled (before completion)
- `-2` - Transaction cancelled after completion (refund)

## Error Codes

The integration uses official PayMe error codes:
- `-32400` - System error
- `-32504` - Authorization failed
- `-32601` - Method not found
- `-31001` - Invalid amount
- `-31003` - Transaction not found
- `-31007` - Cannot cancel transaction
- `-31008` - Cannot perform transaction
- `-31050` - Invalid account
- `-31051` - User not found
- `-31052` - Order not found
- `-31053` - Order already paid

## Security

### Authentication
PayMe uses HTTP Basic Authentication for callback requests:
- Format: `Basic base64(MerchantID:SecretKey)`
- All callback requests are verified using this authentication

### Signature Verification
The helper class `PaymeHelper` verifies all incoming requests from PayMe to ensure they are authentic.

## Amount Handling

⚠️ **Important**: PayMe uses "tiyin" as the currency unit.
- 1 UZS = 100 tiyin
- Always multiply UZS amounts by 100 when sending to PayMe
- Always divide by 100 when receiving amounts from PayMe

**Example**:
```javascript
// Converting to tiyin
const amountInUzs = 50000; // 50,000 UZS
const amountInTiyin = amountInUzs * 100; // 5,000,000 tiyin

// Converting from tiyin
const tiyinAmount = 5000000;
const uzsAmount = tiyinAmount / 100; // 50,000 UZS
```

## Checkout URL Format

The checkout URL follows PayMe's official format:
```
https://checkout.paycom.uz/{base64_encoded_params}
```

Where params is a string (NOT JSON):
```
m=merchant_id;ac.order_id=123;a=5000000
```

This is then base64 encoded and appended to the checkout URL.

## Testing

### Test Card Numbers
PayMe provides test cards for testing payments:
- **Successful payment**: 8600 xxxx xxxx xxxx
- **Insufficient funds**: 8600 xxxx xxxx xxxx (different card)

Contact PayMe support for specific test card numbers.

## Common Issues

### 1. "Object" Error on Frontend
**Solution**: Properly handle error messages in the frontend. Always check if the error is a string or object and format accordingly.

### 2. Merchant ID Not Configured
**Solution**: Ensure `PAYME_MERCHANT_ID` is set in `.env` and is exactly 24 characters long.

### 3. Invalid Signature
**Solution**: Verify that `PAYME_SECRET_KEY` is correct and doesn't contain quotes or extra spaces.

### 4. Localhost URLs Rejected
**Solution**: PayMe rejects localhost URLs. Use ngrok or a public domain for testing.

## API Endpoints

### Create Payment
```bash
POST /api/payments/payme
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "order_id": 123,
  "return_url": "https://yourdomain.com/payment-success"
}
```

### Check Payment Status
```bash
GET /api/payments/payme/status/123
Authorization: Bearer {jwt_token}
```

### PayMe Callback (Internal)
```bash
POST /api/payments/payme/callback
Authorization: Basic {base64(MerchantID:SecretKey)}
Content-Type: application/json

{
  "method": "CheckPerformTransaction",
  "params": {
    "account": {
      "order_id": 123
    },
    "amount": 5000000
  },
  "id": 1
}
```

## Official Documentation

For complete documentation, visit:
- PayMe Developer Portal: https://developer.help.paycom.uz/
- Merchant API: https://developer.help.paycom.uz/metody-merchant-api/
- Checkout Initialization: https://developer.help.paycom.uz/initsializatsiya-platezhey/

## Support

For PayMe integration support:
- Email: support@paycom.uz
- Phone: +998 (71) 200-21-00
