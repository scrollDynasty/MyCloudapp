/**
 * Monitoring and Performance Utilities
 * Tracks memory usage, performance metrics, and system health
 */

const os = require('os');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        errors: 0,
        averageResponseTime: 0
      },
      memory: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0
      },
      system: {
        cpuUsage: 0,
        freeMemory: 0,
        totalMemory: 0,
        uptime: 0
      }
    };

    this.requestTimings = [];
    this.maxTimings = 1000; // Keep last 1000 request timings

    // Start memory monitoring
    this.startMemoryMonitoring();
  }

  startMemoryMonitoring() {
    // Monitor memory every 30 seconds
    this.memoryInterval = setInterval(() => {
      this.updateMemoryMetrics();
      this.checkMemoryThresholds();
    }, 30000);
  }

  updateMemoryMetrics() {
    const memUsage = process.memoryUsage();
    const systemMem = {
      free: os.freemem(),
      total: os.totalmem()
    };

    this.metrics.memory = {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024), // MB
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      arrayBuffers: Math.round((memUsage.arrayBuffers || 0) / 1024 / 1024) // MB
    };

    this.metrics.system = {
      cpuUsage: process.cpuUsage(),
      freeMemory: Math.round(systemMem.free / 1024 / 1024), // MB
      totalMemory: Math.round(systemMem.total / 1024 / 1024), // MB
      uptime: Math.round(process.uptime()), // seconds
      loadAverage: os.loadavg()
    };
  }

  checkMemoryThresholds() {
    const heapUsedPercent = (this.metrics.memory.heapUsed / this.metrics.memory.heapTotal) * 100;
    const systemMemUsedPercent = ((this.metrics.system.totalMemory - this.metrics.system.freeMemory) / this.metrics.system.totalMemory) * 100;

    // Warn if heap usage is above 80%
    if (heapUsedPercent > 80) {
      console.warn(`⚠️  High heap usage: ${heapUsedPercent.toFixed(2)}% (${this.metrics.memory.heapUsed}MB/${this.metrics.memory.heapTotal}MB)`);
    }

    // Warn if system memory is above 90%
    if (systemMemUsedPercent > 90) {
      console.warn(`⚠️  High system memory usage: ${systemMemUsedPercent.toFixed(2)}%`);
    }

    // Suggest garbage collection if memory is high
    if (heapUsedPercent > 85 && global.gc) {
      console.log('🧹 Running manual garbage collection...');
      global.gc();
    }
  }

  // Middleware to track request metrics
  trackRequest() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Track response
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        this.metrics.requests.total++;
        
        if (res.statusCode < 400) {
          this.metrics.requests.success++;
        } else {
          this.metrics.requests.errors++;
        }

        // Store timing
        this.requestTimings.push(duration);
        
        // Keep only last N timings to prevent memory leak
        if (this.requestTimings.length > this.maxTimings) {
          this.requestTimings.shift();
        }

        // Update average response time
        this.metrics.requests.averageResponseTime = 
          this.requestTimings.reduce((a, b) => a + b, 0) / this.requestTimings.length;

        // Log slow requests
        if (duration > 5000) {
          console.warn(`🐌 Slow request: ${req.method} ${req.originalUrl} took ${duration}ms`);
        }
      });

      next();
    };
  }

  getMetrics() {
    this.updateMemoryMetrics();
    
    return {
      ...this.metrics,
      requests: {
        ...this.metrics.requests,
        successRate: this.metrics.requests.total > 0 
          ? ((this.metrics.requests.success / this.metrics.requests.total) * 100).toFixed(2) + '%'
          : '0%'
      },
      timestamp: new Date().toISOString()
    };
  }

  // Memory leak detection
  detectMemoryLeak() {
    const measurements = [];
    const interval = 5000; // 5 seconds
    const samples = 6; // 30 seconds total

    return new Promise((resolve) => {
      let count = 0;
      
      const measureInterval = setInterval(() => {
        const memUsage = process.memoryUsage();
        measurements.push(memUsage.heapUsed);
        count++;

        if (count >= samples) {
          clearInterval(measureInterval);
          
          // Check if memory is consistently increasing
          let increasing = true;
          for (let i = 1; i < measurements.length; i++) {
            if (measurements[i] < measurements[i - 1]) {
              increasing = false;
              break;
            }
          }

          const leak = {
            detected: increasing,
            measurements: measurements.map(m => Math.round(m / 1024 / 1024) + 'MB'),
            trend: increasing ? 'increasing' : 'stable'
          };

          resolve(leak);
        }
      }, interval);
    });
  }

  // Log memory snapshot
  logMemorySnapshot() {
    const mem = this.metrics.memory;
    console.log('📊 Memory Snapshot:');
    console.log(`   Heap: ${mem.heapUsed}MB / ${mem.heapTotal}MB (${((mem.heapUsed / mem.heapTotal) * 100).toFixed(2)}%)`);
    console.log(`   RSS: ${mem.rss}MB`);
    console.log(`   External: ${mem.external}MB`);
    console.log(`   System Free: ${this.metrics.system.freeMemory}MB / ${this.metrics.system.totalMemory}MB`);
  }

  destroy() {
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
    }
    this.requestTimings = [];
  }
}

// Singleton instance
const monitor = new PerformanceMonitor();

module.exports = {
  PerformanceMonitor,
  monitor
};
