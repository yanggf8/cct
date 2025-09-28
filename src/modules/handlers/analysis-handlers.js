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
import { createHandler, createAPIHandler } from '../handler-factory.js';
import { createAnalysisResponse } from '../response-factory.js';
import { BusinessMetrics } from '../monitoring.js';

const logger = createLogger('analysis-handlers');

/**
 * Handle manual analysis requests (Enhanced with sentiment)
 */
export const handleManualAnalysis = createAPIHandler('enhanced-analysis', async (request, env, ctx) => {
  // Track business metrics
  BusinessMetrics.analysisRequested('manual_enhanced', 5);

  try {
    const analysis = await runEnhancedAnalysis(env, {
      triggerMode: 'manual_analysis_enhanced',
      requestId: ctx.requestId
    });

    // Track successful completion
    BusinessMetrics.analysisCompleted('manual_enhanced',
      analysis.symbols_analyzed?.length || 0,
      analysis.execution_metrics?.total_time_ms || 0
    );

    return createAnalysisResponse(analysis, {
      requestId: ctx.requestId,
      symbolsAnalyzed: analysis.symbols_analyzed?.length || 0,
      processingTime: analysis.execution_metrics?.total_time_ms,
      confidence: analysis.overall_confidence
    });

  } catch (error) {
    // Try fallback to basic analysis
    try {
      const basicAnalysis = await runBasicAnalysis(env, {
        triggerMode: 'manual_analysis_fallback',
        requestId: ctx.requestId
      });

      basicAnalysis.fallback_reason = error.message;

      BusinessMetrics.analysisCompleted('manual_fallback',
        basicAnalysis.symbols_analyzed?.length || 0,
        basicAnalysis.execution_metrics?.total_time_ms || 0
      );

      return createAnalysisResponse(basicAnalysis, {
        requestId: ctx.requestId,
        symbolsAnalyzed: basicAnalysis.symbols_analyzed?.length || 0,
        processingTime: basicAnalysis.execution_metrics?.total_time_ms,
        fallbackReason: error.message
      });
    } catch (fallbackError) {
      BusinessMetrics.analysisFailed('manual_enhanced', fallbackError.name);
      throw fallbackError; // Let factory handle error response
    }
  }
}, {
  enableMetrics: true,
  enableAuth: false,
  timeout: 120000 // 2 minutes for analysis
});

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
/**
 * Handle morning predictions generation from existing analysis data
 */
export async function handleGenerateMorningPredictions(request, env) {
  const requestId = crypto.randomUUID();
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];

  try {
    logger.info('🌅 Morning predictions generation requested', { requestId, date: dateStr });

    // Check if analysis data exists for today
    const analysisKey = `analysis_${dateStr}`;
    const analysisData = await env.TRADING_RESULTS.get(analysisKey);

    if (!analysisData) {
      logger.warn('⚠️ No analysis data found for today', { requestId, date: dateStr });
      return new Response(JSON.stringify({
        success: false,
        error: 'No analysis data found for today. Run analysis first.',
        request_id: requestId,
        date: dateStr,
        action_required: 'Run /analyze endpoint first'
      }, null, 2), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const analysis = JSON.parse(analysisData);

    // Import the cron signal tracker
    const { cronSignalTracker } = await import('../cron-signal-tracking.js');

    // Generate morning predictions from analysis data
    const success = await cronSignalTracker.saveMorningPredictions(env, analysis, today);

    if (success) {
      logger.info('✅ Morning predictions generated successfully', { requestId, date: dateStr });

      // Verify the predictions were stored
      const predictionsKey = `morning_predictions_${dateStr}`;
      const storedPredictions = await env.TRADING_RESULTS.get(predictionsKey);
      const predictions = storedPredictions ? JSON.parse(storedPredictions) : null;

      return new Response(JSON.stringify({
        success: true,
        message: 'Morning predictions generated and stored successfully',
        request_id: requestId,
        date: dateStr,
        predictions_stored: !!predictions,
        signal_count: predictions?.predictions?.length || 0,
        high_confidence_signals: predictions?.metadata?.totalSignals || 0,
        average_confidence: predictions?.metadata?.averageConfidence?.toFixed(1) || 0,
        predictions_key: predictionsKey,
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      logger.error('❌ Failed to generate morning predictions', { requestId, date: dateStr });
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to generate morning predictions from analysis data',
        request_id: requestId,
        date: dateStr,
        analysis_found: !!analysis,
        symbols_analyzed: analysis.symbols_analyzed?.length || 0
      }, null, 2), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    logger.error('❌ Morning predictions generation failed', {
      requestId,
      date: dateStr,
      error: error.message,
      stack: error.stack
    });

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      request_id: requestId,
      date: dateStr,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
