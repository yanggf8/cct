/**
 * Analysis-related HTTP Request Handlers - TypeScript
 * Handles core trading analysis functionality with comprehensive type safety
 */

import { runBasicAnalysis, runWeeklyMarketCloseAnalysis } from '../analysis.ts';
import { runEnhancedAnalysis, validateSentimentEnhancement, type EnhancedAnalysisResults, type ValidationResult } from '../enhanced_analysis.ts';
import { runEnhancedFeatureAnalysis } from '../enhanced_feature_analysis.ts';
import { runIndependentTechnicalAnalysis } from '../independent_technical_analysis.ts';
import { analyzeSingleSymbol, type PerSymbolAnalysisResult } from '../per_symbol_analysis.ts';
import { createLogger } from '../logging.ts';
import { createHandler, createAPIHandler, type EnhancedContext } from '../handler-factory.ts';
import { createAnalysisResponse, type AnalysisResponseOptions } from '../response-factory.ts';
import { BusinessMetrics } from '../monitoring.ts';
import { getJobStatus, validateDependencies } from '../kv-utils.ts';
import { createDAL, type DALInstance } from '../dal.ts';
import type { CloudflareEnvironment } from '../../types.ts';

const logger = createLogger('analysis-handlers');

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Base error response structure
 */
interface BaseErrorResponse {
  success: false;
  error: string;
  request_id: string;
  timestamp: string;
  symbol?: string;
  usage?: string;
  action_required?: string;
  date?: string;
  analysis_found?: boolean;
  symbols_analyzed?: number;
}

/**
 * Morning predictions response structure
 */
interface MorningPredictionsResponse {
  success: boolean;
  message?: string;
  request_id: string;
  date: string;
  predictions_stored?: boolean;
  signal_count?: number;
  high_confidence_signals?: number;
  average_confidence?: string;
  predictions_key?: string;
  timestamp?: string;
  error?: string;
  action_required?: string;
  analysis_found?: boolean;
  symbols_analyzed?: number;
}

/**
 * Status management response structure
 */
interface StatusManagementResponse {
  success: boolean;
  request_id: string;
  date: string;
  job_statuses: Record<string, any>;
  data_exists: Record<string, boolean>;
  dependency_validation: {
    pre_market_briefing: any;
    intraday_check: any;
    end_of_day_summary: any;
  };
  timestamp?: string;
  error?: string;
}

/**
 * KV verification test results structure
 */
interface KVVerificationResults {
  test_operations: {
    put_with_verification: {
      success: boolean;
      duration?: number;
      key?: string;
      bytes?: number;
      error?: string;
    };
    get_with_retry: {
      success: boolean;
      duration?: number;
      key?: string;
      bytes?: number;
      integrity_check?: boolean;
      error?: string;
    };
    job_status_system: {
      success: boolean;
      duration?: number;
      status?: any;
      update_successful?: boolean;
      error?: string;
    };
    dependency_validation: {
      success: boolean;
      duration?: number;
      validation_result?: any;
      system_functional?: boolean;
      error?: string;
    };
    cleanup: {
      success: boolean;
      key?: string;
      error?: string;
    };
  };
  data_integrity: Record<string, any>;
  logging_output: any[];
  performance_metrics: Record<string, any>;
  overall_metrics: {
    total_operations: number;
    successful_operations: number;
    success_rate: string;
    kv_system_healthy: boolean;
    test_duration: number;
  };
}

/**
 * KV verification test response structure
 */
interface KVVerificationResponse extends KVVerificationResults {
  success: boolean;
  request_id: string;
  test_date: string;
  error?: string;
  timestamp?: string;
}

/**
 * Analysis request context interface
 */
interface AnalysisContext extends EnhancedContext {
  requestId: string;
}

/**
 * Handler function with proper typing
 */
type HandlerFunction = (request: Request, env: CloudflareEnvironment, ctx: AnalysisContext) => Promise<Response>;

// ============================================================================
// Handler Functions
// ============================================================================

/**
 * Handle manual analysis requests (Enhanced with sentiment)
 */
export const handleManualAnalysis = createAPIHandler('enhanced-analysis', async (request: Request, env: CloudflareEnvironment, ctx: AnalysisContext): Promise<Response> => {
  // Track business metrics
  BusinessMetrics.analysisRequested('manual_enhanced', 5);

  try {
    const analysis: EnhancedAnalysisResults = await runEnhancedAnalysis(env, {
      triggerMode: 'manual_analysis_enhanced',
      requestId: ctx.requestId
    });

    // Track successful completion
    BusinessMetrics.analysisCompleted('manual_enhanced',
      analysis.symbols_analyzed?.length || 0,
      analysis.execution_metrics?.total_time_ms || 0
    );

    const options: AnalysisResponseOptions = {
      requestId: ctx.requestId,
      symbolsAnalyzed: analysis.symbols_analyzed?.length || 0,
      processingTime: analysis.execution_metrics?.total_time_ms,
      confidence: analysis.overall_confidence
    };

    return createAnalysisResponse(analysis, options);

  } catch (error: any) {
    // Try fallback to basic analysis
    try {
      const basicAnalysis = await runBasicAnalysis(env, {
        triggerMode: 'manual_analysis_fallback',
        requestId: ctx.requestId
      });

      (basicAnalysis as any).fallback_reason = error.message;

      BusinessMetrics.analysisCompleted('manual_fallback',
        basicAnalysis.symbols_analyzed?.length || 0,
        basicAnalysis.execution_metrics?.total_time_ms || 0
      );

      const options: AnalysisResponseOptions = {
        requestId: ctx.requestId,
        symbolsAnalyzed: basicAnalysis.symbols_analyzed?.length || 0,
        processingTime: basicAnalysis.execution_metrics?.total_time_ms,
        fallbackReason: error.message
      };

      return createAnalysisResponse(basicAnalysis, options);
    } catch (fallbackError: any) {
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
export async function handleEnhancedFeatureAnalysis(request: Request, env: CloudflareEnvironment): Promise<Response> {
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
  } catch (error: any) {
    logger.error('Enhanced feature analysis failed', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    const errorResponse: BaseErrorResponse = {
      success: false,
      error: error.message,
      request_id: requestId,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(errorResponse, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle independent technical analysis requests
 */
export async function handleIndependentTechnicalAnalysis(request: Request, env: CloudflareEnvironment): Promise<Response> {
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
  } catch (error: any) {
    logger.error('Independent technical analysis failed', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    const errorResponse: BaseErrorResponse = {
      success: false,
      error: error.message,
      request_id: requestId,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(errorResponse, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle per-symbol analysis requests
 */
export async function handlePerSymbolAnalysis(request: Request, env: CloudflareEnvironment): Promise<Response> {
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  const symbol = url.searchParams.get('symbol');

  try {
    if (!symbol) {
      logger.warn('Per-symbol analysis requested without symbol parameter', { requestId });

      const errorResponse: BaseErrorResponse = {
        success: false,
        error: 'Symbol parameter is required',
        request_id: requestId,
        timestamp: new Date().toISOString(),
        usage: '/analyze-symbol?symbol=AAPL'
      };

      return new Response(JSON.stringify(errorResponse, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    logger.info('Per-symbol analysis requested', { requestId, symbol });

    const analysis: PerSymbolAnalysisResult = await analyzeSingleSymbol(symbol, env, { requestId });

    logger.info('Per-symbol analysis completed', {
      requestId,
      symbol,
      confidence: analysis.confidence,
      direction: analysis.direction
    });

    return new Response(JSON.stringify(analysis, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    logger.error('Per-symbol analysis failed', {
      requestId,
      symbol: symbol || undefined,
      error: error.message,
      stack: error.stack
    });

    const errorResponse: BaseErrorResponse = {
      success: false,
      error: error.message,
      symbol: symbol || undefined,
      request_id: requestId,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(errorResponse, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle sentiment testing requests
 */
export async function handleSentimentTest(request: Request, env: CloudflareEnvironment): Promise<Response> {
  const requestId = crypto.randomUUID();

  try {
    logger.info('Sentiment validation test requested', { requestId });

    const validation: ValidationResult = await validateSentimentEnhancement(env, { requestId });

    logger.info('Sentiment validation completed', {
      requestId,
      success: validation.success,
      modelsAvailable: validation.models_available
    });

    return new Response(JSON.stringify(validation, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    logger.error('Sentiment validation test failed', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    const errorResponse: BaseErrorResponse = {
      success: false,
      error: error.message,
      request_id: requestId,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(errorResponse, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle morning predictions generation from existing analysis data
 */
export async function handleGenerateMorningPredictions(request: Request, env: CloudflareEnvironment): Promise<Response> {
  const requestId = crypto.randomUUID();
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];

  try {
    logger.info('🌅 Morning predictions generation requested', { requestId, date: dateStr });

    // Check if analysis data exists for today
    const dal: DALInstance = createDAL(env);
    const analysisKey = `analysis_${dateStr}`;
    const analysisResult = await dal.read(analysisKey);

    if (!analysisResult.success || !analysisResult.data) {
      logger.warn('⚠️ No analysis data found for today', { requestId, date: dateStr });

      const errorResponse: MorningPredictionsResponse = {
        success: false,
        error: 'No analysis data found for today. Run analysis first.',
        request_id: requestId,
        date: dateStr,
        action_required: 'Run /analyze endpoint first'
      };

      return new Response(JSON.stringify(errorResponse, null, 2), {
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

      const successResponse: MorningPredictionsResponse = {
        success: true,
        message: 'Morning predictions generated and stored successfully',
        request_id: requestId,
        date: dateStr,
        predictions_stored: !!predictions,
        signal_count: predictions?.predictions?.length || 0,
        high_confidence_signals: predictions?.metadata?.totalSignals || 0,
        average_confidence: predictions?.metadata?.averageConfidence?.toFixed(1) || '0',
        predictions_key: predictionsKey,
        timestamp: new Date().toISOString()
      };

      return new Response(JSON.stringify(successResponse, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      logger.error('❌ Failed to generate morning predictions', { requestId, date: dateStr });

      const errorResponse: MorningPredictionsResponse = {
        success: false,
        error: 'Failed to generate morning predictions from analysis data',
        request_id: requestId,
        date: dateStr,
        analysis_found: !!analysis,
        symbols_analyzed: analysis.symbols_analyzed?.length || 0
      };

      return new Response(JSON.stringify(errorResponse, null, 2), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error: any) {
    logger.error('❌ Morning predictions generation failed', {
      requestId,
      date: dateStr,
      error: error.message,
      stack: error.stack
    });

    const errorResponse: MorningPredictionsResponse = {
      success: false,
      error: error.message,
      request_id: requestId,
      date: dateStr,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(errorResponse, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle status management for testing the KV pipeline
 */
export async function handleStatusManagement(request: Request, env: CloudflareEnvironment): Promise<Response> {
  const requestId = crypto.randomUUID();
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];

  try {
    logger.info('🔍 [STATUS] Status management requested', { requestId, date: dateStr });

    // Get all job statuses for today
    const jobTypes = ['analysis', 'morning_predictions', 'pre_market_briefing', 'intraday_check', 'end_of_day_summary'];
    const statuses: Record<string, any> = {};

    for (const jobType of jobTypes) {
      try {
        const status = await getJobStatus(jobType, dateStr, env);
        statuses[jobType] = status;
      } catch (error: any) {
        statuses[jobType] = { status: 'missing', error: error.message };
      }
    }

    // Check key data existence
    const dataKeys: Record<string, string> = {
      analysis: `analysis_${dateStr}`,
      morning_predictions: `morning_predictions_${dateStr}`,
      intraday_tracking: `intraday_tracking_${dateStr}`,
      eod_summary: `eod_summary_${dateStr}`
    };

    const dal: DALInstance = createDAL(env);
    const dataExists: Record<string, boolean> = {};

    for (const [keyName, keyValue] of Object.entries(dataKeys)) {
      try {
        const result = await dal.read(keyValue);
        dataExists[keyName] = result.success && !!result.data;
      } catch (error: unknown) {
        dataExists[keyName] = false;
      }
    }

    const successResponse: StatusManagementResponse = {
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
    };

    return new Response(JSON.stringify(successResponse, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    logger.error('❌ [STATUS] Status management failed', { requestId, error: error.message });

    const errorResponse: StatusManagementResponse = {
      success: false,
      request_id: requestId,
      date: dateStr,
      job_statuses: {},
      data_exists: {},
      dependency_validation: {
        pre_market_briefing: { isValid: false, error: 'Failed' },
        intraday_check: { isValid: false, error: 'Failed' },
        end_of_day_summary: { isValid: false, error: 'Failed' }
      },
      error: error.message,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(errorResponse, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle comprehensive KV verification and logging test
 */
export async function handleKVVerificationTest(request: Request, env: CloudflareEnvironment): Promise<Response> {
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

    const results: KVVerificationResults = {
      test_operations: {
        put_with_verification: { success: false },
        get_with_retry: { success: false },
        job_status_system: { success: false },
        dependency_validation: { success: false },
        cleanup: { success: false }
      },
      data_integrity: {},
      logging_output: [],
      performance_metrics: {},
      overall_metrics: {
        total_operations: 0,
        successful_operations: 0,
        success_rate: '0%',
        kv_system_healthy: false,
        test_duration: 0
      }
    };

    // Test 1: PUT with verification
    const putStartTime = Date.now();
    try {
      const { putWithVerification } = await import('../kv-utils.js');
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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

    const successResponse: KVVerificationResponse = {
      success: true,
      request_id: requestId,
      test_date: dateStr,
      ...results,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(successResponse, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    logger.error('❌ [KV VERIFICATION] Comprehensive KV test failed', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    const errorResponse: KVVerificationResponse = {
      success: false,
      request_id: requestId,
      test_date: dateStr,
      error: error.message,
      test_operations: {
        put_with_verification: { success: false },
        get_with_retry: { success: false },
        job_status_system: { success: false },
        dependency_validation: { success: false },
        cleanup: { success: false }
      },
      data_integrity: {},
      logging_output: [],
      performance_metrics: {},
      overall_metrics: {
        total_operations: 0,
        successful_operations: 0,
        success_rate: '0%',
        kv_system_healthy: false,
        test_duration: 0
      },
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(errorResponse, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}