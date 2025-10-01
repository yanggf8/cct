/**
 * Enhanced Structured Logging System
 * Production-ready logging with structured JSON output and domain-specific loggers
 */

// Log levels in order of severity
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const LOG_LEVEL_NAMES = {
  0: 'ERROR',
  1: 'WARN',
  2: 'INFO',
  3: 'DEBUG'
};

// Default log level (can be overridden by environment)
let currentLogLevel = LOG_LEVELS.INFO;

// Map environment variable strings to log levels
const ENV_TO_LEVEL = {
  'error': LOG_LEVELS.ERROR,
  'warn': LOG_LEVELS.WARN,
  'info': LOG_LEVELS.INFO,
  'debug': LOG_LEVELS.DEBUG
};

// Global configuration
let structuredLogging = false;

/**
 * Initialize logging configuration
 */
export function initLogging(env) {
  const logLevelEnv = env.LOG_LEVEL || 'info';
  currentLogLevel = ENV_TO_LEVEL[logLevelEnv.toLowerCase()] || LOG_LEVELS.INFO;

  // Enable structured logging in production
  structuredLogging = env.STRUCTURED_LOGGING === 'true' || env.NODE_ENV === 'production';

  if (currentLogLevel >= LOG_LEVELS.DEBUG) {
    console.log(`🔧 Logging initialized with level: ${logLevelEnv.toUpperCase()}, structured: ${structuredLogging}`);
  }
}

/**
 * Create a structured logger instance for a specific service
 */
export function createLogger(service, env = null) {
  if (env) {
    initLogging(env);
  }

  /**
   * Core structured logging function
   */
  function log(level, message, metadata = {}) {
    if (level > currentLogLevel) {
      return; // Skip logging if below threshold
    }

    if (structuredLogging) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level: LOG_LEVEL_NAMES[level],
        service: service,
        message: message,
        ...metadata
      };

      // Add performance timing if available
      if (typeof performance !== 'undefined') {
        logEntry.performance_now = performance.now();
      }

      // Add environment context
      if (typeof navigator !== 'undefined' && navigator.userAgent?.includes('Cloudflare-Workers')) {
        logEntry.environment = 'cloudflare-workers';
      }

      // Output structured JSON
      const output = JSON.stringify(logEntry);

      switch (level) {
        case LOG_LEVELS.ERROR:
          console.error(output);
          break;
        case LOG_LEVELS.WARN:
          console.warn(output);
          break;
        case LOG_LEVELS.DEBUG:
          console.debug(output);
          break;
        default:
          console.log(output);
      }
    } else {
      // Fallback to legacy emoji logging
      const emoji = {
        [LOG_LEVELS.ERROR]: '❌',
        [LOG_LEVELS.WARN]: '⚠️',
        [LOG_LEVELS.INFO]: 'ℹ️',
        [LOG_LEVELS.DEBUG]: '🔍'
      }[level] || 'ℹ️';

      const prefix = `${emoji} [${service}]`;
      console.log(`${prefix} ${message}`, metadata);
    }
  }

  return {
    error: (message, metadata = {}) => log(LOG_LEVELS.ERROR, message, metadata),
    warn: (message, metadata = {}) => log(LOG_LEVELS.WARN, message, metadata),
    info: (message, metadata = {}) => log(LOG_LEVELS.INFO, message, metadata),
    debug: (message, metadata = {}) => log(LOG_LEVELS.DEBUG, message, metadata),

    // Specialized logging methods
    request: (method, path, metadata = {}) => log(LOG_LEVELS.INFO, `${method} ${path}`, {
      type: 'http_request',
      method,
      path,
      ...metadata
    }),

    response: (status, path, duration, metadata = {}) => log(LOG_LEVELS.INFO, `Response ${status}`, {
      type: 'http_response',
      status,
      path,
      duration_ms: duration,
      ...metadata
    }),

    performance: (operation, duration, metadata = {}) => log(LOG_LEVELS.INFO, `Performance: ${operation}`, {
      type: 'performance',
      operation,
      duration_ms: duration,
      ...metadata
    }),

    security: (event, metadata = {}) => log(LOG_LEVELS.WARN, `Security event: ${event}`, {
      type: 'security',
      event,
      ...metadata
    }),

    business: (metric, value, metadata = {}) => log(LOG_LEVELS.INFO, `Business metric: ${metric}`, {
      type: 'business_metric',
      metric,
      value,
      ...metadata
    })
  };
}

/**
 * Log error message
 */
export function logError(message, ...args) {
  if (currentLogLevel >= LOG_LEVELS.ERROR) {
    console.error(`❌ ${message}`, ...args);
  }
}

/**
 * Log warning message
 */
export function logWarn(message, ...args) {
  if (currentLogLevel >= LOG_LEVELS.WARN) {
    console.warn(`⚠️  ${message}`, ...args);
  }
}

/**
 * Log info message
 */
export function logInfo(message, ...args) {
  if (currentLogLevel >= LOG_LEVELS.INFO) {
    console.log(`ℹ️  ${message}`, ...args);
  }
}

/**
 * Log debug message
 */
export function logDebug(message, ...args) {
  if (currentLogLevel >= LOG_LEVELS.DEBUG) {
    console.log(`🔍 ${message}`, ...args);
  }
}

/**
 * Log success message (maps to INFO level)
 */
export function logSuccess(message, ...args) {
  if (currentLogLevel >= LOG_LEVELS.INFO) {
    console.log(`✅ ${message}`, ...args);
  }
}

/**
 * Log sentiment analysis debug (verbose debugging)
 */
export function logSentimentDebug(message, ...args) {
  if (currentLogLevel >= LOG_LEVELS.DEBUG) {
    console.log(`📝 ${message}`, ...args);
  }
}

/**
 * Log KV storage debug (verbose debugging)
 */
export function logKVDebug(message, ...args) {
  if (currentLogLevel >= LOG_LEVELS.DEBUG) {
    console.log(`💾 ${message}`, ...args);
  }
}

/**
 * Log AI model operations (verbose debugging)
 */
export function logAIDebug(message, ...args) {
  if (currentLogLevel >= LOG_LEVELS.DEBUG) {
    console.log(`🤖 ${message}`, ...args);
  }
}

/**
 * Check if debug logging is enabled
 */
export function isDebugEnabled() {
  return currentLogLevel >= LOG_LEVELS.DEBUG;
}

/**
 * Get current log level name
 */
export function getCurrentLogLevel() {
  return Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === currentLogLevel) || 'UNKNOWN';
}

// Additional exports for handler modules
export function logBusinessMetric(metric, value, metadata = {}) {
  const logger = createLogger('business');
  logger.business(metric, value, metadata);
}

export function logHealthCheck(component, status, details = {}) {
  const logger = createLogger('health');
  logger.info(`Health check: ${component}`, {
    type: 'health_check',
    component,
    status,
    details
  });
}

export function createRequestLogger(service) {
  const logger = createLogger(`request-${service}`);

  return {
    logRequest: (request) => {
      const startTime = Date.now();
      const url = new URL(request.url);

      logger.info('Request received', {
        method: request.method,
        path: url.pathname,
        userAgent: request.headers.get('User-Agent'),
        ip: request.headers.get('CF-Connecting-IP'),
        timestamp: startTime
      });

      return startTime;
    },

    logResponse: (response, path, startTime, metadata = {}) => {
      const duration = Date.now() - startTime;

      logger.info('Request completed', {
        path,
        status: response.status,
        duration,
        ...metadata
      });
    }
  };
}