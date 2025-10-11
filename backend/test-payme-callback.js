#!/usr/bin/env node

/**
 * Test script for Payme callback
 * Simulates Payme merchant API requests
 */

const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = process.env.API_URL || 'http://localhost:5000';
const MERCHANT_ID = process.env.PAYME_MERCHANT_ID || '65b78f9f3c319dec9d89218f';
const SECRET_KEY = process.env.PAYME_SECRET_KEY || 'n1qqWene%o6TTaorOPyk3M#wiqqRuCbTJoZD';

// Generate authorization header
function getAuthHeader() {
  const credentials = `Paycom:${SECRET_KEY}`;
  return 'Basic ' + Buffer.from(credentials).toString('base64');
}

// Test 1: CheckPerformTransaction
async function testCheckPerformTransaction(orderId, amount) {
  console.log('\n🔍 Test 1: CheckPerformTransaction');
  console.log(`Order ID: ${orderId}, Amount: ${amount} UZS\n`);

  const payload = {
    id: 1,
    method: 'CheckPerformTransaction',
    params: {
      amount: amount * 100, // Convert to tiyin
      account: {
        order_id: orderId
      }
    }
  };

  try {
    const response = await axios.post(
      `${BASE_URL}/api/payments/payme/callback`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader()
        }
      }
    );

    console.log('✅ Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

// Test 2: CreateTransaction
async function testCreateTransaction(orderId, amount) {
  console.log('\n📝 Test 2: CreateTransaction');
  console.log(`Order ID: ${orderId}, Amount: ${amount} UZS\n`);

  const transactionId = `${Date.now()}${Math.random().toString(36).substring(7)}`;
  
  const payload = {
    id: 2,
    method: 'CreateTransaction',
    params: {
      id: transactionId,
      time: Date.now(),
      amount: amount * 100,
      account: {
        order_id: orderId
      }
    }
  };

  try {
    const response = await axios.post(
      `${BASE_URL}/api/payments/payme/callback`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader()
        }
      }
    );

    console.log('✅ Response:', JSON.stringify(response.data, null, 2));
    return { data: response.data, transactionId };
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

// Test 3: PerformTransaction
async function testPerformTransaction(transactionId) {
  console.log('\n✅ Test 3: PerformTransaction');
  console.log(`Transaction ID: ${transactionId}\n`);

  const payload = {
    id: 3,
    method: 'PerformTransaction',
    params: {
      id: transactionId
    }
  };

  try {
    const response = await axios.post(
      `${BASE_URL}/api/payments/payme/callback`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader()
        }
      }
    );

    console.log('✅ Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

// Test 4: CheckTransaction
async function testCheckTransaction(transactionId) {
  console.log('\n🔍 Test 4: CheckTransaction');
  console.log(`Transaction ID: ${transactionId}\n`);

  const payload = {
    id: 4,
    method: 'CheckTransaction',
    params: {
      id: transactionId
    }
  };

  try {
    const response = await axios.post(
      `${BASE_URL}/api/payments/payme/callback`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader()
        }
      }
    );

    console.log('✅ Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

// Main test flow
async function runTests() {
  console.log('🚀 Payme Callback Test Suite');
  console.log('============================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Merchant ID: ${MERCHANT_ID}`);
  console.log('============================\n');

  // Get order ID and amount from command line
  const orderId = process.argv[2] || '14';
  const amount = parseFloat(process.argv[3] || '65000');

  console.log(`Testing with Order ID: ${orderId}, Amount: ${amount} UZS\n`);

  // Step 1: Check if transaction can be performed
  const checkResult = await testCheckPerformTransaction(orderId, amount);
  if (!checkResult || checkResult.error) {
    console.error('\n❌ CheckPerformTransaction failed. Cannot proceed.');
    return;
  }

  // Step 2: Create transaction
  const createResult = await testCreateTransaction(orderId, amount);
  if (!createResult || createResult.data.error) {
    console.error('\n❌ CreateTransaction failed. Cannot proceed.');
    return;
  }

  const transactionId = createResult.transactionId;
  console.log(`\n✅ Transaction created: ${transactionId}`);

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Step 3: Check transaction status
  await testCheckTransaction(transactionId);

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Step 4: Perform (complete) transaction
  const performResult = await testPerformTransaction(transactionId);
  if (!performResult || performResult.error) {
    console.error('\n❌ PerformTransaction failed.');
    return;
  }

  console.log('\n✅ All tests passed! Payment completed successfully.');
  console.log(`\nYou can now check order ${orderId} status - it should be "paid" and "active".`);
}

// Run tests
runTests().catch(error => {
  console.error('\n❌ Test suite failed:', error.message);
  process.exit(1);
});
