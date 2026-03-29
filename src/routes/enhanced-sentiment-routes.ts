/**
 * Enhanced Sentiment Analysis Routes
 * Provides sentiment analysis with DAC articles pool integration and quality metrics.
 * Uses EnhancedSentimentPipeline (DAC priority → free APIs fallback).
 *
 * Endpoints:
 *   GET  /api/v1/sentiment/enhanced              - Multi-symbol (default 5 symbols)
 *   GET  /api/v1/sentiment/enhanced/:symbol      - Single symbol
 */

import { ApiResponseFactory, HttpStatus, ProcessingTimer } from '../modules/api-v1-responses.js';
import { validateSymbol, ValidationError } from '../modules/validation.js';
import { createEnhancedSentimentPipeline } from '../modules/enhanced-sentiment-pipeline.js';
import { createLogger } from '../modules/logging.js';
import { generateRequestId } from './api-v1.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('enhanced-sentiment-routes');

const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'];

export async function handleEnhancedSentimentRoutes(
  request: Request,
  env: CloudflareEnvironment,
  path: string,
  headers: Record<string, string>
): Promise<Response> {
  const requestId = headers['X-Request-ID'] || generateRequestId();

  try {
    // GET /api/v1/sentiment/enhanced/:symbol
    const symbolMatch = path.match(/^\/api\/v1\/sentiment\/enhanced\/([A-Z0-9]{1,10})$/);
    if (symbolMatch && request.method === 'GET') {
      return await handleEnhancedSingle(symbolMatch[1], env, headers, requestId);
    }

    // GET /api/v1/sentiment/enhanced
    if (path === '/api/v1/sentiment/enhanced' && request.method === 'GET') {
      const url = new URL(request.url);
      const symbolsParam = url.searchParams.get('symbols');
      const symbols = symbolsParam
        ? symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
        : DEFAULT_SYMBOLS;
      return await handleEnhancedMulti(symbols, env, headers, requestId);
    }

    return new Response(
      JSON.stringify(ApiResponseFactory.error(`Not found: ${path}`, 'NOT_FOUND', { requestId })),
      { status: HttpStatus.NOT_FOUND, headers }
    );
  } catch (error: unknown) {
    logger.error('EnhancedSentimentRoutes error', { error: error instanceof Error ? error.message : 'Unknown', requestId, path });
    return new Response(
      JSON.stringify(ApiResponseFactory.error('Internal server error', 'INTERNAL_ERROR', { requestId })),
      { status: HttpStatus.INTERNAL_SERVER_ERROR, headers }
    );
  }
}

async function handleEnhancedSingle(
  symbol: string,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();

  try {
    const validatedSymbol = validateSymbol(symbol);
    const pipeline = createEnhancedSentimentPipeline(env);
    const result = await pipeline.analyzeSentiment(validatedSymbol);

    logger.info('EnhancedSingle: Analysis complete', { symbol: validatedSymbol, processingTime: timer.getElapsedMs(), requestId });

    return new Response(
      JSON.stringify(ApiResponseFactory.success(result, { source: 'fresh', ttl: 3600, requestId, processingTime: timer.finish() })),
      { status: HttpStatus.OK, headers }
    );
  } catch (error: unknown) {
    if (error instanceof ValidationError) {
      return new Response(
        JSON.stringify(ApiResponseFactory.error(`Invalid input: ${error.message}`, 'VALIDATION_ERROR', { requestId, symbol, field: error.field })),
        { status: HttpStatus.BAD_REQUEST, headers }
      );
    }
    logger.error('EnhancedSingle error', { error: error instanceof Error ? error.message : 'Unknown', requestId, symbol });
    return new Response(
      JSON.stringify(ApiResponseFactory.error('Failed to perform enhanced sentiment analysis', 'ANALYSIS_ERROR', { requestId, symbol })),
      { status: HttpStatus.INTERNAL_SERVER_ERROR, headers }
    );
  }
}

async function handleEnhancedMulti(
  symbols: string[],
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();

  if (symbols.length > 10) {
    return new Response(
      JSON.stringify(ApiResponseFactory.error('Maximum 10 symbols per request', 'TOO_MANY_SYMBOLS', { requestId, limit: 10, provided: symbols.length })),
      { status: HttpStatus.BAD_REQUEST, headers }
    );
  }

  const pipeline = createEnhancedSentimentPipeline(env);

  const results = await Promise.allSettled(
    symbols.map(symbol => pipeline.analyzeSentiment(symbol))
  );

  const data = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { symbol: symbols[i], sentiment: 'neutral', confidence: 0, score: 0, reasoning: 'Analysis failed', sources_used: [], article_count: 0, quality_metrics: { avg_freshness_hours: 0, total_confidence_penalty: 0, source_diversity: 0 }, timestamp: new Date().toISOString(), error: r.reason instanceof Error ? r.reason.message : 'Unknown error' }
  );

  const successful = data.filter(r => !('error' in r)).length;

  const response = {
    symbols,
    results: data,
    summary: {
      total: symbols.length,
      successful,
      failed: symbols.length - successful,
      analysis_time_ms: timer.getElapsedMs(),
    },
  };

  logger.info('EnhancedMulti: Analysis complete', { symbols: symbols.join(','), successful, processingTime: timer.getElapsedMs(), requestId });

  return new Response(
    JSON.stringify(ApiResponseFactory.success(response, { source: 'fresh', ttl: 3600, requestId, processingTime: timer.finish() })),
    { status: HttpStatus.OK, headers }
  );
}
