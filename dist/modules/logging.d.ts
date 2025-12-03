/**
 * Enhanced Structured Logging System - TypeScript
 * Type-safe, production-ready logging with structured JSON output and domain-specific loggers
 */
import type { CloudflareEnvironment } from '../types.js';
export declare enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3
}
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
/**
 * Initialize logging configuration
 */
export declare function initLogging(env: CloudflareEnvironment): void;
/**
 * Create a structured logger instance for a specific service
 */
export declare function createLogger(service: string, env?: CloudflareEnvironment): Logger;
/**
 * Log error message
 */
export declare function logError(message: string, ...args: any[]): void;
/**
 * Log warning message
 */
export declare function logWarn(message: string, ...args: any[]): void;
/**
 * Log info message
 */
export declare function logInfo(message: string, ...args: any[]): void;
/**
 * Log debug message
 */
export declare function logDebug(message: string, ...args: any[]): void;
/**
 * Log success message (maps to INFO level)
 */
export declare function logSuccess(message: string, ...args: any[]): void;
/**
 * Log sentiment analysis debug (verbose debugging)
 */
export declare function logSentimentDebug(message: string, ...args: any[]): void;
/**
 * Log KV storage debug (verbose debugging)
 */
export declare function logKVDebug(message: string, ...args: any[]): void;
/**
 * Log AI model operations (verbose debugging)
 */
export declare function logAIDebug(message: string, ...args: any[]): void;
/**
 * Check if debug logging is enabled
 */
export declare function isDebugEnabled(): boolean;
/**
 * Get current log level name
 */
export declare function getCurrentLogLevel(): string;
/**
 * Log business metric
 */
export declare function logBusinessMetric(metric: string, value: any, metadata?: LogMetadata): void;
/**
 * Log health check
 */
export declare function logHealthCheck(component: string, status: string, details?: LogMetadata): void;
/**
 * Create request logger
 */
export declare function createRequestLogger(service: string): RequestLogger;
//# sourceMappingURL=logging.d.ts.map