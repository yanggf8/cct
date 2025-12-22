/**
 * API v1 Router
 * RESTful API endpoints following DAC patterns
 * Delegates to per-domain route handlers and standardizes responses
 */

import { ApiResponseFactory, HttpStatus, generateRequestId as genReqId } from '../modules/api-v1-responses.js';
import { checkAPISecurity, recordAuthAttempt, getSecurityStatus } from '../modules/api-security.js';
import { createLogger } from '../modules/logging.js';
import { handleSentimentRoutes } from './sentiment-routes.js';
import { handleReportRoutes } from './report-routes.js';
import { handleDataRoutes } from './data-routes.js';
import { handleSectorRotationRoutes } from './sector-rotation-routes.js';
import { sectorRoutes } from './sector-routes.js';
import { handleMarketDriversRoutes } from './market-drivers-routes.js';
import { handleMarketIntelligenceRoutes } from './market-intelligence-routes.js';
import { handlePredictiveAnalyticsRoutes } from './predictive-analytics-routes.js';
import { handleTechnicalRoutes } from './technical-routes.js';
import { handleAdvancedAnalyticsRoutes } from './advanced-analytics-routes.js';
import { handleRealtimeRoutes } from './realtime-routes.js';
import { handleBacktestingRoutes } from './backtesting-routes.js';
import { createEnhancedCacheRoutes } from './enhanced-cache-routes.js';
import { handlePortfolioRequest } from './portfolio-routes.js';
import { getSectorIndicatorsSymbol } from './sector-routes.js';
import { handleRiskManagementRequest } from './risk-management-routes.js';
import { handleProductionGuardsStatus, handleProductionGuardsValidate, handleProductionGuardsHealthCheck } from './production-guards-routes.js';
import { handleDashboardRoutes } from './dashboard/index.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('api-v1');

type RequestHeaders = Record<string, string>;

interface APIEndpoint {
  [key: string]: string | APIEndpoint;
}

interface ApiDocumentation {
  title: string;
  version: string;
  description: string;
  available_endpoints: {
    sentiment: APIEndpoint;
    reports: APIEndpoint;
    data: APIEndpoint;
    sector_rotation: APIEndpoint;
    sectors: APIEndpoint;
    market_drivers: APIEndpoint;
    market_intelligence: APIEndpoint;
    predictive_analytics: APIEndpoint;
    advanced_analytics: APIEndpoint;
    technical_analysis: APIEndpoint;
    realtime: APIEndpoint;
    backtesting: APIEndpoint;
    portfolio_optimization: APIEndpoint;
    portfolio_rebalancing: APIEndpoint;
    risk_management: APIEndpoint;
    production_guards: APIEndpoint;
    dashboard: APIEndpoint;
  };
  documentation: string;
  status: string;
}

interface ApiKeyValidation {
  valid: boolean;
  key: string | null;
}

/**
 * Main v1 API Router
 */
export async function handleApiV1Request(
  request: Request,
  env: CloudflareEnvironment,
  path: string
): Promise<Response> {
  // Add request ID to headers for tracking
  const headers: RequestHeaders = {
    'X-Request-ID': genReqId(),
    'X-API-Version': 'v1',
    'Content-Type': 'application/json',
  };

  try {
    // Extract API key for security checks
    const apiKey = request.headers.get('X-API-Key');

    // Perform security checks
    const securityCheck = checkAPISecurity(request, apiKey);
    if (!securityCheck.allowed) {
      logger.warn('API security check failed', {
        reason: securityCheck.reason,
        path,
        method: request.method,
        retryAfter: securityCheck.retryAfter
      });

      const errorResponse = ApiResponseFactory.error(
        securityCheck.reason === 'API_KEY_LOCKED_OUT' ? 'API key temporarily locked due to repeated failures' :
        securityCheck.reason === 'IP_RATE_LIMIT_EXCEEDED' ? 'IP rate limit exceeded' :
        'API rate limit exceeded',
        securityCheck.reason === 'API_KEY_LOCKED_OUT' ? 'API_KEY_LOCKED_OUT' :
        securityCheck.reason === 'IP_RATE_LIMIT_EXCEEDED' ? 'IP_RATE_LIMIT_EXCEEDED' :
        'RATE_LIMIT_EXCEEDED',
        {
          requestId: headers['X-Request-ID'],
          retryAfter: securityCheck.retryAfter,
          rateLimitStatus: securityCheck.rateLimitStatus
        }
      );

      const responseHeaders = {
        ...headers,
        'Retry-After': securityCheck.retryAfter?.toString() || '60'
      };

      return new Response(JSON.stringify(errorResponse), {
        status: securityCheck.reason === 'API_KEY_LOCKED_OUT' ? 423 : 429, // 423 Locked or 429 Too Many Requests
        headers: responseHeaders
      });
    }

    // Route to appropriate handler based on path
    if (path.startsWith('/api/v1/sentiment/')) {
      return await handleSentimentRoutes(request, env, path, headers);
    } else if (path.startsWith('/api/v1/reports/')) {
      return await handleReportRoutes(request, env, path, headers);
    } else if (path.startsWith('/api/v1/data/')) {
      return await handleDataRoutes(request, env, path, headers);
    } else if (path.startsWith('/api/v1/sector-rotation/')) {
      // Route to sector rotation API
      return await handleSectorRotationRoutes(request, env, path, headers);
    } else if (path.startsWith('/api/v1/sectors/')) {
      // Route to sectors API v1 endpoints
      const sectorsPath = path.replace('/api/v1', '');
      if (sectorsPath === '/sectors/snapshot' && sectorRoutes['/api/v1/sectors/snapshot']) {
        return await sectorRoutes['/api/v1/sectors/snapshot'](request, env);
      } else if (sectorsPath === '/sectors/health' && sectorRoutes['/api/v1/sectors/health']) {
        return await sectorRoutes['/api/v1/sectors/health'](request, env);
      } else if (sectorsPath === '/sectors/symbols' && sectorRoutes['/api/v1/sectors/symbols']) {
        return await sectorRoutes['/api/v1/sectors/symbols'](request, env);
      } else {
        // Dynamic path: /api/v1/sectors/indicators/:symbol
        const indMatch = path.match(/^\/api\/v1\/sectors\/indicators\/([A-Z0-9]{1,10})$/);
        if (indMatch && getSectorIndicatorsSymbol) {
          return await getSectorIndicatorsSymbol(request, env, indMatch[1]);
        }
        const body = ApiResponseFactory.error('Sectors endpoint not found', 'NOT_FOUND', { requested_path: path });
        return new Response(JSON.stringify(body), { status: HttpStatus.NOT_FOUND, headers });
      }
    } else if (path.startsWith('/api/v1/market-drivers/')) {
      // Route to market drivers API
      return await handleMarketDriversRoutes(request, env, path, headers);
    } else if (path.startsWith('/api/v1/market-intelligence/')) {
      // Route to unified market intelligence API
      return await handleMarketIntelligenceRoutes(request, env, path, headers);
    } else if (path.startsWith('/api/v1/predictive/')) {
      // Route to predictive analytics API
      return await handlePredictiveAnalyticsRoutes(request, env, path, headers);
    } else if (path.startsWith('/api/v1/technical/')) {
      return await handleTechnicalRoutes(request, env, path, headers);
    } else if (path.startsWith('/api/v1/analytics/')) {
      return await handleAdvancedAnalyticsRoutes(request, env, path, headers);
    } else if (path.startsWith('/api/v1/realtime/')) {
      return await handleRealtimeRoutes(request, env, path, headers);
    } else if (path.startsWith('/api/v1/backtesting/')) {
      return await handleBacktestingRoutes(request, env, path, headers);
    } else if (path.startsWith('/api/v1/portfolio/')) {
      // Route to portfolio optimization API
      return await handlePortfolioRequest(request, env, {} as ExecutionContext);
    } else if (path.startsWith('/api/v1/risk/')) {
      // Route to risk management API
      return await handleRiskManagementRequest(request, env, {} as ExecutionContext);
    } else if (path.startsWith('/api/v1/guards/')) {
      // Route to production guards API - requires authentication
      if (!apiKey) {
        const errorResponse = ApiResponseFactory.error(
          'Authentication required for production guards endpoints',
          'AUTHENTICATION_REQUIRED',
          {
            requestId: headers['X-Request-ID'],
            endpoint: path,
            requires_auth: true
          }
        );
        return new Response(JSON.stringify(errorResponse), {
          status: HttpStatus.UNAUTHORIZED,
          headers
        });
      }

      // Route to specific guard endpoints
      if (path === '/api/v1/guards/status') {
        return await handleProductionGuardsStatus(request, env);
      } else if (path === '/api/v1/guards/validate') {
        return await handleProductionGuardsValidate(request, env);
      } else if (path === '/api/v1/guards/health') {
        return await handleProductionGuardsHealthCheck(request, env);
      } else {
        const body = ApiResponseFactory.error('Production guards endpoint not found', 'NOT_FOUND', {
          requested_path: path,
          available_endpoints: ['/api/v1/guards/status', '/api/v1/guards/validate', '/api/v1/guards/health']
        });
        return new Response(JSON.stringify(body), { status: HttpStatus.NOT_FOUND, headers });
      }
    } else if (path.startsWith('/api/v1/dashboard/')) {
      // Route to dashboard API
      return await handleDashboardRoutes(request, env, {} as ExecutionContext, headers);
    } else if (path.startsWith('/api/v1/cache/')) {
      // Route to enhanced cache API
      const cacheRoutes = createEnhancedCacheRoutes(env);
      const requestedPath = path.replace('/api/v1', ''); // Convert /api/v1/cache/health to /cache/health

      // Map REST-style paths to enhanced cache route paths
      let cachePath = requestedPath;
      if (requestedPath === '/cache/health') cachePath = '/cache-health';
      else if (requestedPath === '/cache/metrics') cachePath = '/cache-metrics';
      else if (requestedPath === '/cache/config') cachePath = '/cache-config';
      else if (requestedPath === '/cache/promote') cachePath = '/cache-promotion';
      else if (requestedPath === '/cache/warmup') cachePath = '/cache-warmup';
      else if (requestedPath === '/cache/stats') cachePath = '/cache-system-status';
      else if (requestedPath === '/cache/status') cachePath = '/cache-system-status';
      else if (requestedPath === '/cache/timestamps') cachePath = '/cache-timestamps';
      else if (requestedPath === '/cache/debug') cachePath = '/cache-debug';
      else if (requestedPath === '/cache/deduplication') cachePath = '/cache-deduplication';

      // Find matching cache route
      for (const route of cacheRoutes) {
        if (route.path === cachePath && request.method === route.method) {
          return await route.handler(request, env, {} as ExecutionContext);
        }
      }

      const body = ApiResponseFactory.error('Cache endpoint not found', 'NOT_FOUND', { requested_path: path, cachePath, availableRoutes: cacheRoutes.map(r => r.path) });
      return new Response(JSON.stringify(body), { status: HttpStatus.NOT_FOUND, headers });
    } else if (path === '/api/v1/security/status') {
      // Security status endpoint - requires authentication
      const auth = validateApiKey(request, env);
      if (!auth.valid) {
        return new Response(
          JSON.stringify(ApiResponseFactory.error('Invalid or missing API key','UNAUTHORIZED',{ requestId: headers['X-Request-ID'] })),
          { status: HttpStatus.UNAUTHORIZED, headers }
        );
      }

      const securityStatus = getSecurityStatus();
      const body = ApiResponseFactory.success(securityStatus, { requestId: headers['X-Request-ID'] });
      return new Response(JSON.stringify(body), { status: HttpStatus.OK, headers });
    } else if (path === '/api/v1') {
      // API v1 root - return available endpoints
      const body = ApiResponseFactory.success(
        {
          title: 'CCT API v1',
          version: '1.0.0',
          description: 'RESTful API for dual AI sentiment analysis, sector rotation, and market drivers intelligence',
          available_endpoints: {
            sentiment: {
              analysis: 'GET /api/v1/sentiment/analysis',
              symbol: 'GET /api/v1/sentiment/symbols/:symbol',
              market: 'GET /api/v1/sentiment/market',
              sectors: 'GET /api/v1/sentiment/sectors',
            },
            reports: {
              daily: 'GET /api/v1/reports/daily/:date',
              weekly: 'GET /api/v1/reports/weekly/:week',
              pre_market: 'GET /api/v1/reports/pre-market',
              intraday: 'GET /api/v1/reports/intraday',
              end_of_day: 'GET /api/v1/reports/end-of-day',
            },
            data: {
              symbols: 'GET /api/v1/data/symbols',
              history: 'GET /api/v1/data/history/:symbol',
              health: 'GET /api/v1/data/health',
            },
            sector_rotation: {
              analysis: 'POST /api/v1/sector-rotation/analysis',
              results: 'GET /api/v1/sector-rotation/results',
              sectors: 'GET /api/v1/sector-rotation/sectors',
              etf: 'GET /api/v1/sector-rotation/etf/:symbol',
            },
            sectors: {
              snapshot: 'GET /api/v1/sectors/snapshot',
              health: 'GET /api/v1/sectors/health',
              symbols: 'GET /api/v1/sectors/symbols',
            },
            market_drivers: {
              snapshot: 'GET /api/v1/market-drivers/snapshot',
              enhanced_snapshot: 'GET /api/v1/market-drivers/snapshot/enhanced',
              macro: 'GET /api/v1/market-drivers/macro',
              market_structure: 'GET /api/v1/market-drivers/market-structure',
              regime: 'GET /api/v1/market-drivers/regime',
              geopolitical: 'GET /api/v1/market-drivers/geopolitical',
              history: 'GET /api/v1/market-drivers/history',
              health: 'GET /api/v1/market-drivers/health',
            },
            market_intelligence: {
              dashboard: 'GET /api/v1/market-intelligence/dashboard',
              synopsis: 'GET /api/v1/market-intelligence/synopsis',
              top_picks: 'GET /api/v1/market-intelligence/top-picks',
              risk_report: 'GET /api/v1/market-intelligence/risk-report',
              comprehensive_analysis: 'POST /api/v1/market-intelligence/comprehensive-analysis',
            },
            predictive_analytics: {
              signals: 'GET /api/v1/predictive/signals',
              patterns: 'GET /api/v1/predictive/patterns',
              insights: 'GET /api/v1/predictive/insights',
              forecast: 'GET /api/v1/predictive/forecast',
              health: 'GET /api/v1/predictive/health',
            },
            advanced_analytics: {
              model_comparison: 'POST /api/v1/analytics/model-comparison',
              confidence_intervals: 'GET /api/v1/analytics/confidence-intervals',
              ensemble_prediction: 'POST /api/v1/analytics/ensemble-prediction',
              prediction_accuracy: 'GET /api/v1/analytics/prediction-accuracy',
              risk_assessment: 'POST /api/v1/analytics/risk-assessment',
              model_performance: 'GET /api/v1/analytics/model-performance',
              backtest: 'POST /api/v1/analytics/backtest',
              health: 'GET /api/v1/analytics/health',
            },
            technical_analysis: {
              symbols: 'GET /api/v1/technical/symbols/:symbol',
              analysis: 'POST /api/v1/technical/analysis',
            },
            realtime: {
              stream: 'GET /api/v1/realtime/stream',
              status: 'GET /api/v1/realtime/status',
              refresh: 'POST /api/v1/realtime/refresh',
            },
            backtesting: {
              run: 'POST /api/v1/backtesting/run',
              status: 'GET /api/v1/backtesting/status/:runId',
              results: 'GET /api/v1/backtesting/results/:runId',
              performance: 'GET /api/v1/backtesting/performance/:runId',
              compare: 'POST /api/v1/backtesting/compare',
              history: 'GET /api/v1/backtesting/history',
              validation: 'POST /api/v1/backtesting/validation',
              walk_forward: 'POST /api/v1/backtesting/walk-forward',
              monte_carlo: 'POST /api/v1/backtesting/monte-carlo',
            },
            portfolio_optimization: {
              correlation: 'POST /api/v1/portfolio/correlation',
              optimize: 'POST /api/v1/portfolio/optimize',
              efficient_frontier: 'POST /api/v1/portfolio/efficient-frontier',
              risk_metrics: 'POST /api/v1/portfolio/risk-metrics',
              stress_test: 'POST /api/v1/portfolio/stress-test',
              attribution: 'POST /api/v1/portfolio/attribution',
              analytics: 'POST /api/v1/portfolio/analytics',
            },
            portfolio_rebalancing: {
              create_strategy: 'POST /api/v1/portfolio/rebalancing/strategy',
              analyze: 'POST /api/v1/portfolio/rebalancing/analyze',
              execute: 'POST /api/v1/portfolio/rebalancing/execute',
              monitor: 'POST /api/v1/portfolio/rebalancing/monitor',
              tax_harvest: 'POST /api/v1/portfolio/rebalancing/tax-harvest',
              dynamic_allocation: 'POST /api/v1/portfolio/rebalancing/dynamic-allocation',
              stress_test: 'POST /api/v1/portfolio/rebalancing/stress-test',
            },
            risk_management: {
              assessment: 'POST /api/v1/risk/assessment',
              market: 'POST /api/v1/risk/market',
              concentration: 'POST /api/v1/risk/concentration',
              liquidity: 'POST /api/v1/risk/liquidity',
              stress_test: 'POST /api/v1/risk/stress-test',
              compliance: 'POST /api/v1/risk/compliance',
              regulatory_report: 'POST /api/v1/risk/regulatory-report',
              limits: 'POST /api/v1/risk/limits',
              analytics: 'POST /api/v1/risk/analytics',
              health: 'GET /api/v1/risk/health',
            },
            production_guards: {
              status: 'GET /api/v1/guards/status',
              validate: 'GET /api/v1/guards/validate',
              health: 'GET /api/v1/guards/health',
            },
            cache: {
              health: 'GET /api/v1/cache/health',
              metrics: 'GET /api/v1/cache/metrics',
              config: 'GET /api/v1/cache/config',
              promote: 'GET /api/v1/cache/promote',
              warmup: 'POST /api/v1/cache/warmup',
              status: 'GET /api/v1/cache/status',
              stats: 'GET /api/v1/cache/stats',
              timestamps: 'GET /api/v1/cache/timestamps?namespace=sentiment_analysis&key=AAPL_sentiment',
              debug: 'GET /api/v1/cache/debug?namespace=sentiment_analysis&key=AAPL_sentiment',
              deduplication: 'GET /api/v1/cache/deduplication?details=true',
            },
            dashboard: {
              metrics: 'GET /api/v1/dashboard/metrics',
              economics: 'GET /api/v1/dashboard/economics',
              guards: 'GET /api/v1/dashboard/guards',
              health: 'GET /api/v1/dashboard/health',
              refresh: 'POST /api/v1/dashboard/refresh',
            },
            security: {
              status: 'GET /api/v1/security/status',
            },
          } as ApiDocumentation['available_endpoints'],
          documentation: 'https://github.com/yanggf8/cct',
          status: 'operational',
        } as ApiDocumentation,
        { requestId: headers['X-Request-ID'] }
      );
      return new Response(JSON.stringify(body), { status: HttpStatus.OK, headers });
    } else {
      const body = ApiResponseFactory.error('Endpoint not found', 'NOT_FOUND', { requested_path: path });
      return new Response(JSON.stringify(body), { status: HttpStatus.NOT_FOUND, headers });
    }
  } catch (error: any) {
    console.error('API v1 Error:', error);
    const body = ApiResponseFactory.error('Internal server error', 'INTERNAL_ERROR', { message: error?.message });
    return new Response(JSON.stringify(body), { status: HttpStatus.INTERNAL_SERVER_ERROR, headers });
  }
}

/**
 * CORS preflight handler for API v1
 */
export function handleApiV1CORS(): Response {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * Exported helpers used by per-domain route modules
 */
export function generateRequestId(): string {
  return genReqId();
}

export function validateApiKey(request: Request, env: CloudflareEnvironment): ApiKeyValidation {
  const apiKey = request.headers.get('X-API-Key');

  // Get API keys from environment variable
  const configuredKeys = env.X_API_KEY ? env.X_API_KEY.split(',').filter(Boolean) : [];

  if (configuredKeys.length === 0) {
    console.error('CRITICAL: No API keys configured in X_API_KEY environment variable');

    // Record failed auth attempt (no configured keys)
    recordAuthAttempt(request, apiKey, false, 'no_keys_configured');
    return { valid: false, key: null };
  }

  if (!apiKey) {
    // Record failed auth attempt (missing API key)
    recordAuthAttempt(request, null, false, 'missing_api_key');
    return { valid: false, key: null };
  }

  const validKeys = configuredKeys.map(key => key.trim());
  const isValid = validKeys.includes(apiKey);

  if (!isValid) {
    console.warn(`AUTH_FAILED: Invalid API key attempt for request ID: ${genReqId()}`);

    // Record failed auth attempt (invalid API key)
    recordAuthAttempt(request, apiKey, false, 'invalid_api_key');
    return { valid: false, key: apiKey };
  }

  // Record successful authentication
  recordAuthAttempt(request, apiKey, true);
  return { valid: true, key: apiKey };
}

// Utility helpers used by route modules
export function parseQueryParams(url: URL): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) {
    params[k] = v;
  }
  return params;
}

export function extractSymbolsParam(params: Record<string, string>): string[] {
  const raw = params.symbols || params.symbol || '';
  if (!raw) return [];
  return raw
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
}