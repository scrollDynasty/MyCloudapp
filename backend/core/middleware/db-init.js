/**
 * Database Initialization Middleware
 * Ensures database connection is established once at startup
 */

const db = require('../db/connection');

let isInitialized = false;
let initializationPromise = null;

async function initializeDatabase() {
  if (isInitialized) {
    return;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = db.connect()
    .then(() => {
      isInitialized = true;
    })
    .catch((error) => {
      console.error('Database initialization failed:', error);
      throw error;
    });

  return initializationPromise;
}

// Middleware - does nothing if DB is already initialized
function dbInitMiddleware(req, res, next) {
  if (isInitialized) {
    return next();
  }

  initializeDatabase()
    .then(() => next())
    .catch((error) => {
      res.status(503).json({
        success: false,
        error: 'Database unavailable',
        message: 'Failed to connect to database'
      });
    });
}

module.exports = {
  initializeDatabase,
  dbInitMiddleware
};
