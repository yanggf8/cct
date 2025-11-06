/**
 * Legacy Compatibility Layer - Phase 5 Implementation
 * Data Access Improvement Plan - Backward Compatibility
 *
 * Provides seamless migration from legacy endpoints to new API v1 endpoints
 * with zero breaking changes and deprecation warnings.
 */

import { createSimplifiedEnhancedDAL } from '../modules/simplified-enhanced-dal.js';
import { createLogger } from '../modules/logging.js';
import { handleApiV1Request } from './api-v1.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('legacy-compatibility');

/**
 * Internal routing function for legacy endpoint forwarding
 * Routes transformed requests directly to API v1 handlers
 */
async function routeToNewEndpoint(
  request: Request,
  env: CloudflareEnvironment,
  newPath: string
): Promise<Response> {
  try {
    // Parse the new endpoint path and route to appropriate handler
    const url = new URL(request.url);
    url.pathname = newPath;

    // Create a new request with the updated URL
    // Note: GET and HEAD requests cannot have a body
    const requestOptions: RequestInit = {
      method: request.method,
      headers: request.headers,
      redirect: request.redirect,
      integrity: request.integrity,
      signal: request.signal,
      referrer: request.referrer,
      referrerPolicy: request.referrerPolicy,
      mode: request.mode,
      credentials: request.credentials,
      cache: request.cache
    };

    // Only include body for methods that support it (not GET or HEAD)
    if (request.method !== 'GET' && request.method !== 'HEAD' && request.body) {
      requestOptions.body = request.body;
    }

    const internalRequest = new Request(url, requestOptions);

    // Set up standard API headers for v1 endpoints
    const headers = {
      'X-Request-ID': `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      'X-API-Version': 'v1',
      'Content-Type': 'application/json',
    };

    // Route to API v1 handler
    const response = await handleApiV1Request(internalRequest, env, url.pathname);

    return response;

  } catch (error: any) {
    logger.error('Failed to route to new endpoint', {
      newPath,
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal routing failed',
        message: `Failed to route to ${newPath}: ${error.message}`,
        newEndpoint: newPath
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Error': 'Internal routing failed'
        }
      }
    );
  }
}

/**
 * Legacy endpoint mapping configuration
 * Note: Test endpoints and direct handlers are excluded from legacy compatibility
 * They should be handled directly by their respective handlers, not mapped to API v1
 */
const LEGACY_MAPPINGS = {
  // Analysis endpoints
  '/analyze': '/api/v1/sentiment/analysis',
  '/analyze-symbol': '/api/v1/sentiment/symbols',

  // Health endpoints
  '/health': '/api/v1/data/health',
  // '/model-health': '/api/v1/data/health?model=true', // Exclude - handled by dedicated handler
  // '/cron-health': '/api/v1/data/health?cron=true', // Exclude - direct handler, not API endpoint

  // Data endpoints - EXCLUDED from legacy compatibility (direct handlers)
  // '/results': '/api/v1/reports/daily', // Exclude - direct handler, let it be handled directly
  '/api/daily-summary': '/api/v1/reports/daily',
  '/weekly-analysis': '/api/v1/reports/weekly/latest',

  // Report endpoints - EXCLUDED from legacy compatibility (direct handlers)
  // '/pre-market-briefing': '/api/v1/reports/daily', // Exclude - direct handler
  // '/intraday-check': '/api/v1/reports/daily', // Exclude - direct handler
  // '/end-of-day-summary': '/api/v1/reports/daily', // Exclude - direct handler
  // '/weekly-review': '/api/v1/reports/weekly/latest', // Exclude - direct handler

  // Test endpoints - EXCLUDED from legacy compatibility (direct handlers)
  // '/test-sentiment': '/api/v1/test/sentiment', // Exclude - direct handler
  // '/test-facebook': '/api/v1/test/notifications', // Exclude - direct handler
  // '/kv-debug': '/api/v1/data/kv-debug', // Exclude - direct handler, no API v1 equivalent
  // '/kv-verification-test': '/api/v1/data/kv-test', // Exclude - direct handler, no API v1 equivalent
} as const;

/**
 * Deprecation warning configuration
 */
const DEPRECATION_CONFIG = {
  enabled: true,
  warningHeader: 'X-Deprecation-Warning',
  newEndpointHeader: 'X-New-Endpoint',
  sunsetDate: '2025-06-01', // 6 months from implementation
  migrationGuide: 'https://docs.cct.ai/api-migration-guide'
};

/**
 * Legacy compatibility response headers
 */
function addDeprecationHeaders(
  response: Response,
  oldPath: string,
  newPath: string
): Response {
  const headers = new Headers(response.headers);

  headers.set(DEPRECATION_CONFIG.warningHeader,
    `This endpoint is deprecated and will be removed on ${DEPRECATION_CONFIG.sunsetDate}. ` +
    `Use ${newPath} instead. See ${DEPRECATION_CONFIG.migrationGuide}`
  );

  headers.set(DEPRECATION_CONFIG.newEndpointHeader, newPath);
  headers.set('X-Sunset', DEPRECATION_CONFIG.sunsetDate);
  headers.set('Link', `<${DEPRECATION_CONFIG.migrationGuide}>; rel="documentation"`);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * Transform legacy request to new API format
 */
async function transformLegacyRequest(
  request: Request,
  oldPath: string,
  newPath: string
): Promise<Request> {
  const url = new URL(request.url);
  const newUrl = new URL(newPath, url.origin);

  // Transform method and body based on endpoint type
  let body = request.body;
  let headers = new Headers(request.headers);

  // Handle specific endpoint transformations
  switch (oldPath) {
    case '/analyze':
      // Transform POST body to new format
      if (request.method === 'POST') {
        try {
          const legacyBody = await request.json();
          const newBody = {
            symbols: (legacyBody as any).symbols || ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'],
            analysis_type: 'comprehensive',
            include_news: true
          };
          body = JSON.stringify(newBody);
          headers.set('Content-Type', 'application/json');
        } catch (error: unknown) {
          logger.warn('Failed to transform /analyze request body', { error });
        }
      }
      break;

    case '/analyze-symbol':
      // Transform query parameter to path parameter
      const symbol = url.searchParams.get('symbol');
      if (symbol) {
        newUrl.pathname = `/api/v1/sentiment/symbols/${symbol}`;
      }
      break;

    case '/results':
      // Add date parameter if not present
      if (!newUrl.searchParams.has('date')) {
        const today = new Date().toISOString().split('T')[0];
        newUrl.searchParams.set('date', today);
      }
      break;

    case '/test-facebook':
      // Transform to new test endpoint
      newUrl.pathname = '/api/v1/test/notifications';
      if (request.method === 'POST') {
        try {
          const legacyBody = await request.json();
          const newBody = {
            type: 'chrome_notification',
            test_data: legacyBody
          };
          body = JSON.stringify(newBody);
          headers.set('Content-Type', 'application/json');
        } catch (error: unknown) {
          logger.warn('Failed to transform /test-facebook request body', { error });
        }
      }
      break;
  }

  // Create new request with transformed data
  // Note: GET and HEAD requests cannot have a body
  const requestOptions: RequestInit = {
    method: request.method,
    headers,
    redirect: request.redirect,
    integrity: request.integrity,
    signal: request.signal,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    mode: request.mode,
    credentials: request.credentials,
    cache: request.cache
  };

  // Only include body for methods that support it (not GET or HEAD)
  if (request.method !== 'GET' && request.method !== 'HEAD' && body) {
    requestOptions.body = body;
  }

  const newRequest = new Request(newUrl, requestOptions);

  return newRequest;
}

/**
 * Transform API v1 response back to legacy format
 */
async function transformLegacyResponse(
  response: Response,
  oldPath: string,
  newPath: string
): Promise<Response> {
  let responseData: any = await response.json();

  // Transform response based on original endpoint expectations
  switch (oldPath) {
    case '/analyze':
      // Transform new API format back to legacy format
      if (responseData.success && responseData.data) {
        responseData = {
          success: true,
          data: responseData.data.analysis,
          analyzed_date: responseData.data.timestamp,
          symbols_analyzed: responseData.data.symbols,
          message: 'Analysis completed successfully'
        };
      }
      break;

    case '/results':
      // Transform new report format back to legacy results format
      if (responseData.success && responseData.data) {
        responseData = {
          success: true,
          data: responseData.data.report_data || responseData.data,
          date: responseData.data.date || new Date().toISOString().split('T')[0],
          message: 'Results retrieved successfully'
        };
      }
      break;

    case '/health':
      // Transform new health format back to legacy format
      if (responseData.success && responseData.data) {
        responseData = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services: responseData.data.services || {},
          message: 'System is operational'
        };
      }
      break;

    case '/model-health':
      // Transform new model health format back to legacy format
      if (responseData.success && responseData.data) {
        responseData = {
          timestamp: responseData.data.timestamp,
          models: responseData.data.models || {},
          overall_status: responseData.data.overall_status
        };
      }
      break;

    case '/pre-market-briefing':
    case '/intraday-check':
    case '/end-of-day-summary':
    case '/weekly-review':
      // Transform new report format back to legacy report format
      if (responseData.success && responseData.data) {
        responseData = {
          success: true,
          data: responseData.data.content || responseData.data,
          metadata: responseData.data.metadata || {
            reportType: oldPath.replace('/', '').replace('-', '_'),
            date: new Date().toISOString().split('T')[0],
            generatedAt: new Date().toISOString()
          },
          message: `${oldPath.replace('/', '').replace('-', ' ').toUpperCase()} report retrieved successfully`
        };
      }
      break;
  }

  const transformedResponse = new Response(JSON.stringify(responseData), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });

  return addDeprecationHeaders(transformedResponse, oldPath, newPath);
}

/**
 * Handle legacy endpoint with automatic forwarding
 */
export async function handleLegacyEndpoint(
  request: Request,
  env: CloudflareEnvironment,
  oldPath: string
): Promise<Response> {
  const newPath = LEGACY_MAPPINGS[oldPath as keyof typeof LEGACY_MAPPINGS];

  if (!newPath) {
    logger.warn('Legacy endpoint not found in mappings', { oldPath });
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Endpoint not found',
        message: `Legacy endpoint ${oldPath} is not supported`
      }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'X-Error': 'Legacy endpoint not mapped'
        }
      }
    );
  }

  logger.info('Forwarding legacy request', {
    oldPath,
    newPath,
    method: request.method,
    userAgent: request.headers.get('User-Agent')
  });

  try {
    // Transform request to new API format
    const transformedRequest = await transformLegacyRequest(request, oldPath, newPath);

    // Route internally to new API endpoint instead of external fetch
    const newResponse = await routeToNewEndpoint(transformedRequest, env, newPath);

    // Transform response back to legacy format
    const legacyResponse = await transformLegacyResponse(newResponse, oldPath, newPath);

    // Log successful migration
    logger.info('Legacy request forwarded successfully', {
      oldPath,
      newPath,
      status: newResponse.status,
      responseTime: Date.now()
    });

    return legacyResponse;

  } catch (error: any) {
    logger.error('Failed to forward legacy request', {
      oldPath,
      newPath,
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Legacy endpoint forwarding failed',
        message: error.message,
        newEndpoint: newPath
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Error': 'Legacy forwarding failed',
          [DEPRECATION_CONFIG.newEndpointHeader]: newPath
        }
      }
    );
  }
}

/**
 * Check if request is for a legacy endpoint
 */
export function isLegacyEndpoint(path: string): boolean {
  return path in LEGACY_MAPPINGS;
}

/**
 * Get new endpoint path for legacy endpoint
 */
export function getNewEndpointPath(legacyPath: string): string | null {
  return LEGACY_MAPPINGS[legacyPath as keyof typeof LEGACY_MAPPINGS] || null;
}

/**
 * Get all legacy mappings
 */
export function getLegacyMappings(): typeof LEGACY_MAPPINGS {
  return { ...LEGACY_MAPPINGS };
}

/**
 * Middleware to handle legacy compatibility
 */
export function legacyCompatibilityMiddleware(
  request: Request,
  env: CloudflareEnvironment
): Promise<Response> | null {
  const url = new URL(request.url);
  const path = url.pathname;

  // Exclude direct handlers and HTML page routes from legacy compatibility
  // These should be handled by their direct handlers, not redirected to API endpoints
  const excludedRoutes = [
    // HTML page routes
    '/weekly-analysis',
    '/daily-summary',
    '/sector-rotation',
    '/predictive-analytics',
    // Direct handler routes (test endpoints, utilities, reports)
    '/results',
    '/kv-debug',
    '/cron-health',
    '/kv-verification-test',
    '/test-sentiment',
    '/test-facebook',
    '/pre-market-briefing',
    '/intraday-check',
    '/end-of-day-summary',
    '/weekly-review',
    '/intraday-check-decomposed',
    '/intraday-check-refactored'
  ];

  if (isLegacyEndpoint(path) && !excludedRoutes.includes(path)) {
    logger.info('Legacy endpoint detected', {
      path,
      userAgent: request.headers.get('User-Agent'),
      referer: request.headers.get('Referer')
    });

    return handleLegacyEndpoint(request, env, path);
  }

  return null; // Not a legacy endpoint, continue with normal routing
}

/**
 * Legacy endpoint usage statistics
 */
class LegacyUsageTracker {
  private usage: Map<string, { count: number; lastUsed: string }> = new Map();

  recordUsage(endpoint: string): void {
    const current = this.usage.get(endpoint) || { count: 0, lastUsed: '' };
    current.count++;
    current.lastUsed = new Date().toISOString();
    this.usage.set(endpoint, current);

    logger.info('Legacy endpoint usage', {
      endpoint,
      count: current.count,
      lastUsed: current.lastUsed
    });
  }

  getUsageStats(): { endpoint: string; count: number; lastUsed: string }[] {
    return Array.from(this.usage.entries()).map(([endpoint, stats]) => ({
      endpoint,
      count: stats.count,
      lastUsed: stats.lastUsed
    }));
  }

  clearUsage(): void {
    this.usage.clear();
  }
}

export const legacyUsageTracker = new LegacyUsageTracker();

/**
 * Enhanced legacy handler with usage tracking
 */
export async function handleLegacyEndpointWithTracking(
  request: Request,
  env: CloudflareEnvironment,
  oldPath: string
): Promise<Response> {
  // Record usage before handling
  legacyUsageTracker.recordUsage(oldPath);

  // Handle the request
  return await handleLegacyEndpoint(request, env, oldPath);
}

export default {
  handleLegacyEndpoint,
  handleLegacyEndpointWithTracking,
  isLegacyEndpoint,
  getNewEndpointPath,
  getLegacyMappings,
  legacyCompatibilityMiddleware,
  legacyUsageTracker,
  LEGACY_MAPPINGS,
  DEPRECATION_CONFIG
};