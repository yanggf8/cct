/**
 * Technical Analysis Routes (API v1)
 * Exposes independent technical indicator analysis endpoints
 */

import {
  ApiResponseFactory,
  ProcessingTimer,
  HttpStatus
} from '../modules/api-v1-responses.js';
import {
  validateApiKey,
  generateRequestId
} from './api-v1.js';
import { createDAL } from '../modules/dal.js';
import { createLogger } from '../modules/logging.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('technical-routes');

// Response types
export interface TechnicalSignalResponse {
  symbol: string;
  timestamp: string;
  current_price: number;
  predicted_price: number;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  confidence: number;
  technical_score: number;
  signal_strength: number;
  reasoning: string;
  analysis_type: string;
  feature_summary: string;
}

export interface TechnicalBatchResponse {
  timestamp: string;
  analysis_type: string;
  feature_count: number;
  symbols_analyzed: string[];
  technical_signals: Record<string, TechnicalSignalResponse | { symbol: string; status: string; error?: string }>;
  system_performance: {
    success_rate: number;
    avg_confidence: number;
    feature_coverage: number;
  };
}

/**
 * Handle all technical analysis routes
 */
export async function handleTechnicalRoutes(
  request: Request,
  env: CloudflareEnvironment,
  path: string,
  headers: Record<string, string>
): Promise<Response> {
  const method = request.method;
  const requestId = headers['X-Request-ID'] || generateRequestId();

  // Require API key
  const auth = validateApiKey(request);
  if (!auth.valid) {
    return new Response(
      JSON.stringify(ApiResponseFactory.error('Invalid or missing API key','UNAUTHORIZED',{ requestId })),
      { status: HttpStatus.UNAUTHORIZED, headers }
    );
  }

  try {
    // GET /api/v1/technical/symbols/:symbol
    const singleMatch = path.match(/^\/api\/v1\/technical\/symbols\/([A-Z0-9]{1,10})$/);
    if (singleMatch && method === 'GET') {
      const symbol = singleMatch[1];
      return await handleTechnicalSingle(symbol, request, env, headers, requestId);
    }

    // POST /api/v1/technical/analysis
    if (path === '/api/v1/technical/analysis' && method === 'POST') {
      return await handleTechnicalBatch(request, env, headers, requestId);
    }

    return new Response(
      JSON.stringify(ApiResponseFactory.error(`Method ${method} not allowed for ${path}`,'METHOD_NOT_ALLOWED',{ requestId })),
      { status: HttpStatus.METHOD_NOT_ALLOWED, headers }
    );
  } catch (error:any) {
    logger.error('TechnicalRoutes Error', error, { requestId, path, method });
    return new Response(
      JSON.stringify(ApiResponseFactory.error('Internal server error','INTERNAL_ERROR',{ requestId, error: error.message })),
      { status: HttpStatus.INTERNAL_SERVER_ERROR, headers }
    );
  }
}

async function handleTechnicalSingle(
  symbol: string,
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  const dal = createDAL(env);
  try {
    if (!symbol || symbol.length > 10) {
      return new Response(JSON.stringify(ApiResponseFactory.error('Invalid symbol format','INVALID_SYMBOL',{ requestId, symbol })), { status: HttpStatus.BAD_REQUEST, headers });
    }

    const cacheKey = `technical_signal_${symbol}_${new Date().toISOString().split('T')[0]}`;
    const cached = await dal.read(cacheKey);
    if (cached.success && cached.data) {
      return new Response(JSON.stringify(ApiResponseFactory.cached(cached.data,'hit',{ source:'cache', ttl: 1800, requestId, processingTime: timer.getElapsedMs() })), { status: HttpStatus.OK, headers });
    }

    const { runIndependentTechnicalAnalysis } = await import('../modules/independent_technical_analysis.js');
    const result = await runIndependentTechnicalAnalysis([symbol], env);
    const signal = result.technical_signals?.[symbol];

    if (!signal || signal.status === 'failed') {
      return new Response(JSON.stringify(ApiResponseFactory.error('No technical analysis available','NO_DATA',{ requestId, symbol })), { status: HttpStatus.NOT_FOUND, headers });
    }

    await dal.write(cacheKey, signal, { expirationTtl: 1800 });

    return new Response(JSON.stringify(ApiResponseFactory.success(signal, { source:'fresh', ttl: 1800, requestId, processingTime: timer.finish() })), { status: HttpStatus.OK, headers });
  } catch (error:any) {
    return new Response(JSON.stringify(ApiResponseFactory.error('Failed to perform technical analysis','ANALYSIS_ERROR',{ requestId, symbol, error: error.message, processingTime: timer.finish() })), { status: HttpStatus.INTERNAL_SERVER_ERROR, headers });
  }
}

async function handleTechnicalBatch(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  try {
    const body = await request.json().catch(() => ({}));
    const symbols: string[] = Array.isArray(body.symbols) ? body.symbols.map((s:string)=>String(s).toUpperCase().slice(0,10)) : [];

    if (!symbols.length) {
      return new Response(JSON.stringify(ApiResponseFactory.error('Body must include symbols array','INVALID_REQUEST',{ requestId })), { status: HttpStatus.BAD_REQUEST, headers });
    }

    const { runIndependentTechnicalAnalysis } = await import('../modules/independent_technical_analysis.js');
    const result: TechnicalBatchResponse = await runIndependentTechnicalAnalysis(symbols, env);

    return new Response(JSON.stringify(ApiResponseFactory.success(result, { source:'fresh', ttl: 1800, requestId, processingTime: timer.finish(), metadata: { symbols: symbols.length } })), { status: HttpStatus.OK, headers });
  } catch (error:any) {
    return new Response(JSON.stringify(ApiResponseFactory.error('Failed to perform technical batch analysis','ANALYSIS_ERROR',{ requestId, error: error.message, processingTime: timer.finish() })), { status: HttpStatus.INTERNAL_SERVER_ERROR, headers });
  }
}
