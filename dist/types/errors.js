/**
 * Comprehensive Error Type Definitions
 *
 * Replaces all catch (error: any) patterns with properly typed error handling.
 * Provides hierarchical error structure for different error categories.
 */
// ============================================================================
// Error Factory Functions
// ============================================================================
/**
 * Create a validation error
 */
export function createValidationError(message, field, value, constraint) {
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
export function createNetworkError(message, url, method, statusCode, response) {
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
export function createDatabaseError(message, operation, key, namespace) {
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
export function createExternalAPIError(message, service, endpoint, statusCode) {
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
export function createTimeoutError(message, operation, timeoutMs, elapsedMs) {
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
export function isValidationError(error) {
    return error?.category === 'validation';
}
/**
 * Type guard for NetworkError
 */
export function isNetworkError(error) {
    return error?.category === 'network';
}
/**
 * Type guard for DatabaseError
 */
export function isDatabaseError(error) {
    return error?.category === 'database';
}
/**
 * Type guard for AuthenticationError
 */
export function isAuthenticationError(error) {
    return error?.category === 'authentication';
}
/**
 * Type guard for AuthorizationError
 */
export function isAuthorizationError(error) {
    return error?.category === 'authorization';
}
/**
 * Type guard for ExternalAPIError
 */
export function isExternalAPIError(error) {
    return error?.category === 'external_api';
}
/**
 * Type guard for TimeoutError
 */
export function isTimeoutError(error) {
    return error?.category === 'timeout';
}
/**
 * Type guard for RateLimitError
 */
export function isRateLimitError(error) {
    return error?.category === 'rate_limit';
}
/**
 * Type guard for SystemError
 */
export function isSystemError(error) {
    return error?.category === 'system';
}
/**
 * Type guard for any AppError
 */
export function isAppError(error) {
    return error && typeof error === 'object' && 'category' in error && 'severity' in error;
}
// ============================================================================
// Error Conversion Functions
// ============================================================================
/**
 * Convert unknown error to AppError
 */
export function toAppError(error, context) {
    if (isAppError(error)) {
        return error;
    }
    if (error instanceof Error) {
        // Determine category based on error message or name
        let category = 'unknown';
        let retryable = false;
        const message = error.message.toLowerCase();
        const name = error.name.toLowerCase();
        if (message.includes('timeout') || name.includes('timeout')) {
            category = 'timeout';
            retryable = true;
        }
        else if (message.includes('network') || message.includes('fetch') || name.includes('network')) {
            category = 'network';
            retryable = true;
        }
        else if (message.includes('validation') || message.includes('invalid')) {
            category = 'validation';
            retryable = false;
        }
        else if (message.includes('unauthorized') || message.includes('authentication')) {
            category = 'authentication';
            retryable = false;
        }
        else if (message.includes('forbidden') || message.includes('permission')) {
            category = 'authorization';
            retryable = false;
        }
        else if (message.includes('rate limit') || message.includes('too many requests')) {
            category = 'rate_limit';
            retryable = true;
        }
        else if (message.includes('database') || message.includes('kv') || message.includes('storage')) {
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
// Utility Functions
// ============================================================================
/**
 * Wrap async function with error handling
 */
export function withErrorHandling(fn, errorHandler) {
    return async (...args) => {
        try {
            return await fn(...args);
        }
        catch (error) {
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
export function getErrorMessage(error) {
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
export function isRetryableError(error) {
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
//# sourceMappingURL=errors.js.map