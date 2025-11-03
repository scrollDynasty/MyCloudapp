/**
 * Logging Utility
 * Centralized logging for better debugging and monitoring
 */

class Logger {
  log(level, message, data = null) {
    const timestamp = new Date().toISOString();

    const shouldLog = process.env.NODE_ENV === 'development' || level === 'error' || level === 'warn';
    
    if (shouldLog) {
      const emoji = {
        error: '❌',
        warn: '⚠️ ',
        info: 'ℹ️ ',
        debug: '🔍',
        success: '✅'
      }[level] || 'ℹ️ ';

      console.log(`${emoji} [${timestamp}] ${level.toUpperCase()}: ${message}`, data || '');
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

function logPayme(type, method, data) {
  if (process.env.NODE_ENV === 'development' || type === 'error') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'request' ? '📨' : type === 'response' ? '📬' : '❌';
    
    logger.info(`${prefix} Payme ${type}: ${method}`, {
      timestamp,
      type,
      method,
      data: JSON.stringify(data, null, 2)
    });
  }
}

module.exports = {
  Logger,
  logger,
  logPayme
};
