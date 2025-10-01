/**
 * Enhanced Structured Logging System - TypeScript
 * Type-safe, production-ready logging with structured JSON output and domain-specific loggers
 */

import type { CloudflareEnvironment } from '../types.js';

// Type Definitions
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.DEBUG]: 'DEBUG'
};

const ENV_TO_LEVEL: Record<string, LogLevel> = {
  'error': LogLevel.ERROR,
  'warn': LogLevel.WARN,
  'info': LogLevel.INFO,
  'debug': LogLevel.DEBUG
};

export interface LogMetadata {
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  service: string;
  message: string;
  performance_now?: number;
  environment?: string;
  [key: string]: any;
}

export interface Logger {
  error(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  debug(message: string, metadata?: LogMetadata): void;
  request(method: string, path: string, metadata?: LogMetadata): void;
  response(status: number, path: string, duration: number, metadata?: LogMetadata): void;
  performance(operation: string, duration: number, metadata?: LogMetadata): void;
  security(event: string, metadata?: LogMetadata): void;
  business(metric: string, value: any, metadata?: LogMetadata): void;
}

export interface RequestLogger {
  logRequest(request: Request): number;
  logResponse(response: Response, path: string, startTime: number, metadata?: LogMetadata): void;
}

// Global configuration
let currentLogLevel: LogLevel = LogLevel.INFO;
let structuredLogging = false;

/**
 * Initialize logging configuration
 */
export function initLogging(env: CloudflareEnvironment): void {
  const logLevelEnv = env.LOG_LEVEL || 'info';
  currentLogLevel = ENV_TO_LEVEL[logLevelEnv.toLowerCase()] || LogLevel.INFO;

  // Enable structured logging in production
  structuredLogging = env.STRUCTURED_LOGGING === 'true' || env.NODE_ENV === 'production';

  if (currentLogLevel >= LogLevel.DEBUG) {
    console.log(`🔧 Logging initialized with level: ${logLevelEnv.toUpperCase()}, structured: ${structuredLogging}`);
  }
}

/**
 * Create a structured logger instance for a specific service
 */
export function createLogger(service: string, env: CloudflareEnvironment = null): Logger {
  if (env) {
    initLogging(env);
  }

  /**
   * Core structured logging function
   */
  function log(level: LogLevel, message: string, metadata: LogMetadata = {}): void {
    if (level > currentLogLevel) {
      return; // Skip logging if below threshold
    }

    if (structuredLogging) {
      const logEntry: LogEntry = {
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
      if (typeof navigator !== 'undefined' && (navigator as any).userAgent?.includes('Cloudflare-Workers')) {
        logEntry.environment = 'cloudflare-workers';
      }

      // Output structured JSON
      const output = JSON.stringify(logEntry);

      switch (level) {
        case LogLevel.ERROR:
          console.error(output);
          break;
        case LogLevel.WARN:
          console.warn(output);
          break;
        case LogLevel.DEBUG:
          console.debug(output);
          break;
        default:
          console.log(output);
      }
    } else {
      // Fallback to legacy emoji logging
      const emoji: Record<LogLevel, string> = {
        [LogLevel.ERROR]: '❌',
        [LogLevel.WARN]: '⚠️',
        [LogLevel.INFO]: 'ℹ️',
        [LogLevel.DEBUG]: '🔍'
      };

      const prefix = `${emoji[level] || 'ℹ️'} [${service}]`;
      console.log(`${prefix} ${message}`, metadata);
    }
  }

  return {
    error: (message: string, metadata: LogMetadata = {}): void => log(LogLevel.ERROR, message, metadata),
    warn: (message: string, metadata: LogMetadata = {}): void => log(LogLevel.WARN, message, metadata),
    info: (message: string, metadata: LogMetadata = {}): void => log(LogLevel.INFO, message, metadata),
    debug: (message: string, metadata: LogMetadata = {}): void => log(LogLevel.DEBUG, message, metadata),

    // Specialized logging methods
    request: (method: string, path: string, metadata: LogMetadata = {}): void => log(LogLevel.INFO, `${method} ${path}`, {
      type: 'http_request',
      method,
      path,
      ...metadata
    }),

    response: (status: number, path: string, duration: number, metadata: LogMetadata = {}): void => log(LogLevel.INFO, `Response ${status}`, {
      type: 'http_response',
      status,
      path,
      duration_ms: duration,
      ...metadata
    }),

    performance: (operation: string, duration: number, metadata: LogMetadata = {}): void => log(LogLevel.INFO, `Performance: ${operation}`, {
      type: 'performance',
      operation,
      duration_ms: duration,
      ...metadata
    }),

    security: (event: string, metadata: LogMetadata = {}): void => log(LogLevel.WARN, `Security event: ${event}`, {
      type: 'security',
      event,
      ...metadata
    }),

    business: (metric: string, value: any, metadata: LogMetadata = {}): void => log(LogLevel.INFO, `Business metric: ${metric}`, {
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
export function logError(message: string, ...args: any[]): void {
  if (currentLogLevel >= LogLevel.ERROR) {
    console.error(`❌ ${message}`, ...args);
  }
}

/**
 * Log warning message
 */
export function logWarn(message: string, ...args: any[]): void {
  if (currentLogLevel >= LogLevel.WARN) {
    console.warn(`⚠️  ${message}`, ...args);
  }
}

/**
 * Log info message
 */
export function logInfo(message: string, ...args: any[]): void {
  if (currentLogLevel >= LogLevel.INFO) {
    console.log(`ℹ️  ${message}`, ...args);
  }
}

/**
 * Log debug message
 */
export function logDebug(message: string, ...args: any[]): void {
  if (currentLogLevel >= LogLevel.DEBUG) {
    console.log(`🔍 ${message}`, ...args);
  }
}

/**
 * Log success message (maps to INFO level)
 */
export function logSuccess(message: string, ...args: any[]): void {
  if (currentLogLevel >= LogLevel.INFO) {
    console.log(`✅ ${message}`, ...args);
  }
}

/**
 * Log sentiment analysis debug (verbose debugging)
 */
export function logSentimentDebug(message: string, ...args: any[]): void {
  if (currentLogLevel >= LogLevel.DEBUG) {
    console.log(`📝 ${message}`, ...args);
  }
}

/**
 * Log KV storage debug (verbose debugging)
 */
export function logKVDebug(message: string, ...args: any[]): void {
  if (currentLogLevel >= LogLevel.DEBUG) {
    console.log(`💾 ${message}`, ...args);
  }
}

/**
 * Log AI model operations (verbose debugging)
 */
export function logAIDebug(message: string, ...args: any[]): void {
  if (currentLogLevel >= LogLevel.DEBUG) {
    console.log(`🤖 ${message}`, ...args);
  }
}

/**
 * Check if debug logging is enabled
 */
export function isDebugEnabled(): boolean {
  return currentLogLevel >= LogLevel.DEBUG;
}

/**
 * Get current log level name
 */
export function getCurrentLogLevel(): string {
  return Object.keys(LogLevel)
    .find(key => LogLevel[key as keyof typeof LogLevel] === currentLogLevel) || 'UNKNOWN';
}

/**
 * Log business metric
 */
export function logBusinessMetric(metric: string, value: any, metadata: LogMetadata = {}): void {
  const logger = createLogger('business');
  logger.business(metric, value, metadata);
}

/**
 * Log health check
 */
export function logHealthCheck(component: string, status: string, details: LogMetadata = {}): void {
  const logger = createLogger('health');
  logger.info(`Health check: ${component}`, {
    type: 'health_check',
    component,
    status,
    details
  });
}

/**
 * Create request logger
 */
export function createRequestLogger(service: string): RequestLogger {
  const logger = createLogger(`request-${service}`);

  return {
    logRequest: (request: Request): number => {
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

    logResponse: (response: Response, path: string, startTime: number, metadata: LogMetadata = {}): void => {
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
