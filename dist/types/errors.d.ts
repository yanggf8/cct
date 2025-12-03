/**
 * Comprehensive Error Type Definitions
 *
 * Replaces all catch (error: any) patterns with properly typed error handling.
 * Provides hierarchical error structure for different error categories.
 */
/**
 * Base error interface with common properties
 */
export interface BaseError {
    name: string;
    message: string;
    stack?: string;
    code?: string | number;
    timestamp?: string;
    context?: Record<string, any>;
}
/**
 * Enhanced error with additional metadata
 */
export interface EnhancedError extends BaseError {
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: ErrorCategory;
    retryable: boolean;
    statusCode?: number;
    requestId?: string;
    userId?: string;
}
/**
 * Error categories for classification
 */
export type ErrorCategory = 'validation' | 'network' | 'database' | 'authentication' | 'authorization' | 'business_logic' | 'external_api' | 'timeout' | 'rate_limit' | 'system' | 'unknown';
/**
 * Validation error for invalid input data
 */
export interface ValidationError extends EnhancedError {
    category: 'validation';
    field?: string;
    value?: any;
    constraint?: string;
}
/**
 * Network error for failed HTTP requests
 */
export interface NetworkError extends EnhancedError {
    category: 'network';
    url?: string;
    method?: string;
    statusCode?: number;
    response?: any;
    timeout?: number;
}
/**
 * Database error for KV/Durable Object operations
 */
export interface DatabaseError extends EnhancedError {
    category: 'database';
    operation?: string;
    key?: string;
    namespace?: string;
    consistencyLevel?: string;
}
/**
 * Authentication error for failed authentication
 */
export interface AuthenticationError extends EnhancedError {
    category: 'authentication';
    provider?: string;
    token?: string;
    reason?: 'invalid_token' | 'expired_token' | 'missing_token' | 'invalid_credentials';
}
/**
 * Authorization error for insufficient permissions
 */
export interface AuthorizationError extends EnhancedError {
    category: 'authorization';
    requiredPermission?: string;
    userPermissions?: string[];
    resource?: string;
}
/**
 * Business logic error for application-specific errors
 */
export interface BusinessLogicError extends EnhancedError {
    category: 'business_logic';
    businessRule?: string;
    entity?: string;
    entityId?: string;
}
/**
 * External API error for third-party service failures
 */
export interface ExternalAPIError extends EnhancedError {
    category: 'external_api';
    service?: 'yahoo_finance' | 'openai' | 'huggingface' | 'fred' | 'newsapi';
    endpoint?: string;
    rateLimit?: {
        limit: number;
        remaining: number;
        resetTime?: string;
    };
    quotaExceeded?: boolean;
}
/**
 * Timeout error for operations that exceeded time limits
 */
export interface TimeoutError extends EnhancedError {
    category: 'timeout';
    operation?: string;
    timeoutMs?: number;
    elapsedMs?: number;
}
/**
 * Rate limit error for exceeded rate limits
 */
export interface RateLimitError extends EnhancedError {
    category: 'rate_limit';
    limit?: number;
    windowMs?: number;
    resetTime?: string;
    retryAfter?: number;
}
/**
 * System error for infrastructure issues
 */
export interface SystemError extends EnhancedError {
    category: 'system';
    component?: 'worker' | 'durable_object' | 'kv' | 'r2' | 'scheduler';
    version?: string;
    memoryUsage?: number;
    cpuUsage?: number;
}
/**
 * Union type of all possible errors
 */
export type AppError = ValidationError | NetworkError | DatabaseError | AuthenticationError | AuthorizationError | BusinessLogicError | ExternalAPIError | TimeoutError | RateLimitError | SystemError | (EnhancedError & {
    category: 'unknown';
});
/**
 * Create a validation error
 */
export declare function createValidationError(message: string, field?: string, value?: any, constraint?: string): ValidationError;
/**
 * Create a network error
 */
export declare function createNetworkError(message: string, url?: string, method?: string, statusCode?: number, response?: any): NetworkError;
/**
 * Create a database error
 */
export declare function createDatabaseError(message: string, operation?: string, key?: string, namespace?: string): DatabaseError;
/**
 * Create an external API error
 */
export declare function createExternalAPIError(message: string, service: ExternalAPIError['service'], endpoint?: string, statusCode?: number): ExternalAPIError;
/**
 * Create a timeout error
 */
export declare function createTimeoutError(message: string, operation?: string, timeoutMs?: number, elapsedMs?: number): TimeoutError;
/**
 * Type guard for ValidationError
 */
export declare function isValidationError(error: any): error is ValidationError;
/**
 * Type guard for NetworkError
 */
export declare function isNetworkError(error: any): error is NetworkError;
/**
 * Type guard for DatabaseError
 */
export declare function isDatabaseError(error: any): error is DatabaseError;
/**
 * Type guard for AuthenticationError
 */
export declare function isAuthenticationError(error: any): error is AuthenticationError;
/**
 * Type guard for AuthorizationError
 */
export declare function isAuthorizationError(error: any): error is AuthorizationError;
/**
 * Type guard for ExternalAPIError
 */
export declare function isExternalAPIError(error: any): error is ExternalAPIError;
/**
 * Type guard for TimeoutError
 */
export declare function isTimeoutError(error: any): error is TimeoutError;
/**
 * Type guard for RateLimitError
 */
export declare function isRateLimitError(error: any): error is RateLimitError;
/**
 * Type guard for SystemError
 */
export declare function isSystemError(error: any): error is SystemError;
/**
 * Type guard for any AppError
 */
export declare function isAppError(error: any): error is AppError;
/**
 * Convert unknown error to AppError
 */
export declare function toAppError(error: unknown, context?: Record<string, any>): AppError;
/**
 * Error handler function type
 */
export type ErrorHandler<T = any> = (error: AppError) => T | Promise<T>;
/**
 * Async error handler function type
 */
export type AsyncErrorHandler<T = any> = (error: AppError) => Promise<T>;
/**
 * Wrap async function with error handling
 */
export declare function withErrorHandling<T extends any[], R>(fn: (...args: T) => Promise<R>, errorHandler?: ErrorHandler<R>): (...args: T) => Promise<R>;
/**
 * Extract error message safely
 */
export declare function getErrorMessage(error: unknown): string;
/**
 * Check if error is retryable
 */
export declare function isRetryableError(error: unknown): boolean;
//# sourceMappingURL=errors.d.ts.map