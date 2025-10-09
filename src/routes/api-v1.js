/**
 * API v1 Router
 * RESTful API endpoints following DAC patterns
 * Delegates to per-domain route handlers and standardizes responses
 */

import { ApiResponseFactory, HttpStatus, generateRequestId as genReqId } from '../modules/api-v1-responses.js';
import { handleSentimentRoutes } from './sentiment-routes.ts';
import { handleReportRoutes } from './report-routes.ts';
import { handleDataRoutes } from './data-routes.ts';

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
    } else if (path === '/api/v1') {
      // API v1 root - return available endpoints
      const body = ApiResponseFactory.success(
        {
          title: 'CCT API v1',
          version: '1.0.0',
          description: 'RESTful API for dual AI sentiment analysis',
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
