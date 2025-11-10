/**
 * Comprehensive Error Type Definitions
 *
 * Replaces all catch (error: any) patterns with properly typed error handling.
 * Provides hierarchical error structure for different error categories.
 */

// ============================================================================
// Base Error Interface
// ============================================================================

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
export type ErrorCategory =
  | 'validation'
  | 'network'
  | 'database'
  | 'authentication'
  | 'authorization'
  | 'business_logic'
  | 'external_api'
  | 'timeout'
  | 'rate_limit'
  | 'system'
  | 'unknown';

// ============================================================================
// Specific Error Types
// ============================================================================

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

// ============================================================================
// Error Union Type
// ============================================================================

/**
 * Union type of all possible errors
 */
export type AppError =
  | ValidationError
  | NetworkError
  | DatabaseError
  | AuthenticationError
  | AuthorizationError
  | BusinessLogicError
  | ExternalAPIError
  | TimeoutError
  | RateLimitError
  | SystemError
  | (EnhancedError & { category: 'unknown' });

// ============================================================================
// Error Factory Functions
// ============================================================================

/**
 * Create a validation error
 */
export function createValidationError(
  message: string,
  field?: string,
  value?: any,
  constraint?: string
): ValidationError {
  return {
    name: 'ValidationError',
    message,
    field,
    value,
    constraint,
    severity: 'medium',
    category: 'validation',
    retryable: false,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a network error
 */
export function createNetworkError(
  message: string,
  url?: string,
  method?: string,
  statusCode?: number,
  response?: any
): NetworkError {
  return {
    name: 'NetworkError',
    message,
    url,
    method,
    statusCode,
    response,
    severity: statusCode && statusCode >= 500 ? 'high' : 'medium',
    category: 'network',
    retryable: statusCode ? statusCode >= 500 : true,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a database error
 */
export function createDatabaseError(
  message: string,
  operation?: string,
  key?: string,
  namespace?: string
): DatabaseError {
  return {
    name: 'DatabaseError',
    message,
    operation,
    key,
    namespace,
    severity: 'high',
    category: 'database',
    retryable: true,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create an external API error
 */
export function createExternalAPIError(
  message: string,
  service: ExternalAPIError['service'],
  endpoint?: string,
  statusCode?: number
): ExternalAPIError {
  return {
    name: 'ExternalAPIError',
    message,
    service,
    endpoint,
    statusCode,
    severity: 'medium',
    category: 'external_api',
    retryable: statusCode ? statusCode >= 500 : true,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a timeout error
 */
export function createTimeoutError(
  message: string,
  operation?: string,
  timeoutMs?: number,
  elapsedMs?: number
): TimeoutError {
  return {
    name: 'TimeoutError',
    message,
    operation,
    timeoutMs,
    elapsedMs,
    severity: 'high',
    category: 'timeout',
    retryable: true,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// Error Type Guards
// ============================================================================

/**
 * Type guard for ValidationError
 */
export function isValidationError(error: any): error is ValidationError {
  return error?.category === 'validation';
}

/**
 * Type guard for NetworkError
 */
export function isNetworkError(error: any): error is NetworkError {
  return error?.category === 'network';
}

/**
 * Type guard for DatabaseError
 */
export function isDatabaseError(error: any): error is DatabaseError {
  return error?.category === 'database';
}

/**
 * Type guard for AuthenticationError
 */
export function isAuthenticationError(error: any): error is AuthenticationError {
  return error?.category === 'authentication';
}

/**
 * Type guard for AuthorizationError
 */
export function isAuthorizationError(error: any): error is AuthorizationError {
  return error?.category === 'authorization';
}

/**
 * Type guard for ExternalAPIError
 */
export function isExternalAPIError(error: any): error is ExternalAPIError {
  return error?.category === 'external_api';
}

/**
 * Type guard for TimeoutError
 */
export function isTimeoutError(error: any): error is TimeoutError {
  return error?.category === 'timeout';
}

/**
 * Type guard for RateLimitError
 */
export function isRateLimitError(error: any): error is RateLimitError {
  return error?.category === 'rate_limit';
}

/**
 * Type guard for SystemError
 */
export function isSystemError(error: any): error is SystemError {
  return error?.category === 'system';
}

/**
 * Type guard for any AppError
 */
export function isAppError(error: any): error is AppError {
  return error && typeof error === 'object' && 'category' in error && 'severity' in error;
}

// ============================================================================
// Error Conversion Functions
// ============================================================================

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown, context?: Record<string, any>): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    // Determine category based on error message or name
    let category: ErrorCategory = 'unknown';
    let retryable = false;

    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (message.includes('timeout') || name.includes('timeout')) {
      category = 'timeout';
      retryable = true;
    } else if (message.includes('network') || message.includes('fetch') || name.includes('network')) {
      category = 'network';
      retryable = true;
    } else if (message.includes('validation') || message.includes('invalid')) {
      category = 'validation';
      retryable = false;
    } else if (message.includes('unauthorized') || message.includes('authentication')) {
      category = 'authentication';
      retryable = false;
    } else if (message.includes('forbidden') || message.includes('permission')) {
      category = 'authorization';
      retryable = false;
    } else if (message.includes('rate limit') || message.includes('too many requests')) {
      category = 'rate_limit';
      retryable = true;
    } else if (message.includes('database') || message.includes('kv') || message.includes('storage')) {
      category = 'database';
      retryable = true;
    }

    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      severity: category === 'database' ? 'high' : 'medium',
      category,
      retryable,
      timestamp: new Date().toISOString(),
      context,
    };
  }

  if (typeof error === 'string') {
    return {
      name: 'StringError',
      message: error,
      severity: 'medium',
      category: 'unknown',
      retryable: false,
      timestamp: new Date().toISOString(),
      context,
    };
  }

  return {
    name: 'UnknownError',
    message: String(error),
    severity: 'medium',
    category: 'unknown',
    retryable: false,
    timestamp: new Date().toISOString(),
    context,
  };
}

// ============================================================================
// Error Handler Type
// ============================================================================

/**
 * Error handler function type
 */
export type ErrorHandler<T = any> = (error: AppError) => T | Promise<T>;

/**
 * Async error handler function type
 */
export type AsyncErrorHandler<T = any> = (error: AppError) => Promise<T>;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  errorHandler?: ErrorHandler<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const appError = toAppError(error);

      if (errorHandler) {
        return errorHandler(appError);
      }

      // Default error handling
      console.error('Unhandled error:', appError);
      throw appError;
    }
  };
}

/**
 * Extract error message safely
 */
export function getErrorMessage(error: unknown): string {
  if (isAppError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (isAppError(error)) {
    return error.retryable;
  }

  // Default retryable conditions for unknown errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('timeout') ||
           message.includes('network') ||
           message.includes('connection') ||
           error.name.toLowerCase().includes('timeout');
  }

  return false;
}