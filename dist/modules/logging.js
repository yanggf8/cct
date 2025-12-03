/**
 * Enhanced Structured Logging System - TypeScript
 * Type-safe, production-ready logging with structured JSON output and domain-specific loggers
 */
// Type Definitions
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
})(LogLevel || (LogLevel = {}));
const LOG_LEVEL_NAMES = {
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.DEBUG]: 'DEBUG'
};
const ENV_TO_LEVEL = {
    'error': LogLevel.ERROR,
    'warn': LogLevel.WARN,
    'info': LogLevel.INFO,
    'debug': LogLevel.DEBUG
};
// Global configuration
let currentLogLevel = LogLevel.INFO;
let structuredLogging = false;
/**
 * Initialize logging configuration
 */
export function initLogging(env) {
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
        }
        else {
            // Fallback to legacy emoji logging
            const emoji = {
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
        error: (message, metadata = {}) => log(LogLevel.ERROR, message, metadata),
        warn: (message, metadata = {}) => log(LogLevel.WARN, message, metadata),
        info: (message, metadata = {}) => log(LogLevel.INFO, message, metadata),
        debug: (message, metadata = {}) => log(LogLevel.DEBUG, message, metadata),
        // Specialized logging methods
        request: (method, path, metadata = {}) => log(LogLevel.INFO, `${method} ${path}`, {
            type: 'http_request',
            method,
            path,
            ...metadata
        }),
        response: (status, path, duration, metadata = {}) => log(LogLevel.INFO, `Response ${status}`, {
            type: 'http_response',
            status,
            path,
            duration_ms: duration,
            ...metadata
        }),
        performance: (operation, duration, metadata = {}) => log(LogLevel.INFO, `Performance: ${operation}`, {
            type: 'performance',
            operation,
            duration_ms: duration,
            ...metadata
        }),
        security: (event, metadata = {}) => log(LogLevel.WARN, `Security event: ${event}`, {
            type: 'security',
            event,
            ...metadata
        }),
        business: (metric, value, metadata = {}) => log(LogLevel.INFO, `Business metric: ${metric}`, {
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
    if (currentLogLevel >= LogLevel.ERROR) {
        console.error(`❌ ${message}`, ...args);
    }
}
/**
 * Log warning message
 */
export function logWarn(message, ...args) {
    if (currentLogLevel >= LogLevel.WARN) {
        console.warn(`⚠️  ${message}`, ...args);
    }
}
/**
 * Log info message
 */
export function logInfo(message, ...args) {
    if (currentLogLevel >= LogLevel.INFO) {
        console.log(`ℹ️  ${message}`, ...args);
    }
}
/**
 * Log debug message
 */
export function logDebug(message, ...args) {
    if (currentLogLevel >= LogLevel.DEBUG) {
        console.log(`🔍 ${message}`, ...args);
    }
}
/**
 * Log success message (maps to INFO level)
 */
export function logSuccess(message, ...args) {
    if (currentLogLevel >= LogLevel.INFO) {
        console.log(`✅ ${message}`, ...args);
    }
}
/**
 * Log sentiment analysis debug (verbose debugging)
 */
export function logSentimentDebug(message, ...args) {
    if (currentLogLevel >= LogLevel.DEBUG) {
        console.log(`📝 ${message}`, ...args);
    }
}
/**
 * Log KV storage debug (verbose debugging)
 */
export function logKVDebug(message, ...args) {
    if (currentLogLevel >= LogLevel.DEBUG) {
        console.log(`💾 ${message}`, ...args);
    }
}
/**
 * Log AI model operations (verbose debugging)
 */
export function logAIDebug(message, ...args) {
    if (currentLogLevel >= LogLevel.DEBUG) {
        console.log(`🤖 ${message}`, ...args);
    }
}
/**
 * Check if debug logging is enabled
 */
export function isDebugEnabled() {
    return currentLogLevel >= LogLevel.DEBUG;
}
/**
 * Get current log level name
 */
export function getCurrentLogLevel() {
    return Object.keys(LogLevel)
        .find(key => LogLevel[key] === currentLogLevel) || 'UNKNOWN';
}
/**
 * Log business metric
 */
export function logBusinessMetric(metric, value, metadata = {}) {
    const logger = createLogger('business');
    logger.business(metric, value, metadata);
}
/**
 * Log health check
 */
export function logHealthCheck(component, status, details = {}) {
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
//# sourceMappingURL=logging.js.map