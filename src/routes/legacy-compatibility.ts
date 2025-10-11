/**
 * Legacy Compatibility Layer - Phase 5 Implementation
 * Data Access Improvement Plan - Backward Compatibility
 *
 * Provides seamless migration from legacy endpoints to new API v1 endpoints
 * with zero breaking changes and deprecation warnings.
 */

import { createSimplifiedEnhancedDAL } from '../modules/simplified-enhanced-dal.js';
import { createLogger } from '../modules/logging.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('legacy-compatibility');

/**
 * Legacy endpoint mapping configuration
 */
const LEGACY_MAPPINGS = {
  // Analysis endpoints
  '/analyze': '/api/v1/sentiment/analysis',
  '/analyze-symbol': '/api/v1/sentiment/symbols',

  // Health endpoints
  '/health': '/api/v1/data/health',
  '/model-health': '/api/v1/data/health?model=true',
  '/cron-health': '/api/v1/data/health?cron=true',

  // Data endpoints
  '/results': '/api/v1/reports/daily/latest',
  '/api/daily-summary': '/api/v1/reports/daily/latest',
  '/weekly-analysis': '/api/v1/reports/weekly/latest',

  // Report endpoints
  '/pre-market-briefing': '/api/v1/reports/pre-market',
  '/intraday-check': '/api/v1/reports/intraday',
  '/end-of-day-summary': '/api/v1/reports/end-of-day',
  '/weekly-review': '/api/v1/reports/weekly/latest',

  // Test endpoints
  '/test-sentiment': '/api/v1/test/sentiment',
  '/test-facebook': '/api/v1/test/notifications',
  '/kv-debug': '/api/v1/data/kv-debug',
  '/kv-verification-test': '/api/v1/data/kv-test'
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
            symbols: legacyBody.symbols || ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'],
            analysis_type: 'comprehensive',
            include_news: true
          };
          body = JSON.stringify(newBody);
          headers.set('Content-Type', 'application/json');
        } catch (error) {
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
        } catch (error) {
          logger.warn('Failed to transform /test-facebook request body', { error });
        }
      }
      break;
  }

  // Create new request with transformed data
  const newRequest = new Request(newUrl, {
    method: request.method,
    headers,
    body,
    redirect: request.redirect,
    integrity: request.integrity,
    signal: request.signal,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    mode: request.mode,
    credentials: request.credentials,
    cache: request.cache
  });

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
  let responseData = await response.json();

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

    // Forward to new API endpoint
    const newResponse = await fetch(transformedRequest);

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
      error: error.message,
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

  if (isLegacyEndpoint(path)) {
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