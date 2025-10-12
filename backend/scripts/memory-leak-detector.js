/**
 * Memory Leak Detection Script
 * Monitors application for memory leaks during runtime
 */

const { monitor } = require('../core/utils/monitoring');
const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:5000';
const MONITOR_INTERVAL = 5000; // 5 seconds
const DURATION = 60000; // 60 seconds

class MemoryLeakDetector {
  constructor() {
    this.measurements = [];
    this.isRunning = false;
  }

  async start(durationMs = DURATION) {
    console.log('🔍 Starting memory leak detection...');
    console.log(`   Duration: ${durationMs / 1000}s`);
    console.log(`   Monitoring interval: ${MONITOR_INTERVAL / 1000}s\n`);

    this.isRunning = true;
    const startTime = Date.now();
    let iteration = 0;

    while (Date.now() - startTime < durationMs && this.isRunning) {
      iteration++;
      
      // Get current memory metrics
      const memUsage = process.memoryUsage();
      const timestamp = Date.now();
      
      // Make some API requests to simulate load
      await this.simulateLoad();

      // Record measurement
      this.measurements.push({
        iteration,
        timestamp,
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024) // MB
      });

      console.log(`[${iteration}] Heap: ${this.measurements[this.measurements.length - 1].heapUsed}MB / ${this.measurements[this.measurements.length - 1].heapTotal}MB`);

      await new Promise(resolve => setTimeout(resolve, MONITOR_INTERVAL));
    }

    return this.analyze();
  }

  async simulateLoad() {
    try {
      // Make some requests to the API
      await Promise.all([
        axios.get(`${BASE_URL}/health`),
        axios.get(`${BASE_URL}/metrics`)
      ]);
    } catch (error) {
      // Ignore errors during simulation
    }
  }

  analyze() {
    if (this.measurements.length < 3) {
      console.log('\n❌ Not enough measurements for analysis');
      return null;
    }

    console.log('\n📊 Memory Leak Analysis:');
    console.log('═'.repeat(60));

    // Calculate trends
    const heapTrend = this.calculateTrend('heapUsed');
    const rssTrend = this.calculateTrend('rss');

    // Print measurements
    console.log('\nMemory Measurements:');
    console.log('Iteration | Heap (MB) | Total (MB) | RSS (MB)');
    console.log('-'.repeat(60));
    
    this.measurements.forEach(m => {
      console.log(`${m.iteration.toString().padStart(9)} | ${m.heapUsed.toString().padStart(9)} | ${m.heapTotal.toString().padStart(10)} | ${m.rss.toString().padStart(8)}`);
    });

    // Analyze trends
    console.log('\nTrend Analysis:');
    console.log(`Heap Usage Trend:     ${heapTrend.slope > 0.1 ? '📈 INCREASING' : '📊 STABLE'}`);
    console.log(`  Slope: ${heapTrend.slope.toFixed(4)} MB/iteration`);
    console.log(`  Change: ${heapTrend.change.toFixed(2)}MB (${heapTrend.percentChange.toFixed(2)}%)`);
    
    console.log(`\nRSS Trend:            ${rssTrend.slope > 0.1 ? '📈 INCREASING' : '📊 STABLE'}`);
    console.log(`  Slope: ${rssTrend.slope.toFixed(4)} MB/iteration`);
    console.log(`  Change: ${rssTrend.change.toFixed(2)}MB (${rssTrend.percentChange.toFixed(2)}%)`);

    // Detect potential leak
    const leakDetected = heapTrend.slope > 0.1 || rssTrend.slope > 0.1;
    
    if (leakDetected) {
      console.log('\n⚠️  POTENTIAL MEMORY LEAK DETECTED!');
      console.log('   Memory usage is consistently increasing over time.');
      console.log('   Recommendations:');
      console.log('   - Review recent code changes');
      console.log('   - Check for unclosed connections or event listeners');
      console.log('   - Look for growing caches without limits');
      console.log('   - Use heap snapshots to identify leaking objects');
    } else {
      console.log('\n✅ No significant memory leaks detected');
      console.log('   Memory usage appears stable.');
    }

    console.log('═'.repeat(60));

    return {
      leakDetected,
      heapTrend,
      rssTrend,
      measurements: this.measurements
    };
  }

  calculateTrend(metric) {
    const n = this.measurements.length;
    const values = this.measurements.map(m => m[metric]);
    const indices = this.measurements.map((_, i) => i);

    // Calculate linear regression slope
    const sumX = indices.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const change = values[values.length - 1] - values[0];
    const percentChange = (change / values[0]) * 100;

    return {
      slope,
      change,
      percentChange,
      initial: values[0],
      final: values[values.length - 1]
    };
  }

  stop() {
    this.isRunning = false;
  }
}

async function runDetection() {
  const detector = new MemoryLeakDetector();
  
  // Handle graceful exit
  process.on('SIGINT', () => {
    console.log('\n\n⏸️  Stopping detection...');
    detector.stop();
  });

  try {
    await detector.start(DURATION);
  } catch (error) {
    console.error('❌ Error during detection:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runDetection().catch(error => {
    console.error('❌ Detection failed:', error);
    process.exit(1);
  });
}

module.exports = { MemoryLeakDetector, runDetection };
