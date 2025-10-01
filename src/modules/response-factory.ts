/**
 * Response Factory Module - TypeScript
 * Type-safe, standardized API response formatting for consistent client interaction
 */

import { CONFIG } from './config.js';

// Type Definitions
export interface ResponseMetadata {
  timestamp: string;
  requestId?: string;
  service?: string;
  [key: string]: any;
}

export interface SuccessResponseOptions {
  status?: number;
  headers?: Record<string, string>;
  requestId?: string | null;
  service?: string | null;
}

export interface ErrorResponseOptions {
  status?: number;
  headers?: Record<string, string>;
  requestId?: string | null;
  service?: string | null;
  details?: any;
}

export interface HealthResponseOptions {
  status?: number;
  requestId?: string | null;
}

export interface Pagination {
  page?: number;
  limit?: number;
  total?: number;
  hasMore?: boolean;
}

export interface DataResponseOptions {
  requestId?: string | null;
  service?: string | null;
  totalCount?: number | null;
  processingTime?: number | null;
}

export interface CronResponseOptions {
  cronExecutionId?: string | null;
  triggerMode?: string | null;
  symbolsAnalyzed?: number;
  duration?: number | null;
}

export interface AnalysisResponseOptions {
  requestId?: string | null;
  symbolsAnalyzed?: number;
  processingTime?: number | null;
  confidence?: number | null;
}

export interface RedirectResponseOptions {
  status?: number;
  temporary?: boolean;
}

export interface StreamingResponseOptions {
  contentType?: string;
  headers?: Record<string, string>;
}

export interface CORSResponseOptions {
  origin?: string;
  methods?: string;
  headers?: string;
}

export interface SuccessResponse {
  success: true;
  data: any;
  metadata: ResponseMetadata;
}

export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    status: number;
    details: any;
  };
  metadata: ResponseMetadata;
}

/**
 * Create a successful API response with standardized format
 */
export function createSuccessResponse(
  data: any,
  metadata: Record<string, any> = {},
  options: SuccessResponseOptions = {}
): Response {
  const {
    status = 200,
    headers = {},
    requestId = null,
    service = null
  } = options;

  const response: SuccessResponse = {
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      requestId: requestId || undefined,
      service: service || undefined,
      ...metadata
    }
  };

  // Remove undefined values from metadata
  Object.keys(response.metadata).forEach(key => {
    if (response.metadata[key] === undefined || response.metadata[key] === null) {
      delete response.metadata[key];
    }
  });

  return new Response(JSON.stringify(response, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...headers
    }
  });
}

/**
 * Create an error response with standardized format
 */
export function createErrorResponse(
  error: Error | string,
  options: ErrorResponseOptions = {}
): Response {
  const {
    status = 500,
    headers = {},
    requestId = null,
    service = null,
    details = null
  } = options;

  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorCode = getErrorCode(errorMessage, status);

  const response: ErrorResponse = {
    success: false,
    error: {
      message: errorMessage,
      code: errorCode,
      status,
      details
    },
    metadata: {
      timestamp: new Date().toISOString(),
      requestId: requestId || undefined,
      service: service || undefined
    }
  };

  // Remove undefined values from metadata
  Object.keys(response.metadata).forEach(key => {
    if (response.metadata[key] === undefined || response.metadata[key] === null) {
      delete response.metadata[key];
    }
  });

  return new Response(JSON.stringify(response, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...headers
    }
  });
}

/**
 * Create a health check response
 */
export function createHealthResponse(
  healthData: any,
  options: HealthResponseOptions = {}
): Response {
  const {
    status = 200,
    requestId = null
  } = options;

  const isHealthy = determineOverallHealth(healthData);

  return createSuccessResponse({
    status: isHealthy ? 'healthy' : 'degraded',
    version: CONFIG.BUSINESS_KPI ? '2.0-Modular' : '1.0',
    ...healthData
  }, {
    healthCheck: true,
    overallStatus: isHealthy ? 'healthy' : 'degraded'
  }, {
    status: isHealthy ? 200 : 503,
    requestId,
    service: 'health'
  });
}

/**
 * Create a data API response with pagination support
 */
export function createDataResponse(
  data: any,
  pagination: Pagination | null = null,
  options: DataResponseOptions = {}
): Response {
  const {
    requestId = null,
    service = null,
    totalCount = null,
    processingTime = null
  } = options;

  const metadata: Record<string, any> = {
    totalCount,
    processingTime,
    dataType: Array.isArray(data) ? 'array' : typeof data
  };

  if (pagination) {
    metadata.pagination = {
      page: pagination.page || 1,
      limit: pagination.limit || 50,
      total: pagination.total || (Array.isArray(data) ? data.length : 1),
      hasMore: pagination.hasMore || false
    };
  }

  return createSuccessResponse(data, metadata, {
    requestId,
    service: service || 'data-api'
  });
}

/**
 * Create a cron execution response
 */
export function createCronResponse(
  executionData: any,
  options: CronResponseOptions = {}
): Response {
  const {
    cronExecutionId = null,
    triggerMode = null,
    symbolsAnalyzed = 0,
    duration = null
  } = options;

  return createSuccessResponse({
    executionId: cronExecutionId,
    triggerMode,
    symbolsAnalyzed,
    status: 'completed',
    ...executionData
  }, {
    executionType: 'cron',
    duration,
    performance: duration ? getPerformanceRating(duration) : null
  }, {
    requestId: cronExecutionId,
    service: 'cron-scheduler'
  });
}

/**
 * Create an analysis response with confidence metrics
 */
export function createAnalysisResponse(
  analysisData: any,
  options: AnalysisResponseOptions = {}
): Response {
  const {
    requestId = null,
    symbolsAnalyzed = 0,
    processingTime = null,
    confidence = null
  } = options;

  const metadata: Record<string, any> = {
    symbolsAnalyzed,
    processingTime,
    averageConfidence: confidence,
    analysisType: 'dual-ai-comparison',
    aiModels: ['GPT-OSS-120B', 'DistilBERT']
  };

  return createSuccessResponse(analysisData, metadata, {
    requestId,
    service: 'analysis-engine'
  });
}

/**
 * Create a redirect response
 */
export function createRedirectResponse(
  location: string,
  options: RedirectResponseOptions = {}
): Response {
  const {
    status = 302,
    temporary = true
  } = options;

  return new Response(null, {
    status: temporary ? 302 : 301,
    headers: {
      'Location': location,
      'Cache-Control': temporary ? 'no-cache' : 'max-age=3600'
    }
  });
}

/**
 * Create a streaming response for large data
 */
export function createStreamingResponse(
  dataStream: ReadableStream,
  options: StreamingResponseOptions = {}
): Response {
  const {
    contentType = 'application/json',
    headers = {}
  } = options;

  return new Response(dataStream, {
    headers: {
      'Content-Type': contentType,
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      ...headers
    }
  });
}

/**
 * Helper function to determine error codes
 */
function getErrorCode(errorMessage: string, status: number): string {
  const errorCodeMap: Record<string, string> = {
    'Unauthorized': 'AUTH_FAILED',
    'timeout': 'TIMEOUT_ERROR',
    'Rate limit': 'RATE_LIMITED',
    'Not found': 'NOT_FOUND',
    'validation': 'VALIDATION_ERROR',
    'KV': 'STORAGE_ERROR',
    'AI model': 'AI_MODEL_ERROR'
  };

  for (const [keyword, code] of Object.entries(errorCodeMap)) {
    if (errorMessage.toLowerCase().includes(keyword.toLowerCase())) {
      return code;
    }
  }

  return status >= 500 ? 'INTERNAL_ERROR' : 'CLIENT_ERROR';
}

/**
 * Helper function to determine overall health status
 */
function determineOverallHealth(healthData: any): boolean {
  if (!healthData.services) return true;

  const services = Object.values(healthData.services);
  return services.every((service: any) =>
    service === 'available' ||
    service === 'configured' ||
    service === 'healthy'
  );
}

/**
 * Helper function to rate performance
 */
function getPerformanceRating(duration: number): string {
  if (duration < 1000) return 'excellent';
  if (duration < 5000) return 'good';
  if (duration < 15000) return 'acceptable';
  return 'slow';
}

/**
 * Create CORS-enabled response
 */
export function createCORSResponse(
  response: Response,
  options: CORSResponseOptions = {}
): Response {
  const {
    origin = '*',
    methods = 'GET, POST, PUT, DELETE, OPTIONS',
    headers = 'Content-Type, Authorization, X-API-KEY'
  } = options;

  // Clone the response to add CORS headers
  const corsResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });

  corsResponse.headers.set('Access-Control-Allow-Origin', origin);
  corsResponse.headers.set('Access-Control-Allow-Methods', methods);
  corsResponse.headers.set('Access-Control-Allow-Headers', headers);
  corsResponse.headers.set('Access-Control-Max-Age', '86400');

  return corsResponse;
}

/**
 * Handle OPTIONS preflight requests
 */
export function createOptionsResponse(options: CORSResponseOptions = {}): Response {
  return createCORSResponse(new Response(null, { status: 200 }), options);
}
