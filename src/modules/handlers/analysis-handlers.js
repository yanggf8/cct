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
import { getJobStatus, validateDependencies } from '../kv-utils.js';
import { createDAL } from '../dal.js';

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
    const dal = createDAL(env);
    const analysisKey = `analysis_${dateStr}`;
    const analysisResult = await dal.read(analysisKey);

    if (!analysisResult.success || !analysisResult.data) {
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

    const analysis = analysisResult.data;

    // Import the cron signal tracker
    const { cronSignalTracker } = await import('../cron-signal-tracking.js');

    // Generate morning predictions from analysis data
    const success = await cronSignalTracker.saveMorningPredictions(env, analysis, today);

    if (success) {
      logger.info('✅ Morning predictions generated successfully', { requestId, date: dateStr });

      // Verify the predictions were stored
      const predictionsKey = `morning_predictions_${dateStr}`;
      const predictionsResult = await dal.read(predictionsKey);
      const predictions = predictionsResult.success ? predictionsResult.data : null;

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

/**
 * Handle status management for testing the KV pipeline
 */
export async function handleStatusManagement(request, env) {
  const requestId = crypto.randomUUID();
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];

  try {
    logger.info('🔍 [STATUS] Status management requested', { requestId, date: dateStr });

    // Get all job statuses for today
    const jobTypes = ['analysis', 'morning_predictions', 'pre_market_briefing', 'intraday_check', 'end_of_day_summary'];
    const statuses = {};

    for (const jobType of jobTypes) {
      try {
        const status = await getJobStatus(jobType, dateStr, env);
        statuses[jobType] = status;
      } catch (error) {
        statuses[jobType] = { status: 'missing', error: error.message };
      }
    }

    // Check key data existence
    const dataKeys = {
      analysis: `analysis_${dateStr}`,
      morning_predictions: `morning_predictions_${dateStr}`,
      intraday_tracking: `intraday_tracking_${dateStr}`,
      eod_summary: `eod_summary_${dateStr}`
    };

    const dal = createDAL(env);
    const dataExists = {};
    for (const [keyName, keyValue] of Object.entries(dataKeys)) {
      try {
        const result = await dal.read(keyValue);
        dataExists[keyName] = result.success && !!result.data;
      } catch (error) {
        dataExists[keyName] = false;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      request_id: requestId,
      date: dateStr,
      job_statuses: statuses,
      data_exists: dataExists,
      dependency_validation: {
        pre_market_briefing: await validateDependencies(dateStr, ['analysis', 'morning_predictions'], env).catch(() => ({ isValid: false, error: 'Validation failed' })),
        intraday_check: await validateDependencies(dateStr, ['morning_predictions', 'pre_market_briefing'], env).catch(() => ({ isValid: false, error: 'Validation failed' })),
        end_of_day_summary: await validateDependencies(dateStr, ['intraday_check'], env).catch(() => ({ isValid: false, error: 'Validation failed' }))
      },
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    logger.error('❌ [STATUS] Status management failed', { requestId, error: error.message });

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

/**
 * Handle comprehensive KV verification and logging test
 */
export async function handleKVVerificationTest(request, env) {
  const requestId = crypto.randomUUID();
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];

  try {
    logger.info('🧪 [KV VERIFICATION] Comprehensive KV test requested', { requestId, date: dateStr });

    // Test KV operations with logging
    const testKey = `kv_test_${requestId}`;
    const testValue = JSON.stringify({
      test_id: requestId,
      timestamp: new Date().toISOString(),
      data: 'KV verification test data'
    });

    const results = {
      test_operations: {},
      data_integrity: {},
      logging_output: [],
      performance_metrics: {}
    };

    // Test 1: PUT with verification
    const putStartTime = Date.now();
    try {
      const { putWithVerification, logKVOperation } = await import('../kv-utils.js');
      const success = await putWithVerification(testKey, testValue, env, {
        expirationTtl: 300 // 5 minutes
      });

      results.test_operations.put_with_verification = {
        success,
        duration: Date.now() - putStartTime,
        key: testKey,
        bytes: testValue.length
      };

      logger.info('KV PUT test completed', { success, duration: Date.now() - putStartTime });
    } catch (error) {
      results.test_operations.put_with_verification = {
        success: false,
        error: error.message,
        duration: Date.now() - putStartTime
      };
      logger.error('KV PUT test failed', { error: error.message });
    }

    // Test 2: GET with retry
    const getStartTime = Date.now();
    try {
      const { getWithRetry } = await import('../kv-utils.js');
      const retrievedValue = await getWithRetry(testKey, env, 3, 500);

      results.test_operations.get_with_retry = {
        success: true,
        duration: Date.now() - getStartTime,
        key: testKey,
        bytes: retrievedValue.length,
        integrity_check: retrievedValue === testValue
      };

      logger.info('KV GET test completed', {
        success: true,
        duration: Date.now() - getStartTime,
        integrity: retrievedValue === testValue
      });
    } catch (error) {
      results.test_operations.get_with_retry = {
        success: false,
        error: error.message,
        duration: Date.now() - getStartTime
      };
      logger.error('KV GET test failed', { error: error.message });
    }

    // Test 3: Job status system
    const statusStartTime = Date.now();
    try {
      const { updateJobStatus, getJobStatus } = await import('../kv-utils.js');
      await updateJobStatus('kv_test', dateStr, 'testing', env, {
        test_id: requestId,
        operation: 'verification'
      });

      const status = await getJobStatus('kv_test', dateStr, env);

      results.test_operations.job_status_system = {
        success: true,
        duration: Date.now() - statusStartTime,
        status: status,
        update_successful: status?.status === 'testing'
      };

      logger.info('KV job status test completed', {
        success: true,
        duration: Date.now() - statusStartTime,
        status: status?.status
      });
    } catch (error) {
      results.test_operations.job_status_system = {
        success: false,
        error: error.message,
        duration: Date.now() - statusStartTime
      };
      logger.error('KV job status test failed', { error: error.message });
    }

    // Test 4: Dependency validation
    const dependencyStartTime = Date.now();
    try {
      const { validateDependencies } = await import('../kv-utils.js');
      const validation = await validateDependencies(dateStr, ['analysis'], env);

      results.test_operations.dependency_validation = {
        success: true,
        duration: Date.now() - dependencyStartTime,
        validation_result: validation,
        system_functional: true
      };

      logger.info('KV dependency validation test completed', {
        success: true,
        duration: Date.now() - dependencyStartTime,
        validation: validation.isValid
      });
    } catch (error) {
      results.test_operations.dependency_validation = {
        success: false,
        error: error.message,
        duration: Date.now() - dependencyStartTime
      };
      logger.error('KV dependency validation test failed', { error: error.message });
    }

    // Test 5: Cleanup
    try {
      const { deleteWithVerification } = await import('../kv-utils.js');
      await deleteWithVerification(testKey, env);

      results.test_operations.cleanup = {
        success: true,
        key: testKey
      };

      logger.info('KV cleanup test completed', { success: true });
    } catch (error) {
      results.test_operations.cleanup = {
        success: false,
        error: error.message,
        key: testKey
      };
      logger.error('KV cleanup test failed', { error: error.message });
    }

    // Calculate overall success rate
    const operations = Object.values(results.test_operations);
    const successfulOperations = operations.filter(op => op.success).length;
    const totalOperations = operations.length;
    const successRate = Math.round((successfulOperations / totalOperations) * 100);

    results.overall_metrics = {
      total_operations: totalOperations,
      successful_operations: successfulOperations,
      success_rate: `${successRate}%`,
      kv_system_healthy: successRate >= 80,
      test_duration: Date.now() - parseInt(requestId.substring(0, 8), 16) // Approximate
    };

    logger.info('🧪 [KV VERIFICATION] Comprehensive KV test completed', {
      requestId,
      successRate,
      totalOperations,
      successfulOperations,
      overallHealth: successRate >= 80
    });

    return new Response(JSON.stringify({
      success: true,
      request_id: requestId,
      test_date: dateStr,
      ...results,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    logger.error('❌ [KV VERIFICATION] Comprehensive KV test failed', {
      requestId,
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
