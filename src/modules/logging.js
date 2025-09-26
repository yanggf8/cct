/**
 * Logging Utility Module
 * Configurable logging with levels for production debugging
 */

// Log levels in order of severity
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
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

/**
 * Initialize logging configuration
 */
export function initLogging(env) {
  const logLevelEnv = env.LOG_LEVEL || 'info';
  currentLogLevel = ENV_TO_LEVEL[logLevelEnv.toLowerCase()] || LOG_LEVELS.INFO;

  if (currentLogLevel >= LOG_LEVELS.DEBUG) {
    console.log(`🔧 Logging initialized with level: ${logLevelEnv.toUpperCase()}`);
  }
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