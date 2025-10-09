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
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      metadata: {
        version: 'v1',
        ...metadata,
      },
    };
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