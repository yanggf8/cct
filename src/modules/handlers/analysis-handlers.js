/**
 * Analysis-related HTTP Request Handlers
 * Handles core trading analysis functionality
 */

import { runBasicAnalysis, runWeeklyMarketCloseAnalysis } from '../analysis.js';
import { runEnhancedAnalysis, validateSentimentEnhancement } from '../enhanced_analysis.js';
import { runEnhancedFeatureAnalysis } from '../enhanced_feature_analysis.js';
import { runIndependentTechnicalAnalysis } from '../independent_technical_analysis.js';
import { analyzeSingleSymbol } from '../per_symbol_analysis.js';
import { createLogger } from '../logging.js';

const logger = createLogger('analysis-handlers');

/**
 * Handle manual analysis requests (Enhanced with sentiment)
 */
export async function handleManualAnalysis(request, env) {
  const requestId = crypto.randomUUID();

  try {
    logger.info('Enhanced analysis requested', {
      requestId,
      trigger: 'manual_analysis_enhanced',
      userAgent: request.headers.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    const analysis = await runEnhancedAnalysis(env, {
      triggerMode: 'manual_analysis_enhanced',
      requestId
    });

    logger.info('Enhanced analysis completed successfully', {
      requestId,
      symbolsAnalyzed: analysis.symbols_analyzed?.length || 0,
      performanceMetrics: analysis.performance_metrics,
      duration: analysis.execution_metrics?.total_time_ms
    });

    return new Response(JSON.stringify(analysis, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    logger.error('Enhanced analysis failed, attempting fallback', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    try {
      const basicAnalysis = await runBasicAnalysis(env, {
        triggerMode: 'manual_analysis_fallback',
        requestId
      });
      basicAnalysis.fallback_reason = error.message;

      logger.warn('Fallback analysis completed', {
        requestId,
        fallbackReason: error.message,
        symbolsAnalyzed: basicAnalysis.symbols_analyzed?.length || 0
      });

      return new Response(JSON.stringify(basicAnalysis, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (fallbackError) {
      logger.error('Both enhanced and fallback analysis failed', {
        requestId,
        enhancedError: error.message,
        fallbackError: fallbackError.message
      });

      return new Response(JSON.stringify({
        success: false,
        error: fallbackError.message,
        original_error: error.message,
        request_id: requestId,
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}

/**
 * Handle enhanced feature analysis requests
 */
export async function handleEnhancedFeatureAnalysis(request, env) {
  const requestId = crypto.randomUUID();

  try {
    logger.info('Enhanced feature analysis requested', { requestId });

    const analysis = await runEnhancedFeatureAnalysis(env, {
      triggerMode: 'enhanced_feature_analysis',
      requestId
    });

    logger.info('Enhanced feature analysis completed', {
      requestId,
      symbolsAnalyzed: analysis.symbols_analyzed?.length || 0
    });

    return new Response(JSON.stringify(analysis, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('Enhanced feature analysis failed', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      request_id: requestId,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle independent technical analysis requests
 */
export async function handleIndependentTechnicalAnalysis(request, env) {
  const requestId = crypto.randomUUID();

  try {
    logger.info('Independent technical analysis requested', { requestId });

    const analysis = await runIndependentTechnicalAnalysis(env, {
      triggerMode: 'independent_technical_analysis',
      requestId
    });

    logger.info('Independent technical analysis completed', {
      requestId,
      symbolsAnalyzed: analysis.symbols_analyzed?.length || 0
    });

    return new Response(JSON.stringify(analysis, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('Independent technical analysis failed', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      request_id: requestId,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle per-symbol analysis requests
 */
export async function handlePerSymbolAnalysis(request, env) {
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  const symbol = url.searchParams.get('symbol');

  try {
    if (!symbol) {
      logger.warn('Per-symbol analysis requested without symbol parameter', { requestId });
      return new Response(JSON.stringify({
        success: false,
        error: 'Symbol parameter is required',
        request_id: requestId,
        usage: '/analyze-symbol?symbol=AAPL'
      }, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    logger.info('Per-symbol analysis requested', { requestId, symbol });

    const analysis = await analyzeSingleSymbol(symbol, env, { requestId });

    logger.info('Per-symbol analysis completed', {
      requestId,
      symbol,
      confidence: analysis.confidence,
      direction: analysis.direction
    });

    return new Response(JSON.stringify(analysis, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('Per-symbol analysis failed', {
      requestId,
      symbol,
      error: error.message,
      stack: error.stack
    });

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      symbol: symbol,
      request_id: requestId,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle sentiment testing requests
 */
export async function handleSentimentTest(request, env) {
  const requestId = crypto.randomUUID();

  try {
    logger.info('Sentiment validation test requested', { requestId });

    const validation = await validateSentimentEnhancement(env, { requestId });

    logger.info('Sentiment validation completed', {
      requestId,
      success: validation.success,
      modelsAvailable: validation.models_available
    });

    return new Response(JSON.stringify(validation, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('Sentiment validation test failed', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      request_id: requestId,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}