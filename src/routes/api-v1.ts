/**
 * API v1 Router
 * RESTful API endpoints following DAC patterns
 * Replaces legacy endpoints with clean, predictable structure
 */

import { handleSentimentRoutes } from './routes/sentiment-routes.js';
import { handleReportRoutes } from './routes/report-routes.js';
import { handleDataRoutes } from './routes/data-routes.js';
import { ApiResponseFactory, generateRequestId } from '../modules/api-v1-responses.js';
import type { CloudflareEnvironment } from '../types.js';

/**
 * Main v1 API Router
 * Handles all /api/v1/* endpoints with consistent routing
 */
export async function handleApiV1Request(
  request: Request,
  env: CloudflareEnvironment,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const requestId = generateRequestId();

  // Add request ID to headers for tracking
  const headers = {
    'X-Request-ID': requestId,
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
    } else {
      // API v1 root - return available endpoints
      return new Response(
        JSON.stringify({
          success: true,
          data: {
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
          timestamp: new Date().toISOString(),
          metadata: {
            requestId,
            version: 'v1',
          },
        }),
        { status: 200, headers }
      );
    }
  } catch (error) {
    console.error('API v1 Error:', error, { requestId, path });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Internal server error',
          'INTERNAL_ERROR',
          { requestId, path, error: error instanceof Error ? error.message : 'Unknown error' }
        )
      ),
      {
        status: 500,
        headers,
      }
    );
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
 * Validate API key for protected endpoints
 */
export function validateApiKey(request: Request): { valid: boolean; key?: string } {
  const apiKey = request.headers.get('X-API-Key');

  // For now, accept common keys - enhance this based on your security requirements
  const validKeys = ['yanggf', 'demo', 'test'];

  if (!apiKey) {
    return { valid: false };
  }

  return { valid: validKeys.includes(apiKey), key: apiKey };
}

/**
 * Parse query parameters safely
 */
export function parseQueryParams(url: URL): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {};

  for (const [key, value] of url.searchParams) {
    if (params[key]) {
      // Convert to array if multiple values
      if (Array.isArray(params[key])) {
        (params[key] as string[]).push(value);
      } else {
        params[key] = [params[key] as string, value];
      }
    } else {
      params[key] = value;
    }
  }

  return params;
}

/**
 * Extract date parameter with validation
 */
export function extractDateParam(params: Record<string, string | string[]>, paramName: string = 'date'): string {
  const date = params[paramName] as string;

  if (!date) {
    return new Date().toISOString().split('T')[0]; // Default to today
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    throw new Error(`Invalid date format for ${paramName}. Expected YYYY-MM-DD, got: ${date}`);
  }

  return date;
}

/**
 * Extract symbols parameter with validation
 */
export function extractSymbolsParam(params: Record<string, string | string[]>): string[] {
  const symbolsParam = params.symbols;

  if (!symbolsParam) {
    return []; // Return empty array if no symbols provided
  }

  const symbols = Array.isArray(symbolsParam) ? symbolsParam : [symbolsParam];

  // Validate each symbol
  return symbols
    .flatMap(s => s.split(','))
    .map(s => s.trim().toUpperCase())
    .filter(s => s.length > 0 && s.length <= 10) // Basic validation
    .slice(0, 20); // Limit to 20 symbols maximum
}

/**
 * Extract pagination parameters
 */
export function extractPaginationParams(params: Record<string, string | string[]>): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = parseInt(params.page as string) || 1;
  const limit = Math.min(parseInt(params.limit as string) || 50, 100); // Max 100 items

  return {
    page: Math.max(page, 1),
    limit: Math.max(limit, 1),
    offset: Math.max(page - 1, 0) * limit,
  };
}