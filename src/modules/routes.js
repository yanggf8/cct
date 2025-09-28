/**
 * HTTP Request Routing Module
 * Enhanced with modular handlers and structured logging
 */

import { handleWeeklyAnalysisPage, handleWeeklyDataAPI } from './weekly-analysis.js';
import { createRequestLogger, initLogging } from './logging.js';
import { PerformanceMonitor, BusinessMetrics } from './monitoring.js';

// Import modular handlers
import {
  handleManualAnalysis,
  handleEnhancedFeatureAnalysis,
  handleIndependentTechnicalAnalysis,
  handlePerSymbolAnalysis,
  handleSentimentTest,
  handleGetResults,
  handleFactTable,
  handleCronHealth,
  handleKVDebug,
  handleKVWriteTest,
  handleKVReadTest,
  handleKVGet,
  handleHealthCheck,
  handleModelHealth,
  handleDebugEnvironment,
  handleFacebookTest,
  handleTestAllFacebookMessages,
  handleWeeklyReport,
  handleFridayMarketCloseReport,
  handleDailySummaryAPI,
  handleDailySummaryPageRequest,
  handleBackfillDailySummaries,
  handleVerifyBackfill,
  handleGenerateMorningPredictions
} from './handlers/index.js';

// Import comprehensive report handlers
import { handlePreMarketBriefing } from './handlers/briefing-handlers.js';
import { handleIntradayCheck } from './handlers/intraday-handlers.js';
import { handleEndOfDaySummary } from './handlers/end-of-day-handlers.js';
import { handleWeeklyReview } from './handlers/weekly-review-handlers.js';

// Import optimization test endpoints
import {
  handleOptimizationTest,
  handleKPITest,
  handleErrorTest,
  handleOptimizedHealth,
  handlePerformanceTest,
  handleAlertTest,
  handleEnhancementStatus
} from './test-optimization-endpoint.js';

// Legacy handlers that haven't been modularized yet
import {
  handleFridayMondayPredictionsReport,
  handleHighConfidenceTest,
  handleKVCleanup,
  handleDebugWeekendMessage,
  handleSentimentDebugTest,
  handleModelScopeTest,
  handleTestLlama,
  handleR2Upload
} from './handlers.js';

/**
 * Validate request for sensitive endpoints
 */
function validateRequest(request, url, env) {
  // Check API key for sensitive endpoints
  const sensitiveEndpoints = ['/analyze', '/enhanced-feature-analysis', '/technical-analysis', '/r2-upload', '/test-facebook', '/test-high-confidence', '/test-sentiment', '/test-all-facebook', '/analyze-symbol', '/admin/backfill-daily-summaries', '/admin/verify-backfill'];

  if (sensitiveEndpoints.includes(url.pathname)) {
    const apiKey = request.headers.get('X-API-KEY');
    const validApiKey = env.WORKER_API_KEY;

    if (!validApiKey) {
      return { valid: false, error: 'API key not configured' };
    }

    if (!apiKey || apiKey !== validApiKey) {
      return { valid: false, error: 'Invalid or missing API key' };
    }
  }

  // Basic user agent validation for additional protection
  const userAgent = request.headers.get('User-Agent') || '';
  if (userAgent.includes('bot') && !userAgent.includes('Googlebot')) {
    return { valid: false, error: 'Blocked user agent' };
  }

  return { valid: true };
}

/**
 * Main HTTP request handler with monitoring and structured logging
 */
export async function handleHttpRequest(request, env, ctx) {
  // Initialize logging and monitoring
  initLogging(env);
  const requestLogger = createRequestLogger('http');
  const url = new URL(request.url);

  // Start performance monitoring
  const monitor = PerformanceMonitor.monitorRequest(request);

  // Log incoming request
  const startTime = requestLogger.logRequest(request);

  try {
    // Input validation and API key check for sensitive endpoints
    const validationResult = validateRequest(request, url, env);
    if (!validationResult.valid) {
      const errorResponse = new Response(JSON.stringify({
        success: false,
        error: validationResult.error,
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: validationResult.error.includes('API key') ? 401 : 400,
        headers: { 'Content-Type': 'application/json' }
      });

      // Log security event
      if (validationResult.error.includes('API key')) {
        BusinessMetrics.apiRequest(url.pathname, request.method, 401, Date.now() - startTime);
      }

      monitor.complete(errorResponse);
      requestLogger.logResponse(errorResponse, url.pathname, startTime);
      return errorResponse;
    }
  
    // Route requests to appropriate handlers
    let response;
    switch (url.pathname) {
      case '/analyze':
        response = await handleManualAnalysis(request, env);
        break;
      case '/generate-morning-predictions':
        response = await handleGenerateMorningPredictions(request, env);
        break;
    case '/enhanced-feature-analysis':
      return handleEnhancedFeatureAnalysis(request, env);
    case '/technical-analysis':
      return handleIndependentTechnicalAnalysis(request, env);
    case '/results':
      return handleGetResults(request, env);
    case '/health':
      return handleHealthCheck(request, env);
    case '/test-optimization':
      return handleOptimizationTest(request, env);
    case '/test-kpi':
      return handleKPITest(request, env);
    case '/test-error':
      return handleErrorTest(request, env);
    case '/health-optimized':
      return handleOptimizedHealth(request, env);
    case '/test-performance':
      return handlePerformanceTest(request, env);
    case '/test-alert':
      return handleAlertTest(request, env);
    case '/enhancement-status':
      return handleEnhancementStatus(request, env);
    case '/test-facebook':
      return handleFacebookTest(request, env);
    case '/weekly-report':
      return handleWeeklyReport(request, env);
    case '/friday-market-close-report':
      return handleFridayMarketCloseReport(request, env);
    case '/friday-monday-predictions-report':
      return handleFridayMondayPredictionsReport(request, env);
    case '/test-high-confidence':
      return handleHighConfidenceTest(request, env);
    case '/fact-table':
      return handleFactTable(request, env);
    case '/kv-cleanup':
      return handleKVCleanup(request, env);
    case '/debug-weekend-message':
      return handleDebugWeekendMessage(request, env);
    case '/kv-get':
      return handleKVGet(request, env);
    case '/kv-debug':
      return handleKVDebug(request, env);
    case '/kv-write-test':
      return handleKVWriteTest(request, env);
    case '/kv-read-test':
      return handleKVReadTest(request, env);
    case '/weekly-analysis':
      return handleWeeklyAnalysisPage(request, env);
    case '/api/weekly-data':
      return handleWeeklyDataAPI(request, env);
    case '/daily-summary':
      response = await handleDailySummaryPageRequest(request, env);
      break;
    case '/pre-market-briefing':
      return handlePreMarketBriefing(request, env);
    case '/intraday-check':
      return handleIntradayCheck(request, env);
    case '/end-of-day-summary':
      return handleEndOfDaySummary(request, env);
    case '/weekly-review':
      return handleWeeklyReview(request, env);
    case '/test-sentiment':
      return handleSentimentTest(request, env);
    case '/debug-sentiment':
      return handleSentimentDebugTest(request, env);
    case '/test-modelscope':
      return handleModelScopeTest(request, env);
    case '/test-llama':
      return handleTestLlama(request, env);
    case '/debug-env':
      return handleDebugEnvironment(request, env);
    case '/model-health':
      return handleModelHealth(request, env);
    case '/r2-upload':
      return handleR2Upload(request, env);
    case '/test-all-facebook':
      return handleTestAllFacebookMessages(request, env);
    case '/analyze-symbol':
      return handlePerSymbolAnalysis(request, env);
    case '/cron-health':
      return handleCronHealth(request, env);
    case '/api/daily-summary':
      return handleDailySummaryAPI(request, env);
    case '/admin/backfill-daily-summaries':
      return handleBackfillDailySummaries(request, env);
    case '/admin/verify-backfill':
      return handleVerifyBackfill(request, env);
    case '/favicon.ico':
      // Return a simple 1x1 transparent GIF as favicon
      const faviconData = new Uint8Array([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04,
        0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02,
        0x02, 0x04, 0x01, 0x00, 0x3b
      ]);
      return new Response(faviconData, {
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'public, max-age=86400'
        }
      });
    default:
      // Default response for root and unknown paths
      if (url.pathname === '/' || url.pathname === '/status') {
        return new Response(JSON.stringify({
          success: true,
          message: 'TFT Trading System Worker is operational',
          timestamp: new Date().toISOString(),
          version: env.WORKER_VERSION || '2.0-Modular',
          endpoints: [
            '/health - Health check',
            '/model-health - Model files R2 accessibility check',
            '/r2-upload - R2 enhanced model files upload API',
            '/analyze - Enhanced analysis (Neural Networks + Sentiment)',
            '/results - Get latest results',
            '/fact-table - Prediction accuracy table',
            '/weekly-analysis - Weekly analysis dashboard',
            '/api/weekly-data - Weekly analysis data API',
            '/pre-market-briefing - Morning high-confidence signals (≥70%)',
            '/intraday-check - Real-time signal performance tracking',
            '/end-of-day-summary - Market close analysis & tomorrow outlook',
            '/weekly-review - Comprehensive high-confidence signal analysis',
            '/test-sentiment - Sentiment enhancement validation',
            '/analyze-symbol?symbol=AAPL - Fine-grained per-symbol analysis',
            '/cron-health - Cron job execution health monitoring'
          ]
        }, null, 2), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      response = new Response(JSON.stringify({
        success: false,
        error: 'Endpoint not found',
        requested_path: url.pathname,
        timestamp: new Date().toISOString(),
        available_endpoints: [
          '/', '/health', '/model-health', '/analyze', '/results', '/fact-table',
          '/weekly-analysis', '/api/weekly-data', '/pre-market-briefing', '/intraday-check',
          '/end-of-day-summary', '/weekly-review', '/test-sentiment', '/daily-summary'
        ]
      }, null, 2), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
      break;
    }

    // Complete monitoring and logging
    if (response) {
      monitor.complete(response);
      requestLogger.logResponse(response, url.pathname, startTime);
      return response;
    }

  } catch (error) {
    // Handle unexpected errors
    const errorResponse = new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });

    monitor.complete(errorResponse);
    requestLogger.logResponse(errorResponse, url.pathname, startTime, {
      error: error.message
    });

    return errorResponse;
  }
}