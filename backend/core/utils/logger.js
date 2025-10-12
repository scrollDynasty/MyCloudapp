/**
 * Logging Utility
 * Centralized logging for better debugging and monitoring
 */

const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '../../logs');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && { data })
    };

    // Console output
    const emoji = {
      error: '❌',
      warn: '⚠️ ',
      info: 'ℹ️ ',
      debug: '🔍',
      success: '✅'
    }[level] || 'ℹ️ ';

    console.log(`${emoji} [${timestamp}] ${level.toUpperCase()}: ${message}`, data || '');

    // File output (optional, only for important logs)
    if (level === 'error' || level === 'warn') {
      this.writeToFile(level, logEntry);
    }
  }

  writeToFile(level, logEntry) {
    try {
      const filename = path.join(this.logDir, `${level}-${new Date().toISOString().split('T')[0]}.log`);
      const logLine = JSON.stringify(logEntry) + '\n';
      
      fs.appendFileSync(filename, logLine, 'utf8');
    } catch (error) {
      console.error('Failed to write log to file:', error);
    }
  }

  error(message, data) {
    this.log('error', message, data);
  }

  warn(message, data) {
    this.log('warn', message, data);
  }

  info(message, data) {
    this.log('info', message, data);
  }

  debug(message, data) {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message, data);
    }
  }

  success(message, data) {
    this.log('success', message, data);
  }
}

const logger = new Logger();

// Helper function for PayMe logging
function logPayme(type, method, data) {
  const timestamp = new Date().toISOString();
  const prefix = type === 'request' ? '📨' : type === 'response' ? '📬' : '❌';
  
  logger.info(`${prefix} Payme ${type}: ${method}`, {
    timestamp,
    type,
    method,
    data: JSON.stringify(data, null, 2)
  });
}

module.exports = {
  Logger,
  logger,
  logPayme
};
