/**
 * API v1 Response Formats
 * Standardized response structures for all v1 API endpoints
 * Based on DAC project patterns
 */

// Type definitions
interface ApiResponseMetadata {
  version: string;
  cacheStatus?: string;
  [key: string]: any;
}

interface ApiResponse<T = any> {
  success: true;
  data: T;
  timestamp: string;
  metadata: ApiResponseMetadata;
}

interface CachedApiResponse<T = any> extends ApiResponse<T> {
  cached: true;
}

interface ErrorApiResponse {
  success: false;
  error: string;
  error_code: string;
  error_details: Record<string, any>;
  timestamp: string;
}

interface PaginatedApiResponse<T = any> {
  success: true;
  data: T;
  timestamp: string;
  pagination: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
  metadata: ApiResponseMetadata;
}

interface PaginationInfo {
  page?: number;
  limit?: number;
  total?: number;
  hasMore?: boolean;
}

/**
 * Response Factory Functions
 */
export class ApiResponseFactory {
  static success<T = any>(data: T, metadata: Record<string, any> = {}): ApiResponse<T> {
    const response: ApiResponse<T> = {
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
        (response as any).version = (data as any).version;
      }
      if ('status' in data) {
        (response as any).status = (data as any).status;
      }
      if ('title' in data) {
        (response as any).title = (data as any).title;
      }
      if ('description' in data) {
        (response as any).description = (data as any).description;
      }
    }

    return response;
  }

  static cached<T = any>(data: T, cacheStatus: string = 'hit', metadata: Record<string, any> = {}): CachedApiResponse<T> {
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

  static error(error: string, errorCode: string, errorDetails: Record<string, any> = {}): ErrorApiResponse {
    return {
      success: false,
      error,
      error_code: errorCode,
      error_details: errorDetails,
      timestamp: new Date().toISOString(),
    };
  }

  static paginated<T = any>(
    data: T,
    pagination: PaginationInfo,
    metadata: Record<string, any> = {}
  ): PaginatedApiResponse<T> {
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
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// API Key Validation Helper
export function validateApiKey(request: Request): { valid: boolean; key: string | null } {
  const apiKey = request.headers.get('X-API-Key');
  const validKeys = ['yanggf', 'demo', 'test'];
  return { valid: validKeys.includes(apiKey || ''), key: apiKey };
}

// Processing Time Tracker
export class ProcessingTimer {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  getElapsedMs(): number {
    return Date.now() - this.startTime;
  }

  finish(): number {
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
} as const;

// Type for HTTP status codes
export type HttpStatusType = typeof HttpStatus[keyof typeof HttpStatus];

// Compatibility placeholders for JS route imports
export const SentimentAnalysisResponse = {};
export const SymbolSentimentResponse = {};
export const MarketSentimentData = {};
export const SectorSentimentData = {};
export const DailyReportResponse = {};
export const WeeklyReportResponse = {};

// Export types for external use
export type {
  ApiResponse,
  CachedApiResponse,
  ErrorApiResponse,
  PaginatedApiResponse,
  ApiResponseMetadata,
  PaginationInfo
};