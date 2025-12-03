/**
 * API Request/Response Type Definitions
 *
 * Comprehensive type definitions for API requests and responses across all endpoints.
 * Provides type safety for API v1 and legacy endpoints.
 */
/**
 * Type guard for error response
 */
export function isErrorResponse(response) {
    return response && typeof response === 'object' && response.success === false;
}
/**
 * Type guard for success response
 */
export function isSuccessResponse(response) {
    return response && typeof response === 'object' && response.success === true;
}
/**
 * Create success response
 */
export function createSuccessResponse(data, metadata) {
    return {
        success: true,
        data,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        metadata,
    };
}
/**
 * Create error response
 */
export function createErrorResponse(code, message, details) {
    const timestamp = new Date().toISOString();
    switch (code) {
        case 'VALIDATION_ERROR':
            return {
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message,
                    details: Array.isArray(details) ? details : [],
                },
                timestamp,
            };
        case 'NOT_FOUND':
            return {
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message,
                    details,
                },
                timestamp,
            };
        case 'RATE_LIMIT_EXCEEDED':
            return {
                success: false,
                error: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    message,
                    details: details || {},
                },
                timestamp,
            };
        default:
            return {
                success: false,
                error: {
                    code: 'INTERNAL_SERVER_ERROR',
                    message,
                    details: {
                        errorId: `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        timestamp,
                        stack: new Error().stack,
                    },
                },
                timestamp,
            };
    }
}
//# sourceMappingURL=api.js.map