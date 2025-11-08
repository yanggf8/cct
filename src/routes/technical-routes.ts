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
import {
  validateSymbol,
  validateSymbols,
  validateRequestBody,
  ValidationError,
  safeValidate
} from '../modules/validation.js';
import { createSimplifiedEnhancedDAL } from '../modules/simplified-enhanced-dal.js';
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
  const auth = validateApiKey(request, env);
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
    logger.error('TechnicalRoutes Error', { error: (error as any).message, requestId, path, method });
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
  const dal = createSimplifiedEnhancedDAL(env);
  try {
    // Validate and sanitize symbol
    const validatedSymbol = validateSymbol(symbol);

    const cacheKey = `technical_signal_${validatedSymbol}_${new Date().toISOString().split('T')[0]}`;
    const cached = await dal.read(cacheKey);
    if (cached.success && cached.data) {
      return new Response(JSON.stringify(ApiResponseFactory.cached(cached.data,'hit',{ source:'cache', ttl: 1800, requestId, processingTime: timer.getElapsedMs() })), { status: HttpStatus.OK, headers });
    }

    const { runIndependentTechnicalAnalysis } = await import('../modules/independent_technical_analysis.js');
    const result = await runIndependentTechnicalAnalysis([symbol], env);
    const signal = result.technical_signals?.[symbol];

    if (!signal || (signal as any).status === 'failed') {
      return new Response(JSON.stringify(ApiResponseFactory.error('No technical analysis available','NO_DATA',{ requestId, symbol })), { status: HttpStatus.NOT_FOUND, headers });
    }

    await dal.write(cacheKey, signal, { expirationTtl: 1800 });

    return new Response(JSON.stringify(ApiResponseFactory.success(signal, { source:'fresh', ttl: 1800, requestId, processingTime: timer.finish() })), { status: HttpStatus.OK, headers });
  } catch (error:any) {
    // Handle validation errors specifically
    if (error instanceof ValidationError) {
      logger.warn('TechnicalSingle Validation Error', {
        field: error.field,
        value: error.value,
        message: error.message,
        requestId,
        symbol
      });
      return new Response(
        JSON.stringify(
          ApiResponseFactory.error(
            `Invalid input: ${error.message}`,
            'VALIDATION_ERROR',
            {
              requestId,
              symbol,
              field: error.field,
              value: error.value
            }
          )
        ),
        {
          status: HttpStatus.BAD_REQUEST,
          headers
        }
      );
    }

    return new Response(JSON.stringify(ApiResponseFactory.error('Failed to perform technical analysis','ANALYSIS_ERROR',{ requestId, symbol, error: (error instanceof Error ? error.message : String(error)), processingTime: timer.finish() })), { status: HttpStatus.INTERNAL_SERVER_ERROR, headers });
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
    // Validate request body
    const body = await request.json().catch(() => ({})) as any;
    const validatedBody = validateRequestBody(body, ['symbols']);

    // Validate and sanitize symbols array
    const symbols = validateSymbols(validatedBody.symbols);

    const { runIndependentTechnicalAnalysis } = await import('../modules/independent_technical_analysis.js');
    const result: TechnicalBatchResponse = await runIndependentTechnicalAnalysis(symbols, env);

    return new Response(JSON.stringify(ApiResponseFactory.success(result, { source:'fresh', ttl: 1800, requestId, processingTime: timer.finish(), metadata: { symbols: symbols.length } })), { status: HttpStatus.OK, headers });
  } catch (error:any) {
    // Handle validation errors specifically
    if (error instanceof ValidationError) {
      logger.warn('TechnicalBatch Validation Error', {
        field: error.field,
        value: error.value,
        message: error.message,
        requestId
      });
      return new Response(
        JSON.stringify(
          ApiResponseFactory.error(
            `Invalid input: ${error.message}`,
            'VALIDATION_ERROR',
            {
              requestId,
              field: error.field,
              value: error.value
            }
          )
        ),
        {
          status: HttpStatus.BAD_REQUEST,
          headers
        }
      );
    }

    return new Response(JSON.stringify(ApiResponseFactory.error('Failed to perform technical batch analysis','ANALYSIS_ERROR',{ requestId, error: (error instanceof Error ? error.message : String(error)), processingTime: timer.finish() })), { status: HttpStatus.INTERNAL_SERVER_ERROR, headers });
  }
}
