const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const bodyParser = require('body-parser');
const passport = require('passport');
const session = require('express-session');
require('dotenv').config();

const { securityHeaders, rateLimit, validateInput } = require('./core/middleware/security');
const securityUtils = require('./core/utils/security');

// Import core utilities
const db = require('./core/db/connection');
const { initializeDatabase } = require('./core/middleware/db-init');
const { rateLimiters } = require('./core/middleware/rate-limiter');
const requestTimeout = require('./core/middleware/request-timeout');
const { monitor } = require('./core/utils/monitoring');
const { logger } = require('./core/utils/logger');
const { startOrderCleanupJob } = require('./core/utils/order-cleanup');

// Import routes
const vpsRoutes = require('./api/services/vps');
const vpsAdminRoutes = require('./api/services/vps-admin');
const providersRoutes = require('./api/services/providers');
const serviceGroupsAdminRoutes = require('./api/services/service-groups-admin');
const servicePlansAdminRoutes = require('./api/services/service-plans-admin');
const serviceGroupsRoutes = require('./api/services/service-groups');
const servicePlansRoutes = require('./api/services/service-plans');
const paymentsRoutes = require('./api/payments/payme');
const paymentRedirectRoutes = require('./api/payments/redirect');
const ordersRoutes = require('./api/orders/orders');
const authRoutes = require('./api/auth/auth');

// Setup Google OAuth
const setupGoogleOAuth = require('./core/config/google-oauth');
setupGoogleOAuth();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration - MUST be before security headers
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:5173', // Vite dev server
  'http://localhost:19006',
  'exp://localhost:8081',
  'https://crm.mycloud.uz', // CRM Production
  'https://billing.mycloud.uz', // Mobile App
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [])
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // In production, check if it's a development origin pattern
      if (process.env.NODE_ENV === 'production') {
        // Allow localhost origins even in production for development
        if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('exp://')) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      } else {
        callback(null, true);
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'Pragma',
    'Expires',
    'ngrok-skip-browser-warning',
    'User-Agent',
    'X-CSRF-Token',
    'X-Session-Id'
  ],
  exposedHeaders: ['X-CSRF-Token', 'X-Session-Id'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Handle preflight requests explicitly for all routes
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  if (allowedOrigins.indexOf(origin) !== -1 || !origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, Expires, ngrok-skip-browser-warning, User-Agent, X-CSRF-Token, X-Session-Id');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(204);
  } else {
    res.sendStatus(403);
  }
});

// Performance monitoring
app.use(monitor.trackRequest());

// Security headers middleware (after CORS to not override CORS headers)
app.use(securityHeaders);

// Rate limiting для всех запросов
app.use(rateLimit(100, 15 * 60 * 1000)); // 100 запросов в 15 минут

// Request timeout to prevent hanging requests
app.use(requestTimeout(30000)); // 30 second timeout

// Reduced payload size limits to prevent memory issues
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '2mb' }));

// Disable caching for API responses
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Static files (для HTML страниц)
app.use(express.static('public'));

// Session middleware (for OAuth only, not for API endpoints)
// Note: For production, use Redis or other external session store to prevent memory leaks
app.use(session({
  secret: process.env.JWT_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite: 'lax'
  },
  // TODO: Add external session store for production (e.g., connect-redis)
  // store: new RedisStore({ client: redisClient })
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Health check endpoint with detailed metrics
app.get('/health', async (req, res) => {
  const metrics = monitor.getMetrics();
  const dbStats = db.getPoolStats();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: require('./package.json').version,
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: metrics.memory,
    database: dbStats
  });
});

// Metrics endpoint (for monitoring tools)
app.get('/metrics', (req, res) => {
  const metrics = monitor.getMetrics();
  res.json(metrics);
});

// API Routes with rate limiting
app.use('/api/auth', rateLimiters.auth.middleware(), authRoutes);
app.use('/api/vps', rateLimiters.api.middleware(), vpsRoutes);
app.use('/api/vps-admin', rateLimiters.api.middleware(), vpsAdminRoutes);
app.use('/api/providers', rateLimiters.api.middleware(), providersRoutes);
app.use('/api/service-groups-admin', rateLimiters.api.middleware(), serviceGroupsAdminRoutes);
app.use('/api/service-plans-admin', rateLimiters.api.middleware(), servicePlansAdminRoutes);
app.use('/api/service-groups', rateLimiters.api.middleware(), serviceGroupsRoutes);
app.use('/api/service-plans', rateLimiters.api.middleware(), servicePlansRoutes);
app.use('/api/payments', rateLimiters.api.middleware(), paymentsRoutes);
app.use('/api/orders', rateLimiters.api.middleware(), ordersRoutes);

// Payment redirect routes (без /api префикса)
app.use('/', paymentRedirectRoutes);

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'VPS Billing System API',
    version: require('./package.json').version,
    endpoints: {
      health: '/health',
      vps: '/api/vps',
      payments: '/api/payments/payme',
      orders: '/api/orders',
      auth: '/api/auth'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Initialize database and start server
let server;

async function startServer() {
  try {
    // Initialize database connection
    await initializeDatabase();
    logger.success('Database connected successfully');

    // Start HTTP server
    server = app.listen(PORT, () => {
      logger.success(`VPS Billing API Server running on port ${PORT}`);
      
      // Start order cleanup job
      startOrderCleanupJob();
      
      // Only show detailed info in development
      if (process.env.NODE_ENV === 'development') {
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`API Base URL: http://localhost:${PORT}`);
        logger.info(`Health check: http://localhost:${PORT}/health`);
      }
    });

    // Handle server errors
    server.on('error', (error) => {
      logger.error('Server error:', error);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown handler
async function gracefulShutdown(signal) {
  logger.warn(`${signal} received, shutting down...`);
  
  if (server) {
    // Stop accepting new connections
    server.close(async () => {
      try {
        // Close database connections
        await db.close();
        
        // Clean up monitoring
        monitor.destroy();
        
        // Clean up rate limiters
        Object.values(rateLimiters).forEach(limiter => limiter.destroy());
        
        logger.success('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  // Don't exit on unhandled rejections, just log them
});

// Start the server
startServer();

module.exports = app;