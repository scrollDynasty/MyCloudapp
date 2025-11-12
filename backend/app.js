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
const emailVerificationRoutes = require('./api/auth/email-verification');
const cardsRoutes = require('./routes/cards');
const ticketsRoutes = require('./api/tickets/tickets');

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

// Security headers middleware (after CORS to not override CORS headers)
app.use(securityHeaders);

// Simple request logger
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const method = req.method;
    const path = req.path;
    
    // Логируем только API запросы
    if (path.startsWith('/api/')) {
      if (status >= 200 && status < 300) {
        console.log(`✅ ${method} ${path} - ${status}`);
      } else if (status >= 400) {
        console.log(`⚠️ ${method} ${path} - ${status}`);
      }
    }
  });
  
  next();
});

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

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbStats = db.getPoolStats();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: require('./package.json').version,
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    database: dbStats
  });
});

// API Routes with rate limiting
app.use('/api/auth', rateLimiters.auth.middleware(), authRoutes);
app.use('/api/auth/verify-email', rateLimiters.auth.middleware(), emailVerificationRoutes);
app.use('/api/vps', rateLimiters.api.middleware(), vpsRoutes);
app.use('/api/vps-admin', rateLimiters.api.middleware(), vpsAdminRoutes);
app.use('/api/providers', rateLimiters.api.middleware(), providersRoutes);
app.use('/api/service-groups-admin', rateLimiters.api.middleware(), serviceGroupsAdminRoutes);
app.use('/api/service-plans-admin', rateLimiters.api.middleware(), servicePlansAdminRoutes);
app.use('/api/service-groups', rateLimiters.api.middleware(), serviceGroupsRoutes);
app.use('/api/service-plans', rateLimiters.api.middleware(), servicePlansRoutes);
app.use('/api/payments', rateLimiters.api.middleware(), paymentsRoutes);
app.use('/api/orders', rateLimiters.api.middleware(), ordersRoutes);
app.use('/api/cards', rateLimiters.api.middleware(), cardsRoutes);
app.use('/api/tickets', rateLimiters.api.middleware(), ticketsRoutes);

// Payment redirect routes (без /api префикса)
app.use('/', paymentRedirectRoutes);

// Email verification web route (для браузера)
app.get('/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).send(`
        <html>
          <head><title>Ошибка подтверждения</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>Ошибка</h1>
            <p>Токен подтверждения не найден.</p>
            <p><a href="${process.env.FRONTEND_WEB_URL || 'https://billing.mycloud.uz'}/auth/login">Вернуться на страницу входа</a></p>
          </body>
        </html>
      `);
    }

    // Проверяем токен через API
    const emailUtil = require('./core/utils/email');
    const result = await emailUtil.confirmEmail(token);
    
    if (result.success) {
      const mobileDeepLink = process.env.FRONTEND_URL || 'mycloud://auth';
      const webLoginUrl = `${process.env.FRONTEND_WEB_URL || 'https://billing.mycloud.uz'}/auth/login`;
      
      return res.send(`
        <!DOCTYPE html>
        <html lang="ru">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email подтверждён</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', Oxygen, Ubuntu, Cantarell, sans-serif;
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 24px;
              background: rgba(0, 0, 0, 0.6);
            }
            
            .overlay {
              display: flex;
              align-items: center;
              justify-content: center;
              width: 100%;
              max-width: 1152px;
              height: 100%;
            }
            
            .card {
              background: #FFFFFF;
              border: 1px solid #E5E7EB;
              border-radius: 48px;
              padding: 21px;
              max-width: 420px;
              width: 100%;
              box-shadow: 0px 12px 40px rgba(0, 0, 0, 0.24);
              display: flex;
              flex-direction: column;
              gap: 16px;
            }
            
            .header {
              display: flex;
              align-items: center;
            }
            
            .header-title {
              font-family: 'Inter', sans-serif;
              font-size: 18px;
              font-weight: 600;
              line-height: 21.78px;
              color: #111827;
            }
            
            .content {
              display: flex;
              flex-direction: column;
              gap: 12px;
            }
            
            .success-banner {
              display: flex;
              flex-direction: row;
              align-items: center;
              gap: 12px;
              background: #10B981;
              border: 1px solid #E5E7EB;
              border-radius: 24px;
              padding: 13px;
            }
            
            .success-icon {
              width: 18px;
              height: 18px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: rgba(255, 255, 255, 0.3);
              border-radius: 9px;
            }
            
            .success-icon svg {
              width: 15px;
              height: 15px;
              stroke: #FFFFFF;
              stroke-width: 1.5px;
            }
            
            .success-text {
              flex: 1;
              font-family: 'Inter', sans-serif;
              font-size: 14px;
              font-weight: 500;
              line-height: 16.94px;
              color: #FFFFFF;
            }
            
            .info-card {
              display: flex;
              flex-direction: column;
              gap: 8px;
              background: #FFFFFF;
              border: 1px solid #E5E7EB;
              border-radius: 24px;
              padding: 13px;
            }
            
            .info-row {
              display: flex;
              flex-direction: row;
              align-items: center;
              gap: 12px;
            }
            
            .icon-box {
              width: 36px;
              height: 36px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #F3F4F6;
              border-radius: 24px;
              flex-shrink: 0;
            }
            
            .icon-box svg {
              width: 18px;
              height: 18px;
              fill: #374151;
            }
            
            .info-text-container {
              flex: 1;
              display: flex;
              flex-direction: column;
              gap: 6px;
            }
            
            .info-title {
              font-family: 'Inter', sans-serif;
              font-size: 14px;
              font-weight: 500;
              line-height: 16.94px;
              color: #111827;
            }
            
            .info-description {
              font-family: 'Inter', sans-serif;
              font-size: 12px;
              font-weight: 400;
              line-height: 14.52px;
              color: #9CA3AF;
            }
            
            .divider {
              height: 1px;
              background: #E5E7EB;
              margin: 4px 0;
            }
            
            .note-row {
              display: flex;
              flex-direction: row;
              align-items: flex-start;
              gap: 8px;
            }
            
            .note-row svg {
              width: 16px;
              height: 16px;
              margin-top: 2px;
              flex-shrink: 0;
            }
            
            .note-text {
              flex: 1;
              font-family: 'Inter', sans-serif;
              font-size: 13px;
              font-weight: 400;
              line-height: 15.73px;
              color: #9CA3AF;
            }
            
            .redirect-banner {
              display: flex;
              flex-direction: row;
              align-items: center;
              gap: 8px;
              background: #F3F4F6;
              border: 1px dashed #E5E7EB;
              border-radius: 24px;
              padding: 11px 13px;
            }
            
            .redirect-banner svg {
              width: 16px;
              height: 16px;
              flex-shrink: 0;
            }
            
            .redirect-text {
              flex: 1;
              font-family: 'Inter', sans-serif;
              font-size: 12px;
              font-weight: 500;
              line-height: 14.52px;
              color: #374151;
            }
            
            .buttons-container {
              display: flex;
              flex-direction: row;
              gap: 8px;
            }
            
            .btn {
              flex: 1;
              display: flex;
              flex-direction: row;
              align-items: center;
              justify-content: center;
              gap: 8px;
              padding: 11px 13px;
              border-radius: 24px;
              border: 1px solid;
              cursor: pointer;
              text-decoration: none;
              font-family: 'Inter', sans-serif;
              font-size: 14px;
              font-weight: 500;
              line-height: 16.94px;
              transition: all 0.2s;
              text-align: center;
            }
            
            .btn-primary {
              background: #6366F1;
              border-color: #6366F1;
              color: #FFFFFF;
            }
            
            .btn-primary:hover {
              background: #5568d3;
              border-color: #5568d3;
            }
            
            .btn-secondary {
              background: #F3F4F6;
              border-color: #E5E7EB;
              color: #374151;
            }
            
            .btn-secondary:hover {
              background: #E5E7EB;
            }
            
            .btn svg {
              width: 18px;
              height: 18px;
              flex-shrink: 0;
            }
            
            .footer {
              display: flex;
              flex-direction: column;
              align-items: center;
              margin-top: 8px;
            }
            
            .footer-text {
              font-family: 'Inter', sans-serif;
              font-size: 12px;
              font-weight: 400;
              line-height: 14.52px;
              color: #9CA3AF;
              text-align: center;
            }
            
            @media (max-width: 480px) {
              .card {
                border-radius: 32px;
                padding: 20px;
              }
              
              .buttons-container {
                flex-direction: column;
              }
            }
          </style>
          <script>
            const deepLink = 'mycloud://auth/login';
            const webLoginUrl = '${webLoginUrl}';
            
            function tryOpenApp() {
              const iframe = document.createElement('iframe');
              iframe.style.display = 'none';
              iframe.src = deepLink;
              document.body.appendChild(iframe);
              setTimeout(() => document.body.removeChild(iframe), 2000);
            }
            
            function openMobileApp() {
              window.location.href = deepLink;
              setTimeout(() => {
                if (document.hasFocus && document.hasFocus()) {
                  window.location.href = webLoginUrl;
                }
              }, 1000);
            }
            
            function openWebApp() {
              window.location.href = webLoginUrl;
            }
            
            window.onload = tryOpenApp;
          </script>
        </head>
        <body>
          <div class="overlay">
            <div class="card">
              <div class="header">
                <h1 class="header-title">Email подтверждён</h1>
              </div>
              
              <div class="content">
                <div class="success-banner">
                  <div class="success-icon">
                    <svg viewBox="0 0 15 15" fill="none">
                      <path d="M11.25 3.75L6 9L3.75 6.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="success-text">Адрес электронной почты успешно подтверждён</div>
                </div>
                
                <div class="info-card">
                  <div class="info-row">
                    <div class="icon-box">
                      <svg viewBox="0 0 18 18" fill="none">
                        <path d="M3 3H15C15.825 3 16.5 3.675 16.5 4.5V13.5C16.5 14.325 15.825 15 15 15H3C2.175 15 1.5 14.325 1.5 13.5V4.5C1.5 3.675 2.175 3 3 3Z" stroke="currentColor" stroke-width="1.5"/>
                        <path d="M16.5 4.5L9 9.75L1.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </div>
                    <div class="info-text-container">
                      <div class="info-title">Почта подтверждена</div>
                      <div class="info-description">Спасибо! Ссылка из письма сработала, и ваш аккаунт активирован.</div>
                    </div>
                  </div>
                  
                  <div class="divider"></div>
                  
                  <div class="note-row">
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="M8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14Z" stroke="currentColor" stroke-width="1.33"/>
                      <path d="M8 5.33V8M8 10.67H8.00667" stroke="currentColor" stroke-width="1.33" stroke-linecap="round"/>
                    </svg>
                    <div class="note-text">Ввод email не требуется — мы перенаправим вас автоматически.</div>
                  </div>
                </div>
                
                <div class="redirect-banner">
                  <svg viewBox="0 0 16 16" fill="none">
                    <path d="M8 2V8M8 8L11 5M8 8L5 5M13 8C13 10.7614 10.7614 13 8 13C5.23858 13 3 10.7614 3 8C3 5.23858 5.23858 3 8 3C10.7614 3 13 5.23858 13 8Z" stroke="currentColor" stroke-width="1.33" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <div class="redirect-text">Через пару секунд вы будете перенаправлены на экран входа…</div>
                </div>
                
                <div class="buttons-container">
                  <a href="javascript:void(0)" onclick="openWebApp(); return false;" class="btn btn-primary">
                    <svg viewBox="0 0 18 18" fill="none">
                      <path d="M11.25 6.75L9 9L6.75 6.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M9 3V9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                    <span>Перейти к входу</span>
                  </a>
                  <a href="javascript:void(0)" onclick="openMobileApp(); return false;" class="btn btn-secondary">
                    <svg viewBox="0 0 18 18" fill="none">
                      <path d="M12 4.5H6C4.34315 4.5 3 5.84315 3 7.5V12C3 13.6569 4.34315 15 6 15H12C13.6569 15 15 13.6569 15 12V7.5C15 5.84315 13.6569 4.5 12 4.5Z" stroke="currentColor" stroke-width="1.5"/>
                      <path d="M7.5 9H10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                    <span>Открыть приложение</span>
                  </a>
                </div>
                
                <div class="footer">
                  <div class="footer-text">Если перенаправление не началось, вернитесь в приложение и выполните вход вручную.</div>
                </div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `);
    } else {
      return res.status(400).send(`
        <html>
          <head><title>Ошибка подтверждения</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #EF4444;">❌ Ошибка</h1>
            <p>${result.error || 'Не удалось подтвердить email'}</p>
            <p><a href="${process.env.FRONTEND_WEB_URL || 'https://billing.mycloud.uz'}/auth/login">Вернуться на страницу входа</a></p>
          </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('Email verification web route error:', error);
    return res.status(500).send(`
      <html>
        <head><title>Ошибка сервера</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>Ошибка сервера</h1>
          <p>Произошла ошибка при подтверждении email.</p>
          <p><a href="${process.env.FRONTEND_WEB_URL || 'https://billing.mycloud.uz'}/auth/login">Вернуться на страницу входа</a></p>
        </body>
      </html>
    `);
  }
});

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