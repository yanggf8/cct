/**
 * API v1 Response Formats
 * Standardized response structures for all v1 API endpoints
 * Based on DAC project patterns
 */
/**
 * Response Factory Functions
 */
export class ApiResponseFactory {
    static success(data, metadata = {}) {
        const response = {
            success: true,
            data,
            timestamp: new Date().toISOString(),
            metadata: {
                version: 'v1',
                ...metadata,
            },
        };
        // Add root-level fields for client compatibility
        if (data && typeof data === 'object') {
            if ('version' in data) {
                response.version = data.version;
            }
            if ('status' in data) {
                response.status = data.status;
            }
            if ('title' in data) {
                response.title = data.title;
            }
            if ('description' in data) {
                response.description = data.description;
            }
        }
        return response;
    }
    static cached(data, cacheStatus = 'hit', metadata = {}) {
        return {
            success: true,
            data,
            cached: true,
            timestamp: new Date().toISOString(),
            metadata: {
                version: 'v1',
                cacheStatus,
                ...metadata,
            },
        };
    }
    static error(error, errorCode, errorDetails = {}) {
        return {
            success: false,
            error,
            error_code: errorCode,
            error_details: errorDetails,
            timestamp: new Date().toISOString(),
        };
    }
    static paginated(data, pagination, metadata = {}) {
        return {
            success: true,
            data,
            timestamp: new Date().toISOString(),
            pagination,
            metadata: {
                version: 'v1',
                ...metadata,
            },
        };
    }
}
// Request ID Generator
export function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
// API Key Validation Helper
export function validateApiKey(request) {
    const apiKey = request.headers.get('X-API-Key');
    const validKeys = ['yanggf', 'demo', 'test'];
    return { valid: validKeys.includes(apiKey || ''), key: apiKey };
}
// Processing Time Tracker
export class ProcessingTimer {
    constructor() {
        this.startTime = Date.now();
    }
    getElapsedMs() {
        return Date.now() - this.startTime;
    }
    finish() {
        return this.getElapsedMs();
    }
}
// HTTP Status Codes
export const HttpStatus = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
};
// Compatibility placeholders for JS route imports (with different names to avoid conflicts)
export const MarketSentimentDataValue = {};
export const SectorSentimentDataValue = {};
//# sourceMappingURL=api-v1-responses.js.map