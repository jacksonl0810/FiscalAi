/**
 * Enhanced Error Logging Utility
 * 
 * Provides structured logging with better error tracking
 */

/**
 * Log levels
 */
export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

/**
 * Structured log entry
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {object} context - Additional context (user, request, etc.)
 * @param {Error} error - Error object (optional)
 */
export function log(level, message, context = {}, error = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...context
  };

  if (error) {
    logEntry.error = {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      code: error.code,
      status: error.status
    };
  }

  // Format based on environment
  if (process.env.NODE_ENV === 'production') {
    // JSON format for production (easier to parse by log aggregators)
    console.log(JSON.stringify(logEntry));
  } else {
    // Human-readable format for development
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    console.log(prefix, message);
    if (Object.keys(context).length > 0) {
      console.log('Context:', context);
    }
    if (error) {
      console.error('Error:', error.message);
      if (error.stack) {
        console.error(error.stack);
      }
    }
  }

  return logEntry;
}

/**
 * Log error with context
 * @param {string} message - Error message
 * @param {Error} error - Error object
 * @param {object} context - Additional context
 */
export function logError(message, error, context = {}) {
  return log(LOG_LEVELS.ERROR, message, context, error);
}

/**
 * Log warning with context
 * @param {string} message - Warning message
 * @param {object} context - Additional context
 */
export function logWarn(message, context = {}) {
  return log(LOG_LEVELS.WARN, message, context);
}

/**
 * Log info with context
 * @param {string} message - Info message
 * @param {object} context - Additional context
 */
export function logInfo(message, context = {}) {
  return log(LOG_LEVELS.INFO, message, context);
}

/**
 * Log debug with context (only in development)
 * @param {string} message - Debug message
 * @param {object} context - Additional context
 */
export function logDebug(message, context = {}) {
  if (process.env.NODE_ENV === 'development') {
    return log(LOG_LEVELS.DEBUG, message, context);
  }
}

/**
 * Create request context for logging
 * @param {object} req - Express request object
 * @returns {object} Request context
 */
export function getRequestContext(req) {
  return {
    userId: req.user?.id,
    userEmail: req.user?.email,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent')
  };
}

/**
 * Log API request
 * @param {object} req - Express request object
 * @param {object} responseData - Response data (optional)
 */
export function logRequest(req, responseData = null) {
  const context = getRequestContext(req);
  if (responseData) {
    context.responseStatus = responseData.status;
  }
  logInfo(`${req.method} ${req.path}`, context);
}

/**
 * Log API error
 * @param {object} req - Express request object
 * @param {Error} error - Error object
 */
export function logRequestError(req, error) {
  const context = getRequestContext(req);
  logError(`Error in ${req.method} ${req.path}`, error, context);
}
