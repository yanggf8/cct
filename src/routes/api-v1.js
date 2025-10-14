/**
 * API v1 Router
 * RESTful API endpoints following DAC patterns
 * Delegates to per-domain route handlers and standardizes responses
 */

import { ApiResponseFactory, HttpStatus, generateRequestId as genReqId } from '../modules/api-v1-responses.js';
import { handleSentimentRoutes } from './sentiment-routes.ts';
import { handleReportRoutes } from './report-routes.ts';
import { handleDataRoutes } from './data-routes.ts';
import { handleSectorRotationRoutes } from './sector-rotation-routes.ts';
import { sectorRoutes } from './sector-routes.ts';
import { handleMarketDriversRoutes } from './market-drivers-routes.js';
import { handleMarketIntelligenceRoutes } from './market-intelligence-routes.js';
import { handlePredictiveAnalyticsRoutes } from './predictive-analytics-routes.js';
import { handleTechnicalRoutes } from './technical-routes.ts';
import { handleAdvancedAnalyticsRoutes } from './advanced-analytics-routes.ts';
import { getSectorIndicatorsSymbol } from './sector-routes.ts';

/**
 * Main v1 API Router
 */
export async function handleApiV1Request(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Add request ID to headers for tracking
  const headers = {
    'X-Request-ID': genReqId(),
    'X-API-Version': 'v1',
    'Content-Type': 'application/json',
  };

  try {
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
          },
          documentation: 'https://github.com/yanggf8/cct',
          status: 'operational',
        },
        { requestId: headers['X-Request-ID'] }
      );
      return new Response(JSON.stringify(body), { status: HttpStatus.OK, headers });
    } else {
      const body = ApiResponseFactory.error('Endpoint not found', 'NOT_FOUND', { requested_path: path });
      return new Response(JSON.stringify(body), { status: HttpStatus.NOT_FOUND, headers });
    }
  } catch (error) {
    console.error('API v1 Error:', error);
    const body = ApiResponseFactory.error('Internal server error', 'INTERNAL_ERROR', { message: error?.message });
    return new Response(JSON.stringify(body), { status: HttpStatus.INTERNAL_SERVER_ERROR, headers });
  }
}

/**
 * CORS preflight handler for API v1
 */
export function handleApiV1CORS() {
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
export function generateRequestId() {
  return genReqId();
}

export function validateApiKey(request) {
  const apiKey = request.headers.get('X-API-Key');
  const validKeys = ['yanggf', 'demo', 'test'];
  return { valid: validKeys.includes(apiKey), key: apiKey };
}

// Utility helpers used by route modules
export function parseQueryParams(url) {
  const params = {};
  for (const [k, v] of url.searchParams.entries()) {
    params[k] = v;
  }
  return params;
}

export function extractSymbolsParam(params) {
  const raw = params.symbols || params.symbol || '';
  if (!raw) return [];
  return raw
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
}
