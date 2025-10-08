const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const bodyParser = require('body-parser');
const passport = require('passport');
const session = require('express-session');
require('dotenv').config();

// Import routes
const vpsRoutes = require('./api/services/vps');
const paymentsRoutes = require('./api/payments/payme');
const ordersRoutes = require('./api/orders/orders');
const authRoutes = require('./api/auth/auth');

// Setup Google OAuth
const setupGoogleOAuth = require('./core/config/google-oauth');
setupGoogleOAuth();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet()); // Security headers
app.use(compression()); // Compress responses
app.use(morgan('combined')); // Logging

// CORS configuration - allow multiple origins for development
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:19006',
  'exp://localhost:8081',
  process.env.CORS_ORIGIN
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins in development
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Session middleware (for OAuth)
app.use(session({
  secret: process.env.JWT_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: require('./package.json').version,
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/vps', vpsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/auth', authRoutes);

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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 VPS Billing API Server running on port ${PORT}`);
  console.log(`📖 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}`);
});

module.exports = app;