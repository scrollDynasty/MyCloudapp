/**
 * Rate Limiting Middleware
 * Protects API from abuse and prevents resource exhaustion
 */

class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
    this.maxRequests = options.maxRequests || 100;
    this.message = options.message || 'Too many requests, please try again later';
    this.skipSuccessfulRequests = options.skipSuccessfulRequests || false;
    
    // Use Map instead of plain object for better memory management
    this.clients = new Map();
    
    // Clean up old entries periodically to prevent memory leaks
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.windowMs);
  }

  middleware() {
    return (req, res, next) => {
      const key = this.getKey(req);
      const now = Date.now();
      
      // Get or create client record
      let clientData = this.clients.get(key);
      
      if (!clientData) {
        clientData = {
          count: 0,
          resetTime: now + this.windowMs,
          firstRequest: now
        };
        this.clients.set(key, clientData);
      }

      // Reset if window has passed
      if (now > clientData.resetTime) {
        clientData.count = 0;
        clientData.resetTime = now + this.windowMs;
        clientData.firstRequest = now;
      }

      // Increment request count
      clientData.count++;

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.maxRequests - clientData.count));
      res.setHeader('X-RateLimit-Reset', new Date(clientData.resetTime).toISOString());

      // Check if limit exceeded
      if (clientData.count > this.maxRequests) {
        const retryAfter = Math.ceil((clientData.resetTime - now) / 1000);
        res.setHeader('Retry-After', retryAfter);
        
        return res.status(429).json({
          success: false,
          error: this.message,
          retryAfter: retryAfter
        });
      }

      next();
    };
  }

  getKey(req) {
    // Use IP address as key, can be extended to use API keys
    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  cleanup() {
    const now = Date.now();
    const keysToDelete = [];

    // Find expired entries
    for (const [key, data] of this.clients.entries()) {
      if (now > data.resetTime + this.windowMs) {
        keysToDelete.push(key);
      }
    }

    // Delete expired entries to prevent memory leaks
    keysToDelete.forEach(key => this.clients.delete(key));

    if (keysToDelete.length > 0) {
      console.log(`🧹 Rate limiter cleaned up ${keysToDelete.length} expired entries`);
    }
  }

  // Get current stats for monitoring
  getStats() {
    return {
      totalClients: this.clients.size,
      windowMs: this.windowMs,
      maxRequests: this.maxRequests
    };
  }

  // Clean up on shutdown
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clients.clear();
  }
}

// Create rate limiters for different routes
const createRateLimiter = (options) => new RateLimiter(options);

// Preset configurations
const rateLimiters = {
  // Strict rate limiting for auth endpoints
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many authentication attempts, please try again later'
  }),

  // Standard rate limiting for API endpoints
  api: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: 'Too many requests, please try again later'
  }),

  // Lenient rate limiting for public endpoints
  public: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 300,
    message: 'Too many requests, please try again later'
  })
};

module.exports = {
  RateLimiter,
  createRateLimiter,
  rateLimiters
};
