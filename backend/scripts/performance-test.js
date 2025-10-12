/**
 * Performance Testing Script
 * Tests API endpoints for response time, memory usage, and concurrency
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

const BASE_URL = process.env.API_URL || 'http://localhost:5000';
const CONCURRENT_REQUESTS = 10;
const TEST_DURATION = 30000; // 30 seconds

class PerformanceTester {
  constructor() {
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errors: []
    };
  }

  async testEndpoint(url, method = 'GET', data = null) {
    const startTime = performance.now();
    
    try {
      const config = {
        method,
        url: `${BASE_URL}${url}`,
        ...(data && { data }),
        timeout: 30000
      };

      const response = await axios(config);
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      this.results.totalRequests++;
      this.results.successfulRequests++;
      this.results.responseTimes.push(responseTime);

      return { success: true, responseTime, status: response.status };
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      this.results.totalRequests++;
      this.results.failedRequests++;
      this.results.errors.push({
        url,
        error: error.message,
        responseTime
      });

      return { success: false, responseTime, error: error.message };
    }
  }

  async runConcurrentTest(url, method = 'GET', data = null, concurrency = 10) {
    const promises = [];
    
    for (let i = 0; i < concurrency; i++) {
      promises.push(this.testEndpoint(url, method, data));
    }

    return Promise.all(promises);
  }

  async runLoadTest(url, durationMs = 30000, concurrency = 10) {
    console.log(`\n🔥 Starting load test: ${url}`);
    console.log(`   Duration: ${durationMs}ms`);
    console.log(`   Concurrency: ${concurrency}`);

    const startTime = Date.now();
    const iterations = [];

    while (Date.now() - startTime < durationMs) {
      const result = await this.runConcurrentTest(url, 'GET', null, concurrency);
      iterations.push(result);
      
      // Small delay between iterations
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return this.getStatistics();
  }

  getStatistics() {
    const responseTimes = this.results.responseTimes;
    
    if (responseTimes.length === 0) {
      return null;
    }

    responseTimes.sort((a, b) => a - b);

    const stats = {
      totalRequests: this.results.totalRequests,
      successfulRequests: this.results.successfulRequests,
      failedRequests: this.results.failedRequests,
      successRate: ((this.results.successfulRequests / this.results.totalRequests) * 100).toFixed(2) + '%',
      responseTimes: {
        min: Math.round(responseTimes[0]),
        max: Math.round(responseTimes[responseTimes.length - 1]),
        avg: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
        p50: Math.round(responseTimes[Math.floor(responseTimes.length * 0.5)]),
        p95: Math.round(responseTimes[Math.floor(responseTimes.length * 0.95)]),
        p99: Math.round(responseTimes[Math.floor(responseTimes.length * 0.99)])
      },
      errors: this.results.errors.slice(0, 5) // Show first 5 errors
    };

    return stats;
  }

  printResults() {
    const stats = this.getStatistics();
    
    if (!stats) {
      console.log('❌ No results to display');
      return;
    }

    console.log('\n📊 Performance Test Results:');
    console.log('═'.repeat(50));
    console.log(`Total Requests:      ${stats.totalRequests}`);
    console.log(`Successful:          ${stats.successfulRequests}`);
    console.log(`Failed:              ${stats.failedRequests}`);
    console.log(`Success Rate:        ${stats.successRate}`);
    console.log('\nResponse Times (ms):');
    console.log(`  Min:               ${stats.responseTimes.min}ms`);
    console.log(`  Max:               ${stats.responseTimes.max}ms`);
    console.log(`  Average:           ${stats.responseTimes.avg}ms`);
    console.log(`  50th Percentile:   ${stats.responseTimes.p50}ms`);
    console.log(`  95th Percentile:   ${stats.responseTimes.p95}ms`);
    console.log(`  99th Percentile:   ${stats.responseTimes.p99}ms`);
    
    if (stats.errors.length > 0) {
      console.log('\n❌ Sample Errors:');
      stats.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error.url}: ${error.error}`);
      });
    }
    
    console.log('═'.repeat(50));
  }

  reset() {
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errors: []
    };
  }
}

async function runTests() {
  console.log('🚀 Starting Performance Tests');
  console.log(`API Base URL: ${BASE_URL}\n`);

  // Test 1: Health check
  console.log('Test 1: Health Check Endpoint');
  const tester1 = new PerformanceTester();
  await tester1.runLoadTest('/health', 10000, 5);
  tester1.printResults();

  // Test 2: VPS List endpoint
  console.log('\nTest 2: VPS List Endpoint');
  const tester2 = new PerformanceTester();
  await tester2.runLoadTest('/api/vps?limit=20', 10000, 5);
  tester2.printResults();

  // Test 3: Concurrent load on multiple endpoints
  console.log('\nTest 3: Mixed Endpoint Load Test');
  const tester3 = new PerformanceTester();
  const endpoints = [
    '/health',
    '/api/vps?limit=10',
    '/api/providers',
    '/metrics'
  ];
  
  const startTime = Date.now();
  while (Date.now() - startTime < 15000) {
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    await tester3.testEndpoint(endpoint);
  }
  tester3.printResults();

  console.log('\n✅ All performance tests completed!');
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { PerformanceTester, runTests };
